// DISCORD-SETUP (2026-10-17, Mac: "Can you set the discord end up for me"; bible/11-Multiplayer/Chat-Safety-Arc.md
// section 9): THE DISCORD END FROM THE TOKEN ALONE - tools/discordModCommands.mjs --setup reads the application's id and
// public key from Discord, the server from the moderators' channel, points the Interactions Endpoint URL at the service
// only when it differs (offered again while an old instance answers the PING), writes the commands, and says which step
// Discord refused - never the token.
// DISCORD-CODE (2026-10-17, Mac: "Do it"): Discord is code - the commands declared once beside the service that answers
// them (server-account/src/discordCommands.js), the WHOLE list written, every declared command and subcommand held to a
// handler, the bot's permissions in the moderators' channel computed as Discord computes them, and the deploy's path
// filter holding the tool's own import graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discordSetup, channelPermissions, setupReport, DISCORD_COMMANDS, MOD_COMMAND, SETUP_TRIES } from '../../tools/discordModCommands.mjs';
import { usageOf, subcommandsOf } from '../../server-account/src/discordCommands.js';
import { discordInteraction, MOD_CHANNEL_NEEDS } from '../../server-account/src/discord.js';
import { standService } from '../accountDb.mjs';
import { graph } from '../importGraph.mjs';

const TOKEN = 'bot-token-never-said';
const KEY = 'ab'.repeat(32);
const DOOR = 'https://accounts.example.workers.dev/v1/discord/interactions';
const APP = '111111111111111111', GUILD = '222222222222222222', CHANNEL = '333333333333333333', BOT = '444444444444444444', BOT_ROLE = '555555555555555555';
const VIEW = 1n << 10n, SEND = 1n << 11n, EMBED = 1n << 14n, ADMIN = 1n << 3n;
const CARDS = String(VIEW | SEND | EMBED);

/** A Discord that answers each path as told, and keeps every call. */
const fakeDiscord = ({ app = { id: APP, bot: { id: BOT }, verify_key: KEY, interactions_endpoint_url: null }, channel = { id: CHANNEL, guild_id: GUILD, permission_overwrites: [] }, roles = [{ id: GUILD, permissions: '0' }, { id: BOT_ROLE, permissions: CARDS }], member = { roles: [BOT_ROLE] }, patch = [200], put = 200, chanStatus = 200 } = {}) => {
  const calls = [];
  const patches = [...patch];
  const answer = (status, json) => ({ ok: status >= 200 && status < 300, status, text: async () => (json === undefined ? '' : JSON.stringify(json)) });
  const fetchFn = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const path = url.replace('https://discord.com/api/v10', '');
    if (path === '/applications/@me' && init.method === 'GET') return answer(200, app);
    if (path === `/channels/${CHANNEL}`) return chanStatus === 200 ? answer(200, channel) : answer(chanStatus, { message: 'Missing Access', code: 50001 });
    if (path === '/applications/@me' && init.method === 'PATCH') {
      const s = patches.length > 1 ? patches.shift() : patches[0];
      return s === 200 ? answer(200, { ...app, interactions_endpoint_url: JSON.parse(init.body).interactions_endpoint_url }) : answer(s, { message: 'interactions_endpoint_url: The specified interactions endpoint url could not be verified.' });
    }
    if (path === `/applications/${APP}/guilds/${GUILD}/commands` && init.method === 'PUT') return answer(put, put === 200 ? JSON.parse(init.body) : { message: 'Missing Access' });
    if (path === `/guilds/${GUILD}/roles`) return answer(200, roles);
    if (path === `/guilds/${GUILD}/members/${BOT}`) return answer(200, { user: { id: BOT }, ...member });
    return answer(404, { message: 'Unknown' });
  };
  return { fetchFn, calls };
};
const args = (d, over = {}) => ({ token: TOKEN, channel: CHANNEL, publicKey: KEY, url: DOOR, fetchFn: d.fetchFn, wait: async () => {}, ...over });
const route = (c) => `${c.method} ${c.url.replace('https://discord.com/api/v10', '')}`;

