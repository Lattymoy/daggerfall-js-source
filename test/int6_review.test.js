// INT3/INT6 (2026-10-09, the INTEGRITY arc's audit - bible/06-Systems/Integrity-Arc.md): THE ROUTES AND THE REVIEW, over
// HTTP against the real Worker and the real migrations - what the audit found no test held:
//   - a held character's piece refused at the market's own route, with its status (409, index.js JUDGE_STATUS), and a
//     record no judge has read refused the same ('record-unjudged');
//   - a held character lists no crafted piece and no Stores' units, auctions none, fills no order (AUDIT INT: it listed
//     its craft for 900,000 gold);
//   - a piece listed before the item law read listings is sold to nobody, and one put in a vault is taken by nobody;
//   - a classic save's piece is handed on by no route ('piece-legacy');
//   - the review: a rollback never past a move the service made since its clean save ('service-moved'), never for the
//     dead; the review's words each its status.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { prepareRealmRecord } from '../server-account/src/realm.js';
import { creditSave } from '../src/net/realmGoldLaw.js';
import { takeTradeGoods } from '../src/net/realmTradeLaw.js';
import { validLootList } from '../src/systems/loot.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { seededRng } from '../src/systems/wind.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';
import { MINED_KEYS } from '../src/net/professionLaw.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `int6-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const sword = () => createWeapon(113, 1, seededRng(7));
/** A piece the law refuses: a tierless dagger with a line. */
const forged = () => ({ ...sword(), affixes: [{ id: 'damage', value: 40 }] });
/** A classic save's piece (classicSave.js classicItemFromRecord): ten slots, `None` among them. */
const classic = () => ({ ...sword(), enchantments: [{ type: T.PotentVs, param: 3 }, ...Array.from({ length: 9 }, () => ({ type: T.None, param: -1 }))] });

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const record = (who) => {
    const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character);
    return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj)));
  };
  const seated = async (handle, save) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: 0, ...save });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  const list = (who, pick, extra = {}) => s.call('/v1/market/list', {
    character: who.character, region: DF, kind: 'item', item: validLootList([record(who).items[pick]])?.[0] ?? null, pick, price: 50, hubs: HUBS, rid: rid(),
    currency: 'gold', realm: who.at(), ...extra,
  }, who.secret);
  const ctx = () => ({ db: s.env.DB, bucket: s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: _now });
  return { ...s, raw, record, seated, list, ctx };
}

test('INT3 routes: a held character\'s piece refused at the market\'s own route - 409 and its word; a record no judge has read the same, \'record-unjudged\'; a held character lists no craft and no Stores, auctions none, fills no order', async () => {
  const s = await stand();
  const ann = await s.seated('ann', { items: [sword()] });
  s.raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(ann.character);
  const held = await s.list(ann, 0);
  assert.deepEqual([held.status, held.body.error], [409, 'trade-held']);
  s.raw.prepare('UPDATE realm_characters SET held = NULL, judged_seq = NULL WHERE id = ?').run(ann.character);
  const unread = await s.list(ann, 0);
  assert.deepEqual([unread.status, unread.body.error], [409, 'record-unjudged']);
  s.raw.prepare("UPDATE realm_characters SET held = 'law', judged_seq = 1 WHERE id = ?").run(ann.character);
  const base = { character: ann.character, region: DF, hubs: HUBS, rid: rid() };
  const piece = await s.call('/v1/market/list', { ...base, kind: 'piece', provenance: '0123456789abcdef', wear: 100, price: 900_000, currency: 'gold' }, ann.secret);
  assert.deepEqual([piece.status, piece.body.error], [409, 'trade-held'], 'its craft (AUDIT INT: listed for 900,000 gold)');
  const units = await s.call('/v1/market/list', { ...base, rid: rid(), kind: 'material', material: MINED_KEYS[0], units: 5, price: 10 }, ann.secret);
  assert.deepEqual([units.status, units.body.error], [409, 'trade-held'], 'its Stores');
  const auction = await s.call('/v1/market/auction', { ...base, rid: rid(), provenance: '0123456789abcdef', wear: 100, opening: 100 }, ann.secret);
  assert.deepEqual([auction.status, auction.body.error], [409, 'trade-held'], 'an auction');
  const fill = await s.call('/v1/market/fill', { ...base, rid: rid(), order: '0123456789abcdef', units: 1 }, ann.secret);
  assert.deepEqual([fill.status, fill.body.error], [409, 'trade-held'], 'an order\'s fill');
});

