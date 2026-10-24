// SAFE5 + SAFE8 (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md sections 6 and 9): THE REVIEWER AND THE
// MODERATORS' QUEUE - the Messages API request the reviewer makes (its brief, its schema, its cached system prompt, the
// speakers it never names), what it does with a verdict in each mode, the relay's signed feed in, the minute's clock that
// reads the feed and the cases and posts their cards, Discord's signed interactions - a press that mutes and redraws the
// card, a /mod look, a stranger refused - and the hour's sweep. Every outside service is a stub that records what it was
// asked; every signature is a real Ed25519 one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { mintStamp } from '../../src/net/safety/chatStamp.js';
import { sealFeed, FEED_SIG_HEADER } from '../../src/net/safety/chatFeed.js';
import { conductRules } from '../../src/net/safety/conduct.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { reviewLines, reviewPayload, flagsOf, reviewerPrompt, modAiOn, modAiModeOf, flagActs, VERDICT_SCHEMA, MESSAGES_URL, MOD_AI_MODEL_DEFAULT } from '../../server-account/src/modAi.js';
import { safetyMinute, safetySweep, FEED_KEEP_S, CASE_OPEN_MAX_S } from '../../server-account/src/safetyClock.js';
import { caseCard, discordModerators, discordOn, interactionsOn, CARD_ACTS, DISCORD_API } from '../../server-account/src/discord.js';
import { SPROUT_S } from '../../server-account/src/titles.js';

const subtle = globalThis.crypto.subtle;
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
const nowS = () => Math.floor(Date.now() / 1000);

/** A stub of the outside world: the Messages API answers `verdicts` in turn, Discord answers a message id, the relay's
 *  door ok - each request recorded. */
function outside(verdicts = []) {
  const asked = { ai: [], discord: [], relay: [] };
  const queue = [...verdicts];
  const fetchFn = async (url, init) => {
    const u = String(url);
    if (u === MESSAGES_URL) {
      asked.ai.push({ headers: init.headers, body: JSON.parse(init.body) });
      const v = queue.shift() ?? { flags: [] };
      if (v === 'down') return new Response('{}', { status: 529 });
      if (v === 'refused') return Response.json({ stop_reason: 'refusal', content: [] });
      return Response.json({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(v) }] });
    }
    if (u.startsWith(DISCORD_API)) { asked.discord.push({ url: u, method: init.method, body: JSON.parse(init.body), auth: init.headers.authorization }); return Response.json({ id: '900000000000000001' }); }
    if (u === RELAY) { asked.relay.push(JSON.parse(init.body).order); return Response.json({ ok: true }); }
    throw new Error(`unexpected fetch ${u}`);
  };
  return { asked, fetchFn };
}
const ON = Object.freeze({ MOD_AI: 'on', ANTHROPIC_API_KEY: 'sk-test', MODERATOR_HANDLES: 'Asynian', RELAY_LAW_URL: RELAY, DISCORD_MOD_CHANNEL: '123456789012345678', DISCORD_BOT_TOKEN: 'bot-token' });
const ctxOf = (s) => ({ db: s.env.DB, nowS: nowS(), rand: (b) => { globalThis.crypto.getRandomValues(b); } });
const heard = async (s, who, text, tab = 'world', at = Date.now()) => { const l = { tab, sub: who.id, name: who.handle ?? 'Guest', at, text }; return { ...l, sg: await mintStamp(l, s.gatePriv, { subtle }) }; };

