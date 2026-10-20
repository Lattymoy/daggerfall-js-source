// FIELD BUGS 2026-10-14 - PVP-LOOT's two decisions of Mac's, the same day (bible/01-Overview/bugs/Field-Bugs-2026-10-14.md):
//
//   "Guildmates are friends" - in the open zone one's guild is kin, as one's party, its truce and one's duel are: the
//   referee lands no blow between them (net/wild/wildRef.js wildKin, the one law the relay and every client door ask).
//
//   "Yes, build it" - THE TWO-PHASE HANDOFF: the fallen loses the worn piece its killer picked only once the killer has it.
//   The account service holds the piece in ESCROW from the fall (server-account/src/wild.js); the killer's take in the
//   room is the room's signed collect (net/wild/wildReceipt.js `g1`), which the killer's tab carries to the service as an act
//   on its own record; nobody collecting by the time the remains could have gone, the fallen's tab takes it back.
//
// Every pin here runs THE WHOLE ROAD: the real relay room (its referee, its remains, its signatures - test/fakeRoom.mjs),
// the real account service over node:sqlite (test/accountDb.mjs), and the clients' own books (net/wild/wildFight.js, the
// fallen's and the killer's; net/wild/wildRemains.js, the killer's), the wire's own projection between them - over the
// game's own pieces (the starting kit, a Magic longsword as the ladder rolls one, worn through equipItem, ids stamped as
// the realm checkpoint stamps them, the record as the save writes it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { seatRealm, layRecord, realmAt, freshSave } from '../realmSeat.mjs';
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
import { createWildFight } from '../../src/net/wild/wildFight.js';
import { createWildRemains } from '../../src/net/wild/wildRemains.js';
import { wildKin, sameGuild } from '../../src/net/wild/wildRef.js';
import { readWildReceipt, readWildCollect, WILD_COLLECT_TTL_S } from '../../src/net/wild/wildReceipt.js';
import { validWildData, validWildOut, validWildRefOut, worldRoom, PIXEL_UNITS, WILD_ITEMS_MAX, WILD_DATA_MAX, SOCIAL_ROOM, RELAY_VERSION, relaySupportsWildCollect } from '../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { WILD_ESCROW_HOLD_S, escrowBackAt } from '../../server-account/src/wild.js';
import { WILD_TEXT, wildDeathLines } from '../../src/systems/wild/wildZone.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const M = SIEGE_UNITS_PER_M;
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LONGSWORD = 121, STEEL = 3;
const T = 1_800_000_000;
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

/**
 * THE ZONE, STOOD UP: one cell's relay room (with the social hub beside it), the account service whose identity key is the
 * room's and whose gate key verifies the room's signatures, and two realm characters - Riadne (her guild's founder; her
 * record the game's own pieces, her Magic longsword worn) and Borin - each with a socket in the cell and the client books
 * the game runs. `guildmate`: Borin wears her guild's tag. The clock is the test's, both ends.
 */
