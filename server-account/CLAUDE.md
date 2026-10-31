# server-account

The account service (Cloudflare Worker) and the Discord bot.

**Discord is code.** The bot's commands are declared in `src/discordCommands.js`. Its cards and answers are in
`src/discord.js`. Its channel and moderators are in `wrangler.toml`. The account deploy (`account-deploy.yml`, "Point
Discord at the service") writes the Interactions Endpoint URL, the whole command list, and checks the bot's
permissions in the channel. Change Discord by changing these files and merging.

Never ask for the bot's token or for Developer Portal clicks the deploy can do. A person still invites the bot, grants
its roles, and rotates its token (the `DISCORD_BOT_TOKEN` secret).

LOOT-GATE applies to every Discord post: no levels, factors or chances from `src/systems/loot/lootLevelGate.js`.
Design notes: `bible/11-Multiplayer/Chat-Safety-Arc.md`.
