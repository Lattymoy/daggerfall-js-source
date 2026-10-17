// NAME-AS (2026-10-12, Mac: "I want to add an option to the profile menu where players can toggle to use their account
// name or character name for ingame use"): THE SERVICE'S HALF. The room reads the token's `n` (ACC1g: no client writes
// it), so the choice is the account row's (`name_as`, migration 0111) and the mint signs it - the account's name, or the
// realm character's own the token is minted for, where the wire carries it as it stands and it is no other account's
// username (accounts.js wornNameOf); otherwise the account's, and the answer says why. And the two places a name stood
// in for an account - a friend's letter, a board note's duel - find the account itself (letters.js `toAccount`,
// board.js `by`). tools/mutants/nameas.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { claimsValid } from '../../src/net/identityToken.js';
import { NAME_MAX } from '../../src/net/wire.js';
import { accountRefusalText, REFUSALS } from '../../src/net/accountClient.js';
import { NAME_AS, nameAsOf, wornNameRefusal, wornNameOf } from '../../server-account/src/accounts.js';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';

const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('NAME-AS the law: two choices, the account\'s by default; a character\'s name is worn only where the wire carries it as it stands - each refusal told apart, the filter\'s with the word it caught (mutants: an unknown word read as the character\'s; an email worn; the long refusal unread; the caught word dropped)', () => {
  assert.deepEqual(NAME_AS, ['account', 'character']);
  assert.equal(nameAsOf({}), 'account', 'a row that never chose reads as every player read before');
  assert.equal(nameAsOf({ name_as: null }), 'account');
  assert.equal(nameAsOf({ name_as: 'character' }), 'character');
  assert.equal(nameAsOf({ name_as: 'handle' }), 'account', 'a word no build wrote is the account\'s');
  for (const ok of ['Mithriil', 'Ysolde Hlaalu', 'A'.repeat(NAME_MAX), 'Cumberland', 'Hrothgar the Bold']) assert.equal(wornNameRefusal(ok), null, ok);
  assert.deepEqual(wornNameRefusal('A'.repeat(NAME_MAX + 1)), { why: 'long' });
  assert.deepEqual(wornNameRefusal('Ysöldé'), { why: 'letters' }, 'an accent the wire drops');
  assert.deepEqual(wornNameRefusal('___'), { why: 'letters' }, 'no letters at all');
  assert.deepEqual(wornNameRefusal('C0ck'), { why: 'refused', word: 'cock' }, 'NAME-F: the refusal names the word');
  assert.deepEqual(wornNameRefusal('Admin'), { why: 'refused', word: 'admin' }, 'the server\'s own words are nobody\'s');
  assert.deepEqual(wornNameRefusal('ysolde@mail.com'), { why: 'email' }, 'HANDLE-EMAIL: an address is never read out');
  assert.deepEqual(wornNameRefusal(42), { why: 'letters' });
});

