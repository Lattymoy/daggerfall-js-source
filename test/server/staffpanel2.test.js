// STAFF-PANEL2 (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 2) - THE PANEL'S REPORTS
// (server-account/src/staffCases.js), driven through the real Worker on the node:sqlite database every account pin
// stands on (test/accountDb.mjs): the open cases most urgent first and paged, a case read with its lines and record, a
// claim (a Moderator one at a time, an Admin any), and Mute, Ban, Unban and Dismiss made as the game's moderators' acts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { caseUrgency, CLAIM_S, CASES_PAGE, AI_WAIT_S, STALE_S, CASE_ROUTES } from '../../server-account/src/staffCases.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { discordInteraction } from '../../server-account/src/discord.js';
import { mintStamp } from '../../src/net/safety/chatStamp.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { LADDER_BAN_AT } from '../../src/net/safety/safetyLaw.js';
import { SPROUT_S } from '../../server-account/src/titles.js';

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

/** The Worker with the panel set up, the relay's door recorded: mob (an Admin and owner) signed in, Asynian (a Moderator)
 *  invited and signed in, and Troll and Sylvia, two players. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY, DISCORD_MODERATORS: '111111111111111111:Asynian,222222222222222222:Tabbyvish',
  });
  const pushed = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url) === RELAY) { pushed.push(JSON.parse(init.body).order); return Response.json({ ok: true }); } return real(url, init); };
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian', 'Tabbyvish']) await s.registered(h);
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
    return r.body;
  };
  const asy = await enrol('Asynian');
  const tab = await enrol('Tabbyvish');
  const idOf = (h) => raw.prepare('SELECT id FROM players WHERE handle = ?').get(h).id;
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
  /** A player made just to be reported. */
  let m = 0;
  const player = async () => s.registered(`Target${++m}`);
  return { ...s, raw, staff, mob, asy, tab, troll, sylvia, idOf, caseOn, player, pushed, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL2: the reports\' doors are listed among the staff panel\'s, and none opens without a staff session', async () => {
  for (const r of CASE_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  const s = await stand();
  try {
    for (const r of CASE_ROUTES) {
      const res = await s.staff(r, { target: s.troll.id });
      assert.deepEqual([res.status, res.body], [401, { error: 'staff-session' }], r);
      assert.equal((await s.staff(r, { target: s.troll.id }, s.troll.secret)).status, 401, `${r}: a game secret is no staff session`);
    }
  } finally { s.restore(); }
});

test('STAFF-PANEL2: WHAT GOES FIRST - a case\'s level and the words that say why, as the design doc ranks them (mutants: each rule dropped)', () => {
  const t = 1_000_000;
  const c = (cols = {}) => ({ reports: 1, ai_state: 'off', discord_state: 'off', updated_at: t, ...cols });
  const one = [{ reason: 'spam', counted: 1, at: t }];
  const lv = (cols, reports = one, strikes = 0) => caseUrgency(c(cols), { reports, strikes, nowS: t }).level;
  // high
  assert.equal(lv({ ai_state: 'done', ai_category: 'harassment', ai_severity: 3 }), 'high', 'severity 3');
  assert.equal(lv({ ai_state: 'done', ai_category: 'threat', ai_severity: 2 }), 'high', 'a threat at 2');
  assert.equal(lv({ ai_state: 'done', ai_category: 'personal-info', ai_severity: 2 }), 'high', 'personal details at 2');
  assert.equal(lv({ ai_state: 'failed' }), 'high', 'a read that failed');
  assert.equal(lv({ auto: 'reports' }), 'high', 'an automatic mute nobody checked');
  const wave = [0, 1000, 3000].map((d) => ({ reason: 'spam', counted: 1, at: t - d }));
  assert.equal(lv({ reports: 3 }, wave), 'high', 'three who count within an hour');
  assert.equal(lv({ reports: 3 }, [0, 2000, 4000].map((d) => ({ reason: 'spam', counted: 1, at: t - d }))), 'medium', 'three across more than an hour');
  assert.equal(lv({}, one, LADDER_BAN_AT), 'high', 'next strike a ban');
  // medium
  assert.equal(lv({ ai_state: 'done', ai_category: 'harassment', ai_severity: 2 }), 'medium', 'severity 2');
  assert.equal(lv({ reports: 2 }, [{ reason: 'spam', counted: 1, at: t }, { reason: 'spam', counted: 0, at: t }]), 'medium', 'two reporters');
  assert.equal(lv({ ai_state: 'due', updated_at: t - AI_WAIT_S }), 'medium', 'a read waiting ten minutes');
  assert.equal(lv({ ai_state: 'reading', updated_at: t - AI_WAIT_S + 1 }), 'low', 'not yet ten');
  assert.equal(lv({ discord_state: 'failed' }), 'medium', 'a card nobody saw');
  assert.equal(lv({}, one, 1), 'medium', 'a strike in 90 days');
  // low
  assert.equal(lv({ ai_state: 'done', ai_category: 'harassment', ai_severity: 1 }), 'low', 'severity 1');
  assert.equal(lv({}), 'low', 'one reporter');
  const guests = [{ reason: 'harassment', counted: 0, at: t }, { reason: 'harassment', counted: 0, at: t }];
  assert.equal(lv({ reports: 2 }, guests), 'medium', 'two reporters saying harassment: the reason stands in before a read');
  assert.equal(lv({ reports: 2 }, guests.map((r) => ({ ...r, reason: 'spam' }))), 'low', 'reporters all guests or new');
  assert.match(caseUrgency(c({ reports: 2 }), { reports: guests, strikes: 0, nowS: t }).why.join(' · '), /reporters all guests or new/);
  // before the reviewer reads it, the reporters' reason stands in
  assert.equal(lv({}, [{ reason: 'threat', counted: 0, at: t }]), 'medium', 'STAFF-PANEL2-FIX: one reporter\'s own threat is medium at most');
  assert.equal(lv({ reports: 2 }, [{ reason: 'threat', counted: 0, at: t }, { reason: 'threat', counted: 0, at: t }]), 'high', 'two who say threat');
  assert.equal(lv({}, [{ reason: 'hate', counted: 0, at: t }]), 'medium');
  assert.equal(lv({}, [{ reason: 'sexual', counted: 0, at: t }]), 'medium');
  assert.equal(lv({}, [{ reason: 'harassment', counted: 1, at: t }]), 'low', 'harassment from one');
  assert.equal(lv({ ai_state: 'done', ai_category: 'spam', ai_severity: 1 }, [{ reason: 'threat', counted: 1, at: t }]), 'low', 'the reviewer\'s word over the reporter\'s');
  // a day untouched goes up one level, never past high
  assert.equal(lv({ updated_at: t - STALE_S }), 'medium');
  assert.equal(lv({ updated_at: t - STALE_S, ai_state: 'failed' }), 'high');
  // the words
  assert.deepEqual(caseUrgency(c({ reports: 4, ai_state: 'done', ai_category: 'harassment', ai_severity: 3 }), { reports: [], strikes: 1, nowS: t }).why,
    ['4 reporters', 'AI check: harassment, high', '1 strike']);
});

test('STAFF-PANEL2: THE LIST - most urgent first for an Admin and a Moderator alike, a claimed case below the rest of its level, newest first on the switch, paged, and the read written down once in ten minutes', async () => {
  const s = await stand();
  try {
    const low = s.caseOn(await s.player());
    const high = s.caseOn(await s.player(), { ai_state: 'done', ai_category: 'hate', ai_severity: 3 });
    const med = s.caseOn(await s.player(), { ai_state: 'done', ai_category: 'harassment', ai_severity: 2 });
    const heldOn = await s.player();
    const highHeld = s.caseOn(heldOn, { ai_state: 'failed' });
    assert.equal((await s.staff('/v1/staff/claim', { target: heldOn.id }, s.tab.session)).status, 200);   // STAFF-PANEL2-FIX: a claim is its session's
    for (const who of [s.mob, s.asy]) {
      const r = await s.staff('/v1/staff/cases', {}, who.session);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.cases.map((c) => c.id), [high, highHeld, med, low]);
      assert.deepEqual(r.body.cases.map((c) => c.level), ['high', 'high', 'medium', 'low']);
      assert.deepEqual(r.body.cases[1].claim, { by: s.idOf('Tabbyvish'), name: 'Tabbyvish', until: r.body.cases[1].claim.until, mine: false, idle: false });
      assert.equal(r.body.next, null);
    }
    const newest = await s.staff('/v1/staff/cases', { sort: 'newest' }, s.asy.session);
    assert.deepEqual(newest.body.cases.map((c) => c.id), [low, high, med, highHeld], 'opened_at order, newest first');
    for (let i = 0; i < CASES_PAGE; i++) s.caseOn(await s.player());
    const p1 = await s.staff('/v1/staff/cases', {}, s.asy.session);
    assert.equal(p1.body.cases.length, CASES_PAGE);
    assert.equal(p1.body.next, CASES_PAGE);
    assert.equal(p1.body.total, CASES_PAGE + 4);
    const p2 = await s.staff('/v1/staff/cases', { from: p1.body.next }, s.asy.session);
    assert.equal(p2.body.cases.length, 4);
    assert.equal(p2.body.next, null);
    assert.equal(new Set([...p1.body.cases, ...p2.body.cases].map((c) => c.id)).size, CASES_PAGE + 4, 'every case once across the pages');
    const reads = s.raw.prepare("SELECT actor_name, role FROM staff_audit WHERE act = 'cases-read' ORDER BY id").all().map((r) => `${r.actor_name}:${r.role}`);
    assert.deepEqual(reads, ['SirMcMobdon:admin', 'Asynian:moderator', 'Asynian:moderator'], 'once a member and a view in ten minutes: urgent, then newest');
  } finally { s.restore(); }
});

