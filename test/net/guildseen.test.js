// GUILD-SEEN (2026-10-11, the owner: "the guild member list needs a 'last online' info, just like the friend list
// does"): THE ROSTER SAYS WHEN EACH MEMBER WAS LAST ONLINE. The service's view carries each member's `seenAt` - the
// account's last play beat (ACC4's `played_at`), or its last authenticated call where it never beat - driven through
// the real Worker over node:sqlite with every migration applied (server-account/src/guilds.js viewOf); the book's law
// over it (net/guild/guildBook.js guildMemberOnline, guildSeenText) and a look that moves a stamp alone repainting nothing;
// and the Members page's dot and line, read again on the live pass (ui/socialPanel.js). bible/11-Multiplayer/
// Guild-Overhaul.md GUILD-SEEN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { GUILD_RANK_NAMES, guildNameOf, guildNameKey } from '../../src/net/guild/guildLaw.js';
import { GuildBook, guildMemberOnline, guildSeenText } from '../../src/net/guild/guildBook.js';
import { PLAY_BEAT_S, PLAY_GRACE_S } from '../../src/net/playClock.js';
import { createSocialPanel } from '../../src/ui/socialPanel.js';
import { SocialState } from '../../src/net/social.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ─── THE SERVICE ─────────────────────────────────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
async function stand() {
  _resetKeyForTests();
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const secret = (await call('/v1/auth/guest', { ...ACCEPTED })).body.secret;
    assert.equal((await call('/v1/auth/register', { secret, handle, password: 'a good long one', ...ACCEPTED })).status, 200, `${handle} registers`);
    const id = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get(handle.toLowerCase()).id;
    return { secret, id, character: `char-${handle.toLowerCase()}`, handle };
  };
  return { env, call, registered };
}

test('GUILD-SEEN the service: each member of the roster carries `seenAt`, its account\'s last play beat - ahead of a later authenticated call - or that call where the account never beat; the guild\'s own reader among them (mutants: the stamp unsaid, the call read ahead of the beat, the beat unread)', async () => {
  const { env, call, registered } = await stand();
  const [aldric, bran, cass] = [await registered('Aldric'), await registered('Bran'), await registered('Cass')];
  const raw = env.DB._raw;
  const nowS = Math.floor(Date.now() / 1000);
  const n = guildNameOf('The Hound');
  raw.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run('g0123456789', n, guildNameKey(n), 'HND', JSON.stringify(GUILD_RANK_NAMES), nowS);
  for (const [who, rank, at] of [[aldric, 0, 1], [bran, 2, 2], [cass, 3, 3]]) {
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(who.id, who.character, 'g0123456789', rank, who.handle, nowS - 100 + at);
  }
  // Bran never beat: his last call stands for it. Cass beat an hour ago and called since: the beat is what is said.
  raw.prepare('UPDATE players SET played_at = NULL, last_seen = ? WHERE id = ?').run(nowS - 7200, bran.id);
  raw.prepare('UPDATE players SET played_at = ?, last_seen = ? WHERE id = ?').run(nowS - 3600, nowS - 60, cass.id);
  raw.prepare('UPDATE players SET played_at = ? WHERE id = ?').run(nowS - 30, aldric.id);
  const r = await call('/v1/guilds/mine', { character: aldric.character }, aldric.secret);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.guild.members.map((m) => [m.name, m.rank, m.you, m.seenAt]), [
    ['Aldric', 0, true, nowS - 30],
    ['Bran', 2, false, nowS - 7200],
    ['Cass', 3, false, nowS - 3600],
  ], 'the beat, or the call where there was none - in the roster\'s own order');
  // the roster is one statement still, and writes nothing to say it
  assert.match(src('server-account/src/guilds.js'), /COALESCE\(p\.played_at, p\.last_seen\) AS seen_at FROM guild_members m LEFT JOIN players p ON p\.id = m\.player WHERE m\.guild_id = \?/);
});

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────

