// HACKED-GOLD (2026-10-12, bible/01-Overview/bugs/Field-Bugs-2026-10-12f.md): "apparently theres people handing out hacked gold
// ingame". A modified client handed other players gold no record ever held - and nothing in the realm saw it:
//   - THE PEER'S WORD. A room's record of a container (WORLD4, WORLD6a), a body's grant (WORLD6b-iii(c)), a foe's heir's
//     pack (PORTAL1's `it`) and a fallen player's worn offer (WILD1) are a client's word. A coin pile on one is bounded
//     (AUDIT WORLD6b-iii(c) B2's 65,535), but a LETTER OF CREDIT's worth was bounded by nothing (2^53), and an item's price
//     only from below (AUDIT WORLD6a B1's floor) - and a bank cashes a letter at its face, a counter pays a piece by its
//     price. Reproduced on the real modules: one grant landed a 1,000,000,000,000-gold letter in an honest pack, and one
//     word about a building's cupboard 9,000,000,000,000. A letter never rides a peer's word now (systems/peerWord.js), a
//     peer's price is held under the law's ceiling (systems/loot/loot.js lawPriced), and a worn offer lands what can be worn.
//   - THE LAW. A purse, a letter's worth and a coin pile's count are each one DFU `int` (GOLD-INT): past it is no honest
//     count, a law finding, and the law holds the trade from day one - where the budget, still measuring, held nothing.
//   - THE REVIEW. While the budget measures, nothing is held, so the developer's `holds` listed none of the characters that
//     made gold, nor the hands their trades reached. `realm-gains` and `realm-trades` (server-account/src/review.js).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { standService } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { seeded } from '../honestItems.mjs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { validLootItem, validLootList, LOOT_STACK_MAX } from '../../src/systems/loot/loot.js';
import { itemFindings, worthCeiling, GOLD_INT_MAX, CLASSIC_VALUE_MAX } from '../../src/systems/item/itemLaw.js';   // and the law registers itself, and its ceiling, with the wire
import { characterFindings } from '../../server-account/src/judge.js';
import { isLetterOfCredit, neverPeerHanded, peerHanded, letterRefusesPut, letterPutText } from '../../src/systems/peerWord.js';
import { applyInteriorLoot, interiorLootRecords } from '../../src/world/interior/interiorShared.js';
import { letterOfCredit, goldStack } from '../../src/systems/inventory.js';
import { creditAmount } from '../../src/systems/court.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { wearableItem } from '../../src/systems/equip.js';
import { sigilStone } from '../../src/systems/gate/gateSpoils.js';
import { NativeInventoryWindow } from '../../src/ui/native/nativeInventory.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { BOAT_TEMPLATES } from '../../src/net/realm/realmTradeLaw.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const dagger = () => createWeapon(113, 1, seeded(7));
const wire = (it) => JSON.parse(JSON.stringify(it));
const FORGED_LETTER = 1_000_000_000_000;
/** A letter the law takes - inside one DFU int (GOLD-INT) - which a peer's word still never hands over. */
const LAWFUL_LETTER = 2_000_000_000;

// ── the pools' harness (test/net/world6biiic.test.js's own: two pools joined by nets over a crafted MONSTER.BSA) ──
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 1000, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolFor = (pe, said) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
const netFor = (me, hits, peers) => ({ room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });

/** Bob's body (a rat his machine stands, dead, holding `items`) and Mac's puppet of it, asked. */
async function bodyAsked(items) {
  const bobE = playerEntity(), macE = playerEntity();
  const bobSaid = [], macSaid = [];
  const bob = poolFor(bobE, bobSaid), mac = poolFor(macE, macSaid);
  const bobHits = [], macHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster)); mac.setNet(netFor('mac-0001', macHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.items = items;
  bob.damageFoe(rat, 9999, [10, 0, 10]);
  const f = bob.foesFrame(true).f[0];
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [{ ...f, d: 0, h: 9, o: 0 }] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  mac.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [f] });
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  mac.takeLoot(`foeCorpse:${pup.uid}`, (l) => macSaid.push(l));
  return { bob, mac, bobE, macE, bobHits, macHits, macSaid, rat, f, pup };
}

