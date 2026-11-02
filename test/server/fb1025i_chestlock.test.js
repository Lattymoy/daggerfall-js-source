// FIELD BUGS 2026-10-25i CHEST-DRAFT and COPY-LIFT (#bug-reports, Giljabrar, "Storage in the Decoration update may be
// Realm Locking items": "I placed 89 rare/legendary items in a chest to await being ID'd this afternoon, and when I went
// to retrieve them they were all 'Realm Locked'"). The decorator's draft kept a picture of every chest the room held and
// its Discard wrote the picture back (scenes/decor/decorTool.js): a piece taken out of a chest since stood in the chest
// AND the pack, and the next checkpoint's ledger read one piece twice in one record - a copy, both locked
// (server-account/src/ledger.js). In #1223's build the draft outlived the room, and a Discard in the ship's decorator stood
// the home's chests there with a copy of everything they held. Pinned here through the real producers end to end: the
// real decorator (test/decorFakes.mjs toolRig - its chests the real room's store, scenes/decor/decorRoom.js), the
// inventory window's own move (systems/item/itemTransfer.js applyTransfer), rolled pieces stamped with their ids as a
// checkpoint stamps them (systems/item/itemIds.js stampItemIds), the save as the host composes it (systems/sceneCache.js),
// and the real Worker's checkpoint. And COPY-LIFT: a record's copy of its own is lifted only by the service's own hand -
// staff's purge with `keep`, which itself leaves the record one (ledger.js ownCopiesLiftable, staffpanel3realm.test.js) -
// and never on a checkpoint's word that the record shows it once: AUDIT FB1025i, a duper's copy moved where the record
// lists nothing (a deserter revenant's take, a counter, the ground) and brought back after stays locked throughout.
// AUDIT FB1025i CHEST-DRAFT E1-E9: the owner's own things through a draft on the host's own pack doors
// (systems/decor/decorPack.js) - set down and taken down again, a stack joined, one gone or put on since - a staged chest's
// Access through the record's act, a kept chest's mid-draft, and a save's room's strays given back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave, recordOf } from '../realmSeat.mjs';
import { readFileSync } from 'node:fs';
import { toolRig, settle, all, one, rows } from '../decorFakes.mjs';
import { createDecorRoom } from '../../src/scenes/decor/decorRoom.js';
import { returnUnstood } from '../../src/systems/decor/decorPack.js';
import { equipItem } from '../../src/systems/equip.js';
import { setRealmLocked } from '../../src/systems/item/itemBound.js';
import { revenantMayTake, pickTaken } from '../../src/systems/revenant/revenant.js';
import { DUPE_GRACE_S, piecesRefusal, ownCopiesLiftable, ownCopyLiftSteps } from '../../server-account/src/ledger.js';
import { ledgerPrintOf } from '../../server-account/src/judge.js';
import { createSceneCache, cacheScene, snapshotSceneCache } from '../../src/systems/sceneCache.js';
import { homeSceneName } from '../../src/systems/online/onlineHomes.js';
import { applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { stampItemIds, ledgerKeyOf } from '../../src/systems/item/itemIds.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { seeded } from '../honestItems.mjs';

const HOME = { kind: 'home', where: 'Your home', mapId: 11, buildingKey: 22 };
const SCENE = homeSceneName(HOME.mapId, HOME.buildingKey);
const piece = (extra) => ({ model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });
const CHEST = piece({ id: 'c1', model: 41811, storage: true });
const BED = piece({ id: 'b1', pos: [3, 0, 3] });

/** `n` Rare pieces as the loot rolls them, each with the id its first checkpoint stamps. */
function rares(n, from = 0) {
  const who = { items: Array.from({ length: n }, (_, i) => applyRarity(createWeapon(113, 1, seeded(7 + from + i)), 'rare', seeded(11 + from + i))) };
  stampItemIds(who);
  return who.items;
}
const keysOf = (items) => items.map(ledgerKeyOf);

/** The decorator in an online home, its Confirm the service's batch (each body kept in `sent`). */
const homeRig = (sent = []) => toolRig({
  room: HOME, gold: 5000,
  homeDecor: { list: async () => ({ ok: true, data: { rev: 1, pieces: [] } }), batch: async (b) => { sent.push(b); return { ok: true, data: { rev: b.rev + 1, gold: 0 } }; } },
});
/** A Ruby (an ingredient: rubies stack) and a candle record of `n` (candles do not). */
const ruby = (n = 1) => ({ templateIndex: 0, group: 'Gems', stackCount: n });
const candles = (n) => ({ templateIndex: 253, group: 'UselessItems2', stackCount: n });
const countOf = (list, t) => list.filter((it) => it.templateIndex === t).reduce((n, it) => n + (it.stackCount ?? 1), 0);
/** One of the player's own things set down as the player sets it down - the panel's "Your things", chosen, Place, and
 *  the placement kept (Interact): staged, in a room whose draft stages (scenes/decor/decorTool.js commitOwn). Answers its piece's id. */
async function setDownOwn(rig, name) {
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  if (one(root, 'dfdecor-card').dataset.mode !== 'own') all(root, 'dfdecor-chip').find((c) => /^Your things/.test(c.textContent)).fire('click');
  rows(root).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith(name)).fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  rig.win.fire('keydown', { code: 'KeyE', target: rig.doc.body });
  await settle();
  const id = rig.standing.find((p) => rig.owned.has(p.id))?.id;
  assert.ok(id, `${name} set down (${JSON.stringify(rig.said)})`);
  return id;
}
const OWN_GONE = /is no longer in your pack, or is worn\. Confirm takes its piece down\.$/;
/** The decorator opened (its draft with it), as the player's button opens it. */
function decorate(rig) {
  rig.frame();
  rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
  assert.equal(rig.tool.flying(), true, 'decorating');
}
/** The inventory window's own move of every piece in `from` to `to` (a chest's Take, or Store). */
const moveAll = (from, to, toPlayer) => { for (const it of [...from]) applyTransfer(it, { amount: 1 }, from, to, { toPlayer }); };

