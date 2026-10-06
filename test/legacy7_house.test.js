// LEGACY7 part two (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9): A HOUSE NAME ONLINE - the law both ends share
// (src/net/houseLaw.js), the identity token's claims (identityToken.js), the relay's stamp (wire.js badged) and the
// client's read, the account service's mint and roster (server-account/src/legacy.js realmHouseOf, realm.js listRealm) on
// the real Worker over the real migrations, and the three faces: over the head, the inspect card, the roster's tile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  houseClaimOk, readHouse, romanOf, houseLine, houseOfRecord, houseNameOk, BLOODLINE_MARK, HOUSE_GEN_MAX, HOUSE_NAME_MAX,
} from '../src/net/houseLaw.js';
import { mintToken, verifyToken, claimsValid, TOKEN_MAX_CHARS } from '../src/net/identityToken.js';
import { badged, readHouse as wireReadHouse } from '../src/net/wire.js';
import { standService } from './accountDb.mjs';
import { profileView } from '../src/ui/profileWindow.js';
import { realmRowAsSave } from '../src/systems/realmSaves.js';
import { realmHouseOf } from '../server-account/src/legacy.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const FAM = 'fam-k1x2y3-abc123';

test('LEGACY7 the house\'s law: its claims\' shapes, read back from a row, its numeral, its line - a Bloodline marked, a seat\'s house as itself', () => {
  assert.equal(houseClaimOk({}), true, 'none');
  assert.equal(houseClaimOk({ hc: 'Ysolde' }), false, 'nothing without the house');
  assert.equal(houseClaimOk({ hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 }), true);
  for (const bad of [{ hn: '' }, { hn: 'x'.repeat(HOUSE_NAME_MAX + 1) }, { hn: 'Hla<b>' }, { hn: 'Hlaalu', hb: 0 }, { hn: 'Hlaalu', hg: 1 }, { hn: 'Hlaalu', hg: HOUSE_GEN_MAX + 1 }, { hn: 'Hlaalu', hc: '1x' }, { hn: 'Two  Spaces' }]) {
    assert.equal(houseClaimOk(bad), false, JSON.stringify(bad));
  }
  assert.ok(houseNameOk("Dres-Indoril") && houseNameOk('of Sentinel') && houseNameOk("O'Brien"));
  assert.deepEqual(readHouse({ hn: 'Hlaalu', hb: 1, other: 3 }), { hn: 'Hlaalu', hb: 1 });
  assert.equal(readHouse({ hn: 'Hla<b>' }), null, 'a stranger\'s word that does not fit');
  assert.equal(readHouse(null), null);
  assert.deepEqual([2, 4, 9, 14, 19, 20].map(romanOf), ['II', 'IV', 'IX', 'XIV', 'XIX', 'XX']);
  assert.equal(houseLine({ hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 }), `${BLOODLINE_MARK} Ysolde II of House Hlaalu`);
  assert.equal(houseLine({ hn: 'Hlaalu' }), 'of House Hlaalu');
  assert.equal(houseLine({ hn: 'of Sentinel', hc: 'Iszara' }), 'Iszara of Sentinel', 'a seat\'s house reads as itself');
  assert.equal(houseLine(null), null);
});

test('LEGACY7 a member\'s house off the line\'s record: the surname, the given name, the Bloodline, and the numeral from the second of a name', () => {
  const rec = { surname: 'Hlaalu', model: 'bloodline', people: [
    { id: 1, given: 'Ysolde' }, { id: 2, given: 'Aldo', kind: 'resident' }, { id: 3, given: 'Ysolde', kind: 'resident' }, { id: 4, given: 'Ysolde' }, { id: 5, given: 'Ilse' },
  ] };
  assert.deepEqual(houseOfRecord(rec, 1), { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 });
  assert.deepEqual(houseOfRecord(rec, 4), { hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 }, 'the second Ysolde - one wed in never counted');
  assert.deepEqual(houseOfRecord({ ...rec, model: 'enduring' }, 5), { hn: 'Hlaalu', hc: 'Ilse' });
  assert.equal(houseOfRecord(rec, 99), null);
  assert.equal(houseOfRecord({ ...rec, surname: 'Bad<' }, 1), null);
});

test('LEGACY7 the token carries the house - verified, a bad one refused at the minter; the relay stamps it on a row and a client reads it back', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const who = { s: 'p0123456789abcdef', n: 'Mira', k: 'guest' };
  const tok = await mintToken({ ...who, hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 }, kp.privateKey, { subtle, nowS });
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS });
  assert.equal(v.ok, true);
  assert.deepEqual([v.claims.hn, v.claims.hc, v.claims.hb, v.claims.hg], ['Hlaalu', 'Ysolde', 1, 2]);
  const plain = await mintToken(who, kp.privateKey, { subtle, nowS });
  assert.equal('hn' in (await verifyToken(plain, kp.publicKey, { subtle, nowS })).claims, false, 'a character of no line: the bytes as before');
  await assert.rejects(mintToken({ ...who, hn: 'Hla<b>' }, kp.privateKey, { subtle, nowS }), /refused/);
  assert.equal(claimsValid({ ...who, i: nowS, e: nowS + 60, hc: 'Ysolde' }), false, 'a given name with no house');
  assert.equal(TOKEN_MAX_CHARS, 1024);
  const row = badged({ id: 'a' }, { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 });
  assert.deepEqual(wireReadHouse(row), { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 });
  assert.equal('hn' in badged({ id: 'b' }, { hn: 'Hla<b>' }), false, 'never a house the law refuses');
});

