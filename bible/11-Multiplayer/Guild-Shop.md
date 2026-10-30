# The Guild Shop (GUILD-SHOP, GUILD-LOGO)

> Design page and record of the slice, written 2026-10-30 as it was built. The code's comments cite this page. Where
> the page and a pin disagree, the pin is what runs.

## 1. What the owner asked for

The owner, 2026-10-30, seven asks in one message:

1. "A armory aura arm piece where it shows your guild insigia in a detailed format on one of the upper arms. Just one side"
2. "New guild furniture pieces. A guild bank vendor, unique guild furniture pieces and anything else applicable"
3. "Guild insignia and sail customization for ships"
4. "Redesign the guild menu and layout. Introduce guild name change for cost."
5. "The new guild shop where you can purchase the insignia aura, guild furniture, guild profile icon, etc"
6. "The ability for guilds to submit their own logos and approval on discord instead of using the built in insignia creator"
7. "Everything should cost silver"

Daggerfall has no other players, no guild of players and no silver. None of this is a DFU member: the whole slice is
ours, online alone. Its Ledger A row is GUILD-SHOP.

## 2. The shop and its prices

One law, `src/net/guild/guildShopLaw.js`, names every ware. Silver is the account's currency (`marks`), so every
price is a burn on `marks_ledger` under a request id, written in the same batch as the purchase row it pays for.

| Ware | Section | Who pays | Silver | Most |
|---|---|---|---|---|
| Insignia Armlet | Aura Armory | the buyer's own silver | 1,500 | once an account |
| Guild Crest | portrait icon | the buyer's own silver | 600 | once an account |
| Guild Sailcloth | ships | the buyer's own silver | 1,200 | once an account |
| Guild Banker | hall furniture | the silver treasury | 6,000 | 2 |
| Heraldic Standard | hall furniture | the silver treasury | 1,500 | 6 |
| Crest Plaque | hall furniture | the silver treasury | 800 | 8 |
| Guildmaster's Seat | hall furniture | the silver treasury | 4,000 | 1 |
| War Table | hall furniture | the silver treasury | 3,000 | 2 |
| Weapon Rack | hall furniture | the silver treasury | 1,200 | 6 |
| Guild Brazier | hall furniture | the silver treasury | 900 | 8 |

A guild rename costs 2,500 silver from the silver treasury (`GUILD_RENAME_SILVER`), and a logo's review 2,500
(`GUILD_LOGO_FEE`). Any member buys the account's wares; the guildmaster alone buys the hall's (`GUILD_POWERS.shop`)
and sends a logo (`GUILD_POWERS.logo`).

An account's ware is a bit on `players.guild_wares`, so it stays with the account when its character leaves the guild.
The armlet and the crest join what `server-account/src/titles.js` says the account holds. A hall's furniture is a count
a guild owns (`guild_furniture`), and a piece set down in any hall of the guild's spends one of it.

## 3. The Insignia Armlet

An Aura Armory piece for the arms slot (code `c`, its own `guild` line, `src/net/armoryLaw.js`), drawn by
`src/render/armoryPass.js`. A gilt band rings the **left** upper arm, a third of the way from shoulder to elbow, enamelled
in the guild's field and device colours. On its outer face stands the guild's crest - its arms on beaten gold, or its
approved logo - as a texture painted once a pair of arms (`src/ui/guild/guildCrestArt.js`), with a soft halo under it.
`armletSide` keeps it on one side: the rig's left arm, and on a sprite the side that faces the eye.

ARMORY-MIRROR (`01-Overview/bugs/Field-Bugs-2026-10-30e.md`). A sprite's side view
has no arms read off its picture, so its points are the body's own and the armlet takes its left arm, as a rig's.
Seen from behind and to its right, or from its right side, that arm is behind the body and no armlet is drawn. On a
sprite the patch stands where the picture paints that arm clear of the body, as wide as it is painted (`ARM_BAND`); a
side view's at the body's back edge, where its near arm hangs.

A peer's armlet shows their guild's arms, read by the tag their token carries (`/v1/guilds/arms`, batched and kept by
`src/net/guild/guildArmsBook.js`). The relay bundles the armory law and the token's icons, so the relay is world295.

## 4. The hall's furniture and the Guild Banker

