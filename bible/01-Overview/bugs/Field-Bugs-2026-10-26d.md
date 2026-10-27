# FIELD BUGS 2026-10-26d - five #feature-feedback threads, and the owner's level cap

Five threads from the Discord's #feature-feedback, handed over by the owner as phone screenshots, with one line of their
own: "Also bring the level cap to 45." Read on main's `d5a4c9c6a`, with the freeware's data (`tools/fetch-data.sh`); the
main quest's thread and the boats' and the courtship's were each read by a reader of its own beside this one. The pins
are named under each fix, the mutants `tools/mutants/fb1026d_*.json` - all dead.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Blu3cak3, "Main quest borked": "Level 8 and still no letter from Morgiah ... Other people having issues too", then "If you do not visit Brisienna off the bat ... and instead power level to level 3 you will get a letter from Morgiah" | The letter is S0000999's (the main quest's backbone), and _BRISIEN starts it once. An online birth saves and reloads between that start's first tick and its second; when the reloaded page parsed the backbone before FACTION.TXT landed, the parse threw, `start quest` swallowed it, and nothing started it again. Either order - the measurement could not make Brisienna's matter | MAIN-SPINE |
| 2 | Ony4an, "jewelcrafting, roll chances not equal (h2h, critical)": "i crafted around 100 rare rings (gold and platinum, handcraft not auto) and h2h or critical not roll on them" | LOOT1's lean, as built: jewellery's skill lines lean to the mind's thirteen, and Hand-to-Hand and Critical Strike were two of the open share's thirty-five - about 0.4% of a ring's skill lines each, against a mind skill's 7% | JEWEL-KIN |
| 3 | Wheyrest, "Let us master all three primary skills" (11 votes): "1 minor, 2 major, 3 primary master skills ... helps alleviate the issue of trying to cram in two mastered weapon skills" | SOFTCAP4's 2/2/1, as decided (Mac, 2026-09-29) | MASTER-THREE |
| 4 | "Boat Player Collision": "Player boat collision needs to be off outside of PVP zone or just during the Sethrakul fight too many people out there bumping into each other ruining their shots" | FIELD BUGS 2026-10-01b stood every peer's ship in my collider, so her hull met my helm's sweep as a rock everywhere; in Sethrakul's waters SERPENT4's bumpers shoved ships apart at up to 30 m/s besides | HULL-PASS |
| 5 | lumin, "Better Courtship" (5 votes): "Compliments, giving gifts, hugging, kissing ... Right now it's confusing on what exactly you're supposed to use"; Revy: "the only thing that seems to work is to have 1 conversation per day ... to raise their disposition by 1 point" | The talk's +3 is noted as the window opens, so the panel only ever showed the tone's +1 move; a friend was about twelve days of talk, a courtship eight to ten more, and the courtship's number was shown nowhere | COURT-DEEDS |
| 6 | The owner: "Also bring the level cap to 45" | No cap stood: the level stopped where the sum did - 31 with the class's skills at 100, 44 with every 2/2/1 mastery at 200 | LEVEL-45 |

## MAIN-SPINE (1) - `src/systems/quest/mainSpine.js`, `src/systems/quest/machine.js`

WHAT DFU DOES. `_BRISIEN.txt`'s `until _exitstarter_ performed` block runs `start quest 999 999` on the game's second
tick - the backbone's one start. S0000999 sends every royal letter of the opening (Morgiah's at level 3: `_S.46_ when
_S.11_ and _S.18_` - a regard of 0 or more with her, and level 3; Lhotun's at 5) and starts each court's first quest.
Meeting Brisienna touches it once: `MetLadyBrisienna` writes a journal line. StartQuest asks QuestMachine.StartQuest and
marks itself done whatever ParseQuest answered; ParseQuest's try/catch answers null (`QuestMachine.cs:670-687`).

WHAT THE PORT DID. Parsing S0000999 reads seven royals' faction records (WhenNpcIsAvailable, WhenReputeWith -
`person.js` getFactionDataOrThrow), and the world host answers from townTalk's FACTION.TXT, read fire-and-forget at boot.
The wizard's `onDone` starts _BRISIEN, its first tick puts up message 1025 - and the quest tick waits while that box is
up - and `realmBirth` saves and replaces the page: an online character's first save is very nearly always taken between
the backbone's start's first tick and its second. The reloaded page's first tick parses S0000999; if FACTION.TXT has not
landed, it throws "Could not find faction data for FactionID 382" (Prince Lhotun, the first `when ... is available`),
`scheduleQuestByName` swallows it, StartQuest is done, and the backbone never exists. Brisienna's own letter still comes
(its timer is in the same block); no royal letter ever does. Reproduced through the real bridge, the vendored scripts and
the real FACTION.TXT, with online's clocks, both orders - meeting Brisienna at level 1 first or reaching level 3 first -
lose it alike; every later save point, a faction store missing for a tick mid-wait, and the letter's own wait all
deliver. The report's correlation with Brisienna is the second character's luck, not her: its page won the race.

