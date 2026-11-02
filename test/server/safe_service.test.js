// SAFE1, SAFE3, SAFE4, SAFE7 (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md): THE ACCOUNT SERVICE'S HALF, driven
// end to end through the real Worker over a real schema - a block list, a report whose every line's stamp is the relay's
// own signature (checked with GATE_PUBLIC_KEY, as the service checks it), the case it opens, the automatic mute three
// credible reporters reach and a guest's reports never do, the ban a banned account meets on every door, the record of
// every act, the strikes and the ladder, and the code of conduct the token's mint says back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { mintStamp } from '../../src/net/safety/chatStamp.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { CONDUCT_VERSION } from '../../src/net/safety/conduct.js';
import { BLOCKS_MAX, BAN_FOREVER } from '../../src/net/safety/safetyLaw.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { ROUTES, OPEN_ROUTES, SAFE_OPEN_ROUTES } from '../../server-account/src/service.js';
import { REPORT_AUTO_MUTE } from '../../server-account/src/safety.js';
import { SPROUT_S } from '../../server-account/src/titles.js';

const subtle = globalThis.crypto.subtle;
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;

/** The service, with a moderator handle and the relay's door; the relay's door's posts recorded. */
async function stand(extra = {}) {
  const s = await standService({ MODERATOR_HANDLES: 'Asynian', RELAY_LAW_URL: RELAY, ...extra });
  const pushed = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url) === RELAY) { pushed.push(JSON.parse(init.body).order); return new Response('{"ok":true}'); } return real(url, init); };
  return { ...s, pushed, restore: () => { globalThis.fetch = real; } };
}
/** A line as a hearer received it, stamped by the relay's own key. */
async function heard(s, who, text, { tab = 'world', at = Date.now() } = {}) {
  const line = { tab, sub: who.id, name: who.handle ?? 'Guest', at, text };
  return { ...line, sg: await mintStamp(line, s.gatePriv, { subtle }) };
}
/** An account made old enough to count (no sprout). */
const season = (s, who) => s.env.DB._raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - SPROUT_S - 60, who.id);

test('SAFE1-SAFE8 THE ROUTES ARE LISTED: every safety door is in ROUTES (a path that is not is a 404 - AUDIT FIVE-ASKS A1), the session ones behind a session, the relay\'s feed and Discord\'s interactions among the self-proving doors alone (mutant: a route unlisted)', () => {
  for (const p of ['/v1/safety/blocks', '/v1/safety/block', '/v1/safety/unblock', '/v1/safety/report', '/v1/safety/conduct', '/v1/mod/ban', '/v1/mod/unban', '/v1/mod/strikes', '/v1/mod/feed', '/v1/discord/interactions']) {
    assert.ok(ROUTES.has(p), p);
    assert.equal(OPEN_ROUTES.has(p), false, `${p} is no stranger's JSON door`);
  }
  assert.deepEqual([...SAFE_OPEN_ROUTES], ['/v1/mod/feed', '/v1/discord/interactions']);
});

test('SAFE1 THE BLOCK LIST follows the account: a block is kept with the name a player reads, listed newest first, undone by an unblock; never oneself, never an account that is not, never past BLOCKS_MAX (mutants: a self-block taken; the bound unchecked)', async () => {
  const s = await stand();
  try {
    const me = await s.registered('Sylvia');
    const troll = await s.registered('Troll');
    const other = await s.guest();
    assert.deepEqual((await s.call('/v1/safety/blocks', {}, me.secret)).body, { ok: true, blocks: [] });
    const r = await s.call('/v1/safety/block', { target: troll.id }, me.secret);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.blocks.map((b) => [b.sub, b.name]), [[troll.id, 'Troll']]);
    assert.deepEqual((await s.call('/v1/safety/block', { target: troll.id }, me.secret)).body.blocks.length, 1, 'blocked twice is blocked once');
    assert.equal((await s.call('/v1/safety/block', { target: me.id }, me.secret)).body.error, 'block-self');
    assert.equal((await s.call('/v1/safety/block', { target: 'p_nobody01' }, me.secret)).status, 404);
    assert.equal((await s.call('/v1/safety/unblock', { target: troll.id }, me.secret)).body.blocks.length, 0);
    const raw = s.env.DB._raw;
    for (let i = 0; i < BLOCKS_MAX; i++) raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 1, 1)').run(`p_filler${String(i).padStart(4, '0')}`, `Filler ${i}`);
    for (let i = 0; i < BLOCKS_MAX; i++) raw.prepare('INSERT INTO blocks (player, blocked, at) VALUES (?, ?, ?)').run(me.id, `p_filler${String(i).padStart(4, '0')}`, i);
    const full = await s.call('/v1/safety/block', { target: other.id }, me.secret);
    assert.equal(full.status, 409);
    assert.equal(full.body.error, 'blocks-full');
  } finally { s.restore(); }
});

