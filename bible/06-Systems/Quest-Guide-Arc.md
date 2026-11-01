# Quest Guide

The quest guide is a layer over Daggerfall's quest machine that makes quests easier to follow on the enhanced skin:
"Show on map" from a journal entry, notices when a quest begins, changes or ends, a HUD card that tracks a quest, marks
on the map and compass, and guidance tiers. The machine itself stays DFU's (`bible/06-Systems/Quest-Arc.md`), and the
classic skin's logbook is DFU's byte for byte.

## How it works

### The lens

`src/ui/quest/questLens.js` is one read-only picture of the player's quests, made once by the quest bridge
(`src/scenes/quest/questBridge.js` `createQuestBridge`, `bridge.lens`) and reset on load, so a loaded game's quests are
a baseline, not news. `lens.look({ canFindPlace, currentLocationName })` returns each quest's title, whether it is
main, the deadline its own entries name, its newest entry and the place it points to, plus the events since the last
look. `questBridge.questLog()` walks the machine; `src/ui/quest/questRail.js` decides which entries and in what order.
Every face reads the lens and nothing else.

### The faces

- **The way there.** The enhanced journal (the pause window's Quests tab and the Chronicle) offers DFU's logbook
  click: on an entry whose target can be found, "Show on map" opens the map on the place through the host's
  `gotoPlace`.
- **The herald** (`src/ui/quest/questHerald.js`, row `quest-herald`). The lens's events as enhanced notices: New
  quest, Journal updated, Quest completed or ended, Under a day left. They are `aria-live` and silent.
- **The tracker** (`src/ui/quest/questTracker.js`, row `quest-tracker`). A HUD card with the tracked quest (else the
  last changed): its title, newest entry, where it points and time left. Track toggles in both journal faces; the
  tracked quest is kept per character.
- **The marks** (`src/ui/quest/questMarks.js`, row `quest-marks`). Every active quest's place on the held map, the
  followed one filled, and the tracked quest's place on the enhanced compass, only for a place the player can find.
- **Guidance tiers** (row `quest-guidance`): Journal (the default: only what the entry says), Town (the building the
  entry names, ringed on the town map and compass) and Exact (a marker inside a dungeon). See
  `bible/03-World/Delve-Arc.md`.

## Rules

- The machine never knows: no face writes quest state, and a game with the faces and one without are the same game.
- Nothing the journal has not said: a face shows an entry's words and the place DFU's logbook would travel to. A
  marker inside a dungeon is the opt-in Exact tier. The questlines layer's objectives are a named departure from this,
  bound to state the machine holds (the owner; `bible/06-Systems/Questlines-Arc.md`).
- One walk: the bridge walks the machine and makes the one lens; a face never walks or builds its own.
- The classic skin is DFU's: every face asks `isEnhanced()`.
- Accessible by construction: DOM on the enhanced skin, text that scales, `aria-live` news, never colour alone,
  reduced motion honoured, keyboard and pad reach every control.
- A deadline is one the journal names: the HUD counts down only a clock a logged entry names (`=clock_`).
- The herald, the tracker and the marks are on by default and each is a Features row; the Exact tier is allowed and
  off by default; read-aloud is opt-in (Mac, through the arc's decisions).

## Daggerfall Unity

"Show on map" is DFU's own `DaggerfallQuestJournalWindow` click (`HandleQuestClicks`), brought to the enhanced skin.
The herald, tracker, marks and tiers are the port's own; DFU's quest debugger draws the markers the Exact tier uses.

## Code and tests

- `src/ui/quest/questLens.js` - the lens
- `src/ui/quest/questRail.js` - entry order and titles
- `src/ui/quest/questHerald.js`, `questTracker.js`, `questMarks.js` - the faces
- `src/scenes/quest/questBridge.js` - the bridge that makes the lens
- `src/ui/quest/questJournal.js` - the classic logbook, DFU's
- `test/ui/quest/guide1_questLens.test.js` - the lens
- `test/ui/quest/guide3_herald.test.js`, `test/ui/quest/guide4_tracker.test.js`, `test/ui/quest/guide5_marks.test.js` - the
  faces
- `test/ui/quest/audit_guide.test.js` - named deadlines and the machine untouched

## Open

- Not built: the accessible journal (filters, sort, search, dates, keyboard pass), the accessibility shelf (quest text
  size, high contrast, read-aloud), and DFU's quest debugger behind `GUI/EnableQuestDebugger`.
