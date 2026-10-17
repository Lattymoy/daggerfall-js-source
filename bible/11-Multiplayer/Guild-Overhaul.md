# THE GUILD PAGE'S OVERHAUL - a new name, the vault, the arms, the pages (GUILD2, 2026-10-03)

The port's own (DFU's guilds are its factions; a player's guild is GUILD1's, `06-Systems/Online-Arc.md` GUILD1 to
GUILD1e). Four parts: **GUILD2a** a new name for a price, **GUILD2b** the guild's vault and who may use it, **GUILD2c**
arms worth choosing that every banner draws, and **GUILD2d** the Guild tab in pages. The laws are
`src/net/guild/guildLaw.js`, `src/net/guild/guildVaultLaw.js` and `src/net/heraldryLaw.js`; the service is
`server-account/src/guilds.js` and `server-account/src/guildVault.js` (migration `0077_guild_overhaul.sql`); the client
`src/net/guild/guildBook.js`, `src/ui/socialPanel.js` and `src/ui/heraldryArt.js`.

## Asked

Mac: "Also the guild page needs an overhaul. A way to change your guild name for a price, guild item storage with the
leader able to grant and revoke perms, a proper choosable insignia that also plays with guild banners, etc" - "This is
something I really want you be detailed on and focus."

## GUILD2a - a new name, for a price

- **The guildmaster's alone** (`GUILD_POWERS.rename`): a new name, a new tag, or both, in the founding's shapes (3 to 32
  plain words; 2 to 4 capitals or digits) and free of every other guild's - a guild nobody is left in gives its own up,
  as at a founding.
- **25,000 gold** (`GUILD_RENAME_GOLD`, two and a half foundings) **from the treasury** - from the gold realm characters
  put in (`realm_gold`, the part a hall is bought with: HALL-GOLD), so no bank's word buys it. A sink a guild chooses
  (Economy-Arc: "a sink that scales with wealth is a prestige one a player chooses").
- **A fortnight between** (`GUILD_RENAME_COOLDOWN_S`), so a name is not a costume changed by the hour; the page says
  when the next may come. **Never in a week the guild fights for a seat** (heraldry's own rule, AUDIT-SEATS S10: its
  banners are on the field).
- **One batch**: the row renamed and paid only where every one of those still holds; the treasury's line the ledger
  trigger's (`moved_kind` 'rename'); the rename written down (`guild_renames`: the names it left and took, who, the
  cost); the hall's owner name with it. The answer carries the guildmaster's badge with the new tag, signed into
  GUILD1c's order, so the rooms say it at once. The old name is free for anyone at once.
