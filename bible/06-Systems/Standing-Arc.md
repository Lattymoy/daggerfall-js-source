# Standing

The law and reputation system: how a bad name follows a player in a region, how it is paid off, and how guilds
review their members. It is softer than Daggerfall's but still punishing. The player meets it when a guard stops a
known criminal in the street, at the court and the temple, on the enhanced Standing page, and in the notices that
say each change. Legal standing is kept per region, for every region in Tamriel (`src/systems/region/regionConditions.js`
`REGION_COUNT`); provinces past the Bay have their own court and people factions (`03-World/World-Wide.md`).

## How it works

**The watch stops a known criminal it sees** (`src/scenes/standingHost.js`). Once a real second, the street host looks
for a guard that can see the player (`src/scenes/cityGuards.js` `guardSeesPlayer`, line of sight clear, never through a
wall). A known criminal is one with legal standing below `KNOWN_CRIMINAL_BELOW` (-10) in the region, or banished there.
The guard stops them with a box that has no Escape:
- **P - pay**: the court's Criminal Conspiracy penalty at that standing, all in coin (double when banished). It mends
  the name `PENANCE_POINTS` toward the -10 line, never past it, with half of that to the region's People, never past 0.
  Offered only to a purse that can pay.
- **S - come quietly**: one Criminal Conspiracy charge, then the court.
- **R - refuse**: the charge held and the watch called; the chase follows.

At most one stop per region every `CHALLENGE_COOLDOWN_MINUTES` (two game hours), and never within a game day's grace
(`CHALLENGE_GRACE_MINUTES`) after the law is answered by a fine, any court exit or a pardon. Never under another window,
in the travel view, in a raid, in a fight or a sea fight, in a trial, dead, invisible, in a beast's form, or on a crime
already held. It runs on the character's own clock, online and offline.

**A first minor offence is warned** (`WARNABLE_CRIMES`: attempted breaking and entering, trespassing, vagrancy,
pickpocketing): the first in a region, for someone the watch does not know, gets a warning, not an arrest.

**A sentence pays the debt** (`src/systems/court.js` `sentenceRefund`). A served sentence, a paid guilty plea, a zero-day
verdict or a guild's rescue gives back the arrest's whole charge, legal and People. Assault, Murder, High Treason and
Treason keep half as a lasting mark. An acquittal gives everything back. A sentence served or a court fine paid also
mends the name toward the watch's line, as the street fine does.

**One charge per chase** (`src/scenes/arrestFlow.js`): the crime is charged at the first surrender box and not again
while held; a worse crime in the chase is charged as itself. The chase ends with the crime, a load, or (online) a
death, which gives nothing back. A surrender is always taken, unless the player killed a watchman in this chase.

**Banishment** (`src/systems/standing.js` `banish`). Only for `BANISHABLE_CRIMES` (Murder, High Treason, Treason), by
DFU's rolls. It lasts `BANISHMENT_MINUTES` (30 days) on the calendar the player sees, and is lifted on the first read
past its end. Online the term is neither stamped nor lifted until the relay's clock is trusted. A pardon at the
region's temple costs `PARDON_BASE_PRICE` (2,500), one step more each later pardon in that region.

**The road back.**
- *Drift*: standing below zero, legal and faction, recovers a point every `RECOVERY_INTERVAL_MINUTES` (7 game days),
  lived or across an absence. A good name wears down on DFU's 112 days.
- *Penance* at the region's temple: `PENANCE_POINTS` (5) of law toward zero for `PENANCE_BASE_PRICE` (200), one step
  more each time, half to the People.
- *A bounty contract* for the region's board: `CONTRACT_LEGAL_GAIN` (2).
- *Raid defence* pays +5; quests pay as scripted.