async function stand({ guildmate = false } = {}) {
  const world = fakeRooms({ now: () => Date.now() });
  const r = world.room(CELL);
  world.room(SOCIAL_ROOM);   // the hub: nobody's party, nobody's truce
  const kp = await r.signer();
  const gate = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', gate.privateKey)).toString('base64');
  const svc = await standService({
    IDENTITY_PRIVATE_KEY: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'),
    GATE_PUBLIC_KEY: Buffer.from(new Uint8Array(await subtle.exportKey('raw', gate.publicKey))).toString('base64url'),
  });
  const ria = await svc.registered('Riadne', { renown: 12 }), bo = await svc.registered('Borin');
  assert.equal((await svc.found(ria, { name: 'Hollow Crown', tag: 'HCR' })).status, 200);
  const gid = svc.env.DB._raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(ria.id).guild_id;
  // her pack, as the game makes it, laid as her record
  const fallen = { name: 'Riadne', gender: 'female', level: 9, items: [], wagonItems: [], goldPieces: 400 };
  assignStartingGear(fallen, { classIndex: 16, rolls: seeded(3) });
  const sword = applyRarity(createWeapon(LONGSWORD, STEEL, seeded(7)), 'magic', seeded(8));
  fallen.items.push(sword);
  assert.notEqual(equipItem(fallen, sword), null);
  stampItemIds(fallen);
  const minted = JSON.parse(JSON.stringify(sword));
  layRecord(svc.env, ria.character, JSON.parse(JSON.stringify(snapshotPlayer(fallen))));
  // his, a realm character of his own
  const killer = { name: 'Borin', gender: 'male', level: 9, items: [], wagonItems: [], goldPieces: 100 };
  assignStartingGear(killer, { classIndex: 16, rolls: seeded(4) });
  const BO = await seatRealm(svc.env, bo.secret, 'Borin', freshSave({ name: 'Borin', items: JSON.parse(JSON.stringify(killer.items)) }));
  if (guildmate) svc.env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 4, ?, ?)').run(bo.id, BO.id, gid, 'Borin', T - 86_400);
  const tag = (gm) => ({ gi: gid, gt: 'HCR', gm });
  const fa = r.connect(); await r.hello(fa, 'peer-0001', P(-1), { tokenSub: ria.id, rc: 1, ci: ria.character, lv: 10, ...tag('m1') });
  const kb = r.connect(); await r.hello(kb, 'peer-0002', P(1), { tokenSub: bo.id, rc: 1, ci: BO.id, lv: 10, ...(guildmate ? tag('m2') : {}) });
  // the wire between the books and the room: a frame a book sends leaves at once (its `true`), and is said to the room in
  // order at the next flush; what the room says back is read off its socket
  const q = new Map([[fa, []], [kb, []]]);
  const sender = (ws) => (d) => { const v = validWildData(d); if (!v) return false; q.get(ws).push(v); return true; };
  const flush = async () => { for (const [ws, list] of q) while (list.length) await r.raw(ws, JSON.stringify({ t: 'wild', data: list.shift() })); };
  const wilds = (ws, k) => ws.sent.filter((m) => m.t === 'wild' && !m.data && (!k || m.k === k));
  const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));
  return { svc, r, ria, bo, BO, gid, fallen, sword, minted, killer, fa, kb, sender, flush, wilds, refs };
}

/** THE FIGHT AND THE PICK, as the two games play them: both say they stand in the zone; Borin's fists until the referee
 *  calls her fall; her game offers her worn gear to him (wildFight offerWorn), his body window picks her longsword
 *  (wildFight pick), and the relay signs the fall to both. Answers the receipt and the fall's id. */
async function fightAndPick(z) {
  const { fa, kb, sender, flush, refs, fallen, r } = z;
  for (const ws of [fa, kb]) await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } }));
  const bodies = [];
  const hers = createWildFight({ send: sender(fa), can: () => true, fair: () => true });
  const his = createWildFight({ send: sender(kb), can: () => true, fair: () => true, onBody: (from, b) => bodies.push([from, b]) });
  let fell = null;
  for (let k = 0; k < 400 && !fell; k++) {
    step(300);
    his.blow('peer-0001', 'strike', { by: 'melee', p: W(1), d: 999 });
    await flush();
    fell = refs(kb, 'fell').map(validWildRefOut).find((g) => g?.id === 'peer-0001') ?? null;
  }
  assert.ok(fell, 'the referee called her fall at his hand');
  his.fell('peer-0001', fell.r, CELL);
  assert.ok(hers.offerWorn('peer-0002', fell.r, wornOffer(fallen.items).map(wildRecord)));
  await flush();
  for (const m of kb.sent.filter((x) => x.t === 'wild' && x.data)) his.onFrame(m.id, validWildData(m.data), m.sub ?? null);
  assert.equal(bodies.length, 1, 'her body offered him her worn gear');
  // his window mints each record alone and keeps what can be worn (world.js wildBodyArrived); he picks the longsword
  const shown = bodies[0][1].items.map((it) => { const m = validLootList([JSON.parse(JSON.stringify(it))])?.[0] ?? null; return m && wearableItem(m) ? m : null; });
  const w = shown.findIndex((m) => m?.templateIndex === LONGSWORD);
  assert.ok(w >= 0);
  assert.ok(his.pick('peer-0001', w));
  await flush();
  const rc = refs(fa, 'rc').at(-1)?.rc ?? null;
  assert.ok(rc && refs(kb, 'rc').at(-1)?.rc === rc, 'the fall signed, to both');
  assert.deepEqual(readWildReceipt(rc).wt, [LONGSWORD, STEEL]);
  return { rc, rid: fell.r };
}