test('GUILD-SEEN the law: a member is online while their sitting is open - no wider gap since the beat than PLAY_GRACE_S, the gap the service credits as one sitting - and the reader\'s own row always; past it, the friends list\'s own words; no stamp, no word (mutants: the grace\'s edge off by one, the reader read off the clock, the seconds read as milliseconds, a missing stamp read as offline)', () => {
  assert.deepEqual([PLAY_BEAT_S, PLAY_GRACE_S], [300, 600], 'ACC4\'s beat and its grace');
  const now = 10_000_000_000;
  const at = (ago) => Math.floor(now / 1000) - ago;
  assert.equal(guildMemberOnline({ seenAt: at(0) }, now), true);
  assert.equal(guildMemberOnline({ seenAt: at(PLAY_GRACE_S) }, now), true, 'the grace\'s own edge is one sitting');
  assert.equal(guildMemberOnline({ seenAt: at(PLAY_GRACE_S + 1) }, now), false);
  assert.equal(guildMemberOnline({ seenAt: at(-30) }, now), true, 'a stamp a little ahead of this clock is now');
  assert.equal(guildMemberOnline({ seenAt: at(86_400), you: true }, now), true, 'the reader is playing their own row');
  assert.equal(guildMemberOnline({ seenAt: at(86_400), you: false }, now), false);
  for (const none of [{}, { seenAt: null }, { seenAt: 1.5 }, { seenAt: '100' }, null]) {
    assert.equal(guildMemberOnline(none, now), null, JSON.stringify(none));
    assert.equal(guildSeenText(none, now), '', JSON.stringify(none));
  }
  assert.deepEqual([
    guildSeenText({ seenAt: at(60) }, now),
    guildSeenText({ seenAt: at(PLAY_GRACE_S + 1) }, now),
    guildSeenText({ seenAt: at(3 * 3600) }, now),
    guildSeenText({ seenAt: at(3 * 86_400) }, now),
    guildSeenText({ seenAt: at(3 * 86_400), you: true }, now),
  ], ['Online', 'Last online 10 min ago', 'Last online 3 h ago', 'Last online 3 days ago', 'Online']);
});

// ─── THE BOOK ────────────────────────────────────────────────────────────────────────

const view = (members) => ({
  id: 'g0123456789', name: 'The Hound', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 0,
  members, invites: [], ledger: [],
});
function bookOf(guild) {
  let now = 10_000_000_000;
  const door = { guild, calls: 0 };
  door.mine = async () => { door.calls++; return { ok: true, data: { guild: door.guild } }; };
  door.invites = async () => ({ ok: true, data: { invites: [] } });
  const book = new GuildBook({ door, character: () => 'char-a', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), now: () => now });
  return { door, book, tick: (ms) => { now += ms; }, nowS: () => Math.floor(now / 1000) };
}

test('GUILD-SEEN the book: a look that moved only a member\'s stamp holds the new stamp and moves no version, so the Members page is not painted again under a form being typed into; a look that moved anything else still does (mutants: the stamp compared with the rest)', async () => {
  const S = Math.floor(10_000_000_000 / 1000);
  const { door, book } = bookOf(view([{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, seenAt: S }, { member: 'm2', name: 'Bran', rank: 2, joinedAt: 2, you: false, seenAt: S - 900 }]));
  await book.refresh();
  const v = book.version;
  door.guild = view([{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, seenAt: S + 5 }, { member: 'm2', name: 'Bran', rank: 2, joinedAt: 2, you: false, seenAt: S - 60 }]);
  await book.refresh();
  assert.equal(book.version, v, 'a stamp moved alone');
  assert.deepEqual(book.guild.members.map((m) => m.seenAt), [S + 5, S - 60], 'but held');
  door.guild = view([{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, seenAt: S + 5 }, { member: 'm2', name: 'Bran', rank: 1, joinedAt: 2, you: false, seenAt: S - 60 }]);
  await book.refresh();
  assert.equal(book.version, v + 1, 'a rank moved is a repaint');
});

