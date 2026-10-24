// SESSION-SIGN (2026-10-18; bible/11-Multiplayer/Scale-Arc.md THE PLAN PAST 1,000, decision 4 - the owner: "Make the best
// call for future proofing"): THE SESSION'S LOOKUP OFF THE HOT ROUTES. A hot route whose lookup the primary answered
// carries a pass back (server-account/src/sessionPass.js), and the next asks of it believe the pass without the lookup.
// These pins hold that a hot route answers under a pass as it answers under the lookup, that a pass is believed nowhere
// else and in no other hands, that the lag the owner took - five minutes, less the renewal - is the most a sign-out or a
// ban waits on a hot route's reads, and that a hot route's writes (the checkpoint, the beat) do not wait at all
// (AUDIT PLAN-1000 E1-E9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { PASS_TTL_S, PASS_RENEW_S, PASS_MAX_CHARS, PASS_PATHS, passRoute, passKey, mintPass, readPass, _resetPassKeyForTests } from '../../server-account/src/sessionPass.js';
import { SESSION_PASS_HEADER } from '../../src/net/sessionPassLaw.js';

const WHO = /FROM sessions s LEFT JOIN players p/;
const subtle = globalThis.crypto.subtle;
/** A D1 bookmark as a page carries one back (service.js D1_BOOKMARK_RE): its request's session starts from it, a replica's. */
const MARK = '00000001-00000002-00000003-abcdef0123456789';

/** A service on a clock the test moves, every statement it is asked counted for the session's lookup. */
async function stand(extra = {}) {
  const realNow = Date.now;
  let now = T0;
  Date.now = () => now * 1000;
  const s = await standService(extra);
  const db = s.env.DB, prepare = db.prepare.bind(db);
  let lookups = 0;
  db.prepare = (sql) => { if (WHO.test(sql)) lookups++; return prepare(sql); };
  /** One request: `{ status, body, pass, lookups }` - the pass it handed back, the lookups it asked. */
  const ask = async (method, path, secret, body = {}, { pass = null, headers = {} } = {}) => {
    const before = lookups;
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}), ...(pass ? { [SESSION_PASS_HEADER]: pass } : {}), ...headers },
      body: body == null ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null), pass: res.headers.get(SESSION_PASS_HEADER), expose: res.headers.get('access-control-expose-headers') ?? '', lookups: lookups - before };
  };
  return { s, ask, raw: s.env.DB._raw, tick: (sec) => { now += sec; }, nowS: () => now, done: () => { Date.now = realNow; } };
}

/** The hot routes' asks (the checkpoint's below, a write), each as a page makes it - every route PASS_PATHS names. */
const HOT = (character) => [
  ['/v1/heartbeat', { mail: true, board: 1291, post: true }],
  ['/v1/homes/town', { mapId: 7, character }],
  ['/v1/prof/pixels', { character, pixels: [[500, 200], [501, 200]] }],
  ['/v1/chapters/list', { character }],
  ['/v1/seats/list', {}],
  ['/v1/festival/town', { mapId: 7 }],   // PIN MOVED (WITCH1): a town's Hearth Offerings, asked as its homes are
];