/** The realm: one character, its checkpoints put through the real Worker. */
async function realm() {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService();
  const raw = s.env.DB._raw;
  const seat = async (handle) => {
    const who = await s.registered(handle);
    return { who, R: await seatRealm(s.env, who.secret, handle) };
  };
  const putSave = async ({ who, R }, save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200);
    return res.json();
  };
  /** The save as the host composes it inside the home (worldModes.js interiorSaveData): the pack, and the room's scene - an
   *  online home's pieces are the service's, what its chests hold the save's (`decorItems`). */
  const put = (c, pack, decorItems = {}, extra = {}) => {
    const cache = createSceneCache();
    cacheScene(cache, SCENE, { decor: [], decorItems });
    return putSave(c, freshSave({ name: c.who.handle, items: pack.map((it) => ({ ...it })), sceneCache: snapshotSceneCache(cache), ...extra }));
  };
  const copies = (c) => raw.prepare('SELECT uid, kind FROM item_dupes WHERE char_id = ? ORDER BY uid').all(c.R.id).map((r) => ({ ...r }));
  const dupeFindings = (c) => raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'dupe' ORDER BY id").all(c.R.id).map((r) => JSON.parse(r.detail));
  return { s, raw, seat, put, copies, dupeFindings, wait: (sec) => { now += sec; }, done: () => { Date.now = realNow; } };
}
const sorted = (a) => [...a].sort();

test('CHEST-DRAFT the report: pieces taken out of a home\'s chest while the draft stands are not stood back in the chest by Discard - the pack holds them once, and the realm locks none', async () => {
  const P = rares(3);
  const rig = homeRig();
  rig.standing.push({ ...CHEST });
  rig.chests.itemsOf('c1').push(...P);
  decorate(rig);
  moveAll(rig.chests.itemsOf('c1'), rig.pack, true);   // retrieved
  rig.standing.push({ ...BED });   // a change not kept yet
  assert.equal(rig.tool.discardDraft(), true);
  assert.deepEqual(rig.standing.map((p) => p.id), ['c1'], 'Discard puts the room\'s pieces back');
  assert.deepEqual(rig.chests.itemsSnapshot(), {}, 'and leaves the chest as the player left it - empty');
  assert.deepEqual(keysOf(rig.pack), keysOf(P), 'the pieces are the pack\'s, once');
  const r = await realm();
  try {
    const c = await r.seat('giljabrar');
    const answer = await r.put(c, rig.pack, rig.chests.itemsSnapshot());
    assert.deepEqual([answer.locked, r.copies(c)], [[], []], 'the checkpoint after it locks nothing');
  } finally { r.done(); }
});

