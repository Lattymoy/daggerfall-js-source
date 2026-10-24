// STAFF-PANEL5-MESSAGE (2026-10-22, mob, 04:14Z: a message in the middle of one player's screen; design doc "DFO Staff
// Panel: design", Message on screen) - THE ACCOUNT SERVICE'S HALF (server-account/src/staffMessage.js), driven through the
// real Worker on the node:sqlite database every account pin stands on (test/accountDb.mjs): a message sent by account id,
// bounded, paced, stored first and audited, its signed order posted to the relay's door, each one's state read back, and
// the game's own two doors - the messages waiting, and the OK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import {
  MESSAGE_ROUTES, MESSAGE_STATES, messageState, STAFF_MESSAGE_MAX, STAFF_MESSAGE_GAP_S, STAFF_MESSAGES_PAGE, STAFF_MESSAGE_SHOW_S,
  STAFF_MESSAGE_ASK_MAX, STAFF_MESSAGE_KEEP_S,
} from '../../server-account/src/staffMessage.js';
import { STAFF_ROUTES, ROUTES } from '../../server-account/src/service.js';
import { runCron, HOUR_JOBS, CRON_HOUR } from '../../server-account/src/cron.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { verifyOrder } from '../../src/net/identityToken.js';

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

/** The Worker with the panel set up (staffpanel2's `stand`): mob (an Admin and owner) and Asynian and Tabbyvish
 *  (Moderators) signed in, Troll and Sylvia two players; the relay's door recorded, its answer `door.say` (status, body). */