test('SAFE5 THE REVIEWER\'S REQUEST: the current Haiku unless MOD_AI_MODEL names another, the key in its header, the brief cached, effort low, the answer held to the verdict schema - and the lines go as JSON data inside one tag, the speakers P1, P2 and never an account or a name (mutants: an account id sent; the schema dropped; the cache dropped)', async () => {
  const s = await standService(ON);
  const { asked, fetchFn } = outside([{ flags: [{ line: 1, category: 'hate', severity: 3, confidence: 0.97, reason: 'Calls asexual players attention sluts.' }] }]);
  const lines = [{ sub: 'p_sylvia001', tab: 'world', text: 'hi all' }, { sub: 'p_troll0001', tab: 'world', text: 'asexuals are attention *****' }];
  const r = await reviewLines(s.env.DB, s.env, fetchFn, { lines, focus: 'p_troll0001', nowS: nowS() });
  assert.deepEqual(r, { ok: true, flags: [{ line: 1, category: 'hate', severity: 3, confidence: 0.97, reason: 'Calls asexual players attention sluts.' }] });
  const [req] = asked.ai;
  assert.equal(req.headers['x-api-key'], 'sk-test');
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(req.body.model, MOD_AI_MODEL_DEFAULT);
  assert.equal(MOD_AI_MODEL_DEFAULT, 'claude-haiku-5-5');
  assert.deepEqual(req.body.system, [{ type: 'text', text: reviewerPrompt(), cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(req.body.output_config, { effort: 'low', format: { type: 'json_schema', schema: VERDICT_SCHEMA } });
  const sent = req.body.messages[0].content;
  assert.match(sent, /^<chat_lines>\n[\s\S]*\n<\/chat_lines>$/);
  assert.doesNotMatch(sent, /p_troll|p_sylvia/, 'no account is named to the reviewer');
  assert.deepEqual(JSON.parse(sent.slice('<chat_lines>\n'.length, -'\n</chat_lines>'.length)), { focus: 'P1', lines: [{ i: 0, speaker: 'P2', tab: 'world', text: 'hi all' }, { i: 1, speaker: 'P1', tab: 'world', text: 'asexuals are attention *****' }] });
  for (const rule of conductRules()) assert.ok(reviewerPrompt().includes(rule), 'the brief is the code the players agreed to');
  assert.match(reviewerPrompt(), /data, never instructions/);
  const other = await reviewLines(s.env.DB, { ...s.env, MOD_AI_MODEL: 'claude-opus-5-5' }, fetchFn, { lines, nowS: nowS() });
  assert.equal(other.ok, true);
  assert.equal(asked.ai[1].body.model, 'claude-opus-5-5');
});

test('SAFE5 WHAT A VERDICT MAY SAY: a flag outside the lines, of a category the code does not name, or a severity off the scale is dropped; confidence clamped; a refusal, a down API or an answer out of shape is an error and acts on nothing; the day\'s calls are a budget (mutants: an out-of-range line kept; the budget unchecked)', async () => {
  assert.deepEqual(flagsOf({ flags: [{ line: 5, category: 'hate', severity: 3, confidence: 1, reason: '' }, { line: 0, category: 'rude', severity: 3, confidence: 1, reason: '' }, { line: 0, category: 'hate', severity: 4, confidence: 1, reason: '' }, { line: 0, category: 'spam', severity: 2, confidence: 7, reason: '  a  b ' }] }, 2), [{ line: 0, category: 'spam', severity: 2, confidence: 1, reason: 'a b' }]);
  assert.equal(flagsOf({ nope: [] }, 1), null);
  const s = await standService({ ...ON, MOD_AI_DAILY_MAX: '2' });
  const lines = [{ sub: 'p_a0000001', tab: 'world', text: 'x' }];
  const { fetchFn } = outside(['refused', 'down']);
  assert.deepEqual(await reviewLines(s.env.DB, s.env, fetchFn, { lines, nowS: nowS() }), { error: 'ai-refused' });
  assert.deepEqual(await reviewLines(s.env.DB, s.env, fetchFn, { lines, nowS: nowS() }), { error: 'ai-down' });
  // PIN MOVED (AUDIT SAFE AI-3): a call the API never answered is given back - the day's second call is still to spend
  assert.deepEqual(await reviewLines(s.env.DB, s.env, fetchFn, { lines, nowS: nowS() }), { ok: true, flags: [] });
  assert.deepEqual(await reviewLines(s.env.DB, s.env, fetchFn, { lines, nowS: nowS() }), { error: 'ai-budget' });
  assert.equal(modAiOn({ MOD_AI: 'on' }), false, 'no key, no reviewer');
  assert.equal(modAiModeOf({ MOD_AI: 'loud' }), 'off');
  assert.equal(flagActs({ category: 'hate', severity: 3, confidence: 0.95 }), true);
  assert.equal(flagActs({ category: 'spam', severity: 3, confidence: 0.99 }), false, 'spam never mutes on its own');
  assert.equal(flagActs({ category: 'hate', severity: 2, confidence: 0.99 }), false);
  assert.equal(flagActs({ category: 'hate', severity: 3, confidence: 0.8 }), false);
  assert.deepEqual(reviewPayload([{ sub: 'a', tab: 'world', text: '1' }, { sub: 'b', tab: 'world', text: '2' }, { sub: 'a', tab: 'world', text: '3' }]).payload.lines.map((l) => l.speaker), ['P1', 'P2', 'P1']);
});

test('SAFE5 + SAFE8 A REPORTED CASE THROUGH THE CLOCK: the reviewer reads it (the reported account its focus), its verdict kept; with MOD_AI "on" a severe, sure verdict mutes for half an hour by `auto:review` and the order goes to the relay\'s door; then its card is posted to the moderators\' channel with its buttons - and nobody is pinged (mutants: the verdict never acted on; a card posted before its verdict)', async () => {
  const s = await standService(ON);
  const sylvia = await s.registered('Sylvia');
  const troll = await s.registered('Troll');
  const lines = [await heard(s, sylvia, 'hi all', 'world', Date.now() - 1000), await heard(s, troll, 'asexuals are attention *****')];
  const filed = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines }, sylvia.secret);
  // PIN MOVED (AUDIT SAFE AI-1): the mute takes a second read of the account's own lines - Sylvia's is not in it
  const { asked, fetchFn } = outside([{ flags: [{ line: 1, category: 'hate', severity: 3, confidence: 0.96, reason: 'Demeans asexual players.' }] }, { flags: [{ line: 0, category: 'hate', severity: 3, confidence: 0.95, reason: 'Demeans asexual players.' }] }]);
  await safetyMinute(ctxOf(s), s.env, { fetchFn });
  assert.deepEqual(asked.ai.map((a) => JSON.parse(a.body.messages[0].content.slice('<chat_lines>\n'.length, -'\n</chat_lines>'.length)).lines.map((l) => l.text)), [['hi all', 'asexuals are attention *****'], ['asexuals are attention *****']]);
  const raw = s.env.DB._raw;
  const c = raw.prepare('SELECT * FROM mod_cases WHERE id = ?').get(filed.body.case);
  assert.deepEqual([c.ai_state, c.ai_category, c.ai_severity, c.ai_mode, c.auto, c.discord_state], ['done', 'hate', 3, 'on', 'review', 'posted']);
  assert.equal(raw.prepare('SELECT muted_by FROM players WHERE id = ?').get(troll.id).muted_by, 'auto:review');
  assert.equal(asked.relay.length, 1);
  assert.equal(asked.discord.length, 1);
  const post = asked.discord[0];
  assert.equal(post.url, `${DISCORD_API}/channels/${ON.DISCORD_MOD_CHANNEL}/messages`);
  assert.equal(post.auth, 'Bot bot-token');
  assert.deepEqual(post.body.allowed_mentions, { parse: [] });
  assert.match(post.body.embeds[0].description, /! \[world\] Troll: asexuals are attention \*\*\*\*\*/);   // PIN MOVED (AUDIT SAFE AI-10): the line the reviewer flagged is marked `!`, not only the account's own `>`
  assert.match(post.body.embeds[0].description, /  \[world\] Sylvia: hi all/);
  assert.deepEqual(post.body.components[0].components.map((b) => b.custom_id), Object.keys(CARD_ACTS).map((k) => `safe:${k}:${filed.body.case}`));
  assert.equal(c.discord_msg, '900000000000000001');
});

test('SAFE5 SHADOW MODE ACTS ON NOTHING: the verdict is read and said on the card, marked a shadow\'s, and nobody is muted (mutant: shadow acting)', async () => {
  const s = await standService({ ...ON, MOD_AI: 'shadow' });
  const sylvia = await s.registered('Sylvia');
  const troll = await s.registered('Troll');
  const filed = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [await heard(s, troll, 'pride flags are a mental illness lmao')] }, sylvia.secret);
  const { asked, fetchFn } = outside([{ flags: [{ line: 0, category: 'hate', severity: 3, confidence: 0.99, reason: 'Mocks LGBTQ players.' }] }]);
  await safetyMinute(ctxOf(s), s.env, { fetchFn });
  assert.equal(s.env.DB._raw.prepare('SELECT muted_until FROM players WHERE id = ?').get(troll.id).muted_until, null);
  assert.equal(asked.relay.length, 0);
  assert.match(JSON.stringify(asked.discord[0].body.embeds[0].fields), /SHADOW - nothing was done on it/);
  assert.equal(s.env.DB._raw.prepare('SELECT auto FROM mod_cases WHERE id = ?').get(filed.body.case).auto, null);
});