test('CHEST-DRAFT the other face ("Items placed inside house storage randomly disappear"): pieces stored while the draft stands stay in the chest through Discard', () => {
  const P = rares(2, 10);
  const rig = homeRig();
  rig.standing.push({ ...CHEST });
  rig.pack.push(...P);
  decorate(rig);
  moveAll(rig.pack, rig.chests.itemsOf('c1'), false);   // stored
  rig.standing.push({ ...BED });
  rig.tool.discardDraft();
  assert.deepEqual(keysOf(rig.chests.itemsOf('c1')), keysOf(P), 'still in the chest');
  assert.deepEqual(rig.pack, []);
});

test('CHEST-DRAFT a chest the draft stood and Discard takes away gives back what was put in it - to the pack, once, and no record of it left under its id', () => {
  const P = rares(2, 20);
  const rig = homeRig();
  rig.pack.push(...P);
  decorate(rig);
  rig.standing.push(piece({ id: 'c2', model: 41811, storage: true }));   // a new chest, not kept yet
  moveAll(rig.pack, rig.chests.itemsOf('c2'), false);
  rig.tool.discardDraft();
  assert.deepEqual(rig.standing.map((p) => p.id), [], 'the chest goes');
  assert.deepEqual(keysOf(rig.pack), keysOf(P), 'what it held is the pack\'s again');
  assert.deepEqual(rig.chests.itemsSnapshot(), {}, 'and the scene writes nothing under its id');
  assert.ok(rig.said.some((l) => /^What the .+ held is back in your pack\.$/.test(l)), `and said (AUDIT FB1025i E6): ${JSON.stringify(rig.said)}`);
});

test('CHEST-DRAFT an own thing the draft took down, stored in a chest since, is not stood again by Discard - one of it, in the chest; its piece stays taken down, said, and Confirm takes it down (AUDIT FB1025i E3)', async () => {
  const [ring] = rares(1, 30);
  const sent = [];
  const rig = homeRig(sent);
  rig.standing.push({ ...CHEST }, piece({ id: 'o1', model: null, flat: [209, 0], item: { t: ring.templateIndex } }));
  rig.owned.set('o1', ring);
  decorate(rig);
  assert.equal(rig.tool.act('remove', 'o1'), true);
  await new Promise((done) => { setTimeout(done, 0); });
  assert.deepEqual([rig.pack.length, rig.owned.has('o1')], [1, false], 'taken down into the pack');
  moveAll(rig.pack, rig.chests.itemsOf('c1'), false);
  rig.tool.discardDraft();
  assert.equal(rig.owned.has('o1'), false, 'not stood again beside the chest\'s');
  assert.deepEqual(keysOf(rig.chests.itemsOf('c1')), [ledgerKeyOf(ring)]);
  assert.deepEqual(rig.standing.map((p) => p.id), ['c1'], 'E3: its piece stays down - standing with nothing kept under it was a free piece of it');
  assert.ok(rig.said.some((l) => OWN_GONE.test(l)), `and said: ${JSON.stringify(rig.said)}`);
  rig.tool.discardDraft();
  assert.deepEqual([rig.owned.has('o1'), rig.standing.map((p) => p.id)], [false, ['c1']], 'a second Discard stands no copy of it from the draft\'s picture of the room\'s own');
  assert.equal(await rig.tool.confirmDraft(), true);
  assert.deepEqual(sent.at(-1)?.drop, ['o1'], 'the take-down the draft\'s still: Confirm takes it down');
  const r = await realm();
  try {
    const c = await r.seat('giljabrar');
    assert.deepEqual((await r.put(c, rig.pack, rig.chests.itemsSnapshot())).locked, [], 'once, and locked by none');
  } finally { r.done(); }
});