test('SAFE7 THE CODE OF CONDUCT AGREED: the token\'s mint says whether the code as it stands is agreed; agreeing to an older version is refused, the current one kept (mutants: a stale agreement taken; the mint never saying it)', async () => {
  const s = await stand();
  try {
    const me = await s.guest();
    assert.equal((await s.call('/v1/auth/token', {}, me.secret)).body.conduct, false);
    const stale = await s.call('/v1/safety/conduct', { v: '2000-01-01' }, me.secret);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'conduct-stale');
    assert.deepEqual((await s.call('/v1/safety/conduct', { v: CONDUCT_VERSION }, me.secret)).body, { ok: true, conduct: CONDUCT_VERSION });
    assert.equal((await s.call('/v1/auth/token', {}, me.secret)).body.conduct, true);
  } finally { s.restore(); }
});

test('SAFE3 A REPORT IS EVIDENCE OR IT IS NOTHING: lines the relay stamped open a case that keeps them, stamps and all; one line the relay did not relay - a stamp of other words, or of nobody - refuses the whole report; a report of oneself, or with none of the reported account\'s lines, is refused (mutants: a stamp unchecked; one forged line among good ones kept)', async () => {
  const s = await stand();
  try {
    const sylvia = await s.registered('Sylvia');
    const troll = await s.registered('Troll');
    const before = await heard(s, sylvia, 'anyone up for the gate?', { at: Date.now() - 2000 });
    const said = await heard(s, troll, 'asexuals are just attention *****');
    const r = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', note: 'every night', lines: [before, said] }, sylvia.secret);
    assert.equal(r.status, 200);
    assert.match(r.body.case, /^[0-9a-f]{16}$/);
    const raw = s.env.DB._raw;
    assert.deepEqual(raw.prepare('SELECT text, sg FROM mod_case_lines WHERE case_id = ? ORDER BY at').all(r.body.case).map((l) => [l.text, l.sg]), [[before.text, before.sg], [said.text, said.sg]]);
    const c = raw.prepare('SELECT target, source, status, reports, credible FROM mod_cases WHERE id = ?').get(r.body.case);
    assert.deepEqual({ ...c }, { target: troll.id, source: 'report', status: 'open', reports: 1, credible: 0 });
    const forged = { ...said, text: 'something kinder' };
    assert.equal((await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [before, forged] }, sylvia.secret)).body.error, 'report-unwitnessed');
    const invented = { ...said, sub: sylvia.id };
    assert.equal((await s.call('/v1/safety/report', { target: sylvia.id, reason: 'hate', lines: [invented] }, troll.secret)).body.error, 'report-unwitnessed', 'a stamp of another speaker');
    assert.equal((await s.call('/v1/safety/report', { target: sylvia.id, reason: 'hate', lines: [before] }, sylvia.secret)).body.error, 'report-self');
    assert.equal((await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [before] }, sylvia.secret)).body.error, 'report-no-line');
    const again = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, sylvia.secret);
    assert.equal(again.body.repeat, true, 'a reporter reports an account once a case');
    assert.equal(again.body.case, r.body.case, 'one open case an account');
  } finally { s.restore(); }
});

