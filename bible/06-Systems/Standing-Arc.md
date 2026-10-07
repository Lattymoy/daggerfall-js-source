# Standing - the reputation overhaul (REP1-REP6)

Mac, 2026-09-29: *"So I want to talk about overhauling the reputation system. Something just much better and not as
punishing, but still punishing."* Four calls, from the options put to him (the recommended one each time):

| | The question | Mac's call |
|---|---|---|
| REP1 | What should low legal standing do to you in town? | *"Challenged on sight"* - a guard who sees a known criminal stops them: pay the fine or be arrested; a cooldown between stops, a grace period after release; no random summons |
| REP2 | What should serving time or paying the fine give back? | *"The charge, with a mark"* - lesser crimes come back in full; Murder and Assault leave half as a lasting mark |
| REP3 | What should banishment be? | *"Timed or pardoned"* - only for Murder and worse; lifts after about 30 game days, or a pardon is bought |
| REP4 | How should a bad name recover? | *"Earn it + faster drift"* - temple penance, paid reparations whose price rises each use, regional contracts and raid defence, plus negative standing drifting back about a point every 7 game days |

The same message put the whole shape to him - surrender always honoured unless a watchman was killed in the chase,
legal standing per region on the Standing page with a notice on every change, guild probation before expulsion - and
his answers signed it. REP5 and REP6 are those last two. Crime and law are on `01-Overview/Port-Doctrine.md`'s ported
1:1 list, so all of this is a declared departure: Port-Ledger section A, "THE LAW, MUCH BETTER AND STILL PUNISHING".

The law's terms have one home, `systems/standing.js`; the street hosts' side (the stop and the notices) is
`scenes/standingHost.js`; the fourteen band words are `systems/legalBands.js`.

## Why it was brutal (measured on the code, 2026-09-29)

- **The watch came back every hundred real seconds.** Below -10 in a region, DFU rolls 5% EVERY GAME MINUTE to charge
  Criminal Conspiracy and call the watch (PlayerEntity.cs:498-511) - no guard needed anywhere near. At the 12x clock
  that is about 46% a real minute. Each arrest cost -2; the sentence gave back half the loss less one - nothing - so jail
  never dug a player out: "Serving time doesnt fix rep. Tried 8 times" (FIELD BUGS 29g, ! OG); "Arrested again and
  again for Criminal Conspiracy" (DISC28 #6).
- **The one road back was a point every 112 game days** - about nine real days; -100 to 0 was some two and a half
  real years. There was no bounty to pay, no pardon, no penance for the law.
- **Banishment was for ever.** Any sentence below zero could be one (1% at -1, 12% at a first Theft, 28% at a first
  Murder), nothing ever cleared the bit, and it added a second 10% roll a minute.
- **A beaten criminal was killed.** An involuntary surrender (the blow that would kill, after an N) was refused below
  -20 and on a coin flip from -20 to 0; online the respawn is in the same region.
- **Every wave charged the crime again,** because the surrender box - the one caller of the charge - re-armed whenever
  no watchman stood: a Murder fled twice was -60.
- **It was invisible.** The status box named one word for the current region; the enhanced Standing page left the law
  out; no change was ever announced.
- **A guild expelled at the first review below zero** - one failed quest from zero ("i got expelled from the mages...
  it says i dont have reputation", FIELD BUGS 2026-09-21), a timeout's -22 with Roleplay Realism's death squad behind it.

## REP1 - the watch stops a known criminal it sees

The per-minute levy is retired from both street hosts. `standingHost.js` looks the street over once a real second: a
**known criminal** (standing under -10 in the region - DFU's own line - or a banishment standing) whom a wandering
**guard can see** (`cityGuards.js guardSeesPlayer`: the witness arm's own eye - 77.5, facing within 95 degrees - with
the line CLEAR, never through a wall) is stopped: *"Halt! The watch of Daggerfall knows your face. Pay a fine of 600
gold, or come with me."* (or *"You are banished from ..."*).

- **P - pay**: the court's own Criminal Conspiracy penalty at that standing, every unit in coin and no days (520 at -11,
  720 at -50, 1,000 at -100; double for a banished face). A day's grace follows. Offered only to a purse that can pay.
- **S - come quietly**: a Criminal Conspiracy, charged once, and the court - whose sentence gives the charge back.
- **R - refuse**: the Conspiracy held and the watch called as a seen crime calls it; the chase is DFU's from there.

At most one stop in two game hours per region (ten real minutes), never inside a game day's grace after the law is
answered (a fine paid, any court exit, a pardon). Never under another window, never in the travel view or a raid on
the town, never in a fight (a foe that sees the player, a duel - AUDIT REP F3; a hostile ship near a player aboard, a
boarding under way - AUDIT NAV2 F10, Mac: "Not in a sea fight"), never in a trial, never on a crime
already held, never dead, never in a beast's form (DFU's SuppressCrime), never invisible (the town witness's own gate -
AUDIT REP F7).
The box has no Escape. Online and offline alike; the stop runs on the character's own clock (LIVED1: the standing is
theirs).

