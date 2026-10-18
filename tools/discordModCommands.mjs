// SAFE8 (2026-10-17, the chat safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md section 9): THE BOT'S COMMANDS,
// REGISTERED WITH DISCORD. The account service answers them (server-account/src/discord.js onCommand); Discord has to be
// told they exist. DISCORD-CODE moved their declaration to server-account/src/discordCommands.js, beside the service that
// answers them; this tool writes that list to Discord, and nothing here declares a command.
//
//   DISCORD_APP_ID=<application id> DISCORD_BOT_TOKEN=<bot token> DISCORD_GUILD_ID=<server id> node tools/discordModCommands.mjs
//   ... --print   the commands' JSON alone, nothing sent
//
// The token is read from the environment and never printed.
//
// DISCORD-SETUP (2026-10-17, Mac: "Can you set the discord end up for me"): THE WHOLE DISCORD END, FROM THE TOKEN ALONE -
// what the deploy runs (account-deploy.yml, "Point Discord at the service"), so the bot's token never leaves the
// repository's secrets and no id is typed twice:
//
//   DISCORD_BOT_TOKEN=... DISCORD_MOD_CHANNEL=<channel id> DISCORD_PUBLIC_KEY=<hex> DISCORD_INTERACTIONS_URL=<url> \
//     node tools/discordModCommands.mjs --setup
//
// The application's id and public key are Discord's answer to its own bot (GET /applications/@me), the server is the
// moderators' channel's (GET /channels/<id>), the Interactions Endpoint URL is set only when it differs (PATCH
// /applications/@me - Discord signs a PING to it and keeps the URL only if the service answers), and the commands are
// written over whatever was registered (PUT, Discord's bulk overwrite). A public key in wrangler.toml that is not the
// application's is said before Discord is asked anything of it: every press would be refused as a bad signature, and
// Discord's own refusal of the URL would not say why.
//
// DISCORD-CODE (2026-10-17, Mac: "Do it"): THE WHOLE LIST, AND THE BOT'S HANDS CHECKED. Every command in
// DISCORD_COMMANDS is written, so the server holds exactly the declared list. Then the bot's permissions in the
// moderators' channel are computed the way Discord computes them (channelPermissions: @everyone and the bot's roles,
// Administrator, then the channel's overwrites - @everyone's, its roles', its own) against what the cards need
// (discord.js MOD_CHANNEL_NEEDS); one missing turns the deploy red and is named, where before a card simply never came.
import { isMain } from './lib/isMain.mjs';
import { DISCORD_USER_AGENT, MOD_CHANNEL_NEEDS } from '../server-account/src/discord.js';
import { DISCORD_COMMANDS, MOD_COMMAND } from '../server-account/src/discordCommands.js';

export { DISCORD_COMMANDS, MOD_COMMAND };

const DISCORD_API = 'https://discord.com/api/v10';
/** Discord's PING can reach an instance of the Worker the deploy has not yet replaced (the password-route check's lesson,
 *  account-deploy.yml): the URL is offered this many times, SETUP_RETRY_MS apart, before its refusal is believed. */
export const SETUP_TRIES = 4;
export const SETUP_RETRY_MS = 10_000;
const SNOWFLAKE_RE = /^\d{5,25}$/;
const ADMINISTRATOR = 1n << 3n;
const ALL = (1n << 64n) - 1n;

/** A member's permissions in a channel, as Discord computes them (its Permissions page, compute_base_permissions then
 *  compute_overwrites): @everyone's and the member's roles, Administrator for everything, then the channel's overwrites -
 *  @everyone's, the member's roles' together, the member's own - each denying before it allows. Permissions are strings
 *  on the wire.
 *  @param {{ guildId: string, roles: { id: string, permissions: string }[], memberRoles: string[], userId: string, overwrites: { id: string, type: number, allow: string, deny: string }[] }} a
 *  @returns {bigint} */
