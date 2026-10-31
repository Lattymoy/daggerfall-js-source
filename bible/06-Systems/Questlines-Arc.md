# Questlines

The questlines layer gives Daggerfall's quests objectives, branching choices, outcomes and better rewards, and adds
fifteen questlines that lead the player to the newer content: Oblivion gates, Abyss Dungeons, the sea, the Sky Ketch,
the crafts. The player meets it in the pause window's Quests tab (and L on Enhanced Plus): what to do, the choices
made, how a quest ended, and rewards waiting to be taken. It is the `questlines` feature row: forced on online, the
player's choice offline, on by default.

## How it works

### A layer over DFU's machine

There is one quest engine, DFU's. The layer reads the machine's state and never changes how the machine runs. New
quests, including every questline step, are written in the machine's own script
(`src/systems/questlines/quests/`). So sharing, instances, the save, guidance, map marks and translated text work for
them unchanged.

The switch is read when a quest starts and stamped on it for life (`ql: 1`), so a quest finishes under the law it began
with, a restart included.

### Objectives and outcomes

Each quest a player can be given has an objective sheet: JSON per quest family in
`src/systems/questlines/sheets/`, read by `src/systems/questlines/qlSheets.js`. An objective is the port's line bound
to state the machine holds (`qlLaw.js` `BINDING_KINDS`: a task set, an item carried, a clock, a journal step, a global,
a foe dead, an act, a choice, and `all`/`any`/`not`). It shows only once that state opens it. What was shown once stays
shown (the latches in `qlLaw.js`). Each outcome names its pay profile. Sheet text is keyed for translation
(`QL.<QUEST>.o.<id>` and the like).

### Branches

A branch is a choice the machine keeps as a task: a choice in talk, a `prompt`, or an act (a quarry spared or slain, an
item returned or kept). The flagship quests have hand-written branches, added as patches over the vendored scripts
(`src/systems/questlines/qlPatches.js`, `patches/`); a patch adds messages and never replaces Daggerfall's. Nothing
branches on a deadline. In a shared quest a choice in talk is the sharer's; an act is whoever does it.

### The questlines

`QL_LINES` (`src/systems/questlines/qlLines.js`) holds fifteen lines as data: steps, giver, tier and when each opens (a
level, another line finished, online, a live event). The endgame lines (the Dagon cycle's three, the Hour That Was
Not, the Old Coil, the Sky Ketch, the Thirteenth of Frostfall) open online for a registered account; the short intro
lines open by level. The runner (`qlLineRunner.js`) offers a line whose gate holds; the player takes it, and its first
step's letter is in hand at once. Later steps start `STEP_GAP_S` after the step before, by courier where the script
sends one, and only when no other letter is on its way. A failed step is offered again after `RETRY_GAP_S`. The guilds'
rank ladders are in `qlLadders.js`.

### Rewards

A quest's tier comes from what it asks (`questTierOf`): its guild rank, its reputation band, or the player's level.
`src/systems/questlines/qlRewards.js` pays by the outcome:

- **Gold**: DFU's formula times the outcome's profile (`PAY_PROFILES`: standard, lesser, greater, double, betrayal,
  own, none).
- **Gear, chosen**: `REWARD_CHOICES` pieces (a weapon, armour, a jewel) at the tier's floor (`TIER_FLOORS`, Magic to
  Rare, never Legendary), fitted to the player and seeded by the quest so a reload never rerolls. They wait in the
  Quests tab, at most `OFFERS_MAX`, until one is taken. A questline's last step may name one of its cards.
- **Standing**: each faction the sheet names, flat, and legal standing. Online a failure costs no standing.
- **The service's pay**: titles and a Weir Key for the lines in `QL_SERVICE_LINES` (`src/net/questlineClaims.js`), paid
  by `server-account/src/questlines.js` `claimQl` only against steps it saw open and end.

### The window

The Quests tab (`src/ui/enhanced/enhancedMenu.js`) is the one place; `src/ui/questlines/qlJournal.js` draws the
questline parts for it and for the Chronicle. Rewards waiting head the rail while any wait. The classic skin keeps DFU's logbook verbatim.

## Rules

- One switch, locked on online; the player's choice offline, on by default (the owner).
- Systemic and curated: objectives and rewards for every quest, hand-written branches for the flagship set (the owner).
- No new currency: rewards use what the game has; the Wallet keeps its five (the owner).
- The Hour is an echo of a Break to come; no questline names the year or which ending comes (the owner).
- One place to read them: the Quests tab, not a new pause tab (the owner).
- A questline is taken, never sent (the owner).
- Daggerfall's words stay; the port adds lines and never rewrites a script's message.
- The service pays only what it witnessed (`bible/06-Systems/Integrity-Arc.md`).
- Questlines introduce, never gate: every endgame place stays open without them.
- The hosts do not grow: the layer is `src/systems/questlines/`, wired by one seam (HOST-SPLIT).

## Daggerfall Unity

DFU's quest machine and its scripts are unchanged; the layer reads them. Departures: objectives that DFU's journal does
not have (the Quest Guide's "journal entries only" rule changed in letter, not reason: an objective shows only state the
machine holds); flat standing per named faction instead of DFU's repute spread to allies and rivals; a questline offered
and taken, as DFU's `DaggerfallQuestOfferWindow` offers work, never sent unasked.

## Code and tests

- `src/systems/questlines/qlLayer.js` - the layer the hosts wire, the offers
- `src/systems/questlines/qlLaw.js` - bindings, latches, tiers
- `src/systems/questlines/qlSheets.js`, `sheets/` - objective sheets
- `src/systems/questlines/qlPatches.js`, `patches/` - flagship branches
- `src/systems/questlines/qlLines.js`, `qlLineRunner.js`, `quests/` - the fifteen lines
- `src/systems/questlines/qlRewards.js` - pay
- `src/net/questlineClaims.js`, `server-account/src/questlines.js` - the service's pay
- `src/ui/questlines/qlJournal.js` - the window's questline parts
- `test/systems/questlines/ql1_sheets.test.js` - every givable quest has a sheet or a reason
- `test/systems/questlines/ql4_branches.test.js` - branches
- `test/systems/questlines/ql3_rewards.test.js` - rewards
- `test/systems/questlines/qloffered.test.js` - a line is offered and taken
- `test/systems/questlines/qlvoice.test.js` - sheet text in the game's voice

## Open

- The online calendar runs on wall time; the Hour's premise (a Break still to come) holds only until it reaches 3E 417.
  The owner's to settle.