test('HACKED-GOLD the law of a peer\'s word: a letter of credit and a bound piece never ride one - every other piece does, a coin pile among them; null stays null (mutants: the letter ridden)', () => {
  const letter = letterOfCredit(5_000), stone = sigilStone(), coins = goldStack(50), d = dagger();
  assert.equal(isLetterOfCredit(letter), true);
  assert.equal(isLetterOfCredit(d), false);
  assert.deepEqual([letter, stone, coins, d].map(neverPeerHanded), [true, true, false, false]);
  assert.deepEqual(peerHanded([letter, coins, stone, d]), [coins, d], 'the rest kept, in order');
  assert.equal(peerHanded(null), null, 'a refused list stays the caller\'s refusal');
});

test('HACKED-GOLD a body\'s grant: the field\'s forged grant lands without its letter, the rest of it whole; the owner\'s body keeps a letter, grants what may go and says it holds only that (mutants: the grant\'s receiver; the owner\'s grant; the body\'s count)', async () => {
  // the report, reproduced: a modified owner grants a letter and a dagger to the honest player who asked. The field's
  // trillion is the law's now (GOLD-INT, below) - so the letter here is one the law takes, two billion inside one count
  const t = await bodyAsked([dagger()]);
  const forged = [wire({ ...letterOfCredit(LAWFUL_LETTER) }), wire(dagger())];
  assert.equal(validLootList(forged).length, 2, 'both are lawful pieces to the wire');
  assert.equal(validLootList([wire(letterOfCredit(FORGED_LETTER))]).length, 0, 'and the field\'s trillion is no piece at all to it');
  assert.equal(t.mac.applyHit('bob-0002', { to: 'mac-0001', k: 'world:3,12', i: t.rat.seq, grant: forged }), true, 'the grant asked for lands');
  assert.equal(creditAmount(t.macE), 0, 'and no letter with it - before, a trillion did');
  assert.deepEqual(t.macE.items.map((it) => it.templateIndex), [113], 'the dagger lands');
  assert.deepEqual(t.macSaid, ['You take 1 item.'], 'and the count is the pieces that landed');
  // the honest owner's side: a body holding a letter (a revenant carries what it took - RVN8) and a dagger
  const mine = letterOfCredit(5_000);
  const o = await bodyAsked([mine, dagger()]);
  assert.equal(o.f.o, 1, 'the dead body says it holds ONE piece another player may take - the letter is not on offer');
  assert.equal(o.bob.applyHit('mac-0001', o.macHits[0]), true, 'the owner answers the ask');
  assert.equal(o.bobHits.length, 1);
  assert.deepEqual(o.bobHits[0].grant.map((it) => it.templateIndex), [113], 'it grants the dagger alone');
  assert.deepEqual(o.rat.entity.items, [mine], 'and the letter stays on the body, its owner\'s');
  assert.equal(o.bob.foesFrame(true).f[0].o, 0, 'which says it holds nothing more to take - no peer is offered a body that answers nothing');
  const only = await bodyAsked([letterOfCredit(9_000)]);
  assert.equal(only.f.o, 0, 'a body holding a letter alone offers nothing');
  assert.equal(only.bob.applyHit('mac-0001', only.macHits[0] ?? { to: 'bob-0002', k: 'world:3,12', i: only.rat.seq, take: 1 }), true);
  assert.deepEqual(only.bobHits.map((h) => h.grant), [[]], 'asked anyway, it says nothing is on it');
  assert.equal(only.rat.entity.items.length, 1, 'and keeps the letter');
});

