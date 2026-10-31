# Travel Options 1.11 - Hazelnut (the art that is still here)

**Travel Options 1.11** for Daggerfall Unity 1.0.0, by **Hazelnut**
(Nexus mod 122; GUID `93f3ad1c-83cc-40ac-b762-96d2f47f2e05`). Mac
(Lattymoy) handed the shipped zip
(`TravelOptions-1.11-122-1-11-1721574422`) over on 2026-09-17: "This is
the next daggerfall mod we are to implement 1:1".

**Licence.** The mod's CODE is MIT ("Copyright (C) 2020 Hazelnut", the
header of every script; `PlayerAutoPilot.cs` is "Copyright (C) 2019
Jedidia" under the same licence). The port's code is written from that
source, and `LICENSE` carries both notices. The three TEXTURES below are
the mod's own art and carry no licence text of their own.

**Permission: [Mac: record Hazelnut's permission for the three
textures, or the link to it, here - the earlier mod records carry
theirs in this line. Basic Roads' record (`bible/01-Overview/Own-Work.md`)
names a permission from the same author.]**

## What is left, and why

OWN-WORK3 (2026-10-31, the owner: "removing mods from outside authors and
instead replacing them with our own work") replaced the mod's data and
words with our own. Wave 2 does not replace art, so the author's three UI
pictures stay here until wave 3:

- `Textures/TOcontrolUI.png` (320x27), `Textures/TOportsOff.png` and
  `Textures/TOportsOn.png` (45x11) - the travel control panel and the
  travel map's ports filter button.

  **These three are RE-ENCODES, not the author's own files.** The bundle
  carries them as `Texture2D` objects in RGB24, and
  `tools/travelOptionsAssets.mjs` wrote them back out as PNG, pixel for
  pixel. The PIXELS are the author's; the file bytes are the port's
  encoder (their hashes are in `test/tooling/vendorIntegrity.test.js`).
- `travel-options.files.json` - our listing of those three files and their
  sha256, which the doctrine gate reads in place of the bundle's manifest.

## What left the tree

The manifest, the settings (`modsettings.json`), the twelve presets, the
string table (`TravelOptionsModData.csv`) and the shipped readme. The tree
at `8d110d8f7` still holds them. Our own work is the record now: the
settings in `src/systems/modSettings.js` (`travel-options`), the words in
`src/systems/travel/travelOptionsText.js`, and the code
`src/systems/travel/travelOptions.js` and the files beside it, ported from
the MIT source (`github.com/ajrb/dfunity-mods`, `TravelOptions/Scripts/`).
See `bible/06-Systems/Travel-Options.md`. Thank you, Hazelnut.