FIXED - A DEPARTURE (`Port-Ledger.md` section A). A LOST BACKBONE IS STARTED AGAIN (`mainSpine.js` spineOwed,
`machine.js` keepSpine from `tick`, every SPINE_CHECK_TICKS = 30). The machine records, and saves with the game, the
two facts the law reads (`machine.spine`): `opened`, this game's opener began - its start, or a saved table or the
journal's archive naming it - and `ran`, its backbone began - its start, or a saved table naming it. A game is owed its
backbone when its opener began (and, while the opener stands, has run its `start quest 999 999`), no backbone has begun
or is scheduled, and no step of the story has begun. A parse that fails again (the records still away) is asked again
at the next check, said once a page; a character who lost theirs before this law, its opener standing or filed in the
journal - or with neither, by the Curse (S0000977) every port birth starts beside it (AUDIT FB1026d II A1) - gets it
back on its next session, at once owed every letter its level has earned. Named, not repaired (AUDIT FB1026d below): a
classic import, which starts no quests and so has neither opener nor Curse of its own - the classic game's
MetLadyBrisienna is not read; a backbone this record saw begin and a load then dropped, which ran (II A2); and a save
from before it that dropped its backbone at a load and was saved without one, which is owed it again.

Pinned by `test/systems/quest/fb1026d_mainspine.test.js` (the real bridge over the vendored quests, a cold page's
missing faction records, both orders, and the game's own FACTION.TXT where ARENA2 is fetched; a save that already lost
it; a classic import's globals; an opener met and gone, filed in the journal; the record saved and loaded; a backbone a
load drops; owed never with a story begun, a backbone begun or scheduled, or an opener whose start is still to run).
Mutants `tools/mutants/fb1026d_mainspine.json` (15, dead).

## JEWEL-KIN (2) - `src/systems/loot/lootRarity.js`, `src/net/productRecord.js`, `src/systems/smithItems.js`

WHAT DFU DOES. Nothing to follow: the ladder's affixes are the port's own (`06-Systems/Loot-Arc.md`).

WHAT THE PORT DID. Measured through the real `mintPiece`, 20,000 Masterwork rings of each metal: a ring carries about
2.5 skill lines, 85% of them one of the mind's thirteen; Hand-to-Hand was 0.42-0.47% of its skill lines and Critical
Strike 0.40-0.43%, Illusion 7.07%. A hundred Rare rings held no Hand-to-Hand line a third of the time - the report's
"never" is LOOT1's law, not a fence.