Seven pieces of our own (`src/world/guildFurniture.js`, models 864300 to 864306), textured by
`src/world/guildFurnitureArt.js` under pseudo-archive 38341. The banker, the standard, the plaque, the seat and the rack
carry the hall's own arms, painted again when they change. The brazier is a light.

A guild piece stands only in its guild's own hall, costs no gold where it is set down, holds nothing and is no station
(`server-account/src/guildFurniture.js`). The count is asked inside the placement's own INSERT, so two keepers setting
down the last one at once stand it once. The decor tool says the guild's stock beside each piece.

The **Guild Banker** is the guild bank vendor: a member who presses it opens the guild vault, as the hall's cupboards do
(`src/scenes/guildHallPress.js`). Anyone else is told it serves its guild alone.

## 5. The Guild Sailcloth

A ship's sail in a pattern of two paints - plain, stripes, bands, quartered, chevron, cross, border or saltire - and the
guild's arms on it where its captain flies them (`src/systems/naval/sailCloth.js`). Its first paint is the livery's
sail, its second one of the same fourteen paints. The cloth is one byte past the livery's four nibbles, so a build
before this slice reads such a livery as none and draws the ship as built.

The paint shop (`src/scenes/comeSailAway/shipLiveryPaint.js`) paints a cloth that flies arms one pair of arms at a time:
mine my guild's, a peer's their owner's guild's. The Fleet's paint panel opens the cloth once the account holds the
ware (`src/ui/sailClothPanel.js`). A cloth a ship already flies stays through a repaint after that.

## 6. The guild window

The window keeps GUILD-WINDOW's shape and pins and looks new (`src/ui/guild/guildWindowLook.js`). Its head carries the
guild's crest - the logo in a ring, or its shield on a ring of its border's colour - over a wash of its field, the arms in
words under its name, and its tiles as one ribbon. Its pages stand in three groups: Guild, Wealth and Identity.

The **Shop** page (`src/ui/guild/guildShopPage.js`) shows each ware drawn (`guildWareArt.js`), its price and who pays,
in two cards: For you, and For the hall. Buy is pressed twice, as every silver spend in the window. A refused buy says
why under its button. The **Arms** page opens with the logo card, then the arms editor.

## 7. A guild's own logo, approved on Discord

The guildmaster picks a picture. `src/ui/guild/guildLogoPick.js` cuts its middle square and draws it 128 pixels across
as a PNG (a WebP where the PNG is over 48 KB). The service sniffs and checks it again, stores it in the bucket and holds
the fee from the silver treasury in escrow (`server-account/src/guildLogos.js`). One review stands at a time.

The safety minute posts a card to the moderators' channel with the picture and two buttons, Approve and Turn down
(`glogo:ok:<id>`, `glogo:no:<id>`). Only a moderator's press decides; the card is redrawn with who decided. Approved,
the fee is burnt and the logo takes the place of the device on the guild window's crest, the Guild Crest portrait, the
armlet, the sails, the hall's furniture and the hall's street banners (`src/scenes/hallBanners.js` paintHallBanner). Turned down or withdrawn,
the fee comes home. The guildmaster gets a letter either way, and may take an approved logo down again. A worn logo's
card keeps one button, Take down (`glogo:off:<id>`): a moderator's press restores the guild's device and writes the
guildmaster a letter.

A logo is served at `/v1/guilds/logo/<id>` while it is under review or approved, and to nobody once it is not.
Discord's commands are unchanged: the buttons ride the existing interactions endpoint.

## 8. Tamriel-wide

Nothing here keys a place. The arms, the shop and the logo are a guild's; the furniture stands in a hall wherever
the guild's hall is; the sails go wherever a ship sails. No new code reads the Bay's own map.

## 9. The four hosts

| Host | What it carries |
|---|---|
| `scenes/world.js` | the guild book, the decor room and the ships' pool it already wires; no new lines (bootWorld at its ceiling) |
| `scenes/worldModes.js` | a hall piece pressed - the banker and the board - through `guildHallPress.js` (one line, the ceiling lowered) |
| `scenes/exterior.js` | none: the bench has no account, no guild and no hall, by design |
| `scenes/dungeonContext.js` | none: no hall, no ship and no guild window in a dungeon, by design |

The armlet is drawn by the aura host (`scenes/auraHost.js`) in every host that draws the Aura Armory.