/** HER TAB'S DROP (world.js wildTakeDrop / wildDropTaken): the service asked against the receipt, her record where it stands,
 *  the room her remains lie in - `collect` 1 where the room signs collects (online.js wildCollectAt) - then exactly what it
 *  took out of her pack, and its records laid in the room on its order. */
async function herDrop(z, rc, { collect = true } = {}) {
  const { svc, ria, r, fa, fallen } = z;
  const res = await svc.call('/v1/wild/fall', { receipt: rc, realm: realmAt(svc.env, ria.character), room: CELL, ...(collect ? { collect: 1 } : {}) }, ria.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  wildTakeTook(fallen, d.took, d.gold, (it) => { if (isEquipped(it)) unequipItem(fallen, it); });
  const room = WILD_DATA_MAX - JSON.stringify({ k: 'fall', r: d.r, p: [0, 0, 0], items: [], last: 0, o: d.order }).length - 16;
  const chunks = wildChunks(d.items, WILD_ITEMS_MAX, room);
  for (let k = 0; k < chunks.length; k++) await r.raw(fa, JSON.stringify({ t: 'wild', data: validWildData({ k: 'fall', r: d.r, p: W(-1), items: chunks[k], last: k === chunks.length - 1 ? 1 : 0, o: d.order }) }));
  assert.equal(r.store.get(`wild:${d.r}`)?.ok, true, 'her remains vouched for');
  return d;
}

/** HIS BOOK (net/wild/wildRemains.js), over the game's own mint and pack: the room's words in, its asks out; a collect the room
 *  signs goes to his tab's act (wildEscrowHost.js wildCollectHeard - the service asked with his record's `at`, the piece added from
 *  its answer, wildCollected). Answers the book and what it saw. */
function hisBook(z, { carrying = true } = {}) {
  const { svc, bo, BO, kb, sender, killer } = z;
  const said = [], collects = [], answers = [];
  const book = createWildRemains({
    send: sender(kb), pool: () => null, toScene: (p) => p, mine: () => false, pack: () => killer.items, mint: validLootList, addItem, stacksWith,
    say: (l) => said.push(l), nameOf: (it) => it.name, me: () => bo.id, collect: (cr, at) => collects.push([cr, at]),
  });
  book.setRooms([CELL]);
  let read = 0;
  const hear = () => { for (; read < kb.sent.length; read++) { const o = validWildOut(kb.sent[read]); if (o) book.onWord(o, CELL); } };
  const carry = async () => {
    while (collects.length) {
      const [cr] = collects.shift();
      const a = await svc.call('/v1/wild/collect', { receipt: cr, realm: realmAt(svc.env, BO.id) }, bo.secret);
      answers.push(a);
      if (a.status === 200 && !a.body.again) { const it = validLootList([a.body.item])?.[0]; if (it) addItem(killer.items, it); }
    }
  };
  const run = async () => { for (let n = 0; n < 6; n++) { hear(); await z.flush(); hear(); if (carrying) await carry(); } };
  return { book, said, collects, answers, run, hear };
}

/** What a record holds now (the service's object for the character). */
const recordOf = (svc, id) => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(svc.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id).obj)));
const swords = (list, uid) => (list ?? []).filter((it) => it?.templateIndex === LONGSWORD && it.uid === uid);
const escrowRow = (svc, r) => { const row = svc.env.DB._raw.prepare('SELECT state, to_char FROM wild_escrow WHERE r = ?').get(r); return row ? { ...row } : undefined; };
/** What a piece IS past the price (the wire's floor and the law's ceiling). */
const piece = (it) => { const { value: _v, ...rest } = it; return rest; };

async function withClock(fn) {
  const real = Date.now;
  Date.now = () => T * 1000;
  try { return await quiet(fn); } finally { Date.now = real; }
}
const step = (ms) => { const t = Date.now() + ms; Date.now = () => t; };
/** The clock at epoch second `s`, both ends. */
const atS = (s) => { Date.now = () => s * 1000; };
const nowS = () => Math.floor(Date.now() / 1000);

