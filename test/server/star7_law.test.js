// STAR7 (bible/11-Multiplayer/Starfall.md section 6): A HELD STAR'S SPOILS ARE LAWFUL ON THE ACCOUNT SERVICE - the Weir Key's
// lesson (FIELD BUGS 2026-10-17 KEY-LAW): the item law runs on the service, which loads none of the game, so a template
// only a client's home registers was no template there, and every realm character that carried one had its trading held.
// A checkpoint carrying Starglass (template 576, read from its leaf) and a piece of the Starspun Weave holds nothing and
// finds nothing. tools/mutants/star7.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { STARGLASS_LAW_ROW } from '../../src/systems/starfall/starglassRow.js';
import { STARSPUN_SET_PIECES, mintAetheric } from '../../src/systems/aetheric.js';

/** A Starfall Glass stack as the client mints it (systems/starfall/starglass.js starglass) - written out, since this process
 *  must not import its home: the service never does, and the registry would answer for the row. AUDIT STAR I1: its name the
 *  star's own now (the sea's good is Starglass). */
const glass = (n) => ({ group: 'UselessItems2', templateIndex: STARGLASS_LAW_ROW.index, name: 'Starfall Glass', value: STARGLASS_LAW_ROW.basePrice, maxCondition: 1000, currentCondition: 1000, stackCount: n });

test('STAR7 THE LAW ON THE SERVICE: a realm checkpoint carrying Starglass and a Starspun piece holds nothing and finds nothing, as the service loads the law (mutants: the leaf unread)', async () => {
  const now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  try {
    const s = await standService();
    const raw = s.env.DB._raw;
    const who = await s.registered('starholder');
    const R = await seatRealm(s.env, who.secret, 'starholder');
    const at = R.at();
    const items = [glass(4), JSON.parse(JSON.stringify(mintAetheric(STARSPUN_SET_PIECES[3]))), JSON.parse(JSON.stringify(mintAetheric(STARSPUN_SET_PIECES[8])))];
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(freshSave({ name: who.handle, items })),
    }), s.env);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).tradeHeld ?? null, null, 'no hold');
    const row = raw.prepare('SELECT held, strikes FROM realm_characters WHERE id = ?').get(R.id);
    assert.deepEqual([row.held, row.strikes], [null, 0]);
    assert.deepEqual(raw.prepare('SELECT detail FROM realm_findings WHERE char_id = ? AND kind = ?').all(R.id, 'law'), [], 'no finding');
  } finally { Date.now = realNow; }
});