test('SAFE5 THE FEED: the relay\'s signed batch is kept once (a replay ignored) while the reviewer is on and dropped unread while it is off; a batch another key signed is refused; the clock reads it, and a speaker breaking the code at severity 2 or worse gets a case of the reviewer\'s own - the flagged line and the lines before it - while a severity 1 is said nowhere (mutants: the signature unchecked; a mild flag opening a case)', async () => {
  const s = await standService({ ...ON, MOD_AI: 'shadow' });
  const sylvia = await s.registered('Sylvia');
  const troll = await s.registered('Troll');
  const rude = await s.registered('Rude');
  const lines = [
    { tab: 'world', sub: sylvia.id, name: 'Sylvia', at: Date.now() - 4000, text: 'gg everyone' },
    { tab: 'world', sub: rude.id, name: 'Rude', at: Date.now() - 3000, text: 'this game sucks' },
    { tab: 'world', sub: sylvia.id, name: 'Sylvia', at: Date.now() - 2000, text: 'happy pride month!' },
    { tab: 'world', sub: troll.id, name: 'Troll', at: Date.now() - 1000, text: 'nobody wants your flag here f*g' },
  ];
  const sealed = await sealFeed({ id: '00112233445566aa', at: Date.now(), lines }, s.gatePriv, { subtle });
  const post = (sig, env = s.env) => s.fetch('https://accounts.invalid/v1/mod/feed', { method: 'POST', headers: { [FEED_SIG_HEADER]: sig }, body: sealed.body });
  const ok = await post(sealed.sig);
  assert.equal(ok.status, 202);
  assert.deepEqual(await ok.json(), { ok: true, read: true });
  await post(sealed.sig);
  assert.equal(s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM mod_feed').get().n, 1, 'a replay is kept once');
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const forged = await sealFeed({ id: '00112233445566bb', at: Date.now(), lines }, other.privateKey, { subtle });
  assert.equal((await s.fetch('https://accounts.invalid/v1/mod/feed', { method: 'POST', headers: { [FEED_SIG_HEADER]: forged.sig }, body: forged.body })).status, 401);

  const { asked, fetchFn } = outside([{ flags: [{ line: 1, category: 'harassment', severity: 1, confidence: 0.5, reason: 'Rude about the game.' }, { line: 3, category: 'hate', severity: 3, confidence: 0.98, reason: 'A slur and an anti-LGBTQ attack.' }] }]);
  await safetyMinute(ctxOf(s), s.env, { fetchFn });
  assert.equal(asked.ai.length, 1);
  const raw = s.env.DB._raw;
  const cases = raw.prepare('SELECT * FROM mod_cases').all();
  assert.deepEqual(cases.map((c) => [c.target, c.source, c.ai_category, c.ai_severity]), [[troll.id, 'review', 'hate', 3]], 'one case, the troll\'s - the rude line is said nowhere');
  assert.deepEqual(raw.prepare('SELECT text, sg FROM mod_case_lines WHERE case_id = ? ORDER BY at').all(cases[0].id).map((l) => [l.text, l.sg]), lines.map((l) => [l.text, null]), 'the flagged line and the three before it');
  assert.equal(raw.prepare("SELECT state FROM mod_feed WHERE id = '00112233445566aa'").get().state, 'done');

  const off = await standService({ MOD_AI: 'off' });
  const dropped = await off.fetch('https://accounts.invalid/v1/mod/feed', { method: 'POST', headers: { [FEED_SIG_HEADER]: sealed.sig }, body: sealed.body });
  assert.deepEqual(await dropped.json(), { ok: true, read: false });
  assert.equal(off.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM mod_feed').get().n, 0);
});

/** Discord's application key pair and a signed interaction for it. */
async function discordSigner() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const hex = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('hex');
  const sign = async (body, stamp = String(nowS())) => {
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    const msg = new Uint8Array([...new TextEncoder().encode(stamp), ...bytes]);
    return { bytes, headers: { 'x-signature-ed25519': Buffer.from(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, kp.privateKey, msg))).toString('hex'), 'x-signature-timestamp': stamp } };
  };
  return { hex, sign };
}