test('GUILDMATES ARE FRIENDS (Mac, 2026-10-14): in the open zone the referee lands no blow and calls no fall between two of one guild - the guild is kin, as the party, its truce and a duel are (net/wild/wildRef.js wildKin, the one law the relay\'s `_wildBlow` and the client\'s wildFair ask); two of no guild in common fight as before (mutants: the guild unread at the referee; the guild unread by the law)', () => withClock(async () => {
  const z = await stand({ guildmate: true });
  for (const ws of [z.fa, z.kb]) await z.r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } }));
  for (let k = 0; k < 40; k++) { step(300); await z.r.raw(z.kb, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0001', n: 1 + k, by: 'melee', p: W(1), d: 999 } })); }
  assert.deepEqual([z.refs(z.fa, 'hp').length, z.refs(z.kb, 'hp').length, z.refs(z.kb, 'fell').length], [0, 0, 0], 'his guildmate takes no harm from him, and never falls');
  // strangers: the same blows land
  const s = await stand();
  for (const ws of [s.fa, s.kb]) await s.r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } }));
  step(300); await s.r.raw(s.kb, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0001', n: 1, by: 'melee', p: W(1), d: 999 } }));
  assert.ok(s.refs(s.fa, 'hp').length >= 1, 'a stranger\'s blow lands');
  // the one law, both ends: the client's door asks it with the tags the relay stamps (a tag is one guild's alone)
  assert.equal(wildKin({ guilds: ['HCR', 'HCR'] }), true);
  assert.equal(wildKin({ guilds: ['HCR', 'HND'] }), false);
  assert.equal(wildKin({ guilds: [null, null] }), false, 'two of no guild are no guild\'s');
  assert.equal(wildKin({ guilds: ['', ''] }), false);
  assert.equal(sameGuild('g0000000001', 'g0000000001'), true);
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes("if (wildKin({ party: !!social?.isPartyPeer(peerId) || _wildTruce.holds(peerId, Date.now()), duel: duelMgr.live && duelMgr.opponent === peerId, guilds: [myGuildTag(), online?.guildTagOf?.(peerId) ?? null] })) return false;"), 'wildFair: the referee\'s own law, my guild\'s tag and theirs');
}));