## 10. Versions, migration and pins

Account acct228, migrations `0198_guild_shop.sql` and `0199_guild_ranks.sql`. Relay world295. Pins:
`test/server/guildshop_service.test.js`, `test/render/insigniaarmlet.test.js`, `test/systems/guildfurniture.test.js`,
`test/systems/naval/sailcloth.test.js`, `test/net/guild/guildshop_window.test.js`, `test/server/guildorphan.test.js`,
`test/server/guildranks.test.js`, `test/net/guild/guildranks_window.test.js`.

## 11. Decided while building

- **Silver for everything** - the ask's seventh line. The rename moved from 25,000 gold to 2,500 silver.
- **One left arm.** The ask says one side; the left keeps the right arm's weapon glow clear.
- **A logo replaces the device, not the shield.** The field, the division and the border stay the guild's own.
- **The sailcloth is the account's.** A guild's colours belong to whoever sails under them; the arms are read live.
- **A ship's flag stays heraldic.** Its shapes are cut from the arms' parts; the sail carries the logo.

## 12. A guild that is gone (GUILD-ORPHAN)

The owner, 2026-10-30: "Ability to leave guild if it doesnt exist". A member row whose guild's row is gone held its
character in a guild nobody could read: the window said no guild, and founding or joining said already in one. The
service lets such a row go at the first look or act (`server-account/src/guilds.js` dropOrphan). A leave of it is a
leave, with the hub's out order; the character may found or join again.

## 13. More ranks, and what each may do (GUILD-RANKS)

The owner, 2026-10-30: "More guild ranks plus rank permission edits". A guild keeps four to eight ranks
(`GUILD_RANKS_MIN`, `GUILD_RANKS_MAX`), added or taken at the bottom on the window's **Ranks** page
(`src/ui/guild/guildRanksPage.js`). A new member joins at the lowest. A rank taken moves its members to the new lowest,
in the rename's own batch.

The guildmaster sets which ranks hold each power it may give (`GUILD_POWERS_EDITABLE`): invite and answer requests,
remove, promote, put in, take out, vault grants, the shop's furniture, the logo, the hall's door, its decor and the
board's notes. The guild keeps its word in `guilds.powers`; a power it never set stands at the law's default. The
guildmaster holds every power. Founding, handing on, disbanding, the name, the arms, the hall's sale and the ranks
themselves stay the guildmaster's. Seats, castles, writs and contracts keep their own laws.

Every check reads the guild's table: the read through `guildMay(rank, power, table)`, and each statement that guards a
write through `guildPowerSql`, which reads `guilds.powers` inside the statement. A rank acts only on ranks under its own,
the vault's grant too.

## 14. Join requests (GUILD-REQUESTS)

The owner, 2026-10-30: "Player guild join requests". A character in no guild asks a guild by its tag from the join page
(`src/ui/guild/guildRequestNodes.js`). A request stands a week; a character holds three at once and a guild hears
thirty (`server-account/src/guilds.js` requestToJoin, each bound asked inside the INSERT). Where the guild already
invited the account, its invitation is answered instead.

A rank that may invite sees the requests on the Members page and accepts or declines each. Accepted, the character joins
at the lowest rank while the guild has room, and every other request it holds goes in the same batch. The asker gets a
letter either way and may withdraw a request before it is answered.

## 15. The second audit

The owner, 2026-10-30: "Audit everything". Four read-only lanes; every finding below is fixed in place.

- **Powers in the write.** A withdrawal (gold, silver, a patron's bid), a rank move and a vault grant read the guild's
  powers inside their own statement. A rank move never lands past the lowest rank. A ranks or powers edit lands only
  over what it read, by the guildmaster still.
- **Grants.** A rank below the guildmaster grants no more of the vault than it has itself.
- **Growth.** Ranks added under the lowest take the powers it held. The grid sends only what differs from the defaults.
- **Requests.** One an account a guild, the cap the account's; ids never reused; gone with the character; a decline's
  letter only for a request it ended.
- **Sails.** Peers now see a Guild Sailcloth: the relay carries it as `gsc` (its own `sc` is a session secret), and
  the Aura Armory's kit on every roster row. A reused arms slot lets its old pictures go.
- **Logos.** Moderators may take down a worn logo. A rename's and a logo's request ids are one guild's.

