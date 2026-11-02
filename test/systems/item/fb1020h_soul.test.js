// FIELD BUGS 2026-10-20h (SOUL-LAW, TRADE-WHOLE; bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md) - the Discord's "Soul
// Trap (Ogre)" report: a Soul Gem holding an Ogre's soul, and the realm's word that its trapper's trading was frozen.
// The Ogre is one of Daggerfall Enemy Expansion's fifty (DEX1, on by default the day of the report), mobile id 282. The
// soul trap's kill door fills a gem with the foe's mobile id (mysticism.js attemptSoulTrap, as EnemyEntity.cs:217 hands
// SoulTrap.FillEmptyTrapItem the foe's MobileEnemy.ID), and item law 8 took the souls of DFU's MobileTypes alone - so the
// account service's judge found every such gem 'soul' (a piece "the game could not have made"), held the character's
// trade and struck it, and a peer's client refused the piece on the wire. Found tracing it (TRADE-WHOLE): the trade's own
// pack let that refused piece go from its offer's records and kept it on the table - hand to hand, the gem left its
// giver's pack at the commit and reached nobody.
//
// Fixtures are the producers': the Mages Guild's Soul Gem (shopStock.js createEmptySoulTrap) and Azura's Star (loot.js
// createArtifact over DFU's own MAGIC.DEF table), each filled by the real kill law (attemptSoulTrap) with each creature's
// id - the classic ones the bestiary holds, the mod's its own tables give (dexInstall.js dexRead), then the registry its
// install leaves; the realm's trade is the real createTradeManager over the host's checkpointed pack, settled by the real
// account Worker over node:sqlite (test/systems/fb1011b_offerid.test.js's rig).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import worker from '../../../server-account/src/index.js';
import { _resetKeyForTests } from '../../../server-account/src/signing.js';
import { judgeSave } from '../../../server-account/src/judge.js';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
import { ACCEPTED } from '../../../src/net/legalLaw.js';
import { createTradeManager, tradeUnreadableText } from '../../../src/net/tradeSession.js';
import { validTradeData } from '../../../src/net/wire.js';
import { createTradePack } from '../../../src/systems/tradePack.js';
import { checkpointedTradePack } from '../../../src/systems/online/onlineCheckpoint.js';
import { realmIo, realmFetch, createRealmSession, realmTradeEscrow } from '../../../src/systems/realmSaves.js';
import { stampItemIds, tradeHeldNotice } from '../../../src/systems/item/itemIds.js';
import { itemFindings } from '../../../src/systems/item/itemLaw.js';
import { createEmptySoulTrap } from '../../../src/systems/shopStock.js';
import { attemptSoulTrap } from '../../../src/systems/mysticism.js';
import { createArtifact } from '../../../src/systems/loot/loot.js';
import { readMagicDef } from '../../../src/formats/magicDef.js';
import { itemNameParts } from '../../../src/systems/item/itemInfo.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { installEnemyExpansion, dexRead } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { DFU_MAGIC_ITEMS } from '../../dfuMagicItems.mjs';
import { d1 } from '../../accountDb.mjs';
import { r2, seatRealm } from '../../realmSeat.mjs';

/** The Soul Trap spell's effect on the foe, as the cast lays it - its chance frozen at the cast; a roll of 0 succeeds. */
const TRAP = () => ({ activeEffects: [{ kind: 'soulTrap', chance: 100 }] });
/** `item` (a Soul Gem, or Azura's Star) filled by the kill law with the soul of `id`. */
function filled(item, id) {
  const r = attemptSoulTrap(TRAP(), id, [item], 0);
  assert.equal(r.alert, 'trapSuccess', `${id}`);
  assert.equal(item.trappedSoulType, id);
  return item;
}
const byId = (a, b) => a - b;
/** DFU's MobileTypes as the bestiary holds them before any mod's install: 0-42 its monsters, 128-146 its people. */
const CLASSIC = Object.keys(ENEMY_BASICS).map(Number).sort(byId);
/** The mod's fifty, as its own tables give them - read, not installed (the account service installs nothing). */
const MOD = [...dexRead().enemies.keys()].sort(byId);
const OGRE = MOD.find((id) => dexRead().enemies.get(id).props.name === 'Ogre');

