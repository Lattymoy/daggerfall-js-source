# Chat Safety

The online game's protection against abuse in chat: a personal block list, reports backed by the relay's signature on
every line, a record of sanctions that is never cleared, a mute ladder and bans, an AI reviewer that sorts reports and
reads the public channels, a slower pace for new voices, a written code of conduct, and a moderators' queue in Discord
and in the game. Players meet it as **Block** and **Report** on a line's menu, `/block`, `/report` and `/rules`, the
code-of-conduct card before their first line, and a mute or ban notice.

## How it works

**The word mask.** TEXT-F1's list stars listed words in `sanitizeChat` at both ends. It is the first wall; intent needs
the rest.

**Blocks** (`server-account/src/safety.js`, `src/scenes/chatSafetyHost.js`). An account keeps up to `BLOCKS_MAX` (200)
blocked accounts on the service, so the list follows it to every device; the client applies it. A blocked account's
lines are never kept in the log (and lines already heard are taken back); its friend requests, party invites, notes,
trades, duels, weddings, cards and journal pages are dropped; its letters are never delivered. The relay stamps every
directed request with its sender's account so the block can hold it. The blocked account is never told. Commands:
`/block`, `/unblock`, `/blocked`; a name matching two accounts is refused, never guessed.

**The line's witness** (`src/net/safety/chatStamp.js`). The relay signs every chat line it fans with its receipt key
(`GATE_SIGNING_KEY`), over the tab, the speaker's verified account, the name, its clock and the text as fanned. Only a
line the room's budget passed is signed. The account service verifies each stamp before it keeps a word. A reporter may
leave lines out, but cannot add words nobody said: a line the relay did not relay refuses the whole report. Its signed
bytes begin `chat-stamp1\n`, so a stamp never passes as a token, order or receipt.

**Reports and cases** (`src/net/safety/safetyLaw.js`, `POST /v1/safety/report`). A report names an account, a reason
(`REPORT_REASONS`), an optional note and 1 to `REPORT_LINES_MAX` stamped lines, at least one the account's own. Reports
on one account gather into one open case; the account's own lines take room from others' when the case is full.
`REPORT_AUTO_MUTE` (3) reporters who count within an hour mute the account for the ladder's first rung (half an hour);
a reporter counts when registered, not muted and past the sprout age. A muted player may still report.

**The record, the ladder, the ban** (`server-account/src/sanctions.js`). Every mute, unmute, ban, unban and dismissal is
a row in `mod_actions` that nothing clears. A strike is a mute or ban in the last `STRIKE_WINDOW_S` (90 days); the next
strike suggests `LADDER_MIN` (30 minutes, a day, a week), then a ban. Automatic mutes only take the first rung, and a
dismissed case voids them. A ban (1 to `BAN_DAYS_MAX` days, or for good) answers `banned` on every door behind a
session and at sign-in, so it mints no token. A ban order closes the account's sockets and refuses its hellos. A
moderator is never muted or banned.

**Reaching every room.** The service posts signed mute and ban orders to the relay's law door (`RELAY_LAW_URL`, the
Worker's `lawDoor`) through a service binding; the hub applies them and hands them to the target's own hub sockets. The
hub also hands each socket a signed **lease** carrying its current mute and freeze, which the game passes to every other
room it holds (`src/net/roomLease.js`); with the relay's `leaseDoor` on, a room hears a bound socket only under a live
lease.

**The reviewer** (`server-account/src/modAi.js`, `server-account/src/safetyClock.js`). On the service's minute clock,
never in a request, it reads reported cases first, then the relay's signed feed of the public channels (World, Region,
language, Trade, LFG - never party, guild or place talk; `src/net/safety/chatFeed.js`). It calls the Messages API with
`MOD_AI_MODEL_DEFAULT` unless `MOD_AI_MODEL` names another, inside a daily call budget with a quarter kept for reports.
Speakers are labelled P1, P2; lines go in as escaped data; the answer is held to a schema. A severe flagged speaker gets
a case of its own. With `MOD_AI` `on`, a severity-3 verdict at high confidence in harassment, hate, sexual or threat
mutes for half an hour, but only if a second read of the account's own lines agrees. With `shadow`, its verdicts are
shown and it acts on nothing. It never bans.

**The reviewer's brief.** It is the `MOD_AI_PROMPT` Worker secret. The account deploy puts it from the repository secret
of the same name. The repository is public, so the brief is never in it (PROMPT-HIDDEN). Without it the reviewer reads
nothing. The code's rules fill its `{conduct}` mark.