test('NAME-AS the route: /v1/account/name keeps the choice on the row, the account view says it, a word that is neither is refused with a sentence, and a stranger is refused (mutants: the choice unwritten; `account` stored as a word; the view silent)', async () => {
  const S = await standService();
  const me = await S.registered('Lattymoy');
  assert.ok(ROUTES.has('/v1/account/name') && !OPEN_ROUTES.has('/v1/account/name'), 'behind a session');
  const view = async () => (await S.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${me.secret}` } })).json();
  const row = () => S.env.DB._raw.prepare('SELECT name_as FROM players WHERE id = ?').get(me.id).name_as;
  assert.equal((await view()).account.nameAs, 'account', 'the account\'s until chosen');
  assert.equal(row(), null);
  let r = await S.call('/v1/account/name', { as: 'character' }, me.secret);
  assert.deepEqual([r.status, r.body], [200, { ok: true, nameAs: 'character' }]);
  assert.equal(row(), 'character');
  assert.equal((await view()).account.nameAs, 'character');
  r = await S.call('/v1/account/name', { as: 'account' }, me.secret);
  assert.deepEqual([r.status, r.body], [200, { ok: true, nameAs: 'account' }]);
  assert.equal(row(), null, 'the account\'s is no word on the row - as every row that never chose');
  for (const bad of [{ as: 'handle' }, { as: null }, {}, { as: ['character'] }]) {
    r = await S.call('/v1/account/name', bad, me.secret);
    assert.deepEqual([r.status, r.body], [400, { error: 'no-name-as' }], JSON.stringify(bad));
  }
  assert.equal(row(), null, 'a refusal writes nothing');
  assert.equal((await S.call('/v1/account/name', { as: 'character' })).status, 401, 'signed in or nothing');
  assert.ok(REFUSALS['no-name-as'] && accountRefusalText('no-name-as') === REFUSALS['no-name-as'], 'a sentence for the word');
});

test('NAME-AS the mint: the account\'s name until the character\'s is chosen; then the realm character\'s own, signed into a token the relay\'s law admits, with the account\'s beside it in the answer - never a name the request says, and none for a character that is not this account\'s in play (mutants: the mint signs the account\'s whatever the choice; the answer\'s `name` the account\'s while the token says the character\'s; the body\'s name worn; another account\'s character worn)', async () => {
  const S = await standService();
  const me = await S.registered('Lattymoy');
  const other = await S.registered('Brannoc');
  const R = await seatRealm(S.env, me.secret, 'Mithriil');
  const theirs = await seatRealm(S.env, other.secret, 'Not Mine');
  const mint = async (body) => {
    const t = await S.call('/v1/auth/token', body, me.secret);
    assert.equal(t.status, 200, JSON.stringify(t.body));
    const c = claimsOf(t.body.token);
    assert.ok(claimsValid(c), 'a token the relay\'s own law admits');
    return { c, a: t.body };
  };
  let { c, a } = await mint({ character: R.id });
  assert.equal(c.n, 'Lattymoy', 'the account\'s name until the player chooses otherwise');
  assert.deepEqual([a.name, a.accountName, a.nameAs, 'nameWhy' in a], ['Lattymoy', 'Lattymoy', 'account', false]);
  assert.equal((await S.call('/v1/account/name', { as: 'character' }, me.secret)).status, 200);
  ({ c, a } = await mint({ character: R.id }));
  assert.equal(c.n, 'Mithriil', 'the realm character\'s own name, off its row');
  assert.equal(c.s, me.id, 'still the account\'s token - the subject is the account, the name is the room\'s');
  assert.deepEqual([a.name, a.accountName, a.nameAs, 'nameWhy' in a], ['Mithriil', 'Lattymoy', 'character', false], 'the answer: the room\'s name, the account\'s beside it, the choice');
  ({ c, a } = await mint({ character: R.id, name: 'SquidKamer', n: 'SquidKamer' }));
  assert.equal(c.n, 'Mithriil', 'a name in the request body never reaches the token');
  ({ c, a } = await mint({}));
  assert.equal(c.n, 'Lattymoy', 'no character named: the account\'s - nothing to wear yet');
  assert.equal('nameWhy' in a, false, 'and silently: that is no refusal');
  ({ c, a } = await mint({ character: theirs.id }));
  assert.deepEqual([c.n, c.rc], ['Lattymoy', 0], 'another account\'s character is none of mine to wear');
  // a character not in play (another of mine joined since) is none either - the lease is the mint's word on "in play"
  const R2 = await seatRealm(S.env, me.secret, 'Second Self');
  ({ c } = await mint({ character: R.id }));
  assert.deepEqual([c.n, c.rc], ['Lattymoy', 0], 'its lease went to the one joined since');
  ({ c } = await mint({ character: R2.id }));
  assert.equal(c.n, 'Second Self', 'and the one in play wears its own');
});

test('NAME-AS the fallbacks: a character\'s name the wire cannot carry, the filter refuses, or another account holds as a username stands aside for the account\'s - the answer says which, once per mint; the player\'s own username is theirs to wear (mutants: the username guard gone; the guard blind to case; my own username refused as taken; an unissuable name signed - a player who cannot connect)', async () => {
  const S = await standService();
  const me = await S.registered('Lattymoy');
  await S.registered('SquidKamer');
  assert.equal((await S.call('/v1/account/name', { as: 'character' }, me.secret)).status, 200);
  const raw = S.env.DB._raw;
  const R = await seatRealm(S.env, me.secret, 'Placeholder');
  const wear = async (name) => {
    raw.prepare('UPDATE realm_characters SET name = ? WHERE id = ?').run(name, R.id);
    const t = await S.call('/v1/auth/token', { character: R.id }, me.secret);
    assert.equal(t.status, 200, JSON.stringify(t.body));
    const c = claimsOf(t.body.token);
    assert.ok(claimsValid(c), `${name}: a token the relay admits, whatever the character is called`);
    return { n: c.n, why: t.body.nameWhy ?? null, word: t.body.nameWord ?? null, name: t.body.name };
  };
  assert.deepEqual(await wear('squidkamer'), { n: 'Lattymoy', why: 'taken', word: null, name: 'Lattymoy' }, 'another account\'s username, whatever its case');
  assert.deepEqual(await wear('SquidKamer'), { n: 'Lattymoy', why: 'taken', word: null, name: 'Lattymoy' });
  assert.deepEqual(await wear('LATTYMOY'), { n: 'LATTYMOY', why: null, word: null, name: 'LATTYMOY' }, 'my own username is mine to wear');
  assert.deepEqual(await wear('Squid Kamer'), { n: 'Squid Kamer', why: null, word: null, name: 'Squid Kamer' }, 'a name with a space is never a username');
  assert.deepEqual(await wear('A'.repeat(NAME_MAX + 3)), { n: 'Lattymoy', why: 'long', word: null, name: 'Lattymoy' });
  assert.deepEqual(await wear('Ysöldé'), { n: 'Lattymoy', why: 'letters', word: null, name: 'Lattymoy' });
  assert.deepEqual(await wear('Cum'), { n: 'Lattymoy', why: 'refused', word: 'cum', name: 'Lattymoy' });
  assert.deepEqual(await wear('ysolde@mail.com'), { n: 'Lattymoy', why: 'email', word: null, name: 'Lattymoy' });
  assert.deepEqual(await wear('Mithriil'), { n: 'Mithriil', why: null, word: null, name: 'Mithriil' }, 'and a name that can be worn is');
  // the law itself, driven directly: none chosen is the account's whatever the character is called
  const db = S.env.DB;
  assert.deepEqual(await wornNameOf({ db }, { id: me.id, handle: 'Lattymoy', guest_name: 'Hrothgar Larethbinder' }, 'Mithriil'), { name: 'Lattymoy' });
  assert.deepEqual(await wornNameOf({ db }, { id: 'gu-123456', handle: null, guest_name: 'Hrothgar Larethbinder', name_as: 'character' }, 'Mithriil'), { name: 'Mithriil' }, 'a guest may wear their character\'s name too');
  assert.deepEqual(await wornNameOf({ db }, { id: 'gu-123456', handle: null, guest_name: 'Hrothgar Larethbinder', name_as: 'character' }, null), { name: 'Hrothgar Larethbinder' });
});

test('NAME-AS a letter to a friend, by account: the reader found by id - registered (a guest has no letterbox, said in its own words), named back as the world reads their account (never an address) - while a letter by username is as it was (mutants: a guest\'s row taken as a reader; the answer naming the handle)', async () => {
  const S = await standService();
  const me = await S.registered('Writer');
  const friend = await S.registered('Reader');
  const guest = await S.guest();
  const send = (body, who = me) => S.call('/v1/mail/send', { subject: 'Hello', body: 'Meet me at the gate.', ...body }, who.secret);
  let r = await send({ toAccount: friend.id });
  assert.deepEqual([r.status, r.body.ok, r.body.to], [200, true, 'Reader'], JSON.stringify(r.body));
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM letters WHERE to_id = ?').get(friend.id).n, 1, 'it reached the account');
  r = await send({ toAccount: guest.id });
  assert.deepEqual([r.status, r.body], [404, { error: 'reader-guest' }]);
  assert.ok(REFUSALS['reader-guest'], 'a sentence for it');
  r = await send({ toAccount: 'nobody-at-all' });
  assert.deepEqual([r.status, r.body], [404, { error: 'no-reader' }]);
  r = await send({ toAccount: 'not an id!' });
  assert.deepEqual([r.status, r.body], [404, { error: 'no-reader' }], 'an id of no account shape is no reader - and no username either');
  r = await send({ toAccount: me.id });
  assert.deepEqual([r.status, r.body], [400, { error: 'to-self' }]);
  // HANDLE-EMAIL: a friend whose username is an address is written to, and named back by the name the world reads
  S.env.DB._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run('reader@mail.com', 'reader@mail.com', friend.id);
  const shown = S.env.DB._raw.prepare('SELECT guest_name FROM players WHERE id = ?').get(friend.id).guest_name;
  r = await send({ toAccount: friend.id });
  assert.deepEqual([r.status, r.body.to], [200, shown], 'the address is never read out');
  // by username, unchanged
  const third = await S.registered('Thirdly');
  r = await send({ to: 'thirdly' });
  assert.deepEqual([r.status, r.body.to], [200, 'Thirdly'], 'a username typed is answered by the handle it found');
  assert.equal(third.id.length > 0, true);
});

test('NAME-AS a board note names its author\'s account beside the name it was signed with, so its duel finds the author among the players here by account (mutants: `by` dropped)', async () => {
  const S = await standService({ BOARD_OPEN: 'on' });
  const author = await S.registered('Pinner');
  const reader = await S.registered('Looker');
  const map = 1234567;
  const pinned = await S.call('/v1/board/pin', { map, subject: 'A duel', body: 'Meet me by the fountain.', days: 1, button: 'duel', rid: 'n1abcdefghijklmn' }, author.secret);
  assert.equal(pinned.status, 200, JSON.stringify(pinned.body));
  const read = await S.call('/v1/board/read', { map }, reader.secret);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  const note = read.body.notes.find((n) => n.subject === 'A duel');
  assert.ok(note, 'the note is on the board');
  assert.deepEqual([note.from, note.by], ['Pinner', author.id], 'the name it was signed with, and the account behind it');
  assert.match(src('server-account/src/board.js'), /from: n\.author_name, by: n\.author,/);
});
