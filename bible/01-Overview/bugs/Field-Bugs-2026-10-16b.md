# FIELD BUGS 2026-10-16b - the Discord's bug reports of 2026-10-15, each fixed at its root

The bug-report threads of 2026-10-15 from the Discord, handed over as screenshots. Read on the code as it stands at
main's `7e0424e0` (main took `Field-Bugs-2026-10-16.md` for HORSE-LIT meanwhile, so this record is `-16b` and its pins
`fb1016b_*`).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "I respeced yesterday and have a timer on my 50 lvl smithing, however, when I reached level 100, I can not choose level 100 perk" | the Professions page greyed every card of a track while a paid change waited at either rank; the service already took a first pick (and the merge's free change) before its one-change-at-a-time refusal | fixed (FIRST-PICK) |
| 2 | "I reloaded my game near the arena ... I've done all 40 fights already for this season, so I hit fight, and it reset my rank, and when I look at the season it doesn't have a number" | on the online lane before the relay's first welcome every arena door ran the offline law: the Herald offered Fight off the save's ladder, the bout and its purse were this screen's, the window drew the save's season ("Season of 3E 406") and roster - the account's forty wins untouched | fixed (ARENA-WAIT) |
| 3 | "I paid 2 x 600 gold today, and even though it said +5 reputation, my reputation didn't go up at all ... why I still have a penalty" (the "Possible bug: Repeated ..." thread, after FINE-MENDS); "It didn't work for me either" | the +5 was the law's and it held; a charge costs two names - the law's and half of it off the region's People, spread to the kingdom (the Standing page's Kingdoms row) and read by every commoner - and a sentence gives back both, but the watch's fine and a temple's penance mended the law's alone | fixed (FINE-PEOPLE) |
| 4 | "Shipyard formatting is cooked" - "The text here may need a bit of work, as you can see!" | a shipyard row's acts track was `auto`: grid grew it to every press and the name box on one line before the words' track had a pixel, so a ship's words stood a word a line | fixed (YARD-ROWS) |
| 5 | "items not repairing at all with 'repairs objects'" ... "my weapon WILL repair but no other worn items are repairing with repair objects" | a tick mended a pool weapon the classic Dagger's share (32) and every other piece DFU's point - a steel cuirass's 6,144 a point a tick, its % still for an hour while the blade's climbed | fixed (MEND-ARMOUR) |
| 6 | "turning horse care off completely hides my other horses" | the upkeep's model listed horses only under a care tier, and the page drew the other horses and "Ride this one" only under one: Off (and the classic skin) the ridden horse alone | fixed (HORSE-CARE-OFF) |
| 7 | "I've been using a 3x disintegrate as my main spell lately ... I believe it bypasses the kill/spare on revenants. And it seems it does this to other players' revenants, too" | a Disintegrate is a whole blow, and both damage doors passed every whole blow over a revenant's last stand, will and kneel; a party member's blow reaches the owner as a kill (`z`), so anyone's Disintegrate closed anyone's revenant, record and all, its owner never asked | fixed (RVN-OWNERS-CHOICE) |
| 8 | "market stalls all shifted into the ground/walls"; "at least the lawn decoration owns" | TEMPLE-STEPS set the stall's box and scale right but kept a guessed shape inside it: a counter 0.75 m high under goods laid for 1.04 m, the awning's edge at 1.84 m, a bench where 20 of 30 stall-keepers stood, the second mesh given a counter over its goods; and its new origins moved every yard's saved stall 2 m back into its wall and grew saved boulders 2-8x | fixed (STALL-SHAPE) |
| 9 | "you steal something from the shelf and can sell it back to an NPC, and he'll put the item back on the shelf again, and it just goes in a circle"; "when you're sent to prison, all the stolen items stay with you" | nothing marked a piece stolen: a sale landed the very record back on the shelf (T2), where a shut shop's shelf - no roll - gave it up again that night; and no court exit touched an item | fixed (STOLEN-GOODS) |
| 10 | "Friend invivible and randomly popping up"; "Partied players popping in and out randomly after leaving tombs at graveyard ... also partied players inside tombs are invisible for a time" | every place change is a new relay room whose socket asked for its identity token only as it opened - a mint on the wire (seconds) between the door and the hello, paid going in past the reuse minute and always coming out (the cell outside spent by the token that left it); a hello sent tokenless because its token came late waited out its backoff after the token arrived | fixed (DOOR-TOKEN) |
| 11 | "If you just sit near the wall between the shelves, when you fail to steal something, the guard will come running, but they simply can't reach you because they run into the wall instead of going through the door" | the watch called into a building walked the classic motor - straight at the player, along the first wall - and only the dungeon baked a navmesh; a partition held them for the whole crime | fixed (INDOOR-WATCH) |
| 12 | "I was testing with a friend, he dies and I cast resurrection. It works for a moment then he disappears and remains dead" | online the death door wrote a Bloodline fall at once - the death, the remains, the Succession waiting and the realm's tombstone - so the Resurrect raised a body the house had already buried, and the slow step opened "The line ends" over it a second later | fixed (REZ-BLOODLINE; its audit: the realm holds the death for the Resurrect, never the page) |
| 13 | "graveyard loot on headstones are able to be looted by others, objects in tombs are un lootable" | a headstone's search lived in its searcher's game alone; underground a coffin's word locked everyone in the room, strangers too ("You have already searched here."); a floor coffin was out of SEARCH_REACH measured from the eye; a PARTY-LOOT pile another build's word made unreadable stood unborn for good | fixed (GRAVE-PARTY) |

## FIRST-PICK: a change on its way gates a change, never a rank's first choice (1)

`src/ui/professions/profPages.js` drawProfessionsPage, the specialisation cards.

THE REPORT. A paid change at Smithing 50 waiting out its week ("In effect from Wed, 21 Oct 2026"); Smithing reached
100, and none of the four cards at 100 could be chosen. A second player confirmed it.

FOUND. The page disabled a card on `!!tr.respec` - the track's one pending change, whatever its rank - so every card of
the track, at both ranks, greyed while any change waited. The service's rule is narrower: `chooseSpec`
(`server-account/src/professions.js`) answers a rank's FREE FIRST CHOICE ("only while the rank has none") and the merge's
free change (CRAFT3, `free_respec`) before it refuses a second paid change with `prof-respec-pending` ("one change at a
time", `06-Systems/Professions-Arc.md`). Driven on the real Worker: Goldsmith at 50, a paid change to Weaponsmith, XP to
100 - the page greyed all eight cards; the Worker, asked for Masterwright at 100 from nothing, answered ok. The free
change's "Change: free, once" was hidden by the same test.

CHANGED: a card waits only when its rank already holds a choice, a change is on its way, and the change it would make
is not the merge's free one - the service's own order. The price line follows the same test. Nothing the service does
changes.

THE FOUR HOSTS: none - the Professions page is a window every host opens alike. Pinned by `test/net/fb1016b_firstpick.test.js`
(2, the first end to end over the real Worker, client door, profBook and page); `tools/mutants/fb1016b_firstpick.json` (5,
all dead).

What the reporter is owed: with a change on its way at 50, the perks at 100 can be chosen the day you reach it.

## ARENA-WAIT: on the online lane, before the relay's word, the arena waits (2)

`src/net/online.js` the session's `arenaHeard`; `src/scenes/arena/arenaOnline.js` waiting (the audit: `shut`, `shutText`),
model, act, fightLadder, watchExhibition, team; `src/scenes/arena/arenaGate.js` online, settle (the audit: heraldChoice's line,
windowAct's Fight, the recruiter's and the Keeper's words); `src/systems/arena/arenaBoard.js` arenaBoard's no-board arm,
pendingBoard (the audit: ladderPageWaiting, ladderCardWaiting); `src/ui/arena/arenaWindow.js` renderLadder (the audit);
`src/scenes/world.js` the arena online's `lane` and `nowS`, arenaHeraldAct's Fight and Watch, arenaFrame.

THE REPORT. A character who had fought all forty of the season's bouts reloaded beside the gate. The Herald offered
Fight; the bout reset the rank, and the window's season "doesn't have a number" (the screenshot: "Season of 3E 406",
"4 won, 0 lost", Tier 2 Bloodied, Pit Fighter).

FOUND. The forty wins were the account's and nothing touched them. `live()` - the arena online - is a session whose
last welcome said the relay opens the arena's rooms (`arenaOk`; AUDIT PRE-MERGE 1003 O4 made it sticky so a door's
reconnect never reads as offline). After a load there is no session until the player stands in the world, then a
token and a socket round trip before the first welcome - and every arena door read that `live()` false as OFFLINE,
ARENA3's law: the Herald's Fight off the save's ladder (`arenaGate.js` heraldChoice - the online climb never writes
`arenaLadder`, by design), `world.js` arenaHeraldAct's local bout and its purse, and the window's no-board arm drew the
save's header - the season the offline one, the game year ("Season of 3E 406, day N of 360"), where the realm's is
numbered ("Season 1, day 19 of 56") - its title, its record and the seeded roster. Driven on the real modules: no
session, or a session unwelcomed, and the Herald offered "Your next bout: The Pit - bout 1 of 3"; four local wins made
the save's ladder the window's Pit Fighter 4-0, 350 gold paid here. The welcome then showed the Grand Champion again,
but the save kept its offline climb.

CHANGED:

- **The relay's word, kept.** `OnlineSession.arenaHeard` - a primary welcome has said `arenaOk`, sticky as it is.
- **Waiting.** `createArenaOnline`'s `waiting()`: on the online lane (`lane`, world.js's `onlineOn` - a realm character)
  with no session, or one no welcome has answered. While it waits the arena is neither the account's nor the save's:
  Fight says the climb is on its way (`climbWait`), a challenge and the hour's Watch say the hall is a moment away
  (`hallWait`), a banner says so too; the window's model is the online one with no board and the hall shut.
  `arenaGate.js` takes its online arm while waiting, so the Herald offers no Fight (the arm that already waited for the
  board), the window's Fight is refused, the plaques stand bare, and the book settles nothing by the house's record
  until the relay's verdicts can be asked (O4's law, now for the first word too). world.js's Fight, the city's sand and
  the Herald's Watch take the online arm; the sand stands nothing of this screen's own.
- **The window before the board.** The no-board arm (online, waiting or the board still asked) draws the realm's season
  by the clock (`arenaSeasonOf` over the host's relay clock), no title, record, banner or purse of the save's in the
  header; the banners' and every board's names "not in yet" (`rollWait`); the Ladder page and the Bouts page's ladder
  card nobody's (AUDIT A1, below: they were the save's).
