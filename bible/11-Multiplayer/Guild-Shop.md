# The Guild Shop

The Guild window's Shop page sells guild wares for Silver: an Insignia Armlet for the Aura Armory, a Guild Crest
portrait icon, a Guild Sailcloth for ships, and seven pieces of hall furniture including the Guild Banker. A guild can
send its own logo for approval on Discord in place of its device. The same work brought editable ranks and powers, join
requests, and a way out of a guild that no longer exists. All of it is online and the port's own.

## How it works

**Wares** (`src/net/guild/guildShopLaw.js` `GUILD_SHOP_WARES`). Every price is a Silver burn on `marks_ledger` under a
request id, in the same batch as the purchase row. Any member buys the account's wares; holders of the `shop` power buy
the hall's.

| Ware | Kind | Who pays | Silver | Most |
|---|---|---|---|---|
| Insignia Armlet | Aura Armory | the buyer | 1,500 | once an account |
| Guild Crest | portrait icon | the buyer | 600 | once an account |
| Guild Sailcloth | ships | the buyer | 1,200 | once an account |
| Guild Banker | hall furniture | the silver treasury | 6,000 | 2 |
| Heraldic Standard | hall furniture | the silver treasury | 1,500 | 6 |
| Crest Plaque | hall furniture | the silver treasury | 800 | 8 |
| Guildmaster's Seat | hall furniture | the silver treasury | 4,000 | 1 |
| War Table | hall furniture | the silver treasury | 3,000 | 2 |
| Weapon Rack | hall furniture | the silver treasury | 1,200 | 6 |
| Guild Brazier | hall furniture | the silver treasury | 900 | 8 |

An account's ware is a bit on `players.guild_wares`, kept when its character leaves the guild. A rename costs
`GUILD_RENAME_SILVER` and a logo review `GUILD_LOGO_FEE` (2,500 each).

**The Insignia Armlet** (`src/net/armoryLaw.js`, drawn by `src/render/armoryPass.js`). A gilt band on the left upper arm
in the guild's colours, its crest (arms or approved logo) on the outer face (`src/ui/guild/guildCrestArt.js`). On a
sprite it stands on the side the picture paints that arm, and is hidden when that arm is behind the body. A peer's
armlet shows their guild's arms, read by tag (`/v1/guilds/arms`, `src/net/guild/guildArmsBook.js`).

**Hall furniture** (`src/world/guildFurniture.js`, `src/world/guildFurnitureArt.js`, models 864300-864306). A piece
stands only in its guild's hall, costs no gold to set down and holds nothing; setting one down spends one of the guild's
count, checked inside the placement's own insert (`server-account/src/guildFurniture.js`). The banner, plaque, seat,
standard and rack carry the hall's arms. The **Guild Banker** opens the guild vault to a member
(`src/scenes/guildHallPress.js`).

**The Guild Sailcloth** (`src/systems/naval/sailCloth.js`). A sail in a pattern of two paints with the guild's arms,
painted in the paint shop (`src/scenes/comeSailAway/shipLiveryPaint.js`, `src/ui/sailClothPanel.js`). It is one byte
past the livery's nibbles, so an older build draws the ship as built. The relay carries it to peers as `gsc`.

**A guild's own logo** (`src/ui/guild/guildLogoPick.js`, `server-account/src/guildLogos.js`). The logo power's holder
picks a picture; the client crops it square at 128 pixels, and the service checks it, stores it and holds the fee in
escrow. One review at a time. The safety clock posts a card to the moderators' channel with Approve and Turn down; only a
moderator's press decides. Approved, the fee is burnt and the logo replaces the device (never the field, division or
border) on the crest, armlet, sails, furniture and the hall's street banners. Turned down or withdrawn, the fee comes
home; either way the guildmaster gets a letter. A moderator may take a worn logo down. A logo is served at
`/v1/guilds/logo/<id>` only while under review or approved.

**Ranks and powers.** A guild keeps `GUILD_RANKS_MIN` to `GUILD_RANKS_MAX` (4 to 8) ranks, added or removed at the bottom
on the Ranks page (`src/ui/guild/guildRanksPage.js`); a new member joins at the lowest. The guildmaster sets which ranks
hold each power in `GUILD_POWERS_EDITABLE` (invite and requests, remove, promote, vault put-in, take-out and grants, the
shop, the logo, the hall's door and decor, board notes), kept in `guilds.powers`. Founding, handing on, disbanding, the
name, the arms, the hall's sale and the ranks stay the guildmaster's. Every check reads the guild's table inside the
statement that writes (`guildPowerSql`), and a rank acts only on ranks below it.

**Join requests.** A character in no guild asks a guild by tag (`src/ui/guild/guildRequestNodes.js`). A request stands
`GUILD_REQUEST_TTL_S` (a week); a character holds `GUILD_REQUESTS_MAX` (3), a guild hears `GUILD_REQUESTS_GUILD_MAX`
(30). A rank that may invite accepts or declines; accepted, the character joins at the lowest rank and its other
requests go. The asker gets a letter either way.

**A guild that is gone.** A member row whose guild no longer exists is let go at the first look or act
(`server-account/src/guilds.js` `dropOrphan`), so the character may found or join again.

## Rules

- An armory arm piece showing the guild's insignia on one upper arm (the owner).
- Guild furniture, a guild bank vendor, guild sails, a guild profile icon (the owner).
- Guilds may submit their own logos, approved on Discord (the owner).
- Everything costs Silver (the owner).
- More ranks with editable permissions, and player join requests (the owner).
- The armlet sits on the left arm, keeping the right arm's weapon glow clear.
- A logo replaces the device, never the shield's field, division or border.
- The sailcloth is the account's; the arms on it are read live from the guild.
- Nothing here keys a place: it works wherever a guild's hall stands or a ship sails (TAMRIEL-WIDE).

## Code and tests

- `src/net/guild/guildShopLaw.js`, `src/net/guild/guildLogoLaw.js`, `src/net/guild/guildLaw.js` - wares, logos, ranks and powers
- `src/ui/guild/guildShopPage.js`, `src/ui/guild/guildRanksPage.js`, `src/ui/guild/guildLogoPick.js` - the Shop, Ranks and logo pages
- `src/world/guildFurniture.js`, `src/systems/naval/sailCloth.js`, `src/render/armoryPass.js` - furniture, sails, the armlet
- `server-account/src/guildShop.js`, `server-account/src/guildFurniture.js`, `server-account/src/guildLogos.js`, `server-account/src/guildPowerSql.js` - the service
- `test/server/guildshop_service.test.js`, `test/net/guild/guildshop_window.test.js` - the shop
- `test/render/insigniaarmlet.test.js`, `test/systems/guildfurniture.test.js`, `test/systems/naval/sailcloth.test.js` - armlet, furniture, sails
- `test/server/guildranks.test.js`, `test/net/guild/guildranks_window.test.js`, `test/server/guildorphan.test.js` - ranks, orphans