- **The name filter, at last.** Seats-Arc 18 said a guild's name and tag "pass the name filter they already pass" -
  and neither ever had: only the chat called it. A founding and a rename both pass it now (`guildWordsOk`): the name,
  the tag, and EACH WORD of the name on its own - the filter is a handle's and reads a name run together, so "Server
  Admins" and "Moderator Guild" passed it whole (`guild-name-word`). A word with no letters ("The 22 Blades", a tag of
  22) is no word the filter reads, and passes (the audit's G3: the filter's "needs some letters" refused it). The
  guilds founded before GUILD2 are not read again: a name that stood keeps standing until its guild renames.
  **A word is read as written** (the second audit's S2): the filter's second reading - a letter's run collapsed, a
  handle's `cccoooock` - read over each word caught ordinary words as the server's own ("The Iron Staff" as `staf`,
  "The Dark Mood" as `mod`). The server's words are read on a word's own letters; the slurs and the crude words keep
  both readings (a handle's "Spicy" is refused, and so is a guild's - the filter's own call); the whole name and the tag
  keep the filter whole. **The refusal names the word** (`why`: "A guild's name and tag may not carry "mod" - a word the
  realm keeps out of names."), the filter's own law, and a rename refused for the fortnight says when the next may come
  (`at`, S7).
- The Settings page: the name and tag fields start at the ones that stand; **Rename** arms, and the second press -
  "Sure? 25,000 gold" - pays. It waits, and says why: already the guild's, not yet (the fortnight), the realm's gold
  short.

## GUILD2b - the vault, and who may use it

- **A shelf of items**, a slot each: **50**, and **50 more while the guild holds a hall it bought** (its cupboards,
  Seats-Arc 8.2). A piece is its record exactly as it left its depositor's realm record - every field, its stack - with its
  depositor's name and when.
- **A realm character's**, as a trade is: a piece put in leaves the record and enters the vault in ONE batch on the
  service (`prepareRealmRecord` with the trade's own `takeTradeGoods`); a piece taken out enters the taker's record in
  one batch with the slot emptied (`giveTradeGoods`). The client checkpoints and holds the save (`realmGoldAct`), takes
  the piece out of the pack at once, and gives it back on a refusal. Only what may leave a pack goes in: never a worn,
  quest, summoned or bound piece, gold, a boat's, or the Materials Bag (`06-Systems/Materials-Bag.md`).
- **Two deposits racing for one slot** write one and refuse the other whole (the slot is the primary key). A piece
  taken is the one the taker saw: the slot, the time it was put there, its count AND its record (the audit's G1: a slot
  emptied and filled again in the same second, with a stack of the same count, was taken as the piece read), so a slot
  filled again is never the one taken.
- **The shelves' bound is the batch's own read** (the second audit's S3): fifty, and fifty more while the guild holds a
  hall. A put decided with a hall's hundred that lands after the hall is sold takes nothing (`guild-vault-full`); a hall
  sold with more than fifty pieces leaves them on the shelves, each taken out as ever, nothing put in until fewer than
  fifty stand. A put holds the standing it read, as a take does (S4).
- **A take NEEDS its answer** (the second audit's K1, `realmGoldAct`'s `needsAnswer`, as a market's collect): the piece is
  the answer, and a take that landed with its answer lost was read as landed with no piece - the checkpoint after it
  wrote the record without the piece the service had just put in it. Lost, the session ends and a join reads the record,
  which holds it. The last vault read asked is the one shown (K14).
- **Who may use it - the leader's word.** Each rank stands at a default (`VAULT_RANK_DEFAULTS`): Officers take out, ten
  takes a UTC day (a take is one press - a whole stack or one of it - and the limit counts presses, not pieces);
  Members and Recruits put in. The guildmaster **grants and revokes** per member on the Members page: no access, puts
  in, or takes out with a limit a day (1, 3, 5, 10, 25 or any number; a member made a withdrawer starts at ten) - or "as
  their rank", the grant revoked. The guildmaster always takes out, unlimited; a grant on that row is never read. The
  day's count is the service's, counted in the take's own batch, so two takes racing at the limit cannot both land; and
  the batch holds the standing the take read (the audit's G4: a revoke or a demotion landing between the read and the
  batch refuses it, `guild-vault-rank`). A grant holds its granter's rank (S5: a guildmaster who handed the guild over
  between the read and the write grants nothing), and a withdrawer's grant that names no limit stands at ten a day,
  never "any number" (S6: the service's default was none). A grant's draft on the page is of the standing it was made
  from - a standing moved since starts it again (U7).
- **A grant names its member by the row** (`m<rowid>`). SQLite may give a deleted last row's id to the next row made,
  so a guildmaster's page read before a member left and another joined could grant the newcomer (the audit's G5).
  Accepted, not fixed: it is the guildmaster's own act on a stale page, said on the page at once ("Bran: Takes out, 5 a
  day"), undone by the next grant, and the roster is read again after every act.
- **Reached in a town**, as the Stores are (`06-Systems/Materials-Bag.md` section 4): read anywhere; put in and taken
  out in town - the town read at the press and every frame, never once at the page's build (the audit's M1). The
  vault is read again at each look (M2), and the page shows the reader's own guild's alone - a read that fails shows
  no pieces, never the last guild's (M3). **The hall's chest IS the vault**: pressing it opens the Guild tab at the Vault page (the guild Stores a
  page beside it). Put in offers what may leave the pack and is not locked (U4: a lock closes every way out a trade is),
  and its pick is a piece, never a place in the list (U10: a put-in shifted the list under an index, and the next Put in
  offered the piece after it).
- **Every piece in or out is a line** (`guild_vault_log`), the latest forty on the page.
- **A guild holding pieces does not go**: the guildmaster empties the vault before disbanding (`guild-vault`), as the
  treasury and the hall are emptied first - and before deleting a lone guildmaster's realm character (the audit's G2:
  the delete let the guild stand memberless with pieces nobody could take out).

## GUILD2c - the arms

- **Forty devices**: GUILD1d's twenty-four, then sixteen of the guilds' own trades and creeds - skull, key, anchor,
  ship, horse, spider, hand, flame, scales, book, chalice, dagger, owl, bat, crossed swords, anvil (the port's own art,
  `ui/heraldryArt.js`, law 6's one committed art).
- **A divided field**: seven divisions besides plain (GUILD1d's every banner) - per pale, per fess, per bend, per bend
  sinister, quarterly, per chevron, per saltire - a divided field's second colour any but Ash, the field's and the
  border's (the audit's G13: a border of the second colour ran into that half, the cloth's edge gone along it).
- **The device's own colour** (`charge`): the border's by default, or any other - never a colour of the field it lies
  on.
- **Arms that carry neither are exactly GUILD1d's three keys**: every stored heraldry, banner and pin unmoved; a
  street banner of plain arms keeps its texture's key (`heraldryKey`), so nothing cached is drawn again.
- **Every face that draws the device draws them**: the hall's two banners and the seats' (`render/bannerPass.js`
  through `drawBanner`), the shield on the tag's frame, the siege HUD and the Chronicle (`shieldSvg`), the Overworld's
  name face, the Guild tab's header. The map's seat ring and a Season's ribbon carry a guild's colours alone, as they
  always have. A device's holes (an owl's eyes, a key's bow) show the field beneath them - both colours of a divided
  one (the audit's G11: they were painted the first colour over the second part). Every picture kept is keyed by the
  whole arms (`heraldryKey` - G12: the tag's swatch, the name layer and the Overworld badge were keyed by GUILD1d's three,
  so a new division drew the old picture). The words say them: "Per pale Azure and Crimson, bordered Gold, an Owl
  Argent"; a pair as one - "a Pair of Swords", "a Pair of Scales" (G14). A hole is painted once in each colour, each
  inside its own part - the first colour clipped to the division's complement, even-odd (the second audit's G2: painted
  whole in the first and again in the second, its anti-aliased edge left a rim of the first colour around it).
- **A renamed guild keeps its Chronicle** (the second audit's G1): a Chronicle row names each guild as it was that day,
  and the arms are found by the tag and name a guild bears now - so a rename stripped the shield from every line before
  it, and a new guild founded with the old name and tag wore them. The service gives each such guild `now` (its name
  and tag today: the guild whose first rename away from that name came at or after the row - `guild_renames`), and the
  Chronicle and the Roll of Arms find its arms by it ("The Iron Oath <IRON> (now the Ember Oath <EMB>): ...").
- **The Arms page** shows the banner, the shield and the tag as they will stand, and the choices as the things
  themselves - the divisions a tile each drawn in the draft's own colours, the colours swatches (the ones the law
  refuses shut: each pick tried on a copy and read by `heraldryOf`, the one judge - a row's own rule missed the device
  against the second colour), the devices a tile of forty - drawn again in place at each pick with the keyboard's focus
  kept on the pick. A shut swatch says why - on its label and its title, and drawn under its row for a finger (the second
  audit's U14). On a touch screen a swatch is 44 pixels. The price is GUILD1d's: the first raising free, a change 500 Drakes from the silver treasury.

## GUILD2d - the tab in pages

GUILD1b's tab was one scroll - roster, invites, two treasuries and their ledgers, the hall, the heraldry, the guild
Stores, the rank names and leaving, every section under the one before. It is pages now, under the guild's own header
(its banner, its name and tag, the reader's rank and the treasury, the members and the vault's count):

| Page | What it holds |
|---|---|
| Overview | the arms in words, where the reader stands at the vault, the hall (GUILD3c: and where the rest of the guild is run, "Elsewhere") |
| Members | the roster - each member's rank and when they were last online (GUILD-SEEN, below) - and what the reader's rank may do to each; the guildmaster's grants; invitations (GUILD3c: and, folded, what each rank may do) |
| Treasury | the gold and its ledger, the silver and its lines (GUILD3c: which of the gold buys a hall or a new name; GUILD3b: each silver line by its kind and way) |
| Vault | the pieces, Take and Take one, Put in from the pack, the lines |
| Stores | the guild Stores and the writ budget - where the professions are this account's |
| Arms | the arms, and the guildmaster's choosing |
| Settings | a new name, the rank names, leaving and disbanding (GUILD3c: and, before the press, everything that still holds the guild) |

Each page keeps every control and sentence the section it took over had, so a refusal still says its reason beside its
button. `openGuild(page)` opens the tab at a page (the hall's chest: the Vault). A page turned keeps the keyboard's
focus on its own tab (the second audit's U9).

## GUILD-SEEN - when each member was last online (2026-10-11)

The owner: "the guild member list needs a 'last online' info, just like the friend list does". Each row of the Members
page says it the way a friend's row does (SOC3): a dot, lit while the member is at play, and under the rank a line -
"Online", or "Last online 3 h ago" in the friends list's own words (`net/social.js` lastOnlineText, the one ladder).

- **The stamp is the play beat's, and nothing new is written.** The guild's view (`server-account/src/guilds.js`
  viewOf) says each member's `seenAt`, in the service's seconds: the account's last play beat (ACC4's `played_at`,
  knocked once at entry and every PLAY_BEAT_S, five minutes, while a tab is in the world and visible), or - for an
  account that has never beaten - its last authenticated call (`last_seen`, touched hourly: SCALE4h). It is read in
  the roster's own statement, the players row found by its key; no write, no migration (acct113).
- **Online is the service's sitting.** A member is online while no wider gap than PLAY_GRACE_S (ten minutes) has
  passed since their beat - the gap `creditPlay` counts as one sitting - and the reader's own row always: they are
  playing it (`net/guild/guildBook.js` guildMemberOnline, guildSeenText). The service's seconds are read against this
  machine's clock, as the letterbox reads its stamps. A row the service said no stamp for (a Worker before acct113)
  says nothing of presence.
- **Read on the live pass, painted never.** "Last online 5 min ago" moves on the clock alone, and a sitting that
  lapses puts the dot out without a look: both are read again each frame (AUDIT SOC B8's law), off the book's
  freshest roster by the member's id. A look that moved only stamps moves no version (`pictureOf`), so the page is
  not painted again under the Invite field or a grant being chosen - every member's beat moves a stamp every five
  minutes.
- **What it is not.** The friends list's presence is the hub's, to the second; a guild member's is the beat's - a
  member who quits reads Online until their sitting lapses (up to ten minutes after their last beat), and "last
  online" is their last beat, up to five minutes before they left. The account's, not the character's: the roster
  names each member by the account's handle, and a member playing another character of theirs is at play. A guild's
  members are each other's by an invitation accepted, which is what a friendship grants presence on (AUDIT ONLINE A6).

Pins: `test/net/guildseen.test.js` (the service through the real Worker, the law, the book, the page);
`tools/mutants/guildseen.json`, 14 of 14 dead.

| Host | GUILD-SEEN |
|---|---|
| `scenes/world.js` | the Guild tab's book and panel, unchanged: the rows read what the book holds |
| `scenes/worldModes.js` | nothing to wire: an interior opens the same panel (the hall's chest, the Vault page) |
| `scenes/exterior.js` | FLAGGED, nothing to wire: the single-location dev host has no online guild |
| `scenes/dungeonContext.js` | nothing to wire: the Guild tab is world.js's on every face |

## The threats, and the answers

| Threat | Answer |
|---|---|
| A save-edited piece laundered through the vault | Only what the realm record holds goes in, by the trade's own law, in the record's own batch |
| A piece duplicated by two takes | The slot is emptied, and the record written, in one batch guarded by the slot's time and count |
| An officer drains the vault | Ten takes a day by default; the guildmaster limits or revokes, and a revoke stops a take already on its way |
| A take lands on a slot filled again under it | The take holds the very record it read |
| A name that reads as a slur or as the server's | The name filter, word by word, at a founding and a rename |
| A name changed to dodge a siege's record | Refused in a week the guild fights for a seat; a fortnight between renames |

**GUILD3 (2026-10-11, `Guilds-Made-Plain.md`) grew the pages, each said there:** the Members page folds what each rank
may do (the four power tables in words); the Treasury page says which of its gold buys a hall or a new name, and its
silver lines say which way they went (a Tribute, an upkeep, a patron's bid never "put in"); the Settings page lists
everything that holds a guild that would go before the press, the guildmaster's view carrying it (one read); the Overview says where the
rest is run; a character in no guild is told what a guild is for. AUDIT GUILD3 (`01-Overview/audits/Audit-Guild3.md`) made each
truer: the rank list says what a rank may not do and every act the service gates by rank; a silver line the service made
is the guild's; the list of holds is the gate's own (one list), an open writ no "treasury full", the silver's room said
before the press, and a refusal's word the page cannot read again never a lock.

## Pins

`test/net/guild2_service.test.js` (the service, through the real Worker) and `test/net/guild/guild2_client.test.js` (the laws, the
art, the book, the door, the pages); `tools/mutants/guild2.json`.

## The audit (2026-10-03, Mac: "Audit this")

Read whole before the merge; each finding reproduced against the real Worker or the real modules before it was fixed,
then pinned and its fix mutated (`tools/mutants/guild2.json`, the `AUDIT-GUILD2-` records).

| # | Found | Fixed |
|---|---|---|
| G1 | A take landing after its slot was emptied and filled again in the same second gave the old piece and deleted the new | The take holds the record it read |
| G4 | A revoke between a take's read and its batch let the take land | The batch holds the standing read |
| G2 | A lone guildmaster's realm delete let the guild stand memberless with its vault | Refused, `guild-vault` |
| G3 | "The 22 Blades" and a tag of 22 were refused by the filter's "needs some letters" | A letterless word passes |
| G5 | A grant by row id may reach a newcomer given a deleted row's id | Accepted, written down (GUILD2b) |
| G11-G14 | Holes in the first colour over a divided field; three caches keyed by GUILD1d's three; a border of the second colour; "a Swords" | Each fixed (GUILD2c) |
| M1-M3 | The vault's town read once at the build; the vault read once a session; another guild's pieces shown with Take after a failed read | Each fixed (GUILD2b) |
| - | The grant's select rebuilt the whole panel, its focus lost; "Takes out" started at any number; a swatch the law refused left open; touch swatches under 44 pixels; the hall's name after a rename unpinned | Each fixed; the hall's name asserted |

The service's two fixes that move rows (G1, G4) need no migration; the relay re-bundles the heraldry law (world161 -
world157 when this was written, renumbered past main's DFO integration, then past AEGIS's world160; no wire change).

## The second audit (2026-10-03, Mac: "Audit again. Just want perfection")

Read whole again in six lenses; each finding reproduced before it was fixed, then pinned and its fix mutated
(`tools/mutants/guild2.json`, the `AUDIT2-GUILD2-` records).

| # | Found | Fixed |
|---|---|---|
| K1 | A vault take whose answer was lost was read as landed with no piece, and the checkpoint after it wrote the record without the piece - gone from the vault and the record | `needsAnswer`: the session ends, a join reads the record (GUILD2b) |
| S2/S7 | The filter's stretched reading per word refused "The Iron Staff" and "The Dark Mood"; the word caught and the fortnight's end were dropped by the route and the book | A word read as written; `why` and `at` said (GUILD2a) |
| S3 | A put decided with a hall's hundred landed after the hall's sale; the bound read by a slot's index | The bound in the batch, by count and slot (GUILD2b) |
| S4/S5/S6 | A put held no standing; a grant held no granter's rank; a withdrawer granted with no limit was unlimited | Each held; ten a day (GUILD2b) |
| K14/K15 | A look's read answered after a take's showed the piece back; a piece the pack no longer held said "more than the stack holds" | The last read asked shown; `vault-goods` |
| G1 | A rename stripped the Chronicle's shields; a new guild with the old name wore them | `now` on each renamed guild a row names (GUILD2c) |
| G2 | A rim of the first colour round a hole on a divided field | Each colour clipped to its own part (GUILD2c) |
| G3/G5 | No pin held a division at the shield's box, the canvas shield's division or the service's round trip; stale wording (twenty-four devices, the device in the border's colour, the refusal's words) | Pinned; worded |
| U4/U7/U9/U10/U14 | Locked pieces offered to the vault; a grant's draft kept over a new standing; a page turn dropped the focus; the vault's pick a place in the list; a shut swatch said nothing | Each fixed (GUILD2b, GUILD2c, GUILD2d) |
| - | A rename's treasury line read "put in 25,000"; a rename refused for the fortnight on the batch's fresh read said no `at` | "renamed the guild for"; `at` said on both reads |

Two guards are recorded as equivalent, each with its reason (`tools/mutants/guild2.json`): the take's day count in its batch (a member is one realm character, whose record's sequence serializes its takes) and the rename's fortnight in its batch (every rename changes the name or the tag, which the batch holds as read). Each stays, the law the batch states; the race pins (two renames paying once) hold either way.

## The four hosts (THE FOUR HOSTS RULE)

| Host | GUILD2 |
|---|---|
| `scenes/world.js` | the guild book's hands - the pack a vault piece leaves and enters, the town it is reached in, the realm act (and its `abandon`); the Guild tab; the hall's and the seats' banners (`render/bannerPass.js` through `drawBanner`, `scenes/hallBanners.js`, `scenes/seatBanners.js`) |
| `scenes/worldModes.js` | interiors: the hall's chest opens the Vault page; a throne room's cloth keyed as the street's (`bannerKeyOf`) |
| `scenes/exterior.js` | FLAGGED, nothing to wire: the single-location dev host has no online guild, hall or banner (online play is world.js's) |
| `scenes/dungeonContext.js` | FLAGGED, nothing to wire: no hall, chest or banner below ground; the Guild tab is world.js's on every face |