test('SAFE8 DISCORD\'S INTERACTIONS: unsigned or old ones refused; a ping answered; a press by a Discord user DISCORD_MODERATORS pairs with a game moderator mutes the case\'s account (MOD1\'s law), keeps the act in the record, pushes the order, resolves the case and redraws its card without its buttons; a stranger\'s press does nothing; /mod lookup says the account\'s standing (mutants: the signature unchecked; a Discord user who is not a moderator in the game acting)', async () => {
  const d = await discordSigner();
  const s = await standService({ ...ON, MOD_AI: 'off', DISCORD_PUBLIC_KEY: d.hex, DISCORD_MODERATORS: '111111111111111111:Asynian,222222222222222222:Sylvia' });
  const mod = await s.registered('Asynian');
  const sylvia = await s.registered('Sylvia');
  const troll = await s.registered('Troll');
  const filed = await s.call('/v1/safety/report', { target: troll.id, reason: 'harassment', lines: [await heard(s, troll, 'quit the game, nobody likes you')] }, sylvia.secret);
  const relayed = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url) === RELAY) { relayed.push(JSON.parse(init.body).order); return Response.json({ ok: true }); } return real(url, init); };
  try {
    const knock = async (body, { stamp, tamper } = {}) => {
      const signed = await d.sign(body, stamp);
      const bytes = tamper ? new TextEncoder().encode(JSON.stringify({ ...body, tampered: true })) : signed.bytes;
      const res = await s.fetch('https://accounts.invalid/v1/discord/interactions', { method: 'POST', headers: signed.headers, body: bytes });
      return { status: res.status, body: await res.json() };
    };
    assert.equal((await knock({ type: 1 }, { tamper: true })).status, 401);
    assert.equal((await knock({ type: 1 }, { stamp: String(nowS() - 3600) })).status, 401, 'an old interaction replayed');
    assert.deepEqual((await knock({ type: 1 })).body, { type: 1 });
    const press = (user, act = 'm1d') => ({ type: 3, member: { user: { id: user } }, data: { custom_id: `safe:${act}:${filed.body.case}` } });
    const stranger = await knock(press('333333333333333333'));
    assert.equal(stranger.body.type, 4);
    assert.equal(stranger.body.data.flags, 64);
    const notMod = await knock(press('222222222222222222'));
    assert.match(notMod.body.data.content, /Only the game's moderators/, 'paired with a handle that is no moderator in the game');
    assert.equal(s.env.DB._raw.prepare('SELECT muted_until FROM players WHERE id = ?').get(troll.id).muted_until, null);
    const done = await knock(press('111111111111111111'));
    assert.equal(done.body.type, 7);
    assert.deepEqual(done.body.data.components, [], 'a resolved card has no buttons');
    assert.match(done.body.data.embeds[0].footer.text, /Actioned by Asynian: muted 1 day/);
    const raw = s.env.DB._raw;
    assert.ok(raw.prepare('SELECT muted_until FROM players WHERE id = ?').get(troll.id).muted_until > nowS() + 86000);
    assert.deepEqual({ ...raw.prepare('SELECT kind, actor, actor_name, case_id FROM mod_actions WHERE target = ?').get(troll.id) }, { kind: 'mute', actor: mod.id, actor_name: 'Asynian (Discord)', case_id: filed.body.case });
    assert.equal(raw.prepare('SELECT status FROM mod_cases WHERE id = ?').get(filed.body.case).status, 'actioned');
    assert.equal(relayed.length, 1);
    const look = await knock({ type: 2, member: { user: { id: '111111111111111111' } }, data: { name: 'mod', options: [{ name: 'lookup', type: 1, options: [{ name: 'player', value: 'Troll' }] }] } });
    assert.match(look.body.data.content, /\*\*Troll\*\*.*muted until.*1 strike in 90 days; next: 1 day/s);
  } finally { globalThis.fetch = real; }
});

