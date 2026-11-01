# Ambient Text

A 1:1 port of Regnier's Ambient Text 1.8 for Daggerfall Unity. Now and then, outdoors or underground, a line of the
author's prose appears on the HUD about the place the player stands in: what a crypt smells of, what a village sounds
like at night. It never speaks indoors, and after it speaks it stays quiet for longer. It is the `mod-ambient-text`
row in "The world" group, with its settings in the Mods pane.

## How it works

`src/systems/ambientText.js` holds one component for the whole game, as the mod is one object created at load; the
host that owns the motor claims it with `setAmbientTextHost` and ticks it (`tickAmbientText`). The table is the
author's 918 lines, vendored as `vendor/ambient-text/ambientTexts.json`, matching the table the mod's DLL builds.

### The tick

Each frame, in the mod's order:

1. Not ready or paused: return.
2. Inside a building: return, before the clock is written, so the interval keeps running indoors.
3. Unless real time has passed `lastTickTime + tickTimeInterval` (strictly), return.
4. Reset the clock to the standard interval.
5. Roll `textChance` (`dice100`); on a miss, return.
6. Build a key and look it up; nothing found, return.
7. Show the line for its display time, then wait the longer post-text interval.

The pace is wall-clock: resting does not speed it up. The port's own `Enabled` switch answers after the clock, like the
building check, so turning it on and off never resets the pace.

### The key (`ambientTextKey`)

A key is `{family}{index}` with index 0..9.

- **Underground** the family is the dungeon type's name (`Crypt3`); nothing else is read.
- **Above ground** it is the location type of the rect the player stands in, or `None` in open country, plus one of
  three tails chosen fresh each time: the climate (`climateKey`), the hour (Day/Night), or the hour and the sky
  (`weatherKey`: Rainy, Snowy, Cloudy, Clear, in that order).

The index is rolled 0..9, never the one that last spoke. `lastIndex` changes only when a line is found.

### The table is sparse

233 families x 10 indices would be 2,330 keys; there are 918. A key the table lacks says nothing. The gaps are the
author's frequency curve: a family with ten lines speaks often, one with none is silent. The port never fills them.

### Hosts

`src/scenes/world.js` claims the component and feeds it the place, hour, climate and weather; `src/scenes/exterior.js`
and the `?dungeon` probe (`src/scenes/dungeon.js`) do the same for themselves. The tick sits above the modal gate, so one
call covers every mode. Weather flags come from `src/world/weather.js` `weatherFlags`, the one derivation of DFU's
`WeatherManager` flags.

## Rules

- Ported 1:1 (Mac). The writing is the mod; the port must not lose or flatten any of the 918 lines.
- One component for the game, never one per host, so the no-repeat rule and the pace survive doors.
- The table stays sparse; a missing key says nothing.
- Settings are read live at every tick.

## Daggerfall Unity

The mod is `AmbientTextMod` (a MonoBehaviour) and `AmbientText` (the table), recovered from the shipped DLL by
disassembly. Its seams: `PlayerEnterExit.IsPlayerInsideBuilding`, `DaggerfallUI.AddHUDText`, `Dice100.SuccessRoll`,
`PlayerGPS.IsPlayerInLocationRect`, `PlayerGPS.CurrentClimateIndex`, `WorldTime.Now.IsDay` and `WeatherManager`'s
flags. Not carried: the DLL itself, its debug logging, DFU's mod-init handshake, and the constructor's bench values.

## Code and tests

- `src/systems/ambientText.js` - the component, the key law, the settings
- `vendor/ambient-text/` - manifest, settings and the table
- `src/world/weather.js` `weatherFlags` - DFU's weather flags
- `test/systems/ambienttext.test.js` - the key law, sparseness both ways (every table key reachable), the clock

## Open

- The permission line in `vendor/ambient-text/README.md` is a placeholder; the Mod Registry row is open.
