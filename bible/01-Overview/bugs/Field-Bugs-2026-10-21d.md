# FIELD BUGS 2026-10-21d - the Discord's bug-reports, read to their roots (the owner: "No band aids")

Five threads from the Discord's #bug-reports (2026-10-21), handed over as screenshots with "No band aids": from Krinton,
DiabeticCat (CrazyComrade beside it), Hulk Hogan and iamamitten, lumin, and Harlander. Each was traced end to end on the
real producers - the freeware's data (`tools/fetch-data.sh`) where the map decides, Daggerfall Unity's C# where it is the
reference - and every finding below was measured again before it was fixed. Read on the code as it stands at main's
`8089d374f`. The calls the reports left open are taken here, under the owner's standing word on these threads (Mac,
2026-10-19: "Stop with the decisions for me"); each section says which it took and why. The pins are `fb1021d_*`, the
mutants `tools/mutants/fb1021d_*.json`. AUDITED the same day, before its merge (AUDIT FB1021d, the owner: "Audit this" -
five cold lanes, one a report); what it changed is marked in the sections with its finding's id, and the last section
says every finding and what became of it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Krinton: "would cast the teleport spell at the beginning of the dungeon then would randomly get rubber-band back to the entrance" (Edworyan Laboratory) | Not the spell. Since FLAT-RELAY (2026-10-05c) a walk under an acting FLAT relay fired it, which Daggerfall Unity never does; the online build of the Daggerfall region's Edworyan Laboratory starts in N0000014, where six hanging roots each send the body to the start | FLAT-WALK |
| 2 | DiabeticCat: "Quest wont complete even after a real life day" (The Lost Artifact, both objectives DONE); CrazyComrade: "not being able to get quests anymore after turning in..." | B0B81Y02's knight pays and the quest stays open on a travel clock of 21 to 38 days whose `end quest` is a `when` on it - which BODYGUARD-CLOSE's reading could not see; online those days are played, and the open quest shuts the Order's door | RAVEN-CLOSE |
| 3 | Hulk Hogan: "Guards will still chase you down and kill you, even if you have already been to prison"; iamamitten: "Does serving time NOT count as 'doing penance'?" | A sentence gave back the charge it tried and nothing of the name it was priced by: a name under the watch's line before the arrest (A0C00Y17's escort refused to the watch: -20) walked out as known; the road's patrols ignored the release's grace; a Curfew town kept two points a sentence | SENTENCE-MENDS, PATROL-GRACE, CURFEW-REFUND |
| 4 | lumin: "I can raise it, then after a while it resets back to baseline" - "Better feedback and controls on finding a spouse" | A resident's regard eased and counted words in the SKY's days, which online are a real hour each and run while the player is away: nought at every login; and nothing said when someone became a friend | REGARD-OWN |
| 5 | Harlander: a booked passage - "You can steer the ship as if it was yours", "Fast travel gets stuck on docks and tries to path up onto land", "The ship control controls appear on top of the fast travel controls", "Boats go at slow time compression for unclear reasons" | The passenger's keys ORed into her helm; legs aimed at the built ground's land and a resume refused at her own port's roadstead; the ship's plate drawn over the journey's block - the readout that says why the clock is held | PASSAGE-HANDS, PASSAGE-IN, PASSAGE-PLATE |

## FLAT-WALK: a walk hears no flat relay (1)

`src/world/actionSystem.js` (`walkHears`), `src/scenes/dungeonContext.js` (collisionTriggers).