test('SESSION-SIGN the oracle: every hot route answers under a pass exactly as under the lookup - for a guest, an account, a developer, a newcomer a week can not yet witness and a muted one, with the switches on and at `dev`, in a town with a home - and asks no lookup; the first ask, the lookup\'s, hands the pass back, exposed to the page; a banned account is handed none (mutants: a field the pass leaves out; the handle; the registration; the mute; a route added; the mint before the ban)', async () => {
  assert.deepEqual(HOT('c').map(([path]) => path), [...PASS_PATHS], 'the oracle asks every hot route there is');
  for (const sw of ['on', 'dev']) {
    const t = await stand({ DEVELOPER_HANDLES: 'mac', BOARD_OPEN: sw, SEATS_OPEN: sw, CHAPTERS_OPEN: sw, PROFESSIONS_OPEN: sw, FESTIVAL_OPEN: sw });
    try {
      const guest = await t.s.guest();
      const eve = await t.s.seated('eve');
      const mac = await t.s.seated('mac');
      const newcomer = await t.s.seated('newt');
      const muted = await t.s.seated('mute');
      const banned = await t.s.seated('bann');
      assert.equal((await t.s.seatHome(eve, { mapId: 7, buildingKey: 300, region: 17, price: 5000 })).status, 200, 'a home in the town the oracle reads');
      // WITCH1 (PIN MOVED): and a Hearth Offering at its door, so the town's offerings answer each account its own way
      t.raw.prepare('INSERT INTO fest_offerings (map_id, building_key, player, char_id, stock, placed_at) SELECT map_id, building_key, player, char_id, 3, ? FROM homes WHERE map_id = 7 AND building_key = 300').run(T0);
      t.raw.prepare('UPDATE players SET registered_at = ? WHERE id IN (?, ?, ?, ?)').run(T0 - 30 * 86400, eve.id, mac.id, muted.id, banned.id);
      t.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(T0 - 3600, newcomer.id);
      t.raw.prepare('UPDATE players SET muted_until = ? WHERE id = ?').run(T0 + 86400, muted.id);
      t.raw.prepare("UPDATE players SET banned_until = ?, ban_reason = 'spam' WHERE id = ?").run(T0 + 86400, banned.id);
      const answers = new Map();
      for (const who of [{ secret: guest.secret, character: 'c-guest' }, eve, mac, newcomer, muted]) {
        for (const [path, body] of HOT(who.character)) {
          const looked = await t.ask('POST', path, who.secret, body);
          assert.equal(looked.lookups, 1, `${path}: the first ask is the lookup's`);
          assert.ok(looked.pass, `${path}: and hands a pass back`);
          assert.match(looked.expose, /x-session-pass/, 'exposed, so the page can read it');
          const passed = await t.ask('POST', path, who.secret, body, { pass: looked.pass });
          assert.equal(passed.lookups, 0, `${path}: under the pass, no lookup`);
          assert.equal(passed.pass, null, `${path}: and no new pass - the one held is good`);
          assert.deepEqual([passed.status, passed.body], [looked.status, looked.body], `${sw} ${path} for ${who.handle ?? 'a guest'}: the pass's answer is the lookup's`);
          answers.set(`${path} ${who.handle ?? 'guest'}`, JSON.stringify([looked.status, looked.body]));
        }
      }
      for (const [path] of HOT('c')) {
        const seen = new Set([...answers].filter(([k]) => k.startsWith(`${path} `)).map(([, v]) => v));
        assert.ok(path === '/v1/chapters/list' && sw === 'on' ? seen.size >= 1 : seen.size > 1, `${sw} ${path}: the accounts are answered differently - the oracle reaches what it reads`);
      }
      for (const [path, body] of HOT(banned.character)) {
        const r = await t.ask('POST', path, banned.secret, body);
        assert.deepEqual([r.status, r.body?.error, r.pass], [403, 'banned', null], `${path}: a banned account is refused, and handed no pass`);
      }
    } finally { t.done(); }
  }
});

test('SESSION-SIGN the writes do not wait: a realm save under a pass lands as under the lookup - two trips where it was three - and a sign-out of every device or a ban refuses the very next one, the beat credits nothing for either, while the pass\'s reads wait for its renewal (mutants: the checkpoint not a hot route; the save\'s session unread; the save\'s ban unread; the beat\'s session unread; the beat\'s ban unread)', async () => {
  const t = await stand();
  try {
    const eve = await t.s.registered('eve');
    const R = await seatRealm(t.s.env, eve.secret, 'eve');
    const put = (seq, pass) => t.ask('PUT', `/v1/realm/${R.id}/data`, eve.secret, freshSave({ name: 'eve', goldPieces: 100 + seq }), { pass, headers: { 'x-realm-lease': R.lease, 'x-realm-seq': String(seq) } });
    const first = await put(2, null);
    assert.deepEqual([first.status, first.lookups], [200, 1]);
    assert.ok(first.pass, 'the checkpoint hands a pass');
    const second = await put(3, first.pass);
    assert.deepEqual([second.status, second.lookups], [200, 0], 'the next checkpoint asks no lookup');
    assert.equal(R.at().seq, 3, 'and lands');
    const played = () => t.raw.prepare('SELECT played_s, played_at FROM players WHERE id = ?').get(eve.id);
    // a ban: the save and the beat refuse at once, under the pass
    t.raw.prepare("UPDATE players SET banned_until = ?, ban_reason = 'spam' WHERE id = ?").run(T0 + 86400, eve.id);
    const banned = await put(4, first.pass);
    assert.deepEqual([banned.status, banned.body?.error, banned.body?.reason, banned.lookups], [403, 'banned', 'spam', 0], 'the save: banned, at once');
    assert.equal(R.at().seq, 3, 'nothing saved');
    const before = played();
    t.tick(30);
    const beat = await t.ask('POST', '/v1/heartbeat', eve.secret, { beat: true, mail: true }, { pass: first.pass });
    assert.equal(beat.status, 200, 'the pass\'s reads wait for its renewal');
    assert.deepEqual(played(), before, 'the beat credits a banned account nothing');
    t.raw.prepare('UPDATE players SET banned_until = NULL, ban_reason = NULL WHERE id = ?').run(eve.id);
    // a sign-out of every device: the same
    const fresh = (await put(4, null)).pass;
    assert.ok(fresh, 'unbanned: the lookup lands it, a pass beside');
    assert.equal((await t.ask('POST', '/v1/auth/logout', eve.secret, { all: true })).status, 200);
    const out = await put(5, fresh);
    assert.deepEqual([out.status, out.body?.error, out.lookups], [401, 'auth', 0], 'the save: signed out, at once');
    assert.equal(R.at().seq, 4, 'nothing saved');
    const was = played();
    t.tick(30);
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { beat: true }, { pass: fresh })).status, 200);
    assert.deepEqual(played(), was, 'the beat credits a signed-out session nothing');
  } finally { t.done(); }
});