test('SAFE3 THE AUTOMATIC MUTE: REPORT_AUTO_MUTE credible reporters (registered, no sprout, not muted) mute the account for half an hour - once a case, by `auto:reports`, in the record - and the order goes back to the reporter\'s client and to the relay\'s door; guests\' reports and fresh accounts\' never count, and a moderator is never muted so (mutants: a guest counted; the threshold off by one; a moderator muted)', async () => {
  const s = await stand();
  try {
    const troll = await s.registered('Troll');
    const said = await heard(s, troll, 'go back to your pride parade lol');
    for (let i = 0; i < 4; i++) {
      const g = await s.guest();
      assert.equal((await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, g.secret)).body.muted, undefined, 'a guest never counts');
    }
    const fresh = await s.registered('Freshling');
    await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, fresh.secret);
    const regs = [];
    for (const h of ['Regular1', 'Regular2', 'Regular3']) { const r = await s.registered(h); season(s, r); regs.push(r); }
    const r1 = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, regs[0].secret);
    const r2 = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, regs[1].secret);
    assert.equal(r1.body.muted ?? r2.body.muted, undefined, `${REPORT_AUTO_MUTE - 1} is not enough`);
    const nowS = Math.floor(Date.now() / 1000);
    const r3 = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, regs[2].secret);
    assert.ok(r3.body.muted >= nowS + 30 * 60 - 2 && r3.body.muted <= nowS + 30 * 60 + 2);
    const v = await verifyOrder(r3.body.order, s.identityPublic, { subtle, nowS, kind: 'mute' });
    assert.equal(v.ok, true);
    assert.equal(v.claims.s, troll.id);
    assert.deepEqual(s.pushed, [r3.body.order], 'the relay\'s door hears it');
    const raw = s.env.DB._raw;
    assert.equal(raw.prepare('SELECT muted_by FROM players WHERE id = ?').get(troll.id).muted_by, 'auto:reports');
    assert.deepEqual({ ...raw.prepare('SELECT kind, actor, case_id FROM mod_actions WHERE target = ?').get(troll.id) }, { kind: 'mute', actor: 'auto:reports', case_id: r3.body.case });
    assert.equal(raw.prepare('SELECT auto FROM mod_cases WHERE id = ?').get(r3.body.case).auto, 'reports');
    const r4 = await s.call('/v1/safety/report', { target: troll.id, reason: 'hate', lines: [said] }, (await (async () => { const r = await s.registered('Regular4'); season(s, r); return r; })()).secret);
    assert.equal(r4.body.muted, undefined, 'once a case');

    const mod = await s.registered('Asynian');
    const modLine = await heard(s, mod, 'please keep it civil');
    for (const r of regs) await s.call('/v1/safety/report', { target: mod.id, reason: 'harassment', lines: [modLine] }, r.secret);
    assert.equal(raw.prepare('SELECT muted_until FROM players WHERE id = ?').get(mod.id).muted_until, null, 'a moderator is never muted by reports');
  } finally { s.restore(); }
});