test('LEGACY7 the service signs a realm character\'s house into its token and onto its tile - never one of no line, a tombstone\'s, or a name the filter refuses', async () => {
  const S = await standService();
  const g = await S.guest();
  const call = (p, b) => S.call(p, b, g.secret);
  const record = (surname, people, model = 'bloodline') => ({ v: 1, id: FAM, surname, model, rev: 1, people });
  await call('/v1/realm/lineage', { id: FAM, record: record('Hlaalu', [{ id: 1, given: 'Ysolde' }, { id: 2, given: 'Ysolde' }]) });
  const a = (await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: FAM, person: 2 })).body;
  const claims = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
  const minted = (await call('/v1/auth/token', { character: a.id })).body;
  assert.deepEqual([claims(minted.token).hn, claims(minted.token).hc, claims(minted.token).hb, claims(minted.token).hg], ['Hlaalu', 'Ysolde', 1, 2]);
  assert.deepEqual(minted.house, { hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 }, 'the answer says the house my token wears');
  const tiles = (await S.fetch('https://accounts.invalid/v1/realm', { headers: { authorization: `Bearer ${g.secret}` } }).then((r) => r.json())).characters;
  assert.deepEqual(tiles[0].house, { hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 }, 'and its tile');
  const stranger = (await call('/v1/realm/create', { name: 'Stranger' })).body;
  const none = (await call('/v1/auth/token', { character: stranger.id })).body;
  assert.equal('hn' in claims(none.token), false, 'a character of no line wears none');
  assert.equal(none.house, null);
  // a surname the name filter refuses is never shown to anyone
  const BAD = 'fam-k9-abc123';
  await call('/v1/realm/lineage', { id: BAD, record: { ...record('Cum', [{ id: 1, given: 'Ysolde' }]), id: BAD } });
  const c = (await call('/v1/realm/create', { name: 'Ysolde', lineage: BAD, person: 1 })).body;
  assert.equal('hn' in claims((await call('/v1/auth/token', { character: c.id })).body.token), false, 'the filter\'s law');
  // a tombstone wears nothing
  await call('/v1/realm/die', { id: c.id, lease: c.lease });
  assert.equal((await call('/v1/auth/token', { character: c.id })).body.house, null);
  // ...asked of the house's own door, not only behind the mint's `rc`
  const aLease = (await call('/v1/realm/join', { id: a.id })).body.lease;
  assert.deepEqual(await realmHouseOf({ db: S.env.DB }, g.id, a.id), { hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 });
  await call('/v1/realm/die', { id: a.id, lease: aLease });
  assert.equal(await realmHouseOf({ db: S.env.DB }, g.id, a.id), null, 'a tombstone\'s house is worn by nobody');
});

test('LEGACY7 the faces: the inspect card\'s line, the roster\'s tile, and the nameplate\'s line by source', () => {
  const v = profileView({ name: 'Mira', peer: { house: { hn: 'Hlaalu', hc: 'Ysolde', hb: 1, hg: 2 } } });
  assert.equal(v.house, `${BLOODLINE_MARK} Ysolde II of House Hlaalu`);
  assert.equal(profileView({ name: 'Mira', peer: {} }).house, null);
  assert.equal(realmRowAsSave({ id: 'r1', name: 'Ysolde Hlaalu', house: { hn: 'Hlaalu', hc: 'Ysolde' } }).house, 'Ysolde of House Hlaalu');
  assert.equal(realmRowAsSave({ id: 'r1', name: 'X' }).house, null);
  const layer = rd('src/ui/nameLayer.js');
  assert.match(layer, /setText\(tag\.house, houseLine\(p\.house\) \?\? ''\);/);
  assert.match(layer, /node\.append\(bubble, title, tag, house, ribbon\);/);
  assert.match(rd('src/net/remotePlayers.js'), /house: e\.peer\.house \?\? null,/);
  assert.match(rd('src/net/online.js'), /p\.house = readHouse\(m\);/);
  assert.match(rd('src/ui/saveTile.js'), /if \(save\?\.house\) who\.append\(el\('p', 'svhouse', save\.house\)\);/);
  assert.match(rd('server/src/index.js'), /const house = c\.hn \? \{ hn: c\.hn,/);
});
