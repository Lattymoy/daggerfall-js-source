# FIELD BUGS 2026-10-17d - the Dark Brotherhood lost to the curse

One report, 2026-10-17, read on the code as it stands at main's `70a5c3443`. (Main took `Field-Bugs-2026-10-17.md` for
the day's two Discord reports, `-17b` for SHAM-TRAIL and `-17c` for ORRERY-HEIGHT, so this record is `-17d`, its pins
`fb1017d_*`.)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "I'd like to know if there's any fix for the issue where you lose access to the Dark Brotherhood after becoming a vampire, since I lost access to the guild after transforming." | DFU's guild-book swap, ported whole: a vampire reads an empty book, and the Brotherhood - joined only by an invitation the game sends once - had no way back in for as long as the curse held | fixed (CURSE-CARRY) - a named departure, `Port-Ledger.md` section A |

## CURSE-CARRY: the guilds nobody can ask to join ride the curse

`src/systems/guild/guilds.js` carryInvitationOnly, activeMemberships; `src/net/npcRollTracker.js` rollEntityDoors.

FOUND. Not a slip but DFU's law, which V2e ported whole (`06-Systems/Systems-Arc.md`, V2e). GuildManager.Memberships
(GuildManager.cs:109-112) answers `HasVampirism() ? vampMemberships : memberships`, and `activeMemberships` is that
getter: the turn hands the player an empty book and the mortal one waits, dormant, for a cure. For four of the six guild
groups that costs a walk to the hall and a second application. For the Thieves Guild and the Dark Brotherhood it is a
lock. Both are INVITATION_ONLY - DFU throws from TokensIneligible and TokensEligible for both (ThievesGuild.cs:180-187,
DarkBrotherhood.cs:189-196), so there is no application - and the one door in is the initiation quest
`handleStartingCrimeGuildQuests` (PlayerEntity.HandleStartingCrimeGuildQuests, :1503-1522) starts once, parking the
tally at InviteSent (100) for good. A member who turned could never be invited again, and every Brotherhood hall read
them as a non-member until `$CUREVAM`. DFU does the same: read against Interkarma/daggerfall-unity at `2343305`,
nothing in GuildManager or VampirismEffect carries either guild across.

FIXED - A DEPARTURE, NAMED (`Port-Ledger.md` section A, CURSE-CARRY).
`systems/guild/guilds.js:"export function carryInvitationOnly(store, vampire) {"` runs on every `activeMemberships` read. Where the
active book lacks the Thieves Guild's slot or the Brotherhood's and the other book holds it, the record MOVES to the
active book. One record, never two: a rank earned as a vampire is the rank the cured player reads, and a save carries it
where it stands. Where both books hold one (a classic import can carry both), each keeps its own, as DFU's do. The other
four groups - the Fighters and Mages Guilds, the temples and the knightly orders - still swap: those can be joined
again, so the curse's cost there stays DFU's. The move happens on the read, like the book pick beside it, so the curse
and the book cannot disagree. The online Roll's door carries before it reads
(`npcRollTracker.js:"carryInvitationOnly(entity?.guildMemberships, rollVampireOf(entity));"`), so a vampire's claim
never marks the carried guild dormant (`11-Multiplayer/Chapters-Arc.md`, AUDIT CHAP4 D1) in the window before anything
else has read the books since the turn.

What a player sees: a Brotherhood or Thieves Guild member who turns keeps the guild, its rank, its title and its hall.
The halls stay revealed on the map as they already did (`guildHallReveal.js` follows either book, AUDIT CHAP2 D4). A
vampire the old swap already locked out gets the guild back the first time the game reads their memberships after the
update: the mortal book's record moves to the vampire's.

Pins: `test/systems/guild/fb1017d_cursecarry.test.js` (4). The old pin moved with the law: `test/systems/guildswap.test.js`
held the Thieves Guild hidden under the curse in its legacy-book pin, and holds the Fighters Guild there now. AUDIT
CHAP4 D1's source pin (`test/net/audit_chap4.test.js`) and its two mutant records (`audit_chap1.json`
ACHAP-T5-MEMBERS, `audit_chap4.json` AUDIT-CHAP4-D1-TRACKER) are re-aimed at the door's new read, with the same
mutations. Mutants: `tools/mutants/fb1017d.json`, 7, all dead - no carry; copied, not moved; every guild carried; the
Thieves Guild left behind; the active book's own record overwritten; carried into the curse and never home at the cure;
the Roll's door carry dropped.
