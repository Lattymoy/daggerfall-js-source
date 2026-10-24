# QUEST-AUDIT III - the quest system read whole, every defect a player can hit, fixed

The owner, 2026-10-23: *"Can you do a detailed quest audit, fix any and all outstanding issues. Do not worry about DFU
parity."* QUEST-AUDIT (`Field-Bugs-2026-10-04d.md`) and QUEST-AUDIT II (`Quest-Audit-II.md`) hunted how the town mods
break quests. This one reads the whole quest system, from the script to the journal to a party's shared copy, under the
owner's standard: a difference from Daggerfall Unity is not a finding by itself (SCOPE1). A finding is a defect a player
can hit. That means a throw, a quest that cannot be started, carried on or finished, a target that never stands or cannot
be reached, a reward paid twice or never, progress lost over a save, a shelf, a restart or a share, or a journal that
says something false. Words a player sees raw or in the wrong language count too, as does a state that breaks the next
quest.

**How.** Six read-only lanes worked on a frozen snapshot: a git worktree at main `4728fb88a`, with the freeware ARENA2
fetched by `tools/fetch-data.sh`. The lanes were:

- the lifecycle and the save (L1);
- the actions and the macros (L2);
- placement and the scene mount (L3);
- the journal, the offers, the restart and the shelf (L4);
- the online share (L5);
- the record's own open items against the code (L6).

Each lane was told what was already in hand: #982, #986 (PR #1010) and CRATE-FREE's `N0000005.RDB` pin. Each finding
came with a script over the real modules that showed it (CONFIRMED) or a traced path (PLAUSIBLE), and each fix was
checked against its lane's script on the fixed tree. Every fix is pinned and every pin mutation-checked (below).

## The fixes, by lane

### The issue in hand: STORY-AGAIN (#982) and LODGED-STAND

