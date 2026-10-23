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
  720 at -50, 1,000 at -100; double for a banished face). The fine mends the name a penance's five points, never past
  the -10 line (FINE-MENDS, `01-Overview/bugs/Field-Bugs-2026-10-14.md`) - and the region's People half of them, never past 0
  (FINE-PEOPLE, `01-Overview/bugs/Field-Bugs-2026-10-16b.md`: the charge's People half, which the kingdom and the commoners
  read, was left whole by a fine; its AUDIT S5: each step is the People's half of what the law was owed before it less
  its half of what is owed after, so the steps add up to the charge's half and a run of answers leaves the People whole -
  `trunc(5 / 2)` a step had left one Theft's People -1 for good) - and a day's grace follows. Offered only to a purse that can pay.
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
started (DFU: -16). [SENTENCE-MENDS, FIELD BUGS 2026-10-21d: and a sentence served - or the court's fine paid with no days -
mends the name a penance's step toward the watch's line, as the watch's fine does (FINE-MENDS), the People's half with
it: the charge alone came back, so a name under the line before the arrest walked out known; a Curfew's doubled charge
comes back doubled (CURFEW-REFUND), and the road's patrols keep the release's grace (PATROL-GRACE). AUDIT FB1021d: the
prison's mend lands when the days are served (SM-1), answers the name the prisoner came in with and never the crime's own
mark (SM-3), and comes once a grace (SM-4); the Curfew doubles the town watch's own charge alone (SM-8) -
`01-Overview/bugs/Field-Bugs-2026-10-21d.md`.]

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
  law back toward zero, never past it - 200 gold, then 400, 600, one step more each time in that region - and half of
  them to the region's People, never past 0 (FINE-PEOPLE, as the fine's - the same telescoping half).
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
warned first. A review that finds the standing at zero or above ends the probation - where the guild skills also meet
rank 0's bars (a member short of them is held on probation at any standing - AUDIT GUILD-WORDS L1-3, recorded for Mac),
and in a guild that never expels at any standing (its review clamps to rank 0).
STANDING-WORDS (2026-10-16, `01-Overview/bugs/Field-Bugs-2026-10-15g.md`; AUDIT GUILD-WORDS, `01-Overview/audits/Audit-Guild-Words.md`):
the stakes are said, not only the state - "On probation: your review is at the guild's hall in 8 days or later. Below
-10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends." - first in the hall's line (online)
and under the guild on the enhanced Standing page (both lanes), the days on the character's own date (`guilds.js`
reviewDaysLeft, `guildServiceFlow.js` reviewWarnings). A guild that never expels says its review ends it; a member whose
guild skills fall short of rank 0's bars is told the probation ends only once they rise and the standing is 0 or more
(AUDIT GUILD-WORDS II A-6); online, where a promotion does not wait (PROMO-NOW), the days say "- sooner if you earn the
next rank" (II C-7); a probation the next review would begin is warned, below 0 or short of the skills (II A-7); and a
review that will demote says so before it lands - each with when (II A-8).
OWED-PACE (2026-10-16, `01-Overview/bugs/Field-Bugs-2026-10-16c.md`; slater.mp3: "Can't gain reputation with the
guild"): online the review counts what the Roll still owes the guild (`ctx.owed`, onPushEffects's standingOwedOf -
`11-Multiplayer/Chapters-Arc.md` 3.3) against the EXPULSION alone: a member it would expel whose standing with the owed is
-10 or more is put on probation again. The review runs on the character's days and the Roll pays on real ones, so a
member whose quests had earned their way back was expelled before the reward arrived. The owed never ends a probation
and never buys a rank.

## QFAIL-FREE - a missed quest costs nothing online

`quest/quest.js endQuest` (2026-10-02, Mac: "Soften failure cost"): online a quest that ends unfinished no longer charges
DFU's -2 through the faction tree. TIME3's countdowns run on your own clock, so travel and rests time quests out, and
that -2 was what players read as standing decaying. A success still pays +5; offline DFU's -2 stands.

## STOLEN-GOODS - a stolen piece is marked, a fence's last stop, and the court takes it