FIXED. Jewellery leans to the bare hand's two besides the mind's thirteen (`JEWEL_KIN`): Hand-to-Hand is no weapon's
own and Critical Strike a weapon's strike kin, but a ring is where a fist fighter's jewellery line has to come from
(AUDIT FB1026d II D5). Each of the fifteen takes about one skill line in
sixteen; a hundred rings without a Hand-to-Hand line is a chance of one in millions (a ring lacks one about 85 times in a hundred, measured per ring - AUDIT FB1026d C6). A found ring takes the lean at once.
A crafted piece is minted again from its signed record on every client, so the lean rides a new mint version:
`MINT_V_JEWEL_KIN` 4 (3 on this branch, renumbered past main's ARMOR-LEAN, `MINT_V_ARMOR_LEAN` 3, at the merge). A craft
names the version its client mints (`accountClient.js` craft's `mint`) and the account service stamps that, never past
its own (`productRecord.js` craftMintVersion, acct197); a client from before the ask is
stamped `MINT_V_LINES` - the service deploys before the site, and a tab left open or a desktop install keeps its build,
so a stale client's ring is the same ring in its pack and in every other reader's. A record of 3 or less mints on the
mind's thirteen (`skillKin`'s `fists` false) and a ring already made keeps its lines.

Pinned by `test/systems/fb1026d_jewelkin.test.js` (the report's rings through `mintPiece` at 3 and at 2, the odds per
ring; a found ring as the loot list makes it; the Legendary's fallback; the craft's version through the real client and
Worker); pins moved by intent: `loot1_kin` (the kin), `fb1013e_craftprocs` and `affixlines_reforge` (the version, 4 since the
merge), `prof10_client` and `prof7_client` (the craft's shape and its `mint`, AUDIT FB1026d II F5). Mutants `tools/mutants/fb1026d_jewelkin.json` (12, dead).

## MASTER-THREE (3) - `src/systems/masterSkills.js`

WHAT DFU DOES. Nothing past 100: Master Skills is the port's own (SOFTCAP3).

FIXED. `MASTERY_SLOTS` 3 / 2 / 1: every primary skill may be mastered. A character who chose two keeps them and has the
third slot now. Every Master Skills box and the skill screen say 3. A martial or arcane path whose pair is two weapons
or two schools among the primaries can now stand beside a third primary mastered (it was reachable under 2/2/1, with
the third primary left at 100); the Growth guide reads the slots, so it follows.

THE WORKERS. `masterSkills.js` is in both Workers' bundles (reached through the skills' law), so its bytes moved both
versions: the relay's RELAY_VERSION world271 (no relay code reads the slots - nothing it does moved) and the account
service's acct197 (taken with JEWEL-KIN; world269, then world270, and acct195, then acct196, on this branch, each
renumbered past main's own at a merge). Neither needs the other deployed first. Every pin of the two versions moved
with a PIN MOVED note (61 test files), and the two records that name the relay's line re-aimed.

Pinned by `test/systems/fb1026d_masterthree.test.js`. Pins moved by intent - each fixture that spent "the primary slots"
on two now spends a group still at its cap (the majors' two, or a career whose third primary is a weapon):
`audit_martial`, `fb1019b_audit`, `growth1_tab`, `specreset` (an AUDIT SPEC-RESET mutant had survived the first move -
Destruction's third slot reached a path on its own - and the fixture was re-aimed until it died). Mutants
`tools/mutants/fb1026d_masterthree.json` (5, dead).

## HULL-PASS (4) - `src/scenes/comeSailAway/peerHulls.js`, `src/scenes/naval/navalHost.js`

WHAT DFU DOES. Nothing to follow: DFU has no other players.

WHAT THE PORT DID. Come Sail Away's `CheckCollision` sweeps the hull with the host's `sphereCastAll` (world.js
csaSphereCastAll), and every peer's ship stands in my collider (FIELD BUGS 2026-10-01b, Mac: "Players aren't colliding
with other players' boats") - so her hull cancelled my way into her and refused the turn toward her, everywhere. In the
serpent's waters SERPENT4's bumpers pushed my ship off every peer's at up to 30 m/s besides.

FIXED. Another player's hull meets my helm only inside a PvP zone (`peerHullsMeet`: `wildZone.js` wildHere - the
Eltheric Ocean past Veilhaven's peace, the Wrothgarian Mountains; the zone alone, as the report asked - a ship the
broadsides spare there still meets mine), the host handing Come Sail Away the sweep through `peerHullSweep`. WHAT
PASSES MY HELM PASSES MY DECK: her hull stays in my collider - her deck walked and stood on, a swimmer meeting her side
- but outside a zone, while my body stands on a deck (my helm's, another's I am aboard, the one under my feet, kept
through a jump while my feet stay over it), every player's hull overlapping that deck's leaves my collider until they
part, and the aboard door never boards one from the air (`hullsStood`, `hullPassesMyDeck`: each hull's plan an
oriented box off its own colliders, `navalShips.js` hullOverlap). THE ZONE TURNING DOES NOT JAM THEM: a hull already
through my deck when hulls start to meet goes on passing until it is clear of it (the latch); one that comes into it
after meets it. My own boats, a sea ship, a rock and the ground are swept as before. Sethrakul's site stands on the
Bay's lanes, never in the ether's box, so the fight is always outside a PvP zone - and the bumpers, which ran only
there, are retired (`withBumpers`, `bumperDrift`, `BUMPER_*` gone; createNavalHost 10 logical lines out, its ceiling
6,259 -> 6,249). The host's three seams are three lines changed in place (the sweep's entry, csaSyncColliders' boats,
`deckGround`) - bootWorld does not grow. THE FOUR HOSTS: `scenes/world.js` wires it; `worldModes.js` (a building) and
`dungeonContext.js` (a dungeon) stand no one's boat, and `exterior.js` (the fixed city) has no peers.

Pinned by `test/scenes/fb1001b_peerboats.test.js` (HULL-PASS: the sweep as wired, outside a zone and in one; a ship
sailed through the deck I stand on, both ways, jumping; the zone turning PvP over two overlapping hulls through Come
Sail Away's own CheckCollision - all over the real pool, peers, aboard machine, collider and motor); pins moved by
intent: `serpent4` (the bumpers' test now pins them gone) and `serpent1_client` (the drift line); SERPENT4's four bumper
mutants retired with the code. Mutants `tools/mutants/fb1026d_hullpass.json` (10, dead).

## COURT-DEEDS (5) - `src/systems/legacy/courtDeeds.js`, `src/scenes/legacyHost.js`, `src/systems/livingWorld/relations.js`

FIXED - the law is `06-Systems/Legacy-Arc.md` COURT-DEEDS. Four rows on the Tell me about page beside Courtship: Pay a
compliment, Give a gift (50 gold), Hug (a friend's, or a courtship's), Kiss (a courtship at 34, a betrothal or a
marriage) - each once a day per resident, each raising the regard (+2, +8, +3, +4) and a courtship's affection (+3, +6,
+5, +8), and each answer saying what it moved, the talk's tone with it (the row hears the tone itself, `townTalk.js`
`hearsTone`): "(Regard +2, now +14. Courtship +4, now 41 of 100.)". A hug or a kiss not yet welcome says what it waits
on, read against the regard as it stands, and costs nothing. Each deed's day is stamped on the Living World's regard
(the character's save) and, where it warmed a courtship, on the courtship (the house's record, `marriage.js`
warmCourtship), so a load that hands back the one never hands the affection again. The regard badge names the deeds as
they are offered, and the Family page names them.

Pinned by `test/systems/legacy/fb1026d_courtdeeds.test.js` (a reload through the real mod-save registry among them);
pins moved by intent: `lw1_livingWorld` (EVENTS: a compliment, a hug, a kiss), `plainui` (the badge names the deeds as
offered). Mutants `tools/mutants/fb1026d_courtdeeds.json` (26, dead).

## LEVEL-45 (6) - `src/systems/levelCap.js`

WHAT DFU DOES. No cap: PlayerEntity.CheckForLevelUp raises the flag whenever CalculatePlayerLevel's floor((current -
starting + 28) / 15) passes the level.