## REP2 - a sentence pays the debt

`court.js sentenceRefund`: a served sentence, a paid guilty plea, a zero-day verdict or a guild's rescue gives back the
arrest's whole charge - the legal loss and the People faction's half - for every lesser crime; an **Assault, a Murder,
a High Treason or a Treason** keeps half as its mark (rounded toward the player: a Murder served is -10 of its -20). An
**acquittal** gives it all back: no crime found, no mark. Eight Conspiracy arrests served now leave a name where it
started (DFU: -16).

- **One charge per chase** (`arrestFlow.js chargeOnce`): the crime is charged at the first surrender box and not again
  while it is held; a WORSE crime committed in the chase (the Murder of a watchman) is charged as itself - and the court
  charges the crime it tries, whatever door opened it (AUDIT REP F1: the fatal blow's court tried a later Murder never
  charged, and credited its sentence). The chase ends
  with the crime, whatever cleared it (`cityGuards.js`, each frame), and with a load (`arrestFlow.js abandon`).
- **The surrender is honoured**: an involuntary surrender is taken at any standing, unless a watchman fell to the
  player in this chase (`watchSlain`, set by the kill, cleared with the crime). A voluntary surrender is always taken.
- **A good name no longer makes a fine dearer**: DFU priced a respected citizen's first Theft above a stranger's
  (`perRep * legalRep + base` on the good side); the good side is the base now, the bad side DFU's.

## REP3 - banishment, timed or pardoned

- **Only a Murder or a Treason** (`BANISHABLE_CRIMES`: Murder, High Treason, Treason) can be banished for, by DFU's own
  two rolls; every lesser crime is fined or jailed at any standing, and its court draws no roll.