/** DFU's table as MAGIC.DEF's bytes (test/systems/item/int1_itemlaw.test.js's - formats/magicDef.js reads 62 a record). */
function dfuMagicDef() {
  const SIZE = 62;
  const buf = new Uint8Array(4 + DFU_MAGIC_ITEMS.length * SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, DFU_MAGIC_ITEMS.length, true);
  let o = 4;
  for (const r of DFU_MAGIC_ITEMS) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = r.material;
  }
  return buf;
}
const MAGIC = readMagicDef(dfuMagicDef());

test('SOUL-LAW, the report: the Ogre is the mod\'s 282, and the Mages Guild\'s Soul Gem filled with its soul is a piece the game makes - no law finding, and the account service\'s judge finds nothing in a save that holds it (law 8: [\'soul\'], and the judge\'s finding on template 274 froze the character\'s trading)', () => {
  assert.equal(OGRE, 282, 'the mod\'s own MonsterBase row');
  assert.equal(CLASSIC.includes(OGRE), false, 'no MobileTypes of DFU\'s');
  const gem = filled(createEmptySoulTrap(), OGRE);
  assert.deepEqual(itemFindings(gem), []);
  assert.deepEqual(judgeSave({ level: 1, goldPieces: 100, items: [gem] }).findings, []);
});

test('SOUL-LAW: every creature a soul gem can hold - DFU\'s 62 and the mod\'s fifty - fills the Soul Gem and Azura\'s Star lawfully, and the fifty are the creatures the mod\'s install fields; the gem is named for its soul (law 8 refused the fifty, every one; mutants: the mod\'s list unread)', () => {
  assert.equal(CLASSIC.length, 62);
  assert.equal(MOD.length, 50);
  const refused = (mint) => [...CLASSIC, ...MOD].filter((id) => itemFindings(filled(mint(), id)).length > 0);
  assert.deepEqual(refused(createEmptySoulTrap), [], 'the Soul Gem');
  // Azura's Star: a monster's by the death door (EntityTypes.EnemyMonster, DaggerfallEntityBehaviour.cs:239-245), any by the
  // spell, which fills the Star first (SoulTrap.cs:126-134)
  assert.deepEqual(refused(() => createArtifact(MAGIC, 9)), [], 'Azura\'s Star');
  // the install's registry is exactly these: no creature the game fields that the sweep did not ask
  installEnemyExpansion({ on: true, meaner: false, log: () => {} });
  assert.deepEqual(Object.keys(ENEMY_BASICS).map(Number).sort(byId), [...CLASSIC, ...MOD]);
  assert.equal(itemNameParts(filled(createEmptySoulTrap(), OGRE)).name, 'Soul Trap (Ogre)', 'ItemHelper.ResolveItemLongName\'s soul tail (ItemHelper.cs:352-368)');
});

test('SOUL-LAW: the law\'s list is the mod\'s tables\' own, with MUDEX and without; a soul no creature has is still a finding (mutants: a forged soul taken; the classic ranges widened)', async () => {
  const { DEX_ENEMY_IDS } = await import('../../../src/systems/enemyExpansion/dexIds.js');
  assert.deepEqual([...DEX_ENEMY_IDS], MOD);
  assert.deepEqual([...dexRead({ mudex: true }).enemies.keys()].sort(byId), MOD, 'MUDEX\'s lines edit, they add no enemy');
  for (const soul of [43, 127, 147, 255, 291, 383, 399, 1000]) {
    assert.deepEqual(itemFindings({ ...createEmptySoulTrap(), trappedSoulType: soul }), ['soul'], `soul ${soul}`);
  }
});