FIXED - A DEPARTURE (`Port-Ledger.md` section A). `LEVEL_CAP` 45 on both lanes: Daggerfall's sum owes no level past it
(`checkForLevelUp`), the virtue bar fills and holds (`checkForVirtueLevelUp` - a bar that takes nothing from a skill at
100 reaches 45 with every skill below it, AUDIT FB1026d II C1), a level latched before the cap is never
spent at it (`applyLevelUp`, `commitVirtueLevelUp`) and is let go where it is read - the load, the crossing online
(`realmCustoms.js` crossLeveling), both checks, the sheet's door and its rollout (`levelCap.js` releaseCapLatch; the
Oghma Infinium's latch is the book's and is kept) - and the Level box ("The highest level is 45: no more levels are
gained.") and the level-up bar ("Highest level reached") read whole. The ceiling it names: a class whose six counted
skills reach 200 under the 3/2/1 masteries climbs to 47 for a starting sum of 156, so 45 is reached at the end of the
long climb past 100 by a career as made, with Master Skills on - every starting sum up to 193 reaches it, and the
largest a character can be made with is 169 (184 with a Legacy heir's hearth). A skill swap that raises the class's sum lowers its ceiling a level for
every 15 points (a primary at 30 swapped for a skill at 100 leaves a 156-start character 42), and with Master Skills off
the ceiling is 29 to 32. A level already past it is kept.

Pinned by `test/systems/fb1026d_levelcap.test.js` (the windows driven: the door, the virtue screen, the classic sheet;
the load and the crossing). Mutants `tools/mutants/fb1026d_levelcap.json` (18, dead).

## AUDIT FB1026d (2026-10-26, the owner: "Audit this")

Five cold lanes, each read-only over the pull request at `a7d8888c9` against `d5a4c9c6a`, given the files and the
reports and never this record's conclusions: A the main quest's backbone, B the courtship's deeds, C the level cap,
the masteries and the jewels, D the peers' hulls, E this record and its pins. Every finding was measured again here
before anything moved; the sections above say the law as it stands now.

| ID | Finding | Lane | Done |
|---|---|---|---|
| A1 | HIGH. A classic import was owed a backbone: MetLadyBrisienna alone counted, and an import starts no quests - one whose classic main quest was over had it end at once and restarted every game week, its royal letters sent again each time | A | FIXED: the machine records its own opener and backbone (`machine.spine`, saved); the classic global is not read |
| A2 | MEDIUM. A save from before the law whose opener never met Brisienna and has failed, ended and gone is never repaired | A | SAID: a failed opener files nothing, and nothing else tells it from a classic import - named in `mainSpine.js` and above (FIXED by AUDIT FB1026d II A1: the Curse tells it) |
| A3 | MEDIUM. The "met Brisienna" route, a tombstoned backbone, the start's `isComplete` and "any start" were unpinned | A | FIXED: the met route is the journal's archive now (pinned); a backbone on the table is `ran` (pinned); `isComplete` pinned. "Any start" is equivalent - _BRISIEN holds one StartQuest |
| A4 | LOW. The `storyLegacy` guard never applied (seedStory clears it before any tick); three sentences claimed it | A | FIXED: the guard and the three sentences deleted |
| A5 | "None begun is one that never ran" was false - a backbone runs for as long as the courts' quests wait on a click | A | FIXED: reworded around the record; a backbone a load drops reads `ran` off the saved table (pinned) |
| A6 | LOW. Two warnings every 30 quest ticks while the records stayed away | A | FIXED: said once a page each - the failure and the start (pinned) |
| B1 | HIGH. A reload handed every deed's affection again, for gold the reload gave back - the affection rides the house's record, the stamp the save | B | FIXED: each deed's day stamped on the courtship it warmed, kept by the house's loader (pinned through the real mod-save registry) |
| B2 | MEDIUM. The hug's gate read the regard as the page opened | B | FIXED: the regard as it stands when answered (pinned) |
| B3 | LOW. The tally left out the tone's cost in the same answer | B | FIXED: a deed row hears the tone itself (`townTalk.js` `hearsTone`) (pinned) |
| B4 | LOW. The badge promised deeds to the watch, travellers and kin | B | FIXED: worded as offered, to a townsperson one could court |
| B5 | LOW. Eight probe mutants lived (the house's own, another's betrothed, the hug's courtship arm, the gift's affection, an ill compliment, the save, the Living World guard, `surfacePlayer`) | B | FIXED: each pinned; `surfacePlayer` removed - it only exposes the entity to the screenshot page |
| B6 | Ten days of talk (measured 12), seven of Courtship (8-10); the tally's comment; a warm of nothing written | B | FIXED |
| C1 | HIGH. A virtue level-up latched past the cap was a window that never closed | C | FIXED: `releaseCapLatch` at the load, both checks, the door and the rollout, the virtue screen's confirm a backstop - the door driven (pinned); the Oghma latch kept |
| C2 | MEDIUM. The classic sheet handed out a pool with no level; crossLeveling carried the latch online | C | FIXED (pinned) |
| C3 | MEDIUM. A stale client minted v3 records on the old lean - one piece, two sets of lines | C | FIXED: the craft names the version its client mints, the service stamps at most its own, a client that names none MINT_V_LINES (`craftMintVersion`, acct197; JEWEL-KIN is version 4 since main's ARMOR-LEAN took 3) - through the real client and Worker (pinned) |
| C4 | LOW. The Level box said "45" to a character kept past it | C | FIXED: "The highest level is 45: no more levels are gained.", in all 25 languages |
| C5 | LOW. `>=` read as `===` and the Level box's text lived | C | FIXED (pinned past the cap) |
| C6, E9 | "One in a thousand" for a hundred rings without Hand-to-Hand (measured: one in millions); "reachable where it was not" | C, E | FIXED, measured per ring in the pin |
| C7 | "45 for every character" too strong | C | FIXED: a career as made with Master Skills on; a swap lowers it; off, 29-32 |
| C8 | LOOT1's header, Martial L3 F5, Arcane's five masteries, the account note | C | FIXED |
| D1 | HIGH. A ship let through my hull sailed her deck through the body on mine - shoved off, or carried away aboard her | D | FIXED: outside a zone every player's hull overlapping my deck leaves my collider and is never boarded from the air (`hullsStood`, `hullPassesMyDeck`) - both ways, jumping, through the real motor (pinned) |
| D2 | MEDIUM. Hulls overlapping as the zone turned PvP were jammed | D | FIXED: the latch, through Come Sail Away's own CheckCollision (pinned) |
| D3 | LOW. "A ship you may fire on is one you may run against" - the gate is the zone alone | D | FIXED: the sentence says what the gate is, as the report asked |
| D4, E5, E6 | The bumpers, the LOOT ARC's lean, the EVENTS list, 2/2/1 and the tally's parenthetical stated as current | D, E | FIXED |
| D5 | LOW. The pins proved the wrapper; `HULL-PASS-bumpers-back` died only as a ReferenceError | D | FIXED: behavioural pins; that record retired |
| E1, E2 | The met route unpinned; "gets it back on their next session" too broad | E | FIXED by A1-A3; the gap named (A2) |
| E3, E4 | The Level box's text and the deeds' save unpinned | E | FIXED (C5, B1) |
| E7 | The re-aim count: 24 records re-aimed (the 18 named, the 2 relay records, and COURT-DEEDS' 4 - `lw7` LW7-tone-twice, -tone-shared, -tone-unloaded, `lw14` LW14-poached-once) and 4 retired; 2 of the 18 (the Level box, the virtue commit) are LEVEL-45's; `546f53bb3`'s "22 re-aimed or retired" is 22 re-aimed and 4 retired; the cite shift (citedrift, faceuvresidue, probehygiene, `passiveSpecials.js`, `prepare.sh`, three bible pages) unsaid | E | SAID, here |
| E8 | The account records' note chains | E | FIXED at the merge (and the wrangler record's, stopped at acct191 on main) |
| E10 | The Family page's deeds, `isComplete`, the fallback's `fists`, a kiss past a marriage | E | FIXED (pinned and recorded) |
| E11 | A hand-built ring, a stand-in FACTION.TXT, a serpent pin's title | E | FIXED: the loot list's own jewellery; the game's FACTION.TXT where ARENA2 is fetched; the title says what it checks |
| E12 | `546f53bb3` red on its own; world269 below world268 | E | SAID (pushed history is not rewritten); the row order fixed at the merge |
| E13 | fr `legacy.deed.poor` read "short by 50" | E | FIXED |

SAID, NOT CHANGED. A2. A client older than MINT_V_LINES is stamped 2 (that law's own exposure, acct187); a client that
reads a record past its own MINT_VERSION (a newer maker's, on the market) re-mints it on its own newest law - refusing it
would hide the piece, so nothing is refused. The Oghma Infinium's latch is not saved (a pending book at the cap, saved
and loaded, reads as a level owed and is let go - as it was already lost there). Two mutant records survive on `main`
as on this branch, neither this change's: `audit30.json` AUDIT30-S5-a-piece-listed-off-the-road (`market.js`) and
`csa_together.json` CSAL-pad-bare-dpad (`gamepadInput.js`). This record was
`Field-Bugs-2026-10-26b.md` on its branch, then 26c; `main` gave those names to WOVEN-PAYS and to the Morrowind body
(#1327) first, so it is 26d (and its tags FB1026d).

THE MERGE. `main` at `829fc148d` was red on its own: BAL-ARCHERY (`2814b512c`) renamed the arrows' flight to
ARROW_FLIGHT_SPEED and left six mutant records (`audit_martial`, `techfx1` x3, `tell6d` x2) quoting the old lines and
`techfx1.test.js`'s Volley timing reading MISSILE_SPEED. Ported here: the records re-aimed by content (227 dead) and the
test reading the constant the shafts fly at.

THE LATER MERGES. `main` took acct196 (WOVEN-PAYS), world269 (BOW-TOPS) and mint version 3 (ARMOR-LEAN, an armour's
lines on its family's leans) while this branch was open, and then world270 (CHAT-POST): JEWEL-KIN is acct197, MASTER-THREE world271 and
`MINT_V_JEWEL_KIN` 4 - a
record of 3 keeps the jewel's old lean, pinned - and the record moved from 26b to 26c, the name main gave WOVEN-PAYS, then to 26d, past
#1327's 26c.

PINS. The six `fb1026d_*` tests and `fb1001b_peerboats`; mutants `tools/mutants/fb1026d_mainspine.json` (15),
`fb1026d_courtdeeds.json` (26), `fb1026d_levelcap.json` (18), `fb1026d_jewelkin.json` (12), `fb1026d_hullpass.json`
(10), `fb1026d_masterthree.json` (5) - all dead. Pins moved by intent, each with its note: `fb1013e_craftprocs`,
`prof10_client` and `prof7_client` (the craft names its version), `plainui` (the badge as offered), `csa_together` (the boats' loop and
`deckGround`), `serpent4` (its title), `techfx1` (the merge). Records re-aimed: `audit30`, `csa_together`,
`fb1001b_peerboats`, `fb1013e_craftprocs`, `prof10`, `prof9` (the lines this moved) - all dead.

## AUDIT FB1026d II (2026-10-27, the owner: "Audit this", again)

Six cold lanes, each read-only over the pull request at `45be42de6`, given the files and the reports and never this
record's conclusions: A the main quest's backbone, B the courtship's deeds, C the level cap and the masteries, D the
jewels, E the peers' hulls, F this record, the pages, the description, the translations and the pins. Every finding
was measured again here before anything moved; the sections above say the law as it stands now. `main` had moved to
`9471513f8` meanwhile (RAM-RETURN, CHAT-POST), so the branch merged it first (`548f8f166`, below).

| ID | Finding | Lane | Done |
|---|---|---|---|
| II A1 | MEDIUM. A save from before the record whose opener left no trace (never met and gone, or met and its journal entry cleared) was never repaired - and the first audit's A2 said nothing told it from a classic import | A | FIXED: the Curse (S0000977) on the saved table is the opener's trace - every port birth starts it beside `_BRISIEN` (`questBridge.js` GAME_START_QUESTS), an import never (`mainSpine.js` SPINE_CURSE, `spineRecord`); both paths pinned to Morgiah's letter at level 3 |
| II A2 | LOW. A pin's title said a dropped backbone's letters were sent; it had sent none | A | FIXED: the title and `mainSpine.js`'s exceptions name it - it ran, and a restart could send its letters twice |
| II A3 | LOW. "was owed - started" said of a backbone only scheduled, and said again if its start failed | A | FIXED: "scheduled", once a page (`machine.js` keepSpine) |
| II B1 | MEDIUM. A save loaded from days before refused every deed with the one courted ("Once a day is plenty") until the courtship's last stamped day passed | B | FIXED: the save's own stamp refuses the day; the courtship's gates its warm alone - the regard as the save stands, the affection never twice (`legacyHost.js` answerDeed; pinned) |
| II B2 | LOW (lane F's F2, MEDIUM). A refused deed still heard its tone - a Polite word cost 6 regard, said nowhere, under "You do not lose gold or regard" | B, F | FIXED: the tone is heard as the deed lands; a refusal costs nothing (pinned) |
| II B3 | LOW. "If you load a save, you cannot use it again on that day" false where no courtship was warmed | B | FIXED: the patch notes say the law - a load never gives a deed's courtship twice |
| II B4 | LOW. The regard badge promised the deeds where Project Legacy, which offers them, is off | B | FIXED: "with Project Legacy" (`people.js`), and the patch notes say it; the gate pinned on a founded house turned off |
| II B5 | LOW. The deeds' day turns at 4 in the morning (the Living World's), Courtship's talk at midnight | B | SAID: two laws older than the deeds (`regardClock.js` regardDayOf, `marriage.js` dayOf), written in Legacy-Arc |
| II B6 | LOW. The description named the 26c files | B | FIXED |
| II B7 | LOW. "No Living World: no deeds" pinned a state the host never reaches | B | FIXED: the title says the host's guard, and Project Legacy off is pinned beside it |
| II C1 | MEDIUM. "You get the last levels when your mastered skills go above 100" false on the virtue bar, which takes nothing past 100 and reaches 45 below it | C | FIXED: the patch notes say the classic system; `levelCap.js`, the Ledger row and this record say the virtue bar's reach |
| II C2 | MEDIUM. The Oghma Infinium's latch survived a load in place - the book's thirty points again with the book back in the pack, and a latch kept past the cap | C | FIXED: a load ends it (`save.js` restorePlayer), as a fresh entity's; pinned both ways |
| II C3 | LOW. At the cap the level window read "Highest level reached: 1/1", every skill row counted toward a next level, the Level page's lead promised one | C | FIXED: the label alone, no row's note, the sheet's own cap line as the lead (`levelUpView.js`, `enhancedLevelUp.js`, `growthTab.js`) - no new words |
| II C4 | LOW. `wire.js` said a player is level 30 at most; Realm-Arc listed the online level cap OPEN | C | FIXED: the comment says the frame's bound (30 stays, Mac's call - PEER-CAST), with this relay change as PEER-CAST asked; Realm-Arc's item answered |
| II C5 | LOW. MASTER-THREE's martial pin held under 2/2/1 too | C | FIXED: the Long Blade and Archery path pinned as offered |
| II D1 | MEDIUM. A craft naming `mint: 1` bought the retired pre-AFFIX-LINES law (a damage line on every blade, a ring's carrying line) - the C3 fix's opening | D | FIXED: a name below MINT_V_JEWEL_KIN is no build's and is stamped as none, MINT_V_LINES (`craftMintVersion`); through the real Worker |
| II D2 | LOW. "A piece looks the same to all players" false for a reader on an old build | D | FIXED: the patch notes and Loot-Arc say an old version can show other lines until it updates |
| II D3 | LOW. A client on the release before names no mint, so its armour leaves ARMOR-LEAN's family lean until it updates | D | SAID: 2 is the newest law every build reads alike; written in Loot-Rarity's ARMOR-LEAN and Loot-Arc |
| II D4 | LOW. "1 skill line in 250" before; the weights give 1 in 233 | D | FIXED: "approximately 1 in 230" |
| II D5 | LOW. Critical Strike is a weapon's strike kin, not "nowhere to lean but armour's"; the craft route's contract lacked `mint?`; a pin compared a record with itself | D | FIXED: `lootRarity.js`, this record, Loot-Arc, `server-account/src/index.js`; the pin reads the stale maker's own law |
| II E1 | MEDIUM. Outside a PvP zone my helm sailed through my own moored ship - one owner's hulls passed each other | E | FIXED: a hull of the deck's own owner never passes (`peerHulls.js` ownerOf, the peer key's owner); pinned through Come Sail Away's CheckCollision |
| II E2 | LOW. Aboard hers with my ship overlapping, my own ladder dropped me through my deck onto her hull | E | FIXED: Come Sail Away's BoardBoat says the deck it set me on (`deckPressed`), kept while the host's word stands and my feet stay over it; her ladder after boards her (pinned) |
| II E3 | LOW. The zone is read from my own pixel: at the line a ship just inside meets one just outside, which passes her | E | SAID: every zone law reads its own player's pixel (`wildHere`); both pixels on every sweep is more code than the strip it covers |
| II E4 | Lane E's suspicion: a deck the pool let go, kept while my feet stood over its plan | E | FIXED: a boat the pool no longer holds is no deck (pinned) |
| II F1 | HIGH. `main` took world270 (CHAT-POST); the branch conflicted and ran no workflow | F | FIXED at the merge: MASTER-THREE is world271, every pin's note first and renumbered, the LAW row re-hashed |
| II F3 | LOW. "A friend in about three days" holds with a compliment and a gift each day | F | FIXED: the notes, `courtDeeds.js` and Legacy-Arc say so (eight without the gift, twelve with the talk alone) |
| II F4 | LOW. The description's facts: the cites (3293), the strings (23, `charsheet.levelCap` among them), the renames, the re-aimed lists, the later merges | F | FIXED |
| II F5 | LOW. This record's "version 3" pins, `prof7_client` missing, the no-mint client's armour unsaid | F | FIXED (and II D3) |
| II F6 | LOW. `disc7`'s list had lost main's world269 and its note said world269 | F | FIXED at the merge |
| II F7 | LOW. Active-Arcs' SERPENT4 bumpers in the present; Testing-Rows' `loot1_kin` row the mind's alone | F | FIXED |
| II F8 | LOW. STE: "also if", bold on skills and names, "Give a gift" for "Give a gift (50 gold)" | F | FIXED in the description |

SAID, NOT CHANGED. II B5, II D3 and II E3 above. Lane E's other suspicion - a peer's boat rebuilt while it overlaps my
deck in a PvP zone is not in the latch and meets my helm - stays unproven and unchanged: the latch is for hulls already
passing, and a rebuilt boat is a new one. `main` at `9471513f8` is red on its own since CHAT-POST (#1342): `bootWorld`
17 logical lines and `createWorldModes` 2 over their ceilings, twelve mutant records (`chat_find`, `chatchan` x3,
`emote1` x6, `mod1`, `staff-chat-red`) quoting lines it moved, and two source pins (`guild1c`, `partytravel`) - none of
it this change's, the merged hosts at main's own counts; no fix stood when this was written.

THE MERGE. `main` took world270 (CHAT-POST) and RAM-RETURN's rams: MASTER-THREE is world271 (world269, then world270,
on its branch), `csaSyncColliders` keeps RAM-RETURN's word beside `hullsStood`, and Systems.md counts 825 modules. The
relay records `nirnrootsage` NIRNROOT-SAGE-relay-unmoved and `soc1` S38-version-not-bumped quote this branch's
RELAY_VERSION line and are re-aimed to it.

PINS. `fb1026d_mainspine`, `fb1026d_courtdeeds`, `fb1026d_levelcap`, `fb1026d_jewelkin`, `fb1026d_masterthree`,
`fb1001b_peerboats`; mutants `tools/mutants/fb1026d_audit2.json` (15, dead). Records re-aimed by content: twelve of
this change's own (`fb1026d_courtdeeds` x5, `fb1026d_hullpass` x2, `fb1026d_jewelkin`, `fb1026d_mainspine` x3, and
COURT-DEEDS-day-off-the-courtship onto the warm's own gate) and the two relay records; COURT-DEEDS-regard-before-the-tone
retired - the tone is heard after the gate, so its shape is gone (`fb1026d_courtdeeds.json` 25). Every record within
fifteen lines of a change, and every record of this change's lists, run again: 140, all dead. Pins moved: `audit32_client`
S6 and `prof10_client` (the craft route's `mint?`), `plainui` (the badge's words). RELAY_VERSION world271's LAW row
re-hashed in place, undeployed.
