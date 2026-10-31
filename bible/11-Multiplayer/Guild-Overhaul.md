# Player Guilds: the window, the vault, the arms

A player's online guild: founded by a character of enough Renown, up to 75 members, with ranks, two treasuries (gold and
Silver), a vault of items, a hall, and arms drawn on every banner. Players run it from the Guild window, opened from the
Social panel's Guild tab or a hall's chest. Daggerfall's own guilds are DFU's factions and are untouched; this page is
the port's own. Seats, castles, the shop and the plain-words rules have their own pages (`Seats-Arc.md`, `Domains.md`,
`Guild-Shop.md`, `Guilds-Made-Plain.md`).

## How it works

**Founding and ranks** (`src/net/guild/guildLaw.js`, `server-account/src/guilds.js`). A registered account's realm
character of at least `GUILD_FOUND_RENOWN` Renown founds a guild for `GUILD_FOUND_GOLD` gold, its name 3 to 32 words and
its tag 2 to 4 capitals or digits (`GUILD_TAG_RE`). A guild holds up to `GUILD_MEMBERS_MAX` (75). It keeps
`GUILD_RANKS_MIN` to `GUILD_RANKS_MAX` (4 to 8) ranks; what each rank may do is the guild's own table
(`Guild-Shop.md`).

**A new name.** The guildmaster renames the guild, its tag, or both, for `GUILD_RENAME_SILVER` (2,500) from the silver
treasury, at most once a `GUILD_RENAME_COOLDOWN_S` (a fortnight), never while the guild has a battle standing. A name and
tag pass the name filter whole and word by word (`guildWordsOk`); the refusal names the word. The old name is free at
once; the rename is written to `guild_renames`, and the Chronicle shows a renamed guild under its old name with "(now
...)".

**The vault** (`src/net/guild/guildVaultLaw.js`, `server-account/src/guildVault.js`). `GUILD_VAULT_SLOTS` (50) slots,
and `GUILD_VAULT_HALL_SLOTS` (50) more while the guild holds a hall. A realm character's piece moves in or out as a trade
does, in one batch on the service, and keeps its whole record. Never a worn, quest, summoned or bound piece, gold, a
boat's, or the Materials Bag. Rank defaults (`VAULT_RANK_DEFAULTS`): the guildmaster takes out without limit, Officers
take out ten presses a UTC day, Members and Recruits put in. Ranks with the power grant a member no access, put in, or
take out with a daily limit (`VAULT_LIMIT_CHOICES`). Put in and take out work in a town; a hall's chest and the Guild
Banker open it. Each move is a line in the vault's log. A guild with pieces in its vault cannot disband.

**Arms** (`src/net/heraldryLaw.js`, `src/ui/heraldryArt.js`). A field of one of `HERALDRY_COLOURS`, plain or divided
(`HERALDRY_DIVISIONS`: per pale, per fess, per bend, per bend sinister, quarterly, per chevron, per saltire) with a
second colour, a border, and one of forty devices (`HERALDRY_DEVICES`) in its own colour. Every face that draws the
guild draws them: hall and seat banners, the tag's shield, the siege HUD, the Chronicle, the name plate and the window's
head. The first raising is free; a change costs `HERALDRY_CHANGE_DRAKES` (500 Silver), burnt. An approved logo can
replace the device (`Guild-Shop.md`).

**The window** (`src/ui/socialPanel.js`, `src/ui/guild/guildWindowLook.js`). The Guild tab opens a window of its own,
up to 1,060 by 740 pixels, taking the screen on small displays. Its head shows the crest, name, tag and tiles (rank,
gold, Silver, members online, vault, hall). Its pages are a column in groups: Overview, Members, Ranks, Treasury, Vault,
Stores, Arms, Shop and Settings. The arrow keys walk the pages. Each Members row shows "Online" or "Last online 3 h ago"
from the account's play beat (`guildMemberOnline`, `guildSeenText`); a member is online while their last beat is within
`PLAY_GRACE_S`. A hidden staff member reads as last seen when they hid.

## Rules

- A guild can change its name for a price; the vault's use is granted and revoked by the leader; arms are chosen and
  drawn on every banner (Mac).
- Everything in the guild costs Silver (the owner).
- Membership is per character; a guild's vault is realm characters' alone.
- A rename is never cheaper than a fortnight's wait, and never while the guild is in a battle.
- Guild powers are checked inside the statement that writes, so a demotion landing mid-act refuses it.

## Code and tests

- `src/net/guild/guildLaw.js`, `src/net/guild/guildVaultLaw.js`, `src/net/heraldryLaw.js` - the law: founding, ranks, the vault, the arms
- `src/net/guild/guildBook.js` - the page's guild book
- `src/ui/socialPanel.js`, `src/ui/guild/guildWindowLook.js`, `src/ui/heraldryArt.js` - the window, its look, the arms' art
- `server-account/src/guilds.js`, `server-account/src/guildVault.js` - the service
- `test/net/guild2_service.test.js`, `test/net/guild/guild2_client.test.js` - the service and the tab
- `test/net/guild/guildwindow.test.js`, `test/net/guildseen.test.js` - the window, last online

## Open

- A vault grant names its member by row id; a stale page could grant a newcomer who took a departed member's id. It is
  the guildmaster's own act, shown at once and undone by the next grant.