test('CHEST-DRAFT an own thing the draft took down and still in the pack stands again on Discard, as it was', async () => {
  const [ring] = rares(1, 40);
  const rig = homeRig();
  rig.standing.push(piece({ id: 'o1', model: null, flat: [209, 0], item: { t: ring.templateIndex } }));
  rig.owned.set('o1', ring);
  decorate(rig);
  rig.tool.act('remove', 'o1');
  await new Promise((done) => { setTimeout(done, 0); });
  rig.tool.discardDraft();
  assert.deepEqual([rig.pack.length, rig.owned.size, ledgerKeyOf(rig.owned.get('o1'))], [0, 1, ledgerKeyOf(ring)]);
});

test('CHEST-DRAFT E1 (AUDIT FB1025i): an own thing the draft set down and took down again is the pack\'s after Discard, once - the pack\'s own door refuses a record it holds, and the take that followed it lost the only one', async () => {
  const rig = homeRig();
  rig.pack.push(ruby());
  const id = await setDownOwn(rig, 'Ruby');
  assert.deepEqual([countOf(rig.pack, 0), rig.owned.has(id)], [0, true], 'out of the pack, standing');
  assert.equal(rig.tool.act('remove', id), true);
  await settle();
  assert.equal(countOf(rig.pack, 0), 1, 'taken down: the pack\'s');
  assert.equal(rig.tool.discardDraft(), true);
  assert.deepEqual([countOf(rig.pack, 0), rig.owned.size, rig.standing.length], [1, 0, 0], 'one ruby, in the pack');
});

test('CHEST-DRAFT E1: one of three set down by the draft and taken down by it - three after Discard: never two (a candle: its record refused again), never four (a ruby: given again onto the stack it had joined)', async () => {
  for (const [name, t, three] of [['Candle', 253, candles(3)], ['Ruby', 0, ruby(3)]]) {
    const rig = homeRig();
    rig.pack.push(three);
    const id = await setDownOwn(rig, name);
    assert.equal(countOf(rig.pack, t), 2, `${name}: one of the three out`);
    assert.equal(rig.tool.act('remove', id), true);
    await settle();
    assert.equal(countOf(rig.pack, t), 3, `${name}: taken down`);
    rig.tool.discardDraft();
    assert.deepEqual([countOf(rig.pack, t), rig.owned.size, rig.standing.length], [3, 0, 0], name);
  }
});

test('CHEST-DRAFT E1: an own ruby the draft took down joined the pack\'s rubies - Discard stands it again with one off that stack, and the pack keeps the rest', async () => {
  const rig = homeRig();
  rig.standing.push(piece({ id: 'o1', model: null, flat: [209, 0], item: { t: 0 } }));
  rig.owned.set('o1', ruby());
  rig.pack.push(ruby(2));
  decorate(rig);
  assert.equal(rig.tool.act('remove', 'o1'), true);
  await settle();
  assert.deepEqual([rig.pack.length, countOf(rig.pack, 0)], [1, 3], 'it joined the stack');
  rig.tool.discardDraft();
  assert.deepEqual(rig.standing.map((p) => p.id), ['o1'], 'standing again');
  assert.deepEqual([countOf(rig.pack, 0), rig.owned.get('o1')?.stackCount], [2, 1], 'one of the three back up, two carried');
});

test('CHEST-DRAFT E9 (AUDIT FB1025i): an own weapon the draft took down and the player put on since is never pulled out from under its wearer by Discard - worn, in the pack; its piece left down for Confirm, and said', async () => {
  const [blade] = rares(1, 80);
  const sent = [];
  const rig = homeRig(sent);
  rig.standing.push(piece({ id: 'o1', model: null, flat: [209, 0], item: { t: blade.templateIndex } }));
  rig.owned.set('o1', blade);
  decorate(rig);
  assert.equal(rig.tool.act('remove', 'o1'), true);
  await settle();
  equipItem({ items: rig.pack }, blade);
  assert.notEqual(blade.equipSlot ?? null, null, 'put on');
  rig.tool.discardDraft();
  assert.deepEqual([rig.pack.includes(blade), blade.equipSlot != null, rig.owned.has('o1'), rig.standing.map((p) => p.id)], [true, true, false, []], 'worn and carried, never standing too');
  assert.ok(rig.said.some((l) => OWN_GONE.test(l)), `said: ${JSON.stringify(rig.said)}`);
  assert.equal(await rig.tool.confirmDraft(), true);
  assert.deepEqual(sent.at(-1)?.drop, ['o1']);
});