FIELD BUGS 2026-10-16b (`01-Overview/bugs/Field-Bugs-2026-10-16b.md`, STOLEN-GOODS; the Discord: "you steal something from the
shelf and can sell it back to an NPC, and he'll put the item back on the shelf again, and it just goes in a circle ...
Also, when you're sent to prison, all the stolen items stay with you"). Three rules, the port's own - DFU's items carry
no theft, its Sell discards every sold piece (ConfirmTrade's `remoteItems.Clear()`, DaggerfallTradeWindow.cs:1051) and
its court (DaggerfallCourtWindow) takes nothing:

- **The mark.** A piece taken from someone else's keeping carries `stolen: true` (`systems/stolenGoods.js`; declared in
  `itemFields.js`, so the save, the wire and a realm trade carry it - a hand-off launders nothing, it is never a
  receiver's mark). Written at every theft arm, as the piece moves: the open shop's Steal on both skins (`nativeTrade.js`
  _doSteal, `enhancedTrade.js` runSteal - the success arm); every take of the OWNER'S piece through the inventory window
  over a loot target whose host hands over the owner's keeping - the Set of the target's records as the window opens
  (`loot.stolenFrom`): a shut shop's shelf and a stranger's cupboard (`worldModes.js` openShelf and the `container:` arm),
  a robbed caravan's goods (`world.js` caravanHost's openLoot); `inventorySession.js` theftTarget, `itemTransfer.js`
  applyTransfer, `stolenGoods.js` takenFromKeeping; and a lawful ship's hold, taken by Piracy (`navalHost.js` winBoarding,
  as her hold is drawn), and the casks of a lawful ship I sank (`navalHost.js` stolenCasks - hauled or stowed); a
  pirate's hold, one past the Veil, the casks of a ship another sank and a wreck's stores are not. Marked BEFORE the
  piece lands, because a landing is where a stack merges; a stolen piece stacks only with stolen kin and a split keeps the
  mark (`inventory.js` stacksWith, splitStack). The owner's piece put back is theirs again; the player's own piece through
  a target stays theirs, and a piece stolen elsewhere is not laundered by one (STOLEN-GOODS AUDIT S1). The theft's own law
  reads the same keeping - a stranger's cupboard's basket (a handful off a stack and a handful of coin counted) and the
  shut shelf's tally (`theft.js`, a departure from DFU's count) - so the mark and the crime agree. A pickpocket pinches
  coin, and coin carries no mark.
- **The fence.** A merchant pays for a stolen piece and is rid of it: it never reaches a shelf (`stolenGoods.js`
  landSold, both of `worldModes.js`'s sale arms - the counter's commitTrade and the keyed doSell), so it cannot be
  bought back and stolen again. An honest sale still lands on the open shelf (Port-Ledger T2, narrowed). No shelf piece
  is stolen: a peer's word for a shelf or a cupboard lands clean (and this build's own goes out clean), and a piece
  bought at a counter is the buyer's, honestly (`interiorShared.js` applyInteriorLoot and interiorLootRecords,
  `tradeModes.js` markCounterBought - AUDIT S3). A town's patron buys no stolen piece off a hired trader (`patronLaw.js`
  patronTakes, AUDIT S6; acct146) - a player may, the mark riding.
- **The court.** Every guilty exit - a sentence served, a fine paid, banishment, the failed defence's verdict, and so
  the watch's "come quietly" - takes every stolen piece the prisoner carries: the pack's, worn or held (taken off its
  slot first; a lit torch goes out), and the Materials Bag's - a stolen bag's honest goods put in the pack, never left in
  a list nobody owns (AUDIT S2) - (`court.js` confiscateStolen, called by `arrestFlow.js` finish at the verdict). The
  release says it once: "The guards take the stolen goods you carried (N items)." An acquittal and a guild's rescue
  take nothing - no crime found, and the guild got you out. The wagon and a home's storage are not searched, and the
  watch's fine on the spot is a fine, not a search.