export function channelPermissions({ guildId, roles, memberRoles, userId, overwrites }) {
  const of = new Map(roles.map((r) => [r.id, BigInt(r.permissions ?? 0)]));
  let p = of.get(guildId) ?? 0n;
  for (const id of memberRoles) p |= of.get(id) ?? 0n;
  if ((p & ADMINISTRATOR) === ADMINISTRATOR) return ALL;
  const apply = (allow, deny) => { p &= ~deny; p |= allow; };
  const everyone = overwrites.find((o) => o.id === guildId);
  if (everyone) apply(BigInt(everyone.allow), BigInt(everyone.deny));
  let allow = 0n, deny = 0n;
  for (const o of overwrites) if (o.type === 0 && o.id !== guildId && memberRoles.includes(o.id)) { allow |= BigInt(o.allow); deny |= BigInt(o.deny); }
  apply(allow, deny);
  const own = overwrites.find((o) => o.type === 1 && o.id === userId);
  if (own) apply(BigInt(own.allow), BigInt(own.deny));
  return p;
}

/** DISCORD-SETUP: the application pointed at `url`, every command written in the server `channel` is in, and the bot's
 *  permissions there read. Answers `{ app, guild, pointed, commands, missing }` (`pointed`: the URL was changed, not
 *  already right; `missing`: what the cards need that the bot lacks there), or throws an Error saying which step Discord
 *  refused and its words - never the token. */
export async function discordSetup({ token, channel, publicKey, url, commands = DISCORD_COMMANDS, fetchFn = (u, i) => globalThis.fetch(u, i), wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!token) throw new Error('no bot token');
  if (!SNOWFLAKE_RE.test(channel ?? '')) throw new Error(`DISCORD_MOD_CHANNEL is not a channel id: "${channel ?? ''}"`);
  if (!/^[0-9a-f]{64}$/i.test(publicKey ?? '')) throw new Error('DISCORD_PUBLIC_KEY is not a 64-character hex key');
  if (!/^https:\/\/[^\s/]+\/v1\/discord\/interactions$/.test(url ?? '')) throw new Error(`not the service's interactions door: "${url ?? ''}"`);
  const call = async (what, path, method = 'GET', body) => {
    const res = await fetchFn(`${DISCORD_API}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bot ${token}`, 'user-agent': DISCORD_USER_AGENT },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) return { error: `${what}: Discord said ${res.status}: ${text.slice(0, 300)}`, status: res.status };
    return { json: text ? JSON.parse(text) : null };
  };
  const got = (r) => { if (r.error) throw new Error(r.error); return r.json; };
  const app = got(await call('reading the application', '/applications/@me'));
  if (!SNOWFLAKE_RE.test(app?.id ?? '')) throw new Error('reading the application: Discord named no application id');
  if (!SNOWFLAKE_RE.test(app?.bot?.id ?? '')) throw new Error('reading the application: it has no bot user - add one in the Developer Portal');
  if (String(app.verify_key ?? '').toLowerCase() !== publicKey.toLowerCase()) {
    throw new Error(`DISCORD_PUBLIC_KEY is not this application's public key - set it to ${app.verify_key} in server-account/wrangler.toml`);
  }
  // DISCORD-CODE: the first live run's refusal (2026-10-17) - a 404 is no channel at all, where a channel the bot cannot
  // see is a 403: the id copied was another thing's (a server's, a user's, the application's look the same)
  const read = await call('reading the moderators\' channel (is the bot in the server, with View Channel there?)', `/channels/${channel}`);
  if (read.status === 404) throw new Error(`reading the moderators' channel: Discord knows no channel ${channel} (404) - DISCORD_MOD_CHANNEL is likely a server's, a user's or the application's id; with Developer Mode on (User Settings, Advanced), right-click the channel itself and Copy Channel ID`);
  const chan = got(read);
  if (!SNOWFLAKE_RE.test(chan?.guild_id ?? '')) throw new Error('the moderators\' channel is in no server - DISCORD_MOD_CHANNEL must name a server\'s channel');
  let pointed = false;
  if (app.interactions_endpoint_url !== url) {
    for (let n = 1; ; n++) {
      const r = await call('setting the Interactions Endpoint URL', '/applications/@me', 'PATCH', { interactions_endpoint_url: url });
      if (!r.error) break;
      if (n >= SETUP_TRIES) throw new Error(r.error);
      await wait(SETUP_RETRY_MS);
    }
    pointed = true;
  }
  got(await call('registering the commands', `/applications/${app.id}/guilds/${chan.guild_id}/commands`, 'PUT', commands));
  const roles = got(await call('reading the server\'s roles', `/guilds/${chan.guild_id}/roles`));
  const member = got(await call('reading the bot\'s roles in the server', `/guilds/${chan.guild_id}/members/${app.bot.id}`));
  const have = channelPermissions({ guildId: chan.guild_id, roles: roles ?? [], memberRoles: member?.roles ?? [], userId: app.bot.id, overwrites: chan.permission_overwrites ?? [] });
  const missing = MOD_CHANNEL_NEEDS.filter(([, bit]) => (have & bit) !== bit).map(([name]) => name);
  return { app: app.id, guild: chan.guild_id, pointed, commands: commands.map((c) => c.name), missing };
}