const HOME_AT = { mapId: 1291010263, buildingKey: 0x10203 };
const HOME_SCENE = homeSceneName(HOME_AT.mapId, HOME_AT.buildingKey);
/** An online home of a realm character's own in the real Worker, the decorator over it: Confirm's batch lands each put as the
 *  service places a piece, Access asks the service's own route, and the record's act (systems/realmSaves.js realmGoldAct)
 *  checkpoints the save as it stands - the pack, what the chests hold - before it asks. `act: false`: no record to act on. */
async function homeService({ act = true } = {}) {
  const s = await standService();
  const who = await s.registered('giljabrar');
  const R = await seatRealm(s.env, who.secret, 'giljabrar', { name: 'giljabrar', level: 9, goldPieces: 1_000_000, items: [] });
  assert.equal((await s.call('/v1/homes/claim', { ...HOME_AT, region: 17, price: 42000, layout: null, character: R.id, realm: R.at() }, who.secret)).status, 200, 'the home is hers');
  const answer = (res) => (res.body?.ok ? { ok: true, data: res.body } : { ok: false, error: res.body?.error });
  const locked = [];
  let rig = null;
  const checkpoint = async () => {
    const live = recordOf(s.env, R.id);
    const cache = createSceneCache();
    cacheScene(cache, HOME_SCENE, { decor: [], decorItems: rig.chests.itemsSnapshot() });
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 9 }) },
      body: JSON.stringify({ ...live, items: rig.pack.map((it) => ({ ...it })), sceneCache: snapshotSceneCache(cache) }),
    }), s.env);
    assert.equal(res.status, 200, 'checkpointed');
    locked.push(...((await res.json()).locked ?? []));
  };
  rig = toolRig({
    room: { kind: 'home', where: 'Your home', ...HOME_AT }, gold: 5000,
    homeDecor: {
      list: async () => ({ ok: true, data: { rev: 1, pieces: [] } }),
      batch: async (b) => {
        for (const p of b.put) assert.equal((await s.call('/v1/homes/decor/place', { ...HOME_AT, character: R.id, realm: R.at(), piece: p }, who.secret)).status, 200, `${p.id} placed`);
        return { ok: true, data: { rev: b.rev + 1, gold: 0 } };
      },
      use: async (body) => answer(await s.call('/v1/homes/decor/use', { ...body, character: R.id }, who.secret)),
    },
    realm: act ? async (o) => { await checkpoint(); const res = await o.call(R.at()); if (res?.ok) o.apply?.(res); return res; } : null,
  });
  const bin = () => s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n;
  const inRecord = (id) => (recordOf(s.env, R.id)?.sceneCache?.scenes ?? []).reduce((n, sc) => n + (sc?.decorItems?.[id]?.length ?? 0), 0);
  return { rig, bin, inRecord, checkpoint, locked };
}

test('CHEST-DRAFT E2 (AUDIT FB1025i): a chest the draft stood, stored in while decorating and its Access set before Confirm - its goods move into the service\'s bin through the record\'s act, out of the save only on its word; none lost, none twice', async () => {
  const h = await homeService();
  h.rig.pack.push(...rares(3, 120));
  decorate(h.rig);
  h.rig.standing.push(piece({ id: 'c9', model: 41811, storage: true }));   // a new chest, not kept yet
  moveAll(h.rig.pack, h.rig.chests.itemsOf('c9'), false);   // stored while decorating - no checkpoint since
  assert.equal(h.rig.tool.act('access', 'c9'), true);   // Who may use: Friends - kept for Confirm
  await settle();
  assert.equal(await h.rig.tool.confirmDraft(), true);
  assert.deepEqual([h.rig.chests.itemsOf('c9').length, h.rig.pack.length, h.bin(), h.inRecord('c9')], [0, 0, 3, 0], 'the three in the bin, and nowhere else');
  await h.checkpoint();
  assert.deepEqual(h.locked, [], 'and the realm locks none');
});

