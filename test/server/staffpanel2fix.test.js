// STAFF-PANEL2-FIX (2026-10-22; design doc "DFO Staff Panel: design", Weak spots "Sanctions, cases and roles" and "Panel
// Mute and Ban have no route") - THE CASES' AND SANCTIONS' GAPS, closed in the code every door shares (server-account/src/
// safety.js modAct), driven through the real Worker on the node:sqlite database every account pin stands on
// (test/accountDb.mjs), from each door: the staff panel (/v1/staff/*), the game's moderators (/v1/mod/*) and Discord.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER, STAFF_IDLE_S } from '../../server-account/src/staff.js';
import { CLAIM_S, HIGH_IDLE_S } from '../../server-account/src/staffCases.js';
import { openCaseFor, modAct, CASE_ACT_S } from '../../server-account/src/safety.js';
import { discordInteraction } from '../../server-account/src/discord.js';
import { mintStamp } from '../../src/net/safety/chatStamp.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { verifyOrder, verifyToken } from '../../src/net/identityToken.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { SPROUT_S } from '../../server-account/src/titles.js';
import { banAccount, unbanAccount } from '../../server-account/src/sanctions.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up and the relay's door recorded (no other fetch leaves): SirMcMobdon (an Admin and the
 *  owner) and the Moderators Asynian and Tabbyvish signed in to the panel; Devvy (an Admin) and Fang (the Shadow Fang's
 *  title, which moderates) not; Troll and Sylvia, two players. `g` each one's game session. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'SirMcMobdon,Devvy', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'SirMcMobdon', SHADOW_FANG_HANDLES: 'Fang',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY, MOD_AI: 'off',
    DISCORD_MODERATORS: '111111111111111111:Asynian,222222222222222222:Tabbyvish,333333333333333333:SirMcMobdon',
  });
  const pushed = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) === RELAY) { pushed.push(JSON.parse(init.body).order); return Response.json({ ok: true }); }
    return new Response('no network in this test', { status: 503 });
  };
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** @type {Record<string, { secret: string, id: string, handle: string }>} */
  const g = {};
  for (const h of ['SirMcMobdon', 'Asynian', 'Tabbyvish', 'Devvy', 'Fang']) g[h] = await s.registered(h);
  const troll = await s.registered('Troll');
  const sylvia = await s.registered('Sylvia');
  const raw = s.env.DB._raw;
  raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(nowS() - SPROUT_S - 60, sylvia.id);   // old enough to count
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const enrol = async (handle) => {
    const inv = await staff('/v1/staff/invite', { handle }, mob.session);
    const key = await extensionKey();
    const r = await staff('/v1/staff/enroll', { handle, password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', handle)) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { ...r.body, key };
  };
  const asy = await enrol('Asynian');
  const tab = await enrol('Tabbyvish');
  let n = 0;
  /** An open case on `who`, laid in by hand as safety.js lays one: `reports` its reporters' [reason, counted, at]. */
  const caseOn = (who, { reports = [['harassment', 1, nowS()]], ...cols } = {}) => {
    const id = (++n).toString(16).padStart(16, 'c');
    const t = nowS();
    const row = { id, target: who.id, source: 'report', status: 'open', opened_at: t - 100 * n, updated_at: t, reports: reports.length, credible: reports.filter((r) => r[1]).length, ai_state: 'off', discord_state: 'off', ...cols };
    raw.prepare(`INSERT INTO mod_cases (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
    reports.forEach(([reason, counted, at], i) => {
      const rep = `p_rep${n}x${i}`.padEnd(10, '0');
      raw.prepare('INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 1, 1)').run(rep, `Rep ${n} ${i}`);
      raw.prepare('INSERT INTO mod_reports (case_id, reporter, reason, at, counted) VALUES (?, ?, ?, ?, ?)').run(id, rep, reason, at, counted);
    });
    return id;
  };
  let m = 0;
  const player = async () => s.registered(`Target${++m}`);
  const ctx = () => ({ db: s.env.DB, nowS: nowS(), subtle, rand: (b8) => globalThis.crypto.getRandomValues(b8) });
  /** A Discord button press, or a /mod command, by the Discord user `user`. */
  const press = (user, customId, id = undefined) => discordInteraction(ctx(), s.env, { type: 3, ...(id ? { id } : {}), member: { user: { id: user } }, data: { custom_id: customId } });
  const command = (user, sub, opts) => discordInteraction(ctx(), s.env, { type: 2, member: { user: { id: user } },
    data: { name: 'mod', options: [{ name: sub, options: Object.entries(opts).map(([name, value]) => ({ name, value })) }] } });
  const row = (id) => raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
  const caseRow = (id) => raw.prepare('SELECT * FROM mod_cases WHERE id = ?').get(id);
  const strikes = (id) => raw.prepare("SELECT COUNT(*) AS n FROM mod_actions WHERE target = ? AND kind IN ('mute', 'ban')").get(id).n;
  return { ...s, raw, staff, game: s.call, g, mob, asy, tab, troll, sylvia, caseOn, player, ctx, press, command, row, caseRow, strikes, pushed, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL2-FIX 1: ONE CASE, ONE SANCTION from every door - a Mute or Ban carries its case and the press\'s one-time id; the same press sent again is the first, answered; a second act on the case is refused from the panel, the game and Discord; an act in flight holds the case; a refused act gives it back (mutants: the take\'s act_click check; the repeat look; the give-back; the click asked of a panel press)', async () => {
  const s = await stand();
  try {
    const line = { tab: 'world', sub: s.troll.id, name: 'Troll', at: Date.now(), text: 'quit the game, nobody likes you' };
    const filed = await s.game('/v1/safety/report', { target: s.troll.id, reason: 'harassment', lines: [{ ...line, sg: await mintStamp(line, s.gatePriv, { subtle }) }] }, s.sylvia.secret);
    assert.equal(filed.status, 200, JSON.stringify(filed.body));
    const id = filed.body.case;
    const mute = (click, who = s.asy, minutes = 30) => s.staff('/v1/staff/mute', { target: s.troll.id, case: id, minutes, ...(click === undefined ? {} : { click }) }, who.session);
    // a panel press with no one-time id, or one of the wrong shape, is refused before anything is written
    assert.deepEqual((await mute(undefined)).body, { error: 'bad-click' });
    assert.deepEqual((await mute('short')).body, { error: 'bad-click' });
    assert.deepEqual((await s.staff('/v1/staff/ban', { target: s.troll.id, days: 1 }, s.asy.session)).body, { error: 'bad-click' });
    // a case named is the account's own
    assert.deepEqual(await s.staff('/v1/staff/mute', { target: s.sylvia.id, case: id, minutes: 30, click: 'press-a000' }, s.asy.session).then((r) => [r.status, r.body]), [404, { error: 'no-case' }]);
    assert.equal(s.row(s.sylvia.id).muted_until, null);
    // a refused act gives its case back
    assert.equal((await mute('press-a001', s.asy, 99999999)).status, 400);
    assert.equal(s.caseRow(id).act_click, null, 'a refused act leaves the case to the next');
    // an act in flight holds the case - from the panel and from the game - and a refused act gives back nothing it never took
    s.raw.prepare('UPDATE mod_cases SET act_click = ? WHERE id = ?').run('other-press-1', id);
    assert.deepEqual(await mute('press-a002').then((r) => [r.status, r.body]), [409, { error: 'case-acted' }]);
    assert.deepEqual(await s.game('/v1/mod/mute', { target: s.troll.id, minutes: 30 }, s.g.Tabbyvish.secret).then((r) => [r.status, r.body.error]), [409, 'case-acted']);
    assert.equal(s.caseRow(id).act_click, 'other-press-1');
    s.raw.prepare('UPDATE mod_cases SET act_click = NULL WHERE id = ?').run(id);
    // the one act
    const one = await mute('press-a003');
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(one.body.case, id);
    assert.deepEqual({ ...s.raw.prepare('SELECT case_id, click FROM mod_actions WHERE target = ?').get(s.troll.id) }, { case_id: id, click: 'press-a003' });
    assert.deepEqual([s.caseRow(id).status, s.caseRow(id).act_click], ['actioned', 'press-a003']);
    assert.equal(s.strikes(s.troll.id), 1);
    assert.equal(s.pushed.length, 1);
    // the same press sent again is the first, answered: no second strike, no second order
    const again = await mute('press-a003');
    assert.deepEqual([again.status, again.body.repeat], [200, true]);
    assert.equal(s.strikes(s.troll.id), 1);
    assert.equal(s.pushed.length, 1);
    assert.ok(s.raw.prepare("SELECT 1 FROM staff_audit WHERE act = 'mute' AND outcome = 'ok' AND detail LIKE '%\"repeat\":true%'").get(), 'the repeat written down');
    // a second sanction on the case: the panel (another member, an Admin), and a Discord button - none lands
    assert.deepEqual(await s.staff('/v1/staff/ban', { target: s.troll.id, case: id, days: 7, click: 'press-a004' }, s.tab.session).then((r) => [r.status, r.body]), [409, { error: 'case-closed' }]);
    assert.deepEqual((await s.staff('/v1/staff/dismiss', { target: s.troll.id, case: id }, s.mob.session)).body, { error: 'case-closed' });
    const card = await s.press('222222222222222222', `safe:b30:${id}`, 'discord-0000000001');
    assert.equal(card.type, 7, 'Discord shows the card as it stands');
    assert.equal(s.row(s.troll.id).banned_until, null);
    assert.equal(s.strikes(s.troll.id), 1);
    assert.deepEqual(s.raw.prepare("SELECT outcome FROM staff_audit WHERE act = 'ban'").all().map((r) => r.outcome), ['failed', 'failed'], 'each refusal written down');
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX 1: Discord\'s press id is its one-time id - a press Discord sends twice is one act (mutant: the interaction\'s id unread)', async () => {
  const s = await stand();
  try {
    const t = await s.player();
    const c = s.caseOn(t);
    assert.equal((await s.press('222222222222222222', `safe:m30:${c}`, 'discord-0000000002')).type, 7);
    assert.deepEqual({ ...s.raw.prepare('SELECT case_id, click FROM mod_actions WHERE target = ?').get(t.id) }, { case_id: c, click: 'discord-0000000002' });
    assert.equal(s.caseRow(c).status, 'actioned');
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX 2: THE CLAIM IS ASKED IN THE SHARED ACT - a case another member holds in the panel refuses the game\'s /mute, /ban and dismiss and Discord\'s /mod as the panel does; its holder acts on it from the game (mutants: the claim dropped from the take; the holder refused)', async () => {
  const s = await stand();
  try {
    const a = await s.player();
    const ca = s.caseOn(a);
    assert.equal((await s.staff('/v1/staff/claim', { target: a.id }, s.asy.session)).status, 200);
    for (const [path, body] of [['/v1/mod/mute', { target: a.id, minutes: 30 }], ['/v1/mod/ban', { target: a.id, days: 1 }], ['/v1/mod/dismiss', { target: a.id }]]) {
      const r = await s.game(path, body, s.g.Tabbyvish.secret);
      assert.deepEqual([r.status, r.body?.error], [409, 'staff-claimed'], path);
    }
    assert.match((await s.command('222222222222222222', 'ban', { player: a.id, days: 1 })).data.content, /Another staff member has this case in the staff panel/);
    assert.match((await s.command('333333333333333333', 'mute', { player: a.id, minutes: 30 })).data.content, /Another staff member has this case/, 'an Admin too - an Admin takes the claim first');
    assert.deepEqual([s.row(a.id).muted_until, s.row(a.id).banned_until], [null, null]);
    assert.deepEqual([s.caseRow(ca).status, s.caseRow(ca).act_click], ['open', null], 'and the case left as it was');
    // the holder acts from the game
    const own = await s.game('/v1/mod/mute', { target: a.id, minutes: 30 }, s.g.Asynian.secret);
    assert.equal(own.status, 200, JSON.stringify(own.body));
    assert.equal(own.body.case, ca);
    assert.match(s.caseRow(ca).resolution, /\(in the game\)$/);
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX 3: CASES HAVE A KIND - a spawn case opens beside a chat case, one open a kind; a Moderator sees and acts on chat cases alone, an Admin on both, in the panel, the game and Discord (mutants: each kind gate)', async () => {
  const s = await stand();
  try {
    const t = await s.player();
    const spawn = await openCaseFor(s.ctx(), s.env, t.id, 'review', 'spawn');
    const chat = await openCaseFor(s.ctx(), s.env, t.id, 'report');
    assert.notEqual(spawn, chat);
    assert.equal(await openCaseFor(s.ctx(), s.env, t.id, 'review', 'spawn'), spawn, 'one open case a kind');
    assert.deepEqual([s.caseRow(spawn).kind, s.caseRow(chat).kind], ['spawn', 'chat']);
    // the lists
    const panel = async (who) => (await s.staff('/v1/staff/cases', {}, who.session)).body.cases.filter((c) => c.target === t.id).map((c) => `${c.kind}:${c.id}`).sort();
    assert.deepEqual(await panel(s.asy), [`chat:${chat}`]);
    assert.deepEqual(await panel(s.mob), [`chat:${chat}`, `spawn:${spawn}`].sort());
    const inGame = async (who) => (await s.game('/v1/mod/cases', {}, s.g[who].secret)).body.cases.filter((c) => c.target === t.id).map((c) => c.kind).sort();
    assert.deepEqual(await inGame('Tabbyvish'), ['chat']);
    assert.deepEqual(await inGame('SirMcMobdon'), ['chat', 'spawn']);
    // one look: a Moderator's never the spawn case
    assert.deepEqual((await s.staff('/v1/staff/case', { target: t.id, case: spawn }, s.asy.session)).body, { error: 'no-case' });
    assert.deepEqual((await s.staff('/v1/staff/claim', { target: t.id, case: spawn }, s.asy.session)).body, { error: 'no-case' }, 'nor a claim of it');
    assert.equal(s.caseRow(spawn).claimed_by, null);
    assert.equal((await s.staff('/v1/staff/case', { target: t.id, case: spawn }, s.mob.session)).body.case.kind, 'spawn');
    const u = await s.player();
    const lone = await openCaseFor(s.ctx(), s.env, u.id, 'review', 'spawn');
    assert.equal((await s.game('/v1/mod/case', { target: u.id }, s.g.Tabbyvish.secret)).status, 404, 'a spawn case alone: none for a Moderator');
    assert.equal((await s.game('/v1/mod/case', { target: u.id }, s.g.SirMcMobdon.secret)).body.case.id, lone);
    // one act: a Moderator's refused on a spawn case from every door
    assert.deepEqual(await s.staff('/v1/staff/mute', { target: t.id, case: spawn, minutes: 30, click: 'press-k001' }, s.asy.session).then((r) => [r.status, r.body]), [403, { error: 'not-developer' }]);
    assert.match((await s.press('222222222222222222', `safe:dis:${spawn}`)).data.content, /Only an Admin can act on a spawn case/);
    assert.equal((await s.game('/v1/mod/dismiss', { target: u.id }, s.g.Tabbyvish.secret)).status, 404, 'the game\'s dismiss finds no chat case');
    assert.equal(s.caseRow(spawn).status, 'open');
    // a Moderator's mute of an account with a spawn case alone answers no case, and leaves it an Admin's
    const bare = await s.game('/v1/mod/mute', { target: u.id, minutes: 30 }, s.g.Tabbyvish.secret);
    assert.deepEqual([bare.status, bare.body.case], [200, undefined]);
    assert.equal(s.caseRow(lone).status, 'open');
    // an Admin's act on each kind: the spawn case closed, the chat case left
    assert.equal((await s.staff('/v1/staff/dismiss', { target: t.id, case: spawn }, s.mob.session)).status, 200);
    assert.deepEqual([s.caseRow(spawn).status, s.caseRow(chat).status], ['dismissed', 'open']);
    assert.equal((await s.game('/v1/mod/dismiss', { target: u.id }, s.g.SirMcMobdon.secret)).status, 200, 'an Admin in the game: the spawn case modCase showed');
    assert.equal(s.caseRow(lone).status, 'dismissed');
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX 4: WHO SET EACH SANCTION is stored, and an Admin\'s is lifted or cut short by an Admin alone - from the panel, the game and Discord; a Moderator may lengthen it and it stays the Admin\'s (mutants: each admin guard; the setter unwritten)', async () => {
  const s = await stand();
  try {
    const troll = s.troll.id;
    const mobId = s.g.SirMcMobdon.id;
    const asyId = s.g.Asynian.id;
    // a ban
    assert.equal((await s.staff('/v1/staff/ban', { target: troll, days: 7, click: 'press-s001' }, s.mob.session)).status, 200);
    assert.deepEqual([s.row(troll).banned_by, s.row(troll).ban_admin], [mobId, 1]);
    assert.deepEqual(await s.staff('/v1/staff/unban', { target: troll }, s.asy.session).then((r) => [r.status, r.body]), [403, { error: 'admin-sanction' }]);
    assert.equal((await s.game('/v1/mod/unban', { target: troll }, s.g.Tabbyvish.secret)).status, 403);
    assert.match((await s.command('222222222222222222', 'unban', { player: troll })).data.content, /An Admin set this/);
    assert.equal((await s.staff('/v1/staff/ban', { target: troll, days: 1, click: 'press-s002' }, s.asy.session)).body.error, 'admin-sanction', 'cut short');
    assert.equal((await s.staff('/v1/staff/ban', { target: troll, days: 30, click: 'press-s003' }, s.asy.session)).status, 200, 'lengthened');
    assert.deepEqual([s.row(troll).banned_by, s.row(troll).ban_admin], [asyId, 1], 'set by the Moderator now, and still the Admin\'s');
    assert.equal((await s.game('/v1/mod/unban', { target: troll }, s.g.Devvy.secret)).status, 200, 'another Admin lifts it');
    assert.deepEqual([s.row(troll).banned_until, s.row(troll).banned_by, s.row(troll).ban_admin], [null, null, null]);
    // a Moderator's own ban another Moderator lifts
    assert.equal((await s.staff('/v1/staff/ban', { target: troll, days: 7, click: 'press-s004' }, s.asy.session)).status, 200);
    assert.deepEqual([s.row(troll).banned_by, s.row(troll).ban_admin], [asyId, 0]);
    assert.equal((await s.game('/v1/mod/unban', { target: troll }, s.g.Tabbyvish.secret)).status, 200);
    // a mute
    const syl = s.sylvia.id;
    assert.equal((await s.game('/v1/mod/mute', { target: syl, minutes: 60 }, s.g.SirMcMobdon.secret)).status, 200);
    assert.deepEqual([s.row(syl).muted_by, s.row(syl).mute_admin], [mobId, 1]);
    assert.deepEqual(await s.game('/v1/mod/mute', { target: syl, minutes: 0 }, s.g.Tabbyvish.secret).then((r) => [r.status, r.body.error]), [403, 'admin-sanction']);
    assert.equal((await s.staff('/v1/staff/mute', { target: syl, minutes: 30, click: 'press-s005' }, s.asy.session)).body.error, 'admin-sanction', 'cut short');
    assert.match((await s.command('222222222222222222', 'unmute', { player: syl })).data.content, /An Admin set this/);
    assert.equal((await s.game('/v1/mod/mute', { target: syl, minutes: 120 }, s.g.Tabbyvish.secret)).status, 200, 'lengthened');
    assert.deepEqual([s.row(syl).muted_by, s.row(syl).mute_admin], [s.g.Tabbyvish.id, 1]);
    assert.equal((await s.staff('/v1/staff/mute', { target: syl, minutes: 0, click: 'press-s006' }, s.mob.session)).status, 200, 'the Admin lifts it');
    assert.deepEqual([s.row(syl).muted_until, s.row(syl).mute_admin], [null, null]);
    // a Moderator's own mute another Moderator lifts
    assert.equal((await s.game('/v1/mod/mute', { target: syl, minutes: 60 }, s.g.Tabbyvish.secret)).status, 200);
    assert.equal(s.row(syl).mute_admin, 0);
    assert.equal((await s.game('/v1/mod/mute', { target: syl, minutes: 0 }, s.g.Asynian.secret)).status, 200);
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX 6: A CLAIMED HIGH CASE LEFT IDLE returns to the top, and A CLAIM ENDS WITH ITS SESSION - logged out or idle, the claim stands for nobody: the list shows none, another member claims it, and the game\'s moderators act (mutants: the idle clock; idle on a lower level; the session asked of the claim)', async () => {
  const s = await stand();
  try {
    const free = s.caseOn(await s.player(), { ai_state: 'failed' });
    const heldOn = await s.player();
    const held = s.caseOn(heldOn, { ai_state: 'failed' });   // opened before `free`
    const medOn = await s.player();
    const med = s.caseOn(medOn, { ai_state: 'done', ai_category: 'harassment', ai_severity: 2 });
    assert.equal((await s.staff('/v1/staff/claim', { target: heldOn.id }, s.tab.session)).status, 200);
    assert.equal((await s.staff('/v1/staff/claim', { target: medOn.id }, s.mob.session)).status, 200);
    const order = async () => (await s.staff('/v1/staff/cases', {}, s.asy.session)).body.cases;
    assert.deepEqual((await order()).map((c) => c.id), [free, held, med], 'a claimed case below the rest of its level');
    // its holder's last look or act HIGH_IDLE_S ago (claim_until is CLAIM_S past it)
    const touched = (id, ago) => s.raw.prepare('UPDATE mod_cases SET claim_until = ? WHERE id = ?').run(nowS() - ago + CLAIM_S, id);
    touched(held, HIGH_IDLE_S - 5);
    touched(med, HIGH_IDLE_S + 5);
    assert.deepEqual((await order()).map((c) => [c.id, c.claim?.idle ?? null]), [[free, null], [held, false], [med, false]], 'not yet - and a medium case is never idle');
    touched(held, HIGH_IDLE_S);
    const now = await order();
    assert.deepEqual(now.map((c) => [c.id, c.claim?.idle ?? null]), [[held, true], [free, null], [med, false]], 'idle: sorted as nobody\'s, the older first');
    assert.equal(now[0].claim.name, 'Tabbyvish', 'still shown as held');
    // the holder's session ends: the claim with it
    assert.equal((await s.staff('/v1/staff/logout', {}, s.tab.session)).status, 200);
    assert.equal((await order()).find((c) => c.id === held).claim, null);
    assert.equal((await s.game('/v1/mod/mute', { target: heldOn.id, minutes: 30 }, s.g.Tabbyvish.secret)).status, 200, 'the game acts on a claim nobody holds');
    // an idle session the same, before anything deletes it
    const other = await s.player();
    const oc = s.caseOn(other);
    assert.equal((await s.staff('/v1/staff/claim', { target: other.id }, s.asy.session)).status, 200);
    s.raw.prepare('UPDATE staff_sessions SET last_act = ? WHERE player_id = ?').run(nowS() - STAFF_IDLE_S, s.g.Asynian.id);
    assert.equal(s.caseRow(oc).claimed_by, s.g.Asynian.id, 'the row still names the holder');
    assert.equal((await s.staff('/v1/staff/claim', { target: other.id }, s.mob.session)).status, 200, 'and anyone may take it');
    assert.equal(s.caseRow(oc).claim_from, null, 'nobody was holding it to be told');
    // and a session past its whole life
    assert.equal(s.caseRow(oc).claimed_by, s.g.SirMcMobdon.id);
    s.raw.prepare('UPDATE staff_sessions SET expires_at = ? WHERE player_id = ?').run(nowS(), s.g.SirMcMobdon.id);
    assert.equal((await s.game('/v1/mod/mute', { target: other.id, minutes: 30 }, s.g.Tabbyvish.secret)).status, 200, 'the game acts on it');
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX 8: CUTTING OFF A STAFF MEMBER holds at every door - the stored flag takes every role (the panel, the game\'s /v1/mod doors, Discord, a token\'s staff glyphs), the cut ends their game sessions, and the relay is ordered to close their sockets; an owner\'s invite brings them back (mutants: each suspended check; the sessions left; no order pushed)', async () => {
  const s = await stand();
  try {
    const asyId = s.g.Asynian.id;
    const glyphs = async (secret) => {
      const t = await s.game('/v1/auth/token', {}, secret);
      assert.equal(t.status, 200, JSON.stringify(t.body));
      const r = await verifyToken(t.body.token, s.identityPublic, { subtle, nowS: nowS() });
      assert.ok(r.ok, r.why);
      return r.claims.g ?? [];
    };
    assert.ok((await glyphs(s.g.Asynian.secret)).includes('mod'));
    assert.equal((await s.game('/v1/mod/cases', {}, s.g.Asynian.secret)).status, 200);
    const cut = await s.staff('/v1/staff/cut', { handle: 'Asynian' }, s.mob.session);
    assert.deepEqual([cut.status, cut.body], [200, { ok: true, handle: 'Asynian', relay: true }]);
    assert.equal(s.row(asyId).staff_suspended, 1);
    // the order at the relay's door: the account's sockets closed
    const r = await verifyOrder(s.pushed.at(-1), s.identityPublic, { subtle, nowS: nowS(), kind: 'staffcut' });
    assert.ok(r.ok, r.why);
    assert.deepEqual(Object.keys(r.claims).sort(), ['e', 'i', 'o', 's']);
    assert.equal(r.claims.s, asyId);
    // every session gone: the panel's, and the game's
    assert.equal((await s.staff('/v1/staff/me', {}, s.asy.session)).status, 401);
    assert.equal((await s.game('/v1/mod/cases', {}, s.g.Asynian.secret)).status, 401);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(asyId).n, 0);
    // signed in again: no role at any door, though the list still names them
    const back = await s.game('/v1/auth/login', { handle: 'Asynian', password: PASSWORD });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.deepEqual(await s.game('/v1/mod/mute', { target: s.troll.id, minutes: 30 }, back.body.secret).then((x) => [x.status, x.body.error]), [403, 'not-moderator']);
    assert.equal((await s.game('/v1/mod/cases', {}, back.body.secret)).status, 403);
    assert.ok(!(await glyphs(back.body.secret)).includes('mod'), 'no staff glyph on the next token');
    assert.match((await s.command('111111111111111111', 'lookup', { player: 'Troll' })).data.content, /Only the game's moderators/);
    assert.deepEqual((await s.staff('/v1/staff/login', { handle: 'Asynian', password: PASSWORD, ...(await s.asy.key.proof('login', 'Asynian')) })).body, { error: 'staff-login' });
    const team = (await s.staff('/v1/staff/team', {}, s.mob.session)).body.team.find((p) => p.handle === 'Asynian');
    assert.deepEqual([team.role, team.suspended], ['moderator', true]);
    assert.deepEqual((await s.staff('/v1/staff/mod/add', { handle: 'Asynian' }, s.mob.session)).body, { error: 'staff-suspended' });
    // an Admin cut off: no developer either, and no Dev glyph
    assert.ok((await glyphs(s.g.Devvy.secret)).includes('dev'));
    assert.equal((await s.staff('/v1/staff/cut', { handle: 'Devvy' }, s.mob.session)).status, 200);
    const devvy = (await s.game('/v1/auth/login', { handle: 'Devvy', password: PASSWORD })).body.secret;
    assert.equal((await s.game('/v1/mod/cases', {}, devvy)).status, 403);
    assert.ok(!(await glyphs(devvy)).includes('dev'));
    // the title that moderates, cut off: its glyph and its role gone
    assert.ok((await glyphs(s.g.Fang.secret)).includes('shadowfang'));
    assert.equal((await s.staff('/v1/staff/cut', { handle: 'Fang' }, s.mob.session)).status, 200);
    const fang = (await s.game('/v1/auth/login', { handle: 'Fang', password: PASSWORD })).body.secret;
    assert.equal((await s.game('/v1/mod/cases', {}, fang)).status, 403);
    assert.ok(!(await glyphs(fang)).includes('shadowfang'));
    // an owner's invite brings a member back
    const inv = await s.staff('/v1/staff/invite', { handle: 'Asynian' }, s.mob.session);
    assert.deepEqual([inv.status, inv.body.role], [200, 'moderator']);
    assert.equal(s.row(asyId).staff_suspended, 0);
    assert.ok(s.raw.prepare("SELECT 1 FROM staff_audit WHERE act = 'invite' AND target = ? AND detail LIKE '%\"restored\":true%'").get(asyId));
    assert.equal((await s.game('/v1/mod/cases', {}, back.body.secret)).status, 200);
    assert.deepEqual(s.raw.prepare("SELECT act FROM staff_audit WHERE act = 'cut' ORDER BY id").all().map((x) => x.act), ['cut', 'cut', 'cut']);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-CUT-FIX: THE CUT ORDERS EVERY HIDDEN SOCKET CLOSED, ITS PUSH IS IN THE LOG AND IS PUSHED AGAIN - a hide order for each subject a hidden token was minted for, its staff session deleted since or not (finding 28); the relay\'s answer written down, and a cut pressed again on a member already cut pushes every order again (29); every order stamped after the batch, so a token minted while it ran is no newer (31) (mutants: the audit log unread; the outcome unwritten; a second cut refused; the request\'s clock)', async () => {
  const s = await stand();
  const fetch0 = globalThis.fetch;
  const realNow = Date.now;
  try {
    const asyId = s.g.Asynian.id;
    const hiddenSub = async () => {
      const t = await s.game('/v1/auth/token', {}, s.g.Asynian.secret);
      const c = (await verifyToken(t.body.token, s.identityPublic, { subtle, nowS: nowS() })).claims;
      assert.equal(c.hd, 1, 'a hidden token');
      return c.s;
    };
    const ordersOf = async (kind, at = nowS()) => (await Promise.all(s.pushed.map((o) => verifyOrder(o, s.identityPublic, { subtle, nowS: at, kind })))).filter((r) => r.ok).map((r) => r.claims);
    // STAFF-HIDE-TOGGLE (migration 0165): Hide me is off until pressed - pressed, it holds on the account for every session after
    assert.deepEqual((await s.staff('/v1/staff/hide', { on: true }, s.asy.session)).body, { hidden: true });
    // a hidden socket on a session that idled out - its row deleted (openStaff's prune, staffSession's, a new password)
    const gone = await hiddenSub();
    s.raw.prepare('DELETE FROM staff_sessions WHERE player_id = ?').run(asyId);
    const back = await s.staff('/v1/staff/login', { handle: 'Asynian', password: PASSWORD, ...(await s.asy.key.proof('login', 'Asynian')) });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    const live = await hiddenSub();
    assert.notEqual(live, gone, 'a new session, a new subject');
    // the relay busy for the staffcut (its hide orders taken)
    const kindOf = (o) => JSON.parse(Buffer.from(o.split('.')[1], 'base64url').toString()).o;
    globalThis.fetch = async (url, init) => {
      if (String(url) !== RELAY) return fetch0(url, init);
      const { order } = JSON.parse(init.body);
      s.pushed.push(order);
      return kindOf(order) === 'staffcut' ? new Response('busy', { status: 503 }) : Response.json({ ok: true });
    };
    s.pushed.length = 0;
    // the batch commits a few seconds after the request began (a slow database)
    let skew = 0;
    Date.now = () => realNow() + skew;
    const batch = s.env.DB.batch.bind(s.env.DB);
    s.env.DB.batch = async (st) => { const r = await batch(st); skew += 3000; return r; };
    const t0 = nowS();
    const cut = await s.staff('/v1/staff/cut', { handle: 'Asynian' }, s.mob.session);
    s.env.DB.batch = batch;
    assert.deepEqual([cut.status, cut.body], [200, { ok: true, handle: 'Asynian', relay: false }]);
    assert.deepEqual(new Set((await ordersOf('hide', t0 + 3)).map((c) => c.s)), new Set([gone, live]), 'the deleted session\'s subject too');
    const [order] = await ordersOf('staffcut', t0 + 3);
    assert.equal(order.s, asyId);
    assert.ok(order.i >= t0 + 3, 'stamped after the batch');
    assert.ok((await ordersOf('hide', t0 + 3)).every((c) => c.i >= t0 + 3), 'its hide orders too');
    Date.now = realNow;
    const relayRow = () => s.raw.prepare("SELECT outcome, detail FROM staff_audit WHERE act = 'cut-relay' AND target = ? ORDER BY id DESC").get(asyId);
    assert.deepEqual([relayRow().outcome, JSON.parse(relayRow().detail)], ['failed', { orders: 3, took: 2, hidden: 2 }]);
    // pressed again: every order pushed again, the relay taking them now
    globalThis.fetch = fetch0;
    s.pushed.length = 0;
    const again = await s.staff('/v1/staff/cut', { handle: 'Asynian' }, s.mob.session);
    assert.deepEqual([again.status, again.body], [200, { ok: true, handle: 'Asynian', relay: true }]);
    assert.deepEqual(new Set((await ordersOf('hide')).map((c) => c.s)), new Set([gone, live]));
    assert.equal((await ordersOf('staffcut'))[0]?.s, asyId);
    assert.deepEqual([relayRow().outcome, JSON.parse(relayRow().detail)], ['ok', { orders: 3, took: 3, hidden: 2 }]);
    assert.ok(s.raw.prepare("SELECT 1 FROM staff_audit WHERE act = 'cut' AND target = ? AND detail LIKE '%\"again\":true%'").get(asyId), 'the second cut written as one');
    assert.equal(s.row(asyId).staff_suspended, 1);
    // nobody else's: a player never staff is still no staff to cut
    assert.deepEqual((await s.staff('/v1/staff/cut', { handle: 'Troll' }, s.mob.session)).body, { error: 'no-staff' });
  } finally { Date.now = realNow; globalThis.fetch = fetch0; s.restore(); }
});

test('STAFF-PANEL2-FIX 8: A NEW PASSWORD ENDS THE STAFF PANEL\'S SESSIONS - changed from the game, or recovered with a code (mutants: each closeStaffSessions)', async () => {
  const s = await stand();
  try {
    assert.equal((await s.staff('/v1/staff/me', {}, s.tab.session)).status, 200);
    const changed = await s.game('/v1/account/password', { oldPassword: PASSWORD, password: 'another good long one' }, s.g.Tabbyvish.secret);
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal((await s.staff('/v1/staff/me', {}, s.tab.session)).status, 401);
    assert.equal((await s.staff('/v1/staff/me', {}, s.asy.session)).status, 200, 'another member\'s untouched');
    // recovered: a code from registering
    const g = await s.guest();
    s.env.MODERATOR_HANDLES += ',Ravenna';
    const reg = await s.game('/v1/auth/register', { handle: 'Ravenna', password: PASSWORD, ...ACCEPTED, set: true }, g.secret);
    const code = reg.body.recoveryCodes?.[0] ?? reg.body.recoveryCode;
    assert.ok(code, `registering answers a recovery code: ${JSON.stringify(reg)}`);
    const inv = await s.staff('/v1/staff/invite', { handle: 'Ravenna' }, s.mob.session);
    const key = await extensionKey();
    const raven = (await s.staff('/v1/staff/enroll', { handle: 'Ravenna', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Ravenna')) })).body;
    assert.equal((await s.staff('/v1/staff/me', {}, raven.session)).status, 200);
    const rec = await s.game('/v1/auth/recover', { handle: 'Ravenna', code, password: 'a third good long one' });
    assert.equal(rec.status, 200, JSON.stringify(rec.body));
    assert.equal((await s.staff('/v1/staff/me', {}, raven.session)).status, 401);
  } finally { s.restore(); }
});

// ═══ THE FLAW REVIEW OF PR 1 (findings 1-3, area "cases"): the take a lease, one press one strike, the act's audit row ═══

/** A database that throws on each statement `re` matches, every other as it is - a D1 error mid-act, run alone or in a
 *  batch (which the fake rolls back whole, as D1 does). */
const flakyCtx = (s, re) => {
  const fail = () => { throw new Error('D1_ERROR: overloaded'); };
  const bad = { bind: () => bad, run: async () => fail(), first: async () => fail(), all: async () => fail(), _result: fail };
  return { ...s.ctx(), db: new Proxy(s.env.DB, { get: (t, k) => (k === 'prepare' ? (sql) => (re.test(sql) ? bad : t.prepare(sql))
    : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
};

test('STAFF-PANEL2-FIX review 1: A THROW MID-ACT GIVES THE CASE BACK, and the take is a lease - a D1 error after the take leaves the case to the next act; a take older than CASE_ACT_S is any press\'s, a fresh one nobody else\'s (mutants: no give-back on a throw; the lease never lapsing; the lease lapsing at once; a throw unwritten)', async () => {
  const s = await stand();
  try {
    const tab = s.row(s.g.Tabbyvish.id);
    const t = await s.player();
    const c = s.caseOn(t);
    await assert.rejects(modAct(flakyCtx(s, /UPDATE players SET muted_until/), tab, s.env, { act: 'mute', target: t.id, minutes: 30, from: 'in the game' }), /overloaded/);
    assert.deepEqual([s.caseRow(c).status, s.caseRow(c).act_click], ['open', null], 'the case given back');
    assert.deepEqual({ ...s.raw.prepare("SELECT outcome, detail FROM staff_audit WHERE act = 'mute' AND target = ?").get(t.id) },
      { outcome: 'failed', detail: JSON.stringify({ name: t.handle, door: 'in the game', minutes: 30, case: c, error: 'D1_ERROR: overloaded' }) }, 'the throw written down');
    const next = await s.game('/v1/mod/mute', { target: t.id, minutes: 30 }, s.g.Tabbyvish.secret);
    assert.deepEqual([next.status, next.body.case, s.caseRow(c).status], [200, c, 'actioned'], 'the next act, naming no case, takes it');
    assert.equal(s.strikes(t.id), 1);
    // a take inside its lease holds the case; past it, any press takes it
    const v = await s.player();
    const cv = s.caseOn(v);
    s.raw.prepare('UPDATE mod_cases SET act_click = ?, act_at = ? WHERE id = ?').run('dead-press-1', nowS() - 5, cv);
    assert.deepEqual(await s.game('/v1/mod/mute', { target: v.id, minutes: 30 }, s.g.Tabbyvish.secret).then((r) => [r.status, r.body.error]), [409, 'case-acted']);
    s.raw.prepare('UPDATE mod_cases SET act_at = ? WHERE id = ?').run(nowS() - CASE_ACT_S - 1, cv);
    const late = await s.game('/v1/mod/mute', { target: v.id, minutes: 30 }, s.g.Tabbyvish.secret);
    assert.deepEqual([late.status, late.body.case, s.caseRow(cv).status], [200, cv, 'actioned'], 'a stale take is any press\'s');
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX review 2: THE SAME PRESS SENT TWICE AT ONCE, with no case to take, strikes once - the second answered as the first, a mute and a ban alike (mutants: the click index not UNIQUE; the refused record not read as the first)', async () => {
  const s = await stand();
  try {
    const tab = s.row(s.g.Tabbyvish.id);
    const t = await s.player();
    const ask = { act: 'mute', target: t.id, minutes: 30, click: 'click-abcdef12', from: 'staff panel' };
    const both = await Promise.all([modAct(s.ctx(), tab, s.env, ask), modAct(s.ctx(), tab, s.env, ask)]);
    assert.deepEqual(both.map((r) => r.ok), [true, true]);
    assert.deepEqual(both.map((r) => !!r.repeat).sort(), [false, true], 'one the act, one the repeat');
    assert.equal(s.strikes(t.id), 1);
    const ban = { act: 'ban', target: t.id, days: 1, click: 'click-abcdef13', from: 'staff panel' };
    const bans = await Promise.all([modAct(s.ctx(), tab, s.env, ban), modAct(s.ctx(), tab, s.env, ban)]);
    assert.deepEqual(bans.map((r) => !!r.repeat).sort(), [false, true]);
    assert.equal(s.strikes(t.id), 2);
    assert.deepEqual(s.raw.prepare("SELECT outcome, detail FROM staff_audit WHERE act IN ('mute', 'ban') AND target = ? ORDER BY id").all(t.id).map((r) => [r.outcome, /"repeat":true/.test(r.detail)]).sort(),
      [['ok', false], ['ok', false], ['ok', true], ['ok', true]], 'each press written once, the repeat as one');
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX review 3: EVERY DOOR\'S ACT IS IN THE AUDIT LOG, written once in the shared act - the game\'s, Discord\'s and the panel\'s, ok, denied or failed, the door named, and the owners read it; a knock by one who is no moderator writes nothing (mutants: the doors\' row unwritten; the door unnamed at each door; a denial written as failed; the panel\'s writer not handed in)', async () => {
  const s = await stand();
  try {
    const rows = (act, target) => s.raw.prepare('SELECT actor, role, outcome, detail, key_id FROM staff_audit WHERE act = ? AND target IS ? ORDER BY id').all(act, target)
      .map((r) => ({ ...r, detail: JSON.parse(r.detail) }));
    const tabId = s.g.Tabbyvish.id;
    // the game's: a mute that closes the case, an Admin's ban, a Moderator's unban of it refused
    const a = await s.player();
    const ca = s.caseOn(a);
    assert.equal((await s.game('/v1/mod/mute', { target: a.id, minutes: 30 }, s.g.Tabbyvish.secret)).status, 200);
    assert.deepEqual(rows('mute', a.id), [{ actor: tabId, role: 'moderator', outcome: 'ok', key_id: null, detail: { name: a.handle, door: 'in the game', minutes: 30, case: ca } }]);
    assert.equal((await s.game('/v1/mod/ban', { target: a.id, days: 7, reason: 'slurs' }, s.g.SirMcMobdon.secret)).status, 200);
    assert.deepEqual(rows('ban', a.id).map((r) => [r.role, r.outcome, r.detail]), [['admin', 'ok', { name: a.handle, door: 'in the game', days: 7, reason: 'slurs' }]]);
    assert.equal((await s.game('/v1/mod/unban', { target: a.id }, s.g.Tabbyvish.secret)).status, 403);
    assert.deepEqual(rows('unban', a.id).map((r) => [r.outcome, r.detail.door, r.detail.error]), [['denied', 'in the game', 'admin-sanction']]);
    // Discord's: a press, and /mod refused on a case another member holds, then a ban and its unban
    const b = await s.player();
    const cb = s.caseOn(b);
    assert.equal((await s.press('222222222222222222', `safe:dis:${cb}`, 'discord-0000000009')).type, 7);
    assert.deepEqual(rows('dismiss', b.id).map((r) => [r.actor, r.outcome, r.detail.door, r.detail.case]), [[tabId, 'ok', 'Discord', cb]]);
    const c = await s.player();
    s.caseOn(c);
    assert.equal((await s.staff('/v1/staff/claim', { target: c.id }, s.asy.session)).status, 200);
    assert.match((await s.command('222222222222222222', 'mute', { player: c.id, minutes: 30 })).data.content, /Another staff member/);
    assert.deepEqual(rows('mute', c.id).map((r) => [r.outcome, r.detail.door, r.detail.error]), [['denied', 'Discord', 'staff-claimed']]);
    assert.equal((await s.game('/v1/mod/dismiss', { target: c.id }, s.g.Asynian.secret)).status, 200, 'the holder, from the game');
    assert.deepEqual(rows('dismiss', c.id).map((r) => [r.outcome, r.detail.door]), [['ok', 'in the game']]);
    const f = await s.player();
    const spawn = await openCaseFor(s.ctx(), s.env, f.id, 'review', 'spawn');
    assert.match((await s.press('222222222222222222', `safe:dis:${spawn}`)).data.content, /Only an Admin/);
    assert.deepEqual(rows('dismiss', f.id).map((r) => [r.outcome, r.detail.door, r.detail.error]), [['denied', 'Discord', 'not-developer']], 'a spawn case, a Moderator\'s press');
    const d = await s.player();
    assert.match((await s.command('222222222222222222', 'ban', { player: d.id, days: 1 })).data.content, /is banned/);
    assert.match((await s.command('222222222222222222', 'unban', { player: d.id })).data.content, /is unbanned/);
    assert.deepEqual([...rows('ban', d.id), ...rows('unban', d.id)].map((r) => [r.outcome, r.detail.door]), [['ok', 'Discord'], ['ok', 'Discord']]);
    // the panel's: one row an act, its own - its session's key beside it
    const e = await s.player();
    assert.equal((await s.staff('/v1/staff/mute', { target: e.id, minutes: 30, click: 'press-v001' }, s.asy.session)).status, 200);
    assert.deepEqual(rows('mute', e.id).map((r) => [r.outcome, r.detail.door, typeof r.key_id]), [['ok', 'staff panel', 'string']], 'one row, the panel\'s own');
    // one who is no moderator, knocking at the game's door, writes nothing
    assert.equal((await s.game('/v1/mod/mute', { target: e.id, minutes: 30 }, s.troll.secret)).status, 403);
    assert.equal(rows('mute', e.id).length, 1);
    // the owners read the game's and Discord's acts in their log
    const log = (await s.staff('/v1/staff/audit', { target: b.id }, s.mob.session)).body.rows;
    assert.deepEqual(log.map((r) => [r.act, r.actorName, r.detail.door]), [['dismiss', 'Tabbyvish', 'Discord']]);
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX review 4: THE ACT, ITS STRIKE AND ITS CASE\'S CLOSE ARE ONE BATCH - the close failing leaves neither the sanction nor its strike, for a mute, a button\'s mute that keeps a longer one, a ban and a dismiss; the case given back, and the next act strikes once (mutants: each written apart from its close)', async () => {
  const s = await stand();
  try {
    const tab = s.row(s.g.Tabbyvish.id);
    const closeFails = () => flakyCtx(s, /UPDATE mod_cases SET status/);
    const acts = (id) => s.raw.prepare('SELECT COUNT(*) AS n FROM mod_actions WHERE target = ?').get(id).n;
    let n = 0;
    // the close failing, and the record failing (a dismiss writes its close first)
    for (const [fails, failing] of [[closeFails, 'the close'], [() => flakyCtx(s, /INSERT INTO mod_actions/), 'the record']]) {
      for (const [ask, look] of [
        [{ act: 'mute', minutes: 30 }, (id) => s.row(id).muted_until],
        [{ act: 'ban', days: 7 }, (id) => s.row(id).banned_until],
        [{ act: 'dismiss' }, () => null],
      ]) {
        const t = await s.player();
        const c = s.caseOn(t);
        const press = { ...ask, target: t.id, click: `press-b${String(++n).padStart(5, '0')}`, from: 'in the game' };
        await assert.rejects(modAct(fails(), tab, s.env, press), /overloaded/, ask.act);
        assert.deepEqual([look(t.id), acts(t.id), s.caseRow(c).status, s.caseRow(c).act_click], [null, 0, 'open', null], `${ask.act}, ${failing} failing: neither landed, the case given back`);
        const again = await modAct(s.ctx(), tab, s.env, press);
        assert.deepEqual([again.ok, again.repeat, again.case, s.caseRow(c).status !== 'open', acts(t.id)], [true, undefined, c, true, 1], `${ask.act}: the same press, acted once`);
      }
    }
    // a button's mute while a longer one stands: its record and the close, one batch
    const k = await s.player();
    const ck = s.caseOn(k);
    s.raw.prepare('UPDATE players SET muted_until = ?, muted_by = ? WHERE id = ?').run(nowS() + 86400, s.g.Asynian.id, k.id);
    await assert.rejects(modAct(closeFails(), tab, s.env, { act: 'mute', target: k.id, minutes: 30, caseId: ck, keepLonger: true, from: 'Discord' }), /overloaded/);
    assert.deepEqual([acts(k.id), s.caseRow(ck).status], [0, 'open']);
    const kept = await modAct(s.ctx(), tab, s.env, { act: 'mute', target: k.id, minutes: 30, caseId: ck, keepLonger: true, from: 'Discord' });
    assert.deepEqual([kept.kept, acts(k.id), s.caseRow(ck).status], [true, 1, 'actioned']);
  } finally { s.restore(); }
});

test('STAFF-PANEL2-FIX review 5: THE SANCTIONS KEEP THEIR OWN ROLE CHECK - modAct asks first, but the ban and the unban still refuse one who is no moderator, called straight (mutants: AUDIT-SAFE-DOC2-anyone-unbans; the ban unguarded)', async () => {
  const s = await stand();
  try {
    const t = await s.player();
    assert.equal((await s.game('/v1/mod/ban', { target: t.id, days: 7 }, s.g.Tabbyvish.secret)).status, 200);
    const until = s.row(t.id).banned_until;
    const nobody = s.row(s.sylvia.id);
    assert.deepEqual(await unbanAccount(s.ctx(), nobody, s.env, { target: t.id }), { error: 'not-moderator' });
    assert.deepEqual(await banAccount(s.ctx(), nobody, s.env, { target: s.troll.id, days: 7 }), { error: 'not-moderator' });
    assert.deepEqual([s.row(t.id).banned_until, s.row(s.troll.id).banned_until], [until, null]);
  } finally { s.restore(); }
});