- **STORY-AGAIN (#982, levelman123: S0000012's messenger was not found in its two days, "Quest fails. I am unable to
  continue main story").** A step of the main story ends on a refusal, a missed window or a death, and the step that
  would have started the next never runs, so the story stopped for good. DFU's only way back is its developer console.
  The machine now records the steps begun and the steps that have ended. These are `storyStarted` and `storyEnded`,
  saved, because the tombstone's week is not long enough to remember them (`src/systems/quest/machine.js`
  storyAgainRefusal, startStoryAgain, seedStory, storyShape). The journal's Main Quests offers such a step again from
  its first step. Its questor then waits and offers it once more.

  The law reads Daggerfall's own scripts (AUDIT QA3 B2-B6, below). A step's script says the story steps it starts, the
  global variables it sets itself, and the work a set global would run again. The main story is the S group, without
  the world's backbone (PROTECTED_QUESTS), the Totem's aftermath (S00001xx) and the guilds' series filed under S
  (S00005xx). A step is offered when:
  - it has ended, and is not running, scheduled or set aside;
  - the story needs it: it sets a global the story reads, or it starts a step that is needed (S0000001's letters and
    S0000009's dead end are not);
  - nothing it would do has happened. No step it starts has begun, however many steps on (S0000020's Elysana's
    Betrayal files no journal entry). A step that starts none has none of its globals set (S0000021's
    KingOfWormsSatisfied). No link task of its own whose global is set would pay, start a quest or end it at once
    (S0000008's totem given, S0000009 after the finale).

  Whether it paid is not asked. A step that paid and still stopped the story is the story's to take up again, its pay
  with it: S0000015's diary handed to Gortwog before its gates stood, S0000004's errand and then the thirty days. A save
  from before the record learns it once from its tombstones and the journal's archive, where every entry is an end
  whatever the archive says of success. Both journals (the pause window's Quests tab and the chronicle) draw it with
  the twice-armed press Abandon uses, and its words are said where the player reads them. Its words are in all
  fourteen languages.
- **QUEST-RESET's questor rung, narrowed.** The restart refused every quest with a questor, and so it refused every
  main-story step. Now only a questor bound by the click refuses (its `questorData` is the clicked NPC's), because
  whoever was clicked last would be bound. A questor the script names (`add _Mynisera_ as questor`) binds the same person
  again.
- **LODGED-STAND.** Daggerfall's N0000005.RDB lays quest spawn marker 29157 at the foot of statue 62330, inside its
  footprint, and the Person a dungeon Place stood there stood inside the statue. A dungeon quest Person is now freed by
  CRATE-FREE's own law (`src/systems/quest/sceneMount.js` freeQuestStand), at the billboard's height
  (`src/scenes/worldModes.js` standQuestFlatIn), keeping the stand's own lift off the ground plane (AUDIT QA3 D3).

Pinned by `test/systems/quest/questaudit3.test.js`, `test/systems/quest/auditqa3_story.test.js` (the real scripts, the
two doors) and fb1004d_cratefree's real-data pin; `tools/mutants/questaudit3.json`, `tools/mutants/auditqa3_story.json`.

### L1 - the lifecycle and the save

- **END-GRACE.** A save taken inside `end quest`'s two ticks of grace (a reward box holds the tick) loaded a quest that
  ran for ever, and its questor refused all work. The envelope carries no `ticksToEnd`, and EndQuest never re-arms. A
  restored quest whose `end quest` has run enters its grace again. This was FIELD BUGS 2026-09-28's open item; L6
  found it too.
- **END-ONCE.** A second `end quest` inside the first one's grace re-paid the reputation and filed the notebook entry
  twice. That happens with a deadline's end under a reward box that held the tick while the clock ran on. The second
  `end quest` now only extends the grace.
- **START-HELD.** A `start quest` the next tick had not yet run was lost by a save: S0000012's hand-in shows its reward
  box, then `start quest 20 20`. The scheduled quests ride the envelope (`toInvoke`, written only when one waits).
- **PROMPT-HELD.** Prompt.cs and PromptMulti.cs complete when the box is shown, and the answer lives only in the box's
  callback. A save while the box was up (online, the five-minute save or the page-hide save) loaded a question spent and
  never answered. The Lost Child's child never asked again, and S0000003's `prompt QuestorOffer` left a quest with no
  way on. Now the box's place is held while it is up, and the action completes on its answer. The place is the task and
  the action's index there, which a party's resync rebuilds to. A load asks again. The envelope this copy hands on
  writes a question whose box is up as asked, so a partner's copy never asks it too (AUDIT QA3 A1).

Pinned by `test/systems/quest/questaudit3_life.test.js`; `tools/mutants/questaudit3_life.json`.

### L2 - the actions and the macros

- **SEND-HELD.** A `send` wave waiting for a town raised the encounter every tick it waited. That broke every rest and
  turned back every Travel Options trip outside a town (S0000021's zombies, S0000009/10/12's, K0C30Y03's). A held wave
  raises nothing.
- **GOLD-ONCE.** A quest's gold Item pays its holder once. S0000009's `_S.02_`, set again every dusk, paid its 87 gold
  every night, and N0B21Y14's `get item _gold_` then `give pc _gold_` paid one pile twice. The Item's `goldPaid` is
  saved. A partner's received copy starts unpaid, and a resync keeps the holder's own. A stamped questline quest's
  `get item` of gold is scaled by its outcome as its `give pc` is (AUDIT QA3 A3).
- **MUTE-HELD.** An `until _x_ performed:` body re-arms each tick, and MuteNpc's re-arm unmuted the person between
  ticks, where a click lands. S0000018's Gortwog took the click at once, skipping the thirty days, the tenth level and
  Medora's vision. The persisting re-arm keeps the mute.
- **ILL-SAYING.** `make pc ill with X saying N` was read past the `saying`: S0000007's "You feel a sickening jolt as the
  _relic_ vanishes." was never shown. It parses, saves and shows. Its `textId` is saved only where a `saying` gave one,
  so a copy of the four bare `make pc ill` quests begun before shares with this build both ways (AUDIT QA3 C1).
- **DOTTED-SYMBOLS.** Six actions captured a symbol with `\w+`, and a symbol with a dot or a dash fell to the
  unknown-action path. Those are DialogLink, AddDialog, PlaceNpc, PcAt, RevealLocation and CreateNpcAt. M0B11Y18's
  `pc at _L.00_ set _S.12_`, read at last, cleared `_S.12_` on every exit and began K'avar's five archer waves anew;
  it is patched so the place sets a task of its own that starts `_S.12_`, which nothing clears: the waves stop for good
  once the player reaches L.00 (AUDIT QA3 C3).
- **CLIMATE-NAMES.** C#'s alternation bound `climate desert2` to desert and `climate mountainwoods` to mountain, so
  Foraging's MiningQuest's rich seam never read 225 or 230. The longer name is tried first. A copy begun before, holding
  224 or 226, still shares: the old binding is accepted and the receiver's own stands (AUDIT QA3 C1).
- **CAST-SHARE.** A `cast X spell do` action's effects are read from the holder's ARENA2 at the parse. A receiver's
  reference parse is headless, so every share and resync of N0B00Y08, N0B00Y16 and N0B40Y07 was refused as a forgery.
  The effects are read lazily where the copy runs, and the share law holds them as the holder's.
- **JOKE-MACROS.** TEXT.RSC 200's jokes carry their own macros (%ra in 22 of the 23), and the expansion never walked inserted
  text. K0C00Y05's child and thirteen quests' rumors told the player "%ra" raw. Each joke's tokens are expanded, and a miss
  keeps the token. A name that brings its own article after the joke's "the " drops it ("Over at the Mole and Jug",
  AUDIT QA3 C4).
- **DI-UNREF.** `%di` with no place referenced yet threw. C# reads LastPlaceReferenced.Scope before its null check, and
  a load or a share forgets the reference. The talk answer or the popup threw to the host, which error-ended the quest:
  V0C00Y00 1012 and Y0C00Y00 1012 after a load, and P0B01L02's rumor 1010 (AUDIT QA3 C2: the three a player reaches).
  It reads the dialog place of the last declared Person that has one - where it stands, else its home: V0C00Y00's
  remote contact stands nowhere until the player enters their home - never a questor's, else DFU's own
  "...never mind...". This retires Quest-Guide-Arc's open bullet.
- **DUEL-TOWN.** This was Quest-Audit-II's "Recorded, not changed". A0C00Y10's journal sent the duel to "_inn_ in
  ___giver_", the questor's town, where the inn may be the nearest town's (NEAR-SITE). It is patched to `___inn_`
  (`src/systems/quest/questPatches.js`).
- **C0C00Y10's healer.** This was FIELD BUGS 2026-10-13e's owner's call, now taken. `_no_ task: clear _S.10_` meant
  the healer to ask again, and Prompt.cs's allowRearm kept the prompt spent, so the talisman was never bought.
  NO-ASKS-AGAIN now reads a No that only clears its click-asked task as that ask-again (`src/systems/quest/noAsksAgain.js`
  clearingNo).

Pinned by `test/systems/quest/questaudit3_acts.test.js` (DUEL-TOWN and the healer by `questaudit3_life.test.js`);
`tools/mutants/questaudit3_acts.json`, `questaudit3_life.json`.

### L3 - placement and the scene mount

- **RELOAD-TWINS (HIGH).** A load restores new quests under the same uids. A quickload inside the same dungeon mounts
  over the stands the scene still holds, and by their old Symbol objects none read "already here". Every quest person,
  item and live foe stood twice: two giants for M0B00Y16, and a hidden person's twin left standing and clickable. The
  mount relinks every standing behaviour to its live resource and symbol first. This closes the C# quirk the mount
  guard's comment kept. AUDIT QA3 D1: a foe killed or hidden after the save stood again but never counted (the
  behaviour still read dead, or was destroyed and read "already here"); a destroyed behaviour is no stand, and a body
  stood up again whose Foe the load holds alive counts its next death.
- **ENDED-STANDS.** A quest that ended while its people and things stood (a timer, its own `end quest`) no longer
  ticks, so nothing put them away. Its item could be taken and its person took every click. They are put away as a
  shelved quest's are, and so are a quest's the machine no longer holds at all - the journal's Restart threw it away
  (AUDIT QA3 D2).
- **LINK-OWN.** HasSiteLink answered for any link at the site. A second Place of the same quest at the same building
  never got its own link: S0000503's `_dummy_` and `_magesguild_` share one Mages Guild hall in 17% of starts. Another
  quest's link stood in for this one's too. It is now this quest's link for this Place. QREPAIR's second mend is its
  backstop.
- **HOUSE-HOUSE.** The house fallback read (p2 -1, p3 0) as `random` and took a tavern, a shop or a guild hall for
  `remote house4` (6-8 towns in 87, Nearby on). It asks for any house, after the typed house at both reaches.
- **RESEAT-TYPED.** The re-seat seated sites in quest order, so A0C00Y06's and A0C00Y07's `local random` took both of a
  re-laid town's taverns, and A0C00Y10's `local tavern` was unseated. Sites of a kind are seated first, and a site
  prefers the building of its own journal name.
- **MARKERLESS-DRAW.** A drawn dungeon whose build holds no quest marker gave up the draw: 117 of 3,444 small builds
  (Glork's Hold and the Cairn of Necromulan among them), and one medium, Norlogod's Nest. Another of the pool is drawn,
  up to six.
- **QLBD02.** The questline's coven named one Mage for two foes. Each has its own.

Pinned by `test/systems/quest/questaudit3_scene.test.js`; `tools/mutants/questaudit3_scene.json`.

### L4 - the journal, the offers, the restart and the shelf

- **RESTART-PAID.** QUEST-RESET restarted a quest that had already paid (S0000015's diary money and standing,
  Nocturnal's artifact), as often as the button was pressed. A quest that paid out refuses: `'paid'` (machine.js
  questPaidOut). Paid is a trainer's lesson, or an item handed over that is the player's for good (AUDIT QA3 A2/B3).
  Gold rides to the new copy as paid, so an advance at start-up is never paid twice. Standing is not a purse, `give pc
  nothing` is an empty box, and a permanent item nobody handed over is not the player's yet. A quest whose `start
  quest` has run refuses `'started'` (AUDIT QA3 B1).
- **SHELF-TWIN.** A quest item abandoned onto the ground is handed back when the quest is reclaimed, and picking up the
  ground copy made a second. A twin is refused. The reclaim's "is it kept" reads every keeping, including the wagon,
  the Materials Bag and a repairer's hands (the host's `keepsQuestItem`); a script's `toting` and `have` read the pack
  alone, as before (AUDIT QA3 B8).
- **NAMED-TIMER.** "Time remains" showed the tightest counting clock, so a letter's six hours showed as urgent beside "I
  have 236 days to rescue her" (B0B00Y00, K0C00Y03, N0B00Y09). It is the deadline the entries name, where they name one.
  This is the lens's own law.
- **OFFER-STALE.** A pending offer whose sender had already been handed over, or whose quest no longer runs, held the
  latch. One Rest or Travel press hours later did nothing, even after another save was loaded. It is let go, and so is
  one its quest no longer holds after a party's resync rebuilt its actions (AUDIT QA3 B7).
- **NO-WORK.** With Choose Guild Jobs on and no work to offer, the wait box opened a picker of nothing. The classic "no
  work" line answers.
- **RESTART-WORDS.** A questline step dropped by the journal's Restart kept its day of waiting and its "could not begin".
- **SHELF-WORDS.** The shelf's refusals, the abandon and reclaim lines and buttons, and the chronicle's "Time remains"
  were English in every language. They go through `t()`, drafted in the thirteen.
- `?exterior`'s quest world had no `getRandomText`, so %oth and %jok read nothing from TEXT.RSC's pool there.

Pinned by `test/systems/quest/questaudit3_life.test.js` (RESTART-PAID, SHELF-TWIN, RESTART-WORDS) and
`questaudit3_scene.test.js` (NAMED-TIMER, OFFER-STALE, NO-WORK, `?exterior`), SHELF-WORDS by questshelf's moved pin;
`tools/mutants/questaudit3_life.json`, `questaudit3_scene.json`.

### L5 - the online share

- **SAME-COPY.** A party member's own copy of a repeatable quest, or a stranger's final, carries another shareId. By
  name alone it replaced this copy's progress, sites and identity, or ended it and paid for a quest this player never
  did. Two known identities that differ are refused 'active'.
- **SHARE-MEMORY.** After a reload every partner's sync and final were refused 'active', and this copy's progress never
  left. The share memory rides the save (`shareMemory`, AUDIT QA3 A6/E6): which copies are kept in step, the finished
  copies by identity and by name, each copy's holders and its sharer. An older save's is read from its quests.
- **PROGRESS-KEPT.** When two members acted at about the same moment, the envelope's task flags and journal replaced
  this copy's. A deed made in the ten seconds the client's floor held this copy's sync was gone from both copies. A task
  set here stays set, and a journal step stays, unless the partner's copy newly cleared it. The merge is then sent back.
- **BUSY-SYNC.** A sync the hub refused as 'busy' was sent by nothing until the next change. Its baseline is let go.
- **SHARER-GONE.** This is AUDIT QUESTLINES BRANCH-1's "LEFT, said". A sharer who left kept every received copy waiting
  at its choice for good, and a copy shared on to a new party waited for nobody. A received copy waits while the player
  who shared it is in the party, and its holder is asked once they leave (AUDIT QA3 E1: never by the party's silence).
- **GOLD-HOLDERS.** The purse was split by the party's size. A share three members refused paid its one holder a
  quarter. The shares are the copies held, never more than the party: this one, and each partner heard holding it. A
  copy new here answers "held" with its first sync (AUDIT QA3 E2/E4), which nobody merges, and the holders ride the
  save.
- **GUARD-HOLDER.** GUARD-ONLINE's watch fields rode the progress law. A member who left at the close sent `guardAway`
  and started the watch over for the one still in the hall. They are the holder's.
- **KILL-ONCE.** This was VERMIN-SHARED's "Said, not fixed". Each copy counted the kills it saw, and the resync kept the
  larger count. An envelope that came before the credit counted one kill twice, so a `killed 2` closed on one spider.
  The kills an envelope brought are learned, by whose envelope, and that partner's credit is not counted again (AUDIT
  QA3 E3: another member's credit always counts).
- **REPUTE-SHARE.** REPUTE-GATE's two quests wait online for the guild standing their headers name. A party's share
  handed them to a member at standing 0. The receiver's own standing is asked, with the catalog row's guild (AUDIT QA3
  E7: never the envelope's word).
- **SHARE-WORDS.** Every share refusal and arrival line was English in every language.

Pinned by `test/systems/quest/questaudit3_share.test.js` and `auditqa3_share.test.js`; `tools/mutants/questaudit3_share.json`,
`auditqa3_share.json`.

## Pins moved

Each moved pin says PIN MOVED with its reason. They are:

- fb1004d_cratefree (four lodged, and the free);
- questreset1 (the click-bound questor);
- enhancedPause PX22;
- auditquests_linkage (the dotted symbol);
- fb1013e_noasks (the law list gains C0C00Y10);
- questmacros (%di);
- guide1_questLens (the moved counts);
- questactions5 and foragefix (the climates);
- fb1017b_shamtrail (the patch keys);
- world5 and world7 (START-HELD);
- qa2_layouts (SHARE-MEMORY);
- auditdisc28_quests, fb1003b_vermin and keptkill;
- disc22f_share_copy, disc25d_guild_share and sharemend;
- questbridge, rest8_questwaits and audit_guide (NAMED-TIMER);
- questmachine;
- fb1004d_questtrace (HOUSE-HOUSE);
- qrepair (LINK-OWN);
- questshelf;
- ql3_rewards and realm0 (GOLD-HOLDERS);
- auditparty8 (the echo's baseline);
- sd20g_delve;
- l10n3d_services (NO-WORK's wait box needs work in its pool) and l10n4_hardcoded (the ratchet: DUEL-TOWN's two
  anchors into DFU's own text up, the words routed down);
- questparty (KILL-ONCE's credit), quickloot (a twin of a ring the pack keeps is refused, the old law on a pack of its
  own) and rvn7c_map (the hunt's Abandon through `t()`) - AUDIT QA3 F8: the list had left these three out.

Twenty-two mutant records whose source moved were re-aimed, and all are dead again. The audit's own mutants are
240, all dead: `questaudit3.json` 16, `questaudit3_life.json` 75, `questaudit3_acts.json` 60, `questaudit3_scene.json`
30 and `questaudit3_share.json` 59.

## Left, and why

- **K0C30Y03's `_victin_`.** The start-up's `repute with _victin_ exceeds 15 do _S.28_` names a Person the script never
  declares, so that one branch never opens. Which Person the author meant cannot be told from the script, so it is not
  patched; the quest parses and runs by its other branches.
- **WAQ_SHIP_ATTACK_PIRATE's "with 100 success".** The vendored mod's text stays verbatim, and the quest is reachable.
- **#884 (sieges).** No cause was found in the quest system.
- **#986 (Wood Bundles).** PR #1010 is open for it.
- **DEAD-CLOCK's other half.** Whether a clock that no entry names should leave the journal windows altogether is still
  the owner's call. NAMED-TIMER took only the half that was false.
- **WD1's WALLAA08 sha.** `test/formats/worldData/wd1_worlddata.test.js`'s "every vendored patch rebuilds the author's
  file" fails on this ARENA2 at the snapshot's base as on this branch. It is not the quest system's, and is not touched
  here.

## AUDIT QA3 (2026-10-23, the owner: "Audit this")

Six lanes, each a cold adversarial reader of the change at `29624034e` (QUEST-AUDIT III with main merged in), told to
reproduce every finding with a probe and its saved output before reporting it, to cite the code by its text, to compare
with main before calling anything a regression, and to fix nothing. They read a frozen snapshot (a detached worktree
of `29624034e`), never the working tree, and no fix was made until all six had reported (Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING). They were given the owner's request, #982 and the diff, never this page's conclusions (lane F
excepted: the record was its subject).

| Lane | Over |
|---|---|
| A - the lifecycle and the save | machine.js's envelope both ways, quest.js, the prompts, the gold, the mute, the illness |
| B - the main story's restart and the journal | the story's ladder over every real S quest, the two journals in the test DOM, QUEST-RESET, the journal fixes |
| C - the actions, the macros, the patches, the No | every script of the pack parsed at main and at the snapshot, every message and joke, every prompt |
| D - placement and the mount | every dungeon quest marker of the game, a same-dungeon quickload, the restart, the site search |
| E - the online share | two and three machines sharing as the host does, over a fake hub with the client's floor |
| F - the pins, the words, the record | the tests and the mutants, the thirteen languages, every claim of this page and its rows |

**WHAT THEY FOUND.** Forty findings, a few of them one defect met by two lanes (written `= B2`), five of them HIGH: a
question asked twice in a party, one player's No ending both copies (A1); the journal's Restart replaying the Totem's
reward with every press (B1); an old save offering steps the story had gone past (B2); a foe killed after a quickload's
save standing again and never counting (D1); and a questline choice answered by both members (E1).

Severity: HIGH wrong for players in normal play, a lost quest; MEDIUM wrong in a real but narrower case, a misleading
word; LOW polish, a fragile pin, the record. Every finding is FIXED unless it says otherwise, and the section above
says the law as it now stands under the finding's id.

| Id | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | A question whose box is up rode the share envelope open; the partner's copy asked it too, both answers were kept, and A0C00Y10's No ended both copies | FIXED: the envelope writes a held prompt asked (machine.js getShareableQuestData) |
| B1 | HIGH | QUEST-RESET let S0000008 restart after `start quest 106 106` ran: +100 with sixteen factions per press, its revenge quests twice | FIXED: the `'started'` rung |
| B2 | HIGH | An old save seeded every step the archive filed unpaid as failed: the Orcish Treaty and Lysandus' Revenge offered again, paid again, Elysana's Betrayal doubled (= F1) | FIXED: an end is an end; the scripts decide (storyShape, the transitive carry) |
| D1 | HIGH | After a same-dungeon quickload a foe killed or hidden after the save stood again, and its death never counted | FIXED: a destroyed behaviour is no stand; a body stood up again re-arms |
| E1 | HIGH | SHARER-GONE's two minutes of silence asked the receiver while its sharer was still there, and both members answered the same choice | FIXED: the copy waits while its sharer is in the party |
| A2 | MED | RESTART-PAID refused four quests from their first tick (M0B00Y16's giant's loot, three start-up advances) | FIXED: paid is a lesson or a permanent item handed over; gold rides to the new copy |
| A3 | MED | GOLD-ONCE dropped the questlines' multiplier on N0B21Y14's rescue (its `get item` paid unscaled) | FIXED: `get item`'s gold through the outcome's scale |
| B3 | MED | A step that paid on the way to stopping the story (S0000004, S0000015) got no door; QUEST-RESET refused P0B00L01 after a +5 errand (= F2) | FIXED: the story's door asks nothing of pay; standing is no purse |
| B4 | MED | After the finale the door offered Elysana's Betrayal and Mantella Revealed, and each press looped | FIXED: the needless rung and the replay rung |
| B5 | MED | S0000008 run out of its year was refused because its revenge quests began | FIXED: the aftermath (S00001xx) is no step |
| B6 | MED | The guilds' S series and the story's dead ends took the main story's door and words | FIXED: S00005xx is the guilds'; a step the story does not need is refused |
| C1 | MED | A quest begun before the change could not be shared with this build (a `make pc ill`'s new field, the Mining climates) (= A4) | FIXED: `textId` written only where set; the old climates accepted. M0B11Y18's copies begun before stay unshareable (LEFT, below) |
| C2 | MED | %di's fallback missed V0C00Y00, the quest its comment named ("...never mind...") | FIXED: the Person's dialog place, its home among them |
| D2 | MED | A restarted quest's old stands stayed drawn, answering nothing (not a regression) | FIXED: a quest the machine no longer holds puts them away |
| E2 | MED | GOLD-HOLDERS paid a copy whole until it heard its holders, and forgot them on a reload | FIXED: the holders and the sharer ride the save, and a held copy says so. The hand-in race stays (LEFT) |
| E3 | MED | A learned kill swallowed a later credit no envelope corrects: a `killed 3` never closed | FIXED: a learned kill is the sender's, spent only by their credit |
| F1 | MED | = B2 | FIXED |
| F2 | MED | = B3 | FIXED |
| A4 | LOW | = C1 | FIXED |
| A5 | LOW | Restarting S0000018 waits its thirty days again, Gortwog muted | RECORDED: the script's own first step (QUEST-RESET's record says so); MUTE-HELD makes it hold |
| A6 | LOW | A reclaimed copy was put back in step with its party by a reload | FIXED: the share memory rides the save |
| B7 | LOW | A pending offer orphaned by a party's resync kept the press | FIXED |
| B8 | LOW | The widened `carriesQuestItem` let a wagon's lich dust finish S0000022 and stay behind | FIXED: the pack for `toting`/`have`, every keeping for the reclaim |
| B9 | LOW | "Take it up again"'s words landed at the foot of another quest's page | FIXED: said at the tab's head |
| C3 | LOW | M0B11Y18's newly read `pc at _L.00_ set` re-armed K'avar's archers at every exit | FIXED: the place sets a task that starts `_S.12_` (the first patch, `do`, changed nothing: this port's `do` toggles as `set` does) |
| C4 | LOW | "Over at the The Mole and Jug" | FIXED |
| D3 | LOW | The freed Person lost the stand's 2% lift | FIXED |
| E4 | LOW | A new copy's answer carried the sharer's old state back over what the sharer did since | FIXED: it answers "held", merged by nobody |
| E5 | LOW | PROGRESS-KEPT cannot see a partner's `clear` whose task re-armed (synthetic; the corpus's self-clearing tasks clear a click set in the same tick) | LEFT: the fix tried (keep only what was set since the last merge) lost three members' deeds at once - a merge cannot tell a crossing sync from a drop |
| E6 | LOW | A finished copy was remembered only through its tombstone's week | FIXED: = A6 |
| E7 | LOW | REPUTE-SHARE read the faction from the envelope | FIXED: the catalog row's guild |
| F3 | LOW | The two journal doors had no behavioural pin | FIXED: pinned on the test DOM |
| F4 | LOW | The old-save pin faked the restore it named | FIXED: a real pre-record envelope |
| F5 | LOW | Twenty mutants of the change survived | FIXED: the real gaps pinned with this audit's new pins; the benign ones (an equivalent guard, a continue for a return) recorded with their lists |
| F6 | LOW | An otherwise empty tab never said "begins again" | FIXED |
| F7 | LOW | Two counts wrong: thirteen quests' rumors, not eight; Norlogod's Nest the markerless medium | FIXED, here and in the code's comments |
| F8 | LOW | The moved-pins list left three out, and three edits had no PIN MOVED mark | FIXED |
| F9 | LOW | Live records still said what the code no longer does (the ledger's %di and purse rows, Realm-Arc, Foraging's climates, NO-ASKS-AGAIN's corpus, the origin pages' open items) | FIXED, each page |
| F10 | LOW | THE FOUR HOSTS were not named for this change's seams; `?exterior`'s quest bridge reads no carried item at all | FIXED, below; `?exterior` RECORDED |
| F11 | LOW | Seven departures had no ledger row | FIXED: Port-Ledger A, THE QUEST ENGINE'S OTHER DEPARTURES |

**THE FIXES' OWN AUDIT.** The lanes that pinned these fixes found three holes in them, each fixed and pinned in
`auditqa3_share.test.js`: the share memory was written only when it held something, so a copy that left the party's
step and nothing else (the sharer's own, nobody heard; a receipt with no sender) was put back in step by a load from
its share identity - a copy ever shared now writes it (A6); an older save's received copy, no sharer named, waited at
its questline's choice on nobody - it is its holder's to answer, as after a load before (E1); and a deliberate Share of
a copy unchanged since it came was merged in full by a member holding it - it is a held word too (E4). The lifecycle
lane found four more, each fixed and pinned in `auditqa3_life.test.js`: C3's first patch (`do`) changed nothing, PcAt's
`do` arm toggling as `set` does; D2's put-away hid a guild's questor whose quest the machine dropped (an error on its
first tick, its tombstone's week out) - the clicked NPC's own body is marked and stays at its post; A3's scale caught a
start-up advance, paid it by the fallback outcome and marked the quest paid so its reward was never scaled - only gold
the script's `give pc` hands over too is the reward; and C4's article test read "breathe the" as "the".

**THE FOUR HOSTS (F10).** The share's seams - `partyHas` (E1), `keepsQuestItem` (SHELF-TWIN, B8), the receipt's `from`,
the kill credit's owner (E3), the sender's own line - are `scenes/world.js`'s alone: the party is the online page's, and
the other three hosts receive no share (their bridge's `keepsQuestItem` falls back to the pack). The stand's free
(LODGED-STAND, D3) is `scenes/worldModes.js`'s dungeon adapter, which stands `scenes/dungeonContext.js`'s quest people;
the interior adapter beside it frees none (the lanes measured the dungeons' markers only). `scenes/exterior.js`, the dev host, wires `getRandomText`
and no carried item: its quest machine reads none, as before this change.

**LEFT, AND WHY.**
- **E2's hand-in race.** A sharer who hands in before the party's "held" answers land (two seconds, more if the hub
  answers busy) is paid whole. Refusals are never sent back, so the sharer cannot count them; the answer is the only
  word it has.
- **E5.** As above.
- **C1's M0B11Y18.** A copy begun before reads one action fewer in a task (the `pc at` the change reads), and the share
  law holds a copy to the receiver's own parse: such a copy shares again once restarted.
- **D1's hidden foe.** A foe the quest hid after the save, stood again by the load's own world, stands beside the
  fresh one the mount stands (as at main); only the fresh one counts.
- **E3 across a reload.** A kill whose envelope came, then a reload, then its credit, counts twice, as at main: a learned
  kill is no save state.
- **E7's fallback.** A quest REPUTE-GATE names with no catalog row would read the envelope's faction; both gated quests
  have rows.
- **#982's messenger.** The lanes did not check whether S0000012's messenger stands where the quest says; a restart
  of a step whose placement is broken fails the same way again.
- **An old save more than a week past a refusal at the offer.** A refusal files no journal entry and its tombstone is
  gone: such a save has nothing to seed the door from.

**THE PINS.** Every fix is pinned red on the snapshot's code (each new pin run there first, and failing on its own law;
the chronicle's door, whose finding was the missing pin, passes there and holds against its mutants):
`test/systems/quest/auditqa3_story.test.js`, `auditqa3_share.test.js`, `auditqa3_life.test.js`, and the moved pins
in `questaudit3.test.js`, `questaudit3_life.test.js`, `questaudit3_acts.test.js`, `questaudit3_share.test.js`,
realm0, auditparty8, keptkill, questparty, quickloot, rvn7c_map, sd20g_delve, sharemend, disc25d_guild_share,
fb1017b_shamtrail, l10n3d_services and l10n4_hardcoded, each marked PIN MOVED (AUDIT QA3 ...).

The mutants, as the fixes left them, are 348, all dead (`node tools/mutate.mjs --jobs 4` over each list): this audit's
own `auditqa3_story.json` 22, `auditqa3_share.json` 47 and `auditqa3_life.json` 39, and QUEST-AUDIT III's lists
re-aimed to the fixed code - `questaudit3.json` 15 (the door's rungs renamed with it), `questaudit3_life.json` 76,
`questaudit3_acts.json` 60, `questaudit3_scene.json` 30 and `questaudit3_share.json` 59. Three of the last list's
survived the first campaign: two of its pins sent a copy unchanged since it came, which E4's held answer merges by
nobody, and one loaded a shelved copy through the share memory, not the read an older save takes (A6). Each pin reaches
its law again (PIN MOVED (AUDIT QA3 E4 / A6) in `questaudit3_share.test.js`).