test('CHEST-DRAFT E2: with no record to act on, a staged chest\'s Access is not kept, and said - its goods stay in it', async () => {
  const h = await homeService({ act: false });
  h.rig.pack.push(...rares(3, 130));
  decorate(h.rig);
  h.rig.standing.push(piece({ id: 'c9', model: 41811, storage: true }));
  moveAll(h.rig.pack, h.rig.chests.itemsOf('c9'), false);
  assert.equal(h.rig.tool.act('access', 'c9'), true);
  await settle();
  assert.equal(await h.rig.tool.confirmDraft(), true);
  assert.deepEqual([h.rig.chests.itemsOf('c9').length, h.bin()], [3, 0], 'in the chest still - the list was cleared on the service\'s ok for none it moved');
  assert.ok(h.rig.said.includes('It could not be kept.'));
});

test('CHEST-DRAFT E7 (AUDIT FB1025i): a kept chest\'s Access pressed while a draft stands moves its goods into the bin, and a Discard after leaves it as it lies - empty; each good once', async () => {
  const h = await homeService();
  decorate(h.rig);
  h.rig.standing.push(piece({ id: 'c1', model: 41811, storage: true }));
  assert.equal(await h.rig.tool.confirmDraft(), true);   // the chest kept: the service's piece
  h.rig.chests.itemsOf('c1').push(...rares(3, 140));
  h.rig.standing.push({ ...BED });   // a change not kept yet
  assert.equal(h.rig.tool.act('access', 'c1'), true);   // Who may use: Friends - the goods to the service's bin
  for (let i = 0; i < 500 && h.rig.chests.itemsOf('c1').length; i++) await settle();   // the press's act: a checkpoint and the route, the Worker's own awaits
  assert.deepEqual([h.rig.chests.itemsOf('c1').length, h.bin()], [0, 3], 'moved');
  assert.equal(h.rig.tool.discardDraft(), true);
  assert.deepEqual([h.rig.chests.itemsOf('c1').length, h.bin(), h.rig.standing.map((p) => p.id)], [0, 3, ['c1']], 'the chest as it lies, the bed gone');
  await h.checkpoint();
  assert.deepEqual(h.locked, [], 'the realm locks none');
});

test('CHEST-DRAFT E8 (AUDIT FB1025i): a save\'s room gives back what its record kept under pieces it no longer stands - a draft left by the door, not discarded - to the pack, and said; what stands keeps its own', () => {
  const room = createDecorRoom({ meshes: {}, renderer: null, getTexture: async () => null, uploadRecord() {}, uploadRecordFrame() {}, collider: () => null, origin: () => [0, 0, 0] });
  const [kept, stray, g1, g2] = rares(4, 150);
  const placed = [piece({ id: 'o1', model: null, flat: [209, 0] }), { ...CHEST }];
  room.setOwn({ o1: kept, o9: stray });
  room.setItems({ c1: [g1], c8: [g2] });
  const back = [];
  const said = [];
  returnUnstood(room, placed, (it) => back.push(it), (l) => said.push(l));
  assert.deepEqual(keysOf(back), keysOf([stray, g2]), 'the staged own thing and the staged chest\'s good');
  assert.deepEqual([room.ownIds(), Object.keys(room.itemsSnapshot())], [['o1'], ['c1']], 'what stands keeps its own');
  assert.deepEqual(said, ['2 of your things were no longer here and went back to your pack.']);
  const host = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(host, /interiorDecor\.setOwn\(data\.decorOwn\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!\(interiorHome \|\| _seatHallVisit\)\) returnUnstood\(interiorDecor, placed, decorPackGive, say\);/, 'the host asks it of a save\'s room as it restores it - an online home\'s list does its own');
});