- **Thirty days of the world's calendar** (`standing.js banish`, the court's state 4): DFU's bit (`SeverePunishmentFlags
  |= 1`) and its term, `banishedUntil`, saved with the region (`regionConditions.js`, `b`). Lifted on the first read
  past it. A banishment from before REP is given its thirty days from the first read. Online it lifts whether or not the
  player plays - a sentence of the realm, on its calendar: BANISH-SKY (2026-10-07, `Online-Waits.md` WAIT4) counts the
  thirty days on the calendar the player SEES, the sky's (TIME1), so thirty real hours since SKY-SLOW - REP3 had them on
  the event clock, sixty real hours, which the menus' calendar ran through twice; the doors between the lanes carry
  its days left (AUDIT WAITS B1). The calendar is read only when it can be trusted
  (`worldTick.js trustedWorldMinutes`, AUDIT REP F2): online, until the relay's clock is heard, a term is neither
  stamped nor lifted - a machine clock set fast at the boot lifted it for good.
- **A pardon** at the region's TEMPLE (the donation's priest): 2,500 gold, each later pardon in that region one step
  more (5,000, 7,500 ...). The watch never enters a temple, so a banished criminal can reach it. A pardon gives the
  day's grace a sentence does. A Yes ends the priest's asking (AUDIT REP F4): a pardon or a penance paid is the last
  box, a purse short of it is offered what is left; only a No goes on to DFU's donation field, pre-filled with 1000.

## REP4 - the road back

- **The drift** (`court.js RECOVERY_INTERVAL_MINUTES`, `worldTick.js`): a standing BELOW zero - legal and faction alike
  - recovers a point every 7 game days, lived or across an absence (TM-1's "Recovery only" stands: an absence pays
  nothing to a good name). A positive standing wears down on DFU's 112 days only; the 112th day pays a bad name one
  point, not two. At the 12x clock a week is about fourteen real hours: -20 is home in about twelve real days untouched.
- **A penance** at the region's temple (the donation's priest, before DFU's donation field): five points of the region's
  law back toward zero, never past it - 200 gold, then 400, 600, one step more each time in that region.
- **A bounty contract** finished for a region's board: two points of its law (`bountyHost.js pay` -> `rewardContract`).
- **Raid defence** already paid +5 (RAID1), and says so since AUDIT REP F5; quests and their `legal repute` actions pay
  as they did.

## REP5 - the law you can see

- **The Standing page** (`enhancedMenu.js statsLaw`) lists every region whose law knows the player's name, worst first:
  the region, the band's word, the number, and what it costs - *known to the watch (a stop: 640 gold)*, *banished, 28
  days left (a pardon: 2500 gold)* (online, BANISH-SKY: *banished, 28 days left, about 28 real hours (a pardon: 2500 gold)*). A common citizen's region is not listed. The guilds' rows say *on probation*.
- **A notice on every change** a cause moved (`court.js changeLegalRep`'s `cause`, `standingHost.js installLegalNotices`):
  *"Theft: the law of Daggerfall thinks less of you (-8). You are undependable."*, *"Your debt to Daggerfall is paid
  (+8)."*, *"The court of Daggerfall clears your name (+20)."*, the penance's, the contract's and the raid's own. The
  drift is silent. The status box's %ltn reads the same ladder (`legalBands.js`).
- **Not built**: a HUD marker. The stop's box and the page say the price; a marker would be a third place.

## REP6 - probation before expulsion

`guilds.js updateRank`: a review that finds a member below zero puts them **on probation** - the rank kept, the next
review 28 days on, the popup's box saying so. A review that finds a member already on probation AND below -10 expels
(Roleplay Realism's death squad for the Thieves Guild and the Dark Brotherhood still follows). A fall straight to -22 is
warned first. A standing back at zero or above ends the probation.

## QFAIL-FREE - a missed quest costs nothing online

`quest/quest.js endQuest` (2026-10-02, Mac: "Soften failure cost"): online a quest that ends unfinished no longer charges
DFU's -2 through the faction tree. TIME3's countdowns run on your own clock, so travel and rests time quests out, and
that -2 was what players read as standing decaying. A success still pays +5; offline DFU's -2 stands.

## What stays punishing

A crime is still charged the moment the watch catches you, and stays charged if you get away - or die: an online death
ends the chase (Mac's call after AUDIT REP, "What do you think? I trust you" - the crime cleared at the respawn, as the
travel map's arrival clears it) but gives nothing back - only answering for it (a sentence, a fine, an acquittal) does; the answer still costs gold and days; a violent crime keeps its mark
(a Murder -10) and may still banish; the watch still stops a bad name and hunts a refusal; low standing still closes
guilds, talk and quests; a slain watchman in the chase still ends in the killing blow.

## Numbers for Mac to tune (first cuts)

Two game hours between stops; a day's grace; the stop's fine off the court's Conspiracy table; thirty days of
banishment; a pardon 2,500 x n; a penance 200 x n for five points; a contract +2; a week's recovery; probation below 0,
expulsion below -10 on probation. Not changed, deliberately: a quest's -2 and its scripts' own amounts, the People
faction's charges, Vagrancy's resting law, Roleplay Realism's squads.

## Pins

`test/rep1_watchstop.test.js` (7), `test/rep2_sentences.test.js` (8), `test/rep3_banishment.test.js` (5),
`test/rep4_recovery.test.js` (5), `test/rep5_notices.test.js` (4), `test/rep6_probation.test.js` (3).
`tools/mutants/rep{1..6}_*.json`: 64 records, 64 dead. AUDIT REP (`01-Overview/Audit-REP.md`, 2026-09-30):
`test/auditrep.test.js` (8), `tools/mutants/auditrep.json` 19/19 dead; two pins moved (REP3's short purse, F4;
audit39_guildstravel's F99, the court's banishment on the trusted calendar, F2). Fifteen older pin files moved with the law (each marked PIN
MOVED): court, prisonrelease, guilds, rr1_realism, guildrep, auditdisc28_time, disc28_fatigue, auditlived1b, lived1,
audit26_dungeonfoes, exteriorfoes, beastform, audit39_guildstravel, audit39_worldlegaltalk, auditrr; seven older mutant
records re-aimed (all dead). Not verified in a browser.