test('SESSION-SIGN a pass is believed on the hot routes alone, in its own secret\'s hands alone, and minted off the primary\'s lookup alone: another route asks the lookup and mints none; a bookmarked session\'s lookup (a replica\'s) mints none; another account\'s secret, an altered pass, another service\'s, one past its time or PASS_RENEW_S or less from it, one past PASS_MAX_CHARS is no refusal - the lookup answers, and a new pass rides back (mutants: believed everywhere; minted off a replica; the secret out of the MAC; the MAC unchecked; the time unread; the renewal unread; the bound unread)', async () => {
  const t = await stand();
  try {
    const eve = await t.s.registered('eve');
    const bob = await t.s.registered('bob');
    const hb = await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true });
    const pass = hb.pass;
    assert.ok(pass, 'a session begun at the primary: a pass');
    // a bookmarked session: its lookup is a replica's, which may stand before a sign-out
    const marked = await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { headers: { 'x-d1-bookmark': MARK } });
    assert.deepEqual([marked.status, marked.lookups, marked.pass], [200, 1, null], 'a replica\'s lookup: no pass');
    // another route: the lookup, no pass minted
    const acct = await t.ask('POST', '/v1/renown/xp', eve.secret, { character: 'c', xp: 0, rid: '00000000000000a1' }, { pass });
    assert.equal(acct.lookups, 1, 'a claim keeps the lookup');
    assert.equal(acct.pass, null, 'and is handed no pass');
    assert.equal(passRoute('/v1/auth/token', 'POST'), false, 'the mint keeps the lookup');
    assert.equal(passRoute('/v1/account', 'POST'), false, 'the account view keeps it');
    assert.equal(passRoute('/v1/realm/r0123456789abcdef0123/data', 'GET'), false, 'a checkpoint is a PUT');
    // another secret: the lookup answers its own account
    const other = await t.ask('POST', '/v1/heartbeat', bob.secret, { mail: true }, { pass });
    assert.equal(other.lookups, 1, 'bob\'s secret with eve\'s pass: the lookup');
    assert.ok(other.pass && other.pass !== pass, 'bob\'s own pass back');
    // altered: the body says another account under eve's MAC
    const [, body, mac] = pass.split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    const forged = `p1.${Buffer.from(JSON.stringify({ ...claims, p: bob.id })).toString('base64url')}.${mac}`;
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass: forged })).lookups, 1, 'an altered pass: the lookup');
    const longer = `p1.${Buffer.from(JSON.stringify({ ...claims, x: claims.x + 86400 })).toString('base64url')}.${mac}`;
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass: longer })).lookups, 1, 'a pass stretched: the lookup');
    // another service's key
    const key2 = await subtle.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
    const foreign = await mintPass(key2, { player: { id: eve.id, handle: 'eve' }, session: { id: 's' } }, eve.secret, t.nowS(), subtle);
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass: foreign })).lookups, 1, 'another key\'s pass: the lookup');
    // the bound: one past it is never minted, nor believed
    const key = await passKey(t.s.env, subtle);
    assert.equal(await mintPass(key, { player: { id: eve.id, handle: 'e'.repeat(PASS_MAX_CHARS) }, session: { id: 's' } }, eve.secret, t.nowS(), subtle), null, 'too long to believe: never minted');
    const longBody = Buffer.from(JSON.stringify({ ...claims, h: 'e'.repeat(PASS_MAX_CHARS) })).toString('base64url');
    const longMac = Buffer.from(await subtle.sign('HMAC', key, new TextEncoder().encode(`p1.${longBody}.${eve.secret}`))).toString('base64url');
    assert.equal(await readPass(key, `p1.${longBody}.${longMac}`, eve.secret, t.nowS(), subtle), null, 'nor believed, though its MAC is the service\'s');
    assert.ok(await readPass(key, pass, eve.secret, t.nowS(), subtle), 'its own, within the bound: believed');
    // the time: believed until PASS_RENEW_S before its end, then the lookup and a new one
    t.tick(PASS_TTL_S - PASS_RENEW_S - 1);
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass })).lookups, 0, 'believed to its renewal');
    t.tick(1);
    const renewed = await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass });
    assert.equal(renewed.lookups, 1, 'at its renewal: the lookup');
    assert.ok(renewed.pass && renewed.pass !== pass, 'and the next pass');
    t.tick(PASS_RENEW_S + 1);
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass })).lookups, 1, 'past its end: the lookup');
    assert.equal(await readPass(key, 'not a pass', eve.secret, t.nowS(), subtle), null, 'not a pass: none');
  } finally { t.done(); }
});

