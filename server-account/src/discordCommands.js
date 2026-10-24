// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DISCORD-CODE (2026-10-17, Mac: "Is there a way we can set up something where you can handle all future discord
// integrations and changes yourself?", then "Do it"; bible/11-Multiplayer/Chat-Safety-Arc.md section 9): THE BOT'S
// COMMANDS, DECLARED ONCE, BESIDE THE SERVICE THAT ANSWERS THEM.
//
// Discord is code here. Every command the bot has is in DISCORD_COMMANDS, and the account deploy writes the WHOLE list
// to the moderators' server on every deploy (tools/discordModCommands.mjs --setup, Discord's bulk overwrite): a command
// added here appears there, one taken out is gone there, and one made by hand in the Developer Portal is written over.
// It lives under server-account/ so a change to it deploys the service (account-deploy.yml's path filter), and
// discord.js reads it (its usage text is built from the declared subcommands), so the declaration and its handler ship
// together; test/server/discord_setup.test.js drives every declared command and subcommand through the service and
// holds each to a handler.
//
// A GUILD COMMAND, not a global one: it appears in the project's own Discord server at once and nowhere else, and it is
// hidden from everyone but those holding Manage Messages (`default_member_permissions`) - a door's look, never its lock:
// whether a press does anything is the game's question (DISCORD_MODERATORS, MODERATOR_HANDLES).
// ═══════════════════════════════════════════════════════════════════

/** The command, as Discord's API takes it: /mod lookup|mute|unmute|ban|unban, each naming a player by name or account id. */
export const MOD_COMMAND = Object.freeze({
  name: 'mod',
  description: 'DFO Online moderation',
  type: 1,
  default_member_permissions: String(1 << 13),   // Manage Messages
  contexts: [0],   // AUDIT SAFE DISCORD-13: the server alone (GUILD) - `dm_permission` is deprecated for `contexts`
  options: [
    { type: 1, name: 'lookup', description: 'An account\'s standing: mutes, bans, strikes and the next step', options: [{ type: 3, name: 'player', description: 'Name or account id', required: true }] },
    { type: 1, name: 'mute', description: 'Mute a player (the next step on the ladder unless minutes are given)', options: [
      { type: 3, name: 'player', description: 'Name or account id', required: true },
      { type: 4, name: 'minutes', description: 'Minutes, 1 to 10080', required: false, min_value: 1, max_value: 10080 },
      { type: 3, name: 'reason', description: 'Why - kept in the record', required: false, max_length: 200 },
    ] },
    { type: 1, name: 'unmute', description: 'Lift a mute', options: [{ type: 3, name: 'player', description: 'Name or account id', required: true }] },
    { type: 1, name: 'ban', description: 'Ban a player (30 days unless days are given; 0 for good)', options: [
      { type: 3, name: 'player', description: 'Name or account id', required: true },
      { type: 4, name: 'days', description: 'Days, 1 to 365, or 0 for good', required: false, min_value: 0, max_value: 365 },
      { type: 3, name: 'reason', description: 'Why - the banned player is shown it', required: false, max_length: 200 },
    ] },
    { type: 1, name: 'unban', description: 'Lift a ban', options: [{ type: 3, name: 'player', description: 'Name or account id', required: true }] },
  ],
});

/** Every command the bot has - the list the deploy writes over the server's. */
export const DISCORD_COMMANDS = Object.freeze([MOD_COMMAND]);

/** A command's subcommands, as declared. @param {string} name @returns {string[]} */
export const subcommandsOf = (name) => (DISCORD_COMMANDS.find((c) => c.name === name)?.options ?? []).filter((o) => o.type === 1).map((o) => o.name);

/** What a command answers a subcommand it does not know: its declared ones, named. @param {string} name */
export const usageOf = (name) => {
  const subs = subcommandsOf(name);
  return subs.length > 1 ? `Use /${name} ${subs.slice(0, -1).join(', ')} or ${subs.at(-1)}.` : `Use /${name}${subs.length ? ` ${subs[0]}` : ''}.`;
};
