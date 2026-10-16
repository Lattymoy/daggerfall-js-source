# DFU default cursor (vendored)

`public/art/dfu-cursor/Cursor2.png` - Daggerfall Unity's own mouse cursor:
the 32x32 three-blue arrow that `ProjectSettings/ProjectSettings.asset`
names as Unity's `defaultCursor` (hotspot 0,0). DFU reads no cursor out
of ARENA2: `DaggerfallUnitySetupGameWizard.SetCursor` takes a mod's
`Cursor` texture replacement, else `Cursor.SetCursor(null, ...)` - Unity's
default, this file. (`Assets/Resources/Cursor.png`, the 10x10 one beside
it, is not the default and is not carried.)

This is DFU-AUTHORED art from Unity's Resources folder, not ARENA2 data.
It is released under DFU's MIT License (Copyright (c) 2009-2023
Daggerfall Workshop), the same licence as the C# this port translates,
and the port credits Daggerfall Unity on its About screen.

Provenance: https://github.com/Interkarma/daggerfall-unity
`Assets/Resources/Cursor2.png` at commit
`2343305d1d83ccc0de57a81e3b1e61188a997e34`, byte for byte.
`dfu-cursor.files.json` is the listing (path, sha256, pixel size). It was
generated from that file, not written by hand, and test/tooling/doctrine.test.js
reads it as the authority for what may stand under public/art/dfu-cursor/.

Worn by `src/ui/cursor.js` on the classic skin (CLASSIC-CURSOR, FIELD BUGS
2026-10-03).
