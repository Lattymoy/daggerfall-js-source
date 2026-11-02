// AUDIT FB1029f A1, A4 (FIELD BUGS 2026-10-29f REST-GUEST): A HOME'S ACCESS ROWS END WITH THE HOME. The rest row's id is
// the home's own (DECOR_REST_ID), not a piece's, so a row a home's end left behind named the next owner's home: the old
// owner's friend rested in a stranger's house. A sale clears them, a character's delete clears them, and every claim
// clears what no home holds (server-account/src/accessOrphans.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { realmAt } from '../realmSeat.mjs';
import { homeOnlinePrice } from '../../src/net/homeLaw.js';
import { DECOR_REST_ID } from '../../src/net/decorLaw.js';

const RICH = (name) => ({ name, level: 9, goldPieces: 10_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const H = { mapId: 1291010263, buildingKey: 0x10203 };
const price = homeOnlinePrice(150, 1);

async function town() {
  const S = await standService();
  const A = await S.seated('Aldric', { save: RICH('Aldric') });
  const M = await S.seated('Mara', { save: RICH('Mara') });
  const C = await S.seated('Cato', { save: RICH('Cato') });
  const claim = (who) => S.call('/v1/homes/claim', { ...H, region: 17, character: who.character, price, layout: null, realm: who.at() }, who.secret);
  const grants = async (who) => (await S.call('/v1/homes/decor/use', { ...H, character: who.character, op: 'grants' }, who.secret)).body;
  const rows = () => S.env.DB._raw.prepare('SELECT piece_id, kind FROM decor_access WHERE map_id = ? AND building_key = ?').all(H.mapId, H.buildingKey).map((r) => ({ ...r }));
  assert.equal((await claim(A)).status, 200);
  const set = await S.call('/v1/homes/decor/use', { ...H, character: A.character, op: 'set', id: DECOR_REST_ID, kind: 'rest', mode: 'chosen_friends', names: ['Mara'] }, A.secret);
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal((await grants(M)).rest, true, 'Mara, named, may rest at Aldric\'s');
  return { S, A, M, C, claim, grants, rows };
}

test('AUDIT FB1029f A1: a character deleted takes its homes\' access rows with them, and the next owner of the building inherits no one\'s rest (mutants: AUDITFB1029F-A1-delete-keeps-rows, AUDITFB1029F-A1-claim-keeps-orphans)', async () => {
  const { S, A, M, C, claim, grants, rows } = await town();
  assert.equal((await S.call('/v1/realm/delete', { id: A.character }, A.secret)).status, 200);
  assert.deepEqual(rows(), [], 'gone with the home');
  // a row a delete before this fix left behind: the claim itself clears what no home holds
  S.env.DB._raw.prepare(`INSERT INTO decor_access (map_id, building_key, piece_id, kind, mode, friends) VALUES (?, ?, ?, 'rest', 'guild', '[]')`).run(H.mapId, H.buildingKey, DECOR_REST_ID);
  assert.equal((await claim(C)).status, 200);
  assert.deepEqual(rows(), [], 'the orphan cleared by the claim');
  assert.equal((await grants(M)).rest, false, 'Mara is a stranger to Cato\'s home');
  assert.deepEqual((await grants(C)).use ?? [], [], 'and Cato reads no list he never set');
});

test('AUDIT FB1029f A4: a home sold takes its rest row with it - bought again by another account, the old friend is a stranger (mutant: AUDITFB1029F-A4-sale-keeps-rows)', async () => {
  const { S, A, M, C, claim, grants, rows } = await town();
  const sold = await S.call('/v1/homes/release', { ...H, realm: realmAt(S.env, A.character) }, A.secret);
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.deepEqual(rows(), [], 'gone with the sale');
  assert.equal((await claim(C)).status, 200);
  assert.equal((await grants(M)).rest, false);
});