test('DISCORD-SETUP: from the token alone - the application read, the server read off the moderators\' channel, the URL set, the WHOLE command list written over (PUT) in that server, the bot\'s roles read; every call the bot\'s', async () => {
  const d = fakeDiscord();
  const two = [MOD_COMMAND, { name: 'probe', description: 'A second command', type: 1 }];
  const done = await discordSetup(args(d, { commands: two }));
  assert.deepEqual(done, { app: APP, guild: GUILD, pointed: true, commands: ['mod', 'probe'], missing: [] });
  assert.deepEqual(d.calls.map(route),
    ['GET /applications/@me', `GET /channels/${CHANNEL}`, 'PATCH /applications/@me', `PUT /applications/${APP}/guilds/${GUILD}/commands`, `GET /guilds/${GUILD}/roles`, `GET /guilds/${GUILD}/members/${BOT}`]);
  assert.deepEqual(JSON.parse(d.calls[2].body), { interactions_endpoint_url: DOOR }, 'the PATCH carries the URL and nothing else');
  assert.deepEqual(JSON.parse(d.calls[3].body), two, 'every command in the list, so the server holds exactly the list');
  for (const c of d.calls) {
    assert.equal(c.headers.authorization, `Bot ${TOKEN}`);
    assert.match(c.headers['user-agent'], /^DiscordBot \(/, 'Discord\'s required User-Agent');
  }
  // by default, the declared list
  const plain = fakeDiscord();
  await discordSetup(args(plain));
  assert.deepEqual(JSON.parse(plain.calls.find((c) => c.method === 'PUT').body), JSON.parse(JSON.stringify(DISCORD_COMMANDS)));
});

test('DISCORD-SETUP: a URL already right is left alone - no PATCH, so no PING a deploy did not need; the commands are still written', async () => {
  const d = fakeDiscord({ app: { id: APP, bot: { id: BOT }, verify_key: KEY, interactions_endpoint_url: DOOR } });
  const done = await discordSetup(args(d));
  assert.equal(done.pointed, false);
  assert.equal(d.calls.some((c) => c.method === 'PATCH'), false);
  assert.equal(d.calls.filter((c) => c.method === 'PUT').length, 1);
});

test('DISCORD-SETUP: a public key that is not the application\'s is said, with the right one, before Discord is asked to change anything; an application with no bot user is said too', async () => {
  const d = fakeDiscord({ app: { id: APP, bot: { id: BOT }, verify_key: 'cd'.repeat(32), interactions_endpoint_url: null } });
  await assert.rejects(discordSetup(args(d)), (e) => /DISCORD_PUBLIC_KEY is not this application's public key/.test(e.message) && e.message.includes('cd'.repeat(32)));
  assert.deepEqual(d.calls.map((c) => c.method), ['GET'], 'nothing changed, nothing registered');
  const botless = fakeDiscord({ app: { id: APP, verify_key: KEY, interactions_endpoint_url: null } });
  await assert.rejects(discordSetup(args(botless)), /no bot user/);
  assert.deepEqual(botless.calls.map((c) => c.method), ['GET']);
});

test('DISCORD-SETUP: the PING meeting an old instance is offered again - a refusal believed only after SETUP_TRIES, with Discord\'s words and never the token', async () => {
  const late = fakeDiscord({ patch: [400, 400, 200] });
  const waits = [];
  const done = await discordSetup(args(late, { wait: async (ms) => { waits.push(ms); } }));
  assert.equal(done.pointed, true);
  assert.equal(late.calls.filter((c) => c.method === 'PATCH').length, 3);
  assert.equal(waits.length, 2, 'a wait between offers, none after the one that took');

  const never = fakeDiscord({ patch: [400] });
  await assert.rejects(discordSetup(args(never)), (e) => /setting the Interactions Endpoint URL: Discord said 400: .*could not be verified/.test(e.message) && !e.message.includes(TOKEN));
  assert.equal(never.calls.filter((c) => c.method === 'PATCH').length, SETUP_TRIES);
  assert.equal(never.calls.some((c) => c.method === 'PUT'), false, 'no command is registered against an application Discord will not reach');
});

test('DISCORD-SETUP: a channel the bot cannot see names the likely cause; a refused command list is said; bad inputs are refused before any call', async () => {
  const blind = fakeDiscord({ chanStatus: 403 });
  await assert.rejects(discordSetup(args(blind)), /reading the moderators' channel \(is the bot in the server, with View Channel there\?\): Discord said 403/);
  assert.equal(blind.calls.some((c) => c.method !== 'GET'), false);
  // the first live run's refusal: a 404 is no channel at all - the id copied was another thing's
  const elsewhere = fakeDiscord({ chanStatus: 404 });
  await assert.rejects(discordSetup(args(elsewhere)), (e) => /Discord knows no channel 333333333333333333 \(404\) - DISCORD_MOD_CHANNEL is likely a server's, a user's or the application's id; .*Copy Channel ID/.test(e.message) && !e.message.includes(TOKEN));
  assert.equal(elsewhere.calls.some((c) => c.method !== 'GET'), false, 'nothing changed');

  const dm = fakeDiscord({ channel: { id: CHANNEL } });
  await assert.rejects(discordSetup(args(dm)), /in no server/);

  const refused = fakeDiscord({ put: 403 });
  await assert.rejects(discordSetup(args(refused)), /registering the commands: Discord said 403/);

  for (const [over, why] of [[{ token: '' }, /no bot token/], [{ channel: 'general' }, /not a channel id/], [{ publicKey: 'xyz' }, /64-character hex/], [{ url: 'http://x.dev/v1/discord/interactions' }, /interactions door/], [{ url: 'https://x.dev/v1/health' }, /interactions door/]]) {
    const d = fakeDiscord();
    await assert.rejects(discordSetup(args(d, over)), why);
    assert.equal(d.calls.length, 0, 'nothing sent');
  }
});

test('DISCORD-CODE: the bot\'s permissions in a channel as Discord computes them - @everyone and its roles, Administrator for all, then the channel\'s overwrites (@everyone\'s, its roles\' together, its own), each denying before it allows', () => {
  const at = (over) => channelPermissions({ guildId: GUILD, roles: [{ id: GUILD, permissions: String(VIEW) }, { id: BOT_ROLE, permissions: String(SEND) }, { id: '666666666666666666', permissions: String(ADMIN) }], memberRoles: [BOT_ROLE], userId: BOT, overwrites: [], ...over });
  assert.equal(at({}), VIEW | SEND, '@everyone\'s and the bot role\'s, together');
  assert.equal(at({ memberRoles: [BOT_ROLE, '666666666666666666'], overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(VIEW | SEND) }] }) & (VIEW | SEND | EMBED), VIEW | SEND | EMBED, 'Administrator: everything, whatever the channel denies');
  assert.equal(at({ overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(VIEW) }] }), SEND, 'the channel denies @everyone the view');
  assert.equal(at({ overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(VIEW) }, { id: BOT_ROLE, type: 0, allow: String(VIEW | EMBED), deny: '0' }] }), VIEW | SEND | EMBED, 'its role\'s overwrite gives it back, and more');
  assert.equal(at({ overwrites: [{ id: BOT_ROLE, type: 0, allow: String(EMBED), deny: String(SEND) }, { id: '777777777777777777', type: 0, allow: String(SEND), deny: '0' }] }), VIEW | EMBED, 'a role the bot does not hold changes nothing; its own role\'s deny holds');
  assert.equal(at({ memberRoles: [BOT_ROLE, '888888888888888888'], roles: [{ id: GUILD, permissions: String(VIEW) }, { id: BOT_ROLE, permissions: String(SEND) }, { id: '888888888888888888', permissions: '0' }], overwrites: [{ id: BOT_ROLE, type: 0, allow: '0', deny: String(SEND) }, { id: '888888888888888888', type: 0, allow: String(SEND), deny: '0' }] }), VIEW | SEND, 'its roles\' overwrites together: one\'s allow outlasts another\'s deny');
  assert.equal(at({ overwrites: [{ id: BOT_ROLE, type: 0, allow: String(EMBED), deny: '0' }, { id: BOT, type: 1, allow: '0', deny: String(EMBED | VIEW) }] }), SEND, 'its own overwrite last');
  assert.equal(at({ overwrites: [{ id: BOT, type: 0, allow: String(EMBED), deny: '0' }] }), VIEW | SEND, 'a ROLE overwrite with the bot\'s id is no member overwrite');
});

