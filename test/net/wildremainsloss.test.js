// WILD-REMAINS-LOSS (bible/11-Multiplayer/Wild-Zone.md section 4, bible/01-Overview/bugs/Field-Bugs-2026-10-25h.md).
//
// THE LOSS: a room checked a deposit's order with its verifying key without loading it first. The key is loaded by a
// hello, and a room that woke from hibernation since its last hello held none - so it refused every chunk of every
// deposit (the fallen's own tab's and its killer's seizure alike), and the drop the service had taken off the fallen's
// record lay nowhere.
//
// THE NAME: a seizure's remains are named for the FALLEN. The room named a remains for the socket that laid it: its killer's seizure
// stood as "Traveller", and its `oid` - the carrier - made the killer's own game read it as "Your remains" while the
// fallen's never marked it. The service's order now carries the fallen character's name (`wnm`), the room names the
// remains with it whoever carries the order, and a game reads a remains as its own by the fallen's account alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { layRecord, realmAt } from '../realmSeat.mjs';
import { seeded } from '../honestItems.mjs';
import { fakeRooms } from '../fakeRoom.mjs';
import { assignStartingGear } from '../../src/systems/startingGear.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { wildChunks } from '../../src/systems/wild/wildDeath.js';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { remainsMine } from '../../src/net/wild/wildRemains.js';
import { mintWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { mintRemainsOrder, verifyOrder } from '../../src/net/identityToken.js';
import { validWildData, validWildOut, worldRoom, PIXEL_UNITS, WILD_ITEMS_MAX, WILD_DATA_MAX } from '../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';

const { subtle } = globalThis.crypto;
const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const M = SIEGE_UNITS_PER_M;
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const RID = '5e1a2b3c4d5f';
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

/** The room's `ri` words a socket heard, projected as its game reads them. */
const remainsHeard = (ws) => ws.sent.map((s) => validWildOut(s)).filter((o) => o?.k === 'ri');

/**
 * Riadne falls at Borin's hand and the room lays what the service took where she fell. `carrier` 'killer': her game was
 * closed, the relay signed the fall with her gone (`g` 1), and Borin's game carries the receipt at once - a SEIZURE;
 * 'fallen': her own tab takes her drop, as an act on her record. Both stand in the cell. `wake`: the room hibernates and
 * wakes after their hellos, before the deposit.
 */
async function fall({ carrier = 'killer', wake = false, charName = null, nameAs = null } = {}) {
  const world = fakeRooms();
  const r = world.room(CELL);
  const kp = await r.signer();   // the room verifies the service's orders with the key that signs its tokens
  const svc = await standService({ IDENTITY_PRIVATE_KEY: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') });
  const ria = await svc.seated('Riadne', { renown: 12 }), bo = await svc.registered('Borin');
  if (charName) svc.env.DB._raw.prepare('UPDATE realm_characters SET name = ? WHERE id = ?').run(charName, ria.character);
  if (nameAs) svc.env.DB._raw.prepare('UPDATE players SET name_as = ? WHERE id = ?').run(nameAs, ria.id);
  const e = { name: 'Riadne', gender: 'female', level: 9, items: [], wagonItems: [], goldPieces: 500 };
  assignStartingGear(e, { classIndex: 16, rolls: seeded(3) });   // the Warrior's kit
  stampItemIds(e);
  layRecord(svc.env, ria.character, JSON.parse(JSON.stringify(snapshotPlayer(e))));
  const seized = carrier === 'killer';
  const rc = await mintWildReceipt({ f: ria.id, c: ria.character, k: bo.id, r: RID, w: -1, ...(seized ? { g: 1 } : {}) }, svc.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = seized
    ? await svc.call('/v1/wild/fall', { receipt: rc, room: CELL }, bo.secret)
    : await svc.call('/v1/wild/fall', { receipt: rc, realm: realmAt(svc.env, ria.character), room: CELL, packs: 1, letters: 1 }, ria.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.ok(d.order && d.items.length, 'the carrier is handed an order and the records');
  const kb = r.connect(); await r.hello(kb, 'peer-0002', P(1), { tokenSub: bo.id, name: 'Borin' });
  const fa = r.connect(); await r.hello(fa, 'peer-0001', P(-1), { tokenSub: ria.id, name: 'Riadne', rc: 1, ci: ria.character });
  if (wake) r.wake();
  const by = seized ? kb : fa;
  const room = WILD_DATA_MAX - JSON.stringify({ k: 'fall', r: d.r, p: [0, 0, 0], items: [], last: 0, o: d.order }).length - 16;
  const chunks = wildChunks(d.items, WILD_ITEMS_MAX, room);
  for (let k = 0; k < chunks.length; k++) {
    await r.raw(by, JSON.stringify({ t: 'wild', data: validWildData({ k: 'fall', r: d.r, p: [BASE.x, 0, BASE.z], items: chunks[k], last: k === chunks.length - 1 ? 1 : 0, o: d.order }) }));
  }
  return { r, d, svc, ria, bo, kb, fa, kp };
}

for (const carrier of ['fallen', 'killer']) {
  test(`WILD-REMAINS-LOSS: a deposit carried by the ${carrier} to a room that woke from hibernation since its last hello is laid whole and said to the cell - the room loads its verifying key before it checks the order (mutant: the order checked with the key as the hello left it)`, () => quiet(async () => {
    const z = await fall({ carrier, wake: true });
    const kept = z.r.store.get(`wild:${z.d.r}`);
    assert.equal(kept?.ok, true, 'the remains vouched for');
    assert.equal(kept.items.length, z.d.items.length, 'every record the service took lies in them');
    assert.ok(remainsHeard(z.kb).length && remainsHeard(z.fa).length, 'the cell is told the remains');
  }));
}

test('WILD-REMAINS-LOSS: a seizure\'s remains are named for the fallen character, never "Traveller" - the order\'s `wnm`, whoever lays it - and the fallen\'s game reads them as its own while its killer\'s does not (mutants: the order without the name; the room\'s name from the carrier; mine by the carrier\'s peer)', () => quiet(async () => {
  const z = await fall();
  assert.equal(z.r.store.get(`wild:${z.d.r}`)?.ok, true, 'the remains vouched for');
  const o = await verifyOrder(z.d.order, z.kp.publicKey, { subtle, nowS: Math.floor(Date.now() / 1000), kind: 'remains' });
  assert.equal(o.ok, true);
  assert.equal(o.claims.wnm, 'Riadne', 'the service names the fallen character in its order');
  for (const ws of [z.kb, z.fa]) {
    const heard = remainsHeard(ws);
    assert.ok(heard.length, 'the remains are said to the cell');
    for (const w of heard) {
      assert.equal(w.nm, 'Riadne', 'named for the fallen, not for the killer who carried the deposit');
      assert.equal(w.os, z.ria.id, 'owned by the fallen\'s account');
      assert.equal(w.oid, 'peer-0002', 'laid by the killer\'s socket');
    }
  }
  const [w] = remainsHeard(z.kb);
  assert.equal(remainsMine(w, z.bo.id, 'peer-0002', null), false, 'the killer\'s game: not its remains');
  assert.equal(remainsMine(w, z.ria.id, 'peer-0001', null), true, 'the fallen\'s game: its remains');
}));

test('WILD-REMAINS-LOSS: a seizure\'s remains wear the name the fallen wears - its account\'s by default, its realm character\'s where the player chose to be known by it (accounts.js wornNameOf, the token\'s own law) (mutant: the character\'s name read past the choice)', () => quiet(async () => {
  for (const [nameAs, want] of [[null, 'Riadne'], ['character', 'Riadne Vel']]) {
    const z = await fall({ charName: 'Riadne Vel', nameAs });
    const [w] = remainsHeard(z.kb);
    assert.equal(w?.nm, want, `name_as ${nameAs}`);
  }
}));

test('WILD-REMAINS-LOSS: a remains from a room that names no account is mine by the peer that laid it, and the one my own deposit laid is mine whatever the room names (mutants: the peer read where an account is named; the laid id ignored)', () => {
  assert.equal(remainsMine({ r: 'aaaaaaaaaaaa', os: null, oid: 'peer-0001' }, 'acct-1', 'peer-0001', null), true);
  assert.equal(remainsMine({ r: 'aaaaaaaaaaaa', os: null, oid: 'peer-0002' }, 'acct-1', 'peer-0001', null), false);
  assert.equal(remainsMine({ r: 'aaaaaaaaaaaa', os: 'acct-2', oid: 'peer-0001' }, 'acct-1', 'peer-0001', null), false);
  assert.equal(remainsMine({ r: 'aaaaaaaaaaaa', os: 'acct-2', oid: 'peer-0002' }, 'acct-1', 'peer-0001', 'aaaaaaaaaaaa'), true);
});

test('WILD-REMAINS-LOSS: while my game does not know its account yet, the peer that laid the remains still marks them (mutant: the account trusted when null)', () => {
  assert.equal(remainsMine({ r: 'aaaaaaaaaaaa', os: 'acct-2', oid: 'peer-0001' }, null, 'peer-0001', null), true);
  assert.equal(remainsMine({ r: 'aaaaaaaaaaaa', os: 'acct-2', oid: 'peer-0002' }, null, 'peer-0001', null), false);
});

test('WILD-REMAINS-LOSS: a remains order carries a name only as the wire keeps one - an empty, unprintable or over-long `wnm` is refused before it is signed (mutant: any string a name)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const base = { s: 'acct-1', wr: RID, wh: 'a'.repeat(64), wn: 3, wm: CELL };
  const nowS = Math.floor(Date.now() / 1000);
  const ok = await mintRemainsOrder({ ...base, wnm: 'Riadne' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyOrder(ok, kp.publicKey, { subtle, nowS, kind: 'remains' })).claims.wnm, 'Riadne');
  for (const wnm of ['', ' Riadne', 'R\u0007iadne', 'x'.repeat(40)]) {
    await assert.rejects(() => mintRemainsOrder({ ...base, wnm }, kp.privateKey, { subtle, nowS }), /refused/, JSON.stringify(wnm));
  }
});
