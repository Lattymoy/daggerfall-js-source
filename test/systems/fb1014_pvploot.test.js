// FIELD BUGS 2026-10-14 - PVP-LOOT, the Discord's "Equipped items Disappear after looting in PvP zone": "When you kill a
// player in a PvP zone and loot an item they have equipped, the item disappears from the player's inventory but does
// not appear in yours."
//
// The killer's pick off the body goes to the relay, the relay signs the fall with it, the account service takes that worn
// piece off the fallen's record (server-account/src/wild.js) and signs the room an order naming it the killer's (`wk`,
// `wi`), the fallen's game takes it out of its pack and lays the remains, and the killer's own game asks the room for it
// (net/wild/wildRemains.js askMine). The room judged that take by the PVPDUNGEONS friend law too ("Party/guildmembers cant
// pick it up" - the DROP's law), so a killer the fallen's guild counted a friend, or one sharing a party with them by the
// take, was refused: the fallen had lost the piece, and it lay in the remains for nobody until they went. The friend law
// is the drop's alone now (net/wild/wildLaw.js remainsNamedFor). `01-Overview/bugs/Field-Bugs-2026-10-14.md`.
//
// Mac's decisions of 2026-10-14 since: a guildmate is kin at the referee, so it never fights the fallen, and a piece in
// escrow is a collect the friend law never reads (test/systems/fb1014_pvpescrow.test.js). Here is the room's old take - a tab
// whose room signs no collect - where the named piece still meets the friend law: a guild or a party joined between the
// fall and the take (the fall is signed as the relay signs one, its referee long done).
//
// Every piece here is the game's own: the starting kit's worn clothes (startingGear.js), a Magic longsword as the
// ladder rolls one (enemyEquipment.js createWeapon, lootRarity.js applyRarity) worn through equip.js equipItem, ids
// stamped as the realm checkpoint stamps them, the record as the save writes it (save.js snapshotPlayer) - through the
// real account service, the real relay room and the killer's real book over the wire's own projection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { layRecord, realmAt } from '../realmSeat.mjs';
import { seeded } from '../honestItems.mjs';
import { fakeRooms } from '../fakeRoom.mjs';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { assignStartingGear } from '../../src/systems/startingGear.js';
import { equipItem, equipTableOf, isEquipped, unequipItem, wearableItem } from '../../src/systems/equip.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { wornOffer, wildRecord, wildTakeTook, wildChunks } from '../../src/systems/wild/wildDeath.js';
import { validLootList } from '../../src/systems/loot/loot.js';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { addItem, stacksWith } from '../../src/systems/inventory.js';
import { createWildRemains } from '../../src/net/wild/wildRemains.js';
import { remainsNamedFor } from '../../src/net/wild/wildLaw.js';
import { mintWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { validWildData, validWildOut, worldRoom, PIXEL_UNITS, WILD_ITEMS_MAX, WILD_DATA_MAX, SOCIAL_ROOM } from '../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';

const { subtle } = globalThis.crypto;
const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * SIEGE_UNITS_PER_M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const RID = '0a1b2c3d4e5f';
const LONGSWORD = 121, STEEL = 3;

/** THE FALL, END TO END: the fallen (Riadne, her guild's founder) wears what the game dressed and armed her in; the killer
 *  (Borin) picks her Magic longsword off her body; the service takes it off her record; her game takes it out of her pack
 *  and lays the remains; Borin's own book asks for it. `guildmate`: Borin wears her guild's tag by the take (one joined
 *  after the fall - the referee counts a guildmate kin); `party`: the two share a party by the take (one made after the
 *  fall - the referee let the blows land); `strangerFirst`: a stranger in the cell
 *  asks for the named piece before Borin's book does. */
async function fall({ guildmate = false, party = false, strangerFirst = false } = {}) {
  const world = fakeRooms();
  const hub = world.room(SOCIAL_ROOM), r = world.room(CELL);
  const kp = await r.signer();   // the room verifies the service's orders with the key that signs its tokens
  const svc = await standService({ IDENTITY_PRIVATE_KEY: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') });
  const ria = await svc.registered('Riadne', { renown: 12 }), bo = await svc.registered('Borin'), cy = await svc.registered('Cyrus');
  assert.equal((await svc.found(ria, { name: 'Hollow Crown', tag: 'HCR' })).status, 200, 'her guild is founded (her realm character its master)');
  const gid = svc.env.DB._raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(ria.id).guild_id;
  if (party) for (const who of [ria, bo]) hub.store.set(`acct:${who.id}`, { name: who.handle, seen: Date.now(), friends: [], in: [], out: [], invites: [], party: 'p1' });

  // the fallen, as the game makes her
  const e = { name: 'Riadne', gender: 'female', level: 9, items: [], wagonItems: [], goldPieces: 400 };
  assignStartingGear(e, { classIndex: 16, rolls: seeded(3) });   // the Warrior's kit: her clothes worn, her broadsword carried
  const sword = applyRarity(createWeapon(LONGSWORD, STEEL, seeded(7)), 'magic', seeded(8));
  e.items.push(sword);
  assert.notEqual(equipItem(e, sword), null, 'she wears it');
  stampItemIds(e);   // the realm checkpoint's stamp: a Magic piece is a valuable one
  const wornAtDeath = JSON.parse(JSON.stringify(sword));
  layRecord(svc.env, ria.character, JSON.parse(JSON.stringify(snapshotPlayer(e))));   // her record, as her save wrote it

  // her body's offer, as her game sends it and his window mints it (world.js wildBodyArrived): his pick, and what it showed
  const offer = validWildData({ k: 'worn', to: 'peer-0002', s: RID, items: wornOffer(e.items).map(wildRecord) }).items;
  const shown = offer.map((it) => { const m = validLootList([JSON.parse(JSON.stringify(it))])?.[0] ?? null; return m && wearableItem(m) ? m : null; });
  const w = shown.findIndex((m) => m?.templateIndex === LONGSWORD);
  assert.ok(w >= 0 && shown.filter(Boolean).length >= 2, 'her worn clothes and her longsword offered');
  const rc = await mintWildReceipt({ f: ria.id, c: ria.character, k: bo.id, r: RID, w, wt: [LONGSWORD, STEEL] }, svc.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });

  // her tab's act: the service takes the drop off her record; her game takes out exactly that
  const res = await svc.call('/v1/wild/fall', { receipt: rc, realm: realmAt(svc.env, ria.character), room: CELL }, ria.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.equal(d.wi, 0, 'the killer\'s piece first');
  assert.ok(d.order, 'and the room\'s order over it');
  const lost = wildTakeTook(e, d.took, d.gold, (it) => { if (isEquipped(it)) unequipItem(e, it); });
  assert.equal(lost[0], sword, 'the longsword left her pack');
  assert.equal(e.items.includes(sword), false);
  assert.equal(isEquipped(sword) || equipTableOf(e).includes(sword), false, 'unequipped before it left');

  // the room: her socket lays the remains on the order; his and a stranger's stand in the cell
  const guild = (gm) => ({ gi: gid, gt: 'HCR', gm });
  const fa = r.connect(); await r.hello(fa, 'peer-0001', P(-1), { tokenSub: ria.id, rc: 1, ci: ria.character, ...guild('m1') });
  const kb = r.connect(); await r.hello(kb, 'peer-0002', P(1), { tokenSub: bo.id, ...(guildmate ? guild('m2') : {}) });
  const cs = r.connect(); await r.hello(cs, 'peer-0003', P(3), { tokenSub: cy.id });
  const room = WILD_DATA_MAX - JSON.stringify({ k: 'fall', r: d.r, p: [0, 0, 0], items: [], last: 0, o: d.order }).length - 16;
  const chunks = wildChunks(d.items, WILD_ITEMS_MAX, room);
  for (let k = 0; k < chunks.length; k++) {
    await r.raw(fa, JSON.stringify({ t: 'wild', data: validWildData({ k: 'fall', r: d.r, p: [BASE.x, 0, BASE.z], items: chunks[k], last: k === chunks.length - 1 ? 1 : 0, o: d.order }) }));
  }
  assert.equal(r.store.get(`wild:${d.r}`)?.ok, true, 'the remains vouched for');

  if (strangerFirst) await r.raw(cs, JSON.stringify({ t: 'wild', data: { k: 'take', r: d.r, i: d.wi, n: 1 } }));
  // his own book (net/wild/wildRemains.js), the game's mint and pack: the room's words in, its asks out
  const pack = [], said = [], asks = [];
  const book = createWildRemains({
    send: (x) => { const v = validWildData(x); if (v) asks.push(v); return !!v; }, pool: () => null, toScene: (p) => p, mine: () => false,
    pack: () => pack, mint: validLootList, addItem, stacksWith, say: (l) => said.push(l), nameOf: (it) => it.name, me: () => bo.id,
  });
  book.setRooms([CELL]);
  let read = 0;
  for (let n = 0; n < 8; n++) {
    for (; read < kb.sent.length; read++) { const o = validWildOut(kb.sent[read]); if (o) book.onWord(o, CELL); }
    if (!asks.length) break;
    while (asks.length) await r.raw(kb, JSON.stringify({ t: 'wild', data: asks.shift() }));
  }
  const words = (ws, k) => ws.sent.filter((m) => m.t === 'wild' && !m.data && m.k === k);
  return { d, r, kb, cs, pack, said, wornAtDeath, words, bo };
}

/** What a piece IS, past the marks the wire and the ledger own: its id (the service's fresh one in the remains) and its
 *  price (the wire's floor and the law's ceiling). */
const piece = (it) => { const { uid: _u, value: _v, ...rest } = it; return rest; };

test('PVP-LOOT: the killer\'s pick of an EQUIPPED piece lands in the killer\'s pack, unequipped, whoever the fallen\'s guild or party counts them - the friend law is the drop\'s, never the piece the service\'s order names (mutants: the friend law over the named piece again; its guild half alone; its party half alone)', async () => {
  for (const [why, opts] of [['a stranger', {}], ['her guildmate', { guildmate: true }], ['in her party by the take', { party: true }]]) {
    const { d, r, kb, pack, said, wornAtDeath, words, bo } = await fall(opts);
    assert.equal(remainsNamedFor(r.store.get(`wild:${d.r}`), d.wi), bo.id, `${why}: the order named the piece his`);
    assert.deepEqual(words(kb, 'no'), [], `${why}: never refused`);
    assert.equal(words(kb, 'got').length, 1, `${why}: the room gave it`);
    assert.equal(pack.length, 1, `${why}: the piece the service took off her record is his`);
    const got = pack[0];
    assert.deepEqual(piece(got), piece(wildRecord(wornAtDeath)), `${why}: her longsword, as the game minted it - its tier, its lines, its condition`);
    assert.equal(got.equipSlot, undefined, `${why}: carried, never worn into his slot`);
    assert.equal(isEquipped(got), false);
    assert.match(got.uid, /^[0-9a-f]{16}$/);
    assert.notEqual(got.uid, wornAtDeath.uid, `${why}: under the service's fresh id`);
    assert.ok(said.includes(`You take ${got.name}.`), `${why}: and he is told`);
    assert.equal(r.store.get(`wild:${d.r}`).items[d.wi], null, `${why}: taken - gone from the remains, never laid twice`);
  }
});

test('PVP-LOOT: the drop stays the fallen\'s and her foes\' - her guildmate (or her party) is refused a record of it, a stranger takes it; the named piece is its killer\'s alone (mutants: the friend law dropped; the named piece anyone\'s)', async () => {
  for (const opts of [{ guildmate: true }, { party: true }]) {
    const { d, r, kb, cs, words } = await fall(opts);
    const bag = d.items.findIndex((it, i) => i > 0 && it.group !== 'Currency');
    assert.ok(bag > 0, 'her bag dropped a piece');
    await r.raw(kb, JSON.stringify({ t: 'wild', data: { k: 'take', r: d.r, i: bag, n: 1 } }));
    assert.deepEqual(words(kb, 'no').map((m) => m.i), [bag], `${JSON.stringify(opts)}: a friend of hers takes nothing of the drop`);
    await r.raw(cs, JSON.stringify({ t: 'wild', data: { k: 'take', r: d.r, i: bag, n: 1 } }));
    assert.equal(words(cs, 'got')[0]?.i, bag, 'a stranger takes it');
  }
  // the named piece: its killer's alone - a stranger asking for it first is refused, and it is still his
  const { cs, pack, words, d } = await fall({ guildmate: true, strangerFirst: true });
  assert.deepEqual(words(cs, 'no').map((m) => m.i), [d.wi], 'the stranger takes nothing of it');
  assert.equal(pack.length, 1, 'it is his');
  assert.equal(pack[0].templateIndex, LONGSWORD);
});