test('HACKED-GOLD a building\'s containers: a peer\'s word lands without a letter - the field\'s cupboard of nine trillion - and no word this client says carries one (mutants: the receiver; the sender)', () => {
  // the field's nine trillion is the law's now (GOLD-INT) - so the word carries a letter the law takes, which the peer's
  // law alone keeps off the cupboard (a pin the law could pass for it would pin nothing)
  const ctx = { containers: [{ items: [] }], shelves: [] };
  assert.equal(validLootList([wire(letterOfCredit(9_000_000_000_000))]).length, 0, 'the field\'s cupboard letter is no piece to the wire now');
  const word = [{ k: 'container:0', d: 5, r: [wire(letterOfCredit(LAWFUL_LETTER)), wire(dagger())] }];
  assert.equal(validLootList(word[0].r).length, 2, 'a letter inside one count is lawful to it');
  assert.equal(applyInteriorLoot(ctx, word, { today: 5 }), 1, 'the record lands');
  assert.deepEqual(ctx.containers[0].items.map((it) => it.templateIndex), [113], 'without its letter');
  const said = { containers: [{ items: [letterOfCredit(4_000), dagger()] }], shelves: [] };
  const recs = interiorLootRecords(said, ['container:0']);
  assert.equal(recs.length, 1);
  assert.deepEqual(recs[0].r.map((it) => it.templateIndex), [113], 'what this client says carries no letter');
});