test('SAFE4 THE BAN: a moderator bans by name - the row, its act in the record, a ban order to carry and pushed to the relay\'s door; the banned account meets `banned` with until when and why on every door but signing out, mints no token, and an unban lets it back; a player cannot ban, a moderator is never banned, two guests of one name are refused rather than guessed (mutants: the ban never checked at the door; a non-moderator banning; the ambiguity guessed)', async () => {
  const s = await stand();
  try {
    const mod = await s.registered('Asynian');
    const troll = await s.registered('Troll');
    const bystander = await s.registered('Bystander');
    assert.equal((await s.call('/v1/mod/ban', { name: 'Troll', days: 7 }, bystander.secret)).status, 403);
    assert.equal((await s.call('/v1/mod/ban', { name: 'Asynian', days: 7 }, mod.secret)).body.error, 'protected');
    assert.equal((await s.call('/v1/mod/ban', { name: 'Troll', days: 400 }, mod.secret)).body.error, 'bad-days');
    const nowS = Math.floor(Date.now() / 1000);
    const r = await s.call('/v1/mod/ban', { name: 'troll', days: 7, reason: 'slurs in world chat' }, mod.secret);
    assert.equal(r.status, 200);
    assert.equal(r.body.target, troll.id);
    assert.ok(Math.abs(r.body.until - (nowS + 7 * 86400)) <= 2);
    const v = await verifyOrder(r.body.order, s.identityPublic, { subtle, nowS, kind: 'ban' });
    assert.equal(v.claims.bn, r.body.until);
    assert.deepEqual(s.pushed, [r.body.order]);
    const minted = await s.call('/v1/auth/token', {}, troll.secret);
    assert.equal(minted.status, 403);
    assert.deepEqual(minted.body, { error: 'banned', until: r.body.until, reason: 'slurs in world chat' });
    assert.equal((await s.call('/v1/safety/blocks', {}, troll.secret)).status, 403);
    assert.notEqual((await s.call('/v1/auth/logout', {}, troll.secret)).status, 403, 'a banned account may still sign out');
    const raw = s.env.DB._raw;
    assert.deepEqual(raw.prepare('SELECT kind, actor, actor_name, reason FROM mod_actions WHERE target = ? ORDER BY id').all(troll.id).map((a) => ({ ...a })), [{ kind: 'ban', actor: mod.id, actor_name: 'Asynian', reason: 'slurs in world chat' }]);

    const t2 = await s.registered('Troll2');
    await s.call('/v1/mod/ban', { target: t2.id, days: 0 }, mod.secret);
    assert.equal(raw.prepare('SELECT banned_until FROM players WHERE id = ?').get(t2.id).banned_until, BAN_FOREVER, 'days 0 is for good');
    const un = await s.call('/v1/mod/unban', { target: t2.id }, mod.secret);
    assert.equal(un.body.until, 0);
    assert.equal((await verifyOrder(un.body.order, s.identityPublic, { subtle, nowS, kind: 'ban' })).claims.bn, 0);
    assert.equal(raw.prepare('SELECT banned_until FROM players WHERE id = ?').get(t2.id).banned_until, null);

    raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 1, 1), (?, ?, 1, 1)').run('p_twin00001', 'Brave Wolf', 'p_twin00002', 'Brave Wolf');
    const twin = await s.call('/v1/mod/ban', { name: 'Brave Wolf', days: 1 }, mod.secret);
    assert.equal(twin.status, 409);
    assert.equal(twin.body.error, 'ambiguous');
  } finally { s.restore(); }
});

test('SAFE4 THE RECORD AND THE LADDER: MOD1\'s /mute is kept in the record now, and the look says the strikes of ninety days, the next rung (half an hour, a day, a week, then a ban), the mute or ban standing and the history newest first (mutants: the mute unrecorded; a strike outside the window counted)', async () => {
  const s = await stand();
  try {
    const mod = await s.registered('Asynian');
    const troll = await s.registered('Troll');
    const look = async () => (await s.call('/v1/mod/strikes', { name: 'Troll' }, mod.secret)).body;
    assert.deepEqual([(await look()).strikes, (await look()).next], [0, 30]);
    assert.equal((await s.call('/v1/mod/mute', { target: troll.id, minutes: 30 }, mod.secret)).status, 200);
    assert.deepEqual([(await look()).strikes, (await look()).next], [1, 1440]);
    s.env.DB._raw.prepare("INSERT INTO mod_actions (target, kind, until, actor, at) VALUES (?, 'mute', 1, 'old', ?)").run(troll.id, Math.floor(Date.now() / 1000) - 200 * 86400);
    assert.equal((await look()).strikes, 1, 'a strike past ninety days does not count');
    await s.call('/v1/mod/mute', { target: troll.id, minutes: 0 }, mod.secret);
    await s.call('/v1/mod/mute', { target: troll.id, minutes: 60 }, mod.secret);
    await s.call('/v1/mod/mute', { target: troll.id, minutes: 60 }, mod.secret);
    const l = await look();
    assert.equal(l.strikes, 3);
    assert.equal(l.next, 'ban');
    assert.ok(l.mutedUntil > 0);
    assert.deepEqual(l.history.slice(0, 3).map((h) => h.kind), ['mute', 'mute', 'unmute']);
    assert.equal(l.history[0].by, 'Asynian');
    assert.equal((await s.call('/v1/mod/strikes', { name: 'Troll' }, troll.secret)).status, 403);
  } finally { s.restore(); }
});
