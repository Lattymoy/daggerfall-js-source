# DFU interaction-mode icons (vendored)

`public/art/dfu-icons/*.png` - Daggerfall Unity's own interaction-mode icons,
the four sets `HUDInteractionModeIcon.LoadAssets` loads through
`DaggerfallUI.GetTextureFromResources("Icons/<name>")`:

| Style setting (`GUI/InteractionModeIcon`) | Set | displayScale |
|---|---|---|
| `classic`, `classicxhair` | `classic-*` | 3 |
| `monochrome` | `mono-*` | 0.8 |
| `colour`, `colourxhair` | `colour-*` | 1 |
| anything else (`icon`, `minimal`) | `icon-*` | 0.8 (`minimal` 0.5) |

Each set is `steal`, `grab`, `info` and `talk`.

These are DFU-AUTHORED art from Unity's Resources folder, not ARENA2 data.
They are released under DFU's MIT License (Copyright (c) 2009-2023
Daggerfall Workshop), the same licence as the C# this port translates, and
the port credits Daggerfall Unity on its About screen.

Provenance: https://github.com/Interkarma/daggerfall-unity
`Assets/Resources/Icons/` at commit
`2343305d1d83ccc0de57a81e3b1e61188a997e34`, byte for byte.
`dfu-icons.files.json` is the listing (paths, sha256, pixel sizes). It was
generated from those files, not written by hand, and test/doctrine.test.js
reads it as the authority for what may stand under public/art/dfu-icons/.

Read by `src/ui/modeIcons.js`; drawn by `src/ui/hudCrosshair.js` (HUD-ICON1).
