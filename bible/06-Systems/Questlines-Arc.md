# QUESTLINES (QL0, designed 2026-10-19)

The owner, 2026-10-19: "So I want to talk about overhauling the questing system and departing from DFU. I was talking
with my developers, and we would love to modernize the questing system to be more in line with the mainline games.
1. Quest enhancements introducing multiple objectives that branch to a conclusion. A proper overhaul to every quest in
the game. 2. New questlines tying into and introduced the oblivion gates, abyss dungeons, elite dungeons and elite
breaches. Staying true to Daggerfall's lore 3. Overhauling quest rewards to be more meaningful with gear, currencies,
etc 4. Tying all our newly integrated features into quests ... This would be toggled for online and not be able to be
changed. 5. One unified place to view questlines".

Asked four things, the owner answered:

| Asked | The owner's answer |
|---|---|
| Online the overhaul is forced on and locked. Offline? | "Player's choice, on" - the house pattern: a Features row the lane forces online, the player's own switch offline, on by default |
| How deep on DFU's quests? | "Systemic + curated" - objectives and new rewards for every quest; hand-written branches for the flagship set (section 3) |
| A new currency, or the existing ones? | "Reuse existing" - no sixth Wallet currency |
| The online world is about 3E 406; the Abyss Dungeon's Hour reads the Warp in the West (3E 417) as past. How does a questline settle it? | "An echo of a Break to come" (decision 5) |

Then, the same day: "Dude. Develop this all. I dont want a design doc. I want everything built to perfection." The five
calls section 10 left open were taken at the record's own defaults (section 10 says each).

