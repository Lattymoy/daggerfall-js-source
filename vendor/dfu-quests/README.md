# DFU quest pack (vendored)

The quest source files and quest tables from **Daggerfall Unity**
(MIT License, Interkarma and contributors), vendored verbatim:

- `Quests/*.txt` - the 265 quest sources (classic quests decompiled to
  DFU's text form, plus DFU's own additions such as the tutorial and
  cure quests). This is the exact input DFU's quest machine executes.
- `Tables/QuestList-*.txt`, `Tables/Quests-*.txt` - the quest lists and
  the data tables the quest parser and resources read.

Provenance: https://github.com/Interkarma/daggerfall-unity
`Assets/StreamingAssets/Quests` and `Assets/StreamingAssets/Tables`
at commit `81e89e90c27bc3c1a7a61871e545fad129174dec`.

Why this is committed when ARENA2 and DFU's C# are not
(Port-Ledger route (a), approved by Mac 2026-08-20):

- ARENA2 is freeware but NOT redistributable - it never enters the repo.
  These files are not ARENA2: classic ships quests as QBN/QRC binaries,
  which DFU never parses. DFU's own MIT-licensed decompiled `.txt` form
  is the only input its quest engine reads, so a 1:1 engine port needs
  exactly these files.
- DFU's C# stays an external reference (the sparse clone,
  `tools/parity/prepare.sh`) because it is the SOURCE we translate, not
  data we consume. The quest pack is data the ported engine consumes at
  runtime, like the tables the port already generates from DFU data
  files - and vendoring it keeps the quest corpus gate runnable
  everywhere, with no network and no ARENA2.

License: MIT (Daggerfall Unity, Copyright (C) 2009-2023 Daggerfall
Workshop / Gavin Clayton and contributors). See the DFU repository for
the full license text.