test('SESSION-SIGN the lag the owner took, on the reads: a sign-out of every device and a ban reach the mint and every other route at once, and a hot route\'s reads at its pass\'s renewal - under PASS_TTL_S - PASS_RENEW_S after the pass was minted; an unban is no lag at all (a banned account held no pass) (mutants: the renewal past the pass\'s end; five minutes longer)', async () => {
  const t = await stand();
  try {
    const eve = await t.s.registered('eve');
    const pass = (await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true })).pass;
    t.raw.prepare("UPDATE players SET banned_until = ?, ban_reason = 'spam' WHERE id = ?").run(T0 + 86400, eve.id);
    assert.equal((await t.ask('POST', '/v1/auth/token', eve.secret, {}, { pass })).status, 403, 'the mint refuses the ban at once');
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass })).status, 200, 'a hot route\'s reads believe their pass');
    t.tick(PASS_TTL_S - PASS_RENEW_S);
    const late = await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass });
    assert.deepEqual([late.status, late.body?.error, late.pass], [403, 'banned', null], 'and the ban at its renewal - no pass to hold it');
    t.raw.prepare('UPDATE players SET banned_until = NULL, ban_reason = NULL WHERE id = ?').run(eve.id);
    const back = await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true });
    assert.equal(back.status, 200, 'unbanned: at once');
    // a sign-out of every device
    const fresh = back.pass;
    assert.equal((await t.ask('POST', '/v1/auth/logout', eve.secret, { all: true })).status, 200);
    assert.equal((await t.ask('POST', '/v1/auth/token', eve.secret, {}, { pass: fresh })).status, 401, 'the mint: signed out at once');
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass: fresh })).status, 200, 'a hot route\'s reads: their pass');
    t.tick(PASS_TTL_S - PASS_RENEW_S);
    assert.equal((await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true }, { pass: fresh })).status, 401, 'signed out at its renewal');
    assert.ok(PASS_TTL_S - PASS_RENEW_S < 300, 'the lag inside the owner\'s five minutes');
  } finally { t.done(); }
});

test('SESSION-SIGN the key is the service\'s own, drawn for passes alone: a service with no IDENTITY_PRIVATE_KEY mints none and believes none; the preflight lets a page send the header (mutants: the key drawn without the service\'s key; the preflight shut; the pass unexposed)', async () => {
  const t = await stand({ IDENTITY_PRIVATE_KEY: '' });
  try {
    _resetPassKeyForTests();
    assert.equal(await passKey(t.s.env, subtle), null, 'no key: no pass key');
    const eve = await t.s.guest();
    const hb = await t.ask('POST', '/v1/heartbeat', eve.secret, { mail: true });
    assert.equal(hb.status, 200);
    assert.equal(hb.pass, null, 'and no pass handed');
    const pre = await t.s.fetch('https://accounts.invalid/v1/heartbeat', { method: 'OPTIONS' });
    assert.match(pre.headers.get('access-control-allow-headers') ?? '', /(^|, )x-session-pass(,|$)/, 'the preflight lets a page send it');
  } finally { t.done(); }
});