**Status: QL1-QL16 BUILT 2026-10-19** (pull request #1047). Section 0 is the game as the design read it; sections 1-10
are what was built, and where the build departs from the design it says so in place ("AS BUILT").

**AUDIT QUESTLINES (2026-10-19, the owner: "Audit everything built. Ensure perfection")** - eight cold lanes on the frozen
branch (fe033c256), then six fixers and the author in the live tree: 151 findings, each fixed, decided or left and said,
and pinned (`01-Overview/audits/Audit-Questlines.md`). Sections 1-10 are the overhaul as it now stands; where the audit
changed a law or a claim, the change is marked AUDIT QUESTLINES with its finding.

**QL-OFFERED (2026-10-25; Lord Rumpkin, "too many quests"; the owner: "No band aids", and A QUESTLINE IS TAKEN, NEVER
SENT)** - a line is begun only when the player takes it: on a town's notice board, at its giver's door through DFU's own
offer, or on the Quests tab, its first letter in hand at the take; the later steps of a line taken still come; the quest
log draws a running step under its line alone and no line that cannot be taken. Section 4's THE RUNNER says the departure
from QL0 and DFU's rule; section 6 the window.

## 0. What stands, read against the code (2026-10-19)

- **One machine, DFU's, whole.** `systems/quest/machine.js` (`QuestMachine`), `parser.js`, `quest.js`, `task.js`,
  `actions.js` are DFU's QuestMachine ported: `defaultActionTemplates()` registers DFU's 82 templates in C# order,
  pinned slot for slot by `test/systems/quest/auditquests_linkage.test.js` (AUDIT QUESTS 1), and no DFU action is left
  unported (QG1, RR3). Jagget's four Quest Actions Extension actions ride beside them
  (`questActionsExtension.js`, FORAGE1) - the precedent for a quest action that is not DFU's.
- **The scripts are vendored verbatim.** 265 DFU scripts (`vendor/dfu-quests/Quests`, DFU's MIT text at a pinned commit,
  route (a), 2026-08-20) and 29 mod quests (Roleplay & Realism 3, Warm Ashes 4, Foraging 22), all read by one loader
  (`scenes/quest/questData.js` `loadQuestPack`). A change to a script is a PATCH applied as the pack is read, never an
  edit of the file: `questPatches.js` `applyTextPatches` takes an exact old text and how many times it must occur, and
  throws on any other count (SHAM-TRAIL, FORAGE-FIX). The corpus gate parses all 265 (`quest.test.js`).
- **A quest speaks in journal entries, not objectives** (PX4; `Quest-Guide-Arc.md`: "do not invent checkbox objectives
  for DFU quests"). There is no objective model and no branch model. A script branches two ways today: `pick one of`
  (a random draw - `sharedPickRoll` keeps a party's copies alike) and `prompt` (a yes or no the player answers). 37 of
  the 187 listed quests ask a `prompt`; 90 do one or the other.
- **Who offers what.** Guild questors and social NPCs draw from `questLists.js` `QuestListsManager` over
  `QuestList-Classic.txt` (187 live rows: Nobility 28, Holy Orders 24, Fighters Guild 20, Commoners 20, Mages Guild 18,
  Knightly Orders 17, Thieves Guild 15, Dark Brotherhood 13, Merchants 12, Witches 10, Vampires 10) and the mods'
  lists. The main quest (34 `S0000*` scripts and `_BRISIEN`) is in no list. The sixteen Princes' summonings are
  `daedraSummoning.js` (Mehrunes Dagon's is `Y0C00Y00`, day 320, 20 Sun's Dusk). The two cures (`$CUREVAM`,
  `$CUREWER`) and `CUSTOM01` complete the playable set; the 21 `__DEMO*` scripts and `_TUTOR__` (retired by TUT1) are
  not offered, and the list itself disables `K0C00Y06` and drops `R0C11Y27` as a duplicate.
- **Rewards.** Gold is DFU's formula (`quest/item.js` `_createGold`: level or rank, the region's price, the faction's
  power), paid by `GivePc` into the reward pile (RW1). A quest's end moves reputation +5 / -2 (`questRepute.js`).
  Online: a failure costs nothing (QFAIL-FREE), a guild's reputation is the service's Roll and a quest's gain a
  bounded claim of 15 a guild faction a character a UTC day (`Chapters-Arc.md` 3.3), Renown XP is
  `renownQuestXp` (`net/renown.js`), and a shared quest's gold is split (`shareQuestGold`). Quest gold is written by
  the client and bounded by the wealth budget (`Integrity-Arc.md`); the judge counts a quest item as worthless
  (`server-account/src/judge.js` `worthless`).
- **Online quest law already in force.** QFAIL-FREE, REPUTE-GATE (`onlineRepute.js`), GUARD-ONLINE (`onlineGuard.js`),
  TIME3 and TIMEFREE (online a deadline never lapses and a delay lands in about two real minutes), KVAR-HOLD,
  NEARBY-QUESTS, and the main quest refused for sharing (`canReceiveSharedQuest`, reason `mainQuest`).
- **Party.** QUEST1 gives each member a copy (`questShare.js`, the relay's `quest` frame, opaque to the relay), kept in
  step by resync; QUEST-PARTY makes a shared quest's foes the party's, KEPT-KILL carries a kill to every copy, and
  INSTANCES gives the party its own quest dungeon.
- **Where quests are read.** One walk (GUIDE1): `questBridge.questLog()` -> `ui/quest/questRail.js` -> `questLens.js`.
  The streaming host widens the log with bounties, revenant hunts and Legacy's death quests
  (`scenes/world.js:"questBridge.questLog = (o) => {"`). Three windows show it: DFU's logbook on the classic skin
  (`ui/quest/questJournal.js`, verbatim), the pause window's Quests tab (`enhancedMenu.js` `pauseQuests`), and the
  Chronicle on L (`enhancedChronicle.js`). The Quest Guide's herald, tracker, map marks and guidance tiers read the
  same walk.
- **The endgame, and its witnesses.** Dagon's Breach (`11-Multiplayer/World-Bosses.md`), the Sigil Broker
  (`Sigil-Sets.md`), Elite Dungeons (`world/spawnedDungeons.js` ELITE_CHANCE, `systems/eliteFoes.js`), the Elite
  Breach (`Elite-Gates.md`), the Abyss Dungeon (`Super-Dungeons.md`) and the Sea Serpent (`Sea-Serpent.md`) are
  online only. The relay referees each and the account service holds signed receipts of what was done there: `r1`
  (a breach closed, the rite broken), `h1` (an Hour broken), `e1` (a Redoubt taken), `l1` (a serpent slain). What
  story they carry: Ysolde Marnhel's *On the Burning Doors* (`portBooks.js`, delivered with a player's first ember),
  the thirty Annals of 3E 398 (kept out of the journal by design), the Abyss's tavern rumours (`sdOmen.js`), and
  the breach's chat and Discord lines. No quest leads to any of them.
- **The online lane.** `systems/online/onlineLane.js` forces a Features row's value online
  (`features.js` rows' `online: true`, read by `declareOnlinePrefs`), and `enhancedMenu.js` `lockOnline` shows the row
  shut - "On (online)", with the note that the player's own choice comes back offline. A new switch fails
  `test/systems/onlinelane.test.js` (OL1) until it answers the online question. A service feature is opened by a
  switch in `server-account/wrangler.toml` (`off` | `dev` | `on`, as `CHAPTERS_OPEN`).
- **The calendar.** The online clock began at 3E 405 (`net/wire.js` ONLINE_EPOCH) and runs about a game year a real
  month. `Super-Dungeons.md` section 7 tells the Hour from after the Warp of 3E 417; no string a player reads says
  3E 417 (the phase is named "The Dragon Break", `sdRemnant.js` SD_PHASE_NAMES).

## 1. The decisions (QL0)

Taken at the design. Each is the owner's to overrule; 1, 3, 4 and 5 are the owner's answers.

1. **ONE SWITCH, LOCKED ON ONLINE** (the owner). A Features row, `questlines` ("Questlines"), on the prefs shelf,
   `initial: true, online: true`: online the lane forces it on and the Settings row shows it shut; offline it is the
   player's, on by default. The switch is read when a quest STARTS, and the quest is stamped with it for life
   (`ql: 1` in its save), as `oblivionLeveling.js` decides a law at birth and never on load. So a quest under way at the
   deploy finishes as it began, a player who turns the switch off offline strands nothing, and a quest shared to a mate
   keeps its sharer's stamp - its tier is its holder's (section 5.1). A restart keeps the stamp too (AUDIT QUESTLINES
   BRANCH-14: a stamped quest restarted with the switch off was read and started as DFU's, its `ql act` deaf for good).
   Endgame questlines are online only because their places are: offline they are never drawn (a page with nothing to
   show is never drawn - `10-UI/UI-Calm.md`; AUDIT QUESTLINES UI-14: they were - offline a line that can only begin
   online is left out of the window now, and one already begun shows "Continues online.").
2. **ONE MACHINE, A LAYER OVER IT.** No second quest engine. The machine stays DFU's and never learns of the layer
   (GUIDE1's law, "the quest machine never knows about the UI", kept). Objectives, branches and outcomes are a layer
   that READS the machine (section 2). New quests - every questline of section 4 - are written in the machine's own
   script, with QL's few actions registered as the extension's four are. So sharing, instances, the save, KEPT-KILL,
   guidance, map marks and the translated `-LOC` text work for them unchanged; a second engine would have to grow
   every one of those again (THE ONE CONSTRUCTION SEAM).
3. **EVERY QUEST GETS OBJECTIVES AND THE NEW REWARDS; 66 GET BRANCHES** (the owner: "Systemic + curated").
   - **Every quest a player can be given** gets an objective sheet and the outcome rewards: the 187 listed quests, the
     main quest's 34 scripts and `_BRISIEN`, the sixteen summonings, the two cures, `CUSTOM01` and the 29 mod quests -
     270. A test holds the sheet set to exactly the set the offer paths, the main quest and the summonings can reach.
     AS BUILT: **248**. Counting what a player can actually be GIVEN took 22 of the 29 mod quests out: Foraging's 18
     tool bonuses are rolls with no journal entry that no one gives, and Warm Ashes' four are the sea's own events, run
     by the world. 187 listed + `CUSTOM01` + 16 summonings + 2 cures + 35 main quest + Roleplay & Realism's 3 +
     Foraging's four FetchWood quests = 248, and `test/systems/questlines/ql1_sheets.test.js` names every quest the pack
     holds as given or as left out with its reason. The questlines' own 35 quests (section 4) have sheets of their own
     beside them.
   - **The flagship set gets hand-written branches.** Its rule, read off the list and the scripts so it cannot drift by
     taste: every listed quest that asks the player a `prompt` (37), every quest offered at rank 4 or above (20), and
     every one-time quest (22) - 66 once the overlaps are counted (section 3). The owner adds any quest by name.
   - **Daggerfall's words stay.** A sheet's lines and a branch's text are the port's own words (`t()` keys, drafted in
     the thirteen languages); the script's own messages are not rewritten. A branch adds messages through a patch;
     it never replaces one.
4. **NO NEW CURRENCY** (the owner). Rewards are drawn from what the game already has: gold, silver (the service's),
   Deadlands Embers, Weir Keys, Welkynd Shards, Renown XP, standing, set pieces, named gear, titles and auras, tavern
   cards. The Wallet keeps its five. AS BUILT: gold, a choice of gear, standing and legal standing (the client's), a
   named piece at a questline's end, and the service's titles (one a line) and one Weir Key (section 5).
5. **THE HOUR IS AN ECHO OF A BREAK TO COME** (the owner). The world is about 3E 406; the Warp in the West is 3E 417. A
   Dragon Break has no before and after - that is what makes it one - and the Hour is "the moment itself, kept outside
   time" (`Super-Dungeons.md` section 7). The Abyss questline reads it so: the Bay WILL break, the Hour is that moment
   reached early, and the Orrery's six stones are six futures. Nothing shipped changes, and no line says which ending
   comes - the main quest the player is still running stays theirs to end. AUDIT QUESTLINES LINES-9: the world is about
   3E 406 only now - the online calendar runs a game year a real month (`net/wire.js` sharedClassicMinutes: 3E 407 on
   2026-12-01, 3E 410 by March 2027, 3E 417 by October 2027) - so no questline's words count years or name the year it
   is ("since the Spire fell", "letters dated 3E 398"), and the Hour's premise, a Break still to come, holds only until
   the calendar reaches the Warp: the owner's to settle before then.
6. **AN OBJECTIVE TELLS THE TRUTH** (a departure from PX4, named). The Quest Guide's law is that a DFU quest speaks in
   journal entries and that a checkbox the script does not know is "a lying UI". QL keeps the reason and changes the
   letter. An objective is a line the port writes, BOUND to state the machine holds - a task set or cleared, a
   resource's placement, an item in the pack, a running clock, a global variable - and it shows only once that state
   opens it. A sheet that names state its script never reaches fails its test (section 2.5). The classic skin keeps
   DFU's logbook verbatim (THE NATIVE-WINDOW RULE); objectives are drawn on Enhanced Plus and DFO Grimoire. QL1 adds
   the Port-Ledger section A row.
7. **A BRANCH IS A TASK THE MACHINE KEEPS.** A branch is a choice the player makes - a choice in talk, a `prompt`, or
   an act (the quarry spared or slain, the item returned or kept, a rival's offer taken) - and it sets one task of two
   or more; each leads to an outcome. Nothing branches on a deadline, offline either: online a deadline never lapses
   (TIMEFREE), and a quest must read the same in both lanes. In a shared quest a choice in talk is the sharer's, and the
   copies take it on the resync (as `sharedPickRoll` keeps a draw alike); an act is whoever does it, carried as
   KEPT-KILL carries a kill. AUDIT QUESTLINES BRANCH-1: every copy was asked, and a member's answer decided the sharer's
   copy under the sharer's own box - a received copy kept in step with a party asks nothing now (section 10.2).
8. **THE OUTCOME PAYS; THE SERVICE PAYS ONLY WHAT IT WITNESSED.** Section 5. Gold and gear stay the client's, as every
   quest's are today, bounded by the wealth budget and the item law. Silver, embers, Weir Keys, titles and auras are
   the service's, paid only against a receipt the service already holds or a capped claim - never on a client's word
   that a quest was done ("nothing another player can see, take or be ranked against stands on a client's word",
   `Integrity-Arc.md`).
9. **QUESTLINES INTRODUCE; THEY NEVER GATE.** Every endgame place stays open as it is today. A questline leads a player
   to it and pays for going; a player who never takes the line loses nothing they have now.
10. **ONE PLACE TO READ THEM** (the owner's fifth). The pause window's Quests tab becomes the one place - not an eighth
    tab (`PAUSE_TABS` stays seven) - and L lands there on Enhanced Plus. Section 6.
11. **THE HOSTS DO NOT GROW.** The layer is `systems/questlines/`, its host seam one module the hosts wire, its window
    `ui/questlines/`, its service one module of `server-account/src/` (section 7).

## 2. The model

### 2.1 The words

One word, one thing (`11-Multiplayer/Guilds-Made-Plain.md`). Checked against the words the game already uses:

| Word | Means | Not |
|---|---|---|
| **Questline** | an ordered run of quests that tells one story, each opening the next | a "chapter" - the Chapters are Daggerfall's guilds online (`Chapters-Arc.md`) |
| **Quest** | one script on the machine, as today | |
| **Objective** | one thing a quest asks now, bound to the machine's state | a "task" - a task is the script's own and the player never sees one |
| **Branch** | a point where the player's choice sets which way a quest goes | a `pick one of`, which is a draw the player never sees |
| **Outcome** | how a quest ended, and what it paid | an "ending" - the Endings are the Abyss's six (`Super-Dungeons.md`) |

### 2.2 The objective sheet (AS BUILT)

One sheet a quest, data the port writes, filed by family as JSON (`src/systems/questlines/sheets/<family>.json`, the
fourteen families of `src/systems/questlines/qlFamilies.js` and the Questlines' own), read by
`src/systems/questlines/qlSheets.js`. JSON and not code: a sheet's lines are quest text - Daggerfall's kind of words,
read in a translation's words where a pack carries them (TextQuests `QL.<QUEST>.o.<id>` for an objective, `.r.<id>` an
outcome, `.b.<id>` a branch and `.b.<id>.<choice>` its choice, `qlLayer.js` sheetTextKey - the `-LOC` route a DFU quest's
own messages take; AUDIT QUESTLINES LAW-10: keyed by id alone, 21 keys in 19 sheets named two lines), never a string of
the port's interface. Written in the game's voice (`10-UI/Voice.md`): American spelling, and no dash aside in an
objective, a choice or an outcome - a second sentence, a comma or a colon (AUDIT QUESTLINES VOICE-QL, at the merge of
main: the sheets, the questline scripts, the patches' own messages and the questlines' t() words were written before
the voice page was; `test/systems/questlines/qlvoice.test.js` holds them to it). M0B00Y06 as filed:

```json
{"quest":"M0B00Y06","objectives":[
  {"id":"slay","text":"Kill the wild beast loose in _house_","done":{"task":"_mondead_"},"mark":"_house_"},
  {"id":"report","text":"Return to _qgiver_ for your pay","open":{"task":"_mondead_"},"done":{"task":"_S.02_"}}],
 "outcomes":[
  {"id":"done","text":"The beast is dead and the citizen's house is safe.","on":{"task":"_S.02_"},"pay":"standard"},
  {"id":"failed","text":"The Guild gave the job to someone else.","on":{"ended":true},"pay":"none","failure":true}]}
```

- **What a binding reads** (`open`, `done`, `fail`, an outcome's `on`; `src/systems/questlines/qlLaw.js` BINDING_KINDS):
  `started`, `ended`, `success`, a `task` set, an `item` carried, a `clock` running or `clockDone`, a journal `step`,
  a `global`, a `foeDead`, an `act` heard (QL11), a `choice` taken, and `all` / `any` / `not` over them. Each reads the
  machine's own state; nothing the layer keeps decides what a player sees but its LATCHES (below).
- **The latches** (`qlLaw.js` observe). What the machine showed once stays shown: an objective opened stays open, one
  done stays done though its script clears its task, a branch's first choice stands, the outcome settles once. A
  script that clears a task to re-arm it never takes back a line the player has read. A BINDING MENDED READS ITS LINE
  AGAIN, ONCE (FIELD BUGS 2026-10-25i HEART-TAKEN, AUDIT FB1025i B4): a slice that rebinds an objective a player may
  already hold latched names a mend on it (`reread`, an id the sheet law checks), and a state that has not taken that
  mend - an older save, a party copy from an older build - forgets that objective's latch at its first read (`qlLaw.js`
  observe; the journal reads it unlatched before then) and takes the mend (`qlState.js` `reread`), so the mended binding
  decides it; a fresh state takes every mend at its first read. Q0C4XY04, N0B00Y06, R0C20Y07 and S0000503 carry
  `fb1025i`: their lines had been struck on DFU's `clicked item`, which a look at a body's row fires.
- **The text** names resources with the script's own symbols (`_house_`, `__house_`, `=monster_`), read through the
  machine's macros quietly (`src/ui/quest/questLens.js` quietText), in the player's language where a pack has it.
- **Shape.** `optional`; `group`; `any` (alternatives, joined by "or"); `mark` (the place the objective is about - the
  window's; the HUD's marks keep the newest entry's target, section 6). A sheet's `tier` is the questlines' own. An
  outcome's `named` is `{ name, kind, base }` (section 5.2).
- **The success fallback.** A sheet's `success` names the outcome a success settles to when no row's binding holds as it
  ends - its `success`, else its `done`, never a guess (`qlLaw.js` fallbackOutcome; AUDIT QUESTLINES LAW-1: it was the
  first outcome that was no failure, and a loyal M0B11Y18 run - the letter to the Queen, her hunt run out - filed
  `betrayed`, the Queen -5). The law requires one wherever the quest can end a success no row is sure to hold, and
  refuses one that is a failure, a betrayal, or bound to a choice's task; 66 sheets carry it (55 of DFU's families', 11
  of the questlines'), and M0B11Y18 gains `outrun` (the Queen's hunt run out: standard, the Queen +2).
- **The tools.** `tools/qlSheetDraft.mjs` (a script's resources, settable tasks - a task linked to a global variable
  too, AUDIT QUESTLINES LAW-13 - journal steps, rewards), `tools/qlCheck.mjs <Family>` (every sheet against its script by
  the sheet law, `tools/qlSheetLaw.mjs`; the family's set; its flagship branches; and, AUDIT QUESTLINES BRANCH-8 and
  BRANCH-9, every message a patch's lines name is one the patched script holds and takes no id the script already has,
  every row of a patch's words at most 50 characters and every answer one line of at most 30 - the classic skin never
  wraps), `tools/qlFormat.mjs` (one sheet a line; `--file` one file), `tools/qlPatchKit.mjs` (the hand-in branch,
  below). The sheet law refuses besides (AUDIT QUESTLINES): an `outcome _x_` its sheet has no row for (BRANCH-10), a
  standing that names no individual faction of Quests-Factions.txt (REWARD-12), a named piece's base of another kind
  (REWARD-5), and an outcome that pays gear where the script cannot pay it - nothing in it pays, or the task the outcome
  waits on ends the quest unpaid (REWARD-6, LAW-3).

### 2.3 Branches (AS BUILT)

A branch is a choice in the player's own words that sets a task; its outcomes are the sheet's. Four patterns, named
here and in the Port-Ledger's QUESTLINES row (AUDIT QUESTLINES DOC-26: this said each quest's was named in its family's
file - the files hold the sheets and the patches, never the pattern):

- **A - the script already decides.** A `prompt` whose two sides end differently: the sheet names the tasks that tell
  the ends apart (N0B00Y09: `_S.12_` loyal, `_S.13_` double, `_S.11_` sold).
- **B - a prompt whose sides end alike.** The sheet's outcomes differ by what the choice cost (L0B50Y11: the
  information bought, or the mark found anyway).
- **C - the hand-in** (`tools/qlPatchKit.mjs`). Where the story holds no decision, the questor asks how the player
  takes their pay: the reward task waits for `_qlkeep_`; `_qlask_` asks when the reward task's own condition holds;
  `_qlaltpath_` is the other answer's ending - `ql paid` and the reward task's lines that end the quest, without its
  gold; or, where the reward task's own pay is DFU's `give pc nothing`, that same `give pc nothing` and its box (AUDIT
  QUESTLINES BRANCH-6: there the box is the questor's last words and pays nothing, so both answers keep it). The kit
  wraps the question to 44 characters a row and refuses an answer over 30 (BRANCH-8), refuses a quest that already
  carries a branch unless `--replace` (BRANCH-15), and refuses a reward task another task reads - or, `--readers copy`,
  gives the second answer a copy of each plain reader (BRANCH-4: M0B50Y09's map to a second dungeon, given with the fee,
  was lost on the waived way). Of the seventeen the kit cut, only M0B50Y09's is exactly what it cuts today; the others
  were edited by hand after it (DOC-32).
- **D - by hand**, where the reward task's trigger is not one `when` line (`toting`, `clicked npc`): three patches
  written as C's are (M0B21Y19, B0B50Y11, K0C01Y10, R0C11Y16, A0C01Y03, A0C01Y06, A0C01Y13, A0C41Y18, C0B00Y02,
  Q0C4XY04, P0B01L02).

A branch's patches are `src/systems/questlines/patches/<family>.json`, applied as the pack is read and ONLY while the
switch is on (`src/systems/questlines/qlPatches.js` questlineLines - the read the start's stamp follows, so a quest
begun with the switch off is DFU's script whole). Each patch is SHAM-TRAIL's law: exact text, exact count, a warning
and DFU's text on a mismatch. New messages are numbered from 1900 (QL_MESSAGE_BASE), new tasks are `_ql..._`.

THE QUESTLINES' ACTIONS (`src/systems/questlines/qlActions.js`), registered by the quest bridge after DFU's 82 and
before Jagget's four (AUDIT QUESTLINES DOC-25: the bridge registers them as it is made, and the hosts add Jagget's after),
claiming no line of the shipped corpus (`test/systems/questlines/ql4_actions.test.js`):

- `ask <message> choices <message> _task_ <message> _task_ [...]` - two to four choices, each its own message; the one
  taken starts its task. Complete only on the answer, and never asked again once answered: a load under the question
  asks afresh, and a box closed unanswered - the host could not show its pick (no list art yet) - asks again
  ASK_AGAIN_TICKS later, 30 s (AUDIT QUESTLINES BRANCH-3: it stuck until a reload). The question waits behind the boxes
  already up, after the words that set it up (BRANCH-7). An answer counts only on the ask as it stands - unanswered, no
  choice of it set, the quest not ending - and a received copy kept in step with a party asks nothing: the sharer
  chooses (BRANCH-1, section 10.2). A message the quest does not have is said once as an error, and the ask goes out
  with the choices that have words (BRANCH-9: it marked itself done and asked nothing, and the reward waited for ever).
- `outcome _name_` - the outcome a path reached, written where the script decides it (first one stands) - only an
  outcome its sheet has; another is said and left to the sheet's bindings, and the sheet law refuses the line (AUDIT
  QUESTLINES BRANCH-10: written, it stood first, and the quest ended paying no standing and no gear).
- `ql act <kind> <n>` - a trigger: true once the player has done `n` acts of `kind` since the task first asked (QL11).
- `ql paid` - the quest a success and its outcome's reward, without the QuestComplete box `give pc nothing` raises -
  over a `give pc _gold_` that box hands over the reward the player just turned down. AUDIT QUESTLINES BRANCH-6: where
  DFU's own pay is `give pc nothing`, the box is the questor's last words and no reward, and the refusal keeps it (the
  four knights' hand-ins); where the box told the story (L0A01L00's "a full member of the Dark Brotherhood", P0A01L00's
  "Welcome to the family"), the refusal says the story in a message of its own (1903 - L0A01L00, P0A01L00, B0B70Y14,
  B0B70Y16, B0B50Y11, A0C01Y03).
- `ql name _person_ <Given_Name>` - a questline giver by their own name (Ysolde Marnhel wrote the breach's book).
  `ql name _foe_ <Name> [female|male]` names a Foe the same way, and the gender word sets a class enemy's (DFU's Foe.cs
  SetFoeName rolls a class foe 55% male; a gender on a monster is refused with a warning) - the Starfall's Spinner and
  her Sisters (`11-Multiplayer/Starfall.md` section 7, STAR8).
- `ql gone _foe_ [_foe_ ...]` (AUDIT STAR8 S1) - a trigger: true once one of the foes named (one to four) has stood in a
  scene, none stands now, and the first is not all killed. A foe stands while its pool drives its behaviour
  (`resourceBehaviour.js` update, stamping the machine's `beat`) within `FOE_STANDS_TICKS` (five minutes of play - a load's
  revived foe comes back behind its art inside it) and it has not fallen (`machine.js` hook `questFoeStands`): a cull, a
  teleport's sweep (`exteriorFoes.js` clearLive tells a behaviour nothing) or a load that did not bring it back stops
  that. What it saw is saved. QLTF02 clears its ambush on it, so the Coven on the Bluff is called again rather than its
  spindle lost with a Spinner the world took.

AS BUILT: the design's `ql reward` was not needed. GivePc's own moment reaches the layer for every reward a script pays
(`questReward`: the gold scaled by the outcome the quest's state holds then, before a party's split - AUDIT QUESTLINES
REWARD-11), and the outcome settles at the quest's own `end quest` (`questEnding`, `src/systems/quest/quest.js` endQuest).
A quest that pays before it ends is paid the rest at its end: GivePc's moment records what it paid (`{ base, factor,
shares }`, kept in the layer's save), and the ending pays what the settled outcome owes above it, through the quest's own
gold door with a HUD line - never taken back, nothing for a failure or `none` (`qlRewards.js` goldStillOwed; AUDIT
QUESTLINES REWARD-3, LAW-2: this said such a quest "pays by the outcome it ends on", and M0B00Y16 - paid at the
questor's click, `rescued` settling on the merchant's walk home - kept x1.00 in either order). No script is patched to
move its reward. A letter handed over with `give pc` is not pay (the main quest's invitations). A quest a system ends in
its own place settles there too: the werewolf's cure closes `$CUREWER` (`machine.js` tombstoneQuest's `ended`), and the
vampire cure's sweep tombstones the clan's quests the same way (`world.js`; AUDIT QUESTLINES LAW-12: it settled none). A
success no row's binding holds for as it ends settles to the sheet's success fallback (section 2.2) - the catch-all
failure yields to DFU's word that the quest succeeded.

### 2.4 What a quest keeps

Its save gains one port-only field, `ql` (`src/systems/questlines/qlState.js`): `{ stamp, tier, opened, done, failed,
choices, outcome, paid, moved, acts, received }` (AUDIT QUESTLINES REWARD-15: an `offer` was declared, read and reset, and
never written - a reward's choice waits in the layer's offers, `moved` says the outcome was settled, and `paid` says the
script paid). A quest started with the switch off carries `ql: null` for life. A shared copy carries the party's progress
(opened, done, failed, choices, outcome - merged monotonically on each resync) and never the holder's reward: `paid`,
`moved` and `acts` are reset on receipt, a `ql act`'s count starts from the holder's own (`shareActions.js`; AUDIT
QUESTLINES BRANCH-2: a step that had counted could not be shared, nor kept in step), and its `tier` is the holder's - the
copy arrives at the floor and the machine sets the holder's own as the layer's stamp reads it (`machine.js`
receiveSharedQuest; AUDIT QUESTLINES REWARD-1: it was the sender's - a level-21's town errand paid a level-1 member a
tier-4 choice, and a hand-built envelope any tier it liked). A received copy is marked `received` (BRANCH-1: kept in step
with a party, it asks nothing). A copy is read with the script its stamp read - its branch, or DFU's (`machine.js`
parseQuestShape; AUDIT QUESTLINES BRANCH-12). A questline's step is never shared, at either end (`questShare.js`, reason
`questline`; AUDIT QUESTLINES REWARD-2: the last step paid its named piece and gear to members who never began the line).
The notebook keeps the outcome's line as the filed entry's side record - on its header, never a line of its tokens
(`notebook.js` fileFinishedOutcome, saved port-only as `finishedQuestOutcomes` and restored with the notebook) - and the
enhanced archive alone draws it, the pause tab's Archived and the chronicle (AUDIT QUESTLINES UI-5: it was a line of
DFU's own entry, so the classic logbook was no longer DFU's verbatim).

### 2.5 The pins

- `test/systems/questlines/ql1_layer.test.js` - the switch, the state, the bindings, the latches, the tier, the stamp,
  the bridge's layer through M0B00Y06; and (AUDIT QUESTLINES LAW-6) four of the record's claims on quests of the pack -
  the catch-all's yield, the tombstone's settle, an ending settled once, a letter that is not pay.
- `test/systems/questlines/ql1_law.test.js` (AUDIT QUESTLINES) - the law's own: a foe never placed is no foe dead, the
  catch-all's yield, the success fallback never a guess.
- `test/systems/questlines/ql1_sheets.test.js` - the sets exact (248, and every questline step), each family's sheets
  naming only what their scripts have, the flagship 66 each with a branch whose ways GIVE the player different things
  (AUDIT QUESTLINES BRANCH-5: compared by what each way gives - gold, an item, gear, a step, standing and legal, the
  script's own repute - never by the pay's name), the patches' messages and widths, and the law's every refusal on a
  real script.
- `test/systems/questlines/ql3_rewards.test.js` (AUDIT QUESTLINES REWARD-9) - what an outcome pays, exact: the gold
  factors and their bounds, every pay's profile, the ladder per tier, the fit, a named piece from its base, the gold
  settled at the end, a failure's standing, the cap, the door, the keys by kind, the row kept.
- `test/systems/questlines/ql4_actions.test.js`, `test/systems/questlines/ql4_branches.test.js` - the actions, and every
  branch's ways run through the real bridge: switch off DFU's script, the fee, the fee waived, the knights' gold, the
  story messages, the ways that end as their sheets say.
- `test/systems/questlines/ql4_flow.test.js` (AUDIT QUESTLINES) - the `ask`'s flow through a real ServiceFlowWindow, and
  a shared copy: the sharer chooses, an answer counts once, `ql act` shared, the copy read with its stamp's script, its
  tier the holder's, a questline's step refused, a restart stamped.
- `test/systems/questlines/ql11_acts.test.js` - the acts, swept both ways, and every producer driven (AUDIT QUESTLINES
  ACTS-3).
- `test/systems/questlines/ql12_lines.test.js`, `test/systems/questlines/ql12_ladders.test.js` - the questlines'
  scripts and their words, their witnesses, the runner's gates, stalls and order; the guilds' ladders.
- `test/ui/questlines/ql2_journal.test.js` - the window's parts, and the Quest Guide's objective news;
  `test/ui/questlines/ql2_pause.test.js` (AUDIT QUESTLINES UI-9) - the Quests tab drawn whole in the real pause window:
  the rewards waiting and their armed Take, an entryless row, the archive's outcome, a phone's press, the pause door's
  Quests landing on either skin.
- `test/server/ql12_claim.test.js` - the service's claim, and the runner driven through the real door into the Worker
  (AUDIT QUESTLINES SERVICE-3).

The audit's mutant records: `tools/mutants/ql12_claim.json`, `tools/mutants/ql11_acts.json`,
`tools/mutants/ql4_flow.json`, `tools/mutants/ql3_rewards.json`, `tools/mutants/ql2_ui.json`
(`01-Overview/audits/Audit-Questlines.md`, Pinned).

## 3. The flagship 66

The rule (decision 3), computed from `QuestList-Classic.txt` and the scripts on 2026-10-19: a `prompt` (37), rank 4 or
above (20), one-time (22).

| Group | n | Quests |
|---|---|---|
| Nobility | 12 | R0C10Y00 R0C10Y01 R0C10Y02 R0C10Y18 R0C11Y03 R0C11Y16 R0C11Y19 R0C11Y26 R0C11Y28 R0C20Y22 R0C4XY23 R0C60Y24 |
| Commoners | 11 | A0C00Y10 A0C00Y14 A0C00Y15 A0C00Y17 A0C01Y01 A0C01Y03 A0C01Y06 A0C01Y09 A0C01Y13 A0C0XY04 A0C41Y18 |
| Knightly Orders | 9 | B0B40Y08 B0B40Y09 B0B50Y11 B0B60Y12 B0B70Y14 B0B70Y16 B0B71Y03 B0B80Y17 B0B81Y02 |
| Merchants | 7 | K0C00Y00 K0C00Y03 K0C00Y05 K0C00Y07 K0C01Y00 K0C01Y10 K0C30Y03 |
| Fighters Guild | 6 | M0B00Y16 M0B11Y18 M0B21Y19 M0B40Y05 M0B50Y09 M0B60Y10 |
| Mages Guild | 5 | N0B00Y09 N0B00Y17 N0B11Y18 N0B21Y14 N0B40Y07 |
| Dark Brotherhood | 4 | L0A01L00 L0B40Y04 L0B50Y11 L0B60Y10 |
| Thieves Guild | 4 | O0B00Y00 O0B00Y01 O0B00Y11 O0B10Y00 |
| Vampires | 4 | P0A01L00 P0B00L06 P0B01L02 P0B10L08 |
| Holy Orders | 3 | C0B00Y02 C0B3XY09 C0C00Y10 |
| Witches | 1 | Q0C4XY04 |

The Holy Orders and the Witches are thin by the rule; the Order of the Hour's questline (section 4.2) and the
summonings' sheets carry the temples and the covens further. Each wave (section 9) reads its family's flagship quests
and writes, for each, the branch its story holds: a `prompt` that already decides an end (N0B00Y09's, section 2.3)
becomes two named outcomes; a yes or no that does not, and a quest with neither, gets a branch written for it.

AS BUILT (QL4-QL10, every family's waves the same day): all 66 carry a branch whose ways give the player different
things - pinned by `ql1_sheets.test.js` (AUDIT QUESTLINES BRANCH-5: it said "pay differently" and compared the pays'
names, so four knightly hand-ins whose "take it" paid nothing passed). Patterns (section 2.3) by count: A, the script's
own choice, in most (every Thieves Guild and Nobility smuggler's `prompt`, the Merchants' and Commoners' ambushes); C,
the hand-in, in 17; D, by hand, in 11. Where a branch's patch also MENDS a DFU script it is said here and in the
Port-Ledger's QUESTLINES row (AUDIT QUESTLINES BRANCH-17: this said "in its family's file" - the files hold no such
words): B0B50Y11 (clicking the questgiver ended the quest a success without the ghost killed), K0C01Y00 (the victim's
path never set `_victory_`, so it never paid), B0B71Y03 (putting the child down now pays its honourable ending).

What a branch changes of DFU's own beside its question, each a departure in the Port-Ledger's QUESTLINES row (AUDIT
QUESTLINES):

- **M0B50Y09's map** (BRANCH-4): DFU gives a map to a second dungeon with the fee (`_S.06_` - `when _map_ and
  _victory_`); waiving the fee keeps it - the waived way's own `_qlaltS06_` (`when _map_ and _qlalt_`) reveals the
  dungeon and says 1080.
- **C0B00Y02's `say 1025`** (BRANCH-17): DFU's "Don't hurt me!" as the guardian hands the item over is dropped from
  `_rescueitem_`; the branch's two ways say their own instead (1903 the guardian let go, 1904 exposed).
- **The knights' gold** (BRANCH-5): B0B40Y09, B0B40Y08, B0B60Y12 and B0B80Y17 pay DFU's `give pc nothing` at the
  hand-in; "take it" gives gold now - B0B40Y09's and B0B60Y12's own `_gold_`, B0B40Y08's and B0B80Y17's a new `Item
  _qlgold_ gold` by DFU's formula - and the refusal keeps DFU's `give pc nothing` and its box.
- **The story messages** (BRANCH-6): where the QuestComplete box a refusal skips told the story, the refusal says it in
  a message of its own, 1903 - L0A01L00, P0A01L00, B0B70Y14, B0B70Y16, B0B50Y11, A0C01Y03.
- **Two refusals that fail** (BRANCH-13): K0C01Y10's Bothdorjii Scroll burned and P0B01L02's relic kept end the quest
  a failure - the questor's, by design - and their sheets say so (`failure`, paying nothing); A0C01Y13's letter kept for
  the magistrate ends a success (`ql paid`, legal +5).
- **The questions' words** (BRANCH-8, BRANCH-16): every row of a patch's words at most 50 characters and every answer
  at most 30, for the classic skin; eight questions reworded to follow the questor's greeting.

The waves also wrote down every DFU script they found odd and left as shipped (a dead end, a clock with no task, a
bare-named task); they are the QUESTLINES row's Ledger B list.

## 4. The questlines (AS BUILT - `src/systems/questlines/qlLines.js`, `qlLineRunner.js`, `quests/`)

Each line names its lore as `Elite-Gates.md` section 3 does: **canon** (UESP and Daggerfall's own data), and **the
port's own**, said so wherever it is said. A line is DATA (`qlLines.js` QL_LINES): its steps' quests and titles, its lead
and giver, its tier, and when it OPENS - a level, another line finished, online, a live event running (`opens.event`,
STAR8). Its steps are scripts on DFU's machine
(`src/systems/questlines/quests/<QUEST>.txt`, read by the one loader - `scenes/quest/questData.js`'s glob) with a sheet
each (`sheets/questlines.json`), stamped as every quest is. A step's title is its quest's DisplayName in English, the
pins holding the two to one word.

THE RUNNER (`qlLineRunner.js`, made by the layer). QL-OFFERED (2026-10-25; Lord Rumpkin on the Discord, "too many
quests": "My quest log ... has become congested in a very short span ... also every town I enter there is some courier
ramming quest letters into my hand. I find this very disruptive and want to turn it off. Random quests like that should be
picked up in the tavern, or notice board"; the owner: "No band aids", and his decision: A QUESTLINE IS TAKEN, NEVER SENT).

THE DEPARTURE FROM QL0, NAMED. QL0's runner began every line whose gate held, unasked, at each tick after the machine's -
one new line an hour of the character's time (AUDIT QUESTLINES LINES-17), then an hour after the last letter as well
(FB1020c LETTER-PACE, FIELD BUGS 2026-10-20c: "4 different notes from townsfolk ... while in a town for 5 minutes") - and
fourteen of its fifteen lines opened with a courier's letter that GivePc holds until a town, outdoors, by day
(GivePc.cs:78-97): online about one new letter every seven real minutes for as long as lines opened, and every one a
running quest in the log. DFU's rule is the other way. A letter comes unasked only where the story is already the
player's - the main quest's (`_BRISIEN`, StartGameBehaviour.cs:444-456), a crime guild's invitation, once each
(PlayerEntity.cs:94 InviteSent - `systems/crimeGuilds.js`), a vampire's clan's (PlayerEntity.cs:472
StartRacialOverrideQuest - `systems/worldTick.js`) - and all other work is a questor's to offer and the player's to accept
or refuse (DaggerfallQuestOfferWindow.cs, the guild popup's GetQuest at DaggerfallGuildServicePopupWindow.cs:546-667 -
`systems/quest/offerFlow.js`). The runner follows DFU's rule now. A line whose gate holds is OFFERED and never begun by a
look (`qlLineRunner.js:"        if (!rec) continue;"`); the player TAKES it (`qlLineRunner.js:"    takeLine(id, { quest = null } = {}) {"`),
its first step's quest started then - the very quest an offer was read from where there was one, so the letter read is
the letter taken - and its record the player's (`taken`). Every first step's letter is in hand from its start-up (`start
task`, `get item`: the fourteen scripts lost their courier's clock and their courier's words, and the four journal
entries that had a messenger hand it over say "I took a letter"); QLTF01's Wyrd Sister still hands hers as she is met. A
first step that fails, or is lost without its end, puts its line back on offer - its record let go, never sent again
(`qlLineRunner.js:"        if (!rec.done && rec.step === 0 && !runningStep(l.steps[0].quest)) { reoffer(l.id); continue; }"`);
one the player set aside in the journal puts it on offer too, and the take takes that step back (machine.js
reclaimQuest). A first step that will not parse where the player stands (a `local` place off a town, a place this region
lacks) is no take at all: the line stays on offer and the take says why. The LATER steps of a line the player took start
on their own, an hour after the step before (STEP_GAP_S), by courier where the step's script sends one, as DFU's main
quest's do; one that ends badly is offered again a day later (RETRY_GAP_S) - a failure is never a dead end.

THE COURIERS' PACE (FB1020c LETTER-PACE, re-aimed). A later step sets out only when no letter of any begun line is still
on its way and an hour after the last letter reached the player, the take's own among them
(`qlLineRunner.js:"  const courierMay = (s) => Object.entries(lines).every(([id, r]) => {"`). A courier counts only once
it is SENT - its clock running, or its task fired with GivePc holding the letter for a town by day
(`qlLineRunner.js:"export function letterOnItsWay(quest) {"`, heard at GivePc's moment through
`qlLayer.js:"if (resource?.itemName === 'letter') { runner.lettered(quest); return; }"`): QLBD03's courier sets out once
the rite is broken and QLIW02's once a revenant kneels, and read unsent they held every other line's next step for as
long as the deed waited. A step set out in the same look, its start-up not yet run, holds the rest until the machine's next tick says
whether its courier set out (two set out in one breath landed together at dawn). Pinned by
`test/systems/questlines/fb1020c_letterpace.test.js` (`tools/mutants/fb1020c_letterpace.json`).

WHERE A LINE IS OFFERED (`scenes/quest/questlineOffers.js`, made by the bridge - section 7; no host grows). Each offer is
its first step's letter, parsed and not started (the runner's offerQuest - its places and people drawn as a questor's
offer draws them):
- the introductions (`post: 'board'`) on a town's notice board - its Notices tab, "Help wanted", each card its giver's
  letter under the town's seal with a Take (`ui/noticeWindow.js`, through the board's one door, `ui/noticeDoor.js`).
  The board is the port's own and stands online; offline a rumour board is DFU's rumour box, and the Quests tab takes
  them;
- the story lines at their givers' doors, through DFU's own offer, Yes or No: Ysolde Marnhel's (`magery`) at a Mages
  Guild hall's Get Quest, the Prior's (`temple`) at a temple's, Corvane Tull's, Imrah Bel-Tavir's and Hamid al-Rasheen's
  (`tavern`) from someone with work in a tavern - the questor leaving the work pool, as DaggerfallQuestOfferWindow's
  constructor makes it. A questor whose own quest is still open offers nothing new (IsLastNPCClickedAnActiveQuestor), and
  a line refused rests a day of the character's time at every giver, so the next Get Quest draws the guild's own work;
- every line on offer on the Quests tab, with its Take up (section 6). The Thirteenth of Frostfall is the tab's alone -
  taken, its letter is a Wyrd Sister's, or Morwen's raven's once a star is held.
Whatever the door, the take says what it did in the HUD.

SAVES. A save from before keeps every line it had begun, where it stood: a first step whose letter came (its journal
entry written - every first step writes its first as its letter comes) stays the player's, a later step stands. A first
step SENT and never delivered - its quest running, set aside or scheduled with no journal entry - is let go (machine.js
removeQuest: tombstoned, nothing filed) and its line is on offer; a first step with no quest goes back on offer at the
next look; a line the player took is never let go, its letter come or not (`taken`). Pinned, with the take, the board's
Take, the givers and the Quests tab, by `test/systems/questlines/qloffered.test.js` (`tools/mutants/ql_offered.json`).

A step's quest that will not begin here (its script will not parse - a place this region lacks), or one gone without its
end (an error terminated it), is offered again a day later as well, never every tick, and the window says it could not
begin (AUDIT QUESTLINES LINES-7, LINES-12, LINES-19) - a later step's; a first step's is no take, or back on offer. The
step's quest is found by NAME, so a restart or a quest set aside is still the step, and a running copy of it is adopted
with its opening asked (LINES-18 - a take adopts a running copy of its first step, never starting a second); a line moves
only on its own step's end (LINES-13). A line that opens online waits, offline, where it stood (AUDIT QUESTLINES DOC-33:
this said a line the service pays - every online line waits). A line the service pays opens only for a registered account
(`opens.account`; LINES-2: the service records no guest's receipt, so a guest's witnessed step could never be done), and
a step whose deed needs a switch that is off, or the Renown a revenant comes at, waits and says so (a step's `needs`;
ACTS-2, LINES-3, LINES-6: such a line began, failed and was offered again for ever). What the runner keeps rides the
layer's save (the step, each step's outcome, when the next may start, what the service answered); a claim answered
after a load belongs to the records before it, never to the loaded character's (LINES-21).

GIVERS. A named giver is a Person of the script's own, named by `ql name` (DFU names a Person only from its name banks
or FACTION.TXT's individuals). A Person is made fresh in each step's quest, so the scripts say "the Master Conjurer"
and her name in the giver's own words rather than claim one body walks from quest to quest; the introductions' givers
are unnamed townsfolk where the feature lives, and a later step's giver is a new person sent on by the last (AUDIT
QUESTLINES LINES-10: the words treated them as one, who changed name and town between steps; Corvane "keeps no room
long").

QUEST-NAME-ONE (FIELD BUGS 2026-10-20, Harlander: "the name mentioned in the quest text doesn't match the name of the NPC
you talk to to progress it"; `01-Overview/bugs/Field-Bugs-2026-10-20.md`). `ql name` renamed the Person, and nothing
told the NPC stood for them: StaticNPC.GetDisplayName draws a static NPC's name again from its seed, so the plate, the
Info line, the plaque and the talk partner said the name the seed drew while the words, the journal and the guide said
Ysolde Marnhel, Prior Anselm Vey, Hamid al-Rasheen or Corvane Tull - in all sixteen steps a named giver gives. The NPC
stood for a quest Person now answers to the Person's own name (`systems/quest/person.js` personOwnName, carried by the
stand's one builder and answered by `characters/staticNpc.js` staticNpcName - Port-Ledger's QUESTLINES row, departure
11). Pinned by `test/systems/fb1020_questnameone.test.js`, which reads every `ql name` the scripts hold.

SITE-NAMED (FIELD BUGS 2026-10-20h, report 2: "the Orrery quest's blank building name";
`01-Overview/bugs/Field-Bugs-2026-10-20h.md`). The runner starts a step wherever the player stands, and a step's
`remote temple` or `remote magery` was named through the town host's name bag, which answered nothing off a town: a
temple or Mages Guild hall drawn on the road was named '' for good, and Brass at Dusk and The Orrery of Endings read
"Meet Prior Anselm Vey at  in Wildertown" in the sheet, the letter, the journal, the talk and the map - as did nine more
steps (the Burning Doors' and the Covens' Mages Guild halls, the Frostfall's last) and the main story's S0000008. The bag now answers once FACTION.TXT
is read (`townTalk.js:"    if (!factions) return null;"`), DFU's own law (FormulaHelper.cs:3139-3162 reads
PlayerEntity.FactionData wherever the player stands), and a save carrying such a site has it named at the load's
re-seat (`place.js:"  nameSiteAgain(world) {"`). Pinned by `test/systems/quest/fb1020h_sitenamed.test.js`.

### 4.1 THE DAGON CYCLE - three lines, one story (online)

The breach, the covens and the Spire are already one story in the shipped lore: Dagon's mortal faithful open the
breaches; "Dagon's covens hoard [the Weir Keys] in the deep places" (`Elite-Gates.md` section 3); the keys open the road
to the Spire's torn halls.

**I. THE BURNING DOORS** (`burningDoors`, tier 3, level 10). Ysolde Marnhel, Master Conjurer of the Mages Guild of Wayrest
- the author of *On the Burning Doors*, at a Mages Guild hall (`remote magery`).

| Step | What the player does | Witness |
|---|---|---|
| QLBD01 A Letter from Wayrest | her letter, taken at a Mages Guild hall's Get Quest or on the Quests tab (QL-OFFERED - it was a courier's); meet Ysolde (her purse the line's band, 300 to 600 - AUDIT QUESTLINES LINES-24) | |
| QLBD02 The Faithful | find the coven in a dungeon, slay its Summoner, take the rite-book; read it (`read`, greater pay, the Guild -3) or bring it sealed (`sealed`, the Guild +5) | |
| QLBD03 Breaking the Rite | break the faithful's rite before a breach opens (`ql act rite-broken 1`) | rite |
| QLBD04 Through the Burning Door | close a breach (`ql act breach-closed 1`) - the line's title, Doorwarden | breach |
| QLBD05 The Caged Broker | why the faithful cage the Sigil Broker; the embers to the Guild (`guild`, named "Ysolde's Ember-Rod"), to the Order of the Hour (`order`, "Seal of the Hour" - AUDIT QUESTLINES LINES-23: "Covenant", and the words called the Order "keepers of the Covenant", which is Akatosh's with the Emperors' blood) or to the Broker (`broker`, greater pay, "Broker's Dusk-Wing Mantle") | |

**II. THE COVENS' HOARD** (`covensHoard`, tier 3, after I). Ysolde again (AS BUILT: the design let the Order give it after
I's `order` ending; one giver keeps one voice, and the Order speaks in the Hour's line).

| Step | What the player does | Witness |
|---|---|---|
| QLCH01 Gold-Lit | slay three elite foes in Elite Dungeons (`ql act elite-foe-slain 3`) | |
| QLCH02 The Lieutenant | a coven lieutenant holds a Weir Key in a dungeon: slay them, take it (a quest item - a quest cannot mint the Spire's real key) | |
| QLCH03 What the Key Opens | keep it (`keep` - the Guild's fee in gold, and the service pays a real Weir Key, once an account; AUDIT QUESTLINES LINES-4: the keep paid nothing of its own and had Ysolde slide the key across the table to a house that may have had it already - now she says a house has it once) or hand it to the Order to be sealed (`seal`, greater pay, the Order +5, "Hourkeeper's Linen Signet") - the line's title, Covenbane | (key) |

**III. THE WEIR ROAD** (`weirRoad`, tier 4, after II). Corvane Tull, a Battlemage of the Spire's last class (the port's
own), in a tavern. Canon: Jagar Tharn gave the Spire to Dagon; the Imperial Secretary surrendered its portal keys.

| Step | What the player does | Witness |
|---|---|---|
| QLWR01 The Weir Gate | raise an Elite Breach and take a Redoubt (`ql act redoubt-taken 1`) | redoubt |
| QLWR02 The Torn Halls | take three Redoubts (`ql act redoubt-taken 3`) | redoubts3 |
| QLWR03 A Warrior Duke | take a Valkynaz's Redoubt (`ql act valkynaz-felled 1`) - the line's title, Weirwalker | valkynaz |
| QLWR04 The Battlemage's Account | what Corvane tells the Empire of the Secretary: the truth (`truth`, the Knights of the Dragon +5, "Oathkeeper's Dragon Helm") or the mercy he asks (`mercy`, greater pay, "Corvane's Spire-Blade") | |

AS BUILT against the design: the Annals step is gone (the Annals stay out of the journal by design, and the account's
`eg_annals` is no receipt with a time); the Last Spellmaster's Court is "three Redoubts" (a Redoubt's receipt does not
name its lord on every receipt - its `w` does say a Valkynaz's, every fifth Court: `net/eliteGates/egPay.js`
egValkRedoubt); QLBD02's "the next omen a quarter hour early" is gone (a script cannot move the gate's clock). AUDIT
QUESTLINES LINES-9: no step's words count the years since 3E 398 or name the year it is (decision 5).

### 4.2 THE HOUR THAT WAS NOT (`hourThatWasNot`, tier 4, level 12, online)

Prior Anselm Vey of the Order of the Hour (`The_Order_of_the_Hour`, faction 93, at a `remote temple`). The design's
question - the temples' halls carry 92, The_Akatosh_Chantry, and Quests-Factions.txt pairs each temple with its order -
stands: the Prior is a guest of whatever temple the draw places him in, and his standing moves 93's.

| Step | What the player does | Witness |
|---|---|---|
| QLHR01 Brass at Dusk | the Order's letter: a wound in time under the Bay, brass where there should be stone; meet the Prior | |
| QLHR02 The Orrery of Endings | the Orrery's six stones are the powers that will claim the Bay: choose which the player will tell (two asks - Daggerfall, Sentinel, Wayrest, or another: Orsinium, the Underking, the Blades); break an Hour (`ql act hour-broken 1`); the told power's words, its standing, its named piece - the line's title, Witness of the Hour | hour |

AS BUILT: two steps, not four - the Orrery's turning and the envoy are this step's words, because a quest cannot read
which power the step before chose. It says nothing of which main-quest ending comes, and no line names 3E 417 (decision
5: the Hour is the echo of a Break still to come). Canon: the Numidium, the Mantella, Kagrenac, a Dragon Break, the Order
of the Hour is Akatosh's. The port's own: the Hour, its Orrery, its stones, its Remnant.

### 4.3 THE OLD COIL (`oldCoil`, tier 3, level 8, online)

Hamid al-Rasheen, a packet captain of Sentinel. Canon: Satakal, the Redguard World-Skin that sheds and devours itself;
Tall Papa and the Walkabout. The port's own: Sethrakul, the skin it shed, still swimming.

| Step | What the player does | Witness |
|---|---|---|
| QLOC01 The Sailors' Tale | meet Hamid; hear the tale | |
| QLOC02 The Packet Lanes | sail the lanes (`ql act port-reached 2`) | |
| QLOC03 The Shed Skin | slay the Sea Serpent (`ql act serpent-slain 1`); pour its blood to Satakal (`offering`, People of Sentinel +5, "Walkabout Charm") or keep its scale (`scale`, greater pay, "Sethrakul's Scale") - the line's title, Satakal's Witness | serpent |

### 4.4 THE GUILDS' LADDERS (`src/systems/questlines/qlLadders.js`)

Each guild the player is a member of shows under Questlines as its ladder: the quests its list offers a member, by the
rank that opens them - its members' rows, a temple's own divine's too (AUDIT QUESTLINES LINES-15), an adult row only while
the setting allows one (LINES-16) - each rank a rung, reached while the guild offers its quests: by rank, or for the
Mages Guild and the knightly orders by level as well (`guilds.js` questRankFor; AUDIT QUESTLINES LINES-5: their ladders
said "(not yet)" of rungs the guild already offered). Each quest is struck once finished well (the layer's record of
what it saw finish, `history`, kept with its save - a failure never in it, DOC-14) and marked where it holds a choice (a
sheet with a branch). Read, never kept: the membership book, the list's rows, the sheets.

### 4.5 THE FEATURES

**The acts** (`src/systems/questlines/qlActs.js`, QL11): a feature says what the player did in one line where it
happens - `noteAct('fish-caught')` - on the player's own client, once, when the act is finished and certain; every
running stamped quest hears it (an objective's `act` binding, a script's `ql act`). `test/systems/questlines/ql11_acts.test.js`
sweeps `src/` both ways and pins where each is said:

| Kind | Said where |
|---|---|
| fish-caught | Professions' net (`scenes/fishHost.js`), Foraging's net, Deep Waters' fish taken |
| herb-gathered, ore-mined, wood-chopped | the gathering hosts' answered harvest (`herbHost.js`, `mineHost.js`, `treeHost.js`); Foraging's Basket (never an egg - AUDIT QUESTLINES ACTS-10, `foragingInstall.js`) and Wood-Axe |
| piece-crafted | a station's craft minted, by the tab that lets it go - never a brew's potions nor a dish (`net/profBook.js` craftOne; AUDIT QUESTLINES ACTS-4: a stew finished QLIP03) |
| gem-socketed, piece-reforged | a gem set in a socket - at the Reforge, or with the pack's own socket press (the inventory's gem wells), both through `systems/reforge.js` setGemPiece (AUDIT QUESTLINES ACTS-9: this said the Reforge alone); a piece reforged at the Reforge |
| gambit-won | The King's Gambit settled, the player's side won (`scenes/gambitTableGame.js`) |
| cards-won | a Hold'em pot or an Iliac hand won, offline and at the relay's tables |
| port-reached, cargo-delivered | the harbour office: a berth at another port after a quarter league under sail (PORT_VOYAGE_M) from the port she last lay still in, the helm let go in port a berth too (VOYAGE-HOLD, `01-Overview/bugs/Field-Bugs-2026-10-21b.md`); a delivery contract done (`scenes/harbourOffice.js`) |
| ship-struck | a ship struck to the player's guns - in a sea the player stands, or online in her stander's word within SINK_CREDIT_S of the player's blow - one helper with the crew's win (`naval/navalHost.js` struckToMe; AUDIT QUESTLINES ACTS-11: the second arm said nothing, so online a group's other captains struck none) |
| raid-repelled | a raid the player fought, cleansed (`systems/raidingParties.js`) |
| arena-won | a ladder bout won - this screen's own, or the relay's `pve` bout; never the pit's practice nor a bout between players (`scenes/arena/arenaBouts.js`; AUDIT QUESTLINES ACTS-6) |
| revenant-knelt | one of the player's own revenants made to kneel, whoever struck the blow that broke it - a revenant is the player's own and comes for them alone (`scenes/exteriorFoes.js`, and `dungeonContext.js` underground), its record answering the yield (`systems/revenant/revenantFate.js` beginYield; AUDIT QUESTLINES ACTS-7, decided) |
| star-taken | a star the service now holds, each star once, counted by the book whose change took it and kept by account and character across a reload (`net/firmament/firmamentBook.js`; AUDIT QUESTLINES ACTS-5: one star given back and taken again counted each time) |
| wyrd-met | a Wyrd Sister's window opened at a tavern's door, the Witches' Festival's (`scenes/witchesHost.js` shop, the festival's own module; AUDIT STAR8 T1: The Thirteenth of Frostfall's letter waits on it) - never a Soul Cake find (`systems/festival/festivalClient.js` ACT_NOT_FOUND) |
| rite-broken, breach-closed | a gate receipt counted (`net/gate/gateClaims.js`) - `rite`, or `r: 1`; `dealt` or `stood` |
| elite-foe-slain | an elite foe of an Elite-tier dungeon killed by the player's blow (`systems/questlines/qlEliteFoe.js`, which the dungeon host hands its place in one line - AUDIT QUESTLINES ACTS-8: the whole condition stood in buildDungeonContext) |
| redoubt-taken, valkynaz-felled | a Redoubt receipt counted, Rehearsals excluded (`scenes/eliteGates/egClient.js`, at the module's scope - ACTS-8) |
| hour-broken, serpent-slain | their receipts counted (`sdClaims.js`, `serpentClaims.js`) |

AS BUILT: the design's "a wagon's load hauled (Merchant Yards)" is no act - nothing in the game finishes one (the
yards trade horses and wagons; the trade window's wagon button does nothing), so an objective bound to it could never
close. The road's introduction is DFU's own delivery instead. "A set's second bonus woken" waits for a producer too.

**The introductions** (online where their feature is): THE COURT CRAFTER (`introCrafts` - fish and plants, ore and
timber, a piece made; online: the Professions' harvests are the service's to answer), THE SMITH'S SECRETS (`introGear` -
a gem socketed, a piece reforged), THE HARBORMASTER'S WORD (`introSea` - a port reached, a cargo delivered, a ship
struck), THE MERCHANT'S ROAD (`introRoad` - a load carried to a merchant and back), A SEAT AT THE TABLE (`introTables` -
a hand of cards, the King's Gambit), THE HERALD'S CALL (`introArena`), THE BAY'S TROUBLES (`introBay` - a raid driven
off, a revenant made to kneel), WRITTEN IN THE STARS (`introFirmament`). Two or three short steps each, an unnamed giver
in the player's town, a named piece at the end. The Tutorials explain; an introduction gives a reason to go, and pays.
No introduction for the groups that are the game itself (Getting Started, Combat, Your Character, Quests, Family).
AUDIT QUESTLINES ACTS-2, LINES-2, LINES-3, LINES-6: an introduction whose feature was off never moved, and one a guest
could not finish was offered for ever. THE COURT CRAFTER opens only for a registered account (the Professions refuse a
guest); THE SMITH'S SECRETS' steps need Loot rarity, THE HARBORMASTER'S WORD's Naval Combat (and Come Sail Away's own
switch), A SEAT AT THE TABLE's second The King's Gambit, and THE BAY'S TROUBLES' second the Renown a revenant comes at
online (10) - each step waits, saying so ("Opens with Loot rarity on.", "Opens at Renown 10.").

**The work that is already work** - bounties, writs, harbour contracts, revenant errands, caravans - stays its own
system; the window's rail already holds its rows.

### 4.6 THE THIRTEENTH OF FROSTFALL (`thirteenthFrostfall`, tier 3, level 6, online, the Starfall's - STAR8)

Morwen, a Wyrd Sister of Glenmoril - the Witches' Festival's Glenmoril Wyrd, whose sisters keep the taverns' doors. A
line of its own group (`festival`) that opens only while the Starfall runs (`opens.event: 'starfall'`), its star steps
waiting outside it, and the window drawing it outside its event only once begun (UI-Calm's law). A star step the
Festival ends under is set aside, fail-free, and taken up again at the next (AUDIT STAR8 S2: the runner's
`keepSeason` - its quest set aside as the journal's Abandon sets one, `aside` on the line's record, its row "Opens during
the Witches' Festival."; a step the player set aside stays theirs). Canon: the Witches' Festival on the 13th of
Frostfall, the Glenmoril Witches, the Sisters of the Bluff, the Order of Arkay. The port's own: the fallen stars and the
covens' thread. The whole of it is `11-Multiplayer/Starfall.md` section 7.

| Step | What the player does | Witness |
|---|---|---|
| QLTF01 Music in the Woods | Morwen's letter from a Wyrd Sister at a tavern's door (`ql act wyrd-met 1` - her window opened), or her raven's note if a star is held first; hold a fallen star (`ql act star-held 1`); reach the Glenmoril Coven | star |
| QLTF02 The Coven on the Bluff | slay the Spinner at the Coven on the Bluff - her spindle the player's as she falls, the Sisters of the Bluff -10, a coven gone unfought called again (`ql gone`); unwind a length (`unwound`, greater pay) or give it whole (`wound`, the Glenmoril Witches +3) | |
| QLTF03 Three Stars | hold three more stars (`ql act star-held 3`) - the line's title, Starwarden; and, never a gate, the Heart-Star (`ql act heart-star-held 1`: `heart`, greater pay, "Heart-Star Ring") | stars3 |
| QLTF04 What the Thread Is Worth | burn the spindle (`burned`, the Glenmoril Witches +10, "Morwen's Hunt-Charm"), sell it to the Mages Guild (`guild`, greater pay, "Starglass Rod") or take it to a priest of Arkay in Arkay's own temple (`templeArkay`; `temple`, the Order of Arkay +5, "Thread-Cutter") | |

## 5. The rewards (AS BUILT - `src/systems/questlines/qlRewards.js`)

### 5.1 The tier

A quest's tier is read off what it already asks (`qlLaw.js` questTierOf): rank 0-1 is tier 1, 2-3 tier 2, 4-5 tier 3, 6 and
above tier 4; a reputation-gated row by its band (20, 40, 60); a social quest and the main quest by the player's level
band (7, 14, 21); a questline's step by its line's own tier (its sheet's `tier`, pinned to the line's - AUDIT QUESTLINES
DOC-6, DOC-34). Stamped at the start, for life - a restart's too (BRANCH-14). A shared copy's is its holder's, read as
the holder's own stamp reads it at the receipt (AUDIT QUESTLINES REWARD-1: it was the sender's).

### 5.2 What an outcome pays (the client's, as today)

- **Gold.** DFU's formula stays the base, times the outcome's pay (PAY_PROFILES): `standard` 1, `lesser` 0.75 (the
  merciful way: less coin, more standing - the sheet's), `greater` 1.25 and a rung up the gear's ladder (the harder
  way), `double` 1 (the script itself pays both sides), and three that add no gear - `betrayal` (the other side's coin,
  never the betrayed guild's piece), `own` (the script's own reward is the reward: a Prince's artifact, a cure) and
  `none` (a quest that ended unpaid). Scaled at GivePc's moment by the outcome the quest's state holds then, before a
  party's split, and settled at the quest's end: what the settled outcome owes above what GivePc paid is paid then,
  never taken back (section 2.3; AUDIT QUESTLINES REWARD-3, REWARD-11).
- **A piece of gear, chosen.** An outcome that pays gear, on a quest that paid (its script's `give pc`, `ql paid`, or a
  success), offers REWARD_CHOICES (three) pieces - a weapon, an armour piece, a jewel - at the tier's floor
  (TIER_FLOORS: tier 1 Magic; tier 2 Magic, a quarter a rung up; tier 3 Rare; tier 4 Rare, no rung - AUDIT QUESTLINES
  REWARD-7: tier 4's 15% rung made 15.6% of its cards Legendary; a greater outcome's step stops at Rare, so no quest's
  piece is Legendary), fitted to the player (their armour's weight - `isForbiddenEquip` - and their two best weapon
  skills; a class barred from every armour is offered a jewel in its place - REWARD-10). Rolled through the dungeons'
  own producer (`gateSpoils.js` spoilsBase, `lootRarity.js` applyRarity), so the item law and the copy ledger read it
  as any piece; seeded by the quest's name, uid and start time (`rewardSeed`), so a reload never rolls again. The three wait in
  the Quests tab ("Rewards waiting", at most OFFERS_MAX - twelve: past it the oldest that names no piece goes, and its
  going is said in the HUD - AUDIT QUESTLINES REWARD-8, LINES-20) until one is taken; the one taken goes the reward's
  way (RW1's pile, the pack opened over it), the others are gone. A host with no door for a taken piece (the
  `?exterior` bench) lists none and takes none - they wait in the save; with a door the piece is given first and the
  offer cut after (REWARD-13). The layer's row says whether a quest can still pay a choice of gear (`gear`: an outcome of
  its sheet that pays gear, over a script that pays - REWARD-6), and the window promises a choice of gear only then
  (AUDIT QUESTLINES UI-4).
- **A named piece** (AS BUILT: the questlines' endings alone). A line's last step's outcome may name one of its three
  cards (`named: { name, kind, base }` - the card of that kind is made FROM `base`, a template the roll makes for that
  kind, through the same fit, and takes the name with no metal before it: `itemInfo.js` withholdsMaterialPrefix, the
  item's `qlNamed`; a holder who cannot wear the base is offered that card unnamed - AUDIT QUESTLINES REWARD-5: the name
  landed on whatever base the roll drew, "Oathkeeper's Dragon Helm" a pair of Gauntlets). Once a character: the name is
  spent when the named card is TAKEN, and one waiting offer holds a line's name at a time (LINES-20: spent when rolled,
  an offer cut at the cap lost it for good). The design offered a named
  piece to each flagship quest of DFU's as well; those keep the ladder's own names, because a DFU quest already names
  what it pays in its own words, and a hundred names of the port's over Daggerfall's quests is the "Daggerfall's words
  stay" decision broken. A named piece is rolled, not fixed: a fixed roll is Gilded's, held to its record by the wire
  (`gilded.js` validGildedMarks), and a quest's piece is held by the item law as every rolled piece is.
- **Standing, both ways.** An outcome moves every faction its sheet names (`standing`, -10 to 10 each - by
  Quests-Factions.txt name, an individual row's, read to its id; AUDIT QUESTLINES REWARD-12: an occupation's row moved a
  Prince) and the legal standing (`legal`), once, at the quest's end. Flat: each named faction by its own amount, never
  carried on to its allies and rivals as DFU's quest repute is - a sheet names every faction it moves (AUDIT QUESTLINES
  REWARD-14, a departure in the Port-Ledger). A failure's standing obeys QFAIL-FREE: online it costs no faction anything,
  as DFU's own -2 costs none there, and offline it stands (REWARD-14: six failure outcomes cost standing online). Online
  the Roll bounds a gain as every quest's (`Chapters-Arc.md` 3.3).
- **Renown XP** stays `renownQuestXp`'s, unchanged.
- **The measure** (QL3's, owed). A quest pays ONE piece (one of three taken), at Magic or Rare - fewer than a dungeon
  of its tier drops in the time a quest takes, and the online wealth budget judges a character's gear as it judges
  every piece. The numbers of a played hour are owed to the first week of play (the Integrity arc's own measure,
  `realm_wealth_hours`), and TIER_FLOORS is the one constant to move. AUDIT QUESTLINES REWARD-7: "at Magic or Rare" was
  untrue - tier 4's rung paid Legendaries, and a social quest's tier is the level band - and is true now.

### 5.3 What the service pays (AS BUILT - only what it witnessed)

Weir Keys and titles are the account service's (`Wallet.md`, `Sigil-Sets.md`). QL pays them through one module,
`server-account/src/questlines.js` (`claimQl`), and one route, `POST /v1/ql/claim { line, step, phase, choice? }`, behind
a session. The law both ends share is `src/net/questlineClaims.js`: `QL_SERVICE_LINES` names the six lines the service
pays (the Cycle's three, the Hour, the Old Coil, the Thirteenth of Frostfall - STAR8), each witnessed step's kind, the title and the step that pays it, and the
Covens' Hoard's key. An end of a step it pays nothing is answered `{ why: 'unpaid' }`; a guest's end `{ why: 'guest' }`,
nothing paid - and on the client a line the service pays opens only for a registered account (section 4, LINES-2).

- **A step is claimed twice, each claim saying its phase** (AUDIT QUESTLINES SERVICE-6: the phase was the claims' order,
  so an opening asked again after a load paid Covenbane at QLCH03's START). Its `open`, sent by the line runner when it
  starts the step - every step of a line the service pays, the steps it pays nothing among them - writes one `ql_steps`
  row (migration 0133), `opened_at` the service's clock: `{ opened: true }`, and an opening asked twice opens once. An
  opening pays nothing and reads nothing, so a guest's is written too (AUDIT QUESTLINES SERVICE-1: it was answered `guest`
  and filed as opened, and a guest who registered mid-line never had the line's opening). Its `end`, sent when the step
  ends well, reads the step's witness: the endgame place's own receipt row for the account (`QL_WITNESS_SQL`), written at
  or after the LINE's first opening - an end whose own opening never landed is read against the line's (AUDIT QUESTLINES
  SERVICE-2) - and in the line's order: newer than the receipt that witnessed an earlier step, older than one that
  witnessed a later, so one receipt witnesses one step (`seen_at`; AUDIT QUESTLINES SERVICE-5: one rite-breaking fight
  paid both of the Burning Doors' steps). THE WITNESS-ORDER RULE (AUDIT STARFALL B2): an end is not witnessed while an
  earlier WITNESSED step of its line is not done (`server-account/src/questlines.js:"export function qlStepsBefore(lineId, step) {"`):
  the earlier step's receipt is the window's floor only once it is laid, and a later step's end asked first read its
  window from the line's opening, so one receipt witnessed both (the Thirteenth of Frostfall's three stars took its
  first, the Weir Road's three Redoubts took its first). Answered `{ witnessed: false }`, and the runner asks again; the
  ceiling still reads a later step done before the rule (a row acct159-164 wrote). A receipt row's `at` is the second it was CLAIMED (every producer writes its
  own clock), so a receipt held unclaimed counts from its claim - a receipt lives a week. Witnessed: `done_at` and
  `seen_at` laid with the outcome's `choice` (the first an end carries) - `{ witnessed: true }`; else `{ witnessed:
  false }`, nothing written, and the runner files the step `unseen` (the window's to say, section 6) and asks again, as
  it asks every claim not answered: a minute apart CLAIM_TRIES (five) times, then every CLAIM_SLOW_MS (ten minutes) while
  the page lives, and again at the next load - never given up (SERVICE-2: an open dropped after five minutes left a step
  no deed could witness, and the Burning Doors' breach took Covenbane and the Weir Key with it). Only an end pays.
- **The witnesses.** `rite` a Dagon's Breach's rite broken (`gate_kills`, the rite's row or a fighter's two embers);
  `breach` a Dagon's Breach closed (a kill's row); `redoubt` an Elite Breach's Redoubt taken, `redoubts3` three, and
  `valkynaz` a Valkynaz's Redoubt (`eg_redoubts`, every fifth; never a Rehearsal's); `hour` an Hour broken (`sd_kills`);
  `serpent` the Sea Serpent slain (`serpent_kills`); `star` a fallen star held, `stars3` three (`stars_held`, the
  Starfall's - STAR8). The Covens' Hoard's last step has no receipt of its own: it is
  witnessed once the Burning Doors is witnessed whole - its title, Doorwarden, held on the account (AUDIT QUESTLINES
  SERVICE-4: it read the breach step alone, so a direct client had the key with no rite broken).
- **A title once an account, for good** (AUDIT QUESTLINES SERVICE-8, LINES-22: this said "once a character" - the titles
  and the steps are the account's, and a second character's witnessed steps answer off the first's rows). A line's bit
  on `players.ql_titles`, laid on the claim of its `titleAt` step once that step and every witnessed step before it are
  done - asked on each of those claims, so a line whose steps were done out of order before the witness-order rule
  still pays it when its last step lands. The Starwarden's write also lays its purse of Soul Cakes while the festival is
  open (`Witches-Festival.md`, "The Starwarden's purse").
  Doorwarden (the Burning Doors), Covenbane (the Covens' Hoard, at its end), Weirwalker (the Weir Road), Witness of the
  Hour (the Hour), Satakal's Witness (the Old Coil) and Starwarden (the Thirteenth of Frostfall, at its three stars -
  STAR8) - the badge's words (`ui/playerBadge.js` TITLE_TEXT; the vocabulary
  spells the last two `hourwitness` and `satakalwitness` - AUDIT QUESTLINES SERVICE-9, DOC-2: this named them by those
  keys); the relay knows them from world228 (`src/net/identityToken.js` TITLES; world222 on the branch, renumbered past main's at the merges), Starwarden from the Starfall's relay (STAR8). A title paid is the house's
  HONOUR-BANNER and a HUD line, as every title grant is (AUDIT QUESTLINES SERVICE-7: it was a HUD line alone). A title
  step's later end answers the line's title HELD (`titleHeld`) where this claim did not lay it, and the runner tells it
  only for a claim an earlier attempt of which went unanswered - offline, a timeout, a 5xx, or an end a load asks again
  unanswered - so an answer lost after the commit is told on its retry, once, and an answer that arrived is never told
  twice (SERVICE-7 (c): the retry answered without the title, and its banner never showed).
- **The Weir Key once an account.** The Covens' Hoard's last step done by an end whose own choice is `keep` pays it:
  `eg_keys` + 1 and `ql_key` = 1 in one statement, only while `ql_key` is 0 - `{ key: true, keys }`, `keys` the balance
  after, which restacks the pack's keys at once (SERVICE-7). The step's `choice` stays the first one said, its record;
  the key reads the end's own (AUDIT QUESTLINES LINES-4: a first character's `seal` barred the account's key from every
  character after it). A keep that finds the account's key given already is answered `keyHeld`, and told: "The Covens'
  Hoard gives one Weir Key to an account, and yours was given already." QLCH03's keep pays the Guild's fee in gold as the
  seal does, whatever the service answers (section 4.1).
- Nothing a classic quest does mints an account currency; a questline's gold and gear are the client's (5.2).
- Opened by `QUESTLINES_OPEN` (`off` | `dev` | `on`) in `server-account/wrangler.toml` - `on`; shut, the claim is
  refused `ql-closed` (403), and a body the shared law refuses `ql-body` (400). Deploy: the relay (world228) first, then
  the account service (acct159, migration 0133), then the site.

## 6. The window: one place (AS BUILT)

The pause window's Quests tab (`src/ui/enhanced/enhancedMenu.js` pauseQuests) is the one place, its questline parts one
module both faces draw from (`src/ui/questlines/qlJournal.js` - the Chronicle on L draws the same objectives block).
A window redesigned on purpose: it cites this page, not DFU (SCOPE1). The rail, in order:

- **Rewards waiting** - while any wait: each ended quest's three pieces - each card saying what the piece is, its
  damage or armour, its hands and its weight (AUDIT QUESTLINES UI-11) - and a Take that arms on its first press ("Click
  again to take") and takes on the second, as Abandon, Remove and Clear do, the focus kept on that Take (UI-10: one
  press gave a choice away, and the focus fell on the next reward's Take). A reward waiting is told in the HUD with the
  way to it on the skin worn, and the pause door's Quests landing (`pauseDoor.js` `at: 'quests'`) opens the enhanced
  pause on either skin (UI-6: a classic-skin player was sent to a tab the classic journal lacks). Each is named in the
  language of the page that draws it - the quest's title as the ladders name it (AUDIT QUESTLINES UI-19: the words it
  was rolled in); a step's outcome and the filed "Outcome:" line keep the words they were filed in, as DFU's notebook
  files its own (the quest whose resources expand them is gone).
- **Main Quests**, **Side Quests** - as before; a stamped quest's page draws under its entry WHAT TO DO (its objectives
  as the machine opened them: done struck, failed crossed, optional marked, alternatives joined by "or"), YOUR
  CHOICES, HOW IT ENDED, and what finishing it pays (the tier's floor in words, read off TIER_FLOORS - only where the
  row's `gear` says the quest can pay a choice of gear: AUDIT QUESTLINES UI-4). A stamped quest whose objectives stand
  before its first journal entry is a row too (`unloggedRail`), with no Track, no Hide and no Abandon - the HUD's card and
  the rail read entries, and abandoned it was lost (AUDIT QUESTLINES UI-8); on a phone a row pressed brings its page into
  view (UI-14).
- **Questlines** - every line begun or on offer, the ones under way first, then those waiting, those on offer, the
  finished last; QL-OFFERED: a line its gate shuts is no row (UI-Calm's law - nothing drawn that cannot be taken; QL0
  drew all fifteen, locked ones "Not begun"), so offline a line that can only begin online is not drawn, and one begun
  shows "Continues online." (decision 1; AUDIT QUESTLINES UI-14). A line's running step is drawn under its line's row and
  never a second time under Side Quests (QL-OFFERED: the report's congested log - each step stood in both), while the
  line is drawn; with the questlines off it is a side quest again, never lost. A line's state is one of: under way;
  waiting for its next step; its last step failed and it will be offered again (`retry`); its step set aside in the
  journal (`shelved`); on offer (`offered` - "nothing comes until you take it up", where else it is posted, and its Take
  up, arming on its first press as Abandon and Remove do); finished (AUDIT QUESTLINES UI-7: a failed step read
  "Waiting", a shelved one "Under way"). A line's page says what a questline is, its story and giver,
  its steps as the path walked - done, now (only while its quest runs; between steps the next is still to come), to
  come - and on a step the service witnesses, the service's answer: "needs a witness" before it is done, "witnessed" once
  the service saw the deed, "not yet seen" when it is done and the service has no record of the deed since the line
  began (do it again and it counts); what a witness is, said once on the page, never on a hover alone (UI-12; ACTS-1:
  "witnessed" stood on every done step whatever the service said). Then what it waits on ("Opens at level 10,
  online.", "Opens with Loot rarity on.", "Continues with a registered account.", "Its next step could not begin here:
  it will be offered again."), how it ended (the last step's outcome said once - UI-16) and the title it earns, which
  waits until every deed the line asks has been seen. A step whose claim the service refused (`ql-closed`, `ql-body`)
  says so under it in the service's words (AUDIT QUESTLINES UI-19: the runner swallowed the refusal). Then each guild the
  player is a member of, as its LADDER (section 4.4), what "a choice" marks said once on its page (UI-12).
- **Hidden**, **Abandoned**, **Archived** - as before; an archived entry carries its outcome's line, the filed entry's
  side record (section 2.4; UI-5).

The Quest Guide reads objectives (`src/ui/quest/questLens.js`): a view carries the objective asked now - the first open
one the quest needs, an optional one only while nothing it needs is open, never a failed one (AUDIT QUESTLINES UI-1: 23
sheets list an optional objective first, and the card named it for as long as it was skipped; DOC-20) - which the
tracker's card says in place of the entry's opening, and the ones done (the herald's new news, "Objective done", ranked
over a routine entry, keeping its words when the script's entry lands a look later - UI-2). The lens's look, ten times a
second, reads no line or ladder (`questLog({ windows: false })`), and a quest's row is kept while what it was read from
stands (`qlLayer.js` rowOf; AUDIT QUESTLINES LAW-11). AS BUILT, two of the design's lines stand otherwise: the HUD's map marks keep the newest entry's target
(the Guide's honesty rules, W1 and W2, decide what a mark may reveal, and an objective's `mark` names a place the entry
already has); and L keeps landing on the Chronicle, whose Quests page draws the same objectives block - the tab is a
press away, and two doors to one module disagree about nothing. The design's "Work" page is the rail as it stands:
bounties, revenant hunts and Legacy's quests are already its rows (`questLog`'s widened walk).

The Tutorials' **Questlines** page (`src/systems/tutorialCatalogue.js`) pops the first time a quest with objectives
starts that the player TAKES - never S0000977 or `_BRISIEN`, the quests a new character is started on, nor a list's
start-up quest (`qlLayer.js` stamp; AUDIT QUESTLINES UI-13: it popped at character creation); it promises a choice of
gear only for the quests whose page says so (UI-4). Every string through `t()`, drafted in the thirteen languages the catalog requires.

## 7. The hosts, and where the code goes (AS BUILT)

- `src/systems/questlines/` - the law, pure: `qlState.js` (the save field), `qlLaw.js` (the switch, the stamp, the
  bindings, the latches, the tier), `qlSheets.js` + `sheets/`, `qlFamilies.js`, `qlPatches.js` + `patches/`,
  `qlActions.js`, `qlRewards.js`, `qlActs.js` (the acts feed), `qlEliteFoe.js` (the elite foe's act, handed its place
  by the dungeon host - AUDIT QUESTLINES ACTS-8), `qlLines.js` (the questlines), `qlLineRunner.js`, `qlLadders.js`,
  `qlLayer.js` (the layer the bridge makes), and `quests/` (the questlines' scripts).
- `src/scenes/quest/questBridge.js` - THE ONE CONSTRUCTION SEAM: it makes the layer over its machine, registers the
  actions and the acts' sink, and hands the window `questLog`'s `lines` and `ladders` (the lens's look,
  `questLog({ windows: false })`, reads neither - LAW-11) and `journalClean`'s offers, and the layer the door a taken
  piece goes through only where the host has one (REWARD-13).
  `src/scenes/quest/questlineHost.js` is the account service's door it builds (an online page alone), and
  `src/scenes/quest/questlineOffers.js` the questlines' offers it makes (QL-OFFERED): the notice board's source, read
  through the board's one door (`ui/noticeDoor.js`), the givers' doors ahead of the bridge's own offerGuildQuest and
  offerSocialQuest, and journalClean's `takeLine`. THE FOUR HOSTS: `world.js` opens the board through its door and builds
  the bridge; `worldModes.js` hands the social door whether the player stands in a tavern, as an argument of the call it
  already made (no logical line); `exterior.js` and `dungeonContext.js` take through journalClean alone, with no board or
  giver of their own - none grows (`hostceiling.test.js`). The hosts
  carry one line each where nothing else knows the moment - the `ask` box's door (`world.js`, `exterior.js`), the
  cure's settle (`world.js`, and the vampire cure's sweep settling - LAW-12), and the acts no feature module hears
  (section 4.5) - `hostceiling.test.js` holding them. AUDIT QUESTLINES ACTS-8: the elite foe's whole condition had grown
  into buildDungeonContext, and acts into createNavalHost and createEgClient - the condition is `qlEliteFoe.js`'s (the
  dungeon host one line, `hearEliteFoesIn`), the naval act one helper with the crew's win, the Redoubt's acts at the
  module's scope.
- `src/ui/questlines/` - the window's parts; `enhancedMenu.js`, `enhancedChronicle.js`, `enhancedStyle.js` and
  `enhancedFrame.js` draw and dress them.
- `src/net/questlineClaims.js` - the claim's shared law; `server-account/src/questlines.js` - the claim
  (`POST /v1/ql/claim`); `server-account/migrations/0133_questlines.sql`.

## 8. Not changed

- DFU's machine and its 82 templates; the vendored scripts (patched as read, never edited).
- The classic skin's logbook, verbatim (AUDIT QUESTLINES UI-5: it was not - every stamped quest's filed entry gained an
  "Outcome:" line; the outcome is the entry's side record now, drawn by the enhanced archive alone).
- Offline with the switch off: DFU's quests as DFU runs them - no stamp, no patch, no objective, no reward added.
- The main quest's story and its endings. It gains objectives and rewards, no branch, and stays refused for sharing.
- Every endgame place's rules, rates and drops.
- The Chapters, the bounty boards and the writs, each its own system.
- The Wallet's five currencies.

## 9. The slices (AS BUILT, 2026-10-19)

| Slice | What was built | Pins |
|---|---|---|
| **QL1 THE LAYER** | the switch (a Features row, forced on online), the stamp and its save field, the sheet and its law, the latches; the Fighters Guild's sheets as the proof; the tools | `ql1_layer`, `ql1_sheets` |
| **QL2 THE WINDOW** | the Quests tab's questline parts, the Questlines and ladders sections, the Guide's objective news, the Tutorials page, thirteen languages | `ql2_journal`, `ql12_ladders`, the Guide's suites |
| **QL3 THE REWARDS** | tiers, pay profiles, the choice of three, named pieces, standing both ways | `ql1_layer`, `ql3_rewards` (AUDIT) |
| **QL4 THE BRANCHES** | `ask`, `outcome`, `ql act`, `ql paid`, `ql name`; the patches; the hand-in kit | `ql4_actions`, `ql4_branches` |
| **QL5-QL10 THE WAVES** | 248 sheets in fourteen families; the 66 flagship branches | `ql1_sheets` (the sets exact) |
| **QL11 THE ACTS** | the acts feed, its kinds and their producers | `ql11_acts` |
| **QL12-QL16 THE QUESTLINES** | the registry and runner; thirty-five scripts in thirteen lines; the service's claim and its titles and key; `QUESTLINES_OPEN` | `ql12_lines`, `ql12_claim` |
| **STAR8 THE THIRTEENTH OF FROSTFALL** | the Starfall's line: four scripts, `opens.event`, the `starfall` need, `star-held`, the `star`/`stars3` witnesses, Starwarden, `ql name` for a foe (section 4.6; `11-Multiplayer/Starfall.md` section 7) | `star8_frostfall`, `ql12_claim` |
| **AUDIT QUESTLINES** (2026-10-19) | eight lanes' 151 findings, each fixed, decided or left and said (`01-Overview/audits/Audit-Questlines.md`) | `ql1_law`, `ql3_rewards`, `ql4_flow`, `ql2_pause`, and the audit's pins in every file above |
| **QL-OFFERED** (2026-10-25) | a questline taken, never sent: the runner's offer and take, the first letters in hand, the couriers' pace re-aimed, the offers on the board, at the givers and on the Quests tab, the log's steps under their lines, the saves kept (section 4, THE RUNNER) | `qloffered`, `fb1020c_letterpace`, and the moved pins of `ql12_lines`, `ql12_claim`, `star8_frostfall`, `ketch_lines` |

## 10. The owner's calls (taken at the record's defaults - "Develop this all")

1. **The questline's Weir Key** (II.3): once an account, to a player who keeps it, behind the Burning Doors witnessed
   whole (section 5.3). AUDIT QUESTLINES SERVICE-4: as built it stood behind the breach step alone - now behind the
   Burning Doors' title held; and it is paid on the end's own `keep`, whatever an earlier character chose (LINES-4).
2. **Who chooses in a shared quest**: the sharer - a choice is a task, and the copies take it on the resync
   (`qlState.js` mergeSharedState: the local choice first). AUDIT QUESTLINES BRANCH-1: every copy was asked, and the
   member's answer, synced back, decided the sharer's copy - a received copy kept in step with a party asks nothing now
   (`qlState.js` `received`, `qlActions.js` QlAsk); one whose party is gone, or after a load, is its holder's alone and
   asks. An answer counts once, on the ask as it stands.
3. **A title a questline**: one each of the five lines the service pays (Doorwarden, Covenbane, Weirwalker, Witness of
   the Hour, Satakal's Witness), held by the account (AUDIT QUESTLINES SERVICE-8). The introductions pay no title:
   nothing witnesses them.
4. **THE OLD COIL**: in (section 4.3).
5. **The givers' names**: proposed here - Ysolde Marnhel (already the breach book's author), Corvane Tull (the
   Battlemage), Prior Anselm Vey (the Order of the Hour), Hamid al-Rasheen (Sentinel's packet captain). The owner may
   rename any; each is one `ql name` line and one registry string.