test('THE TWO-PHASE HANDOFF (Mac, 2026-10-14: "the fallen must lose the worn piece only once the killer actually has it"): the fall puts the killer\'s pick in the service\'s ESCROW - out of her record and her pack, in no one else\'s; his take in the room is a signed collect, never the room\'s copy; his tab\'s act commits it to his record, and only then is it his - unequipped, as it was minted; her taking it back is refused once it is (mutants: the piece into the remains at the fall; the room hands the record; the collect never commits)', () => withClock(async () => {
  const z = await stand();
  const { rc } = await fightAndPick(z);
  const fellAt = nowS();
  const d = await herDrop(z, rc);
  const uid = z.minted.uid;
  assert.equal(d.escrow?.state, 'held', 'held by the service');
  assert.equal(d.escrow.until, fellAt + WILD_ESCROW_HOLD_S, 'until the remains could have gone');
  assert.equal(z.r.store.get(`wild:${d.r}`).we, true, 'the room keeps the order\'s word: a collect, not a take');
  assert.equal(z.fallen.items.includes(z.sword), false, 'out of her pack');
  assert.equal(isEquipped(z.sword) || equipTableOf(z.fallen).includes(z.sword), false, 'unequipped first');
  assert.deepEqual(swords(recordOf(z.svc, z.ria.character).items, uid), [], 'out of her record');
  assert.deepEqual(swords(recordOf(z.svc, z.BO.id).items, uid), [], 'and not yet in his');
  assert.equal(escrowRow(z.svc, d.r).state, 'held');
  // WHAT SHE SEES (world.js wildDropTaken reads `held` off the service's answer): the death screen says the piece is held
  // until he collects it and comes back otherwise - never that it was taken - and a line says how long
  const held = d.wi === 0 && !!d.escrow?.r;
  const lines = wildDeathLines({ killer: 'Borin', dropped: 0, claimed: 'longsword', held });
  assert.equal(lines[0], 'Borin claimed your longsword. It is held until they collect it, and comes back to you if they do not.');
  assert.notEqual(lines[0], WILD_TEXT.deathClaim('Borin', 'longsword'));
  assert.equal(WILD_TEXT.heldNote('Borin', 'longsword', Math.ceil((escrowBackAt(d.escrow.until) - fellAt) / 60)), `Your longsword is held for Borin. If they do not collect it within ${Math.ceil((escrowBackAt(d.escrow.until) - fellAt) / 60)} minutes, it comes back to you.`);
  assert.equal(WILD_TEXT.heldNote(null, 'longsword', 1), 'Your longsword is held for your killer. If they do not collect it within 1 minute, it comes back to you.');
  // his game asks the room for it (the remains named it his) - and is answered a collect, not a record
  const his = hisBook(z);
  await his.run();
  assert.equal(z.wilds(z.kb, 'got').filter((m) => m.i === d.wi).length, 0, 'the room hands no copy of a piece in escrow');
  assert.equal(z.wilds(z.kb, 'cr').length, 1, 'it signs his collect');
  assert.deepEqual(readWildCollect(z.wilds(z.kb, 'cr')[0].cr).c, z.BO.id, 'into the character his socket plays');
  assert.equal(his.answers.length, 1);
  assert.equal(his.answers[0].status, 200, JSON.stringify(his.answers[0].body));
  // HIS, NOW: in his record and his pack, carried, as minted; hers nowhere; the escrow ended in his name
  assert.equal(swords(recordOf(z.svc, z.BO.id).items, uid).length, 1, 'committed to his record');
  const got = swords(z.killer.items, uid);
  assert.equal(got.length, 1, 'in his pack');
  assert.equal(got[0].equipSlot, undefined, 'carried, never in his slot');
  assert.deepEqual(piece(got[0]), piece(wildRecord(z.minted)), 'her longsword, its tier, its lines, its condition');
  assert.deepEqual(escrowRow(z.svc, d.r), { state: 'collected', to_char: z.BO.id });
  const theirs = await z.svc.call('/v1/wild/collect', { receipt: z.wilds(z.kb, 'cr')[0].cr, realm: realmAt(z.svc.env, z.ria.character) }, z.ria.secret);
  assert.deepEqual([theirs.status, theirs.body.error], [403, 'not-yours'], 'his collect is his to carry');
  assert.equal(z.svc.env.DB._raw.prepare('SELECT char_id FROM item_uids WHERE uid = ?').get(uid)?.char_id, z.BO.id, 'the ledger follows: his');
  // her tab asking it back is told who has it
  atS(escrowBackAt(d.escrow.until));
  const back = await z.svc.call('/v1/wild/reclaim', { r: d.r, realm: realmAt(z.svc.env, z.ria.character) }, z.ria.secret);
  assert.deepEqual([back.status, back.body.error], [409, 'escrow-collected']);
  assert.deepEqual(swords(recordOf(z.svc, z.ria.character).items, uid), [], 'never hers again');
}));