/** A sworn revenant gone over to the feud, carrying `took` - the more valuable half of the pack it was given
 *  (systems/revenant/revenant.js splitPack - which kept a realm-locked piece until AUDIT FB1025i F1; a forged client's
 *  now), on its record and in the save, read by no list the record holds (systems/item/possessedItems.js), given back when
 *  it falls. */
const deserter = (took) => ({ modData: { Revenant: { list: [{ id: 'rv1', sworn: false, defeated: false, took }] } } });

test('COPY-LIFT the exploit (AUDIT FB1025i): a pair locked stays locked when one copy goes where the record lists nothing - a deserter\'s take, a counter - and when it comes back; no route moves either', async () => {
  const r = await realm();
  try {
    const c = await r.seat('duper');
    const [k] = rares(1, 50);
    const key = ledgerKeyOf(k);
    assert.deepEqual((await r.put(c, [k], { c1: [k] })).locked, [key], 'a pair of it: locked');
    assert.deepEqual(r.copies(c), [{ uid: key, kind: 'twice' }]);
    const hidden = await r.put(c, [k], {}, deserter([{ ...k }]));
    assert.deepEqual(hidden.locked, [key], 'one copy in a deserter\'s take: the one the record shows is locked still');
    assert.equal(await piecesRefusal(r.s.env.DB, c.R.id, [key]), 'piece-dupe', 'and no trade, listing or chest moves it');
    assert.deepEqual((await r.put(c, [k])).locked, [key], 'the other sold at a counter, the service never told: locked still');
    assert.deepEqual((await r.put(c, [k, k])).locked, [key], 'the hidden copy back: a pair, locked');
    assert.deepEqual(r.copies(c), [{ uid: key, kind: 'twice' }], 'the copy written down throughout');
  } finally { r.done(); }
});

test('COPY-LIFT the law the keep act lifts by: a record\'s copy of its own, its row its own, held and unclaimed, of the piece kept, no other record\'s copy known, no trail check or one that found it innocent (AUDIT FB1025i F7: never one found unclear) - lifted in the act\'s batch and said; every other copy stays, and a lift of none says nothing', async () => {
  const r = await realm();
  try {
    const A = await r.seat('aldric'), B = await r.seat('brenna');
    const [k0, k1, k2, k3, k4, k5, k6, k7, k8, k9, k10] = rares(11, 60);
    await r.put(B, [k7]);   // k7: another record held it first, and holds it still
    await r.put(A, [k0, k0, k1, k1, k2, k2, k3, k3, k4, k4, k5, k5, k6, k6, k7, k7, k8, k8, k9, k9, k10, k10]);
    assert.equal(r.copies(A).length, 11, 'each a copy');
    r.raw.prepare("UPDATE item_dupes SET trail_at = ?, trail_found = 'unclear' WHERE uid = ? AND char_id = ?").run(T0, ledgerKeyOf(k9), A.R.id);   // k9: staff could not tell
    r.raw.prepare("UPDATE item_dupes SET trail_at = ?, trail_found = 'innocent' WHERE uid = ? AND char_id = ?").run(T0, ledgerKeyOf(k10), A.R.id);   // k10: staff found it innocent
    await r.put(B, [k7, k1]);   // k1: another record shows it - its claim on this record's row waits
    r.raw.prepare("INSERT INTO item_dupes (uid, char_id, at, kind) VALUES (?, ?, ?, 'claim')").run(ledgerKeyOf(k2), B.R.id, T0);   // k2: another record's copy known
    r.raw.prepare("UPDATE item_dupes SET trail_at = ?, trail_found = 'copier' WHERE uid = ? AND char_id = ?").run(T0, ledgerKeyOf(k3), A.R.id);   // k3: staff found a copier
    r.raw.prepare("UPDATE item_dupes SET kind = 'craft' WHERE uid = ? AND char_id = ?").run(ledgerKeyOf(k4), A.R.id);   // k4: a craft's copy
    r.raw.prepare('UPDATE item_dupes SET kind = NULL WHERE uid = ? AND char_id = ?').run(ledgerKeyOf(k5), A.R.id);   // k5: found before the census said how
    await r.put(A, [k0, k0, k1, k1, k2, k2, k3, k3, k4, k4, k5, k5, k6, k6, k7, k7, k9, k9, k10, k10]);   // k8: let go, its row kept gone for the copy
    const other = { ...applyRarity(createWeapon(120, 1, seeded(90)), 'rare', seeded(91)), uid: ledgerKeyOf(k6) };   // k6: the one kept is another piece
    const kept = [k0, k1, k2, k3, k4, k5, other, k7, k8, k9, k10].map((it) => ({ key: ledgerKeyOf(it), fp: ledgerPrintOf(it) }));
    const lifts = await ownCopiesLiftable(r.s.env.DB, A.R.id, kept);
    assert.deepEqual(sorted(lifts), sorted(keysOf([k0, k10])), 'the clean pair and the innocent one alone');
    await r.s.env.DB.batch(ownCopyLiftSteps(r.s.env.DB, A.R.id, lifts, T0));
    assert.deepEqual(r.copies(A).map((x) => x.uid).filter((u) => lifts.includes(u)), [], 'lifted');
    assert.equal(r.copies(A).length, 9, 'the rest stand');
    const said = r.dupeFindings(A).at(-1);
    assert.deepEqual([sorted(said.lifted), said.count], [sorted(keysOf([k0, k10])), 2]);
    const findings = r.dupeFindings(A).length;
    await r.s.env.DB.batch(ownCopyLiftSteps(r.s.env.DB, A.R.id, keysOf([k1, k2, k3, k4, k5, k7, k8, k9]), T0));   // keys the law refuses, handed to it
    assert.equal(r.copies(A).length, 9, 'the statement asks the law again: none of them lifted');
    assert.equal(r.dupeFindings(A).length, findings, 'AUDIT FB1025i F2: no lift, no finding');
    assert.deepEqual(ownCopyLiftSteps(r.s.env.DB, A.R.id, [], T0), [], 'and no keys, no statement in the act\'s batch');
    const once = await r.put(A, [k0, k1, k2, k3, k4, k5, other, k7, k8, k9, k10]);
    assert.deepEqual(sorted(once.locked), sorted(keysOf([k1, k2, k3, k4, k5, k6, k7, k8, k9])), 'k0 and k10 trade again; every other piece locked');
  } finally { r.done(); }
});