Pinned by `test/systems/fb1016b_stolengoods.test.js` (13) over the real shelves, both skins' Steal and inventory, the Sell window,
the arrest flow, the room's landing, the naval host's boarding and the listing's record; `tools/mutants/
fb1016b_stolengoods.json` (53, all dead). The AUDIT (2026-10-16): `01-Overview/bugs/Field-Bugs-2026-10-16b.md` STOLEN-GOODS.

## REPUTE-GATE - online, two Mages Guild quests wait for the standing their headers name

`quest/onlineRepute.js`, read by `quest/offerFlow.js` offerGuildQuest (2026-10-16, AUDIT GUILD-WORDS II,
`01-Overview/audits/Audit-Guild-Words.md`; a Discord report: "The very first quest i did for them dropped my rep by 25 points";
Mac: "Gate by reputation"). QFAIL-FREE spared a quest's END; a quest's own script still costs its guild, and the Mages
Guild offers its quests by the player's level (MagesGuild.cs IsSatisfyQuestReqByLevel), so a level-2 apprentice was
handed "Guard the Guild" (N0B10Y03: -30 for taking the guarded treasure, which the quest then makes the player's) and
"Protect an Honored Mage" (N0B20Y02: -10 for a click on its mage, -50 for killing it) - though their own headers say
`-- Repute: 10` and `-- Repute: 20`. Online each is offered only once the guild's standing reaches its header's number;
every penalty is Daggerfall's, and offline the pool is DFU's. It replaced QSCRIPT-FREE (round I's waiver of a script's
loss to its own guild), which round II withdrew: it spared that theft and that killing, and the Thieves Guild's and the
Dark Brotherhood's own penalties, for nothing (A-1, C-1).

## WAY-BACK - the way back into a guild, said

`guild/guildServiceFlow.js wayBackLines` (2026-10-16, `01-Overview/bugs/Field-Bugs-2026-10-16d.md`; Glade on Discord:
"they kicked me out so I can't do any quests to recover ... remake my character or wait IRL weeks"). REP6 expels below
-10, and nothing told the expelled member how to get back in. The roads were already open. A stranger may ask the
hall's quest-giver for work, and each quest done pays the guild +5. Below 0, a standing comes back a point a week of the
character's own time (REP4), and online across a log-off too. Online the Roll pays quests and the drift at most 15 a UTC
day, and a chapter writ +2 beyond that. A stranger whose join the standing refuses is now told so, with the law's own
numbers - and the guild skills where the join also wants them, and a hall a Crackdown shut: at the hall (the enhanced
skin's line, where a member reads the next rank), on DFU's refusal of the join (the classic skin; the enhanced skin's
hall already says it), and the quests line under the guild on the Standing page. Not for a member of the slot, nor the
Thieves Guild and the Dark Brotherhood (joined by invitation). The law is unchanged; amends for gold at the hall and a
faster guild drift are recorded for Mac there. AUDIT WAY-BACK (`01-Overview/audits/Audit-Way-Back.md`, Mac: "Audit
this") read it cold: 38 findings and notes, the chapter writ, the log-off, the skills and the shut hall among them.

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

`test/systems/rep1_watchstop.test.js` (7), `test/scenes/rep2_sentences.test.js` (8), `test/systems/rep3_banishment.test.js` (5),
`test/systems/rep4_recovery.test.js` (5), `test/systems/rep5_notices.test.js` (4), `test/systems/guild/rep6_probation.test.js` (3); WAY-BACK's `test/systems/guild/fb1016d_wayback.test.js` (7), `tools/mutants/fb1016d_wayback.json` 24/24 dead (AUDIT WAY-BACK).
`tools/mutants/rep{1..6}_*.json`: 64 records, 64 dead. AUDIT REP (`01-Overview/audits/Audit-REP.md`, 2026-09-30):
`test/systems/auditrep.test.js` (8), `tools/mutants/auditrep.json` 19/19 dead; two pins moved (REP3's short purse, F4;
audit39_guildstravel's F99, the court's banishment on the trusted calendar, F2). Fifteen older pin files moved with the law (each marked PIN
MOVED): court, prisonrelease, guilds, rr1_realism, guildrep, auditdisc28_time, disc28_fatigue, auditlived1b, lived1,
audit26_dungeonfoes, exteriorfoes, beastform, audit39_guildstravel, audit39_worldlegaltalk, auditrr; seven older mutant
records re-aimed (all dead). Not verified in a browser.