test('STAFF-PANEL2: A CLAIM - a Moderator holds one case at a time, an Admin takes any (the Moderator told), the holder\'s look keeps it, it lets go by itself, and nobody else acts on it meanwhile, from the panel or from Discord (mutants: the one-case check; the held check; claim_from)', async () => {
  const s = await stand();
  try {
    const a = await s.player();
    const b = await s.player();
    const ca = s.caseOn(a);
    const cb = s.caseOn(b);
    const take = await s.staff('/v1/staff/claim', { target: a.id }, s.asy.session);
    assert.equal(take.status, 200, JSON.stringify(take.body));
    assert.equal(take.body.until, s.raw.prepare('SELECT claim_until FROM mod_cases WHERE id = ?').get(ca).claim_until);
    assert.deepEqual((await s.staff('/v1/staff/claim', { target: b.id }, s.asy.session)).body, { error: 'staff-one-case' }, 'a Moderator\'s second case');
    assert.deepEqual((await s.staff('/v1/staff/claim', { target: a.id }, s.tab.session)).body, { error: 'staff-claimed' }, 'another Moderator');
    assert.deepEqual((await s.staff('/v1/staff/mute', { target: a.id, minutes: 30, click: 'press-0001' }, s.tab.session)).body, { error: 'staff-claimed' });
    assert.deepEqual((await s.staff('/v1/staff/dismiss', { target: a.id }, s.mob.session)).body, { error: 'staff-claimed' }, 'an Admin takes it first');
    assert.equal(s.raw.prepare('SELECT muted_until FROM players WHERE id = ?').get(a.id).muted_until, null);
    // Discord: the panel's claim of another member stands; the holder's own press goes through
    const ctx = { db: s.env.DB, nowS: nowS(), subtle, rand: (b8) => globalThis.crypto.getRandomValues(b8) };
    const press = (user) => ({ type: 3, member: { user: { id: user } }, data: { custom_id: `safe:m30:${ca}` } });
    const no = await discordInteraction(ctx, s.env, press('222222222222222222'));
    assert.match(no.data.content, /Another staff member has this case in the staff panel/);
    assert.equal(s.raw.prepare('SELECT status FROM mod_cases WHERE id = ?').get(ca).status, 'open');
    // an Admin takes it from the Moderator, who is told
    assert.equal((await s.staff('/v1/staff/claim', { target: a.id }, s.mob.session)).status, 200);
    const told = await s.staff('/v1/staff/cases', {}, s.asy.session);
    assert.deepEqual(told.body.lost, [{ id: ca, target: a.id, name: a.handle, by: 'SirMcMobdon' }]);
    assert.ok(s.raw.prepare("SELECT 1 FROM staff_audit WHERE act = 'case-claim' AND detail LIKE ?").get(`%"from":"${s.idOf('Asynian')}"%`), 'the take written down');
    // the Moderator is free to take another now
    assert.equal((await s.staff('/v1/staff/claim', { target: b.id }, s.asy.session)).status, 200);
    // released, and let go by itself
    assert.deepEqual((await s.staff('/v1/staff/release', { target: a.id }, s.asy.session)).body, { error: 'no-case' }, 'not theirs to release');
    assert.equal((await s.staff('/v1/staff/release', { target: a.id }, s.mob.session)).status, 200);
    assert.equal(s.raw.prepare('SELECT claimed_by FROM mod_cases WHERE id = ?').get(ca).claimed_by, null);
    s.raw.prepare('UPDATE mod_cases SET claim_until = ? WHERE id = ?').run(nowS(), cb);
    assert.equal((await s.staff('/v1/staff/claim', { target: b.id }, s.tab.session)).status, 200, 'a claim past its time is anyone\'s');
    // the holder's look keeps it
    s.raw.prepare('UPDATE mod_cases SET claim_until = ? WHERE id = ?').run(nowS() + 5, cb);
    assert.equal((await s.staff('/v1/staff/case', { target: b.id }, s.tab.session)).status, 200);
    assert.ok(s.raw.prepare('SELECT claim_until FROM mod_cases WHERE id = ?').get(cb).claim_until >= nowS() + CLAIM_S - 2);
    assert.deepEqual((await s.staff('/v1/staff/claim', { target: s.troll.id }, s.tab.session)).body, { error: 'no-case' }, 'no open case on that account');
  } finally { s.restore(); }
});

