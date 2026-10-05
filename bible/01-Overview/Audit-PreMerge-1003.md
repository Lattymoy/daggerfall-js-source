# AUDIT PRE-MERGE 1003 - PR 545 read before it merges, 2026-10-03

Mac: *"I want to do a comprehensive audit over it and make sure its perfect"*, of PR 545 (`ccr-c4cfa1c5-dvhdve`) as it
stood green at `79c17a776`: the arena branch merged into main - WD3 (Beautiful Villages and Beautiful Cities, the
world-data door, the housing promise), ARENA1-ARENA3, ARENA-FIX, ARENA4, ARENA4b and ARENA5 (`11-Multiplayer/Arena.md`),
with main merged in twice on the way (#541, #546). Eight lenses read it, the branch against `origin/main` (`7305011de`),
each over the frozen tree (the fixes were made in worktrees of their own until the last lens had reported, then brought
together), each reproducing what it reported with the repo's own code:

- **S** the relay and the account service - the arena's trust boundary, its claims, its SQL, its versions and its deploy;
- **B** the offline bout engine, the book and the save - every clock a bout is read by, every coin it moves;
- **O** the client's online half against the real Room - each of ARENA4b's eleven items over the wire;
- **W** the arena in the world and on screen - the instance, its ground, its pictures, its crowd, its build;
- **WD** WD3 - the packs, the door, the pins and the housing promise, online and off;
- **U** the window and the HUD on real Chromium - a phone, a short screen, the keyboard, a screen reader, forced colours;
- **M** the merges - every line the branch differs from main by, and every test it changed;
- **D** the record - every claim, count and cite of the arc's pages and patch notes against the code.

The lenses reported 73 findings - 68 once those two lenses shared are written once, nine of them high. Every finding below was checked against the code before it was fixed, pinned by a test that FAILED on the unfixed tree
for the finding's reason (`test/audit1003_server.test.js` 11, `_bouts` 9, `_online` 10, `_world` 7, `_wd` 8, `_ui` 17,
`_record` 2; the merge's `MIGRATION-PREFIX` in `test/accountdeploy.test.js`) and mutation-proven:
`tools/mutants/audit1003_server.json` 30, `audit1003_bouts.json` 33, `audit1003_online.json` 46, `audit1003_world.json`
30, `audit1003_wd.json` 26, `audit1003_ui.json` 46, `audit1003_record.json` 3 - all 214 dead. Each fix carries an
`AUDIT PRE-MERGE 1003 <ID>` comment. An ID two lenses found is written once, with both names.

## Fixed

**The relay and the account service** (`server/src/index.js`, `src/net/arenaBrain.js`, `src/net/arenaLaw.js`,
`server-account/src/arena.js`, `letters.js`, `board.js`; the pins in `test/audit1003_server.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | med | ONE SOCKET HELD EVERY SEAT. `joinBout` counted a seat at every watcher's `in`, and the room asked whether the socket already sat only after: one socket's sixty `in`s filled the hour's exhibition, its close gave back one - 59 phantom seats, and every other screen told `seats full` (the exhibition blank to the realm). And `_boutFan`/`_boutFanState` sent to every hello'd socket, so a watcher refused a seat heard the whole bout anyway. | A socket already in the stands asking again is answered with the bout and takes no second seat; the bout's words go to its sand and its stands alone (`b.af \|\| b.asp`). |
| S2 | med | THE "SIGNED" LEVEL WAS THE CLIENT'S. `cl` is the realm tile's summary `level`, which the client writes itself (the realm's create, every checkpoint's summary) and nothing reads against the save; `ladderVitality` held only the old token's claim to the tier's cap, so a token signing a thousand fought the Pit at 2,000 health (the claim it replaced was held to 265). ARENA4b's record said a forged sixty did not reach the Pit. | Either level is held to the tier's cap (`ladderLevelCap`); the record says what the signature proves (whose the level is, not that it is true). |
| S3, O8 | med | A RATED BOUT'S HEALTH WAS THE QUEUE WORD'S. The hall queued `lv: m.lv ?? a.lv` - the client's word over the token's - and `pvpVitality` read it: `lv: 999`, held at sixty, fought at 420 against an honest 302 (the honest client sent its character level, not the Renown level the law names). | The hall queues the token's signed `lv` alone (the law's "300 + 2 x Renown level"; Seats-Arc 6.1); a word still carrying one is not refused. |
| S4, O6 | med | ANY KEPT BOUT ID WAS A RECEIPT'S `claimed`. `claimLadder` answered `claimed` for any row holding the receipt's bout id - whoever's, whatever tier, step or result - and `claimArena` then paid Renown off the receipt's own tier: a ladder room's id is the client's, the relay forgets a finished bout after ARENA_KEEP_MS and opens another under it, and the hall's list shows every live one. A reused id paid a win's Renown out of the climb's order, up to the Grand Champion's 2,115, and the client paid its held purse on `claimed`. | `claimed` only where the kept row is the caller's own, of the receipt's tier, step and result; any other answers the new `reused`, with no Renown - and the client says so and pays no purse. |
| S5, O2 | low | A FIGHTER BACK AFTER THE HEALERS WAS TOLD `no bout`. The room keeps a finished bout's receipts ten minutes "for a reconnect", but `joinBout` refuses once it is `done` (~9 s after the end): a win whose socket blinked at the last blow, a forfeit and a casual bout never heard their end. | Any finished room answers its own fighter, back inside the keep, with the bout's end as theirs and the receipt it holds for them (a casual bout's none). |
| S6 | low | THE RATING WAS READ, THEN WRITTEN. Two players' bouts of one account claimed at once both rated off the same "before" - one change lost (an account racing its own loss against a win erased the loss). | The bout's row is written only while both accounts' last ratings are still those read; else read again, four tries, then `busy` (503 - the client keeps the receipt). |
| S7 | low | THE OFFER'S ID WAS THE BOUT'S ROOM. Both of a pair hear the offer's id before either says yes; one stood a ladder bout in `arena:b<offer id>`, the hall's open was refused, both were told `busy` and paired again - for ever. | The bout's room is minted at the go (`arenaId()`), never the offer's id. |
| S8 | low | THE ARENA'S HONOURS WERE WORN NOWHERE BUT THE CARD. A Grand Champion's letters and notices showed no title, the season's first no laurel (`letters.js`, `board.js` read their badges without ARENA_HONOUR_PATHS). | `withArenaHonoursAll` lays them on the rows the inbox and the board read. |

**The bout engine and the book** (`src/scenes/arenaBouts.js`, `src/systems/arenaBook.js`, `src/scenes/arenaGate.js`,
`src/systems/arenaHerald.js`, `src/systems/arenaText.js`; the pins in `test/audit1003_bouts.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | high | A PAUSE WON THE GRAND CHAMPION'S BOUT. The law's clock was `performance.now()`; the hosts hand `frame` a nought while paused and the floor's host draws no foe under a window, so the opponent stood frozen while the three minutes, the stall and the yield rolls ran on: one blow, the inventory open three minutes, the judges' verdict - the purse (9,900), the ladder's step, the title and its plaque. A hidden tab did the same. | The law's clock for this screen's own bouts is the world's: real time less every moment beyond the `dt` the host handed in (both hosts already hand `gamePaused() ? 0 : dt`); the law, the doors' hooks and the recording read it; a relay's bout and a replay keep real time. |
| B2 | high | ONE BLOW FROM THE STANDS DECIDED AN EXHIBITION. The damage door warns first (the Herald's "Hold!"), then subtracts and floors: the bout kept the blow, the fighter fell, and the verdict settled the book - the 10-to-1 long shot backed and the favourite knocked down paid 11,000, for one warning. | A player's blow on an exhibition fighter is made good first (`hurtFoe`), as a blow before the word is; the warning and the watch still come. |
| B3 | med | A LOSING BET WAS WALKED AWAY FROM. A wager settles by the verdict seen here; a bout dismissed (a door, the stair, a journey, 260 m) told nothing, and the house's seeded record settled it at the hour's end. The Herald's Watch dismissed the city's live bout and fought the hour again, both fighters whole. | Not as proposed - the judges' card as it stood would turn the exploit round (leave the moment one's fighter leads). A local exhibition left after its word with no verdict told is the house's stake whichever fighter led (its result, where one already stands); the book keeps every verdict seen here, wagered or not, and takes no wager on an hour seen; the Herald's Watch never fights an hour again past its word or seen, and says why. The Rules page says so. |
| B4 | med | THE SHORTEST PRICE WAS ABOVE FAIR. `priceFor` laid 1 to 5 however short the shaded price fell, so a favourite above ~0.82 paid more than fair: +9.8% over three game years by backing them blind (most of it the beast tier). | Below the shortest rung no price is laid (`null` - "no price"): the stall offers only priced sides and says why, the card shows it; Arena.md's "1 to 5 the shortest" kept. |
| B5 | med | THE SPARE LAPSED AT THE YIELD. The spare that holds the player at 1 was given only in the fight: from a yield or a fall to the healers (and the rest of a Grand Melee after a fall) an arrow in flight, a spell or a poison round killed the player on the sand. | Held from the word to `done`; `boutFell` itself refuses a bout that is over or a fighter already out. |
| B6, W3 | low | A bout dismissed while its crowd's pictures loaded left the batches already made undestroyed (up to ~100 VAOs and 200 buffers a time). | They are destroyed where the loop returns. |

**The online half** (`src/scenes/arenaOnline.js`, `src/net/arenaBrain.js`, `src/scenes/arenaGate.js`,
`src/scenes/arenaBouts.js`, `src/scenes/world.js`, `src/systems/onlineHomes.js`; the pins in
`test/audit1003_online.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | high | EVERY RELAY BOUT UNDID ITS OWN HEAL. The law's 'heal' heals nobody on the relay, but its `hp` word rode with it carrying the end's health: the client healed ("The arena's healers see to your wounds"), then flashed the difference as a blow, voiced it, and set the player back to 1. | The relay sets every fighter whole at 'heal'; the client's belt: in 'heal' or 'done' an `hp` word raises health, never lowers it (the last blow's own `hp`, after 'end', still lands). |
| O2 | high | A FIGHTER WHO MISSED THE END WAS HELD IN THE RING. On the relay's `no` the client only said the line: the mirror stood in its last phase, the ring's clamp (14 m, the gate at 18.6) kept the player from the gate, and every online door said "You are in a bout" - for ever. | `no bout` or void for the bout this screen stands in ends it (the relay half is S5). |
| O3 | high | THE BOOK TOOK BETS ON A HOUR WHOSE WINNER THIS SCREEN KNEW. The relay's exhibition has its verdict 12-29 s into its hour (22 the median); the book stayed open 100 s and closed only on this screen's mirror, which goes home 25 s after 'done' - and the verdict already heard settled the wager: +1,500 gold a game hour. | Online the book shuts on what this screen heard of the hour (`exhibitionBegun`: any `st`/`ev` at or past the fight). |
| O4 | med | A RECONNECT RAN THE ARENA OFFLINE. `live()` asked the presence socket's status this frame: every door and the floor's instance set 'connecting', and for those frames online wagers settled by the house's record, the Herald offered the save's ladder (fought and paid locally) and the city stood the seeded exhibition, after which the relay's was never watched that hour. | Online is the session's fact - a session, the last welcome's `arenaOk`, the seat held - never the socket's this frame; a door that needs the socket says "a moment" (`hallWait`) instead of falling back to the offline law. |
| O5 | med | A QUEUED PLAYER WAS DROPPED AT A RECONNECT. Nothing ticked the arena's own links (the hall, the city's exhibition, the verdict ask), so a dropped hall never came back or beat; the relay leaves a closed socket's queue, and the client showed "Seeking" for ever. | `arenaOnline.tick()` ticks all three; the last queue word (its casual and banner) is said again when the hall's link comes back queued or offered. |
| O7 | med | Cheer and Boo on the hour's exhibition sent nothing (ARENA4b item 5): `startExhibitionRelay` replaced `send` with `{}`, yet the HUD drew both presses. | A cheer door is handed through - the floor's bout socket, the city's once its `in` is seated; with no door the presses are not drawn. |
| O9 | low | A TAB THAT LOST THE SEAT KEPT THE ARENA. `leaveSeat` left the hall, city and verdict links standing: the tab stayed queued, was shown the offer, and on the other tab's yes closed its window and entered the floor offline (the one-seat rule). | `arenaOnline.leaveAll()` from `leaveSeat`; `of` and `go` are ignored while not live. |
| O10 | low | A displaced home's move was marked read (`arenaSeen`) when its save was handed over, not when it landed: a refused PUT kept the full old scene in the record with the move read - the case ARENA4b's order exists for. | `onlineCheckpointLanded` returns the PUT's answer; `arenaSeen` only after it is ok. |

**The arena in the world** (`src/world/arenaFloor.js`, `src/world/arenaModel.js`, `src/world/arenaCity.js`,
`src/world/customModels.js`, `src/scenes/dungeonContext.js`, `src/scenes/dataPipeline.js`, `src/scenes/world.js`,
`src/scenes/worldModes.js`, `src/scenes/dungeon.js`, `src/scenes/arenaBouts.js`; the pins in
`test/audit1003_world.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1 | high | THE FLOOR'S INSTANCE HAD NO GROUND OUTSIDE THE BOWL. The city's courtyard at the foot of the gate's flight is the city's terrain; the made level held only ARENADAG's models over a collider of `-Infinity`. A watcher (no ring clamp) walked the terrace round and down the gate's flight into nothing (-136 m, falling) - and the instance refuses a save. The passage to the market and the corridor under the east terrace were floorless too. | `ARENA_GROUND_MODEL` (864103): the cell's 16 x 16 tiles of the city's own paving (302:46) at the city's ground, each laid as the city lays it, placed last in the made block (no record moves); collider-only walls across the passage's mouth and round the cell's edge, and a third way out at the passage's mouth where the Herald stands in the city. |
| W2 | med | Online, the hour's exhibition watched in the instance hung no banners (`floorBanners` knew `relay` and `exhibition`, not `relayEx`) while its crowd's halves were washed red and blue. | The relay's hour hangs the Red against the Blue, as offline. |
| W4 | low | In the instance the climate-free colosseum was re-skinned by the dungeon's texture table (122 and 124 to 23 - the passages under the tiers, the fighters' gates; 274 triangles). | `levelModelRemap`: a climate-free model keeps `NO_CLIMATE_REMAP` in both dungeon hosts and the PERF5 merge, as the city's hosts keep it. |
| W5 | low | The crowd stood on the ring's parapet (8 m over the sand), fence tops and the collider-only stair ramps: 106 of 1,853 seats, 22 of a sold-out 420. | A seat stands where the ground a stride each way, along and across, is level with it: 1,576 seats, none over a ramp. |
| W6 | low | The colosseum's first build sealed its seams in one go (~0.5 s) inside the world host's streaming pixel build, which otherwise yields every few ms (PERF7). | `sealArenaSeamsSliced` breathes between ~660 units through `customModelBuilt` and `getGpuMesh(id, breathe)`; the bytes are the same. |
| W7 | low | A GUARD. A crown city's castle entrance is the lowest dungeon door of its pixel, and the undercroft's stair is one now: lower than the castle's, the siege's Throne, its camp, the Palace square's banner, the Royal Tourney and both castle banners would stand at the arena (the door heights are ARCH3D's - not measured here). | `castleEntranceOf` skips the arena block's doors; the player's doors are untouched. |
| W8 | low | Two comments said a walk back restarts the city's exhibition; it runs once an hour (`_arenaHourRun`, pinned "once an hour"). | Said as it is. |

**WD3** (`server-account/src/halls.js`, `server-account/src/townLayout.js`, `server-account/src/homes.js`,
`server-account/src/index.js`, `src/net/accountClient.js`, `src/net/guildBook.js`, `src/systems/onlineHomes.js`,
`src/scenes/worldModes.js`, `src/systems/quest/place.js`; the pins in `test/audit1003_wd.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| WD1 | high | A GUILD'S HALL TURNED ITS TOWN CLASSIC. A hall is a row of `homes`, and was written with no layout (NULL, Daggerfall's own) - no check, no 426 for an old build: bought in a Villages town it told every client to stand the town classic (where its key names a stranger's building - its decor, yard, banners and plaque there), refused the town's later homes 409, and a hall bought after a town's home flipped it once that home was sold. | `buyHall` takes `layout` as a home's claim does - a bad stamp `bad-home`, none 426, another layout 409 naming the town's, before the hour's claims count it - and writes it with the claim's own SQL (`townLayout.js`, no cycle through homes.js); the client says it (`homeClaimLayout`), and the door's buy has `buyHomeAt`'s gates. |
| WD2 | med | A QUEST SITE CHOSEN AGAIN KEPT THE OLD BUILDING'S MARKER. `reseatMovedSite` carried `selectedMarker` - its flatPosition in the old interior's frame - so the quest's person or thing stood at the old building's coordinates inside the new one, and the old site's numbered markers went with what was placed "at marker N". | `_carryAssignments`: the assignments move onto the new building's own markers (the same type, else the other; marker N's to N, else the selected one); a building with no marker keeps the record. |
| WD3 | low | The READMEs and the Mod Registry said the packs name a classic piece by its sha256; they name it by `$c` (its block's index and path, checked by name in `classicNames`) - the sha256 is the builder's key. | Said so. |
| WD4, D8 | low | Beautiful-Towns and Arena.md named the layout's migration 0046 (guild halls). | Its number (0073, M1). |

**The window and the HUD** (`src/ui/arenaDoor.js`, `src/ui/arenaWindow.js`, `src/ui/arenaHud.js`,
`src/ui/enhancedPlusStyle.js`, `src/ui/hudFoeTarget.js`, `src/systems/arenaBoard.js`, `src/systems/arenaText.js`,
`src/scenes/world.js`, `src/scenes/exterior.js`; the pins in `test/audit1003_ui.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| U1 | high | ONLINE, THE WINDOW NEVER DREW ITSELF. The door's `tick` did nothing: the board, the hall opening, the queue, an offer and its clock showed only after an unrelated press (the Herald said a match was found; no Accept stood), and with nothing pressed the hall's link closed under the open window after a minute. | The door asks the window once a second and it redraws when its model changed; reading the model keeps the hall wanted. |
| U2 | med | Every press inside the window rebuilt it and the keyboard fell to the page (AUDIT 28 B11, AUDIT 31 U1, AUDIT 32 P3). | `repaintKeepingScroll(..., { focus: true })`. |
| U3 | med | The versus plate lay over the target frame (a bout's fighter struck raises it) and, at scale 2, the compass: `.arena-hud` never had `--hud-scale`. | The scale copied off `.hud`; the plate steps under the foe frame by the travel panel's sums; a bout's own fighter raises no target frame. |
| U4 | med | The versus bar covered the quest card on every phone and up to 1024 wide, and the party list under ~970. | `.arena-hud.on` while it stands; the card and the list step aside under it at the widths that meet. |
| U5 | med | On a phone the boards cut names to 4-5 letters (the fixed table read its widths off a header row that had none). | The header carries the classes; how a bout ended wraps. |
| U6 | med | On a landscape phone the HUD reached the crosshair (a Grand Melee 58-253 of 360). | Under 520 tall: no "vs", no bark, one line for stamina and crowd, the hint on the plate (157 of 360). |
| U7 | low | A banner was told by colour alone (the two read 1.03:1 in grey; the pennants silent to a screen reader). | Named pennants; a visible Red/Blue chip on the exhibition's card. |
| U8 | low | F10 did not hide the arena's HUD. | `!hudRenderEnabled()` in both hosts. |
| U9 | low | Under forced colours every chosen state and the won pips vanished. | A forced-colors block. |
| U10 | low | "Accept within 1 seconds."; at nought Accept still stood. | "1 second"; at nought "The offer has lapsed." and no Accept. |
| U11 | low | The banners board stood under Rank and Fighter heads. | Its own: Season. |
| U12 | low | The purses chip read as the purse. | "Purses won: N gold". |
| U13 | low | On a phone two tabs stood off the bar, unseen. | The tabs wrap under 520. |
| U14 | low | An unnamed page, a list of buttons, two controls named Wager, three named "Watch the replay". | Named and linked; listed tiers; distinct names. |
| U15 | low | A keyboard's Cheer dropped the focus (the press `disabled`). | `aria-disabled`. |

**The merges** (`server-account/src/service.js`, `server-account/wrangler.toml`, `server-account/migrations/`,
`test/accountdeploy.test.js`, twelve version pins, `bible/01-Overview/Port-Status-2026-09-02.md`,
`test/enhancedAI.test.js`, `bible/09-Testing/Testing.md`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| M1 | high | MAIN TOOK THE ARENA'S NUMBERS. #547 merged (and deployed) `acct71` and migrations `0071_silver_ways`/`0072_motherlodes`; the branch claimed acct71 and 0071-0073. The merge would have been silent: `wrangler.toml` auto-merged to the same word, the migrations' names differ, every pin says acct71, and nothing held a prefix to one migration. | A third main merge: acct72, `0073_home_layout`, `0074_arena`, `0075_arena4b`, every reference with them; MIGRATION-PREFIX holds the prefixes unique and one apart. |
| M2 | low | The branch's cite passes moved four struck measurements of `exterior.js` in Port-Status (the page keeps them). | Main's numbers back. |
| M3, D7 | low | `dataPipeline.js:366` named for patchSeams (it is :303). | Corrected. |
| M4 | low | The service's version note listed "acct47: WD3" (main's acct47 is GUILD1d's). | Said as it was. |

**The record** (`bible/11-Multiplayer/Arena.md`, `bible/03-World/Beautiful-Towns.md`, `bible/02-Formats/World-Data-Patches.md`,
`bible/01-Overview/Port-Ledger.md`, `vendor/daggerfall-arena/README.md`, `src/characters/enemyMotor.js`, the patch notes;
the pin in `test/audit1003_record.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | med | EVERY FIGHTER WHO WALKED IN FOUGHT AT A WALK. The comment said the walk's pace was the walk's; `_pace` went back only at the motor's own arrival (0.35 m), and the bout ends every walk in itself (0.6 m, the walk's limit) with `walkGoal = null` - every exhibition and ladder fighter fought its bout at WALK_PACE (7.35 m in 2 s against 10.24). | The pace is the walk's own step's argument; nothing else reads it. |
| D2 | med | The patch notes promised replays from the Herald and the window online; they are offline alone. | Said so. |
| D3 | low | "until 10 at night" - the last bout is called at nine. | Corrected. |
| D4 | low | Beautiful-Towns said the 274 TVRNAS00/06 taverns held houses; the port's curation keeps Daggerfall's own tavern. | Corrected. |
| D5 | low | Arena.md said 24 of arena1's and 41 of arenafix's records were false survivors without ARENA2; one is (`ARENAFIX-RAMPS-UNREGISTERED`). | Measured and said. |
| D6 | low | "thirteen `arena4b_*.json` lists" - fourteen. | Corrected. |
| D9 | low | The switch's hint was misquoted (it says the game's start, not a load). | Quoted. |
| D10 | low | "every block ... checked against the author's sha256" - one in eight (AUDIT WD3 B4). | Corrected. |
| D11 | low | The vendor README said 25 pieces; there are 18. | Corrected, and pinned against `Models/864102.json`. |
| D12 | low | Two Ledger rows still said unbuilt what ARENA4b and ARENA5 built. | `[BUILT at ...]`. |
| D13 | low | "Smaller Dungeons may trim the undercroft" stood open; ARENA5 closed it. | `[FIXED at ARENA5]`. |
| D14 | low | 339 MB of DFU JSON against the READMEs' 154 + 285. | The READMEs' sum, said to be theirs and unmeasured here. |
| D15 | low | The page's header pointed the online records at Online-Arc, which holds none. | At its own records. |
| D16 | low | `climbwalk.sh` was cited as evidence and is not in the tree. | Said to be a scratch script. |
| D17 | low | "A quest-giver you met indoors is still where you left them" - online, one met before the update is not mended. | The exception said. |
| D18 | low | AUDIT WD3's 38 finding IDs were cited everywhere and recorded nowhere. | `01-Overview/Audit-WD3.md`, from its six commits. |

## Found at the integration

- **Main moved twice more.** #547 (SILVER-WAYS and PROF2b, M1 above) and #548 (REL6): patch notes come off the pull
  request, and the suite fails on a patch-notes file in the tree. The arena's and the town mods' two files left with
  main's 147; their words, with D2, D3 and D17's corrections, go on the pull request's description.
- **S7 x O1.** O1's pin opened the offer's id as the bout's room; S7 mints the room at the go. The pin follows the go.
- **The relay's row.** S and O both changed the relay's law; world155 (still undeployed) is hashed once over both.
- **TACT2's archer pin (main's, #540) was flaky.** On the PR's own CI it read the ranged tokens at one instant - 1 where
  2 stood: a holder hands its token on and another takes it the next frame, so the count dips for a frame by design. The
  same 10 of 400 seeded runs fail on main, on #545's head and here (~2.5%). The pin now holds the law on every frame (never
  more than two out, both taken, the third holding its fire while they are); `tact2.json`'s 25 mutants still die.
- **The cites.** Each fix lane moved the cites its own lines shifted; the lanes were joined with citeMerge, and the
  CD4-gated cites citeMerge holds on struck rows were set by citedrift's own table, each on the text it names.

## Not changed, and why

- **SEAT1c's seat titles** are missing from letters and notices as the arena's were (S8) - pre-existing on main.
- **A fighter's pose words** still reach every hello'd socket of a bout's room, a refused watcher's too; without the
  `st` words they cannot follow the bout. And one account may take a seat a socket - there is no seat cap an account.
- **`claimPlayers`' `claimed`** does not ask that the kept row name the receipt's two accounts: a players' receipt's
  id is the hall's own, minted at the go (S7), so none can stand under another.
- **A note's author** sees no honours on their own copy as it is pinned; others reading the board do (S8).
- **`live()` after a token is refused** stays true until the next room change (O4).
- **A relay outage** shows no exhibition online and holds a wager for the relay's verdict - the designed online law,
  not the old fallback (O4).
- **A relay fighter struck on the city's sand** still drops locally; the verdict, and so the book, is the relay's.
- **The Watch press and both sides** still stand in the window and are refused with their reason, as the window refuses.
- **The colosseum's pieces** are cached without the undercroft's if the floor's instance were entered before any city
  pixel built 864102 - it is reached only from the city, which builds it first.
- **W5's seat test** costs four times the rays at a bout's start; the seats are not cached a stage, since the city stage's ground streams in and a cache taken early would keep its holes.
- **Three `auditrealm.json` records** (`AUDIT-REALM-L1F3-the-price-refunded`, `-the-pieces-client-cost`, and
  `-the-sale-client-share`) survive on the PR's head as on this tree - not this audit's files' fault; left to their own.
- **The vendored mods' permission records** (`vendor/beautiful-villages/README.md`, `vendor/beautiful-cities/README.md`)
  still hold Mac's placeholder; the credits send players there. **Mac's to fill.**

## Pre-existing on main

- The kit's brass presses on the stone read 4.41-4.44:1 (the arena's Wager, Fight and chosen side inherit them).
- The gate's boss bar (`ui/gateBossBar.js`) has U3's geometry and U8's F10 gap.
- No house window moves the focus into itself on open; none is `aria-modal`.
- Forced colours are kept by one rule house-wide (`.qtrack`).
- `auditsilver_service` B1 (main's, SILVER-WAYS) fails about one run in ten - two concurrent claims race to one batch.

## What this audit could not see

A running game: there is no ARENA2 in the tree, so the world was driven headless and the window and HUD in Chromium
over the real modules, not a booted world. The new paving (W1) and the banners' red (42557) are unseen on screen; the
castle's and the undercroft's door heights (W7) are ARCH3D's. Nothing online ran against a deployed relay or account
service; S6's race was made with injected latency on node:sqlite, not D1's own interleaving.

## The deploy

The relay is world155 (undeployed; its row hashed again in place over S's and O's law). The account service is acct72,
past main's SILVER-WAYS (acct71), with migrations 0073-0075 past main's 0072 (M1). The relay deploys first (the
account service waits for it to serve world155 before minting `cl`, the arena's titles and the laurel).

## The second pass - AUDIT PRE-MERGE 1003b (2026-10-03)

The owner, before the push: *"We're going to do one last deep audit on everything before we push this. It needs to be
perfection."* What the first pass had never read: ARENA6 (private sessions, `11-Multiplayer/Arena.md` - built after
it, for a streamer's tournament the same day), the merge of main's #551 (FIELD BUGS 2026-10-03) and #555 (REL7), and the
branch's commits after `5c8aa2852`. The tree was frozen at `bfe0893b7` (the full suite's two reds on the merged tree
fixed first: Mod-Registry's vendor count, taken from main in the merge, and DE2's pitch count, which met ARENA6's
`standOnArenaMark`), and six lenses read it, each in a worktree of its own at that commit, each reproducing what it
reported with the repo's own code:

- **R** the relay and the law of a session - authority, the door, seats, storage and the alarm, the bout, the wire, load;
- **C** the client's state machine and the hosts' seams - every way into a session and out of one, the races;
- **U** the card in the window - every state, the keyboard (the game's keys against the code box: SOUND, no host acts on a
  typed key), a screen reader, a phone, forced colours, measured in Chromium;
- **S** the stream itself - a tournament run on the real Room with 82 real client screens, eight bouts, drops, a removal,
  the cap, a wake, every invariant checked each beat;
- **M** the merges - #551/#555 re-run hunk by hunk, its semantics against the arena, the versions and the deploy;
- **D** the record and the patch notes - every claim against the code.

Beside them the regression sweep: every arena, audit, TACT2 and WD3 mutant list on the frozen tree - 1,037 dead, the 19
alive the 19 that need the player's ARENA2 data, each `why` naming it (18 of `arena2triage.json`, and
`ARENAFIX-RAMPS-UNREGISTERED`). The lenses reported 63 findings, 54 once the ones two lenses shared are written once;
four were high. Each was checked against the code, pinned by a test that FAILED on the frozen tree for the finding's
reason (`test/audit1003b_relay.test.js` 11, `_client` 10, `_ui` 5; `arena6_private`'s wire test and TACT2's archer pin
strengthened), and mutation-proven (`tools/mutants/audit1003b.json` 50, all dead; `arena6.json` 62, all dead - 31 of them
the mutants its titles named that no record held, D1; `tact2.json` 26). Each fix carries an `AUDIT PRE-MERGE 1003b <ID>`
comment.

**The relay** (`server/src/index.js`, `src/net/arenaBrain.js`, `src/net/arenaLaw.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1, S3 | high | A MEMBER'S JOIN WAS A MEGAPHONE. Every `ps join` - a guest in the stands, at the arena gate's sixteen words a second - wrote the session and fanned the whole of it to every member: at 62 members 9,920 frames and 19 MB in ten seconds from one socket, 18-36 ms of the room's time a word (half of it `_sessionHere` listing the room per member per recipient). Related: a seated socket's repeated `in` forced a write each. | A join that changes nothing is answered to its asker alone, unwritten; a member's changing joins are taken `ARENA_PRIVATE_JOIN_HZ` a second (two at once), past it answered alone; `_sessionHere` lists the room once; a repeated seat writes nothing. |
| R2 | high | TWELVE TOKENLESS HELLOS SHUT THE SESSION'S DOOR. A floor room spent its hello gate before the token (AUDIT-SEATS R3's fault, fixed for battle rooms alone): anyone with the code read off the stream held every newcomer, and a fighter whose socket blinked - a forfeit at `ARENA_GONE_MS` - out with 1013. | A floor room's gate is spent after the token, by account (`_battleHelloGate`): a member or a fighter waits on itself alone, anyone else on the stands' bucket. |
| R8, S1 | high | "NO RESULT" FOR A BOUT THE RESULTS KEPT. End bout (no result), or a fighter removed, pressed in the verdict - a host's natural reaction to a disputed finish - told everyone the bout was voided while the session's results kept the win. | Only a bout with no result is voided; after it the host's press is answered `has result`, and the card says so before it is pressed. |
| R3, S8 | med | A FIGHTER REMOVED STOOD ON THE SAND. The kick cleared its `af` before the clear, which says `leave` for `af` sockets alone. | Its body is said gone to every screen first. |
| R4, S8 | med | THE FLOOR WAS ANYONE'S WHO HAD THE CODE. A stranger in the room, or a member removed who kept its socket, was drawn the fighters (their `join`, look and every pose) and the welcome's roster, and its room chat reached every member (and theirs it). | A session's floor is its members': no fighter, pose, roster or room chat to or from a non-member; a socket made a member is shown the sand then (`_sessionShow`). |
| R5 | med | A RECONNECT TOOK A SECOND SEAT. A socket replaced by its own reconnect loses its id before its close, so its seat was never freed and the new socket's `in` took another - a full session's sixty, gone a blip at a time. | The replaced socket's place (seat, sand) is the new one's. |
| R6, S2 | med | A ROOM WOKEN WHOSE FIRST WORD WAS A CLOSE TOLD EVERYONE NO BOUT STOOD - `_arenaLeave` fanned the session before reading the bout; both fighters' screens stood themselves back in the stands while the relay fought on. | The bout is read first. |
| S4 | med | A REMOVAL WAS AN ACCOUNT'S, AND A GUEST IS ONE PRESS AWAY - a removed guest was back in seconds as a new guest, and nothing kept a stream's trolls out. | The host's **Lock session** (`ps lock`): no newcomer while locked (`locked`), a member coming back always let in; `lo` on the wire. |
| R7, S10 | low | THE KEEP WAS SPENT BEFORE IT BEGAN - counted from the result, the healers' seven seconds outran its five; the record said "past the healers". | Counted from the bout's first finished beat (`doneAt`). |
| S9 | low | BOTH FIGHTERS GONE TOGETHER HANDED THE BLUE A FORFEIT WIN (the Red counted out first). | Both players of a players' bout gone is no contest: void, `no contest`, nothing kept (a ladder's one player gone is still its forfeit). |

**The client** (`src/scenes/arenaOnline.js`, `arenaBouts.js`, `worldModes.js`, `world.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | med | THE FIGHTER WHO CAME WAS LEFT ON THE SAND when its opponent never did (a tab in the background) - the void let the mirror go, and the next `pss` found no bout of its to send back. | A session's bout let go sends its fighter to the stands. |
| C2 | med | A BOUT ENDED BEFORE ITS HEALERS LEFT ITS FIGHTER HURT (a void, a removal, a close, the seat lost) - and nobody rests on the floor. | The healers' heal (`heal`, world.js's `arenaHeal`) whenever a session's bout of mine is let go. |
| C3 | med | A SCREEN IN A SESSION'S ROOM WITH NO SESSION (its seat taken back after another tab's; a floor slower than `BOUT_ARRIVE_MS`) was listed here, picked, and deaf - the bout void, the other fighter stranded. | The room's session is adopted; never a room left on purpose. |
| C4 | med | A SESSION FIGHTER'S OWN SIDE IN ITS REALM BANNER'S COLOUR (Alva of the Blue Banner, picked Red, saw both sides blue), the realm's laurel favouring a side. | A session's sides are fixed (`fixed`): no realm banner, no laurel. |
| C5, U2 | med | A FIGHTER CALLED STAYED UNDER THE WINDOW - the host who picked themselves pressed Start inside it, paused through the call and the count. | Out of the window before the mark. |
| C6, S5 | med | A NEWCOMER REFUSED (`session full`) STOOD ON IN THE FLOOR holding a session it was not in. | `session full` and `locked` end it here: said, and out of the floor. |
| C7 | med (traced) | THE FLOOR'S WAY OUT LANDED NOWHERE away from Daggerfall: before the Herald, who stands only where the colosseum is streamed in - a session joined in Wayrest came out at the floor's own coordinates read in Wayrest's frame. | The floor remembers where it was entered (`arenaFrom`) and lands there when no Herald stands. Unseen in a booted world (no ARENA2 here). |
| C8 | low | A HOST WHO STEPPED OUT LOST THE CODE - Host drew a new one while the old session held everyone. | The card offers **Rejoin session <code>**. |
| S6 | low | THE HERALD CALLED EVERY PLAYERS' BOUT "A RATED BOUT" - a session's and the casual queue's. | A casual bout is called as one. |

**The card** (`src/systems/arenaBoard.js`, `src/ui/arenaWindow.js`, `src/ui/enhancedPlusStyle.js`, `src/systems/arenaText.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| U1 | high | THE HOST'S MEMBER LIST SHOWED NO NAMES at 721 px and wider - the card in one 300 px cell, the three presses taking every pixel (48 of 62 names 0 px wide at 1280). | The card spans the page; a name keeps twelve characters. Measured whole at 768-1920 px on both skins. |
| U3, U8 | med | THE SESSION'S WORDS WENT TO THE CHAT ALONE - under the window's scrim, outside a screen reader's hearing; `no bout` was dropped; a wrong code lost the code and its reason with the window. | The session's last word stands on the card, a wrong code's too. |
| U4 | med | THE KEYBOARD JUMPED ROWS. A picked member's press was dropped, so a redraw put the focus on the next member's: Enter on "Red - Brann", then Enter again, picked the host; Remove's focus fell to the next member; Start's to the page. | Every row's presses stand still (Make Red, Make Blue, Remove), one that cannot be pressed shut by `aria-disabled` with its reason, each keyed by `data-focus`. |
| U6 | low | IN A SESSION ITS CARD WAS LAST, 2.6 screens down on a phone. | First while in one. |
| U7 | low | WRONG REASONS: queued, Host and Join said "You are in a bout"; in a session so did Find a match and Watch; a fighter's chip said "In the stands". | Each said as what it is (`privQueued`, `privIn`, "On the sand"). |
| U9, S7 | low | RESULTS IN THE RELAY'S WORDS ("- yield"), A DRAW AS "NO RESULT" (the void's words), "against - (Blue)", presses named as their chips. | "by a yield", "drew - the judges could not part them", "not picked yet", Make Red / Make Blue. |
| U10 | low | YOUR ROW BY COLOUR ALONE; A PICKED MEMBER'S PENNANT NAMED FOR THE SIDE; THE SPELLED CODE A NAME ON A PARAGRAPH. | A You chip; the member's own banner on its pennant; the code spelled in a span a reader reads. |
| U11 | low | THE CODE BOX'S ONLY LABEL ITS PLACEHOLDER (clipped), NO CAPITALS ASKED OF A PHONE, A NINE-CHARACTER BOX, ENTER MID-COMPOSITION JOINING. | A visible label, `autocapitalize` / `enterkeyhint` / `autocorrect`, sixteen characters, the composition's Enter its own. |

**The merges** (f1f56f5b7, and after)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| M2 | low | #551 INSET THE QUEST CARD INTO RETRO MODE'S PICTURE, AND U4'S 1100 PX READ THE WINDOW'S - at 1366x768 in 4:3 the card overlapped the versus bar 36x54 px. | The picture's width read (`data-ui-narrow`, enhancedHud.js `wearUiPillar`). |
| M3 | low | TACT2'S RELAXED PIN (aaf5423fb) COULD NOT CATCH TOKENS NEVER TAKEN AGAIN - an archer that shot once and never took a token survived 20 runs of 20. | Six seconds, the last three frames' best both tokens; the mutant in `tact2.json`. |
| M1 | low | TWO CITES THE MERGE LEFT WRONG in Field-Bugs-2026-09-24 (`online.js`, `worldModes.js`), in a paragraph already stale on both sides. | The paragraph's every cite re-aimed. |
| M4, D7, D8, D9, D20 | low | THE PR DESCRIPTION: "the last three merges" (four), "number-only conflicts in cites" (two were counts), a stale Verification, a deploy line without ARENA6. | Rewritten. |

**The record** (lens D): D1 (above); D2 the arena6 test's "the result listed" (it voids); D3 `ui/arenaWindow.js` claimed
tested and mounted nowhere (now `test/audit1003b_ui.test.js`); D4 Home.md's index; D5/C9 the ARENA6 record's four hosts;
D6 arenaGate's "from anywhere online"; D10-D13 "six-letter", the refusal words, "picked" for "called", the keep's order;
D14-D15 a JSDoc's `busy`, tick's stranded doc; D16-D19 the patch notes (the alphabet "read aloud", the box's name, the
host's way back, a session's bouts not on the list); D21 the Ledger's ARENA6 (written into the arena's row, so no Ledger
line moves). And acct72's note names main's HALL-GOLD, which landed under acct71 unbumped (M, pre-existing).

**Not changed, and why**
- **Tab closes the Arena window** (U5) - PX28b's house rule (Mac: "Tab should also minimize any open UI menus"); a
  keyboard host moves between the session's presses only inside one Tab press. The owner's call.
- **A blow's damage is the fighter's own claim**, capped by the weapon and material it claims (PVP-REF's law, ARENA4): the
  health is equal, a modified client can strike at the cap. Pre-existing; recorded in the ARENA6 record.
- **One account's two tabs in the stands take two seats** (R5's second half) - ONE-SEAT keeps two tabs online apart;
  recorded.
- **Older stale cites** the merge carried unchanged (153 suspected by M's trace - `Audit-59.md:26` and the like - and
  D's `dungeonContext.js:3368`, `exterior.js:4274`): wrong on both sides before the merge, not covered by citedrift;
  each needs `citeShift` from its sentence's own commit. Not this pass's.

**What it could not see.** A booted world (no ARENA2): C7's landing and the session's marks are traced and pinned by
source, not walked; nothing ran against a deployed relay.

**The deploy.** Unchanged in shape: world155 (its row hashed again in place over this pass's relay law), acct72 (its note
now naming HALL-GOLD), migrations 0073-0075; one push to main deploys the relay, then the account service, then the site.
