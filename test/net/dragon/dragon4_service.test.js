// DRAGON4 (bible/11-Multiplayer/Dwarven-Dragon.md section 8): THE DRAGON'S CLAIM ON THE ACCOUNT SERVICE - over node:sqlite with
// every migration applied (test/accountDb.mjs): server-account/src/dragons.js claimDragon counts a z1 receipt once a (watch,
// account), gives its hoard to the claim whose device id wrote the row, draws the tame off its own randomness for a
// dealer's first write alone - one a character - and names the watch's tame at every answer while its row stands; and the
// real route answers it. tools/mutants/dragon4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { d1, standService } from '../../accountDb.mjs';
import { createGuest } from '../../../server-account/src/accounts.js';
import { claimDragon, dragonTameRoll, dragonRecordOf, dragonMountsOf, DRAGON_TAME_ONE_IN, DRAGON_TAME_SALT } from '../../../server-account/src/dragons.js';
import { SERPENT_HONOURS_SALT } from '../../../server-account/src/serpents.js';
import { mintDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../../src/net/identityToken.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const T0 = 1_800_000_000;
const W = 500_004;
let _n = 0;
const member = async (db, { handle = true } = {}) => {
  const id = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  if (!handle) return { id, handle: null };
  const h = `Wyrm${++_n}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}
/** A seed whose draw tames (or does not). */
const seedFor = (tames) => { for (let c = 1; c < 100_000; c++) if (dragonTameRoll(c) === tames) return c; throw new Error('no seed'); };
/** The claim's four-byte draw answered with `seed`, every other ask at random. */
const rolling = (seed) => (b) => (b.length === 4 ? (b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]), b) : rand(b));
const receipt = (s, key, { w = W, x = 'dealt', b = 0 } = {}) => mintDragonReceipt({ q: w, b, s, c: 77, x, l: 20 }, key, { subtle, nowS: T0 });
const CID = 'a1b2c3d4e5f60718', CID2 = '0f0e0d0c0b0a0908';
const claim = (db, seed, who, r, pubKey, o = {}) => claimDragon({ db, nowS: T0 + 60, subtle, rand: rolling(seed) }, who, { receipt: r, character: o.character ?? 'char-0001', cid: o.cid ?? CID }, pubKey);

test('DRAGON4 the tame\'s roll: one dealing kill in DRAGON_TAME_ONE_IN, off its own stream (salted \'TAME\' - never the serpent\'s honours\') (mutants: the chance; the salt)', () => {
  assert.equal(DRAGON_TAME_ONE_IN, 100);
  assert.equal(DRAGON_TAME_SALT, 0x54414d45);
  assert.notEqual(DRAGON_TAME_SALT, SERPENT_HONOURS_SALT);
  let n = 0;
  for (let c = 0; c < 100_000; c++) if (dragonTameRoll(c)) n++;
  assert.ok(n > 850 && n < 1150, `about one in a hundred (${n} of 100,000)`);
});

test('DRAGON4 THE CLAIM: counted once a (watch, account) - a second claim answers `claimed`; the hoard to the claim whose device id wrote its row; a dealer\'s first write draws the tame, one a character, and every answer while its row stands names it; a stander draws none; a guest is given its hoard and nothing else; another\'s receipt and a bad character refused (mutants: counted twice; the hoard to any device; a stander tamed; two dragons a character; the tame untold at a re-claim; a guest counted)', async () => {
  const db = d1();
  const { priv, pubKey } = await relayPair();
  const a = await member(db);
  const tameSeed = seedFor(true), plainSeed = seedFor(false);
  const r1 = await receipt(a.id, priv);
  const first = await claim(db, tameSeed, a, r1, pubKey);
  assert.equal(first.recorded, true);
  assert.equal(first.slain, 1);
  assert.equal(first.spoils, true, 'its hoard this claim\'s');
  assert.ok(/^dg[0-9a-f]{16}$/.test(first.tamed?.id) && first.tamed.look === 0 && first.tamed.character === 'char-0001', JSON.stringify(first.tamed));
  const again = await claim(db, tameSeed, a, r1, pubKey, { cid: CID2 });
  assert.deepEqual([again.recorded, again.why, again.slain, again.spoils, again.tamed?.id], [false, 'claimed', 1, false, first.tamed.id], 'claimed; another device\'s hoard refused; its tame told again');
  const same = await claim(db, tameSeed, a, r1, pubKey);
  assert.equal(same.spoils, true, 'the device that wrote the hoard is answered it again');
  // the next watch: its draw tames again, but this character holds one already
  const second = await claim(db, tameSeed, a, await receipt(a.id, priv, { w: W + 3 }), pubKey);
  assert.deepEqual([second.recorded, second.slain, second.tamed], [true, 2, null], 'one dragon a character');
  const other = await claim(db, tameSeed, a, await receipt(a.id, priv, { w: W + 6, b: 1 }), pubKey, { character: 'char-0002' });
  assert.deepEqual([other.tamed?.look, other.tamed?.character], [1, 'char-0002'], 'another character of the account tames its own - the Aetherbright keeps its look');
  assert.deepEqual(await dragonRecordOf({ db }, a.id), { slain: 3, tamed: 2 });
  assert.deepEqual((await dragonMountsOf({ db }, a.id)).map((m) => [m.character, m.look, m.watch]), [['char-0001', 0, W], ['char-0002', 1, W + 6]]);
  // a stander: no tame whatever the draw
  const b = await member(db);
  const stood = await claim(db, tameSeed, b, await receipt(b.id, priv, { x: 'stood' }), pubKey);
  assert.deepEqual([stood.recorded, stood.tamed], [true, null], 'a stander draws no tame');
  const c = await member(db);
  assert.equal((await claim(db, plainSeed, c, await receipt(c.id, priv), pubKey)).tamed, null, 'a draw that does not tame');
  // a guest
  const g = await member(db, { handle: false });
  const gr = await claim(db, tameSeed, g, await receipt(g.id, priv), pubKey);
  assert.deepEqual([gr.recorded, gr.why, gr.slain, gr.spoils, gr.tamed], [false, 'guest', 0, true, null]);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM dragon_kills WHERE account = ?').get(g.id).n, 0, 'never counted');
  // refusals
  assert.equal((await claim(db, tameSeed, b, r1, pubKey)).error, 'not-yours');
  assert.equal((await claim(db, tameSeed, a, r1, pubKey, { character: 'not a character' })).error, 'renown-character');
  assert.equal((await claimDragon({ db, nowS: T0, subtle, rand }, a, { receipt: r1, character: 'char-0001' }, null)).error, 'no-gate-key');
});

test('DRAGON4 THE ROUTE: /v1/dragon/claim behind a session, the session\'s account (never the body\'s), answered as the claim answers; listed among the service\'s routes; acct222 (mutants: the route unlisted)', async () => {
  const S = await standService();
  const who = await S.registered('Brassbane');
  const r = await mintDragonReceipt({ q: W, b: 0, s: who.id, c: 5, x: 'dealt', l: 12 }, S.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = await S.call('/v1/dragon/claim', { receipt: r, character: who.character, cid: CID }, who.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.recorded, res.body.slain, res.body.spoils], [true, 1, true]);
  assert.equal((await S.call('/v1/dragon/claim', { receipt: r, character: who.character }, null)).status, 401);
  const other = await S.registered('Coilhand');
  assert.equal((await S.call('/v1/dragon/claim', { receipt: r, character: other.character }, other.secret)).status, 403, 'not the receipt\'s account');
  assert.match(src('server-account/src/service.js'), /'\/v1\/dragon\/claim', \/\/ DRAGON4/);
  assert.match(src('server-account/migrations/0194_dragon.sql'), /UNIQUE \(account, char_id\)/);
});