test('DISCORD-CODE: what the cards need and the bot lacks in the moderators\' channel is named, and turns the deploy red - after the URL and the commands are done', async () => {
  assert.deepEqual(MOD_CHANNEL_NEEDS.map(([n]) => n), ['View Channel', 'Send Messages', 'Embed Links']);
  const mute = fakeDiscord({ channel: { id: CHANNEL, guild_id: GUILD, permission_overwrites: [{ id: BOT_ROLE, type: 0, allow: '0', deny: String(SEND | EMBED) }] } });
  const done = await discordSetup(args(mute));
  assert.deepEqual(done.missing, ['Send Messages', 'Embed Links']);
  assert.ok(mute.calls.some((c) => c.method === 'PATCH') && mute.calls.some((c) => c.method === 'PUT'), 'the URL and the commands were still done');
  const red = setupReport(done, DOOR);
  assert.match(red.error, /^the bot lacks Send Messages, Embed Links in the moderators' channel - give its role those permissions there/);
  assert.equal(red.lines.length, 2);
  assert.match(red.lines[0], /set now/);
  assert.match(red.lines[1], /\/mod, written in server 222222222222222222/);
  const green = setupReport({ ...done, missing: [], pointed: false }, DOOR);
  assert.equal(green.error, null);
  assert.match(green.lines[0], /already set/);
  assert.match(green.lines.at(-1), /everything the cards need/);
  assert.match(setupReport({ ...done, missing: ['Embed Links'] }, DOOR).error, /give its role that permission there/);
});

test('DISCORD-CODE: every declared command and subcommand reaches a handler in the service - none answers with the router\'s "nothing to do" or its command\'s usage, which is built from the declaration', async () => {
  const s = await standService({ MODERATOR_HANDLES: 'Asynian', DISCORD_MODERATORS: '111111111111111111:Asynian', DISCORD_MOD_CHANNEL: CHANNEL, DISCORD_BOT_TOKEN: 'bot', DISCORD_PUBLIC_KEY: '' });
  await s.registered('Asynian');
  const troll = await s.registered('Troll');
  const ctx = { db: s.env.DB, nowS: Math.floor(Date.now() / 1000), rand: (b) => { globalThis.crypto.getRandomValues(b); }, subtle: globalThis.crypto.subtle };
  const io = { fetchFn: async () => Response.json({ ok: true }), later: (p) => { p.catch(() => {}); } };
  const ask = async (data) => (await discordInteraction(ctx, s.env, { type: 2, member: { user: { id: '111111111111111111' } }, data }, io))?.data?.content;
  const valueOf = (o) => (o.type === 3 ? (o.name === 'player' ? troll.id : 'a reason') : o.type === 4 ? (o.min_value ?? 1) : o.type === 5 ? true : 'x');
  const optionsOf = (opts = []) => opts.filter((o) => o.type !== 1 && o.type !== 2).map((o) => ({ name: o.name, type: o.type, value: valueOf(o) }));
  const nothing = await ask({ name: 'no-such-command' });
  assert.ok(nothing, 'the router answers a command it does not know');
  for (const c of DISCORD_COMMANDS) {
    const subs = (c.options ?? []).filter((o) => o.type === 1);
    // an unknown subcommand carrying what a real one does (onCommand finds its player first)
    const usage = await ask({ name: c.name, options: [{ name: 'no-such-sub', type: 1, options: optionsOf(subs[0]?.options) }] });
    if (subs.length) assert.equal(usage, usageOf(c.name), `/${c.name}: an unknown subcommand is answered with the declared ones`);
    for (const sub of subs.length ? subs : [null]) {
      const said = await ask({ name: c.name, options: sub ? [{ name: sub.name, type: 1, options: optionsOf(sub.options) }] : optionsOf(c.options) });
      const label = `/${c.name}${sub ? ` ${sub.name}` : ''}`;
      assert.ok(said, `${label} answers`);
      assert.notEqual(said, nothing, `${label} reaches a handler`);
      if (subs.length) assert.notEqual(said, usage, `${label} is handled, not answered with the usage`);
    }
  }
  assert.equal(usageOf('mod'), 'Use /mod lookup, mute, unmute, ban or unban.');
  assert.deepEqual(subcommandsOf('mod'), ['lookup', 'mute', 'unmute', 'ban', 'unban']);
});

test('DISCORD-CODE: the commands live under server-account/, and the deploy\'s path filter holds the setup tool\'s whole import graph - a change to either deploys, and so reaches Discord', () => {
  const wf = readFileSync(new URL('../../.github/workflows/account-deploy.yml', import.meta.url), 'utf8');
  const listed = [...(/paths:\s*\n((?:\s*(?:#[^\n]*|-\s*"[^"]+")\n)+)/.exec(wf)?.[1] ?? '').matchAll(/-\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(listed.includes('server-account/**'), 'the service itself');
  const outside = graph('tools/discordModCommands.mjs').filter((f) => !f.startsWith('server-account/'));
  assert.ok(outside.includes('tools/discordModCommands.mjs') && outside.includes('tools/lib/isMain.mjs'), `the walk sees the tool: ${outside.slice(0, 4).join(', ')}`);
  for (const f of outside) assert.ok(listed.includes(f), `${f} is read by the deploy's Discord step and a change to it would not deploy`);
  assert.ok(graph('server-account/src/index.js').includes('server-account/src/discordCommands.js'), 'the Worker reads the declaration (its usage), so the two ship together');
  assert.doesNotMatch(readFileSync(new URL('../../tools/discordModCommands.mjs', import.meta.url), 'utf8'), /name: 'mod'/, 'no command is declared in the tool');
});

test('DISCORD-SETUP: the deploy runs it LAST, the token an env var from the repository\'s secrets and never a word of the command, the door read off the deploy, and nothing asked of Discord when the token, channel or key is not set', () => {
  const wf = readFileSync(new URL('../../.github/workflows/account-deploy.yml', import.meta.url), 'utf8');
  const steps = wf.split(/\n      - name: /).slice(1);
  const step = steps.at(-1);
  assert.match(step, /^Point Discord at the service, where the repository has the bot's token\n/, 'the last step - a refusal hides no check above it');
  const run = step.slice(step.indexOf('run: |'));
  assert.match(step, /env:\n\s+DISCORD_BOT_TOKEN: \$\{\{ secrets\.DISCORD_BOT_TOKEN \}\}\n/);
  assert.doesNotMatch(run, /secrets\.|DISCORD_BOT_TOKEN="|echo[^\n]*\$\{?DISCORD_BOT_TOKEN/, 'the token is never in the command line, never echoed');
  assert.match(run, /DISCORD_INTERACTIONS_URL="\$\{\{ steps\.deploy\.outputs\.base \}\}\/v1\/discord\/interactions" node tools\/discordModCommands\.mjs --setup 2> "\$err"/);
  assert.match(run, /grep -oP '\^DISCORD_MOD_CHANNEL[^']*' "\$toml"/, 'the channel read from the config that ships it');
  assert.match(run, /grep -oP '\^DISCORD_PUBLIC_KEY[^']*' "\$toml"/, 'and the key');
  assert.match(run, /if \[ -z "\$\{DISCORD_BOT_TOKEN\}" \] \|\| \[ -z "\$channel" \] \|\| \[ -z "\$key" \]; then[\s\S]*?exit 0\n\s+fi/, 'unset is said and skipped');
  assert.match(run, /else\n\s+echo "\$out"\n[\s\S]*?Not finished:[\s\S]*?::error::Discord's setup did not finish[^\n]*\n\s+exit 1/, 'what was done is said, what stopped it goes to the summary, and the deploy turns red');
});