**A new voice's pace.** A guest or a sprout account says one public line every `NEW_VOICE_GAP_MS` (4 s), metered per
account at the relay; a line too soon is refused to its speaker alone and put back in the field. Party, guild and place
talk are never slowed.

**The code of conduct** (`src/net/safety/conduct.js`, `src/ui/conductCard.js`). Six rules in the player's language,
naming hate by what it attacks, the joke included. The reviewer's brief takes the same English lines at its `{conduct}` mark. The token
says whether the account agreed to `CONDUCT_VERSION`; the first line sent without agreement stands the card. The client
asks; the Terms bind every player either way.

**The moderators' queue.** Every case is a card in a private Discord channel with its lines, reports, the reviewer's
verdict, strikes and the next rung, and buttons: Mute 30 min, Mute 1 day, Mute 7 days, Ban 30 days, Dismiss
(`server-account/src/discord.js`). `/mod lookup | mute | unmute | ban | unban` acts by account id first, then name. In
the game: `/cases`, `/case`, `/dismiss`, `/strikes`, `/modhelp`. Who may act is the game's question: `DISCORD_MODERATORS`
pairs a Discord id with a handle, and a press counts only while that handle holds moderator or developer rights. Every
interaction's signature is checked over the exact bytes.

## Discord is code (DISCORD-CODE)

The bot's commands are declared once in `server-account/src/discordCommands.js` (`DISCORD_COMMANDS`); its cards and
answers are `server-account/src/discord.js`; its channel and moderators are `server-account/wrangler.toml`. The account
deploy (`account-deploy.yml`, "Point Discord at the service", `tools/discordModCommands.mjs --setup`) sets the
Interactions Endpoint URL, overwrites the whole command list and checks the bot's permissions in the channel, turning
red with what is missing. Change Discord by changing those files and merging. A person still makes the application,
invites the bot, grants its roles and rotates its token (`DISCORD_BOT_TOKEN`). With none of it set, cases still gather
and the in-game commands still answer.

## Rules

- Combat abuse without in-game moderation alone: block, witnessed reports, a Discord queue with a record and bans, an AI
  reviewer that sorts and never bans, a code of conduct, a new voice's pace (Mac).
- Bans exist; a mute alone is bounded at a week (Mac).
- The reviewer ships in shadow: measure first, then enforce (Mac).
- Discord changes are repository changes the deploy applies; never ask for the bot's token or Portal clicks the deploy
  can do (Mac).
- The block list stands beside the social pages' own rate limit.
- Retention: feed batches a day (`FEED_KEEP_S`); a resolved case's lines, notes and reason 90 days, its card redrawn
  without them; a case open 90 days expires; the record of acts is kept.

## Daggerfall Unity

Daggerfall Unity has no chat; none of this is a DFU member.

## Code and tests

- `src/net/safety/safetyLaw.js`, `src/net/safety/chatStamp.js`, `src/net/safety/chatFeed.js`, `src/net/safety/conduct.js` - the law, stamps, the feed, the code
- `src/net/roomLease.js` - the hub's lease carried to every room
- `src/scenes/chatSafetyHost.js`, `src/ui/conductCard.js`, `src/ui/chatPanel.js` - the client
- `server/src/index.js` - stamps, the feed, the pace, ban frames, the law door
- `server-account/src/safety.js`, `server-account/src/sanctions.js`, `server-account/src/modAi.js`, `server-account/src/safetyClock.js`, `server-account/src/discord.js`, `server-account/src/discordCommands.js` - the service
- `tools/discordModCommands.mjs` - the deploy's Discord setup
- `test/net/safety/safe_law.test.js`, `test/net/safety/safe_relay.test.js`, `test/net/safety/safe_client.test.js` - law, relay, client
- `test/server/safe_service.test.js`, `test/server/safe_review.test.js`, `test/server/discord_setup.test.js` - service, reviewer, Discord setup

Claude as staff, which reads the stored feeds and suggests cases to staff, is in `Claude-Staff.md`.

## Open

- Ban evasion: a banned player can make a new guest; guests' reports never count and new voices are slowed.
- A socket stays open past an order until its token is re-checked.
- TEXT-F1 stars `dyke`, which queer players use of themselves; unstarring a slur is Mac's call.
- Guild invites from a blocked account still arrive: the guild book names the inviter by name, not account.
- The relay's 30-second feed timer may hold a quiet channel's object awake, and a batch is lost if the object is evicted.
