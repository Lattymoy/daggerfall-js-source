# Online Waits

Online, the sky and the event clock run on wall time and no rest moves them, so some of Daggerfall's waits become
real-time lockouts. This page lists the long waits online and the four that are shortened. Players meet it as service
buildings open around the clock, a quest messenger who arrives soon, a summoner who calls the prince they name, and a
banishment that lasts the thirty days the calendar shows. Offline nothing changes. The clocks are described in
`bible/06-Systems/Online-Time-Arc.md`.

## How it works

Anything on the character's own clock can be spent with a night, a loiter or a journey. What stays long is what sits on
a clock nobody moves: the sky, the event clock, real time, a UTC day, or time played.

### What is shortened online

- **Service hours.** The bank, the library and the palace keep the shared world's hours, as shops and guild halls do
  (`src/systems/buildingLocks.js` `onlineReliefBuilding`). The door, the hover's closed line and the people inside all
  follow, so the clerk, scholar and court stand where DFU would be shut. Houses, temples and taverns are unchanged.
- **An awaited wave.** A quest wave whose foe's kill the quest waits on (it offers or settles the quest) is read by
  `src/systems/quest/clock.js` `waveIsAwaited`. Online its first arrival lands within the short wait
  (`ONLINE_DELAY_SECONDS`, 24 of the character's minutes); later waves keep the script's interval. A wave that only
  harasses keeps DFU's pacing.
- **Summoning by name.** Online a temple's or the Mages Guild's summoner lists the sixteen princes by name
  (`src/systems/daedraSummoning.js` `summonsByName`, `PRINCES_BY_NAME`, `summonByNameBoxes`) and then asks DFU's own
  question for the one picked (`summonQuestionRows`). The summoning itself is DFU's: price, chance, Sheogorath and the
  quest. Gold is taken only once the prince's quest is made. A witches' coven keeps its one prince a day.
- **Banishment.** A banishment lasts thirty days of the calendar the player sees (the sky), stamped on the event clock
  (`src/systems/standing.js` `banishmentEnd`, `banishmentDaysLeft`; `src/systems/skyCalendar.js`).

### What stays long

| Wait | Why it stays |
|---|---|
| A guild's rank (28 days) | on the character's clock; a night or a loiter spends it |
| Holidays | the calendar runs with the sky; bonuses, not gates |
| The full moon | the change holds while the moon is up |
| The Sea Serpent and Oblivion gates | their cadence is in the relay's bundle; a change is a relay deploy |
| Dungeon respawn | real time, by the dungeon's kind (`src/systems/dungeon/dungeonRespawn.js`) |
| The Sigil Broker, Motherlodes, profession nodes, Seats | each economy's own pace, on its own page |
| `daily from` windows, night-only targets, letters by daylight | schedules, not waits |

## Rules

- Offline is DFU exactly: one clock, its hours, waves, summoning days and terms.
- A schedule nobody can rest through is a real-time lockout; online a service keeps the shared world's hours (Mac).
- Banishment: timed or pardoned; thirty days of the calendar the player sees (Mac).
- Dungeon respawn is half an hour where `RESPAWN_MS` rules (Mac).

## Daggerfall Unity

DFU's building hours (`BuildingOpenHours`), `CreateFoe` intervals and the summoning day
(`DaggerfallGuildServicePopupWindow`, one prince per day of the year) are unchanged offline. Online departures: the
three service buildings never close; an awaited wave's first arrival is drawn within the short wait; the summoner
calls any prince by name; banishment counts sky days.

## Code and tests

- `src/systems/buildingLocks.js` - online service hours
- `src/systems/quest/clock.js` `waveIsAwaited` - awaited waves
- `src/systems/daedraSummoning.js` - summoning by name
- `src/systems/standing.js` - banishment's term
- `test/systems/ol6_service_hours.test.js` - the three buildings online, with DFU's own rows
- `test/systems/quest/wavewait_quests.test.js` - the real scripts, parsed and ticked
- `test/systems/summonname_online.test.js` - summoning by name
- `test/systems/banishsky_standing.test.js` - banishment on the sky

## Open

- Loiter moves the character's own clock, so loiter-and-night presses pass a rank's 28 days in minutes. Left until
  play reports the rank wait; if it should be shorter, shorten the gate itself online.
- The serpent's and the gate's cadences wait for a relay deploy made for its own reason.
