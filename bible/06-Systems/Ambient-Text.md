# Ambient Text 1.8, ported 1:1 (AT, 2026-09-15)

Mac, 2026-09-15, handing over `Ambient_Text-303-1-8-1774575578.7z`:
"I now want to implement this as our next mod. 1:1."

**Ambient Text 1.8** by **Regnier**, for Daggerfall Unity 1.1.1
(GUID `ce0210ee-89cc-4ad7-a0d5-908fde918ce9`, contact
`forums.dfworkshop.net`). Its own description: "Environmental and
locational unobtrusive ambient text popups. For immersion."

Now and then, while you are outdoors or underground, a line appears in
the corner of the screen about the place you are standing in. What a
crypt smells of. What a village sounds like at night. What the desert
does to the light. It never speaks indoors, and after it has spoken it
goes quiet for longer.

| | |
|---|---|
| Vendored | `vendor/ambient-text/` - manifest, `modsettings.json`, `ambientTexts.json` |
| Port | `src/systems/ambientText.js` |
| Hosts | `src/scenes/world.js`, `src/scenes/exterior.js`, `src/scenes/dungeon.js` |
| Settings | `MOD_SETTINGS['ambient-text']` (`src/systems/modSettings.js`) |
| Row | `mod-ambient-text`, group "The world" (`src/systems/features.js`) |
| Credit | `CREDITS.mods` (`src/ui/credits.js`), About pane |
| Pins | `test/ambienttext.test.js` (26) |
| Registry | `01-Overview/Mod-Registry.md` |

## AT1 - what the mod actually is

Two files of C#, and one of them is data.

`AmbientTextMod` is a MonoBehaviour with seven fields and five methods,
and the whole of it fits on a page: a clock, a percentage roll, and a
string built out of where and when you are. `AmbientText` is a static
class whose only member is a `Hashtable` of **918 lines of the author's
own prose**.

So the arithmetic is not the mod. The writing is. Everything below is
in service of one question - which of the author's 918 lines does the
player get - and the port's job was to not lose any of them.

### The recovery

The manifest names two `.cs` files and the bundle carries neither; the
behaviour ships only as `AmbientText.dll` (117,760 bytes) inside a
UnityFS AssetBundle (version 7, LZ4HC, BlocksAndDirectoryInfoCombined).
It was disassembled with `monodis`. Out of the box only three of the
thirteen methods resolve - the rest reference `UnityEngine` and
`Assembly-CSharp` types that are not there - so stub assemblies
carrying those types were compiled with `mcs` and `monodis` was re-run
against them with `MONO_PATH` pointed at the stubs. All thirteen then
resolve, and the IL offsets cited in `systems/ambientText.js` are into
that dump.

### The table, and why it is vendored rather than transcribed

`ambientTexts.json` is in the bundle but **not** in the manifest's
`Files` list, so the mod never loads it: the runtime table is the
static `Hashtable` the DLL's `.cctor` builds, 14,699 bytes of IL doing
nothing but `Hashtable.Add(key, value)` 918 times.

That made the JSON suspect - a stale export is worth nothing - so it
was checked rather than trusted. The 918 `ldstr`/`ldstr`/`Add` triples
were parsed out of the IL and compared key by key with the JSON:
**918 pairs on each side, no duplicate key, no key on one side and not
the other, no value differing.** The JSON *is* the table. It is
therefore carried verbatim and imported as data, which is better than
transcribing 918 lines of someone else's writing into a JS file where
a typo would be invisible.

### The key law

Every key is `{family}{index}`, `index` 0..9.

**Underground** - `PlayerEnterExit.IsPlayerInsideDungeon` - the family
is the `DFRegion.DungeonTypes` name and there is no tail: `Crypt3`,
`VolcanicCaves7`, `Cemetery0`. The location, the hour and the sky are
not consulted at all.

**Above ground**, the family is the `DFRegion.LocationTypes` name of
the location rect you are standing in - or `None` (`0xffff`) if you are
in none, which is open country. `IsPlayerInLocationRect` is the gate,
not the map pixel: stand outside a city's rect on the pixel that
carries it and you are in the wilderness.

Then one of three tails, chosen by a fresh `Random.Range(0, 3)` every
single time:

| roll | tail | example |
|---|---|---|
| 0 | the climate | `TownVillageWoods2` |
| 1 | the hour | `TownVillageNight2` |
| 2 | the hour and the sky | `TownVillageNightRainy2` |

So the same spot speaks in all three registers, and which one you get
is luck.

`ClimateKey` is a `switch` over `PlayerGPS.CurrentClimateIndex - 224`
with nine arms - Desert, Desert, Mountains, Swamp, Swamp, Desert,
Woods, Woods, Woods - and a default of `Ocean`. `MapsFile.Climates`
begins at Ocean **223**, one below the subtrahend, so Ocean is not an
arm: it falls through with every index outside 224..232.

`WeatherKey` is an if/else ladder over `WeatherManager`'s four public
flags, in this order: `IsRaining || IsStorming` → `Rainy`, else
`IsSnowing` → `Snowy`, else `IsOvercast` → `Cloudy`, else `Clear`. The
order is load-bearing - a storm is also overcast, and it reads `Rainy`.

### THE TABLE IS SPARSE, AND THAT IS THE DESIGN

233 families x 10 indices would be 2,330 keys. There are 918.
`ReligionTempleDay` has all ten lines; `HomeYourShipsDayCloudy` has
none at all.

The mod handles this by **asking**: it builds a key, and if the table
does not carry it, this tick says nothing and `lastIndex` is left
alone. Which means the gaps are not holes - they are the author's
frequency curve. A family he wrote one line for speaks rarely; a family
he wrote ten for speaks often; a family he wrote none for is silent.

A port that filled the gaps, or that picked "from the keys that
exist", would be a louder and flatter mod wearing this one's name.
`test/ambienttext.test.js` pins the sparseness from both ends: the
count, and that a known-empty family still answers `null`.

**The other direction is pinned too, and it is the pin that matters.**
A key law that cannot spell one of the author's 918 keys does not
crash and does not show in a diff - it just silently never says that
line. So the test GENERATES the reachable key set from
`ambientTextKey` over every input it can be handed, and asserts the
table fits inside it. Change a separator, drop the climate tail,
mis-spell an enum name: it goes red and names the lines that fell out
of reach.

### The no-repeat rule is narrower than it looks

```
index = lastIndex;
do { index = Random.Range(0, 10); } while (index == lastIndex);
...
if (!AmbientTexts.Contains(key)) return null;
lastIndex = index;            // IL_0148 - INSIDE the Contains arm
return AmbientTexts[key];
```

`lastIndex` is written only on a **hit**. So the do/while refuses the
index that last *spoke*, not the index last *rolled*, and a run of
misses does not narrow the next roll. `lastIndex` starts at `-1`
(`.ctor`, IL 0x5de4), which `Random.Range(0, 10)` can never return, so
the first roll always leaves on its first attempt and all ten indices
are live until something has actually been said.

### The clock

```
Start:  lastTickTime = Time.unscaledTime;  tickTimeInterval = stdInterval;
```

`Time.unscaledTime` is a **timestamp** - real seconds since the game
started - and it is unaffected by `Time.timeScale`, which is how DFU
pauses. So the mod's pace is wall-clock: it does not speed up when you
rest, and it does not slow down when you ride.

`Update`, in order (the port's own `Enabled` switch is step 1½ - see
AUDIT AT F6 below for why it sits *after* `Start` and not before):

1. `!DaggerfallUnity.IsReady || !PlayerEnterExit || IsGamePaused` → return.
2. `IsPlayerInsideBuilding` → return. **Before the clock is written.**
3. `unscaledTime > lastTickTime + tickTimeInterval`, strictly → else return.
4. `lastTickTime = unscaledTime; tickTimeInterval = stdInterval;`
5. `Dice100.SuccessRoll(textChance)` → else return.
6. `SelectAmbientText()`; `IsNullOrWhiteSpace` → return.
7. `DaggerfallUI.AddHUDText(text, textDisplayTime)`.
8. `tickTimeInterval = postTextInterval.`

Step 2 is worth its own line, because it is the mod's nicest accident:
the early return happens **above** the clock, so the interval keeps
running while you are inside. Spend an hour in a shop and the first
frame back on the street greets you. The port keeps that, and answers
its own `Enabled` switch the same way - a switch that reset the clock
would be a behaviour DFU never had, since there a mod that is off is a
mod that was never loaded.