/** What the deploy says of a setup: its lines, and what stops it (`error` - the deploy goes red on it): the cards'
 *  permissions the bot lacks in the moderators' channel. @param {{ app: string, guild: string, pointed: boolean, commands: string[], missing: string[] }} done @param {string} url */
export function setupReport(done, url) {
  const lines = [
    `- the Interactions Endpoint URL: \`${url}\` (${done.pointed ? 'set now' : 'already set'})`,
    `- the commands: ${done.commands.map((n) => `/${n}`).join(', ')}, written in server ${done.guild} for application ${done.app}`,
  ];
  if (!done.missing.length) return { lines: [...lines, '- the bot\'s permissions in the moderators\' channel: everything the cards need'], error: null };
  return { lines, error: `the bot lacks ${done.missing.join(', ')} in the moderators' channel - give its role ${done.missing.length === 1 ? 'that permission' : 'those permissions'} there (the channel's settings, Permissions), or no case card can be posted` };
}

async function main() {
  if (process.argv.includes('--print')) { console.log(JSON.stringify(DISCORD_COMMANDS, null, 2)); return; }
  if (process.argv.includes('--setup')) {
    const { DISCORD_BOT_TOKEN: token, DISCORD_MOD_CHANNEL: channel, DISCORD_PUBLIC_KEY: publicKey, DISCORD_INTERACTIONS_URL: url } = process.env;
    try {
      const report = setupReport(await discordSetup({ token, channel, publicKey, url }), url);
      console.log(report.lines.join('\n'));
      if (report.error) { console.error(report.error); process.exit(1); }
    } catch (e) {
      console.error(String(e?.message ?? e));
      process.exit(1);
    }
    return;
  }
  const { DISCORD_APP_ID: app, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guild } = process.env;
  if (!/^\d{5,25}$/.test(app ?? '') || !/^\d{5,25}$/.test(guild ?? '') || !token) {
    console.error('Set DISCORD_APP_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN (see the header).');
    process.exit(2);
  }
  const res = await fetch(`https://discord.com/api/v10/applications/${app}/guilds/${guild}/commands`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bot ${token}`, 'user-agent': DISCORD_USER_AGENT },   // AUDIT SAFE DISCORD-10
    body: JSON.stringify(DISCORD_COMMANDS),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`Discord said ${res.status}: ${text}`); process.exit(1); }
  console.log(`${DISCORD_COMMANDS.map((c) => `/${c.name}`).join(', ')} registered in guild ${guild}.`);
}

if (isMain(import.meta.url)) await main();
