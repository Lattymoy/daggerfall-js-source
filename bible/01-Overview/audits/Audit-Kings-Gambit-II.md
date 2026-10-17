# AUDIT KG II (2026-10-15) - The King's Gambit, audited again

The owner, of The King's Gambit's whole work since AUDIT KG (`11-Multiplayer/Kings-Gambit.md`: KG-SET, KG3, KG4 and
KG4b, KG5, KG6 - the branch at 6e4441a72, PR #864): **"Lets do last comprehensive audit and ensure perfection"**. This
page is the findings, each with its verdict. What the audit changed is written into the record's sections as they now
stand, each marked AUDIT KG II and its id, and summed up in its section 20.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 6e4441a72 - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the tree only while the lanes read the snapshot), each told to prove a
finding - a failing repro, or the code quoted with a concrete trace, or the mod's IL - before reporting it; then the
author's own pass, every finding read again against the code before it was acted on:

| Lane | Over | How |
|---|---|---|
| A - the money and the relay | `net/gambit/gambitTable.js`, `server/src/index.js`'s `_gambit*`, `net/gambit/gambitStakes.js`, `net/gambit/gambitReceipt.js`, the escrow's arm in `server-account/src/cards.js`, `server-account/src/gambit.js`, the carriers | repros on the fake room and the account harness; 800 gold games and 209,801 steps fuzzed through the load check (0 refused); hand mutants on a private copy |
| B - the online client | `systems/gambit/gambitRemoteTable.js`, `net/online.js`, `scenes/gambitTableGame.js` online, `scenes/worldModes.js`, `scenes/world.js`, the flip | two pages and a watcher over the real relay with a socket that drops and comes back; the gold panel driven by the relay law's frames and the real stake book |
| C - the board, the offline game, the sounds | `systems/gambit/gambitTableSession.js`, the cloth, the draw, the motion, the panel, the four hosts, the sounds against DFU's `SoundClips.cs` and the mod's IL | the host's real card block with its listeners; the pad layer's real dispatch; the touch layer; the painter in headless Chromium |
| D - the UI, the words, the translations | every panel state, Enhanced Plus, plain words, 324 King's Gambit keys in the 13 whole languages, the Grandmaster's badge | the real painter in the cards lab at 390x844, 360x740, 1000x560 and 844x390 under a finger, in en, de, ru and bg; every key's placeholders, plurals and meaning |
| E - the record, the tests, the mutants | sections 15-19, Testing, the ledger and the index against the code; every KG test's claims; `tools/mutants/kgset.json` to `kg6.json` | every recorded mutant run (290, all dead); 28 hand mutants on money, rating and relay lines - each survived every KG test |
| The author | the fixes; the record's words | every lane's repro run against the fix; the translations drafted in four lanes against each language's glossary and rows |

What reached a player: nothing on main yet (the branch is unmerged and the relay and the service undeployed), but on
the branch a player could lose a staked game in one press of the pad (Start, or A) or one slide of a finger (C1-C3); a
stake could be held for good by a second Ready (B1) or lost to a Leave crossing the deal (A1); a dropped socket left a
finished game "under way" and every save refused (B2); the online board's three presses were rotated in all thirteen
whole languages (D1); and a phone watcher had no press at all (D2).

## Findings