test('SAFE8 THE CARD, PURE: the reported account\'s lines marked, a player\'s code fence defused, the reviewer\'s shadow said, and the switches read from config alone (mutants: a fence left live; a Discord moderator taken without a handle)', () => {
  const card = caseCard({ c: { id: '0011223344556677', target: 'p_troll', source: 'report', status: 'open', reports: 2, credible: 1, ai_state: 'done', ai_category: 'hate', ai_severity: 3, ai_confidence: 0.9, ai_reason: 'Slur.', ai_mode: 'shadow', auto: null }, name: 'Troll', lines: [{ sub: 'p_sylvia', tab: 'world', name: 'Sylvia', text: 'hi' }, { sub: 'p_troll', tab: 'world', name: 'Troll', text: '```@everyone```' }], reasons: ['hate', 'hate'], strikes: 3 });
  assert.equal(card.embeds[0].description, "```\n  [world] Sylvia: hi\n> [world] Troll: '''@everyone'''\n```");
  assert.match(JSON.stringify(card.embeds[0].fields), /next: a ban/);
  assert.match(JSON.stringify(card.embeds[0].fields), /SHADOW/);
  assert.deepEqual([...discordModerators({ DISCORD_MODERATORS: '111111111111111111:Asynian, bad, 22:x, 333333333333333333:' })], [['111111111111111111', 'asynian']]);
  assert.equal(discordOn({ DISCORD_MOD_CHANNEL: '123456789012345678' }), false, 'no token, no posts');
  assert.equal(interactionsOn({ DISCORD_PUBLIC_KEY: 'zz' }), false);
});