test('SOUL-LAW headless - as the account service loads the law, in a process that imports its judge and nothing of the game: every soul of the fifty in a gem is no finding (law 8: fifty \'soul\' findings on template 274)', () => {
  const gems = MOD.map((id) => filled(createEmptySoulTrap(), id));
  const judge = new URL('../../../server-account/src/judge.js', import.meta.url).href;
  const headless = `const { judgeSave } = await import(${JSON.stringify(judge)});`
    + ` process.stdout.write(JSON.stringify(judgeSave({ level: 1, goldPieces: 100, items: ${JSON.stringify(gems)} }).findings));`;
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', headless], { encoding: 'utf8' })), []);
});

// ── THE TRADE ─────────────────────────────────────────────────────

const hero = (name, items) => ({ name, items, goldPieces: 100, stats: { strength: 60 } });
/** Wait until `ok()` holds, a few real milliseconds at a time (test/net/realm4.test.js's). */
async function until(ok, what, ms = 30_000) {
  const end = performance.now() + ms;
  while (!(await ok())) {
    if (performance.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((res) => { setTimeout(res, 2); });
  }
}

test('SOUL-LAW through the realm: a character traps an Ogre\'s soul, checkpoints - its trading is not frozen, no notice said - and trades the gem to another, which the realm settles; the gem arrives with its Ogre (law 8: the checkpoint held it - "The realm is reviewing this character: it carries a Soul Trap the game could not have made. Trading is frozen until it is gone." - and the trade was refused)', async () => {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const ents = { A: hero('Ogrebane', [createEmptySoulTrap()]), B: hero('Brenna', []) };
  const snap = (e) => { stampItemIds(e); return JSON.stringify({ name: e.name, level: 1, items: e.items, goldPieces: e.goldPieces }); };
  let clock = 0;
  const lost = [], said = { A: [], B: [] }, notices = { A: [], B: [] };
  const tabs = {};
  for (const me of ['A', 'B']) {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const kept = new Map([[SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret })]]);
    const storage = { get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
    const io = realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), env), storage });
    const char = await seatRealm(env, g.secret, ents[me].name, JSON.parse(snap(ents[me])));
    const session = createRealmSession({ io, id: char.id, lease: char.lease, seq: 1, onLost: (why) => lost.push(`${me}: ${why}`) });
    // scenes/realmHoldHost.js's door: the hold's notice, as the player reads it
    session.onTradeHeld = (prev, now, why) => { const text = tradeHeldNotice(prev, now, why); if (text) notices[me].push(text); };
    tabs[me] = { io, id: char.id, session, checkpoint: () => session.checkpoint(snap(ents[me])) };
  }
  // A casts Soul Trap on an Ogre and kills it: the Mages Guild's gem in its pack takes the soul
  const gem = ents.A.items[0];
  filled(gem, OGRE);
  await tabs.A.checkpoint();
  await until(() => tabs.A.session.tradeHeld !== undefined, 'the judge\'s answer');
  assert.equal(tabs.A.session.tradeHeld, null, `the trading open: ${notices.A.join(' / ')}`);
  assert.deepEqual(notices.A, [], 'and nothing said');
  const q = [];
  const id = (who) => `peer${who.repeat(4)}`;
  const mgrs = {};
  for (const [me, other] of [['A', 'B'], ['B', 'A']]) {
    mgrs[me] = createTradeManager({
      pack: checkpointedTradePack(createTradePack(ents[me], { stampIds: stampItemIds }), tabs[me].checkpoint),   // the host's pack, as world.js builds it
      now: () => clock, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id(me),
      send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id(me), to: v.to === id('A') ? 'A' : 'B', d: v }); return true; },
      near: () => true, open: () => {},
      escrow: realmTradeEscrow({ session: tabs[me].session, checkpoint: tabs[me].checkpoint, wait: async () => { clock += 100; await new Promise((res) => { setImmediate(res); }); }, now: () => clock }),
    });
  }
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  assert.deepEqual(mgrs.A.request(id('B')), { ok: true }); pump();
  assert.deepEqual(mgrs.B.request(id('A')), { ok: true }); pump();
  const g = mgrs.A.session, t = mgrs.B.session;
  assert.deepEqual(g.setOffer([{ item: gem, count: 1 }], 0), { ok: true }); pump();
  assert.deepEqual(t.theirs.items.map((it) => it.trappedSoulType), [OGRE], 'the peer sees the gem offered');
  assert.deepEqual(t.lock(), { ok: true }); pump();
  assert.deepEqual(g.lock(), { ok: true }); pump();
  assert.deepEqual(t.confirm(), { ok: true }); pump();
  assert.deepEqual(g.confirm(), { ok: true }); pump();
  await until(() => { pump(); return g.isOver && t.isOver; }, 'the realm settled it');
  assert.deepEqual([g.phase, t.phase], ['done', 'done'], `${said.A} / ${said.B}`);
  assert.deepEqual([ents.A.items.length, ents.B.items.map((it) => it.trappedSoulType)], [0, [OGRE]]);
  await until(async () => JSON.parse((await realmFetch(tabs.B.io, tabs.B.id)).text).items.length === 1, 'B\'s record');
  assert.equal(JSON.parse((await realmFetch(tabs.B.io, tabs.B.id)).text).items[0].trappedSoulType, OGRE, 'and so does the realm\'s record of B');
  assert.deepEqual([notices.A, notices.B, lost], [[], [], []], 'neither held, neither tab lost');
});