test('UNCOLLECTED, IT COMES BACK: nobody collecting by the time the remains could have gone (`until`) and a collect signed then spent, her tab takes the piece back into her record and her pack - and only then; the collect he held and never carried is refused after (mutants: the piece destroyed with the remains; the return before a collect signed in time is spent)', () => withClock(async () => {
  const z = await stand();
  const { rc } = await fightAndPick(z);
  const d = await herDrop(z, rc);
  const uid = z.minted.uid;
  const at = () => realmAt(z.svc.env, z.ria.character);
  // his game is answered its collect by the room - and never carries it (a game closed, a socket lost)
  const his = hisBook(z, { carrying: false });
  await his.run();
  const cr = z.wilds(z.kb, 'cr')[0]?.cr;
  assert.ok(cr, 'the room signed his collect');
  // past the remains' latest end, but a collect signed at its last moment could still be on its way: not yet
  atS(d.escrow.until + 1);
  const early = await z.svc.call('/v1/wild/reclaim', { r: d.r, realm: at() }, z.ria.secret);
  assert.deepEqual([early.status, early.body.error, early.body.wait], [409, 'escrow-wait', WILD_COLLECT_TTL_S - 1], 'the wait said, to the second');
  assert.deepEqual(swords(recordOf(z.svc, z.ria.character).items, uid), [], 'still held');
  atS(escrowBackAt(d.escrow.until));
  const res = await z.svc.call('/v1/wild/reclaim', { r: d.r, realm: at() }, z.ria.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // her tab adds what came back (world.js wildEscrowBack) - it reappears in her pack, and her record holds it once
  addItem(z.fallen.items, validLootList([res.body.item])?.[0]);
  assert.equal(swords(z.fallen.items, uid).length, 1, 'back in her pack');
  assert.deepEqual(piece(swords(z.fallen.items, uid)[0]), piece(wildRecord(z.minted)), 'as it was minted');
  assert.equal(swords(recordOf(z.svc, z.ria.character).items, uid).length, 1, 'back in her record');
  assert.equal(escrowRow(z.svc, d.r).state, 'returned');
  assert.equal(WILD_TEXT.heldBack('longsword'), 'Your longsword has come back to you. It was never collected.', 'and she is told');
  assert.equal(z.svc.env.DB._raw.prepare('SELECT char_id FROM item_uids WHERE uid = ?').get(uid)?.char_id, z.ria.character, 'the ledger: hers again');
  // the collect he held, carried now: refused
  const late = await z.svc.call('/v1/wild/collect', { receipt: cr, realm: realmAt(z.svc.env, z.BO.id) }, z.bo.secret);
  assert.notEqual(late.status, 200, JSON.stringify(late.body));
  assert.deepEqual(swords(recordOf(z.svc, z.BO.id).items, uid), [], 'never his');
  assert.deepEqual(swords(z.killer.items, uid), []);
}));

test('A DUPLICATE MOVES NOTHING TWICE: the room says one collect however often he asks; carried twice (a lost answer, a second tab) the service commits it once - the second asking from where the record stood before is told it moved (`seq`), from where it stands now `again`; a second taking-back is `again`, the piece never doubled (mutants: a second collect signed; the second collect committed again; the second return committed again)', () => withClock(async () => {
  const z = await stand();
  const { rc } = await fightAndPick(z);
  const d = await herDrop(z, rc);
  const uid = z.minted.uid;
  const his = hisBook(z);
  await his.run();
  const cr = z.wilds(z.kb, 'cr')[0].cr;
  // he asks the room again: the same collect, never another, and his book hands it on once
  await z.r.raw(z.kb, JSON.stringify({ t: 'wild', data: { k: 'take', r: d.r, i: d.wi, n: 1 } }));
  await z.r.raw(z.kb, JSON.stringify({ t: 'wild', data: { k: 'take', r: d.r, i: d.wi, n: 1 } }));
  assert.deepEqual(z.wilds(z.kb, 'cr').map((m) => m.cr), [cr, cr, cr], 'one collect, said again');
  his.hear();
  assert.equal(his.collects.length, 0, 'handed on once');
  // carried twice: from where his record stood before the first landed, and from where it stands now
  const before = { ...realmAt(z.svc.env, z.BO.id), seq: realmAt(z.svc.env, z.BO.id).seq - 1 };
  const stale = await z.svc.call('/v1/wild/collect', { receipt: cr, realm: before }, z.bo.secret);
  assert.deepEqual([stale.status, stale.body.error], [409, 'seq'], 'the record moved: his tab reads it at its next join');
  const again = await z.svc.call('/v1/wild/collect', { receipt: cr, realm: realmAt(z.svc.env, z.BO.id) }, z.bo.secret);
  assert.deepEqual([again.status, again.body.again], [200, true], 'landed already: nothing moves');
  assert.equal(swords(recordOf(z.svc, z.BO.id).items, uid).length, 1, 'one longsword in his record');
  // the same for her taking one back, on another fall
  const y = await stand();
  const f = await fightAndPick(y);
  const e = await herDrop(y, f.rc);
  atS(escrowBackAt(e.escrow.until));
  const one = await y.svc.call('/v1/wild/reclaim', { r: e.r, realm: realmAt(y.svc.env, y.ria.character) }, y.ria.secret);
  assert.equal(one.status, 200);
  const two = await y.svc.call('/v1/wild/reclaim', { r: e.r, realm: realmAt(y.svc.env, y.ria.character) }, y.ria.secret);
  assert.deepEqual([two.status, two.body.again], [200, true]);
  assert.equal(swords(recordOf(y.svc, y.ria.character).items, y.minted.uid).length, 1, 'one longsword in her record');
}));

test('A RESTART MID-ESCROW RESOLVES TO EXACTLY ONE OWNER: the room woken before his collect keeps the remains, the order\'s word and its collect (he collects; she is told so); a commit whose batch never lands moves nothing and leaves it held, and one that lands with its answer lost is read as landed (asked again, it lands once); her game closed while it was held is told of it at its next play and takes it back (mutants: the escrow\'s word lost in a wake; the collect lost in a wake; a failed batch read as landed; the escrows never listed)', () => withClock(async () => {
  // the room restarts between the remains and his collect
  const z = await stand();
  const { rc } = await fightAndPick(z);
  const d = await herDrop(z, rc);
  const uid = z.minted.uid;
  z.r.wake();
  const his = hisBook(z);
  await his.run();
  assert.equal(his.answers[0]?.status, 200, 'collected after the wake');
  z.r.wake();
  const said = z.wilds(z.kb, 'cr').length;
  await z.r.raw(z.kb, JSON.stringify({ t: 'wild', data: { k: 'take', r: d.r, i: d.wi, n: 1 } }));
  assert.equal(z.wilds(z.kb, 'cr').length, said + 1, 'asked after a second wake, said again');
  assert.equal(new Set(z.wilds(z.kb, 'cr').map((m) => m.cr)).size, 1, 'the same collect');
  atS(escrowBackAt(d.escrow.until));
  const hers = await z.svc.call('/v1/wild/reclaim', { r: d.r, realm: realmAt(z.svc.env, z.ria.character) }, z.ria.secret);
  assert.equal(hers.body.error, 'escrow-collected');
  assert.deepEqual([swords(recordOf(z.svc, z.BO.id).items, uid).length, swords(recordOf(z.svc, z.ria.character).items, uid).length], [1, 0], 'his alone');
  // the service falls over mid-commit: the batch never lands - nothing moved, still held; asked again, it lands once
  const y = await stand();
  const f = await fightAndPick(y);
  const e = await herDrop(y, f.rc);
  const ybook = hisBook(y);
  // the database's batch, as the commit's runs it: the first never lands (the isolate gone before it); the next lands and
  // its answer is lost (the isolate gone after it)
  const db = y.svc.env.DB;
  const batch = db.batch.bind(db), prepare = db.prepare.bind(db);
  db.prepare = (sql) => Object.assign(prepare(sql), { _sql: sql });
  let crash = 'before';
  db.batch = async (steps) => {
    if (!steps.some((st) => /UPDATE wild_escrow/.test(st._sql ?? ''))) return batch(steps);
    if (crash === 'before') { crash = 'after'; throw new Error('the isolate went away'); }
    if (crash === 'after') { crash = null; await batch(steps); throw new Error('the isolate went away, its answer with it'); }
    return batch(steps);
  };
  await ybook.run();
  assert.notEqual(ybook.answers[0].status, 200, 'the first carry failed');
  assert.equal(escrowRow(y.svc, e.r).state, 'held', 'still held');
  assert.deepEqual([swords(recordOf(y.svc, y.BO.id).items, y.minted.uid).length, swords(recordOf(y.svc, y.ria.character).items, y.minted.uid).length], [0, 0], 'in neither record - the escrow\'s');
  const retry = await y.svc.call('/v1/wild/collect', { receipt: y.wilds(y.kb, 'cr')[0].cr, realm: realmAt(y.svc.env, y.BO.id) }, y.bo.secret);
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.notEqual(retry.body.again, true, 'its answer lost inside the service, the landed batch is read as landed - the piece in the answer');
  assert.deepEqual([swords(recordOf(y.svc, y.BO.id).items, y.minted.uid).length, swords(recordOf(y.svc, y.ria.character).items, y.minted.uid).length, escrowRow(y.svc, e.r).state], [1, 0, 'collected'], 'landed once: his alone');
  // her game closed while it was held: its next play asks the service for its escrows, and takes it back once due
  const x = await stand();
  const g = await fightAndPick(x);
  const h = await herDrop(x, g.rc);
  const listed = await x.svc.call('/v1/wild/escrows', { character: x.ria.character }, x.ria.secret);
  assert.deepEqual(listed.body.escrows.map((q) => [q.r, q.state, q.back, q.rec?.templateIndex]), [[h.r, 'held', escrowBackAt(h.escrow.until), LONGSWORD]], 'what is held for her, and when it is due');
  atS(listed.body.escrows[0].back);
  const mine = await x.svc.call('/v1/wild/reclaim', { r: h.r, realm: realmAt(x.svc.env, x.ria.character) }, x.ria.secret);
  assert.equal(mine.status, 200);
  assert.equal(swords(recordOf(x.svc, x.ria.character).items, x.minted.uid).length, 1, 'hers once');
  assert.deepEqual((await x.svc.call('/v1/wild/escrows', { character: x.ria.character }, x.ria.secret)).body.escrows, [], 'nothing held now');
}));

test('THE HANDOFF\'S DOORS: a tab asks the escrow only for a room that signs collects (online.js wildCollectAt over relaySupportsWildCollect - an older room hands the record, and the escrow would hand it twice); a tab that does not ask it never escrows (and a record the judge holds keeps the piece outright - test/net/int9_wild_ref.test.js); the host carries a collect and watches its escrows on the zone\'s frame (mutants: the escrow asked of any room; the held record\'s piece taken)', () => withClock(async () => {
  assert.equal(relaySupportsWildCollect(RELAY_VERSION), true);
  // FIELD BUGS 2026-10-14's one relay bump: world205 signs the collect (world201 on its branch, world203 on the
  // integration) - main's world201 (CHAT-TRADE), world202 (FIVE-ASKS), world203 (KG-SET) and world204 (KG5) are rooms
  // that hand the record, so a tab on any of them never asks the escrow
  assert.deepEqual(['world200', 'world201', 'world202', 'world203', 'world204', 'world205'].map(relaySupportsWildCollect), [false, false, false, false, false, true]);
  const z = await stand();
  const { rc } = await fightAndPick(z);
  const d = await herDrop(z, rc, { collect: false });
  assert.equal(d.escrow, undefined, 'no collect asked: the room\'s old take');
  assert.equal(escrowRow(z.svc, d.r), undefined);
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes("realm: at, room: lay, ...(online?.wildCollectAt?.(lay) ? { collect: 1 } : {}), ...wildFallWords("), 'my drop asks it for my room alone');   // PIN MOVED (AUDIT FB1019f B2): the words through wildFallWords (systems/wild/wildDeath.js) - the wagon's and COMPANION-DROP's `packs` (test/systems/fb1019f_companiondrop.test.js); PIN MOVED (CART-AWAY, Mac, 2026-10-15): my wagon's word beside it (test/systems/fb1015_cartaway.test.js)
  // PIN MOVED (HOST-SPLIT, FIELD BUGS 2026-10-15c): the handoff's two sides live in scenes/wildEscrowHost.js, the host wiring them
  const eh = rd('src/scenes/wildEscrowHost.js');
  assert.ok(w.includes('const wildEscrow = createWildEscrowHost({ townTalk, session: realmSession, modes: () => modes, wildAccount, checkpoint: () => onlineCheckpoint() });'), 'the host wires the handoff');
  assert.ok(w.includes('collect: (cr, at) => wildEscrow.collectHeard(cr, at),'), 'the book\'s collect to my tab');
  assert.ok(w.includes('wildEscrow.frame();'), 'the zone\'s frame watches my escrows');
  assert.ok(w.includes('const held = d.wi === 0 && !!d.escrow?.r;') && w.includes('setWildDeath({ killer: dd.killer, dropped: d.order ? n : 0, claimed, held, '), 'my death screen says my piece is held');   // PIN MOVED (BURNT-SAID, FIELD BUGS 2026-10-18b): a held record's drop and the letters said beside it (test/systems/fb1018b_burntsaid.test.js)
  assert.ok(w.includes('if (held) wildEscrow.held(d.escrow, { killer: dd?.killer ?? null, name: claimed });'), 'and my tab watches it');
  assert.ok(eh.includes("call: (at) => wildAccount.reclaim({ r, realm: at }), apply: (a) => wildEscrowBack(r, a?.data ?? null)"), 'taken back as an act on my record');
  assert.ok(eh.includes("call: (at) => wildAccount.collect({ receipt: c.cr, realm: at }), apply: (a) => wildCollected(a?.data ?? null)"), 'collected as an act on mine');
  assert.ok(eh.includes('return { held: wildEscrowHeld, collectHeard: wildCollectHeard, frame: wildEscrowFrame };'), 'the module hands back its three doors');
}));