### Lane A - the money and the relay

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | A stand carried no game number, so a Leave pressed in the deal's pause and heard just after the deal forfeited a game the player never saw - the whole pot the other's. `t.dealtAt` was written and never read (Iliac Hand's AUDIT CARDS-6 E13, not carried) | FIXED: every stand names the game its panel showed (`standUp`); the relay passes it; one naming the game before, within GAMBIT_LATE_MS (3 s) of the deal and before the seat acted (`spoke`), lets the game go - each stake home, nothing rated |
| A2 | MED | A sit on its way when the panel closed or Play a regular instead was pressed was never stood up - a ghost seat holding the cloth (Iliac Hand's E11, not carried) | FIXED: `g.sitting`; `standUp` stands from a seat or a sit on its way |
| A3 | MED | The pins held less than 18.1 and 19.1 said: the order's room, the drained room's no contest, a room that cannot sign, an empty table owing a cash-out, owed results at a hello and a sit - each mutated, each survived | PINNED (`test/net/auditkg2_relay.test.js`) |
| A4 | LOW | 19 said the escrow's bound "counts a pot's two stakes alone"; it counts every King's Gambit stake at the table over 30 days (a 200 stake cashed out at 600) | FIXED: the sentence; and a King's Gambit cash-out is no more than twice its own stake (`cashoutCards`) |
| A5 | LOW | GAMBIT_RELAY_MIN said 203 in the docs; the code is 204 | FIXED (with B14, E7) |
| A6 | LOW | Stale sentences: the relay's "the green table only", the table's "Friendly: no gold (KG6 brings it)", 5.8's LATER beside its BUILT | FIXED (5.8's LATER deleted - RETIRING A FLAG DELETES THE SENTENCE) |
| A7 | LOW | 19 said each owed result leaves its queue only once kept; one that will not mint is let go | FIXED: said |
| A8 | LOW | The load check passed a result with no seats to send to (the save threw) and a cash-out no receipt could carry (never signed, every one behind it waiting) | FIXED: the queues' ids checked as a receipt carries them |

### Lane B - the online client

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | HIGH | Ready pressed again before the relay sat the first stake asked the realm for a second; the relay refused it unspent and the client booked it sat - held for good | FIXED: one stake on its way and none past a Ready; a refusal or a new socket lets the pending id go |
| B2 | HIGH | A socket dropped mid-game: the relay gave the game away and told the room, not it; the next look's `last` was never read - the game "under way" for good, every save refused at a gold table | FIXED: the session reads the end off the table's `last`; a game the relay holds neither under way nor ended is let go |
| B3 | MED | A seat stood up by the clock read its own loss as a watcher's (" wins", no name; its own line never shown) | FIXED: a watcher is one who opened the game unseated (`g.watcher`) |
| B4 | MED | A watcher of a gold game was "staked" (the save refused) and told "You collect the pot" | FIXED: a watcher stakes nothing; its gold line the pot's (D5) |
| B5 | MED | The gold table's deal said "for fun" | FIXED |
| B6 | MED | A watcher's Stand up armed silently | FIXED: asks once |
| B7 | MED | A watched game ended with a seat free: told to sit, offered no Sit | FIXED |
| B8 | MED | Ready stayed enabled on a pick the other seat's stake had closed; the realm held gold the relay then refused | FIXED: the press says why; the realm is asked nothing |
| B9 | MED | The red table's board was never asked on approach - "before KG6" | FIXED: the guard deleted |
| B10 | LOW | A watcher's board spaced only the guest's actions | FIXED: a watcher's, both sides' |
| B11 | MED | A press made while a command was on its way was dropped in silence - Move then End turn lost the End | FIXED: held (GAMBIT_HELD_MAX, a turn's worth) and sent once the board is told, checked again on it; a refusal said |
| B12 | MED | A stand the client's gate refused was never said again (Hold'em's AUDIT CARDS-3 B4, not carried) - a ready seat dealt and clocked out of its stake | FIXED: `gambitStandsDue`, said again each frame; a sit takes it back |
| B13 | MED | A watched board outlived its table, drawn on the empty cloth and over a later game | FIXED: let go when its last seat stands; the host's chair kept |
| B14 | LOW | GAMBIT_RELAY_MIN 203 in the docs | FIXED |
| B15 | LOW | Sections 18 and 19 named two of the four hosts | FIXED (with C12, E15) |
| B16 | LOW | Every stake refusal said "your gold comes home", a lost answer too | FIXED: the realm's own words (`stakeRefusal`) |
| B17 | LOW | A new socket's look the gate refused was never asked again | FIXED |
| B18 | LOW | A watcher opening a game mid-way heard the deal's muster and StartBattle | FIXED: `midway` |

### Lane C - the board, the offline game, the sounds

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | The pad's Start (an Escape action's key) passed the cloth and stood the player up - a staked game forfeited at one press | FIXED: the host's Escape arm is the board's cancel while a battle is on |
| C2 | HIGH | The pad's A sends LeftClick's alias Mouse0 beside its own code; ActivateCenterObject's release stood the player up | FIXED: the alias is the board's while a battle is on |
| C3 | HIGH | A finger the cloth took on the stick's half became the touch layer's stick (AUDIT CARDS-6 E1 again) | FIXED: the cloth's finger held till it lifts (`cardPressHeld`) |
| C4 | MED | Under the Plus crossbar the d-pad fired its world actions, never the board's cursor | FIXED: the pad's `board` hook (world.js, exterior.js) |
| C5 | MED | More's sheet over a landscape phone's whole width threw the lean's eye 14,749 km away | FIXED: no clear screen worth fitting keeps the last; the lean never fits a clear screen of no extent |
| C6 | MED | In the beat after a forfeit the panel still read "your turn", its presses live | FIXED: `decided` - the result's title, nothing lit |
| C7 | MED | The chosen card was drawn lifted and pressed unlifted - a press on its top centimetre moved a piece behind it | FIXED |
| C8 | MED | The information box gave no hazard and only a count of foes (14.5) | FIXED: the foes by name, the cell's hazard |
| C9 | MED | A regular's night was the table's - a second table paid a full night again | FIXED: the tavern's (`cardTavernKey`) |
| C10 | MED | KG3's pad pins never ran the pad layer or the host's listeners | FIXED: `test/systems/auditkg2_board.test.js` drives them |
| C11 | LOW | 17.4 credited a forfeit's groan to the mod; the mod's forfeit is silent (`pendingSounds.Clear`, IL_098f) | FIXED: silent, the mod's |
| C12 | LOW | Section 17 named one host | FIXED |
| C13 | LOW | Under a finger a foe's card snapped to the player's piece beside it | FIXED: a foe's card is that foe; the mat, a wall or one's own card snaps |
| C14 | LOW | The port toggled a piece off by its own press and kept it on a foe out of range; the mod (IL 0x4620) re-selects and lets go | FIXED: the mod's |

### Lane D - the UI, the words, the translations

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | Sit at the board, Play a regular instead and Not ready rotated one key along in all thirteen whole languages | FIXED; pinned per language |
| D2 | HIGH | A phone watcher's strip had no press at all | FIXED: its presses and More in the strip |
| D3 | HIGH | The phone strip clipped its chips - the turn clock, last, never seen | FIXED: the clock first, the actions; the rest in More's sheet |
| D4 | MED | A watcher read "your turn", "yours", "you lose" | FIXED: by the players' names |
| D5 | MED | A watcher told of its own gold | FIXED: "{name} takes the pot" |
| D6, D7, D8, D13 | MED | (B4, B6, B5, B16) | FIXED there |
| D9 | MED | The guide and the words were the regulars' online; the board's own terms undefined | FIXED: another player and the table's gold; Ready, Turn clock, Pot, Season board, Rated game, Grandmaster (the title) |
| D10 | MED | "signed-in accounts" (a guest is signed in, never rated); a foe with no account dropped in silence | FIXED: registered; `onFoeGuest` said |
| D11 | MED | The season's cap said "today" | FIXED: the service says which cap |
| D12 | MED | The Grandmaster's purple 18 from the Protector's | FIXED: #b438d2, more than 30 from every title, pinned |
| D14 | MED | The stake picks twelve screens down a phone's army | FIXED: first |
| D15 | MED | 14.9's acceptance never run for the online panels | FIXED in CI: the coat sweep paints the seats, the gold picks, the season board, a watcher and an online result. The Chromium probe's online scenes are not added (the probe is no CI step; lane D's own probe script measured them for this audit, from its scratch) |
| D16 | MED | Relay words with no words of their own fell to "That cannot be done now."; a command's refusal lost its piece | FIXED |
| D17 | LOW | Auto-fill, Clear, a pick while ready and Staking said nothing when pressed | FIXED |
| D18 | LOW | Seat and rank rows wore the pressable look; the board pushed the result down; its press never said Hide | FIXED |
| D19 | LOW | "Another game is being played at this table." through the text core on this panel, English on Hold'em's and Iliac Hand's | RECORDED: those two panels are English throughout (the hard-coded debt `tools/l10nHardcoded.mjs` lists), so each panel is one language; the relay naming which game holds the table NOT TAKEN - the sentence is true of all three |
| D20 | LOW | Typed counts and no plurals | FIXED |
| D21 | LOW | "reach" for a blow | FIXED: range |
| D22 | LOW | Glossary slips: ko 골드, it puntata, bg пота, two fr rows | FIXED; the drafts found de Topf, da puljen, ru "{n} золотых" and 17 fr rows without the no-break space - FIXED too |
| D23 | LOW | The features note and the credits said regulars only; 18 claimed every language | FIXED |

### Lane E - the record, the tests, the mutants

| # | Sev | Finding | Verdict |
|---|---|---|---|
| E1 | HIGH | A broken source at the gold table (a blow, a turn's end, the deal) was unguarded; kg5_table's branch never ran | PINNED; the branch runs |
| E2, E3, E10, E13 | HIGH-MED | (A3 (b), (d), (e); A4) | PINNED or FIXED there |
| E4 | HIGH | The order's room, a Ready in a layer, a room with no key, a Ready refused after its spend | PINNED |
| E5 | HIGH | The season cap, the rating written only while both stand, a kept game off the board, the #1 recounted | PINNED (`test/net/gambit/auditkg2_season.test.js`) |
| E6 | MED | 18.1 said kg5.json 49; it is 48 (KG6 retired KG5-R-gold-table) | FIXED |
| E7, E15, E18 | MED-LOW | (B14, B15, A6) | FIXED there |
| E8 | MED | Testing's kg5_relay row: "the gold table refused", world203 | FIXED |
| E9 | MED | A sit in a layer; one seat an account | PINNED |
| E11 | MED | A result from the room just left | PINNED |
| E12 | MED | "a Ready at its longest fits" pinned a 93-character Ready | PINNED: the longest lawful Ready |
| E14 | MED | The gold result's words | PINNED |
| E16 | LOW | The ledger's KG-SET row said world201 | FIXED: world203 |
| E17 | LOW | The index stopped at section 14 | FIXED |
| E19 | LOW | Stale comments | FIXED |
| E20 | LOW | GAMBIT_QUEUE_MAX is the load's bound; the `gowed:` sweep unguarded | FIXED: said; PINNED |

Found beside: `tools/mutants/csa_together.json`'s CSAL-pad-bare-dpad survives on main's own head as on this branch -
every default d-pad direction has a hold, so the bare branch's tap-on-press is never reached at the helm in its test.
Come Sail Away's, not this game's: reported to the owner, the record left as main wrote it.

## Pinned

`test/net/auditkg2_relay.test.js` (12), `test/net/auditkg2_online.test.js` (11), `test/systems/auditkg2_board.test.js` (8),
`test/net/iliac/auditkg2_panel.test.js` (6), `test/net/gambit/auditkg2_season.test.js` (3). PINS MOVED: `kg3_host` (the press beside the
lifted card, the forfeit's silence), `kg3_panel` (range; the online states swept), `kg5_client` (the held press; the
watcher's More), `kg5_table` (the broken source's branch runs), `kg6_season` (the board's words; the badge's colour),
`cards2b_seated` (the Escape arm a block). Mutants: `tools/mutants/auditkg2.json`, 73, all dead (two survived their
first run - the board's `rated = 1` on the player's own side and the #1's recount; the pins now read the player's own
standing and a third player passing the #1 without playing them); seventeen records re-aimed by content
(`auditcards6_e`, `cards2b`, `csa_together`, `kg3`, `kg4`, `kg5`, `kg6`), all dead but CSAL-pad-bare-dpad above.
