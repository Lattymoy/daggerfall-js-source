# Guilds Made Plain

The rules that keep both online guild systems readable: a player's guild with its seats (`Guild-Overhaul.md`,
`Seats-Arc.md`) and Daggerfall's guilds held online as Chapters (`11-Multiplayer/Chapters-Arc.md`). One word means one
thing in what a player reads, every rule a refusal enforces is said before the press, and a mechanic is cut only where
another already does its job. Players meet it in the Guild window's Settings, Members and Treasury pages and on the
Notice Board's Work tab. Offline, DFU's guilds are untouched.

## How it works

**One word, one thing.** The words a player reads, mapped to one meaning each; the ids on the wire and in tables do not
change:

| A player reads | It means only |
|---|---|
| **silver** | the online currency (code: `marks`) |
| **seat** | a town's Charter, a palace or a crown |
| **the Master's chair**, **a council chair** | a chapter's rank 9 and rank 8 (code: `seat`) |
| **Councillor** | a chapter's rank-8 title (token id `chapterofficer`) |
| **Officer** | a player guild's rank 1 |
| **chapter writ**, **your chapter writ** | a chapter's shared delivery writ (kind `hall`); a member's own writ for its chapter (kind `member`) |
| **Duties** | what a chapter asks of its members in its region and what each earns |
| **hall** | a player guild's hall, or one of Daggerfall's guilds' halls |
| **Tribute** | what a guild pays at the seat it pledged; a vassal's share to its liege is its **fealty share** |
| **arms** | a guild's heraldry |
| **the Works** | a held seat's building projects |

DFU's own rank titles stay DFU's (a temple's rank 8 "Master", rank 9 "Patriarch").

**What holds a guild that would go.** The service reads everything that keeps a guild from disbanding in one statement
(`server-account/src/guilds.js` `guildHolds`, the list `GUILD_HOLDS`): gold, the guild Stores, a writ or contract or its
pay on the way home, the hall, the vault, a Charter, a battle, a patron's bid, a logo review, and silver the
guildmaster's account cannot hold. The guildmaster's view carries it, so the Settings page lists it under "Before the
guild can be disbanded" before any press, and a refusal names the whole list (`GUILD_HOLD_CODES` in
`src/ui/socialPanel.js`).

**What each rank may do.** `src/net/guild/guildPowers.js` composes the power tables into one list in words
(`guildRankActsText`), each line read off its table at the call. The Members page folds it under "What each rank may
do", including what a rank may not do. A sweep fails the suite on any power the tables hold that the list does not word.

**The ledger says which way.** Each silver line carries its ledger kind and direction, and the Treasury page words it
by its kind (`GUILD_SILVER_LINE_WORDS`) or by direction ("paid", "received"), never "put in" for silver that left. A
line names a member only where the member acted. The Treasury page also says how much of the gold may buy a hall or a
new name (`guildRealmGoldText`).

**The chapter card.** The Work tab draws each chapter of the region as one panel: its band and what the band does
(`chapterBandEffectsLine`), the reader's Merit, its Focus, its Season, its patron, and its Duties
(`chapterDutiesLine`).

**Chapter bands and events** (`src/net/npcChapterLaw.js`). Season events are five (`CHAPTER_EVENTS`: Calm, Schism,
Succession, Crackdown, Rivalry). The bands carry what two removed events did: a Failing chapter falls
`CHAPTER_FAILING_FALL` more Strength each week its Merit stays under `CHAPTER_FAILING_MEETS` times the target; an
Ascendant chapter sells training and spells a fifth off, and its Master is High Master while it stands Ascendant.

## Rules

- Keep the depth, make it easier to understand (the owner).
- Cut a duplicate, never depth: a mechanic goes only where another does its job, and what it said moves to the other.
- One word, one thing, in what a player reads; wire and table ids stay.
- Every rule a refusal enforces is said before the press; where the client cannot know it, the refusal says everything
  that stands.
- A lever shows where it can be pulled.
- Offline is DFU; live rows do not change shape.
- Merit and seat influence stay two currencies; Standing and Strength stay two meters.

## Code and tests

- `src/net/guild/guildPowers.js` - rank acts in words
- `src/ui/socialPanel.js` - the holds list, silver lines, the treasury's gold
- `src/net/npcChapterLaw.js` - chapter bands, events, card lines
- `server-account/src/guilds.js` - `guildHolds`, the view's `keeps`
- `test/net/guild3_plain.test.js`, `test/net/audit_guild3.test.js` - the words, holds, rank acts, ledger and chapters
