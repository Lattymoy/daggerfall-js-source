# Accounts and cloud saves

The account service: who a player is online, the name the world reads, cloud copies of saves, and everything an
account holds (titles, glyphs, auras, Renown, letters, the server's post). It is a Cloudflare Worker of its own
(`server-account/`, D1 for records and R2 for save blobs), apart from the relay, so an account deploy never drops a
connected player. The player meets it at the front door (sign in, register, guest), the profile card on the pause menu,
the Online pane's character tiles, and the cloud line on save tiles. DFU has no accounts.

## How it works

**Two Workers.** The relay (`server/`) carries rooms, poses and chat; the account service carries accounts, sessions,
saves and everything durable. They trust each other through a signed identity token: the service mints it
(`/v1/auth/token`, Ed25519, its public half at `/v1/pubkey`), the relay verifies it. A token lives at most `MAX_TTL_S`
(five minutes, `src/net/identityToken.js`) and carries the name the room reads (`n`), the realm character and the badges
(titles, glyphs, guild tag, effects kit). No client writes its own name: the relay reads it out of the token.

**Accounts** (`server-account/src/accounts.js`).
- *Guest*: `/v1/auth/guest` makes an account with a generated two-word name (`server-account/src/guestName.js`).
- *Registered*: `/v1/auth/register` with a handle and a password. A handle starts with a letter, up to 24 characters,
  no spaces (`src/net/handleShape.js` `HANDLE_RE`), never an email address (`handleLooksLikeEmail`), and passes the name
  filter. A password is `PASSWORD_MIN`..`PASSWORD_MAX` (8 to 200), stored as PBKDF2-SHA256
  (`server-account/src/password.js`).
- *Recovery*: a set of `RECOVERY_SET_SIZE` (8) codes, each spent alone, only their hashes kept. A new set comes from the
  profile behind the password and one current code (`/v1/auth/recover` uses a code).
- *Sessions*: one per device, idle out after a year (`SESSION_IDLE_S`). Logins are rate limited (`LOGIN_MAX` per
  `LOGIN_WINDOW_S`).
- *Terms*: a new account ticks the Terms of Service and the Privacy Policy (`terms/index.html`, `privacy/index.html`)
  before it exists.

**The name the room reads** (`NAME_AS`): the account's, or the realm character's, the player's choice on the profile
card; the mint signs it.

**Cloud saves** (`server-account/src/saves.js`, `/v1/saves`). For registered accounts only. The blob and its screenshot
live in R2 (`SAVE_MAX_BYTES` 4 MiB, `SHOT_MAX_BYTES` 256 KiB), the card (name, character, time) in D1, at most
`SAVES_MAX` (60) an account. Offline, the cloud is a backup and a transfer: the local save stays the truth
(`src/systems/cloudSaves.js`). A save only in the cloud appears on the Load screen and can be pulled down. Online
characters are the realm's, where the service holds the truth (`06-Systems/Realm-Arc.md`).

**The front door and the Online pane.** Sign-in sits at the front door; online play needs a token, which a guest also
holds under its generated name. The Online pane is the account's realm characters as tiles, with one card above them
only while nobody is signed in.

**The profile card** shows the portrait, registered date, time played, titles and glyphs to wear, the name choice, the
recovery codes, the duel record and Renown.

**Titles, glyphs and auras** (`server-account/src/titles.js`). Derived at every ask, never stored where they can be
derived: Founder (an account first played by `FOUNDER_UNTIL`), the Patreon tiers (`server-account/src/patreon.js`
`PATREON_TITLES`: Disciple, Apostle, Herald, Hierophant, following the linked pledge), Developer
(`DEVELOPER_HANDLES` in `server-account/wrangler.toml`, with the Seraph Wings aura), Moderator (`MODERATOR_HANDLES`,
the blue shield, `/mute` and `/unmute`), the Dungeon Master, firsts and season and event honours, the Marks of Mastery,
and personal titles with their own glyph and aura made for named players. A glyph can be taken off.

**Renown** (`src/net/renown.js`). An online-only level on top of Daggerfall's, each character's own: health
(`RENOWN_HP_PER_LEVEL`) and magicka (`RENOWN_MP_PER_LEVEL`) a level, earned by kills, quests, raids and serpents at
`RENOWN_RATE_PCT` (three quarters), at most `RENOWN_XP_HOUR_MAX` an hour. The HUD shows a bar with no numbers.

**The server's post** (`server-account/src/post.js`, `/v1/post/*`). A mailbox beside the hourglass: letters from the
team and gifts, written by the operator's workflow (`tools/sendServerPost.mjs`). The **Lost and Found**
(`server-account/src/lostSpoils.js`, `/v1/post/lost`) holds what a boss's floor still held when the player left.
Player letters are `06-Systems/Community-Arc.md`; private reports `06-Systems/Private-Reports.md`.

**Operator tools.** A developer can issue a new recovery code (`tools/reissueRecoveryCode.mjs`), grant a customs pass
(`tools/customsPass.mjs`) or read an Abyss Dungeon's clears (`tools/sdClears.mjs`).

## Rules

- The wall is at cloud saves: guests and registered players both connect, chat and play; cloud saves need a registered
  account (Mac).
- No typing a name and entering: the name over a head is the token's (Mac).
- The account's name is used online (Mac), or the character's by the player's choice (Mac).
- Usernames are never email addresses (the owner).
- Recovery: a set of codes in the profile; a new set needs the password and one code (Mac).
- Terms and Privacy are ticked before an account exists; existing accounts are not asked (Mac).
- Renown sits on top of Daggerfall's level, each character's own; every source pays three quarters (Mac).
- Online is the realm's; the Online pane is the save tiles (Mac).
- The Cloudflare credential is not rotated (Mac); it stays in the repository's secrets, never in a file or a command
  line.
- The account deploy and the relay deploy are separate; a relay deploy happens only when `RELAY_VERSION` moves.

## Code and tests

- `server-account/src/service.js` - routes, versions, body bounds, replicas
- `server-account/src/accounts.js`, `server-account/src/password.js`, `server-account/src/signing.js` - accounts,
  sessions, passwords, recovery, token signing
- `server-account/src/saves.js`, `src/systems/cloudSaves.js` - cloud saves
- `server-account/src/titles.js`, `server-account/src/patreon.js` - titles and the Patreon link
- `server-account/src/post.js`, `server-account/src/lostSpoils.js` - the server's post and the Lost and Found
- `src/net/accountClient.js`, `src/net/identityToken.js`, `src/net/handleShape.js` - the client and the shared laws
- `test/server/accountflow.test.js`, `test/server/accountworker.test.js`, `test/net/identitytoken.test.js` - accounts,
  the Worker and the token
- `test/server/cloudsaves.test.js` - cloud saves
- `test/server/recoveryset.test.js`, `test/server/audit_recoveryset.test.js` - recovery codes
- `test/net/handleemail.test.js`, `test/net/nameas_service.test.js`, `test/net/nameas_client.test.js` - names
- `test/server/acc3titles.test.js`, `test/server/acc4played.test.js`, `test/server/founder5.test.js`,
  `test/server/patreon_link.test.js` - titles, time played, Founder, Patreon
- `test/net/renown1.test.js`, `test/server/renown_char.test.js` - Renown
- `test/server/serverpost_service.test.js`, `test/server/lostspoils_service.test.js` - the post
- `test/server/audit0929_terms.test.js` - the Terms gate