**The law you can see.** The enhanced Standing page lists every region whose law knows the player, worst first, with
the band word (`src/systems/legalBands.js`), the number and the cost (a stop's fine, a banishment's days left and its
pardon). A notice says every change with a cause (`changeLegalRep`'s `cause`); the drift is silent.

**Guild probation** (`src/systems/guild/guilds.js` `updateRank`). A review finding a member below zero puts them on
probation: the rank kept, the next review 28 days on. A member already on probation and below -10 is expelled. At zero
or above (with the guild skills meeting rank 0's bars) probation ends. The stakes and the days left are said at the
hall and on the Standing page. An expelled or refused stranger is told the way back
(`src/systems/guild/guildServiceFlow.js` `wayBackLines`): quests from the hall's quest-giver, and the drift.

**Online quests.** A quest that ends unfinished costs no faction standing online; a success still pays +5; offline
DFU's -2 stands. Two Mages Guild quests are offered online only once the guild standing reaches their headers' number
(`src/systems/quest/onlineRepute.js` `ONLINE_REPUTE_GATES`).

**Stolen goods** (`src/systems/stolenGoods.js`).
- *The mark.* A piece taken from someone else's keeping carries `stolen: true`: a shop's Steal, a shut shelf or a
  stranger's cupboard, a robbed caravan, a lawful ship's hold taken by piracy or the casks of a lawful ship the player
  sank. It is a declared item field, so saves, the wire and trades carry it. A stolen piece stacks only with stolen kin.
  An owner's piece put back is theirs again.
- *The fence.* A merchant buys a stolen piece and destroys it; it never reaches a shelf. A town's patron buys none from
  a hired trader. Market, vendor and player-trade rows say "Stolen".
- *The court.* Every guilty exit takes every stolen piece the prisoner carries (pack, worn, held, Materials Bag) and
  says so once (`src/systems/court.js` `confiscateStolen`). An acquittal and a guild rescue take nothing. The wagon and
  home storage are not searched.

## Rules

- Much better and not as punishing, but still punishing (Mac). Each of these is Mac's call: a guard challenges a known
  criminal on sight, with a cooldown and a grace, and no random summons; a sentence returns the charge, with a mark for
  violent crimes; banishment only for Murder and worse, timed or pardoned; a bad name recovers by penance, rising
  reparations, contracts, raid defence and a faster drift; probation before expulsion; legal standing per region on
  the Standing page with a notice on every change.
- An online death ends the chase but gives nothing back (Mac).
- No stop in a sea fight (Mac).
- A failed quest costs nothing online (Mac).
- Online, the two Mages Guild quests are gated by reputation (Mac).
- What stays punishing: a crime is charged when caught and stays charged if the player escapes; answering costs gold
  and days; a violent crime keeps its mark and may banish; low standing still closes guilds, talk and quests.
- A modified client can strip the stolen mark; the mark is the client's word, as the theft is.

## Daggerfall Unity

DFU (`PlayerEntity.cs`) rolls 5% every game minute below -10 to charge Criminal Conspiracy and call the watch, needing
no guard nearby; serving time returns almost nothing; banishment never lifts; an involuntary surrender is refused at low
standing; a good name makes a fine dearer; a guild expels at the first review below zero. Crime and law are on the
port's 1:1 list, so all of this is a declared departure, made because the original could not be dug out of. The port
keeps DFU's -10 line, its banishment rolls and bit (`SeverePunishmentFlags`), its 112-day positive decay, its penalty
table on the bad side, and DFU's SuppressCrime for beast forms. DFU's items carry no theft and its court takes nothing;
the stolen mark, the fence and the confiscation are the port's own.

## Code and tests

- `src/systems/standing.js` - the terms: stops, grace, warnings, banishment, pardon, penance, contracts
- `src/systems/court.js` - `sentenceRefund`, `changeLegalRep`, `confiscateStolen`, the drift interval
- `src/scenes/standingHost.js` - the street stop and the notices
- `src/scenes/arrestFlow.js`, `src/scenes/cityGuards.js` - the chase and the guard's eye
- `src/systems/legalBands.js` - the band words
- `src/systems/guild/guilds.js`, `src/systems/guild/guildServiceFlow.js` - probation and the way back
- `src/systems/stolenGoods.js` - the stolen mark
- `test/systems/rep1_watchstop.test.js`, `test/scenes/rep2_sentences.test.js`, `test/systems/rep3_banishment.test.js`,
  `test/systems/rep4_recovery.test.js`, `test/systems/rep5_notices.test.js`, `test/systems/guild/rep6_probation.test.js`
  - the stop, sentences, banishment, recovery, notices, probation
- `test/systems/auditrep.test.js` - the audit's fixes
- `test/systems/guild/fb1016d_wayback.test.js` - the way back
- `test/systems/fb1016b_stolengoods.test.js` - the mark, the fence and the court

## Open

- Not verified in a browser.
- A member short of the guild skills stays on probation at any standing; recorded for Mac.
- Amends for gold at the hall and a faster guild drift are recorded for Mac, not built.