test('STAFF-PANEL2: THE ACTS are the game\'s moderators\' own - the strike history, the case closed, the order at the relay\'s door - made from the panel and written down (mutants: no order pushed; the case left open; the panel not named)', async () => {
  const s = await stand();
  try {
    // a real report, so the case has the lines a moderator reads
    const line = { tab: 'world', sub: s.troll.id, name: 'Troll', at: Date.now(), text: 'quit the game, nobody likes you' };
    const filed = await s.call('/v1/safety/report', { target: s.troll.id, reason: 'harassment', lines: [{ ...line, sg: await mintStamp(line, s.gatePriv, { subtle }) }] }, s.sylvia.secret);
    assert.equal(filed.status, 200, JSON.stringify(filed.body));
    const read = await s.staff('/v1/staff/case', { target: s.troll.id }, s.asy.session);
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.deepEqual(read.body.case.lines.map((l) => l.text), ['quit the game, nobody likes you']);
    assert.equal(read.body.record.strikes, 0);
    assert.equal(read.body.claim, null);
    const mute = await s.staff('/v1/staff/mute', { target: s.troll.id, minutes: 30, click: 'press-0002' }, s.asy.session);
    assert.equal(mute.status, 200, JSON.stringify(mute.body));
    assert.ok(s.raw.prepare('SELECT muted_until FROM players WHERE id = ?').get(s.troll.id).muted_until > nowS() + 1700);
    assert.deepEqual({ ...s.raw.prepare('SELECT kind, actor, actor_name FROM mod_actions WHERE target = ?').get(s.troll.id) }, { kind: 'mute', actor: s.idOf('Asynian'), actor_name: 'Asynian (staff panel)' });
    assert.deepEqual({ ...s.raw.prepare('SELECT status, resolved_by FROM mod_cases WHERE id = ?').get(filed.body.case) }, { status: 'actioned', resolved_by: 'Asynian' });
    assert.equal(s.pushed.length, 1, 'the order at the relay\'s door');
    assert.deepEqual({ ...s.raw.prepare("SELECT role, act, target, outcome FROM staff_audit WHERE act = 'mute'").get() }, { role: 'moderator', act: 'mute', target: s.troll.id, outcome: 'ok' });
    // a ban, an unban, by name
    const ban = await s.staff('/v1/staff/ban', { name: 'troll', days: 7, reason: 'slurs', click: 'press-0003' }, s.asy.session);
    assert.equal(ban.status, 200, JSON.stringify(ban.body));
    assert.equal(ban.body.order, undefined);
    assert.ok(s.raw.prepare('SELECT banned_until FROM players WHERE id = ?').get(s.troll.id).banned_until > nowS() + 6 * 86400);
    assert.equal((await s.staff('/v1/staff/strikes', { target: s.troll.id }, s.asy.session)).body.record.strikes, 2);
    assert.equal((await s.staff('/v1/staff/unban', { target: s.troll.id }, s.mob.session)).status, 200);
    assert.deepEqual((await s.staff('/v1/staff/unban', { target: s.troll.id }, s.mob.session)).body, { error: 'not-banned' });
    assert.equal(s.pushed.length, 3);
    // dismiss closes a case, with no strike
    const other = await s.player();
    const c = s.caseOn(other);
    assert.equal((await s.staff('/v1/staff/dismiss', { target: other.id }, s.asy.session)).status, 200);
    assert.equal(s.raw.prepare('SELECT status FROM mod_cases WHERE id = ?').get(c).status, 'dismissed');
    // refused as the game refuses, and written down as failed
    const prot = await s.staff('/v1/staff/mute', { target: s.idOf('Tabbyvish'), minutes: 30, click: 'press-0004' }, s.mob.session);
    assert.deepEqual([prot.status, prot.body], [403, { error: 'protected' }], 'a moderator is never muted');
    assert.equal((await s.staff('/v1/staff/mute', { target: s.troll.id, minutes: 99999999, click: 'press-0005' }, s.asy.session)).status, 400);
    assert.equal((await s.staff('/v1/staff/ban', { target: s.troll.id, days: -1, click: 'press-0006' }, s.asy.session)).status, 400);
    assert.equal((await s.staff('/v1/staff/mute', { name: 'nobody-here', minutes: 30, click: 'press-0007' }, s.asy.session)).status, 404);
    assert.deepEqual({ ...s.raw.prepare("SELECT outcome, detail FROM staff_audit WHERE act = 'mute' AND target = ?").get(s.idOf('Tabbyvish')) },
      { outcome: 'failed', detail: JSON.stringify({ name: 'Tabbyvish', door: 'staff panel', minutes: 30, error: 'protected' }) });   // STAFF-PANEL2-FIX: modAct writes it, the door named
  } finally { s.restore(); }
});