- **Not waiting:** a relay that said no (an older one - offline, as ever). An offline character's arena is unchanged.
  (A seat given up was "not waiting" here - offline, the save's arena; AUDIT A4 below shuts it.)

THE FOUR HOSTS: world.js - WIRED (the arena online is its alone: the lane, the clock, Fight, Watch and the city's
sand, on lines it already had - bootWorld stands at its ceiling); exterior.js's gate has no arena online (the fixed
city plays offline) - unchanged; worldModes.js and dungeonContext.js read the gate's `hall` and `plaques`, which wait
with it. Pinned by `test/systems/arena/fb1016b_arenawait.test.js` (4, over the real OnlineSession's welcome and close, the arena
online, the gate and the window; the audit's two the last); `tools/mutants/fb1016b_arenawait.json` (41, all dead - 16
of the 18 re-aimed by content at the audit, two retired with the laws they pinned - the seat given up offline, the next
bout withheld - which A4's and A1's own hold now; 25 the audit's). PINS MOVED: `arena4b_mirror.test.js` and `audit1003_online.test.js`
read world.js's arenaFrame and Watch branches with the wait's arm; mutants ARENA4b-MIR-GATE-HOUSE-ONLINE, -WORLD-CITY,
-WORLD-WATCH and ARENA4B-PURSES-BEFORE-BOARD re-aimed by content, all dead. At the audit: `audit1003_online.test.js`
O9 (a seat given up is shut on the lane, in the seat's words - it was offline) and O4 (`live()` false for a seat lost,
read as "not the arena online", no longer "offline"); mutants ARENA4B-WINDOW-FIGHT-UNKNOWN, ARENA4B-CLIMB-WAIT-CARD and
ARENA4B-RECORDS-SAVE-BEFORE-BOARD re-aimed by content, dead.

FLAGGED, not taken: the save's own ladder is not healed - it still holds whatever an offline climb last left, which the
character sheet's arena line reads (`enhancedCharSheet.js` arenaSheetLine). Whether the save should mirror the account's
climb is a design call; no arena door reads it online any more.

What the reporter is owed: your Grand Champion title and your forty wins were never lost - the rank and the season you
saw were the offline arena's, shown for the seconds before the server answered. The arena now waits for the server
instead.

AUDIT (2026-10-16). Read cold over the real modules (the auditor's `ladder_card.mjs`, `terminal.mjs`); every finding
fixed:

- **A1 (major): half the screenshot survived.** The record said the no-board arm drew "no title, record, banner or purse
  of the save's" - false: the Ladder page was still `ladderPage(o)`, the SAVE's ladder (its tiers cleared and current,
  their win pips, the champions beaten, its titles - "Tier 2, Bloodied", "Pit Fighter"), and the Bouts page's ladder
  card the save's next bout and its purse, Fight merely shut. Now, in that arm (waiting, or live with the board still
  asked) the Ladder page is the law's ten tiers with nobody's climb on them (`arenaBoard.js` ladderPageWaiting: every tier
  `waiting` - "Not loaded" - no pip, no champion beaten, no next bout, no title, `current` null, the line the climb's
  wait), and the card a wait card (ladderCardWaiting: no bout named, no opponents, no purse, Fight shut with the line).
  `ui/arena/arenaWindow.js` renderLadder draws that shape: with no current tier the first is shown (the climb's own taken up
  once it comes, a pick kept a pick), and no "Your titles" block - "No titles yet." is a claim about a climb not in.
- **A3 (minor): "Still loading" for ever.** A session that can never be welcomed (terminal: a hello refused for good
  with CLOSE_POLICY, no relay address) kept `waiting()` true and said "Still loading. Try again in a moment." until a door
  joined again. Its doors stay shut and say what it is (`arenaText.js` online.noServer: "The server cannot be reached.
  The arena opens again once you are back online."); a door that joins again clears `terminal`, and the wait's words
  come back.
- **A4 (design, the owner's decision): on the online lane the offline arena NEVER runs** - but for one word: a relay that
  said it opens no arena room (`arenaHeard`, `arenaOk` false), the session neither superseded nor terminal. A seat given
  up (O9's superseded tab) was offline - the save's ladder with its local purses (up to 47,950 gold over 40 bouts, paid
  into the realm's save) and the bookmaker settling an open online wager by the house's seeded result. Its doors are shut
  now and say the seat is elsewhere in ONE-SEAT's own words (`net/oneSeat.js` SEAT_NOTICE, with "Play online here").
  `arenaOnline.js` `shut()` names why ('seat', 'gone', 'wait') and `shutText(line)` says it - Fight, the challenge,
  Watch, a banner, the Herald, the window's Fight, the recruiter, the Keeper, and every page of the window (`model`'s
  `away` and `shutWhy`: the Ladder page's line, the Team page, the boards, the Records page, the hour's Watch on its
  card); the book settles nothing until the relay's verdicts can be asked. `11-Multiplayer/Arena.md` ARENA-WAIT names
  the change.

FLAGGED, not taken: a session that was LIVE (its relay said `arenaOk`) and then went terminal stays the arena online
(O4's sticky word) - its board and climb are the account service's, so the window and the Herald read true, and the
next door's join (net/online.js `join`) clears `terminal`.

## FINE-PEOPLE: a fine and a penance give the People's half back too (3)

`src/systems/court.js` raisePeopleForAnswer; `src/systems/standing.js` settleChallenge, doPenance.

THE REPORT. The FINE-MENDS thread again, a day after it shipped: two fines of 600 paid, the HUD said +5 each time,
"my reputation didn't go up at all", and "I still have a penalty". A second player: "It didn't work for me either".

FOUND. The +5 held: the law's number (`legalRep`, client-held, saved whole - no service touches it) rose five a fine,
to the -10 line, as FINE-MENDS shipped. But a crime costs two names (`court.js` lowerRepForCrime,
`PlayerEntity.cs:2294-2298`): the law's loss, and half of it off the region's People faction, spread up to the kingdom it
hangs from - which the Standing page lists apart, under Kingdoms ("Daggerfall"), and which every commoner's reaction reads
(`talk.js` getReactionToPlayer). A sentence served gives back both (raiseRepForSentence, REP2: "the legal loss, and half
of it off the region's People"); the watch's fine and a temple's penance - the port's own answers short of the court -
mended the law's alone. Driven on the real watch: a murder and an assault (the law -28, the People and the kingdom -14),
two fines - the law -18, the People and the kingdom still -14. And the fine's price moves in 40-gold steps (eight points
of standing), so -27 and -22 are both asked 600: two fines of the same sum read as nothing moved.

CHANGED: an answer short of the court gives the People half the points it gave the law (`raisePeopleForAnswer`: the
People's half of what the law was owed before the answer less its half of what it is owed after - AUDIT below; it was
`trunc(points / 2)` a step), spread as the charge spread, never past 0 - it mends a charge and buys no favour. The fine
(`settleChallenge`) and the penance (`doPenance`) both call it; the HUD's law line is unchanged. No store (a host that
never ran chargen), nothing - the charge's own silence. `06-Systems/Standing-Arc.md` and Port-Ledger's REP row say it.

THE FOUR HOSTS: none - the watch is `standingHost.js`'s (both open-world hosts wire it) and the penance the temple's
window; the law is one module. Pinned by `test/systems/fb1016b_finepeople.test.js` (4, the first through the real watch's stop);
`tools/mutants/fb1016b_finepeople.json` (11, all dead).

AUDIT (2026-10-16). Read cold, one finding, fixed:
- S5 - THE HALVES NEVER ADDED UP. Each answer's People half was truncated alone - `trunc(5 / 2)`, two a step - so the
  steps never summed to the charge's own half: answered by every fine the watch takes and every penance the temple
  offers, one Theft left the People and the kingdom -1 for good (the law whole, the penance no longer offered), a Breaking
  and Entering -1, two Thefts -2, the reporter's Murder and Assault -3 - where a sentence served gives them back. The claim
  above, "truncated as the charge's was", was the bug: the charge truncates once, a run of answers truncated every time.
  The step is now the People's half of what the law was owed before the answer less its half of what it is owed after
  (`court.js` peoplesHalfOwed, the charge's own `trunc(loss / 2)` read off the law's standing, which the answer has already
  written), so the steps telescope to the half of the whole debt - +3 then +2 for the reporter's two fines from -28 -
  still capped at what the People are owed, and never for law points above 0. Pinned by the four cases through the real
  fine and penance (each now whole, as a served lesser sentence is), a Curfew town's doubled law, and the clamps; the
  FINE-PEOPLE-rounded-up mutant re-aimed by content at the new half, with four new ones (each step truncated alone, the
  half owed above 0, the law's standing misread, another region's) - 11, all dead.

NOT TAKEN (Mac's to decide): the fine's 40-gold steps and the -10 line together make a deep standing a run of same-price
fines; the stop reads the law's number alone, never the People's.

What the reporter is owed: the +5 you paid for was real - your standing with the law rose each time. What did not move
was your name with the people of the kingdom, which the same crimes cost and only a prison sentence gave back. A fine or
a penance now mends that too.

## YARD-ROWS: a ship's words stand beside her name, her presses under them (4)

`src/ui/shipyardWindow.js` SHIPYARD_CSS's `.dfyard-row` and `.dfyard-fleetrow`, fleetPage.

THE REPORT. The shipyard's Your fleet page: a ship's words ("Laid up at Aldwall Rock - she is brought round to any port
you call her at. Worth 3,546 gold - the shipmaster offers 431 gold") a word a line down a sliver of the window.

FOUND. A shipyard row is a grid of three tracks - her name, her words, her presses - and the presses' track was `auto`.
Grid layout grows an auto track to its content's max-content before the fr tracks are given anything, and a fleet
row's presses are four buttons and a name box (an input's default 20 characters): in the 760 px window they took every
free pixel, the name track stood at its 110 px floor and the words' at `minmax(0, ...)`'s zero. Measured in Chromium
(the window mounted on the reporter's fleet): the words 0-38 px wide, a row 400-700 px tall. The other pages' rows have
one press and never met it; a Crew Hall recruit's swap picker did, at 600 px. No design record redesigns this window;
the Holdings card (`ui/fleetPage.js` shipCard) draws the same ship with her presses on a line under her words.

CHANGED: the presses' track is `fit-content(40%)` - never wider than its share - and a fleet row is two tracks with
her presses a line of their own under her name and words, the Holdings card's shape. The phone's one column stands as
it was. Measured again on the real window: the words 439 px at 1440 and 800, 321 at 600, the rows 104-172 px; the
Refits and Crew pages' words 146-385 px; nothing sideways.

THE FOUR HOSTS: none - the shipyard is a window every host opens alike. Pinned by `test/ui/fb1016b_yardrows.test.js` (3: the
CSS's law, the mounted fleet page, the audit's picker); `tools/mutants/fb1016b_yardrows.json` (5, all dead). PROBE (no
suite row - it needs a browser): `node tools/shipyardWindowProbe.mjs` measures every row's words on the Fleet, Refits and
Crew pages at five widths.

AUDIT (2026-10-16, the branch read cold): THE SWAP PICKER. A fit-content track never stands under its content's least
width, and a `<select>`'s least is its longest option: a recruit's swap picker naming a long hand ("in place of Charlotte
Montclair, First Mate") held the presses' track past its 40% at 561-640 px. The picker among the presses is capped at
12em (min-width 0, its option cut with an ellipsis); a hand's own post keeps its track's width (a cap there would have
narrowed it from 259 px to 144 for nothing). The probe now names that hand and measures 561 px as well: a recruit's
words 166-255 px, nothing sideways. Pinned by the third test; YARD-ROWS-AUDIT-the-picker-uncapped dead.

What the reporter is owed: the shipyard's fleet page reads as a page again.

## MEND-ARMOUR: every worn piece mends its own share a tick, not the weapon alone (5)

`src/systems/enchantments.js` repairsObjectsMend, MEND_SHARE_OF, the RepairsObjects row's magicRound.

THE REPORT. "items not repairing at all with 'repairs objects'" ... "my weapon WILL repair but no other worn items are
repairing with repair objects."

FOUND. The tick ran and picked the right piece; it mended too little to see. MEND-WORN (2026-10-07) gave a weapon on
WEAPON-POOL's pool the classic Dagger's share - 32 a tick, its point of its 50 on the 1,600 (`POOL_WEAPON_MEND`,
`mendsOnPool`) - and every other piece kept DFU's point (`CONDITION_AMOUNT`, `RepairsObjects.cs:26`) against conditions
in the thousands (`itemTemplates.js` mintCondition: an iron cuirass 4,096, steel 6,144, Daedric 32,768); Port-Ledger's
MEND-WORN row recorded "armour keeps the point" on purpose, as DFU's. Driven on the real pump (runMagicRoundsFor) over
the real producers: a steel longsword at 50%, seven pieces of steel plate at 70%, a ring of Repairs Objects worn - after
720 rounds (about an hour of play) the blade stood at 71% and every piece of plate at 70% (the cuirass 4,301 to 4,337);
with a shirt and breeches under the plate the kit wanted 8,408 ticks to be whole, about 47 real hours.

CHANGED (the owner: "Stop trying to match DFU"): one law, `repairsObjectsMend` - a tick mends a fiftieth of the piece's
own condition, rounded, never under DFU's point. That is MEND-WORN's yardstick (the classic Dagger's point of its 50,
Mac's "Weapons as a classic dagger"), now every piece's: a weapon of any material, armour, clothing (a magic item's or an
artifact's uses keep the point - the AUDIT below) - every share climbs 2% a tick (an iron weapon 32, a Daedric one 256, an iron cuirass 82, steel 123,
Daedric 655, a shirt 2, Armbands the floor's 1). Unchanged: which piece the tick takes (worn first, least share first,
MEND-TIERS' tiers), the cadence, the player alone, one piece a tick. The same kit is whole in 164 ticks, about 55 real
minutes. `05-Combat/Physical-Combat-Overhaul.md` MEND-WORN and Port-Ledger A's MEND-WORN row say so.

THE FOUR HOSTS: none changed - the law runs in the one round pump (`systems/worldTick.js` runMagicRoundsFor, then
enchantmentMagicRound) that every host's ticker feeds: exterior.js, world.js and worldModes.js through `scenes/shared.js`
createPlayerTicker, dungeonContext.js through tickPlayerMinutes. Pinned by `test/systems/fb1016b_mendarmour.test.js` (3, the
first the report's kit through the pump, tick by tick); `tools/mutants/fb1016b_mendarmour.json` (7, all dead). PINS
MOVED: `mend_worn.test.js` (the rate; a magic blade's and an artifact's uses DFU's point, the audit's; the Wall of Daggerfall
+41 and the helm +51; the pump's cuirass +820), `fb1014_mendstarve.test.js` and `fb1015_mendtiers.test.js` (a worn piece
mended whole in a tick or two where it was held), `enchantments.test.js` E1 (a 100-point sword +2); `tools/mutants/
mend_worn.json`'s six records on the old law re-aimed by content, 15 of 15 dead.

AUDIT (2026-10-16, the branch read cold): USES KEEP THE POINT. The round runs through every rest, fast travel and prison
stay as well as play (`worldTick.js`'s catch-up, MAX_CATCHUP_ROUNDS), and a MAGIC.DEF item's or an artifact's condition is
its uses (loot.js): at a fiftieth, one 8-hour rest gave a spent Cast When Used piece all 1,000 uses back - 100 casts,
where DFU's point gives 12. A charge is not wear: `repairsObjectsMend` gives uses the point, as before MEND-ARMOUR, and
every other piece its fiftieth (an enchanted loot piece whose condition is wear, never uses, keeps the share). Pinned by
the slice's third test (a MAGIC.DEF piece through an 8-hour rest of the pump: 120 uses; the cuirass beside it its
fiftieth); MEND-WORN-uses-on-the-share and -artifact-on-the-share (re-aimed) and MEND-ARMOUR-AUDIT-uses-on-the-share
dead.

What the reporter is owed: your armour was being repaired - one point of its thousands every twenty seconds, so its %
never moved. Every worn piece now mends 2% of itself a tick, as your weapon did: a battered steel kit is whole in under
an hour.

## HORSE-CARE-OFF: Off, every horse owned keeps its Stable card and "Ride this one" (6)

`src/systems/upkeep/upkeepRuntime.js` createUpkeep's model; `src/ui/holdingsPages.js` drawStablePage, rideButton, steedLines.

THE REPORT. "turning horse care off completely hides my other horses".

FOUND. The Stable page draws the ridden horse's card from the pack and every other horse's card from the upkeep's model.
The model built its list of horses only `if (care)`, the page's loop read `care?.horseCare` too, and "Ride this one"
lived inside the care lines (steedLines). So Off (`horseCareRules` null) - and on the classic skin, where the accessor
answers null whatever the pref - the page drew the ridden horse alone. The ride itself was never the tier's
(stableProviderFor routes 'ride' to the upkeep "the mod on or off", chooseRiddenHorse ungated): the other horses were
owned and rideable, with no door to them. Driven on the real upkeep and page with three horses: on Boons and Hard, three
cards and two "Ride this one"; Off, one card and none.

CHANGED: the model lists every horse on every tier (its place, whether ridden, its name, its look), the care's fields
beside them only where horse care rules; the page draws every other horse's card on every tier ("Another horse of
yours") with "Ride this one" (`rideButton`, one home for both paths); Off and on the classic skin the card shows the
choice alone - no hunger, bond, breath, stats, oats or apple. `06-Systems/Horse-Care.md` (The Stable page) says so.

THE FOUR HOSTS: world.js and exterior.js build the upkeep over the one accessor and hand the page its provider
(stableProviderFor) - WIRED as they stood, no host line moved; worldModes.js and dungeonContext.js stand no transport (a
building or a dungeon puts the rider on foot) and set no provider. Pinned by `test/systems/horse/fb1016b_horsecareoff.test.js` (2, over
the real accessor and pref, the real upkeep, the hosts' provider seam and the page); `tools/mutants/
fb1016b_horsecareoff.json` (7, all dead).

What the reporter is owed: your other horses were never gone, only their cards. With horse care Off the Stable page
shows every horse you own and lets you ride any of them; only the feeding and the stats wait for horse care.

## RVN-OWNERS-CHOICE: a revenant's fate is its owner's - only the owner's own Disintegrate closes it (7)

`src/systems/revenant/revenantFate.js` ownersWholeKill; `src/scenes/exteriorFoes.js` damageFoe; `src/scenes/dungeonContext.js`
damageFoe.

THE REPORT. "I erased a Revenant fro[m]...": "I've been using a 3x disintegrate as my main spell lately ... I believe it
bypasses the kill/spare on revenants. And it seems it does this to other players' revenants, too. As cool as the tech is
being able to disintegrate a rev to never have to deal with them sort of like a delete button. It probably shouldn't be
doable to other peoples revs." The screenshot: "Sekrath the Undying (dead)", and "Isn't he supposed to give you a
choice?".

FOUND. A Disintegrate is a whole blow (`effects.js:"sinks.hurt(left, { whole: true });"`), and both damage doors passed
every whole blow over the revenant gates - the last stand and the yield read `!_whole` - to the death arm and
`revenantSlain`, which closes the record. The rule was recorded on purpose ("a Disintegrate kills it outright",
Revenants.md 11, 19, 20; Feud-Arc.md 14.2, 15.1), written for the owner. A revenant is never handed over (REVENANT-HEIR),
so a party member's blow on it goes to the owner as a kill (`z: 1`, AUDIT PSCALE1 DOORS-1) and the owner's door applied
it whole - the street's, the dungeon's landPeerBlow, a peer's strike spell alike: anyone's Disintegrate closed anyone's
revenant, record and all. Measured on the old doors over two real street pools: Bob's real Disintegrate (5,255) on his
copy of Ann's revenant sent `z: 1`; applied at Ann's door the revenant died and its record closed - at rank 3 with no last
stand; underground the same. A stat drained to zero killed it outright too (that tick names no striker).

CHANGED (the owner: "Stop trying to match DFU"; the reporter: "It probably shouldn't be doable to other peoples revs"):
- A whole blow closes a revenant outright only as the owner's own - the player's blow (`fromPlayer`, never `peer`) at
  the door that holds the record (`revenantFate.js:"export function ownersWholeKill("`); a revenant is never handed over,
  so that door is always its owner's. Both doors' last-stand and yield gates ask it.
- Anyone else's whole blow - a party member's forwarded `z`, their strike spell, a foe's spell, a companion's, a drained
  stat's tick - is a killing blow like any other: at rank 3 and up the last stand; once stood with its will unbroken it
  tears away; else it kneels. No `slain` goes back, the record stays open, the kill-or-spare is the owner's. The owner's
  own Disintegrate and Razor still kill outright. `_whole` still keeps a kill undivided by the party's toughness.
- Named in Revenants.md (15, notes in 11, 19, 20) and Feud-Arc.md (1.2, 14.2, 15.1). A stat drained to zero names nobody,
  so it now beats the player's own revenant the way any killing blow does - at rank 1 and 2 it kneels and Kill closes it;
  at rank 3 and up the drain's next tick (every 0.2 s) makes the last stand and then tears it away, its will unbroken -
  it escapes, to come again; the owner's own Disintegrate or a broken will closes that fight (corrected by the audit).

THE FOUR HOSTS: world.js and worldModes.js - WIRED through exteriorFoes' one door (no host line); dungeonContext.js -
WIRED, its own door's two gates edited in place (no code line added); exterior.js - the same door, still FLAGGED as in
Feud-Arc 32 (no `fates`, so its revenants die to any killing blow; no net, so no peer's blow reaches it). Pinned by
`test/systems/revenant/fb1016b_rvnownerschoice.test.js` (5, the second the report over two real street pools); `tools/mutants/
fb1016b_rvnownerschoice.json` (13, all dead). PINS MOVED: `revenant_fate.test.js` (the dungeon yield seam) and
`rvn4_stand.test.js` (the dungeon stand seam); mutants REVENANT-FATE-dies-as-before, RVN4-the-street-stand-unasked,
-the-street-whole-stood, -the-dungeon-stand-unasked and -the-dungeon-room-stood re-aimed by content (both lists: 85
dead, 1 recorded equivalent).

FLAGGED: `audit24_lifetimes.test.js`'s proximity bound (`health <= 0` within 4,200 characters of `releaseFoeBatch(f)`)
now stands at 4,160 in exteriorFoes' death arm - the next line there moves it.

What the reporter is owed: you were right - a Disintegrate deleted any revenant, yours or another player's, and nobody
was asked. Another player's Disintegrate now beats a revenant the way any killing blow does - it makes its last stand,
tears away or kneels - and only its owner chooses. Your own Disintegrate still finishes your own.

## STALL-SHAPE: the market stall is the pack's own, and a yard's saved stalls and boulders stand where they were put (8)

`src/world/townStandIns.js` RMBRP_STALL_FRAME, RMBRP_STALL_OPEN_FIRST, RMBRP_STALL_OPEN_SHIFT, stall;
`server-account/migrations/0121_yard_reseat.sql`; `tools/yardReseat.mjs`; `src/systems/decor/decorPlacer.js` (the header's rule).

THE REPORT. 2026-10-15 9:59 PM: "market stalls all shifted into the ground/walls", "at least the lawn decoration owns".
Two town screenshots: a stall's awning low over the street with its keeper standing inside it; a red-awning stall against
a wall, its counter half buried.

FOUND. TEMPLE-STEPS (c2b52fdff1, merged that evening) set the stall's box and scale right (the prefab's 0.75, x mirrored),
but the shape inside the box was still the port's guess, and the pack's FBX (`ext_city_stall001-026`, read with a scratch
FBX reader) says otherwise: the pack's counter is 1.04 m high at x -0.80..0.32, the stand-in's 0.75 m at x -0.19..0.26 -
the author lays its goods at 1.05 m and none rested on a counter; the pack's lintel underside is 2.26 m (its fringe
2.17), the stand-in's awning edge 1.84; the stand-in had a bench 0.53 m high the pack does not have, and 20 of the 30
stall-keepers stood inside it (21 of the 28 keepers in the footprint were inside a solid or under a face below their
heads); prefabs 53113-53124 use a second mesh (`ext_city_stall014-025` - the frame 0.2 m back, 0.206 m up, 0.066 m across,
no counter) and still got the counter, burying the goods laid on the ground. None of the author's 32 town stalls stands in
a building under any footprint (checked against the game data), so "into walls" is the yards'. Yard decor is the account
service's (D1 `home_decor`, `yard` = 1; `placed_at` set at placing, never by a move), and a saved piece records where its
model's origin stands, worked out against the stand-in of its day (`decorPlacer.js`) - so TEMPLE-STEPS' new origins moved
every saved stall 2.06 m x its scale toward its back, into the wall its owner had stood it against, a quarter smaller,
and grew every saved boulder 2-8 times about a different centre.

CHANGED:
- **The stand-in is the pack's stall**, built from the FBX's measurements (within 2.3 cm of `ext_city_stall001`, 1 cm of
  `014` for the second mesh): posts 0.375 m square, a beam and a lintel, the awning from the beam's top to the lintel's,
  the prefab's own valance cloth (`49_9`), headroom 2.17 m at the front, a counter top at 1.041 m, no bench; the second
  mesh its own frame and no counter. Named in `03-World/Beautiful-Towns.md`: the outer faces stay on TEMPLE-STEPS' box (at
  most 2.25 cm off the pack's - the box saved yard stalls stand by); every post stands on the origin (the pack's run
  0.112 m below it, the second mesh's start 0.094 m above); the wood `67_1` for the prefab's climate-swapped `366_x`.
- **Migration 0121 re-seats every saved yard stall and boulder**: its origin moved so the model's box, turned and scaled
  as the piece is, keeps its centre and its foot; its scale divided by the model's growth (0.75 a stall, each rock's
  prefab scale), within the scale limits (0.25-4) and the yard's bounds. Which old box applies is `placed_at` against
  TEMPLE-STEPS' web deploy (1792111405, 2026-10-16T00:43:25Z): before it WD3's, after it TEMPLE-STEPS' (only the second
  stall has moved since). Once: the D1 ledger applies it once and each re-seated place carries `"reseat": "STALL-SHAPE"`,
  which the statement never moves again; a place not JSON is skipped, rooms never touched; cosine and sine as Taylor
  series in plain arithmetic (no SQLite math extension). The Worker's code is unchanged (ACCOUNT_VERSION stands);
  `06-Systems/Online-Arc.md` records the re-seat.

THE FOUR HOSTS: none wired - the stand-in is the pipeline's (`customModelFor`) for every host that draws a town block:
world.js and exterior.js, and worldModes.js's view out of a window; dungeonContext.js draws no town; yards stand in
world.js alone, and only their data moved. Pinned by `test/world/fb1016b_stallshape.test.js` (5); `tools/mutants/
fb1016b_stallshape.json` (30, all dead). PINS MOVED: `fb1015f_templesteps.test.js`'s stall test and `wd3_standins.test.js`'s
"every built piece is sound" (the second mesh its own frame); mutant TEMPLESTEPS-9-stall-off-origin re-aimed by content.

FLAGGED: a piece placed before the deploy and moved during TEMPLE-STEPS' day was moved against the new box - no record
says so, so it is put back as if unmoved and its owner moves it once more; stalls placed in the first hour by clients
still on the old build stay as TEMPLE-STEPS drew them; a boulder whose old scale over its growth falls under 0.25 (a
scale-8 rock placed at 1) stands at 0.25, up to twice its old size; every other town-mod piece the decorator offers (beds,
paintings, DET pieces) stands by its stand-in's box the same way, with no guard if a stand-in's box moves again.

AUDIT (2026-10-16, the branch read cold): three. THE YARD'S FLOOR - the re-seat held a piece under the yard's top and
inside its bound across, not going down, and `decorPlaceOf` drops a place past +-48 m on any axis: a piece set deep
enough would have been re-seated out of its yard. The tool's law and the statement hold it at -48 (0121 regenerated; it
is not deployed). THE TURN - the statement turns by `rot[0]` alone: the placer mints a model's place `[yaw, 0, 0]`
(`decorPlacer.js`), so no saved stall or boulder carries a pitch or roll it passes over (one sent by hand is re-seated
about its yaw). A RESTORE - the realm-restore workflow writes `home_decor` rows back from a D1 snapshot
(`tools/realmRestore.mjs`), and one taken before 0121 ran would have put a yard's WD3 stalls and boulders back as they
were placed, with 0121 never to run again. The restore now re-seats them by the same law (`tools/yardReseat.mjs`
reseatRestored: never a marked place, a room's or another model's); an open stall placed after TEMPLE-STEPS' deploy may
be either stand-in's, so it is written as the snapshot holds it and the plan's notes name it. Running 0121 again by hand
is no remedy: it would move every open stall placed since STALL-SHAPE's deploy 0.26 m forward. Pinned by the third test
(a piece at -47.5 m) and the fifth (a snapshot through `planRestore` lands as 0121 leaves the same rows); the six
YARD-RESEAT-AUDIT mutants dead. FLAGGED besides: a stall placed in the minutes between the account deploy's run of 0121
and the web's deploy of STALL-SHAPE is placed against the stand-in then drawn, as in TEMPLE-STEPS' first hour.

What the reporter is owed: the market stalls stand as the pack draws them - the keeper behind the counter under the
awning, the goods on the counter, the open stalls' goods on the ground. A stall or boulder you put in your own yard is
back where you put it, at the size you placed it.

## STOLEN-GOODS: a stolen piece carries its theft - a merchant is rid of it, a guilty verdict takes it (9)

`src/systems/stolenGoods.js` (new); `src/systems/item/itemFields.js` `stolen`; `src/systems/inventory.js` stacksWith,
splitStack; `src/systems/item/itemTransfer.js` applyTransfer; `src/systems/inventorySession.js` theftTarget;
`src/ui/native/nativeTrade.js` _doSteal; `src/ui/enhanced/enhancedTrade.js` runSteal; `src/ui/native/nativeInventory.js` and
`src/ui/enhanced/enhancedInventory.js` the take, the put-back, the enhanced card; `src/scenes/worldModes.js` openShelf's shut arm,
the `container:` arm, commitTrade's Sell arm, doSell; `src/systems/court.js` confiscateStolen; `src/scenes/arrestFlow.js`
finish, release.

THE REPORT. "A bug related to infinite...": "you steal something from the shelf and can sell it back to an NPC, and he'll
put the item back on the shelf again, and it just goes in a circle ... completely disrupts the economy ... Also, when
you're sent to prison, all the stolen items stay with you and aren't taken away." (The guard who cannot reach the thief
is INDOOR-WATCH, below.)

FOUND. Nothing in the tree knew a piece was stolen: no item field, no flag at any theft arm. Both sale arms
(`worldModes.js` commitTrade's Sell arm and the keyed doSell) pushed the sold record onto the open shelf (Port-Ledger T2),
where it stood until the next day's restock (`shopStock.js` needsRestock). Driven on the real modules over a quality-10
smith's shelf: the real Steal took its Dai-Katana into the pack unmarked; the real Sell window paid 300 gold for it and the
same record stood on the shelf again; the open shop's Steal is caught 65% of the time at Pickpocket 50, and a SHUT shop's
shelf rolls nothing at all (`theft.js` shopShelfTheft) - so a piece sold back by day could be taken again that night for
nothing, without end. The court touched no item: no exit of `arrestFlow.js`, nothing in `court.js`. And a second hole,
found building the mark: a take from the shut shelf or a stranger's cupboard goes through the inventory window, and a
stackable piece merges into the pack's stack as it lands (`inventory.js` addItem) - a diff at the window's close could
never have marked 85 arrows taken into a pack holding 11.

CHANGED (the owner: "Stop trying to match DFU"):
- **The mark.** A piece taken from someone else's keeping carries `stolen: true` (`systems/stolenGoods.js`), declared in
  itemFields.js so the save, the wire and a realm trade carry it - a hand-off launders nothing. Written at the theft arms
  as the piece moves: the open shop's Steal on both skins (the lot marked before TransferAll merges it); every take of
  the OWNER'S piece through either inventory window from a loot target whose host hands over the owner's keeping - the
  shut shop's shelf and a stranger's cupboard (worldModes.js, on lines it already had; AUDIT S1 below: it was every take
  from a target marked `stolen`), marked before the piece lands (`itemTransfer.js` applyTransfer's `stolenFrom`;
  `inventorySession.js` theftTarget counts the loot target alone, never the wagon, the bag or a reward tray); and since the
  AUDIT a robbed caravan's goods and a lawful ship's hold (S4). The owner's piece put back is theirs again (`returnTo`);
  a stolen piece stacks only with stolen kin and a split keeps the mark; a pickpocket's coin carries none; the enhanced
  item card says what the mark means.
- **The fence.** `landSold`: an honest sale lands on the open shelf as T2 has it, so a mistaken sale can be bought back; a
  stolen piece is paid for and gone. Both sale arms call it, one line each.
- **The court.** `court.js` confiscateStolen takes every stolen piece the prisoner carries - the pack's (a worn piece off
  its slot first, a lit torch put out) and the Materials Bag's, and a stolen bag's honest goods into the pack (AUDIT S2) -
  called by `arrestFlow.js` finish, which every guilty exit
  runs: a sentence served, a fine paid with no days, banishment, the failed defence's verdict, and so the watch's "come
  quietly". Taken at the verdict; the release says once "The guards take the stolen goods you carried (N items)." An
  acquittal and a guild's rescue take nothing. Both lines through the text core, in every language the tree carries.
- Named in `06-Systems/Standing-Arc.md` (STOLEN-GOODS) and Port-Ledger T2 (narrowed) and the REP row.

THE FOUR HOSTS: worldModes.js - WIRED (the two theft targets and both sale arms, on lines it already had;
createWorldModes 7,072 code lines before and after - 7,091 at the AUDIT, before and after its changes too); world.js and
exterior.js - the arrest flow is theirs and the court's change is inside it, their wiring unchanged (the AUDIT's caravan
loot window in world.js on the line it had - bootWorld 21,637 code lines before and after); dungeonContext.js - its one
trade window is the Identify spell's (no steal, sale or shelf). Pinned by `test/systems/fb1016b_stolengoods.test.js` (13 - 7,
every one failing on the old code, and the AUDIT's 6); `tools/mutants/fb1016b_stolengoods.json` (53, all dead). PINS
MOVED: `audit26_economy` (the shut shelf's loot target), `audit26_modal` (where the Sell arm lands a piece),
`auditloot2` (the junk mark beside it), `enhancedInventory` (PX28's take, INV2's stow twice), `housecontainers` and
`shipstore` (the cupboard's loot target; shipstore the shut shelf's too); mutants AC5-C-M26, C8-cards-stack-any,
SHIPSTORE-owned-cupboard-not-storage and -stranger-cupboard-is-storage re-aimed by content.

FLAGGED, not taken: a shut shop's shelf still rolls nothing, so a night's haul is free (bounded now by the day's stock,
each stolen piece sold once) - a fence's lower price for stolen goods is Mac's call; the court searches what the prisoner
carries, not the wagon, a home or the bank; the watch's fine paid on the spot ("P" at the stop) is no arrest and takes
nothing; the enhanced pack's put-back is wired the classic window's way and pinned by source (no enhanced view stands a
shelf beside the pack today).

AUDIT (2026-10-16). Read cold (the auditor's scratch drives, on the real modules: an honest piece through a stranger's
cupboard, a stolen bag at a verdict, a peer's shelf word, the theft arms); six findings, each fixed:
- S1 - THE MARK AND THE CRIME DISAGREED. applyTransfer marked EVERY take from a target marked `stolen` and cleared every
  put: an honest Longsword misclicked into a stranger's cupboard and taken straight back came out stolen - the theft
  law's basket for that window 0 pieces - destroyed at its sale and taken at a verdict; and a piece stolen elsewhere, put
  in a cupboard, came out clean. The claim "a piece put back is its owner's again" above was that bug. Now the host takes
  THE OWNER'S KEEPING as the window opens - a Set of the target's records (`before`, `shelfBefore`, handed over as
  `loot.stolenFrom`; `theftTarget` answers it) - and the mark reads it: a take is marked when its SOURCE record is the
  owner's, and the moved record (or the half a split mints) joins the keeping; the owner's piece put back is cleared and
  the record it comes to rest in is theirs (a merge leaves the keeping); any other piece keeps what it was
  (`stolenGoods.js` takenFromKeeping, returnedToKeeping, landedInKeeping). The theft's own law reads the SAME Set:
  `theft.js` theftBasket (a stranger's cupboard) counts a split now - DFU's basket holds the split item; the list's diff
  saw the stack still standing, so four arrows of ten were no theft - and a handful of the owner's coin; and the shut
  shelf's tally reads the keeping, not DFU's count (`shopShelfTheft`, a departure: a piece of one's own put down masked a
  take). PINS MOVED: `theft.test.js` (PT1's count pin and the arms' source), `decor2b`, `audit26_economy`,
  `housecontainers`, `shipstore`, `enhancedInventory`; the cupboard's and the shelf's mutants re-aimed by content. What
  is NOT tracked: a piece left in a target in one window is in its keeping at the next open (the target's records then,
  as DFU's basket and the old diff read them).
- S2 - A STOLEN BAG STRANDED ITS HONEST GOODS. confiscateStolen spliced a stolen Materials Bag out of the pack and left
  its honest `bagItems` in a list nobody owned (BAG1: a loaded bag never leaves the pack). Once the stolen goods are out
  of both lists, a character left with no bag in the pack has what is left in it - every honest piece - put in the pack,
  whatever it weighs; a bag of one's own beside it keeps them.
- S3 - A PEER'S SHELF WORD COULD CARRY THE MARK, and an honest Buy kept it: an older build's sale or a hostile client
  poisoned another player's purchase. `interiorShared.js` applyInteriorLoot strips `stolen` from every shelf and cupboard
  record the room lands (and interiorLootRecords from every one this build says - an older build lands what it is told),
  and the counter's Buy door clears it (`tradeModes.js` markCounterBought - commitTrade's Buy arm and the keyed doBuy
  already call it first): a piece bought at a counter is the buyer's, honestly, on either lane. A piece stolen elsewhere
  and left on a shut shelf keeps its mark there (no cupboard launders it) until it is bought.
- S4 - TWO THEFT ARMS MARKED NOTHING. A robbed caravan's goods (`world.js` caravanHost's openLoot, after a hold-up the
  caravan reports as a Theft) are its people's: its loot window hands over `stolenFrom: new Set(items)` (line-neutral in
  bootWorld). And DECIDED: A LAWFUL SHIP'S HOLD IS STOLEN GOODS. Her boarding is Piracy (`navalLaw.js` lawOf's 'board'),
  so her hold is marked as it is drawn (`navalHost.js` winBoarding) and carries the mark out by every door - Take all, Open
  her hold, the crew's stow when the sea goes. The naval record calls the plunder "won", never clean, and the rule "a piece
  taken from someone else's keeping" reads her owner's cargo as such. Not marked, the mark agreeing with the charge: a
  pirate's hold (a lawful prize - her end is rewarded) and a hold past the Veil (no crown's writ runs - chargeEther
  charges nothing). DECIDED at the merge (the owner: "Stop trying to match DFU" - the call is ours): THE CASKS OF A LAWFUL
  SHIP I SANK ARE HER HOLD TOO. She went down after the Piracy her first strike charged, so her lots afloat carry the mark
  however they come aboard - hauled in where they float, broken open swimming, the crew's stow when the sea goes
  (`navalHost.js` lawfulGoods, stolenCasks: pickFlotsam and stowPlunder). The casks of a lawful ship another sank (or
  one whose owner gave me it, AUDIT NAV1's claim) are salvage, a pirate's fair prize, and her wreckage's stores (SALVAGE)
  her fittings - none marked. Pinned by the S4 flotsam test over the real naval host (a cask hauled, the crew's stow, a
  pirate's, another's sinking); STOLEN-AUDIT-S4-flotsam-* (5) dead.
- S5 is FINE-PEOPLE's (above).
- S6 - A HOME VENDOR WAS A FENCE. A town's patron (`patronLaw.js` patronTakes, read by the account service's patron
  reckoning) bought a stolen piece off a hired trader at three fifths of its worth in the service's gold; it takes none
  now (no refusal text exists - a patron simply never draws it). A player may still buy it off the trader, the mark riding.
  The account Worker bundles patronLaw.js: acct146.
Pins: the six new tests over the real windows, the real shelves (online, a General Store's bag), the real arrest court's
member, the room's landing, the real naval host's boarding (a merchantman, a pirate, a ship of the Eltheric Ocean, her hold
drawn by the treasure tables) and the listing's own record; 21 new mutants and 12 re-aimed, 53 all dead (and, beyond the
slice's list, `shipstore`'s two, AUDIT SS's and HACKED-GOLD's outgoing-word record, AUDIT LW-II-2's counter mark and the
version records re-aimed by content - all dead).

What the reporter is owed: a piece you steal is marked stolen. A merchant still pays for it but gets rid of it - it never
goes back on the shelf, so the circle is broken. Found guilty - jail, a fine or banishment - the guards take every stolen
thing you carry and say how many. Win your case, or have the Thieves Guild get you out, and you keep them.

## DOOR-TOKEN: the next room's token is minted at the door (10)

`src/net/accountClient.js` the minter's `ahead(room, withinMs)` and `holds`; `src/scenes/doorTokenHost.js` (new;
the audit: DOOR_SOON_MS, EXIT_WALK_MS, DOOR_PENDING_MS);
`src/net/online.js` `tick`'s token retry, the close paths' `_tokenRetry`; `src/scenes/world.js` the door module's
construction and its five calls.

THE REPORT. "Friend invivible and randomly popping up" (title only). "Partied players popping in and out randomly after
leaving tombs at graveyard ... also partied players inside tombs are invisible for a time."

FOUND. The relay and session layer is clean - measured with real OnlineSessions over the real relay Room
(test/fakeRoom.mjs), one clock for all, world.js's online block a frame: a party at a graveyard with 5 and then 30 others
moving in the cell, one member pacing a cell edge 60 s - no frame lost (the halo promotes in place); a standing peer heard
every HEARTBEAT_MS (20 s) and hidden only at PEER_TIMEOUT_MS (80 s), never fired; a relay restart keeps peers frozen, not
hidden. Layers are not the cause at today's counts (an overflow forced with a 12-socket cap walked the party into one
layer together; a real cell overflows past 256 sockets). What hides a peer is any socket opening into a room the held
token cannot open: a room's socket mints its token in `ws.onopen`, before any hello, and the minter hands over a held
token only under TOKEN_REUSE_MS (60 s) old and unspent in that room. A crypt visit over a minute minted going in, and
always minted coming out (the cell outside was spent by the token that left it). With a 3 s mint (TOKEN-WAIT measured
over 2.5 s for a player) each side was invisible to the other 3.1 s, into and out of the crypt; a player's own blip hid
them a mint plus the backoff (4.4-5.2 s at a 2.5 s mint); a relay restart with a queueing account service froze them
23-36 s. And a token later than TOKEN_WAIT_MS sent the hello tokenless, refused, and its retry waited out the backoff
after the token had arrived (3.1 s past it).

CHANGED:
- **The token goes at the door.** The minter's `ahead(room, withinMs)` mints now, only when the held token could not
  open the next room by the time its socket asks - none held, spent in that room, or its minute out within the door's
  own margin `withinMs` (AUDIT A2, below: it was one 20 s, TOKEN_AHEAD_MS, at every door); never with a mint in flight,
  through STORM-SHED's hold, or signed out.
- **The host module** `scenes/doorTokenHost.js` calls it at a door in (`onPreTransition`, while the place builds - the
  cell left remembered as the way back), a door out (`onDungeonLeave`, `onInteriorLeave`), every jump
  (`_teleportToPixel`: fast travel, teleport, recall) - each with DOOR_SOON_MS (2 s: a frame, the join's hold, a socket's
  open), asked again every frame until its room is joined (DOOR_PENDING_MS at most) - and the walk back to an exit door
  (within EXIT_NEAR_M 16 m after standing EXIT_ARM_M 32 m from every exit; the spawn beside the door does not count) with
  EXIT_WALK_MS (8 s), once a visit. Online only.
- **The retry.** A hello refused for want of a token (the primary's and each halo's) retries the frame the minter `holds`
  a token for its room; the hard backoff stands for every other wait.
- Measured again (two real sessions, the real Room, a 3 s mint): into the crypt 3.1 s -> 0.5 s (the build covers the
  rest; 0.7 s before the audit's re-ask through the build), back out 3.1 s -> 0.1 s; five mints on the same walk either
  way. `11-Multiplayer/Scale-Arc.md` DOOR-TOKEN.

THE FOUR HOSTS: world.js - WIRED on existing lines (bootWorld 21,679 code lines, its ceiling); worldModes.js and
dungeonContext.js - reached through world.js's host hooks (onPreTransition, onInteriorLeave, onDungeonLeave), the module
reading their exit doors through `modes.dungeonCtx.exitDoors` and `modes.interiorCtx.doors`, neither file changed;
exterior.js - no online session. Pinned by `test/net/fb1016b_doortoken.test.js` (6, the first the crypt both ways over the
real session, Room and minter; the last the audit's rate over the real host and minter);
`tools/mutants/fb1016b_doortoken.json` (36, all dead - 7 re-aimed by content at the audit, 11 its own). PINS MOVED:
`stormshed.json`'s STORM-SHED-primary-unheld re-aimed by content.

FLAGGED, not taken: in an overflowing place a party can split across layers (a member asks its party's layer only at its
join; a reconnect reuses that hint; a halo opens at layer 0) - unreachable at today's counts; a lone player's blip that
drops two of a page's sockets is read as a deploy wave (SCALE2c) and waits its share of the spread (up to 10 s at 500
online); a reconnect after a relay restart still costs a mint (the relay forgets spent tokens on restart, the client
cannot know it, and replaying a spent token would trade away replay protection); a player who never stands 32 m from an
exit (a shop counter) still pays the mint at the door out.

What the reporter is owed: your party mates were never gone. Every door into a tomb, and back out, opened a new
connection that waited a few seconds for the account server to vouch for you, and for those seconds neither side could
see the other. The game now asks for that pass while the tomb loads and while you walk back to its door, so you appear to
each other as you step through.

AUDIT (2026-10-16). Read cold over the real minter and host (the auditor's `mintrate.mjs`, `mintrate2.mjs`,
`linger.mjs`); the finding fixed:

- **A2 (minor/major - the account service's load): the margin was the walk's at every door.** The record said "the next
  room's own mint simply goes early" and "a token minted ahead and never used is at most one a page per 40 s" - both
  understated. TOKEN_AHEAD_MS (20 s) at every door minted whenever the held token was 40-60 s old, though the next socket
  asks within a frame (leaving) or a build (entering) and that token would still have opened it: x2.00 the mints at a
  40-55 s door gap, x1.48 at 30-60 s; and the walk out re-armed on every approach - a fight pacing 10-35 m from a
  dungeon's exit minted 13 times in ten minutes, none before. Now `ahead(room, withinMs)` takes each door's own margin
  (`doorTokenHost.js`): a door in, a door out and a jump DOOR_SOON_MS (2 s), asked again every frame of the place change
  until its room is joined (DOOR_PENDING_MS, 30 s, at most) - so a long build needs no guessed bound and its token is
  minted as its minute runs out, not 20 s early; the walk out EXIT_WALK_MS (8 s: 16 m at the slowest walk, the click,
  DOOR_SOON_MS), ONE mint a visit (it arms no more until a door takes the player in, or a jump lands them). Re-measured
  over the real host and minter, its margins and its frames (the auditor's walk drove the minter alone with one margin,
  so the walk is driven through the host now - a 3 s mint, frames every 100 ms): building hops (a 1.5 s build, walking
  back to the door) x1.00-1.06 at every gap from 10-30 s to 45-58 s, the sockets' wait on a mint down to a third; the
  pacing fight 1 mint in ten minutes (the auditor's `linger.mjs`); the crypt 0.5 s in and 0.1 s out. What is left is the latency win's own price: a token minted at a
  door is older, by the build, at the next door - a 6 s dungeon build with every gap at 45-58 s mints x1.22 (x1.03 over a
  10-120 s spread), a 12 s one x1.58, its sockets never waiting. Pinned by THE RATE (`fb1016b_doortoken.test.js`).

## INDOOR-WATCH: the watch called into a building walks round to the player, and a wall never keeps it out (11)

`src/scenes/interiorNav.js` (new): createInteriorNav, doorsOutOfSoup, feetAnchors, polyUnder, noRouteSpot,
huntsThePlayer; `src/ai/enhancedMotor.js` EnhancedEnemyAI.standAt; `src/scenes/cityGuards.js` createCityGuards' `nav`,
spawnGuardAt's motor; `src/scenes/exteriorFoes.js` createExteriorFoes' `nav`, spawnFoe's motor; `src/scenes/worldModes.js`
the module's wiring (makeInteriorFoes, makeInteriorGuards, the building's mount, the interior frame, exitInteriorNow,
forceExitToExterior). AUDIT (below): interiorNav.js meshPointUnder, meshPointNear, the module's `goal`, GOAL_REACH,
FEET_RINGS, FEET_ARC_M, STAND_RISE; enhancedMotor.js `_routeOffMesh`, `navGoal`, `_getDestination`; `src/characters/enemy/enemyMotor.js`
EnemyAI.resumeLive, `_standAfresh`; `src/ai/nav/navmesh.js` collidersAt, buildPackedIndex, mintBucket; `src/ai/nav/navClient.js`
bake, `_cols`; `src/ai/nav/navBake.js` navInputFromCollider.

THE REPORT. "If you just sit near the wall between the shelves, when you fail to steal something, the guard will come
running, but they simply can't reach you because they run into the wall instead of going through the door. And you can
sit like that for as long as you like" (the loop it fed is STOLEN-GOODS, above).

FOUND. The watch called into a building (cityGuards.js's indoor arm, PlayerEntity.SpawnCityGuards) stands 2-5 men at the
lowest outer door and built the classic `EnemyAI` over the room's collider, as did the building's own foes
(makeInteriorFoes): it steers straight at the player and slides along the first wall it meets. A navmesh existed, but only
the dungeon baked one (ENHANCED AI 3b-4); "ENHANCED AI 5 - exteriors and interiors ... RMB interiors" was still ahead
(`12-Enhanced-AI/Enhanced-AI-Arc.md`), and `enhancedAI4.test.js` pinned that "the classic one is stopped by [the
divider]". Measured on the reporter's shop built as a real Collider (a 12 x 12 m room, a partition with a 1.2 m doorway,
shelves against its far face, the player between two), the real watch pool spawned through its real indoor arm: in 30 s
the five watchmen pressed against the partition, none went through the doorway, none saw the player, none swung - the
nearest 1.41 m away, through the wall.

CHANGED (the owner: "Stop trying to match DFU"):
- **The room's mesh.** `interiorNav.js` is the mode machine's module: one instance, mounted with each building at the
  player's arrival and released at both teardowns; its frame runs before either pool steps, and both pools receive it as
  `nav` (the bake as a thunk, and the routes' world - the two things the dungeon hands its foes). With the Enhanced AI
  switch on (forced on online), `createCityGuards` and `createExteriorFoes` build `EnhancedEnemyAI` when a host hands
  them a mesh, as the dungeon's construction sites do; the street's pools hand none.
- **The bake** is the dungeon's `NavClient` with the dungeon's door rule (unlocked action doors left out of the soup),
  anchored on the arrival, the room's ways in, each door's watch spot (`indoorWatchSpot`), and the player's feet and the
  rings round them, out to GOAL_REACH (4 m), a straight knee-height line reaches. Asked only on need (a building nobody
  fights in bakes nothing), never cached (the bake is the nav worker's - 0.2-0.7 s for the audit's 936-7,776-triangle
  halls - and the main thread's share is the soup read at the ask and the landing, AUDIT W2 below; thousands of buildings
  would each leave an IndexedDB entry nothing evicts); asked again when a door's lock changes the soup, and when the
  hunted player stands off every island the mesh kept (at most four times a room); one bake at a time, a request made
  meanwhile held and baked as it lands (ASYNC NEVER DROPS).
- **Off the mesh** (AUDIT W1): a player findPath cannot place - past its half-metre snap, between two deep shelves or in
  a closet the bake keeps no floor of - is routed to the room's point for them (`nav.goal`: the poly they stand on, else
  the nearest the knee's line reaches within GOAL_REACH) and walked in from there.
- **NO ROUTE.** A locked inner door or a ladder can leave the player's room an island the routes cannot reach: a
  watchman of the crime's pursuit whose feet have stood on another island for 2 s is moved onto the player's island (a
  player on none: the island they are walked in from, AUDIT W1) at the spot nearest where he stood (the far side of what stopped him, a body's width into the floor; never within 1 m of
  the player or 0.8 m of another watchman; never in or on anything set down since the bake), and walks the rest
  (`EnhancedEnemyAI.standAt` keeps the pursuit, drops the old route, fall anchor and detour). Only the watch is moved - a
  monster a locked door holds is a door that held; the law's answer is not.
- Measured on the same shop: the room baked 0.53 s after the crime, the first watchman in melee reach with the player in
  sight at 4.2 s, the five swinging 37 times in 30 s, nobody moved; with a locked door in the doorway, all five moved past
  the partition at 2.7 s and swung 26 times.

THE FOUR HOSTS: worldModes.js - WIRED (five code lines, createWorldModes 7,072 -> 7,077 under its 7,159; the `nav:` dep
rides lines the pools already had); world.js and exterior.js - their buildings are the mode machine's, covered; their
street pools hand no mesh and still walk the classic motor (FLAGGED); dungeonContext.js - its own bake since 3b,
unchanged. Pinned by `test/ai/nav/fb1016b_indoorwatch.test.js` (8, over the real watch pool, foe pool, module, NavClient and a
real Collider, and the host's wiring by source); `tools/mutants/fb1016b_indoorwatch.json` (70, all dead). PINS MOVED:
`enhancedAI4.test.js` (AUDIT 55's reach pin - interiorNav.js, cityGuards.js and exteriorFoes.js join the switch's
readers, each behind `nav &&`; AI 4's host pin - each pool's one construction site chooses by the switch),
`audit63_world_actions.test.js` (the construction site's new spelling), `incident_ceiling_bats.test.js` (the exterior
pool's regex; the watch's epoch-guard order pin now requires the guard be found at all), `sailingcabins.test.js` (the exit
harness's scope carries `interiorNav`); their own mutants (6, INDOOR-WATCH-MOVED-*) dead.

FLAGGED, not taken: the streamed world's half of ENHANCED AI 5 (the street watch and street foes still walk the classic
motor); offline with the switch off, the classic motor's wall stands; decor placed or removed during a visit (DECOR1c,
BASE-HIDE) does not re-bake the mesh (a moved watchman never lands in or on it, but a route may run through one); a
watchman can be moved within the player's view; `doorsOutOfSoup` spells the rule the dungeon writes inline on its bake
line (one home is a later slice's); nothing was seen in a real RMB interior (no ARENA2 in the container).

AUDIT (2026-10-16). Four findings, each fixed and pinned; the audit's own rigs re-run on the fix.
- **W1 (MAJOR - the report survived).** Shelves 0.8 m deep or more put the tucked player within ISLAND_REACH of the
  aisle's island - so NO ROUTE never fired - but past findPath's half-metre goal snap
  (`navmesh.js:"return bestD <= 2 ? best : -1;"`): every route failed (288 repaths, 288 fails in 30 s), the motor fell
  back to the classic line, and nobody crossed the partition. A 0.7 m closet 2 m deep left the player on no island at
  all, and three of five watchmen stayed at the partition. FIXED: a route that cannot place its goal asks the host for
  the mesh's point a route there ends at (`navGoal`, the room's `nav.goal` - `meshPointNear`: the poly the player stands
  on, else the nearest the knee's line reaches within GOAL_REACH, 4 m, never through a wall) and is solved to it, the
  straight walk in its last leg (`EnhancedEnemyAI._routeOffMesh`; departure from his repathToward, which answered null,
  named); the feet's anchor rings reach GOAL_REACH at bearings a body's width apart (`FEET_RINGS`, `FEET_ARC_M`), so the
  room an off-mesh player is walked in from is kept, behind a locked door too; and NO ROUTE reads that two-tier island
  for the player and for each watchman - a player on no island is walked in from the island at its edge, and a watchman
  in the closet beside them is on it, never stood away. FOUND WITH IT: a watchman stopped within reach of the player with
  a corner of his route still ahead (the aisle's mouth) turned to the corner, and the swing's 22.5 degree gate
  (`enemyAttack.js` ATTACK_YAW_DEG) never opened - at 0.8 m three of the five never swung, and one on the shipped 0.6 m
  shop stood 0.93 m off for 30 s without a swing. A foe the classic stop stops on its target in sight now faces the
  target (`EnhancedEnemyAI._getDestination` - adaptation 1's other half; every enhanced foe's, the dungeon's too).
  Measured: shelves 0.8 m - first melee reach 4.3 s, 44 swings, every watchman swinging; 1.0 m - 4.4 s, 40; the
  shipped 0.6 m - 4.2 s, 44 (25 before); the closet 2 m / 3 m deep - 4.0 s / 4.4 s, all five swinging; with a locked
  door in the partition all five stood at 2.7 s, reach 3.6 s / 3.9 s.
- **W2 (MINOR - the cost paragraph was false).** "A 30 x 20 m two-storey room of 9,652 triangles bakes in 0.37 s on
  the main thread" did not reproduce, and in the browser the bake is the worker's. The main thread pays the soup read
  at the ask (`navInputFromCollider`, synchronous in the module's frame - the crime's) and the landing: the worker's
  boxes unpacked into objects, the hydrate, the height layer's index built at the first route. Measured (node, CPU ms,
  one landing per fresh process, median of five, the auditor's furnished halls): 12 x 10 m (936 triangles, 10,872
  boxes) 26 ms; 30 x 20 m on two storeys (3,780, 54,581) 59 ms; 40 x 30 m (7,776, 109,251) 250 ms, ~190 of it the boxes
  minted as objects and pushed into the index. FIXED: the boxes stay packed as the worker ships them and the height
  layer indexes them so (`navmesh.js` buildPackedIndex - typed lists over the same grid, the same buckets in the same
  order, a bucket's boxes minted on the first query that touches it; made HERE FIRST and owed to project-final, the
  body's digest re-pinned), and the soup is counted first and written straight into its arrays (the same soup to the
  bit, about five times cheaper warm). After: 15 / 40 / 46 ms. The worker's bake of those halls is 0.2-0.7 s.
- **W3 (NIT).** `floorSpot` took a floor up to STAND_STEP (0.3 m) over the poly, so a stool under 0.3 m set down after
  the bake could be stood on - "never in or on anything set down since the bake" was false for it. FIXED: STAND_RISE,
  5 cm over the poly's highest corner (the corners are the bake's own floor, to the millimetre); STAND_STEP keeps the
  side under the poly.
- **W4 (NIT).** `standAt` reset less than `resumeLive` - the door crouch (DOOR-JAM's controller height, its reset flag
  and timer), the stuck stamp, the trail's crumb, the fixed step's remainder: a watchman crouched at the wall that
  stopped him was stood crouched. FIXED: `resumeLive`'s half that is not the pursuit is `EnemyAI._standAfresh`, the one
  list both call.

Pins: `test/ai/nav/fb1016b_indoorwatch.test.js` 8 -> 14 (THE DEEP SHELVES, THE CLOSET, THE FEET'S RINGS, THE LANDING, THE
SOUP, THE DUNGEON'S FOES; THE STAND and THE POOLS extended); `tools/mutants/fb1016b_indoorwatch.json` 70 -> 105, all dead
(ten re-aimed by content). PINS MOVED: `enhancedAI.test.js` (the navmesh body's digest, re-recorded with W2's packed index - owed to
project-final), `audit68_enemies.test.js` (the hydrated set's tops read packed, and the set must be the packed one).
THE FOUR HOSTS, for the audit: worldModes.js - its two pools hand the hook (`cityGuards.js`, `exteriorFoes.js`);
dungeonContext.js - WIRED at the merge: both motor sites hand `navGoalOn` over the dungeon's own bake and its collider,
on the line that hands the bake (the building's `nav.goal` is the same law, `interiorNav.js` navGoalOn; one import line,
no host line), so a player past the snap of a dungeon's mesh is walked in to as in a building - and the stop's facing,
the packed landing and the soup read are the dungeon's too (shared code); world.js and exterior.js - unchanged (their street pools hand no mesh). Landing numbers are node's on a
loaded container, not a browser's.

What the reporter is owed: the watch now walks round through the doorway to reach you between the shelves - however
deep they are, or into a closet - and swings when it gets there; if a locked door or a ladder keeps them out they come
in anyway after two seconds. Hiding behind a wall no longer works.

## REZ-BLOODLINE: a friend's Resurrect saves a Bloodline character (12)

`src/scenes/legacyHost.js` onDeath, writeDeath, decideDeath, raise, raised, askRaise, raiseAnswered, takeBack,
giveTollBack, raisable, pageGone, adopt, newGame, tick, deathOutcome, REZ_HOLD_MS, LEGACY_TEXT.raiseRefused/raiseUnheard;
`src/systems/legacy/revived.js` REZ_HOLD_S; `src/scenes/world.js` the death screen's frame (the rise, the call the realm
let go), composePartyPose (`fg`), fallenTargetPick, the tombstone and raise deps, the page's going;
`src/systems/realmSaves.js` realmDie's `hold`, realmRaise, the session's die and raise; `src/ui/deathScreen.js` tick (the
wall clock); `server-account/src/legacy.js` realmDie's `hold`, entomb, entombLineDead, settleHeld, settleHolds,
realmRaise, reviveOnLine; `server-account/src/cron.js` `rez-holds`; `server-account/src/index.js` `/v1/realm/raise` and its
refusals; migration 0122 (`rez_lease`); `src/net/accountClient.js` the refusals' sentences; `src/net/wire.js`
validPartyPose `fg`, RELAY_VERSION; `src/scenes/hostMagic.js` the Resurrect's gate, release and readying;
`src/systems/resurrect.js` RESURRECT_TEXT.forGood.

THE REPORT ("Bloodline Resurrection."): "I was testing with a friend, he dies and I cast resurrection. It works for a
moment then he disappears and remains dead." The screenshot: "...of Gothway Garden has Fallen - You died without a
descendant. There is no one left of the house of Gothway Garden. The line ends here, and its tree is kept in the Hall of
Ancestors."

FOUND. AUDIT LEGACY A1/B3 made the death door decide every death, so F11 or a closed tab could not undo one; online since
LEGACY7 that meant the door wrote the whole Bloodline fall - recordDeath, the remains, `family.pending` (the Succession
waiting) and the realm's tombstone (`POST /v1/realm/die`: `dead_at` stamped, the lease dropped). RESURRECT1's rise
(`world.js` resurrectInPlace) touched none of it: the heal, the death screen closed in place - "works for a moment".
Within a second the slow step (`legacyHost.tick`) let go of its `deathSeen` latch, but `family.pending` still stood, so it
answered `{ fall }` and the world host opened the Succession over the living body: no member, no heir, "The line ends",
endLine. Only the operator's REVIVE could take it back. Driven on the real host: at the door
`pending={"fallenId":1,...}`, tombstones sent `['fell']`; the slow step after the Resurrect gave `fall`, choices 0,
newborn false - the reporter's screen.

CHANGED (the decision: a resurrection from an ally SAVES a Bloodline character - as the slice's audit left it, below):
- **Written at the door, held by the realm.** Online the door writes the fall as offline (the record, the remains, the
  Succession waiting, the device's store and the realm's copy of the line) and asks the tombstone with its HOLD
  (`realmDie` `hold`: `dead_at` stamped - no join, checkpoint or trade from there - and the lease that fell kept aside,
  `realm_characters.rez_lease`, migration 0122); what a tombstone takes with it (the union, the guild seat, the pieces)
  waits on the window's close. A line's write that first carries the fall of a character in play holds it the same way.
- **The window** (`REZ_HOLD_S` 150 s, `systems/legacy/revived.js` - the longest online death screen, ONLINE_RESPAWN_SECONDS
  60 or the open zone's WILD_DEATH_HOLD_S 120, plus 30 s; one number at the page and the realm) closes at the first of:
  the player going on (the death screen's reset, through `deathOutcome`); its end (the slow step); the page going
  (pagehide, `pageGone`, by keepalive ahead of the realm's leave); a load or a new game (`adopt`, `newGame` - every load
  door); a body up that no Resurrect raised. Closing tells the realm (realmDie without `hold`: what a tombstone takes,
  taken) and the towns (the death's news). A window no page closes - a killed tab - the realm's minute closes (`cron.js`
  `rez-holds`, `legacy.js` settleHolds).
- **A Resurrect inside the window asks the realm.** The fallen's own frame asks `raise(rez)` before it rises; the body
  stays down while `POST /v1/realm/raise` answers (once a call, after the door's tombstone answered). The realm takes the
  death back only of a character of the account's own line, under the lease that fell, inside the window, with no other
  of the account's characters in play since, once - the tombstone cleared, the lease handed back, the line's copy stamped
  with the death taken back (the REVIVE law: `revived: [diedAt]`, which every copy honours). The page takes it back the
  same way (`takeBack`), gives back what recordDeath took off the fallen (their look, the news they heard), and rises on
  the next frame - on the call the realm let go though the caster's pose has stopped carrying it. A call the realm never
  heard is said and the next call asks again; a refusal is said ("The realm will not let you rise. Your death stands.")
  and closes the window. An Enduring member's toll is taken at the door too and given back at once by a Resurrect.
- **Closed, the body stays down.** `raise()` answers no, so the fallen's client never rises to show the line's end;
  their party pose carries `fg` (validPartyPose, relay world212), the caster's pick reads it, and the cast is refused
  BEFORE a point is spent, in the fallen's name: "Ysolde has fallen for good. No spell will raise them now." (the
  release and a caster-only Resurrect's readying say the same; through t(), drafted in the thirteen whole languages).
- **Unchanged:** offline the door decides, as A1/B3 has it; SD-ONELIFE stands (no Resurrect in the Hour). The departure
  is named in `01-Overview/audits/Audit-Legacy.md` at A1/B3's law, and `06-Systems/Legacy-Arc.md` REZ-BLOODLINE; the stale
  onDeath comment ("ONLINE Project Legacy has no say until ... LEGACY7") is replaced.

AUDIT (2026-10-16) - the slice's audit drove the real legacyHost and realm session over the real account Worker
(scratch: a_kill, b_twotabs, c_lowfps):
- R1 (BLOCKER) - THE HOLD WAS THE PAGE'S MEMORY ALONE. The slice read the death at the door and wrote nothing until the
  window closed, so a tab killed without pagehide (the task manager, a crash, a phone discarding a background tab - and a
  hidden tab runs no frames, so the slow step never closed it) left the device's record, the realm's line and the realm's
  tombstone all saying alive: the next boot joined and played her (a_kill). A join from another device during the hold
  took the lease, and the dying tab's keepalive tombstone was refused under it (b_twotabs). A Bloodline permadeath and an
  Enduring toll escaped - AUDIT LEGACY A1/B3 reopened, and the slice's "no reload and no closed tab undoes a death still"
  was false. FIXED: the realm holds the death, not the page (CHANGED above) - the door writes it and stamps the
  tombstone with its hold; the Resurrect is the realm's to take back (`/v1/realm/raise`, acct147). Pinned: the kill and
  the second device both end dead (`dead_at` stamped, a join refused 410, the device's record and the realm's line dead,
  the minute's clock closing the window), and a Resurrect within the window raises through the real Worker route
  (`dead_at` cleared, the device's record revived by the stamp, no Succession) - outside the window, under another lease,
  with another character in play, of no line, and twice, refused.
- R2 - THE SCREEN AND THE WINDOW COUNTED TWO CLOCKS. Below ten frames a second the open zone's death screen counted the
  frames' clamped dt while the hold ran on the wall clock: at 7 fps the window closed at 150 s and a Resurrect was refused
  "fallen for good" with the screen still saying "RISING IN 15" (it ran to 172 s - c_lowfps). FIXED: an online death
  screen counts the wall clock, never behind the frames' own count (`deathScreen.js` tick) - every host's, the four share
  the class. Pinned at 7 and 60 fps: the screen goes at 120 s on the wall, raisable to the last.
- R3 - `06-Systems/Legacy-Arc.md` said "relay world208" and "A relay before world208 drops the field" for `fg`: the relay
  is world212 (world208, world209, world210 and world212 went to other branches' relays). Corrected there.
- And the record: "No reload and no closed tab undoes a death still" (legacyHost.js onDeath and this section) was the
  claim R1 refuted - replaced by what now holds it (the realm), as is the FLAGGED list below.

THE FOUR HOSTS: world.js - WIRED, on lines it already had (the frame's rise and the call the realm let go, the pose's `fg`,
the caster's pick, the tombstone's `keepalive` and `hold` with the raise beside it, the page's going); worldModes.js and
dungeonContext.js keep their death screens in the mode's slot, and the same world.js frame hears the Resurrect under them
(`modes?.deathUp?.()`), their resets reaching `legacyDeathReset` through `onlineRespawn` and their screens the same
`DeathScreen` (the wall clock's) - wired through world.js; exterior.js (the fixed city) has no Project Legacy (Legacy-Arc
3's FLAG). Pinned by `test/systems/legacy/fb1016b_rezbloodline.test.js` (5, over the real death door, the host, a realm character born
of the line and its session on the real account Worker - `dead_at`, `rez_lease`, the line's stored record and a union
read off the rows, the Worker's own minute - the line's realm copy, the party wire, RemotePlayers, the caster's
createPlayerMagic, the real DeathScreen and world.js's own statements sliced out and mounted); `tools/mutants/
fb1016b_rezbloodline.json` (114, all dead). PINS MOVED: legacy7_online and legacy7_wed (a fall is two tombstone asks - the
door's hold and the window's close), auditlegacy3 P8 (online the door writes the fall again), auditscale D7 (the minute is
ten statements), sd12_onelife and mwbody1 (the rise line), and the account version in its pin files (acct147); mutants
re-aimed by content: LEGACY7-die-loses, LEGACY7-fall-untombed, LEGACY7-tomb-any-lease, LEGACY7W-why-unchecked,
LEGACY7W-tomb-no-why.

FLAGGED: the relay carries `fg` from world212 on - deploy it with the clients (an older relay drops `fg`, so the caster
spends the spell and the fallen's client still refuses the call); the account service goes first (acct147, migration
0122: the site's deploy waits on its version) - a site ahead of it asks a raise of a service without the route and keeps
the body down; the fix lives on the FALLEN's client (a victim on an old build still rises and sees the line end); a tab
killed in the instant between the death and its tombstone's landing (one round trip) leaves the realm nothing; a death
whose page never closes its window (a killed tab) is never told in the towns' news; the player going on while the realm
answers a Resurrect rises by the host's own respawn (a temple, the death's gold loss) rather than in place; an Enduring
toll a Resurrect gives back stands if another copy's toll was merged in meanwhile; a kinsman struck down in the street
whose realm character still holds a stale lease is held for the window too (what a tombstone takes waits up to the
minute after it); an online Bloodline death screen still says "RISING IN n  ENTER now", and nothing tells the player that
waiting lets a friend raise them (a UI follow-up).

What the reporter is owed: your friend's Resurrection now saves him. While his death screen stands (up to two minutes),
a party member's Resurrection brings him back with his house untouched - no death on the tree, no Succession, no
tombstone. If the death has already been settled (he chose to go on, the time ran out, the page was closed or
reloaded), the caster is told "<name> has fallen for good" and keeps the spell's magicka.

## GRAVE-PARTY: a search is its searcher's party's, above ground and below (13)

`src/systems/searchables.js` (the ledger's name, `searchedText`, the party lens, `searchReachFor`);
`src/scenes/searchPartyHost.js` (new: activateGrave out of bootWorld, the stone said to and heard from the cell);
`src/scenes/searchRoom.js` (new: whose a `srch:` word is); `src/net/overworldLaw.js` owFoldGraves; `src/net/wire.js` the
`gr` kind; `src/net/online.js` sendOverworld 'gr' and the welcome; `server/src/index.js` `_owGraves`;
`src/scenes/dungeonContext.js` applyLoot, lootRecords, searchHeard, activateSearchable, lootTargets and the memory;
`src/scenes/roomLootHost.js` roomUnborn, roomPersonal, roomSettle; `src/scenes/worldModes.js` the headstones' reach;
`src/scenes/world.js` the wiring.

THE REPORT ("A few things"): "graveyard loot on headstones are able to be looted by others, objects in tombs are un
lootable (have not tried dungeons yet)". A "tomb" is the Graveyard's Cemetery dungeon (dungeonType 18, the M0000000-8
crypt blocks), its room `dungeon:m<id>`.

FOUND.
- **Headstones.** `activateGrave` keyed its five hours on this save's own ledger (`searchKey(g.loc, g.key)`,
  `markSearched`) and its find was a pile at the searcher's feet; nothing was said to anyone - Searchables.md's own four
  hosts line read "NOT shared with the party above ground", and the overworld ledger's cell knew only `sp` and `dg`.
  Driven over the real relay Room and real OnlineSessions, a partymate's press searched the stone again - against Mac's
  SEARCH1-PARTY ask ("When one player in the party interacted with it no one else can again for 5 hours").
- **Tombs, three causes.** (1) Every search said `srch:<i>` to the whole room whatever it rolled, and `applyLoot` ->
  `searchHeard` started five hours for everyone who heard it, strangers too - the only answer "You have already searched
  here." - and landed the stranger's list over the holder's own find. (2) A PARTY-LOOT pile whose room word this build
  cannot read (M2's `_lootUnreadable`, a mixed-build room) stayed `roomUnborn` for good: drawn with no plaque and no press,
  M2's own "Reload to open it" never reached. (3) Reach was measured from the eye: on the real pick, from 1.2 m beside a
  0.45 m coffin the eye's ray to its lid runs 1.80 m, past SEARCH_REACH (1.6 m) - "too far"; a coffin answered only within
  ~0.9 m of its side.

CHANGED:
- **The cell keeps its graves.** The overworld ledger's third kind is `gr`: the searcher's game says `[px, py, n]`; the
  relay (`_owGraves`, a Room method of its own) stamps each stone with its own minute and the searcher's verified
  account (`a.sub`), keeps it `OW_GRAVE_KEEP_MIN` (pinned to SEARCH_COOLDOWN_MINUTES), says it to the cell and repeats
  it in the welcome; junk off the cell's widened square is refused; bounded at `OW_CELL_GRAVES_MAX` (and since the audit
  by its searcher, G3); an older relay is told nothing (`relaySupportsOwGraves` - world212 on, since the audit's G1).
  `scenes/searchPartyHost.js` owes the stone until the cell takes it, lands the rows of my party (or my own account)
  through `markSearched` with the searcher's seat name, and keeps a book it reads again at the stone - a partymate who
  searched before the party was made still locks it. The cell keeps them in each relay layer apart (a party plays in
  one).
- **The tomb's word is the searcher's party's.** `srch:` records carry `by` (the account); `scenes/searchRoom.js` decides
  whose a word is (one with no `by`, an older build's, is its live speaker's through the hub's peer map). A stranger's word
  is kept unlanded, read again at the object, and carried in the room's memory for the stranger's own partymates who walk
  in later - bounded hard, as they ride the 512 KB memory (an honest find only, at most four pieces under 4,096 bytes, 4 an
  object, 24 in all, each let go at the room's hour).
- **"Already searched by <name>."** (`searchedText`) for a partymate's search; my own still says SEARCHED_TEXT; the save
  keeps the name.
- **The reach is the body's.** `searchReachFor` measures from the feet-to-head segment to the box's nearest point, in the
  dungeon's lootTargets and the street's headstones alike; the bound stays Mac's 1.6 m.
- **An unreadable PARTY-LOOT container is a target again**, its press M2's own "Reload to open it" (`LOOT_NEWER_TEXT`).
  CORRECTED BY THE AUDIT (G2): this line said it was "the player's own (`roomPersonal`): a target again with its own list,
  said once ... its takes never said to the room nor claimed of the host" - an online pile is built EMPTY, so that list
  was empty (and the pile's flat went at the close), or, composed here before the word turned unreadable, a base handed
  out unclaimed beside every other build's. The arm and its string are gone.
- DEPARTURES, named in Searchables.md: SEARCH1-PARTY's "the room's word starts everyone's five hours" struck (Mac's ask
  was the party's); SEARCH1's "half of the interact range as doors" measured from the body, not the eye. Three new
  strings through `t()`, drafted in the thirteen whole languages (two since the audit: `loot.ownVersion` went with the
  personal arm). The relay's version moves with REZ-BLOODLINE's (one deploy - world210 when this was written, world212
  since the merge past main's HUB-PULL + DO-ASK world210).

THE FOUR HOSTS: world.js - WIRED (activateGrave moved out by tools/hostMove.mjs; construction, routing and frame on lines
it already had; the ceiling LOWERED to 21,638); worldModes.js - WIRED (the headstones' reach); dungeonContext.js - WIRED (both
dungeon hosts have it; dungeon.js has no room and no lens); exterior.js - the bench stands no headstone (pinned). Pinned by
`test/systems/fb1016b_graveparty.test.js` (8 at the slice, 14 since the audit; end to end above ground over the real relay Room
and OnlineSessions, and underground over the dungeon host's own doors); `tools/mutants/fb1016b_graveparty.json` (61 at
the slice, 78 since the audit, all dead). PINS MOVED (each marked): auditsetsonline (M2's personal arm - MOVED BACK by the
audit, G2), auditworld34, auditworld4, world1, world4 (the memory composes strangers' searches;
world4 the applyLoot ask and lootRecords' fields), world8 (lootRecords' fields), dsize1_mediumdungeons, renowngate,
search1_searchables, silverfinds_client (activateGrave in searchPartyHost.js), fb1004c_robes (the reach), ow6_ledger
(owLedgerOf's shape, OW_KINDS, the routing), hostceiling; mutants SETS-M2-dungeon-opens-it, ROBES-dungeon-search-box-raced,
HOST-SPLIT-a-ceiling-under-its-host, OW6H-unheard, OW6H-never-said, OW6L-relay-the-welcome-unsaid, S38-version-not-bumped
and SILVER-FINDS-grave-unasked re-aimed by content, all dead.

FLAGGED, not taken: above ground the FIND is not shared - the stone is locked for the party, its pile the searcher's (a
cell has no container protocol; a slice of its own); a `srch:` word's `by` is a peer's word (a modified client could
name a partymate of mine and lock my coffin - the act channel's existing trust; its `bn`, the audit's G5, likewise); an
older build in the room still lands every `srch:` word room-wide; a stone at a cell seam is said to the searcher's
primary cell (a partymate in the next cell hears it only through a halo); a PARTY-LOOT claim in flight when the word
turns unreadable lapses and recomposes the list.

What the reporter is owed: a headstone your party searched is searched for the whole party, and the game tells you who
searched it; a stranger's search no longer locks anything for you. In a tomb, coffins a stranger opened are yours to
search, and you can search one standing right beside it. A treasure pile that showed but could not be clicked (another
game version in the room) answers now: something in it is from another version of the game, reload to open it
(AUDIT G2: it does not open as "yours alone", which opened it empty). Another of your own characters is told which of
yours searched it (AUDIT G5).

AUDIT (2026-10-16), the slice re-read at `2c968516c2` (the merge that made its relay world212), every finding fixed at
its root, each pinned by a test that fails without its fix and mutation-checked
(`tools/mutants/fb1016b_graveparty.json`, 78 records, all dead - the personal arm's three gone, eight re-aimed by
content, twenty new). THE FOUR HOSTS: dungeonContext.js - WIRED (line-neutral: M2's refusal back in takeLoot, the
plaque's `lootContents`, the searcher's character beside its account at the search and in `searchHeard`); world.js -
unchanged (the search party already reads the live session and hub picture it is handed, and the character's name is the
session's); worldModes.js - unchanged (both dungeon hosts take dungeonContext.js's doors); exterior.js - stands no
headstone and no room container. The findings:
- **G1 (MAJOR) - a headstone's search took its player offline.** `OW_GRAVE_RELAY_MIN` was 208, and main's world208
  (INSTANCES), world209 (WEAPON-GLOW1) and world210 (HUB-PULL + DO-ASK) know no `gr`: their parseClient answers
  `bad ow`, the relay closes the socket CLOSE_POLICY and `net/online.js` makes the session TERMINAL. Now 211
  (`net/wire.js`), and the pin walks world207-211 (the session at each of 208-210 says nothing); the audit's own
  end-to-end script, this branch's session against main's world210 relay, now stays open after a headstone's search. The
  same number in the test's comments and in `06-Systems/Searchables.md` ("_owGraves, world208", "A relay before
  world208") moved with it.
- **G2 (MAJOR) - the "personal" PARTY-LOOT arm was a dead end or a copy.** An online pile is built EMPTY (the pile
  loop's `const items = onlineRoom() ? [] : rollPileItems();`), so an unreadable pile never composed here opened an
  empty list and its flat went at the close (`onEmptied` -> `settleLootFlat`); one composed here and turned unreadable
  handed its base out unclaimed (`roomSettle` stood aside) beside every other build's takes of the same base. The
  slice's own pin hand-built `items: own.map(...)`, a pile production never makes. Chosen: the dead-end-free honest
  design - the pile is a TARGET again (`roomUnborn` no longer holds it), its press M2's own `LOOT_NEWER_TEXT` ("Reload
  to open it": the player is told to update, nothing opens, nothing is copied), its plaque naming no list
  (`lootContents`); `roomPersonal`, its string `loot.ownVersion` (14 locales) and `roomSettle`'s guard are gone, so a
  take under a window opened before the word turned unreadable is lifted and claimed of the host again - one copy.
  Pinned over the pile loop's OWN build of a pile (the slice of `dungeonContext.js` from its list to its push), never a
  hand-built one. `test/systems/auditsetsonline.test.js`'s M2 pin and `SETS-M2-dungeon-opens-it` moved back to the refusal
  (marked).
- **G3 (MINOR) - one account flooded a cell's grave ledger.** A row's key is its stone and its searcher with a stone's
  number in 0..4095, so every word carried fresh rows: four a second for a minute wrote the whole ledger 241 times (3.3
  MB), kept 128 rows and evicted Ann's. Now (`net/overworldLaw.js` capGraves): a cell keeps at most
  `OW_GRAVE_ACCT_ROWS_MAX` (32, pinned to `GRAVE_OWED_MAX`) rows of one searcher, its OWN oldest out past it; past
  `OW_CELL_GRAVES_MAX` the oldest of whichever searcher holds the most - never another's for a flooder's; and the word
  rides its own bucket (`owGraveGate`, a word a second, four deep: the relay's `_owGraves` spends it, and the session's
  `sendOverworld` keeps the same law at home so an honest word is never the one dropped). A word that takes nothing
  writes nothing (it already did). The audit's flood re-run: 64 ledger writes in the minute (Ann's one among them) and
  237 KB, against 241 and 3.3 MB; 33 rows kept, Ann's standing. Pinned over the real Room (`test/fakeRoom.mjs`). The
  relay bundle changed: world211 re-hashed in place (undeployed).
- **G4 (MINOR) - a stranger's forged future stamp never expired.** `scenes/searchRoom.js` kept a stranger's word's `t`
  as said, so a far-future stamp was never let go at the room's hour and filled the 24 kept slots, riding the room's
  memory for good. Now never ahead of now (`Math.min(rec.t, wallNow)`, the WORLD7/8 C2 law applyLoot keeps), and an
  unstamped word is stamped now, so every one goes at the hour.
- **G5 (NIT) - the lock is per account, and it spoke as if the character had searched.** A search on character A locked
  the same account's character B with "You have already searched here." (B never searched). Chosen: the lock STAYS the
  account's (one player, whichever character - an alt's second search is the same player's second find), and the words
  name the searching character: the relay's grave row carries the token's name (`[px, py, n, minute, acct, name]`), a
  `srch:` word its `bn` (the session's issued name), and `systems/searchables.js` `searchToldBy` answers "Already
  searched by Ann." for another character of my account, the old words for this one (`searchSelfName`, the lens's
  `selfName`). Two characters wearing one name (NAME-AS 'account', or a name the service refused) are told the old
  words: they are one name to everyone.