FOUND. The Teleport spell is not the cause: its Start, PromptPlayer and SetAnchor match Teleport.cs and leave no live
bundle. The dungeon moves the player itself. RDBLayout.AddAction gives an acting flat ("FLT") a BoxCollider with
`isTrigger = true` - "for raycasting" - and DaggerfallActionCollision hears only OnControllerColliderHit, which a
CharacterController never raises for a trigger (DFU has no OnTriggerEnter): in DFU a flat's action fires on a click or a
blow, never a walk. AUDIT PRE-MERGE 0929 read DFU's box "as a box" and kept it for the effect and moving flats; FLAT-RELAY
(`Field-Bugs-2026-10-05c.md`) gave the relays the same mark for "a flat Teleport (Collision03)" - and the corpus holds
none: its 25 flat Teleports are 13 MultiTrigger, 11 Direct and 1 None (BLOCKS.BSA, read in full). What FLAT-RELAY did make
was 27 relay flats walk-ins - the 13 MultiTrigger Teleports, 5 Activate MultiTrigger (W0000020 #20572 shuts and locks
seven doors), 4 Activate Collision09 and 5 Unknown27 Collision03. (This record first said 41, counting 14 DoorText
Collision01 flats that are all 199.16 fixed-enemy markers, which DFU switches off and the host never registers -
`dungeonContext.js:"if (!m.action || m.record === 15 || m.record === 16) continue;"`: AUDIT FB1021d FW-2.) Six of the Teleports are hanging roots (TEXTURE.213 records 7 to 10) at head height
over three floors of N0000014, and the online room builds the Daggerfall region's Edworyan Laboratory (MAPS 17/643) at its
medium size (`smallerDungeons.js` onlineDungeonSize), whose first block that is: every root sends the body to object 21538,
0.80 m from the start marker - where Krinton had set the anchor, which is why it looked like the spell. Walked under from
every clear bearing on the real build, 135 of 135 walks fired before; offline the full build starts elsewhere and the
same roots land 83.7 m away (still a walk-in teleport, still wrong). The other Edworyan Laboratory (Dwynnen 5/519) holds no
Teleport. Ruled out, measured: the void rescue (its floor -10.40, the roots' floors 12.8 to 23.35), the relay's snap-back
(siege and royal battles alone), a size change's warp (a load alone), the anchor's prompt (single-use).

THE LAW NOW. `actionSystem.js:"export const walkHears = (o) =>"`: what a walk hears is a DaggerfallActionCollision's
object that is not a flat relay, and the pass asks it (`dungeonContext.js:"if (!walkHears(o)) continue;"` - the line
edited in place, buildDungeonContext not a line longer). A flat Teleport, Activate or Unknown27 fires on a click or a
blow, as DFU's; the red brick teleporters (model relays, 22 Collision03 and the rest) are walked into as ever; an effect
flat keeps AUDIT PRE-MERGE 0929's walk - now named as the departure it always was (Port-Ledger A, FLAT-WALK). No moving
flat reaches the pass: BLOCKS.BSA's 53 are all None or Direct (AUDIT FB1021d FW-4).
The relay keeps its flat's mark: it is what keeps it off the walk.

`test/scenes/fb1021d_flatwalk.test.js` (1, ARENA2): Edworyan Laboratory as the online room builds it, the host's own
collision pass and teleport landing lifted out of dungeonContext.js and worldModes.js, the real motor walked under all six
roots - 135 walks, none heard - and a click on a root still lands 0.80 m from the start. FLAT-RELAY's pin flipped
(`test/player/audit0929_actions.test.js`: walked into, nothing heard; clicked, sent on; an effect flat still the walk's;
its host-mirroring pass on `walkHears`), AUDIT 63's pass pin moved (`test/scenes/audit63_world_actions.test.js`).
`tools/mutants/fb1021d_flatwalk.json` (4, 4 dead); `fb1005c.json`'s two FLAT-RELAY records still find their text and die.

## RAVEN-CLOSE: a start-up closing read as the quest stands (2)

`src/systems/quest/clock.js` (`reached`'s `live`, `closesStartUp`, the Clock's isDeadline).

FOUND. "The Lost Artifact" is B0B81Y02 (its `DisplayName`), the Knights' lich. Its knight pays with `give pc nothing`
(`_success_`: the quest a success, not over) and removes the log step; with the lich's map never read (no wizard objective
on the card), the only `end quest` left is `_questdone_: when _2dung_ and not _readmap_`, on `Clock _2dung_ 00:00 0 flag 17
range 0 2` - the start-up block's travel clock, 2.5 times the cautious travel to its four places: 20.9 to 38 days on the
real map. DFU's script is the same and so is DFU's hold (GivePc.cs SetComplete leaves the quest running); a DFU player
rests or travels the weeks off. Online a deadline is charged only for the time played (QCLOCK-WORLD, `chargeSeconds`), and
REST8 and BODYGUARD-CLOSE (`Field-Bugs-2026-10-03.md`) cut a CLOSING to the short wait once the quest is a success - but
BODYGUARD-CLOSE read the clock's own task alone, and `_2dung_`'s is a bare `variable`: its `end quest` stood in a `when`
the reading could not see. So `_2dung_` stayed a deadline through the success. Measured on the real quest bridge
(machine, questlines layer, offer flow, online): the knight told, both objectives done, the reward unrolled (the three
pieces roll at `end quest`) - closed only after 23.96 game days, 47.9 real hours of play. Meanwhile the knight is an active
questor (`machine.js` lastNPCClickedQuestorOf), and the Order's guild refuses work ("You have not finished the work you
were given here: The Lost Artifact") - CrazyComrade's "not being able to get quests anymore after turning in", as far as
the thread shows (it is cut off; no second quest in the pack sits a success on a long played deadline but M0B00Y16's
escort, which is a real one). A save already stuck carries nothing of the reading (it is not saved), so online it closes on the short wait after its
next load, about two real minutes of play; offline DFU's remaining days stand, and a rest spends them (AUDIT FB1021d
RC-5).

"REWARD: DESIRED ARTWORK" TWICE is two runs of F0B00Y00 (the House of Dibella's Desired Artwork, repeatable, paid in
gear), each waiting to be taken: measured, one run mints one offer, even saved inside its end's grace and loaded twice.
The rail names a reward by its quest's title, so two read alike. Not a fault; nothing changed.