test('HACKED-GOLD the dungeon\'s words and a foe\'s heir: every site a peer\'s list lands at, or this client says one from, reads the one law (pinned at its one line each; the building\'s and the body\'s run above) (mutants: each site\'s filter)', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /import \{ peerHanded(?:, neverPeerHanded)?(?:, notCarried)? \} from '\.\.\/systems\/peerWord\.js';/);   // PIN MOVED (PARTY-LOOT, host arbitrates): the room's stored pieces said pair by pair, by peerHanded's own rule; PIN MOVED (AUDIT AUTO-HOLD): and notCarried, a body restored off the wire
  assert.match(dc, /r: peerHanded\(held\)\.map\(\(it\) => \(\{ \.\.\.it \}\)\)/, 'a dungeon\'s record said');
  assert.match(dc, /const items = peerHanded\(validLootList\(rec\.r\)\);/, 'a dungeon\'s record heard');
  assert.match(dc, /const li = notCarried\(peerHanded\(validLootList\(sf\.items\)\)\);/, 'a body on the wire');   // PIN MOVED (AUDIT AUTO-HOLD): and never a piece its reader carries, systems/peerWord.js notCarried
  const xf = read('src/scenes/exteriorFoes.js');
  assert.match(xf, /const items = h \? peerHanded\(validLootList\(f\.entity\?\.items \?\? \[\]\)\) : null;/, 'a foe handed to its heir');
  assert.match(xf, /const items = peerHanded\(validLootList\(r\.it\)\);/, 'a foe taken as its heir');
  assert.match(read('src/scenes/bodyLootHost.js'), /const grant = notCarried\(peerHanded\(validLootList\(data\.grant\)\)\);/, 'a grant');   // PIN MOVED (OUTDOOR-LOOT): the legacy grant's landing is the body block's, the line as it was; PIN MOVED (AUDIT AUTO-HOLD): and never a piece its reader carries, systems/peerWord.js notCarried
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/world/interior/interiorShared.js']) assert.doesNotMatch(read(f), /\bunbound\(/, `${f}: no list a peer hands over is read by SS3's narrower filter alone`);
});

test('HACKED-GOLD a peer\'s price is held under the law\'s ceiling - a dagger priced at nine million lands at its ceiling, an honest one as it came; a letter\'s worth and a boat\'s records are no price, and stand; never under the floor (mutants: the ceiling unregistered; the ceiling unread; the identity records capped)', () => {
  const honest = dagger();
  assert.equal(validLootItem(wire(honest)).value, honest.value, 'an honest price stands');
  const priced = validLootItem({ ...wire(honest), value: 9_000_000 });
  assert.ok(priced.value < 9_000_000, `a forged price is held (${priced.value})`);
  assert.equal(priced.value, worthCeiling(priced), 'at the law\'s ceiling for the piece');
  assert.equal(validLootList([{ ...wire(honest), value: 9_000_000 }])[0].value, worthCeiling(priced), 'in a list the same');
  assert.equal(validLootItem(wire(letterOfCredit(5_000_000))).value, 5_000_000, 'a letter\'s worth is no price to cap (and never rides a peer\'s word at all)');
  const deed = validLootItem({ group: 'UselessItems2', templateIndex: BOAT_TEMPLATES[1], name: 'Deed', value: 200_000, stackCount: 1 });
  if (deed) assert.equal(deed.value, 200_000, 'a boat\'s deed is its hull\'s worth, past any ceiling');
  assert.ok(validLootItem({ ...wire(honest), value: 0 }).value >= 1, 'and the floor still stands');
});

test('HACKED-GOLD the wild zone\'s worn offer lands what can be worn - a coin pile in one paid the purse through the window\'s gold arm and was never chosen (mutants: the offer unworn)', () => {
  assert.equal(wearableItem(dagger()), true);
  assert.equal(wearableItem(goldStack(65_535)), false, 'a coin pile is no worn piece');
  assert.equal(wearableItem(letterOfCredit(5_000)), false, 'nor a letter');
  assert.match(read('src/scenes/world.js'), /const minted = \(Array\.isArray\(body\.items\) \? body\.items : \[\]\)\.map\(\(it\) => \{ const r = validLootList\(\[it\]\)\?\.\[0\] \?\? null; return r && wearableItem\(r\) \? r : null; \}\);/,
    'each record minted alone, in its place - and only a piece that can be worn');
});

test('HACKED-GOLD the put: online a letter of credit goes into no container but the player\'s own - the classic pack refuses a chest in its own words and keeps it; its own pile, its storage and the ground take it, and offline every place does; the enhanced pack\'s gates ask the same (mutants: online unasked; the own pile refused; the classic gate; the enhanced gates)', () => {
  const L = letterOfCredit(5_000);
  assert.equal(letterRefusesPut(L, { container: true, own: false, online: true }), true, 'a chest, online');
  assert.equal(letterRefusesPut(L, { container: true, own: true, online: true }), false, 'the player\'s own pile');
  assert.equal(letterRefusesPut(L, { container: false, own: false, online: true }), false, 'the ground, the wagon, storage');
  assert.equal(letterRefusesPut(L, { container: true, own: false, online: false }), false, 'offline, DFU\'s law');
  assert.equal(letterRefusesPut(dagger(), { container: true, own: false, online: true }), false, 'a dagger goes where it always did');
  const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
  const classic = ({ bag, loot }) => {
    const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: { items: bag, activeEffects: [] }, loot });
    w.mode = 'remove';
    w.tab = 'clothing';
    return w;
  };
  const had = globalThis.location;
  try {
    globalThis.location = { search: '?online' };
    const a = letterOfCredit(5_000), bag = [a], chest = [];
    const w = classic({ bag, loot: { items: () => chest, playerOwned: false, textureArchive: 380, textureRecord: 1 } });
    w._pick(w._filtered().indexOf(a));
    assert.ok(bag.includes(a) && chest.length === 0, 'online, not put in a chest');
    assert.deepEqual(w.boxes, [{ rows: [{ text: letterPutText(itemLongName(a)), center: true }] }], 'and the pack says why');
    const b = letterOfCredit(6_000), bag2 = [b], pile = [];
    const wp = classic({ bag: bag2, loot: { items: () => pile, playerOwned: true, textureArchive: 205, textureRecord: 0 } });
    wp._pick(wp._filtered().indexOf(b));
    assert.ok(pile.includes(b) && !bag2.includes(b), 'into the player\'s own pile');
    const c = letterOfCredit(7_000), bag3 = [c], store = [];
    const ws = classic({ bag: bag3, loot: { items: () => store, storage: true } });
    ws._pick(ws._filtered().indexOf(c));
    assert.ok(store.includes(c) && !bag3.includes(c), 'into the player\'s own storage');
    globalThis.location = { search: '' };
    const d = letterOfCredit(8_000), bag4 = [d], chest2 = [];
    const wo = classic({ bag: bag4, loot: { items: () => chest2, playerOwned: false, textureArchive: 380, textureRecord: 1 } });
    wo._pick(wo._filtered().indexOf(d));
    assert.ok(chest2.includes(d) && !bag4.includes(d), 'offline, a chest takes it as DFU\'s did');
  } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
  // the enhanced pack: a loot session never opens the pack (MAC-M2 B), so the gate stands where the law would reach a
  // container the day one does - read at both of its gates
  const ei = read('src/ui/enhanced/enhancedInventory.js');
  assert.match(ei, /const letterRefuses = \(item\) => letterRefusesPut\(item, \{ container: remote\?\.kind === 'container', own: deps\.loot\?\.playerOwned === true \}\);/);
  assert.match(ei, /if \(remote && letterRefuses\(item\)\) return \{ kind: 'stow', label: null, speaks: true \};/, 'the drag\'s ghost');
  assert.match(ei, /if \(remote && letterRefuses\(item\)\) \{\n\s+notice = letterPutText\(itemLongName\(item, \{ getQuest: deps\.getQuest \?\? null \}\)\);\n\s+return render\(\);/, 'the stow');
});

test('HACKED-GOLD GOLD-INT: a purse, a letter\'s worth and a coin pile\'s count are each one DFU int - at it lawful, past it a finding; a classic save\'s letter its tree\'s unsigned; an account as it was (mutants: the purse unbounded; the letter unbounded; the classic bound; the pile unbounded)', () => {
  assert.equal(GOLD_INT_MAX, 2 ** 31 - 1);
  assert.equal(CLASSIC_VALUE_MAX, 2 ** 32 - 1);
  assert.deepEqual(itemFindings(letterOfCredit(GOLD_INT_MAX)), [], 'a letter at one count');
  assert.deepEqual(itemFindings(letterOfCredit(GOLD_INT_MAX + 1)), ['value'], 'past it');
  assert.deepEqual(itemFindings(letterOfCredit(FORGED_LETTER)), ['value'], 'the field\'s trillion');
  assert.deepEqual(itemFindings({ ...letterOfCredit(CLASSIC_VALUE_MAX), typeDependentData: 0 }), [], 'a classic save\'s letter, its tree\'s unsigned');
  assert.deepEqual(itemFindings({ ...letterOfCredit(CLASSIC_VALUE_MAX + 1), typeDependentData: 0 }), ['value']);
  assert.deepEqual(itemFindings(goldStack(GOLD_INT_MAX)), [], 'a coin pile at one count (a purse dropped)');
  assert.deepEqual(itemFindings(goldStack(GOLD_INT_MAX + 1)), ['stack']);
  assert.ok(GOLD_INT_MAX > LOOT_STACK_MAX, 'the wire\'s pile is the narrower');
  const codes = (save) => characterFindings({ level: 3, ...save }, null).map((f) => f.code);
  assert.deepEqual(codes({ goldPieces: GOLD_INT_MAX }), []);
  assert.deepEqual(codes({ goldPieces: GOLD_INT_MAX + 1 }), ['gold']);
  assert.deepEqual(codes({ goldPieces: 0, bankAccounts: [{ accountGold: FORGED_LETTER, loanTotal: 0 }] }), [], 'an account is not judged by it');
});

// ── the service ───────────────────────────────────────────────────────────────────────────────────────────────────────

async function stand() {
  let now = 1_800_000_000;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const put = async (who, R, save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200);
    return (await res.json()).tradeHeld ?? null;
  };
  const seat = async (handle) => { const who = await s.registered(handle); return { who, R: await seatRealm(s.env, who.secret, handle) }; };
  const half = (P, R, sid, give, get, pick = []) => s.call('/v1/realm/trade', { ...R.at(), sid, give, get, pick }, P.secret);
  const play = (who, seconds) => { raw.prepare('UPDATE players SET played_s = played_s + ? WHERE id = ?').run(seconds, who.id); now += seconds; };
  return { s, raw, put, seat, half, play, done: () => { Date.now = realNow; } };
}
const GOLD = (n) => ({ items: [], gold: n });

test('HACKED-GOLD GOLD-INT over the service: a checkpoint carrying a letter of a trillion is a law finding - its trade held from day one, the budget only measuring; a realm trade then refuses it, as its own (mutants: the letter unbounded; the purse unbounded)', async () => {
  const t = await stand();
  try {
    const { who: ann, R: A } = await t.seat('ann');
    const { who: bea, R: B } = await t.seat('bea');
    assert.equal(await t.put(ann, A, freshSave({ name: 'ann', items: [letterOfCredit(FORGED_LETTER)] })), 'law', 'held by the law, not the budget');
    assert.deepEqual((await t.half(bea, B, 'hackgold1', GOLD(0), GOLD(50))).body, { state: 'waiting' });
    assert.deepEqual((await t.half(ann, A, 'hackgold1', GOLD(50), GOLD(0))).body, { state: 'refused', why: 'trade-held', held: 'mine' }, 'it hands nobody anything');
    const { who: cyd, R: C } = await t.seat('cyd');
    assert.equal(await t.put(cyd, C, freshSave({ name: 'cyd', goldPieces: GOLD_INT_MAX + 1 })), 'law', 'a purse past one count, the same');
    const f = t.raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'law'").get(C.id);
    assert.match(f.detail, /"code":"gold"/);
  } finally { t.done(); }
});

test('HACKED-GOLD the review: who gained past the bucket, largest first, while `holds` lists none of them (nothing is held while the budget measures); and whom a character traded with and what each gave - a developer\'s alone (mutants: the gains unlisted; the order; the trades unlisted; gave and got crossed)', async () => {
  const t = await stand();
  try {
    const mac = await t.s.registered('mac');
    const { who: ann, R: A } = await t.seat('ann');
    const { who: bea, R: B } = await t.seat('bea');
    const letter = letterOfCredit(100_000);
    t.play(ann, 60); t.play(bea, 60);
    assert.equal(await t.put(ann, A, freshSave({ name: 'ann', goldPieces: 5_000_000, items: [letter] })), null, 'measured, not held');
    assert.equal(await t.put(bea, B, freshSave({ name: 'bea', goldPieces: 1_000_000 })), null);
    const holds = await t.s.call('/v1/mod/realm-holds', {}, mac.secret);
    assert.deepEqual(holds.body.characters, [], 'the holds list shows neither');
    const gains = await t.s.call('/v1/mod/realm-gains', { days: 7 }, mac.secret);
    assert.equal(gains.status, 200);
    assert.deepEqual(gains.body.characters.map((c) => [c.id, c.handle, c.held]), [[A.id, 'ann', null], [B.id, 'bea', null]], 'both, the larger gain first');
    assert.ok(gains.body.characters[0].gain >= 5_000_000, `ann's gain (${gains.body.characters[0].gain})`);
    // ann hands bea fifty gold and her letter, settled by the service
    const offer = { items: validLootList([letter]), gold: 50 };
    assert.deepEqual((await t.half(ann, A, 'hackgold2', offer, GOLD(0), [0])).body, { state: 'waiting' });
    assert.equal((await t.half(bea, B, 'hackgold2', GOLD(0), offer)).body.state, 'done');
    const tr = await t.s.call('/v1/mod/realm-trades', { id: A.id }, mac.secret);
    assert.equal(tr.status, 200);
    assert.equal(tr.body.trades.length, 1);
    const [one] = tr.body.trades;
    assert.deepEqual([one.with.id, one.with.handle], [B.id, 'bea'], 'the hand it reached');
    assert.deepEqual(one.gave, { gold: 50, letters: 100_000, pieces: 1 }, 'what ann gave');
    assert.deepEqual(one.got, { gold: 0, letters: 0, pieces: 0 });
    const back = (await t.s.call('/v1/mod/realm-trades', { id: B.id }, mac.secret)).body.trades[0];
    assert.deepEqual([back.with.id, back.got, back.gave], [A.id, { gold: 50, letters: 100_000, pieces: 1 }, { gold: 0, letters: 0, pieces: 0 }], 'and from bea\'s side, the same trade');
    assert.equal((await t.s.call('/v1/mod/realm-gains', {}, ann.secret)).status, 403, 'a developer\'s alone');
    assert.equal((await t.s.call('/v1/mod/realm-trades', { id: A.id }, ann.secret)).status, 403);
  } finally { t.done(); }
});