### The .ctor's other four fields are not carried

`textChance = 95`, `stdInterval = 2`, `postTextInterval = 4`,
`textDisplayTime = 3`. Those are the author's bench values and no
player ever sees them: `Awake` calls `LoadSettings` before `Start`
runs. Only `lastIndex = -1` matters, and it is carried.

## AT2 - the hosts

THE FOUR HOSTS RULE (`Home.md`), all four named:

| host | wired? | why |
|---|---|---|
| `scenes/world.js` | **yes** | claims the mod and ticks it ABOVE the modal gate |
| `scenes/exterior.js` | **yes** | the same, in the `?exterior` probe town |
| `scenes/worldModes.js` | **no, by derivation** | the interior host. Its frame is *consumed by* one of the two above, whose tick already ran this frame. |
| `scenes/dungeonContext.js` | **no, by derivation** | mounted by `worldModes` (shipping) or by `scenes/dungeon.js` (the probe), never on its own - it never owns the outermost motor. |

Plus `scenes/dungeon.js`, the standalone `?dungeon` probe, which *does*
own the outermost motor and so claims and ticks for itself.

The tick sits above the modal gate for the same reason the holiday text
does: `Update` is a MonoBehaviour `Update`, and DFU does not suspend
those when you walk through a door. **One** call there covers all three
of the shipping host's modes, and the mod's own
`IsPlayerInsideBuilding` arm - not a missing call - is what silences it
in a building.

**The mod is ONE object.** `Init` does
`new GameObject(mod.Title).AddComponent<AmbientTextMod>()` once, at
load, and nothing destroys it. Two of its fields depend on that -
`lastIndex`, the no-repeat rule, and `lastTickTime`, the pace - so a
port that built one per host would reset both at every door and speak
on the first frame of every transition. `systems/ambientText.js` holds
one module-level component and the host that owns the motor claims a
slot on it (`setAmbientTextHost`). `ready()` IS that claim, which is
the port's reading of `DaggerfallUnity.Instance.IsReady &&
PlayerEnterExit`.

The clock needs no host at all, which is what lets two of the four go
unwired without changing behaviour: a stretch with nobody ticking is
indistinguishable from a stretch of `IsPlayerInsideBuilding` returning
early, because both leave `lastTickTime` where it was and the elapsed
time is read back off the wall.

### The seams the port already had

| DFU | here |
|---|---|
| `PlayerEnterExit.IsPlayerInsideBuilding` | the host slot's own `insideBuilding()` - see AUDIT AT F5 |
| `DaggerfallUI.AddHUDText(text, delay)` | `townTalk.say(line, delay)` / `ctx.hudSay(line, delay)` → `ui/hudText.js` `add` (drawn by the classic bitmap arm on the classic skin and, since FONT1 2026-09-16, by `ui/enhancedHudText.js` in the pixel face on the enhanced one - Mac: "Ambient Text mod also doesnt use it") |
| `Dice100.SuccessRoll(chance)` | `combat/formulas.js` `dice100` |
| `PlayerGPS.IsPlayerInLocationRect` / `CurrentLocationType` | the hosts' `_musicInLocationRect` / `_musicLocationType` |
| `PlayerGPS.CurrentClimateIndex` | `maps.getClimateIndex(px.x, px.y)` |
| `WorldTime.Now.IsDay` | `worldClock.js` `isNight(minuteNow())`, negated |
| `WeatherManager`'s four flags | `world/weather.js` `weatherFlags(word)` - **new, and see below** |
| `PlayerEnterExit.Dungeon.Summary.DungeonType` | `worldModes.insideContext().dungeonType` - **new** |

`ctx.hudSay` gained the delay argument it had been dropping, so the
mod's per-line `textDisplayTime` reaches the dungeon host's HUD the way
it already reached the exterior one's.

### `weatherFlags` - ONE DFU MEMBER, ONE EXPORT

`IsRaining`, `IsStorming`, `IsSnowing` and `IsOvercast` are not a fifth
weather enum; they are whatever `SetWeather`'s switch
(`WeatherManager.cs:442-473`) has left set over `ClearAllWeather`'s
floor. Ambient Text is the first thing here to ask the sky for them,
and `scenes/worldModes.js` was already deriving two of them inline for
the Daedra-summoning day. So they are derived once, in
`world/weather.js`, from the calls each case makes:

| word | calls | flags |
|---|---|---|
| `sunny` | `ClearAllWeather` only | none |
| `cloudy` | `SetFog(Sunny)` | **none** - DFU's Cloudy case is a literal `// TODO make skybox cloudy` |
| `overcast` | `SetOvercast` | overcast |
| `fog` | `SetRainOvercast` + `SetFog(Heavy)` | overcast, and **not raining** |
| `rain` | `StartRaining` | raining, overcast |
| `thunder` | `StartStorming` | raining, storming, overcast |
| `snow` | `StartSnowing` | snowing, overcast |
| `sandstorm` | - | **the port's own** |