THE LAW NOW. A start-up closing is read AS THE QUEST STANDS, at run time, on the success: the clock's own task and every
`when` its end sets off alone with what is set now (`clock.js:"const end = reached(quest, name, { alone: true, live: true });"`,
`reached`'s `live`: `clock.js:"const isSet = (sym) => seen.has(sym.name) || (live"`). A quiet close (`end quest`, `make
permanent`, `drop as questor`) is the script closing a paid quest - the short wait; a `when` that would say or send
anything keeps it a deadline. BODYGUARD-CLOSE's own docstring already said so ("An end that ... says or sends anything
... stays a deadline") and its own-task reading could not see such a `when`; the one reading replaces it
(`_closesOnSuccess` keeps T1's task-started closings alone). Read as the script reads instead (every `when` the end alone
sets off, nothing else set), M0B00Y16's escort - the giant paid while the villager walks - would close with its "too late"
line (`when _yes_ and not _escortComplete_ and _qtime_`); as it stands, that reader fires and says, and stays a deadline.
B0B81Y02 with the map read keeps `_S.30_`'s 180 days (AUDIT REST-PARTY D1's hand table); offline nothing changes.

NOT CHANGED, said: with the map read, refusing the wizard leaves the quest open on `_S.30_` (the artifact can still be
taken from the guild - `_S.26_` makes it permanent and `_S.33_` ends the quest), the Order's door shut for those played
days; the way out is Abandon. AUDIT REST-PARTY D1 chose that limit; it is for the owner.

`test/systems/quest/fb1021d_ravenclose.test.js` (4): B0B81Y02 online closes within the short wait after the knight's
word; a save made stuck (37 days left) loads and closes; with the map read the hunt keeps its 180 days, and offline DFU's
`_2dung_` runs; M0B00Y16's escort stays open with no late line. `tools/mutants/fb1021d_ravenclose.json` (3: 2 dead, 1
recorded equivalent - the table's own word kept, no entry being a start-up clock); `fb1003.json`'s BODYGUARD-no-startup
re-aimed at the one reading (dead, it survived the two readings side by side).

## SENTENCE-MENDS, PATROL-GRACE, CURFEW-REFUND: serving time answers the name (3)

`src/systems/standing.js` (`sentenceMends`, `mendToLine`, `patrolHalts`), `src/systems/court.js` (`lowerRepForCrime`,
`sentenceRefund`), `src/scenes/arrestFlow.js` (chargeOnce, startCourtFlow, finish), `src/scenes/standingHost.js`
(the served notice), `src/scenes/world.js` (LW9's `wanted`).

FOUND. The watch knows a face by the region's legal standing alone (`standing.js` knownCriminal: under -10, or banished).
A sentence gives back the charge its court tried (REP2 sentenceRefund) and nothing of the standing the court PRICED it by
(startCourt reads the whole name), so a name already under the line walks out as known as it went in. iamamitten's job is
A0C00Y17, The Escort: the guards' branch asks "are you going to turn me over?", and No is `_S.17_: when _no_ and _S.01_ /
legal repute -20` (DFU's own number; Yes is +10). Measured through the real watch, court and prison screen, offline and
online: -20 -> stopped -> "come quietly" (a Conspiracy charged, -22) -> 13 days served -> released at -20, known; the
watch stops again after the day's grace, and the stop's own surrender is a closed loop. FINE-MENDS (`Field-Bugs-2026-10-14.md`)
recorded that loop ("the box's other two answers net nothing either") and mended the fine alone. Three things made it
worse, each measured:

- THE ROAD'S PATROLS (LW9) drew on a known criminal the moment they met one, the release's grace unasked: let out, the
  player met a knight outside the gate who could not be surrendered to, and killing him in the fight the road carried to
  the town as a Murder (-20 more) that no court ever tried, so no sentence could ever give it back.
- A CURFEW town (SEAT1d) doubles the law's loss of a crime and the sentence gave back the single loss: -20, -22, -24 ...
  two points kept a sentence.
- Drift is a point a week: -20 to -10 is 67 game days of play (about 134 real hours).

No relay or account copy of a standing exists (`server/src`, `server-account/src`: nothing reads `legalRep`); the
standing is the character's, so this was never a server overwriting a local fix.

THE CALL: a sentence counts as the fine does. The owner chose the fine's step for FINE-MENDS ("Fine raises standing": a
temple penance's step, PENANCE_POINTS, never past the line), and the court prices its sentence off the same name; so a
sentence served - days, or the court's fine paid with none - mends the name one step, with the People's half
(FINE-PEOPLE). A point a day served was weighed and refused: the court splits its penalty between gold and days on a coin
(`startCourt`'s DFRandom), so a day count is a coin's word. A full wipe to the line was refused: it would make prison
strictly better than the fine the owner set.

THE LAW NOW.

- SENTENCE-MENDS: `standing.js:"export function sentenceMends(player, regionIndex, {"` - the fine's own law
  (`mendToLine`, the one body both answer through), called once the prison's days are served and before the refill on
  the zero-day arm (`arrestFlow.js` finish; AUDIT FB1021d SM-1 moved the prison's from beside the refund), answering the
  name the prisoner came in with (SM-3) and once a grace (SM-4), and said ("Time served mends your name in Daggerfall (+5). You are a
  scoundrel."). Not an acquittal (the court tried nothing to answer), a guild's rescue (the guild answered) or a
  banishment (DFU's state 4 repairs nothing). The report's chain now: -20 -> -22 -> released at -15; the next stop's
  sentence -> -10, no longer known; no stop and no patrol after it.
- PATROL-GRACE: `standing.js:"export function patrolHalts("` - a known criminal outside the grace an answered law gives;
  LW9's `wanted` asks it (`world.js:"patrolHalts(playerEntity, trip.from.region,"`). An arrest on the road instead of a
  knight's sword stays LW-II's open item 6.
- CURFEW-REFUND: the charge keeps the factor it was laid at (`arrestFlow.js:"playerEntity.chargedFactor = lowerRepForCrime("`,
  the court's `factor`) and the refund gives back what was charged (`court.js:"const legal = loss * Math.max(1, Math.trunc(Number(factor) || 1));"`);
  a marked crime keeps half of what was charged; the People's half was never doubled.

A save already under the line is mended by the next sentence it serves (or fine, or penance): nothing records what lowered
a standing, so a quest's -20 cannot be told from an earned one. For the reporter now: two fines at the stop, two
penances, or two sentences clear Daggerfall from -20.

`test/systems/fb1021d_sentencemends.test.js` (5): the report's chain on the real watch, court and prison screen (the
served notice, the patrol's grace, cleared at the line and never past it); a Murder's mark kept at the line, a name two
under it mended two; the court's zero-day fine (driven on DFU's own coin, seeded) mends and the free arm does not; a
Curfew's doubled Conspiracy given back double; the patrol's predicate and its host. LW9's host pin moved
(`test/systems/livingWorld/lw9_traffic.test.js`), TIME1's census row moved (`test/fixtures/time1_census.json`).
`tools/mutants/fb1021d_sentencemends.json` (10, 10 dead); `fb1016b_finepeople.json`'s fine record and `rep2_sentences.json`'s
half-less-one re-aimed (dead), `arena2triage.json`'s two finish records re-aimed. Its
ARENA2-TRIAGE-4-the-sentence-credited-after-the-days survived on main as here: AUDIT 21 F8 read only that the credit was
not zero, and SENTENCE-MENDS' step is not zero either. F8 now reads the credit's own -10
(`test/systems/audit18_systems_social.test.js`), and it dies. `rep2_sentences.json`'s REP2-no-charge-coming-quietly
survives on main as here (AUDIT REP F1's second chargeOnce covers it) - not this change's.

## REGARD-OWN: a regard counts the character's own days, and a friend made is said (4)

`src/systems/livingWorld/regardClock.js` (`characterRelations`, `regardDayOf`), `src/systems/livingWorld/friendWord.js`,
`src/scenes/townTalk.js` (`sayFriend`), `src/scenes/legacyHost.js` (topicRows' `topic`), `src/scenes/world.js` (the
relations' three makings, `livingRegardDay`, the People page), `src/systems/livingWorld/people.js` and
`src/ui/familyPages.js` (their words).

FOUND. The "disposition" a courtship climbs is the Living World's regard (LW1, `relations.js`): a word counts once a day,
and it eases back toward nought by EASE_PER_DAY (half a point) a day apart - in the days the caller hands it, which were
the living day of the SKY (`Math.floor((skyMinutes() - 240) / 1440)`, the street's `dayOf`, the roads', dives' and
caravans' alike). Online the sky is a real hour a day and runs while the player is away (`net/skyLaw.js`): a regard eased
twelve points a real day logged off. Measured on the real street (LivingTown over the test town) and the real sky law: an
evening's talk left +14 at log-off, +2 a day later, nought at 48 hours; three hours an evening, every evening, read nought
at every login - Courtship (`legacy/marriage.js` FRIEND_AT, +40) never offered - and a second word a real hour later
counted again. The stamps were SAVED on the sky, which the clock law forbids (`06-Systems/Online-Time-Arc.md` section 5:
"No stamp is taken on the sky"); LIVED1 puts standing on the character's own clock, and the courtship beside the regard was
already there (`legacyHost.js` ownDay) - one conversation counted "a day" on two clocks. TIME1's census had filed the
regard's day as the sky's; that row is gone. Offline the three clocks are one: nothing changes there. Also measured, not a
fault: townsfolk take Polite ill (TONE-TASTE), so a Polite word nets -3 a day; the badge said so.

THE LAW NOW. The relations are made in one place (`regardClock.js:"export function characterRelations(record, own, online = false, sky = () => skyMinutes()) {"`)
and count every regard in the character's own day, whatever living day a caller hands in - the street, the roads, the
dives and the caravans keep their sky for everything else (LW0 decision 2: the world is shared; decision 6: how it feels
about you is yours). Online, a record from before (no `clock: 'own'`) is rebased once at load: each regard as last
written, met and seen today - what the sky eased away unwritten comes back - and its sky-day once-a-day marks let go.
The People page reads the same day (`livingRegardDay`). bootWorld not a line longer (the clock passed positionally, no entries).

THE FEEDBACK lumin asked for: the word, the tone or the deed that makes a resident a friend is said on the HUD, once -
"Ysabel Lark counts you a friend now. You can court them: ask about Courtship under Tell me about." where the Courtship
row is theirs (`friendWord.js`, the relations' own count `regardClock.js:"friendsMade: () =>"`, said by
`townTalk.js:"const sayFriends = () => {"` once nothing covers the HUD, the row named by legacyHost's `topic`), "...
counts you a friend now." where it is not (the watch, no house). The classic skin, which draws no regard badge, hears it
too. (AUDIT FB1021d RO-1/RO-4: first said at the word, under the talk window, where the HUD's real-time lines ran out
before it closed - and never for a deed.) The badge's words say the fade as it now runs ("half a point for each of your
days apart - time away from the game does not count") and who can be courted; the Family tab's Marriage and children says
who (a townsperson, not the watch, a traveller or your blood), how (once a day, Blunt with townsfolk) and that a friend
made is said. Three lines through `t()` (`livingWorld.friend.*`, beside SENTENCE-MENDS' and PASSAGE-HANDS'), drafted in
the thirteen whole languages, the talk window's own English labels named as it draws them.

`test/systems/livingWorld/fb1021d_regardown.test.js` (5): the report on the real street and sky - an evening's words
stand through a day away, twelve evenings reach a friend where the sky's days read nought at every login; a word once an
own day; offline the seam is the relations step for step; a sky-stamped save rebased, a marked one and an offline one read
as they are; the friend line once at the crossing, its wiring. Pins moved: LW2's save record
(`lw2_livingTown.test.js`), LEGACY6's new game (`legacy6_influence.test.js`), LW7c's People page (`lw7c_people.test.js`),
LW7's and TONE-TASTE's tone door (`lw7_deeds.test.js`, `tonetaste.test.js`), TIME1's census (two rows gone, one reason
moved). `tools/mutants/fb1021d_regardown.json` (13, 13 dead); `legacy6.json`'s new game and `lw7.json`'s tone records
re-aimed (dead).

## PASSAGE-HANDS, PASSAGE-IN, PASSAGE-PLATE: a booked ship is her master's (5)

`src/scenes/naval/passageHelm.js` (`createJourneyHand`, `passengerHelm`, `passengerCard`), `src/ui/enhanced/enhancedHelm.js`
(the passenger's card); `src/systems/naval/passage.js` (`voyageSails`), `src/systems/travel/seaMark.js` (`seaLegMark`),
`src/systems/travel/travelOptions.js` (startRouteLeg), `src/systems/travel/travelRoute.js` (routeLegs); `src/scenes/world.js`
(the seam, the journey's taps, the panel, the plate, `travelViewRouteTo`, the journey's `seaWaterAt`).

FOUND, for each of the four (`03-World/Passage.md`: "She is her master's ship, never the player's"; her master is the
Overworld crossing's hand on her helm, OWS2, and Come Sail Away sails only the boat whose helm the player holds, so the
passage puts its passenger there):

1. STEERING. The mod's one input seam ORed the player's keys, the helm panel's buttons, the controller's helm d-pad and the
   journey's hand: under the Overworld the view takes the turn keys and F17 the sail keys, but A and D (the strafe keys)
   reached her rudder and the mod reads D first - measured on the real runtime, a passenger's D held for thirty seconds
   turned her right round; with the view down (First Person Travel, a foe near, the twenty seconds between her master's
   tries) the whole helm and its panel were the passenger's. AUDIT PASSAGE had recorded it (B3, "a passenger may steer her
   by hand between her master's tries") and left it.
2. THE DOCKS. Three faults, each measured on the real map. (a) The planner reads one heightmap byte a map pixel and a sailed
   leg was aimed at its pixel's middle quarter, but the boat floats on the ground the game built: near a coast that middle
   is land - Wayrest's approach 859,246 is 13% water and its middle none, Daggerfall's 207,215 none. Of 527 sailed legs on 56
   voyages to Wayrest, Daggerfall and Sentinel, 80 were aimed at the built ground's land: she ran at the shore until "no way
   on" or aground. (b) Her master's resume asks a voyage (AUDIT PASSAGE A1: a plan that never sails is refused, so a
   passenger is never set down at the quay they paid to leave) - and from her own port's roadstead the plan is the landfall
   and the walk in, never a sea step: refused every twenty seconds for good, she lay off the harbour she was bound for.
   (c) The town ring (OW-TOWN-RING) was walked on sailed steps too: a route through heightmap water holding a town was
   aimed at its ring's points ashore.
3. THE PANELS. The ship's plate (hull, sails, guns) was the one sea readout drawn under a journey: its cover lacked the
   Overworld's term that the sea's tags, marks and the helm panel (AUDIT NAV2 F17) carry, and it stands bottom right,
   over the journey's block - over the line that says what holds the clock.
4. THE SLOW CLOCK. No passage-specific or sea-specific cap exists: the sea runs at the owner's RATE-LAW x60 ("Roads now
   travel at x100 and non roads at x60") and a Large Boat makes about 4.4 m/s toward her mark (2.97 to 5.4 over eight winds,
   the screenshot's hull) - 41% of a rider's pace. What holds the clock below x60 at sea is said on the block ("Held to xN of
   x60" and why: a raider's lookout, pirates lurking off a harbour's mouth, the land loading) - and the plate stood over that
   line. "Fog ahead - 39 km, in about 1 h" is the forecast's arrival (`owForecast.js`), not a promise of the journey's.

THE LAW NOW.

- PASSAGE-HANDS: while her boat carries a charter and the voyage is under way (`passageHelm.js:"export const mastersHelm = (boat, journey) =>"`,
  the journey's hand marked live by tvSeaFrame - AUDIT FB1021d PS-2: halted, her helm is the passenger's), the rudder,
  the oars, the sails and the trim answer her master's hand alone, and her lantern stays as it was lit (`passageHelm.js:"export function passengerHelm(input, boat, journey) {"`, the host's seam wrapped -
  `world.js:"input: passengerHelm({"` - an expression, no line); the passenger keeps stepping from her helm (the mod's
  disembark key, Transport) and the time dial. The journey's hand presses with taps of its own (`createJourneyHand`), never
  the panel's or the pad's, spent with them; so F17's gate now stands every sail press down under the view - keys, panel
  and pad (`world.js:"started: (action) => !(travelView?.active &&"`) - and the journey's own reach the mod through the
  wrapper. Her helm panel is a passenger's card: "The Fair Silk, bound for Wayrest - her master steers", with the time
  dial and Leave on it, and the pad's prompts say those two (AUDIT FB1021d PS-7); the passenger's autorun is let go at her
  helm (PS-4).
- PASSAGE-IN: (a) a sailed leg is aimed at its pixel's middle where the built ground floats her there, else at the nearest
  water that does - a block of 5 by 5 tiles, room for her hull (`seaMark.js:"export function seaLegMark(origin, waterAt) {"`,
  `travelOptions.js:"const read = leg.kind === 'sea' ? seaLegMark(o, deps.seaWaterAt) : null;"` - the autopilot's rect,
  so the hand's mark and the arrival are that point; the host hands the journey its built water, one entry). AUDIT
  FB1021d PS-1: a pixel built dry is passed for the next leg, and one not built when its leg begins (a leg folds a
  straight run) is aimed again once it is (`travelOptions.js:"st.route.seaUnbuilt === st.route.i"`; the host's reader
  answers null there). On the same 56 voyages, none aimed at land - 25 dry legs passed, which the first count had
  filtered out.
  (b) `passage.js:"export function voyageSails(from, to, plan) {"`: a voyage's plan may be walked when it sails, or when she
  already lies within VOYAGE_LANDFALL_PX of her port - no quay left is that near a port booked (`passageDestinations`).
  (c) A pixel reached under sail or by embarking is walked round no town (`travelRoute.js:"const afloat = (i) =>"`) - the
  land a party embarks from or makes landfall on keeps its ring (AUDIT FB1021d PS-3).
- PASSAGE-PLATE: the plate stands down under the Overworld's controls, which stand where it does, bottom right, as the
  helm panel does (`world.js:"!!travelView?.active;   // PASSAGE-PLATE: the Overworld's"`), and stands again when the
  journey ends or stops - a foe near closes them (`travelOptions.js` enemiesStop), so it is up for any fight. Not under
  First Person Travel's bar, top centre and clear of it (AUDIT FB1021d PS-5). The block's
  rate line, with its reason, is in sight again: that is the answer to "for unclear reasons".

NOT DONE, said. The x60 at sea is RATE-LAW's, the owner's; a faster sea rate for a passage, or a hull-scaled one, is the
owner's call. FOUND AND NOT FIXED (PASSAGE-PACE, measured): the clock's two leads - the land's governor (OW-LEAD) and a
foe's (OW6) - size themselves by the walking motor's pace (`player.speed`, 4.43 m/s), which is a Large Boat's but a third
of a Small Ship's or a Carrack's on a crossing; with a fast hull the clock can outrun the land being built, and an unbuilt
pixel reads no water. It did not cause this report (a Large Boat) and its fix threads two names through five suites'
host rigs; it is the next slice's. Quays, piers and moored ships were not in the trace's voyage simulation.
`passage.json`'s PASSAGE-sea-stood-again-after-a-door and `csa_together.json`'s CSAL-pad-bare-dpad survive on main as here,
and so does `auditships_sail.json`'s AUDIT-SHIPS-A5-the-gain-on-every-coast (in `comeSailAway.js`, which this change does not
touch).

`test/scenes/naval/fb1021d_passage.test.js` (9, one ARENA2): on the real runtime and the seam lifted from world.js, a
passenger's D, autorun, S, sails, lantern and panel and pad taps reach her not at all (her course to the millimetre) while
her master raises her sails and the disembark key steps the passenger off; a boat of mine answers my keys; the card; the
roadstead's resume, A1 kept; no ring on the sea; the mark on a built pixel and the autopilot's centre on it; the real
map's 56 voyages; the plate under the Overworld and the bar; the host's wiring. Pins moved: PASSAGE's A1
(`passagehost.test.js`), OWS2's journey taps (`ows2_crossing.test.js`), CSA-L's hand (`csa_together.test.js`), F17's two
(`auditnav2_helm.test.js`: a pad's sail tap under the view refused, the journey's own through the wrapper), HELM-LADDER's
seam (`csa_sailing.test.js`), the helm panel's line in HOLD-DOOR and SHIP-CREW (`holddoor.test.js`,
`shipcrew.test.js`: a passenger's card before her Orders, Hold and load), and three lifted-host rigs given the new names
(`fb1011c_seatown.test.js`, `travel_report_regressions.test.js`, and `auditships_sail.test.js`'s journey press);
`test/portTerrain.mjs` hands the heightmap it reads. `seaMark.js` takes the pixel's units and tile from `travelPaths.js`
(TravelOptionsMod's MPworldUnits and TSize) - no third copy of 32768 (AUDIT 24's one home). `tools/mutants/fb1021d_passage.json`
(18, 18 dead); `ows2.json`, `csa_together.json`, `auditnav2_helm.json` and `passage.json` records re-aimed (dead).

## Gates and what was measured beside them

`bootWorld` measured against main by `tools/hostScope.mjs` logical lines: +2, both the journey's one `seaWaterAt` entry
(wiring a module); `buildDungeonContext` unchanged. FOUND ON MAIN, not this change's: with ARENA2 present,
`test/systems/quest/fb1004d_cratefree.test.js`'s real-data test fails on main as here (a quest marker in N0000005 stands
inside model 62330 - CI has no ARENA2 and skips it).

## AUDIT FB1021d (2026-10-22, the owner: "Audit this")

Five cold lanes, one a report, each read-only over the pull request's own diff at `cff651e83` against Daggerfall Unity's
C#, the freeware's data and the code before it - given the reports and the files, never this record's conclusions (its
prose was a claim to check). Every finding was measured again here before anything moved. The calls left open are taken
under the owner's standing word, as the record's own were.

FLAT-WALK. Sound at its root: Edworyan Laboratory's roots, 135 of 135 walks fired before, none now; DFU's trigger box
read again (RDBLayout.cs:994-1000, PlayerCollision's OnControllerColliderHit); a click and a blow still fire them, and a
relay emits no shared record. FW-1 (weak pin): a Teleport-only or MultiTrigger-only walkHears passed every test, leaving
the 14 non-Teleport flat relays walk-ins (W0000020 #20572 locks seven doors, the room's online) - pinned by kind, two
mutants. FW-2: 27 flat relays were walk-ins, not 41 (14 DoorText flats are 199.16 markers the host never registers) -
corrected here and in Port-Ledger A. FW-3: FLAT-RELAY's diagnosis, refuted, still stood on four pages - marked, and
2026-10-05c's report 5 reopened (the red brick teleporter is a model's relay, 72100, which fired 66 of 66 walks; its
fault is not found). FW-4: no moving flat carries a collision trigger - the departure names the effect flats alone.
FW-5 (weak pin): the host's lifted pass lacked hasActionCollision, so its mutant died of a ReferenceError - given it.
FW-6, TAKEN: the 29 effect flats a walk still fires (Hurt23 braziers, CastSpell markers; DFU fires none) keep AUDIT
PRE-MERGE 0929's walk, named in Port-Ledger A with the block where a burning 210.19 is walked into and a teleporting one
is not; ending it is a change of the dungeons' traps, not these reports'.

RAVEN-CLOSE. Sound: B0B81Y02 traced offer to end; of 226 start-up clocks the reading touches, 18 change in some state and
one is reachable - B0B81Y02's `_2dung_`, the map unread; M0B00Y16 keeps its deadline. RC-1, TAKEN: online the lich's map
read after the knight's word opens the artifact hunt only inside the short wait - pinned as it stands, named in Port-Ledger
A (the door open again is what the report asked; DFU leaves `_2dung_`'s days for the read). RC-2 (weak pin): the test
said the gear rolled and asserted only the close - the questlines layer's one offer of three pieces now pinned. RC-3, said:
the short wait's cut is kept while the reading is live, so a closing that turns back into a deadline keeps its cut
remainder - harmless in the corpus (B0B81Y02's map read leaves `_questdone_` unable to fire). RC-4: a mutant record's
reason was false (U0C00Y00's `_escapetime_` is a start-up entry) - corrected. RC-5: a stuck save closes on the short wait
online; offline DFU's days stand - corrected. RC-6, FOUND, NOT THIS CHANGE'S: a save inside EndQuest's two-tick grace
restores a quest that never completes - DFU's own (QuestSaveData_v1 keeps no ticksToEnd). The map read and the wizard
refused keeps `_S.30_`'s 180 days, AUDIT REST-PARTY D1's call, standing; "Desired Artwork" twice is two F0B00Y00 runs.

SENTENCE-MENDS. Sound: A0C00Y17's `legal repute -20` the root; nothing on the relay or the services reads a legal
standing; the mend never passes the line; the zero-day arm mends, the acquittal and the guild's rescue do not. SM-1
(exploit): the prison's mend landed at the sentence, before a day - a save under the prison screen (a tab closed, the
checkpoint on hide) kept it with no day served, +5 a time - it lands when the days are served now (and its line is said
then: SM-10). SM-3, TAKEN: the mend wore the crime's own mark away (a Treason from a clean name -18 to -13) - it answers
the name the prisoner came in with (`chargedFrom`, the court's `from`), and REP2's mark is the court's due, as DFU keeps
it. SM-4, TAKEN: a petty crime self-reported (a night in the street, given back whole) bought a step for 80 gold - one
mend a grace now. SM-5 (weak pins): the banishment arm, the court's factor against the town's now, an acquittal's factor,
a banished player met by the patrol and the People's half of a sentence - pinned, mutants. SM-8, ADJACENT, FIXED: the
Curfew doubled any charge laid while the player stood in its town - a road's report, a loan's default - and no court
gives those back; it doubles the town watch's own charge alone (`court.js` lowerRepForCrime's `curfew`). SM-2, OPEN: from
the escort's -20 one sentence leaves -15, known; after the day's grace a road patrol's knight draws, and a known criminal
cannot surrender to him - an arrest on the road instead of a knight's sword is LW-II's open item 6, a slice of its own;
the town's watch stops with its box, and two answers clear the name. FOUND, NOT THIS CHANGE'S: SM-6 - `chargedCrime`
(and this change's `chargedFactor`, `chargedFrom`) are not saved, so a save taken after the surrender box charges its
crime again at the next court (REP2 pins the re-charge across a load, AUDIT DISC28 AR-1); SM-7 - two crimes before one
arrest, the court tries the last; SM-9 - a name mended to exactly -10 meets a warned Pickpocketing at -12.

REGARD-OWN. Sound: the report reproduced (an evening's words, nought at every login on the sky, 40 by the tenth on the
own clock); every read and write goes through the wrapper; the rebase is applied once and is idempotent. RO-1 (bug): the
friend line was said under the talk window, which covers the toasts and the classic column while the HUD's lines run out
on real seconds - it waits for the window now (`townTalk.js` sayFriends, the street's frame and the interior's), driven
on the real townTalk. RO-2 (weak pin): three of the wrapper's doors could read the caller's sky day unseen (one greeting
would ease a +50 to nought) - every door pinned on a far day. RO-3, TAKEN: the rebase gave grudges back whole (a slain
one's kin, eased to an enemy on the sky, back hostile the day the update landed) - a grudge comes back as the sky had
eased it by the load (the sky read once there: TIME1's census row). RO-4 (missing): a friend made by a deed was never said
- the relations count a crossing wherever a regard is noted (a regard handed down is not one), and the host names them.
RO-5 (bug): an online save from before, copied offline, kept its sky stamps and froze every regard - rebased offline too
where a stamp runs ahead of today. RO-7: the badge's courting words say a traveller and one's own blood cannot be courted;
a friend lost again inside the window is not said. RO-6, FOUND, NOT FIXABLE HERE: a realm-era build from before this one
can still load the record, read its own days as the sky's, and write back the regards it touched eased to nought.

PASSAGE. Sound: on a boat of mine every helm key, button, pad press, the Hold, the guns and the disembark as before; a
passenger's steering fixed at the seam. PS-1 (bug): 25 of the 527 legs were still aimed at land (dry pixels - 14 into
Daggerfall's approach - which the test's own filter hid), and 23 of the 55 moved legs began with their pixel unbuilt and
were never aimed again - a dry pixel is passed, an unbuilt one aimed again once built. (Deep Waters, on by default, reads
the water by the ground's height; the measure here is the tile map's.) PS-2, TAKEN (regression): with her master's hand
off - a foe near, aground, between his tries - nobody steered her: dead in the water through a sea fight, aground again
every twenty seconds with only stepping off (the fare lost) to end it - halted, her helm and her panel are the
passenger's. PS-3 (regression): the ring's exclusion took the land a party embarks from and makes landfall on (13 of 432
of my own crossings; one walked straight across its town) - afloat is reached by boat (the step in is the pixel's
layer in the planner's search; its step out never says otherwise - the campaign below). PS-4 (regression): a
passenger's autorun outlived the helm - let go there. PS-5 (regression): the plate hid under First Person Travel's bar,
which never covered it, taking the fight's card and the touch Brace - the Overworld alone. PS-6 (weak pins): her master
never rowing, the journey's disembark refused, the latch's setter, the reach's `<=`, the time keys and the real map's
filter - pinned. PS-7: the card carries the dial and Leave for a mouse or a screen, the pad's prompts say a passenger's,
and the lantern stays as it was lit (his hand never touches it). FOUND, NOT FIXED: my own boat's embark legs aim at their
pixel's middle on land (202 of 441) - a walk to the water and a launch, not a sailed leg, its own slice; the time at sea
is RATE-LAW's x60 with the governor's holds (its town pace and the time dial beside the land and the foes), none of it
passage's own.

The pins: the five `fb1021d_*` suites grown, `audit0929_actions` (FW-1), `fb1016b_finepeople`, `seat1d_client`, `lw2`,
`ows2_crossing`, `travel_report_regressions`, `fb1011c_seatown`, `holddoor`, `shipcrew` moved. The mutants:
`fb1021d_flatwalk.json` (6), `fb1021d_ravenclose.json`, `fb1021d_sentencemends.json` (21), `fb1021d_regardown.json` (27),
`fb1021d_passage.json` (39), and `arena2triage`, `fb1014_finemends`, `csa_together`, `helmtime`, `ows2`, `lw7` re-aimed.

THE CAMPAIGN, on the audit's tree with main merged: 1,291 mutants - every record in a file the audit changed, the
`world.js` records on its lines and every record whose tests it moved. 1,275 dead, 2 equivalent as recorded, 14
survived. Seven were the audit's own, each answered. The passenger's autorun under way (PS-4): her oars do nothing with
her sails up, so the track alone could not tell it - the latch is pinned let go while she sails. The journey's hand
marked on and off (PS-2): the harness marked it itself - `tvSeaFrame` is lifted out of `world.js` and driven, the
passenger's keys read against it. The card's buttons (PS-7): the panel was never painted - it is drawn on a page now,
Leave and the dial pressed (and a record on its title). PS-3's two halves were each the whole reading on every route
the planner makes - a step into its afloat layer is a sail or a launch, every step out of it a sail or a landfall
(37,217 pixels of 2,997 planned crossings, never once another word): one reading now, the step in, and its mutants
aimed at it. SM-4's grace on the prison arm is recorded equivalent: the arm reads the clock once a day at least is
served, and any grace standing then was granted before the arrest and runs a day - `fb1021d_sentencemends` pins the
day against the grace, so the record goes stale the day a grace outlasts a sentence (the zero-day arm's read is the
live one, pinned there). The other seven survive on main as here and are not this change's: `rep2_sentences`
REP2-no-charge-coming-quietly, `csa_together` CSAL-pad-bare-dpad and `auditships_sail` AUDIT-SHIPS-A5-the-gain-on-every-coast
(named after the first campaign), and AUDIT DISC28 AR-1's two and WERE-FRIGHT's two withdrawn-box records, equivalent
since PLEA-LOOP (2026-10-13b): `talkWindow.js:"if (this.done) return;"` refuses a box already answered, the withdrawal
marks it so, and every door reaches an arm through `input`, so the arms' own `surrenderBox` reads refuse nothing more.