test('TRADE-WHOLE hand to hand: a piece the item law refuses is said and kept off the table, never set out on it to ride no wire - the giver keeps it; a peer\'s lot that carries one is refused whole, in words (before: the offer stood, the wire carried nothing, and at the commit the gem left its giver\'s pack and reached nobody; mutants: the lot clamped piece by piece)', () => {
  const forgedSoul = () => ({ ...createEmptySoulTrap(), trappedSoulType: 1000 });   // a soul no creature has: still a finding
  const ents = { A: hero('Ogrebane', [forgedSoul()]), B: hero('Brenna', []) };
  const q = [], said = { A: [], B: [] };
  const id = (who) => `peer${who.repeat(4)}`;
  const mgrs = {};
  for (const [me, other] of [['A', 'B'], ['B', 'A']]) {
    mgrs[me] = createTradeManager({
      pack: createTradePack(ents[me]), say: (t) => said[me].push(t), peerName: () => other, selfId: () => id(me),
      send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id(me), to: v.to === id('A') ? 'A' : 'B', d: v }); return true; },
      near: () => true, open: () => {},
    });
  }
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  mgrs.A.request(id('B')); pump();
  mgrs.B.request(id('A')); pump();
  const g = mgrs.A.session, t = mgrs.B.session;
  const piece = ents.A.items[0];
  assert.deepEqual(g.setOffer([{ item: piece, count: 1 }], 0), { ok: false, why: 'That cannot be traded.' });
  assert.deepEqual([g.mine.entries.length, t.theirs.items.length, ents.A.items], [0, 0, [piece]], 'nothing on the table, the piece in its pack');
  assert.deepEqual(g.lock(), { ok: false, why: 'Nothing is being traded.' });
  // the peer's side: a lot whose second piece the law refuses (a forged frame - an honest build never sends one now)
  const honest = createEmptySoulTrap();
  t.receive({ k: 'offer', s: t.sid, r: 1, items: [honest, forgedSoul()], g: 0 });
  assert.equal(t.phase, 'cancelled', 'refused whole');
  assert.equal(said.B.at(-1), tradeUnreadableText('A'), 'in words: the trade is off');
  assert.deepEqual(t.theirs.items, [], 'the honest piece beside it never shown as the lot');
});