// ─── THE PAGE ────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    focus() { n.focused = true; doc.activeElement = n; },
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const settle = () => new Promise((r) => setImmediate(r));

test('GUILD-SEEN the Members page: each member\'s row says it as a friend\'s does - the dot lit and "Online" while their sitting is open, "Last online 3 h ago" past it - under the rank; a row the service said no stamp for says nothing; the clock alone puts a dot out and moves the words, and a look that moved a stamp alone is read there, all without painting the page again (mutants: no dot, no line, the line frozen at its paint, the dot frozen at its paint, the stale row read)', async () => {
  const S = Math.floor(10_000_000_000 / 1000);
  const { door, book, tick } = bookOf(view([
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, seenAt: S - 7200 },
    { member: 'm2', name: 'Bran', rank: 2, joinedAt: 2, you: false, seenAt: S - 60 },
    { member: 'm3', name: 'Cass', rank: 3, joinedAt: 3, you: false, seenAt: S - 3 * 3600 },
    { member: 'm4', name: 'Dena', rank: 3, joinedAt: 4, you: false },
  ]));
  const panel = createSocialPanel({ social: new SocialState({ acct: 'acct-a' }), guild: book, doc: fakeDocument(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  const frame = async () => { await settle(); await settle(); panel.render(); };
  panel.openGuild('members'); await frame();
  const rowOf = (n) => find(panel.root, 'dfsocial-row').find((r) => texts(r).some((t) => t === n || t === `${n} (you)`));
  const dot = (n) => find(rowOf(n), 'dfsocial-dot')[0] ?? null;
  const lines = (n) => find(rowOf(n), 'dfsocial-sub').map((s) => s.textContent);
  assert.deepEqual(lines('Aldric'), ['Guildmaster', 'Online'], 'the reader is online, whatever their last beat');
  assert.deepEqual(lines('Bran'), ['Member', 'Online']);
  assert.deepEqual(lines('Cass'), ['Recruit', 'Last online 3 h ago']);
  assert.deepEqual(lines('Dena'), ['Recruit'], 'no stamp, no word');
  assert.deepEqual([dot('Aldric')?.className, dot('Bran')?.className, dot('Cass')?.className, dot('Dena')], ['dfsocial-dot on', 'dfsocial-dot on', 'dfsocial-dot', null]);
  const body = find(panel.root, 'dfsocial-body')[0];
  const painted = body.children.slice();
  // the clock alone: Bran's sitting lapses, Cass's three hours become four
  tick(PLAY_GRACE_S * 1000);
  panel.render();
  assert.deepEqual(lines('Bran'), ['Member', 'Last online 11 min ago']);
  assert.equal(dot('Bran').className, 'dfsocial-dot', 'the dot out on the clock alone');
  assert.equal(lines('Cass')[1], 'Last online 3 h ago');
  tick(3600 * 1000);
  panel.render();
  assert.equal(lines('Cass')[1], 'Last online 4 h ago');
  // a look that found Cass at play again moved only her stamp: read on the live pass, the page not painted again
  const T = Math.floor((10_000_000_000 + PLAY_GRACE_S * 1000 + 3600 * 1000) / 1000);
  door.guild = view([
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, seenAt: T },
    { member: 'm2', name: 'Bran', rank: 2, joinedAt: 2, you: false, seenAt: S - 60 },
    { member: 'm3', name: 'Cass', rank: 3, joinedAt: 3, you: false, seenAt: T - 10 },
    { member: 'm4', name: 'Dena', rank: 3, joinedAt: 4, you: false },
  ]);
  await book.refresh(); await frame();
  assert.deepEqual(lines('Cass'), ['Recruit', 'Online']);
  assert.equal(dot('Cass').className, 'dfsocial-dot on');
  assert.ok(body.children.length === painted.length && body.children.every((c, i) => c === painted[i]), 'the same rows - nothing painted again');
});
