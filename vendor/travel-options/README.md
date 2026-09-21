# Travel Options 1.11 - Hazelnut (ported 1:1, its assets vendored)

**Travel Options 1.11** for Daggerfall Unity 1.0.0, by **Hazelnut**
(Nexus mod 122; the manifest's ContactInfo is `forums.dfworkshop.net`).
The mod's own description: "Travel options allowing for time
accelerated travel as well as standard fast travel". Its GUID is
`93f3ad1c-83cc-40ac-b762-96d2f47f2e05`.

Mac (Lattymoy) handed the shipped zip
(`TravelOptions-1.11-122-1-11-1721574422`) over on 2026-09-17: "This is
the next daggerfall mod we are to implement 1:1", with two additions of
his own - an enhanced-lane UI for it, and a check that it sits properly
on the port's Basic Roads (`vendor/roads-hazelnut/`, also Hazelnut's).

**Licence.** The mod's CODE is MIT ("Copyright (C) 2020 Hazelnut", the
header of every script; `PlayerAutoPilot.cs` is "Copyright (C) 2019
Jedidia" under the same licence). The port's implementation is written
from that source - `src/systems/travelOptions.js` and the files beside
it cite it line by line. The three TEXTURES below are the mod's own
art and carry no licence text of their own.

**Permission: [Mac: record Hazelnut's permission for the three
textures, or the link to it, here - the earlier mod records carry
theirs in this line. The port's Basic Roads note (`vendor/
roads-hazelnut/README.md`) records a permission from the same author.]**

## What is here

- `travel-options.dfmod.json` - the shipped bundle's manifest,
  verbatim (title, version 1.11, author, DFUnity 1.0.0, GUID, and the
  fifteen files it was built from: eight scripts, the settings, the
  presets, the manifest, the CSV and three textures).
- `modsettings.json` - the twelve sections as the bundle ships them
  (CautiousTravel, StopAtInnsTravel, ShipTravel, GeneralOptions,
  TimeAcceleration, Teleportation, RoadsIntegration,
  FastTravelCostScaling, RoadsJunctionMap, LocationColours, and the
  three unnamed spacer sections `__`, `-`, `_`, `--`, `.` the Mods
  pane draws as rules). `src/systems/modSettings.js` restates every
  key under the vendor key `travel-options`, section and name joined
  with a dot (`CautiousTravel.SpeedPenalty`), with the port's own
  `Enabled` in front. One key kind is new to the port for it: a
  ColorKey (`color: true`, an `#rrggbbaa` string), which DFU has
  natively and the port did not.
- `modpresets.json` - the twelve presets, verbatim: the four travel
  presets named in the readme (DefaultSettings, BalancedTravel,
  FreedomTravel, TediousTravel), three travel-map colour sets
  (DaggerfallUnity, DaggerfallOriginal, GhostPutty) and five junction
  map placements.
- `TravelOptionsModData.csv` - the mod's string table, verbatim: the
  fifty-one keys `TravelOptionsMod.Localize` reads, including the two
  help screens (SDF and non-SDF).
- `TravelOptions.txt` - the shipped readme.
- `Textures/TOcontrolUI.png` (320x27), `Textures/TOportsOff.png` and
  `Textures/TOportsOn.png` (45x11) - the travel control panel and the
  travel map's ports filter button.

  **These three are RE-ENCODES, not the author's own files.** The zip
  ships one `traveloptions.dfmod`, a Unity 2019.4.40f1 AssetBundle, and
  the PNGs the mod was built from are not in it: the bundle carries
  them as `Texture2D` objects in RGB24. `src/formats/unityBundle.js`
  read the bundle and the three were written back out as PNG, pixel for
  pixel (`tools/travelOptionsAssets.mjs` reproduces them from a copy of
  the zip). The PIXELS are the author's; the file bytes are the port's
  encoder, which is why the hashes in `test/vendorIntegrity.test.js`
  are of the re-encodes and this note says so rather than claiming a
  byte-for-byte carry.

## What is NOT here

- `traveloptions.dfmod` itself, and the `TravelOptions.dll` inside it
  (68 KB of compiled IL). The port reads the mod's SOURCE, from
  `github.com/ajrb/dfunity-mods` (`TravelOptions/Scripts/`), which was
  checked against this bundle before the port began: all eighty method
  names in the shipped DLL's string table resolve to the source's, and
  the settings keys the source reads are exactly the keys
  `modsettings.json` declares - no drift either way.
- The mod's four compatibility branches for mods the port does not
  have: **Hidden Map Locations** (its discovery set and its port
  reveal), **Real Grass** (`SendModMessage("Real Grass", "toggle")`),
  and the two DFU settings the port has no equivalent for
  (`SDFFontRendering` picks between the mod's two help texts and its
  two travel-time formats - the port carries both strings and picks
  the SDF one, because the port's text is not the classic bitmap
  font). Every one is recorded in `bible/06-Systems/Travel-Options.md`
  rather than silently dropped.

## The port

`src/systems/travelOptions.js` is the mod (`TravelOptionsMod.cs`),
`src/systems/travelAutopilot.js` is Jedidia's `PlayerAutoPilot.cs`,
`src/systems/travelPaths.js` the path-following geometry,
`src/ui/travelControlUI.js` the control panel (`TravelControlUI.cs`),
`src/ui/travelJunctionMap.js` the junction mini-map, and
`src/ui/travelPathsOverlay.js` the map window's path and dot drawing
(`TravelOptionsMapWindow.DrawPath` / `DrawLocation` /
`DrawMapSection`). The travel map and popup overrides live in the
port's own `src/ui/travelMapWindow.js` and `src/ui/travelPopUp.js`.
The enhanced lane's control panel and junction map are
`src/ui/enhancedTravelControl.js` - the port's own, not the mod's.

See `bible/06-Systems/Travel-Options.md`. Thank you, Hazelnut.