test('INT1 stock: a piece listed before the item law read listings is sold to nobody; a classic save\'s piece is handed on by no route - kept, never sold (\'piece-legacy\')', async () => {
  const s = await stand();
  const sel = await s.seated('sel', { items: [sword()] });
  const buy = await s.seated('buy', { goldPieces: 5_000 });
  const l = (await s.list(sel, 0)).body.listing;
  assert.ok(l?.id, 'listed');
  // as a listing put before INT1 stands: the forged piece in the row
  s.raw.prepare('UPDATE market_listings SET item = ? WHERE id = ?').run(JSON.stringify(forged()), l.id);
  const bought = await s.call('/v1/market/buy', { character: buy.character, region: DF, listing: l.id, units: 1, max: l.price, hubs: HUBS, rid: rid(), realm: buy.at() }, buy.secret);
  assert.equal(bought.body.error, 'market-not-good');
  // a classic save's piece: the law takes it, the realm keeps it its character's
  const old = await s.seated('old', { items: [classic()] });
  const r = await s.list(old, 0);
  assert.deepEqual([r.status, r.body.error], [409, 'piece-legacy']);
  const keep = await prepareRealmRecord(s.ctx(), old.id, old.at(), (save) => (takeTradeGoods(save, { items: [save.items[0]], gold: 0 }, [0]) ? null : 'gone'), { outbound: true });
  assert.deepEqual(keep, { error: 'piece-legacy' });
});

test('INT6 review: a rollback never past a move the service made since the clean save (AUDIT INT: a listed piece came back and stood listed too) - one the service made ON the clean save carries the clean one with it; never for the dead; the review\'s words each their status', async () => {
  const s = await stand();
  const mac = await s.registered('mac');
  const cai = await s.seated('cai', { goldPieces: 100 });
  const putSave = async (save) => {
    const at = cai.at();
    const res = await s.fetch(new Request(`https://accounts.invalid/v1/realm/${cai.character}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${cai.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(save),
    }));
    assert.equal(res.status, 200);
  };
  await putSave({ name: 'cai', level: 5, goldPieces: 100, items: [] });
  const row = () => s.raw.prepare('SELECT seq, obj, clean_obj, clean_seq, svc_seq FROM realm_characters WHERE id = ?').get(cai.character);
  // a service move on a clean record: the clean one follows it
  const credit = await prepareRealmRecord(s.ctx(), cai.id, cai.at(), (save) => (creditSave(save, 5) ? null : 'bad'));
  await s.env.DB.batch(credit.steps);
  assert.deepEqual([row().clean_obj, row().clean_seq, row().svc_seq], [row().obj, row().seq, row().seq]);
  // a lawless checkpoint, then a service move on the held record: the clean one stays behind it
  await putSave({ name: 'cai', level: 5, goldPieces: 105, items: [forged()] });
  const credit2 = await prepareRealmRecord(s.ctx(), cai.id, cai.at(), (save) => (creditSave(save, 5) ? null : 'bad'));
  await s.env.DB.batch(credit2.steps);
  assert.ok(row().svc_seq > row().clean_seq);
  const refused = await s.call('/v1/mod/realm-rollback', { id: cai.character }, mac.secret);
  assert.deepEqual([refused.status, refused.body.error], [409, 'service-moved']);
  // the dead are rolled back never
  s.raw.prepare('UPDATE realm_characters SET svc_seq = NULL, dead_at = 1 WHERE id = ?').run(cai.character);
  const dead = await s.call('/v1/mod/realm-rollback', { id: cai.character }, mac.secret);
  assert.deepEqual([dead.status, dead.body.error], [409, 'dead']);
  assert.equal((await s.call('/v1/mod/realm-rollback', { id: 'r00000000000000000000' }, mac.secret)).status, 404);
  const rando = await s.registered('rando');
  for (const act of ['holds', 'findings', 'clear', 'hold', 'rollback', 'budget']) assert.equal((await s.call(`/v1/mod/realm-${act}`, { id: cai.character }, rando.secret)).status, 403, act);
});