Two of those look wrong and are not. Cloudy weather tells a mod
"Clear", and fog tells it "Cloudy" rather than "Rainy", because
`SetRainOvercast` picks a rain *sky* while `IsRaining` is
`StartRaining`'s alone.

WEATHER2d's `sandstorm` is the port's eighth word and DFU's switch has
no case for it, so there is nothing to port. It is answered here, once,
as **overcast**: the sky in a sandstorm is not clear, and it is neither
rain nor snow.

## AT0 - settings, row, credit

The mod ships one settings section, `AmbientText`, and four
`SliderIntKey`s: `textChance` (0..100, 33), `interval` (60..600, 200),
`postTextInterval` (60..600, 500), `textDisplayTime` (1..10, 3). All
four are **real-time seconds**, not game time.
`MOD_SETTINGS['ambient-text']` restates them with the port's own
`Enabled` in front, and the test derives the restatement from the
vendored `modsettings.json` rather than checking it against typed
literals - bounds, defaults and the author's own descriptions.

`interval` keeps the mod's name for it and not the field's
(`stdInterval`), because the pane shows the player what the author
called it.

All four are on the tile as dials (`MOD_CURATED`): the mod is small
enough that curating any of them out would only hide something.

The row's effect line is "Takes effect at once. The mod then speaks on
its own clock." - accurate in both directions, per the clock note
above.

## AUDIT AT (2026-09-15, Mac: "Lets do a comprehensive audit on this")

The IL re-read against the port method by method, the host wiring
driven rather than grepped, a second mutation wave aimed at what the
first pass did not pin, and every claim in these records checked
against the tree. **Five findings, all paid.** Two of them were the
audit's own first pass being wrong, and those are recorded too.

### F-SING - the shipped mod was never driven, only spelled

**The one that mattered.** Every pin built its own component with
`createAmbientText`; what a player gets is the module-level singleton
behind `setAmbientTextHost` and `tickAmbientText`, and *nothing drove
it*. Two mutations proved the cost: `tickAmbientText = () => null` and
the singleton's `say` rewritten to a no-op **both left all 21 pins
green**. The mod could have been completely dead in the shipping build
and the gate would have called that fine.

The hosts were pinned by their SOURCE TEXT, which cannot tell a wired
seam from a spelled one. There is a pin now that claims the slot, ticks
the real singleton on the wall clock the shipped path uses, and asserts
a line the author wrote comes back out of the host's own `say` with the
mod's own `textDisplayTime` on it - and that the lines are `Crypt*`
when the host says it is in a crypt, so the singleton really is reading
the host's `where` and not a default. Five mutants against the shipped
path, five dead.

### F1 - the tail roll was spent underground, where the IL never rolls it

The dungeon arm (IL_002e..IL_005d) formats its key and jumps straight
to the `Contains` test at IL_013b. `Random.Range(0, 3)` is at IL_00ad,
**inside the ELSE branch**. The port rolled it either way.

Invisible under `Math.random`, and still the wrong number of draws from
the same stream - which is exactly what a seeded replay counts, and
this repo seeds things. Pinned by the roll QUEUE, which throws when
something rolls more than it planned: one roll underground, two above.

### F5 - a quiet frame rebuilt the world to learn a boolean

`IsPlayerInsideBuilding` was a field of `where()`, so every quiet frame
of the shipping host paid for a location-rect test, a `CLIMATE.PAK`
lookup, the weather word, the hour and six object allocations **to read
one bool**. Measured: 100 quiet frames were 100 context builds.