test('COPY-LIFT (AUDIT FB1025i F1): no revenant takes a realm-locked piece - a kill\'s take (RVN8 pickTaken) draws around it, a deserter keeps none (splitPack asks the same), and one taken before comes home at the load', () => {
  const [locked, free] = rares(2, 160);
  setRealmLocked([ledgerKeyOf(locked)]);
  try {
    assert.deepEqual([revenantMayTake(locked), revenantMayTake(free)], [false, true]);
    for (let kills = 0; kills < 12; kills++) assert.equal(pickTaken('rv1', kills, locked, [locked, free]), free, 'never the locked one, worn or carried');
    const src = readFileSync(new URL('../../src/systems/revenant/revenant.js', import.meta.url), 'utf8');
    assert.match(src, /isGold: \(it\) => isGoldPieces\(it\) \|\| !revenantMayTake\(it\)/, 'a deserter\'s split keeps only what it may take');
    assert.match(src, /const home = r\.took\.filter\(\(it\) => !revenantMayTake\(it\)\);/, 'and what it may no longer keep comes home');
  } finally { setRealmLocked([]); }
});

test('COPY-LIFT no checkpoint lifts a copy: a claim\'s copy - a piece another record held first - stays locked when the claimant shows it once', async () => {
  const r = await realm();
  try {
    const G = await r.seat('gil'), R = await r.seat('rhe');
    const [k] = rares(1, 70);
    await r.put(G, [k]);
    await r.put(R, [k]);
    r.wait(DUPE_GRACE_S);
    await r.put(G, [k]);
    assert.deepEqual(r.copies(R), [{ uid: ledgerKeyOf(k), kind: 'claim' }], 'the claimant\'s copy');
    assert.deepEqual((await r.put(R, [k])).locked, [ledgerKeyOf(k)], 'once, and locked still');
  } finally { r.done(); }
});