async function stand(extra = {}) {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY, ...extra,
  });
  const door = { pushed: [], say: [200, { ok: true, n: 1, old: 0 }] };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) === RELAY) { door.pushed.push(JSON.parse(init.body).order); return Response.json(door.say[1], { status: door.say[0] }); }
    return real(url, init);
  };
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
  /** The staff member's last message, moved back past the gap - a pin's way of letting 5 seconds pass. */
  const later = (who) => raw.prepare(`UPDATE staff_messages SET at = at - ${STAFF_MESSAGE_GAP_S} WHERE staff_id = ?`).run(idOf(who));
  const send = (who, body) => staff('/v1/staff/message', body, who.session);
  const audits = (act) => raw.prepare('SELECT * FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  return { ...s, raw, staff, mob, asy, tab, troll, sylvia, idOf, later, send, audits, door, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL5-MESSAGE: the panel\'s two doors are staff doors, opened by a staff session alone; the game\'s two are behind its own session', async () => {
  assert.deepEqual([...MESSAGE_ROUTES], ['/v1/staff/message', '/v1/staff/messages']);
  for (const r of MESSAGE_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  for (const r of ['/v1/safety/staff-messages', '/v1/safety/staff-message-ok']) assert.ok(ROUTES.has(r) && !STAFF_ROUTES.has(r), r);
  const s = await stand();
  try {
    for (const r of MESSAGE_ROUTES) {
      assert.deepEqual(await s.staff(r, { target: s.troll.id, text: 'hi' }), { status: 401, body: { error: 'staff-session' } }, r);
      assert.equal((await s.staff(r, { target: s.troll.id, text: 'hi' }, s.troll.secret)).status, 401, `${r}: a game secret is no staff session`);
    }
    assert.equal((await s.call('/v1/safety/staff-messages', {})).status, 401, 'the game\'s read needs its session');
    assert.equal((await s.call('/v1/safety/staff-message-ok', { id: 'abcdabcd' })).status, 401);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-MESSAGE: a Moderator sends one player a message BY ACCOUNT ID - stored first, audited without its words, then a signed order of its own kind posted to the relay\'s door; the hub\'s count reads Delivered (mutants: the order a mute\'s; the words in the audit; the row unstored)', async () => {
  const s = await stand();
  try {
    const r = await s.send(s.asy, { target: s.troll.id, text: '  Please   stop\nspamming trade.  ' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const m = r.body.message;
    assert.deepEqual({ ...m, id: typeof m.id, at: typeof m.at }, {
      id: 'string', at: 'number', staff: { id: s.idOf('Asynian'), name: 'Asynian' }, target: s.troll.id, name: 'Troll', text: 'Please stop spamming trade.',
      state: 'delivered', label: 'Delivered', okAt: null,
    });
    const row = s.raw.prepare('SELECT * FROM staff_messages WHERE id = ?').get(m.id);
    assert.deepEqual([row.staff_id, row.staff_name, row.target, row.text, row.pushed, row.sockets, row.old, row.ok_at], [s.idOf('Asynian'), 'Asynian', s.troll.id, 'Please stop spamming trade.', 1, 1, 0, null]);
    assert.equal(s.door.pushed.length, 1);
    const v = await verifyOrder(s.door.pushed[0], s.identityPublic, { subtle, nowS: nowS(), kind: 'smsg' });
    assert.ok(v.ok, v.why);
    assert.deepEqual([v.claims.o, v.claims.s, v.claims.mi], ['smsg', s.troll.id, m.id], 'the order names the account and the message, and never its words');
    assert.ok(!s.door.pushed[0].includes(b64url(enc.encode('spamming'))) && !JSON.stringify(v.claims).includes('spamming'));
    const [a] = s.audits('message');
    assert.deepEqual([a.actor, a.role, a.target, a.outcome, JSON.parse(a.detail)], [s.idOf('Asynian'), 'moderator', s.troll.id, 'ok', { name: 'Troll', chars: 27, id: m.id }]);
    assert.ok(!a.detail.includes('spamming'), 'the audit row never copies the words');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-MESSAGE: never by name, never empty, an account that exists, up to 200 characters - one past is refused and audited failed, counted in characters not code units (mutants: the name taken; the bound off by one; the refusal unaudited)', async () => {
  const s = await stand();
  try {
    assert.deepEqual(await s.send(s.asy, { name: 'Troll', text: 'hi' }), { status: 400, body: { error: 'body' } }, 'a name is no target');
    assert.deepEqual(await s.send(s.asy, { target: s.troll.id, text: ' \n\t ' }), { status: 400, body: { error: 'body' } });
    assert.deepEqual(await s.send(s.asy, { target: s.troll.id }), { status: 400, body: { error: 'body' } });
    assert.deepEqual(await s.send(s.asy, { target: 'nobody-here-at-all', text: 'hi' }), { status: 404, body: { error: 'no-player' } });
    assert.deepEqual(await s.send(s.asy, { target: s.troll.id, text: 'x'.repeat(STAFF_MESSAGE_MAX + 1) }), { status: 400, body: { error: 'staff-message-long' } });
    const [a] = s.audits('message');
    assert.deepEqual([a.outcome, JSON.parse(a.detail)], ['failed', { name: 'Troll', chars: STAFF_MESSAGE_MAX + 1, error: 'staff-message-long' }]);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_messages').get().n, 0, 'nothing stored');
    assert.equal(s.door.pushed.length, 0, 'nothing sent');
    assert.equal((await s.send(s.asy, { target: s.troll.id, text: 'x'.repeat(STAFF_MESSAGE_MAX) })).status, 200, 'two hundred is the bound');
    s.later('Asynian');
    assert.equal((await s.send(s.asy, { target: s.troll.id, text: '\u{1F600}'.repeat(STAFF_MESSAGE_MAX) })).status, 200, 'two hundred faces are two hundred characters');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-MESSAGE: one message every 5 seconds a staff member - a second inside it is refused 429 and audited failed, another member is not held by it, and 5 seconds on it goes (mutants: the gap unasked; the gap asked of everyone; the store\'s own ask dropped)', async () => {
  const s = await stand();
  try {
    assert.equal((await s.send(s.asy, { target: s.troll.id, text: 'one' })).status, 200);
    assert.deepEqual(await s.send(s.asy, { target: s.sylvia.id, text: 'two' }), { status: 429, body: { error: 'staff-message-rate' } });
    assert.deepEqual(s.audits('message').map((a) => [a.outcome, JSON.parse(a.detail).error ?? null]), [['ok', null], ['failed', 'staff-message-rate']]);
    assert.equal((await s.send(s.tab, { target: s.sylvia.id, text: 'mine' })).status, 200, 'another member\'s 5 seconds are their own');
    s.raw.prepare('UPDATE staff_messages SET at = at - ? WHERE staff_id = ?').run(STAFF_MESSAGE_GAP_S - 1, s.idOf('Asynian'));
    assert.equal((await s.send(s.asy, { target: s.sylvia.id, text: 'two' })).status, 429, 'four seconds on, still held');
    s.raw.prepare('UPDATE staff_messages SET at = at - 1 WHERE staff_id = ?').run(s.idOf('Asynian'));
    assert.equal((await s.send(s.asy, { target: s.sylvia.id, text: 'two' })).status, 200, 'five seconds on, it goes');
    // the store asks the gap again in its own statement: a message stored between the look and the store holds the second
    const ins = s.raw.prepare('INSERT INTO staff_messages (id, at, staff_id, staff_name, target, text) VALUES (?, ?, ?, ?, ?, ?)');
    s.raw.prepare('UPDATE staff_messages SET at = at - 60').run();
    const realPrepare = s.env.DB.prepare.bind(s.env.DB);
    let raced = false;
    s.env.DB.prepare = (sql) => {
      if (!raced && sql.startsWith('INSERT INTO staff_messages')) { raced = true; ins.run('racer-0001', nowS(), s.idOf('Tabbyvish'), 'Tabbyvish', s.troll.id, 'first'); }
      return realPrepare(sql);
    };
    try { assert.deepEqual(await s.send(s.tab, { target: s.troll.id, text: 'second' }), { status: 429, body: { error: 'staff-message-rate' } }); } finally { s.env.DB.prepare = realPrepare; }
    assert.ok(raced, 'the race was run');
    assert.equal(s.audits('message').at(-1).outcome, 'failed', 'and its audit row says it changed nothing');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-MESSAGE: EACH MESSAGE\'S STATE - Delivered (the hub handed it), "old game, not shown", Not confirmed (no socket, the door refused, no relay), Sent (a door that gave no count), then "they pressed OK" from the player\'s own game (mutants: each state\'s rule)', async () => {
  const s = await stand();
  try {
    const sent = async (say) => { s.door.say = say; s.later('Asynian'); s.later('Asynian'); const r = await s.send(s.asy, { target: s.troll.id, text: 'hello' }); assert.equal(r.status, 200); return r.body.message; };
    assert.equal((await sent([200, { ok: true, n: 2, old: 1 }])).state, 'delivered', 'one socket that shows it is enough');
    assert.deepEqual([(await sent([200, { ok: true, n: 0, old: 1 }]))].map((m) => [m.state, m.label]), [['old-game', 'old game, not shown']]);
    assert.equal((await sent([200, { ok: true, n: 0, old: 0 }])).state, 'not-confirmed', 'no socket of theirs online');
    assert.equal((await sent([409, { ok: false, error: 'not taken' }])).state, 'not-confirmed', 'the door refused');
    assert.equal((await sent([200, { ok: true }])).state, 'sent', 'a door that took it and said no count');
    const ok = await sent([200, { ok: true, n: 1, old: 0 }]);
    const mine = await s.call('/v1/safety/staff-message-ok', { id: ok.id }, s.troll.secret);
    assert.deepEqual([mine.status, mine.body], [200, { ok: true, marked: true }]);
    const read = await s.staff('/v1/staff/messages', { target: s.troll.id }, s.asy.session);
    const got = read.body.messages.find((m) => m.id === ok.id);
    assert.deepEqual([got.state, got.label, typeof got.okAt], ['ok', 'they pressed OK', 'number']);
    s.door.say = [200, { ok: true, n: 1, old: 0 }];
  } finally { s.restore(); }
  const s2 = await stand({ RELAY_LAW_URL: undefined });
  try {
    const r = await s2.send(s2.asy, { target: s2.troll.id, text: 'no relay' });
    assert.deepEqual([r.status, r.body.message.state], [200, 'not-confirmed'], 'a service with no relay says so, never Delivered');
  } finally { s2.restore(); }
  // the rule itself, every row shape
  assert.equal(messageState({ ok_at: 5, sockets: 0, old: 1, pushed: 1 }), 'ok');
  assert.equal(messageState({ ok_at: null, sockets: null, old: null, pushed: null }), 'sent', 'still being asked');
  assert.equal(messageState({ ok_at: null, sockets: null, old: null, pushed: 0 }), 'not-confirmed');
  assert.deepEqual(Object.keys(MESSAGE_STATES), ['sent', 'delivered', 'ok', 'not-confirmed', 'old-game']);
});

test('STAFF-PANEL5-MESSAGE: the read - a Moderator their own messages, an Admin every one, by player; newest first, paged with `before` and `next`; the read audited once in ten minutes (mutants: a Moderator reading another\'s; the page unbounded)', async () => {
  const s = await stand();
  try {
    assert.equal((await s.send(s.asy, { target: s.troll.id, text: 'from asy' })).status, 200);
    assert.equal((await s.send(s.tab, { target: s.troll.id, text: 'from tab' })).status, 200);
    assert.equal((await s.send(s.mob, { target: s.sylvia.id, text: 'from mob' })).status, 200);
    const texts = async (who, body = {}) => (await s.staff('/v1/staff/messages', body, who.session)).body.messages.map((m) => m.text);
    assert.deepEqual(await texts(s.asy), ['from asy'], 'a Moderator reads their own');
    assert.deepEqual(await texts(s.mob), ['from mob', 'from tab', 'from asy'], 'an Admin reads every one, newest first');
    assert.deepEqual(await texts(s.mob, { target: s.troll.id }), ['from tab', 'from asy'], 'by player');
    assert.deepEqual(await texts(s.tab, { target: s.sylvia.id }), [], 'a Moderator never reads another member\'s, whoever it was to');
    const reads = s.audits('messages-read');
    assert.deepEqual(reads.map((a) => [a.role, a.target, JSON.parse(a.detail).own]), [['moderator', null, true], ['admin', null, false], ['admin', s.troll.id, false], ['moderator', s.sylvia.id, true]]);
    await texts(s.asy);
    assert.equal(s.audits('messages-read').length, 4, 'the same view again inside ten minutes writes no second row');
    // a page and the next
    const ins = s.raw.prepare('INSERT INTO staff_messages (id, at, staff_id, staff_name, target, text, pushed, sockets, old) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0)');
    for (let i = 0; i < STAFF_MESSAGES_PAGE + 3; i++) ins.run(`bulk-${String(i).padStart(4, '0')}`, nowS() - 1000, s.idOf('SirMcMobdon'), 'SirMcMobdon', s.troll.id, `bulk ${i}`);
    const p1 = (await s.staff('/v1/staff/messages', {}, s.mob.session)).body;
    assert.equal(p1.messages.length, STAFF_MESSAGES_PAGE);
    assert.equal(p1.messages[0].text, `bulk ${STAFF_MESSAGES_PAGE + 2}`);
    assert.ok(Number.isSafeInteger(p1.next));
    const p2 = (await s.staff('/v1/staff/messages', { before: p1.next }, s.mob.session)).body;
    assert.deepEqual(p2.messages.map((m) => m.text), ['bulk 2', 'bulk 1', 'bulk 0', 'from mob', 'from tab', 'from asy']);
    assert.equal(p2.next, null);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-MESSAGE: THE GAME\'S DOORS - its own messages not pressed OK, newer than a day, oldest first and five at most, `more` when more wait; an OK marks only its own player\'s message, once (mutants: another\'s read; an OK on another\'s message; `more` off by one)', async () => {
  const s = await stand();
  try {
    const ins = s.raw.prepare('INSERT INTO staff_messages (id, at, staff_id, staff_name, target, text, pushed, sockets, old) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0)');
    const t = nowS();
    ins.run('stale-0001', t - STAFF_MESSAGE_SHOW_S, s.idOf('Asynian'), 'Asynian', s.troll.id, 'a day old');
    for (let i = 0; i < STAFF_MESSAGE_ASK_MAX + 1; i++) ins.run(`fresh-000${i}`, t - 100 + i, s.idOf('Asynian'), 'Asynian', s.troll.id, `fresh ${i}`);
    ins.run('sylv-0001', t, s.idOf('Asynian'), 'Asynian', s.sylvia.id, 'for sylvia');
    const read = await s.call('/v1/safety/staff-messages', {}, s.troll.secret);
    assert.equal(read.status, 200);
    assert.deepEqual(read.body.messages.map((m) => [m.id, m.from, m.text]), [0, 1, 2, 3, 4].map((i) => [`fresh-000${i}`, 'Asynian', `fresh ${i}`]));
    assert.equal(read.body.messages[0].at, t - 100);
    assert.equal(read.body.more, true, 'STAFF-PANEL5-MESSAGE-FIX: a sixth waits past the five - the game asks again after their OKs');
    const sylvia = (await s.call('/v1/safety/staff-messages', {}, s.sylvia.secret)).body;
    assert.deepEqual([sylvia.messages.map((m) => m.id), sylvia.more], [['sylv-0001'], false], 'each player reads only their own');
    assert.deepEqual(await s.call('/v1/safety/staff-message-ok', { id: 'sylv-0001' }, s.troll.secret), { status: 200, body: { ok: true, marked: false } }, 'another player\'s message is never marked');
    assert.equal(s.raw.prepare('SELECT ok_at FROM staff_messages WHERE id = ?').get('sylv-0001').ok_at, null);
    assert.deepEqual((await s.call('/v1/safety/staff-message-ok', { id: 'fresh-0000' }, s.troll.secret)).body, { ok: true, marked: true });
    assert.deepEqual((await s.call('/v1/safety/staff-message-ok', { id: 'fresh-0000' }, s.troll.secret)).body, { ok: true, marked: false }, 'twice is once');
    assert.equal((await s.call('/v1/safety/staff-message-ok', { id: 7 }, s.troll.secret)).status, 400);
    const after = (await s.call('/v1/safety/staff-messages', {}, s.troll.secret)).body;
    assert.deepEqual(after.messages.map((m) => m.id), [1, 2, 3, 4, 5].map((i) => `fresh-000${i}`), 'pressed OK, it is not asked again');
    assert.equal(after.more, false, 'five waiting, five answered');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-MESSAGE: a row is kept 30 days - the hourly job deletes it past STAFF_MESSAGE_KEEP_S (mutant: the sweep dropped)', async () => {
  const s = await stand();
  try {
    const ins = s.raw.prepare('INSERT INTO staff_messages (id, at, staff_id, staff_name, target, text) VALUES (?, ?, ?, ?, ?, ?)');
    const t = nowS();
    ins.run('old-00001', t - STAFF_MESSAGE_KEEP_S - 1, 'x', 'x', s.troll.id, 'old');
    ins.run('new-00001', t - STAFF_MESSAGE_KEEP_S + 60, 'x', 'x', s.troll.id, 'new');
    const ran = await runCron(s.env, { cron: CRON_HOUR, nowS: t, jobs: HOUR_JOBS.filter(([n]) => n === 'staff-messages') });
    assert.deepEqual(ran.map((r) => [r.name, r.ok, r.changed]), [['staff-messages', true, 1]]);
    assert.deepEqual(s.raw.prepare('SELECT id FROM staff_messages').all().map((r) => r.id), ['new-00001']);
  } finally { s.restore(); }
});
