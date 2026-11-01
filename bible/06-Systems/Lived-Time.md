# Lived Time

Online, the shared world's clock belongs to everyone and nobody may move it, yet a rest, a journey, training or a
prison sentence must still spend time. Lived time gives each character a clock of their own beside the world's: it
runs with the world while the character is in it, runs ahead when they spend time the world does not wait for, and
stands while they are away or dead. Offline the two are one clock, as in DFU. The player meets it in every wait:
rented rooms, loans, repairs, training cooldowns, infections, and the rest window's "you rest on your own clock".

## How it works

**The clocks online** (`src/systems/worldTick.js`):
- **The event clock** (`worldMinutes`): the relay's shared clock, a day every two real hours. Prices, shelves, gates,
  raids, respawns and every shared stamp read it.
- **The sky** (`skyMinutes`, `src/net/skyLaw.js`): the hour, date, moons and seasons a player sees, a day every real
  hour. Nothing walks or stamps the sky; it is read for "now". The full design of the two shared clocks is on
  `06-Systems/Online-Time-Arc.md`.
- **The character's clock** (`ownMinutes`): one number per character, saved as `classicMinutes`.

**Which clock a law reads.** The sun, moons, calendar, seasons, weather, the vampire's day and night, the werewolf's
moon, spawn tables, prices, shops and everything players share read the world's clocks. The body and its contracts read
the character's: magic rounds (spell durations, diseases, poisons, infections, the vampire's thirst, the werewolf's
urge), the needs, conjured items, the enemy alert's decay, the six-hour skill check, training's twelve-hour cooldown, a
guild's rank wait, guild letters, rented rooms, loans and repairs, reputation drift, the racial quests, and the
wandering-spawn cadence. Quest countdowns follow the rule on `06-Systems/Quest-Arc.md`.

**What moves the character's clock** is everything DFU calls RaiseTime: a rest or loiter, a fast travel's days, a
guild's training, a quest's TrainPc, a prison sentence, the vampire's turn, a tavern meal or blackout night, the
exhaustion collapse, a cure's minute. An accelerated journey online (Travel Options, the Overworld, the helm) raises the
character's minutes past the world's, as offline. The next tick walks the raised span on the character's clock exactly
as the offline tick walks a raised clock. No online checkpoint is written until a raise is walked.

**Away and dead.** While away, the character's clock stands and nothing ages. On return, the absence walks none of the
world's arms, except that a reputation below zero recovers one point a week of the world's time, measured on the
relay's clock. A break longer than a world day comes back fed, watered and rested. While dead, the clock stands under
the death screen; the world's day block and calendar arms still walk the span, but the character's own calendar does
not.

**The vampire and the sun.** The sun is everyone's. A rest moves the character's clock, not the sky, so a bare-headed
vampire still cannot set out by day; the refusal says when night falls in real minutes (`worldNightfallText`). A raised
hood lets them travel by day.

**Party.** Each member's clock is their own. A party rest mirrors the leader's night, each member spending their own
hours. A buff a partner casts runs on the target's clock.

**What a rest can buy.** Only the character's own waits (an infection's turn, a demotion's 28 days, training's
cooldown, a repair, a letter, reputation drift), each with its costs: effects run out, needs build, rooms and loans run.
Nothing the world owns (stock, prices, respawns, events, a sworn revenant's errand) reads the character's clock.

**On screen.** Time left is said in the character's days and the most real play it can take: "in 3 days of your time
(6h of play)" (`ownTimeLeftText`, `ownTimeLeftShort`).

**The save.** `classicMinutes` is the character's clock; online a save also writes `worldMinutes`, the world's minute it
left at. Copying a character to offline rebases the world's stamps onto the character's clock
(`src/systems/offlineCopy.js` `offlineCopyOf`); bringing one online moves them back and joins fresh, so the first join
pays no absence (`onlineCopyOf`). A tampered clock is refused (`saneSaveClock`).

## Rules

- **A real system for time online, not a band-aid** (Mac): two clocks, the rule above for which a law reads.
- **Absence recovers only reputation** (Mac, "Recovery only").
- **The clock does not punish absence**: nothing ages while the player is away.
- **The character's clock opens no faucet the world pays for.**
- No relay change: servers keep the save opaque.

## Daggerfall Unity

DFU has one clock and the player owns it; every "time passes" moves it (`DaggerfallDateTime.RaiseTime`). Offline the
character's clock is that one clock, byte for byte. Online the world's clock cannot move, so the character's clock takes
every RaiseTime instead.

## Code and tests

- `src/systems/worldTick.js` - `ownMinutes`, `advanceOwnMinutes`, `worldMinutes`, `skyMinutes`, the tick's windows, the
  absence and death walks, the time-left words
- `src/net/skyLaw.js` - the sky's rate
- `src/systems/offlineCopy.js` - the two doors between offline and online
- `src/systems/online/onlineCheckpoint.js` - no checkpoint while a raise waits
- `test/systems/lived1.test.js`, `test/systems/auditlived1.test.js`, `test/systems/auditlived1b.test.js`

## Open

- A rest cooldown (a cap on how fast resting spends the character's clock) is available if play shows it is needed
  (Mac's call).