DFU reads `pee.IsPlayerInsideBuilding` (IL_0028) and asks `PlayerGPS`
nothing until `SelectAmbientText`. The seam is split to match - the
host slot carries `insideBuilding()` as its own cheap reader off the
mode, and `where()` is called only where a key is built. Pinned by
COUNT from both sides: 100 flag reads and 0 context builds over 100
quiet frames, and exactly one build on the tick that speaks.

### F6 - the port's own switch was gating `Start`

`Start` is a lifecycle call. DFU has no `Enabled` switch at all - a mod
that is off was never loaded - so `Start` runs the moment the component
exists, and the port's analogue of "the component exists" is "a host
has claimed it".

With the switch above that line, a game booted with the mod **off**
armed no clock, so turning it on started one from that moment and the
first line came a whole interval later; a game booted with it **on**,
toggled off and back, spoke at once. One switch, two behaviours,
decided by history - and the Features row's "Takes effect at once" was
true in only one of them. The switch now sits below `Start`, and the
row's promise is true both ways round.

### F3 - `weatherFlags` had one reader, and the record said it had two

AT1 wrote `weatherFlags` (`world/weather.js`) as the ONE derivation of
`WeatherManager`'s four public booleans from `SetWeather`'s switch, and
the Ledger row and the PR said the Daedra-summoning arm's inline pair
had been folded into it.

**It had not.** `worldModes.js` kept spelling
`{ raining: sky === rain, storming: sky === thunder }` off the weather
enum, so the tree carried two readings of one DFU member (ONE DFU
MEMBER, ONE EXPORT) while the record claimed it carried one. The arm
reads `weatherFlags(currentWeather())` now, and the pin is generative:
any module outside `world/weather.js` that builds an object with those
key names off a weather word is deriving them a second time, wherever
it lives - and the one home must have at least two readers, because an
extraction only pays once something else reads it.

### Two the audit got wrong, recorded so nobody re-hunts them

- **The Testing.md suite count was NOT drifted.** The audit read the
  runner's `# tests 7726` against the doc's 7712 and called it wrong.
  The doc's number is the `^test\(` count, which `test/manifest.test.js`
  already gates exactly - 7712 was right, and the gate had been holding
  it all along. The runner's larger number counts something else.
- **The first "banking gone" mutant was equivalent.** Swapping the
  `insideBuilding` guard with the interval guard changes nothing,
  because the clock WRITE is below both. The real mutation moves the
  guard below the write, and that one dies.

### Equivalent mutants, recorded rather than re-chased

- `hasAmbientText` by `texts[key] !== undefined` instead of
  `hasOwnProperty`. No key law produces an inherited property name -
  every key ends in its index digit - so the two cannot disagree on any
  reachable key. `hasOwnProperty` stays as the defensive spelling.
- Swapping `say(...)` with the `postTextInterval` arm. Neither reads
  the other.

### Clean, checked

- **`Dice100.SuccessRoll`** is `Random.Range(0, 100) < chanceSuccess`
  (`Dice100.cs:17`); the port's `dice100` is
  `Math.floor(roll01 * 100) < chance`. Exact.
- **The 918-line table reaches the built bundle** - `dist/` carries
  `NoneDesert0` and its line.
- **`!isNight(minuteNow())`** is `hour >= DawnHour && hour < DuskHour`,
  which is `gameDate.js`'s `isDayFromMinutes` to the letter. Two ports
  of `DaggerfallDateTime.IsDay` exist in the tree, both correct; this
  one is the spelling all three exterior hosts already use for the same
  question, so it is what AT reads. Not a defect of this arc.
- **The registry's "seven of the fifteen"** counts right: seven vendor
  READMEs carry the placeholder, fifteen folders exist.

## What is NOT carried, recorded

- The compiled `AmbientText.dll` and the AssetBundle it came in.
- `Debug.Log` / `Debug.LogFormat` - the mod logs each line it says and
  its entry count at load.
- The `Instance` static and DFU's mod-init handshake (`Init`,
  `mod.IsReady`, the `LoadSettingsCallback`): the port has no mod
  loader, and the settings are re-read live at every tick instead,
  which is strictly more responsive and observably the same.
- The `.ctor`'s four bench values, per above.

## Open

- **The permission line** in `vendor/ambient-text/README.md` is the
  placeholder, and the registry row says `RECORD OPEN`. Regnier's
  contact per the manifest is `forums.dfworkshop.net`.