test('SAFE5 THE HOUR\'S SWEEP: the feed\'s batches past a day go, a case left open past ninety days closes as expired, and a resolved case\'s lines go ninety days after it closed - its record stays (mutant: an open case\'s lines swept)', async () => {
  const s = await standService();
  const raw = s.env.DB._raw;
  const t = nowS();
  const troll = await s.registered('Troll');
  raw.prepare("INSERT INTO mod_feed (id, at, lines, state) VALUES ('aaaaaaaaaaaaaaaa', ?, NULL, 'done'), ('bbbbbbbbbbbbbbbb', ?, '[]', 'due')").run(t - FEED_KEEP_S - 1, t);
  raw.prepare("INSERT INTO mod_cases (id, target, source, status, opened_at, updated_at, ai_state, discord_state) VALUES ('c000000000000001', ?, 'report', 'open', ?, ?, 'off', 'off')").run(troll.id, t - CASE_OPEN_MAX_S - 1, t);
  raw.prepare("INSERT INTO mod_case_lines (case_id, at, sub, name, tab, text) VALUES ('c000000000000001', 1, ?, 'Troll', 'world', 'x')").run(troll.id);
  await safetySweep({ db: s.env.DB, nowS: t });
  assert.deepEqual(raw.prepare('SELECT id FROM mod_feed').all().map((r) => r.id), ['bbbbbbbbbbbbbbbb']);
  assert.deepEqual({ ...raw.prepare("SELECT status, resolution FROM mod_cases WHERE id = 'c000000000000001'").get() }, { status: 'dismissed', resolution: 'expired' });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM mod_case_lines').get().n, 1, 'closed just now: its lines stay');
  await safetySweep({ db: s.env.DB, nowS: t + 91 * 86400 });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM mod_case_lines').get().n, 0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM mod_cases').get().n, 1, 'the case itself is kept');
  assert.ok(SPROUT_S > 0);
});
