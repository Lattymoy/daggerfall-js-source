// INT2/INT3/INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"; asked what a breach does: "Freeze trading"; and the characters already in the realm: "Items judged,
// wealth baselined"): THE JUDGE, THE HOLD AND THE REVIEW, against the real Worker over the real migrations.
//   - judge.js pure: the character law (level, its claim, attributes, skills), the item law over every list with where
//     each finding lies, the wealth of what the character OWNS (never the world's untaken loot; loans owed; a bound or a
//     quest's piece worth nothing);
//   - every checkpoint judged: a lawless one STORED and its character held, said in the answer, a finding kept; a route
//     handing its value to another player refused; a clean checkpoint lifting it until three strikes, then staff alone;
//   - every route that hands a realm character's value on says so (a source sweep: no prepareRealmRecord that takes goods
//     or gold out without `outbound`, the named sinks aside);
//   - the service's own writes WITNESSED; the last clean checkpoint KEPT past the rotation, and the rollback to it;
//   - the review: a developer's alone - the held, a character's findings, clear, hold, rollback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../server-account/src/index.js';
import { standService } from './accountDb.mjs';
import { seatRealm, freshSave } from './realmSeat.mjs';
import { judgeSave, wealthOf, ownedItemLists, characterFindings, STRIKES_FOR_REVIEW } from '../server-account/src/judge.js';
import { prepareRealmRecord, holdRefusal, dropObjects, JUDGE_COLUMNS } from '../server-account/src/realm.js';
import { creditSave } from '../src/net/realmGoldLaw.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { applyRarity } from '../src/systems/lootRarity.js';
import { seeded } from './honestItems.mjs';

const dagger = () => createWeapon(113, 1, seeded(7));
/** A Rare dagger as the ladder mints one. */
const rareDagger = () => applyRarity(dagger(), 'rare', seeded(11));

async function stand() {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const put = async (who, R, save, { summary = null, seq = null } = {}) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(seq ?? at.seq + 1), ...(summary ? { 'x-realm-summary': JSON.stringify(summary) } : {}) },
      body: typeof save === 'string' ? save : JSON.stringify(save),
    }), s.env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const row = (id) => ({ ...raw.prepare(`SELECT seq, obj, prev, ${JUDGE_COLUMNS} FROM realm_characters WHERE id = ?`).get(id) });
  const findings = (id) => raw.prepare('SELECT kind, detail FROM realm_findings WHERE char_id = ? ORDER BY id').all(id).map((r) => ({ kind: r.kind, detail: JSON.parse(r.detail) }));
  const seat = async (handle, save = null) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    if (save) assert.equal((await put(who, R, save)).status, 200, `${handle}'s save lands`);
    return { who, R };
  };
  return { ...s, raw, put, row, findings, seat };
}

test('INT2: the character law - a level the realm reads, a tile that claims the save\'s own, attributes to 100 and skills to the hard cap', () => {
  assert.deepEqual(characterFindings(freshSave(), { level: 1 }), []);
  assert.deepEqual(characterFindings(freshSave(), null), [], 'no tile claimed, none judged');
  assert.deepEqual(characterFindings(freshSave({ level: 0 }), null).map((f) => f.code), ['level']);
  assert.deepEqual(characterFindings({ goldPieces: 1 }, null).map((f) => f.code), ['level'], 'a save with no level is no character');
  assert.deepEqual(characterFindings(freshSave({ level: 4 }), { level: 9 }).map((f) => f.code), ['level-claim']);
  assert.deepEqual(characterFindings(freshSave({ stats: { strength: 100, agility: 101 } }), null), [{ code: 'stat', at: 'agility' }]);
  assert.deepEqual(characterFindings(freshSave({ skills: [100, 200, 201, -1] }), null).map((f) => f.at), [2, 3]);
});

test('INT2: judgeSave - every item judged where it lies; the wealth is what the character OWNS: the purse, the banks less their loans, its own lists - never the world\'s loot it has not taken; a bound or a quest\'s piece worth nothing', () => {
  const sword = rareDagger();
  const forged = { ...dagger(), affixes: [{ id: 'damage', value: 40 }] };
  const save = freshSave({
    goldPieces: 500,
    bankAccounts: [{ accountGold: 1_000, loanTotal: 300 }],
    items: [sword, { ...dagger(), bound: true }],
    wagonItems: [forged],
    sceneCache: { scenes: [{ lootContainers: [{ items: [{ ...dagger(), value: 99_999 }] }] }] },
  });
  const j = judgeSave(save, { level: 1 });
  assert.deepEqual(j.findings, [{ code: 'rarity', list: 1, at: 0, t: 113 }], 'the wagon\'s forged dagger, named where it lies');
  assert.equal(j.count, 1);
  assert.equal(j.items, 4, 'the world\'s chest is judged too');
  assert.equal(ownedItemLists(save).flat().length, 3, 'owned: the pack and the wagon - never the dungeon\'s chest');
  assert.equal(wealthOf(save), 500 + 1_000 - 300 + sword.value + forged.value, 'the bound dagger worth nothing, the chest\'s loot no one\'s yet');
  assert.deepEqual(judgeSave([1], null).findings, [{ code: 'save' }]);
});

test('INT2/INT3: a lawless checkpoint is STORED and its character held - said in the answer and kept as a finding; a route handing its value on refuses it; a clean checkpoint lifts it, until three strikes', async () => {
  const s = await stand();
  const { who, R } = await s.seat('ann');
  assert.deepEqual(s.row(R.id).held, null);
  assert.equal(s.row(R.id).judged_seq, 1, 'the first save judged');
  const forged = freshSave({ name: 'ann', items: [{ ...dagger(), affixes: [{ id: 'damage', value: 40 }] }] });
  const r = await s.put(who, R, forged, { summary: { level: 1 } });
  assert.deepEqual([r.status, r.body], [200, { ok: true, seq: 2, tradeHeld: 'law' }], 'stored, and held');
  assert.deepEqual([s.row(R.id).seq, s.row(R.id).held, s.row(R.id).strikes], [2, 'law', 1]);
  assert.deepEqual(s.findings(R.id).map((f) => [f.kind, f.detail.count]), [['law', 1]]);
  // a route that hands value on - the record changed with an act marked outbound - refuses; an inbound act does not
  const ctx = { db: s.env.DB, bucket: s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: 1 };
  assert.deepEqual(await prepareRealmRecord(ctx, who.id, R.at(), () => null, { outbound: true }), { error: 'trade-held', held: 'law' });
  assert.ok((await prepareRealmRecord(ctx, who.id, R.at(), (save) => (creditSave(save, 1) ? null : 'bad'))).steps, 'a credit moves');
  // a trade's half that gives is refused: the realm's own trade route
  const { who: bea, R: B } = await s.seat('bea');
  const half = (P, at, sid, give, get) => s.call('/v1/realm/trade', { ...at, sid, give, get, pick: [] }, P.secret);
  assert.deepEqual((await half(bea, B.at(), 'heldtrade1', { items: [], gold: 0 }, { items: [], gold: 50 })).body, { state: 'waiting' });
  assert.deepEqual((await half(who, R.at(), 'heldtrade1', { items: [], gold: 50 }, { items: [], gold: 0 })).body, { state: 'refused', why: 'trade-held' });
  // the forged piece gone: the next checkpoint lifts the hold
  assert.deepEqual((await s.put(who, R, freshSave({ name: 'ann' }), { summary: { level: 1 } })).body.tradeHeld, null);
  assert.deepEqual([s.row(R.id).held, s.row(R.id).strikes], [null, 1]);
  // three strikes: the hold stays for staff
  for (let i = 0; i < STRIKES_FOR_REVIEW - 1; i++) await s.put(who, R, forged);
  assert.equal(s.row(R.id).strikes, STRIKES_FOR_REVIEW);
  assert.equal((await s.put(who, R, freshSave({ name: 'ann' }))).body.tradeHeld, 'law', 'clean, and held still');
  assert.equal(holdRefusal(null), null);
  assert.deepEqual(holdRefusal({ held: null, judged_seq: null }), { error: 'record-unjudged' }, 'a record no checkpoint has been judged since moves nothing');
});

test('INT3: EVERY ROUTE THAT HANDS A REALM CHARACTER\'S VALUE ON SAYS SO - no prepareRealmRecord that takes goods or gold out of a record without `outbound`, the sinks aside (a home and its decor bought from the realm, a guild founded); and the trade asks the hold of each side that gives', () => {
  const dir = new URL('../server-account/src/', import.meta.url);
  const SINKS = { 'homes.js': 1, 'decor.js': 1, 'guilds.js': 1 };   // payFromSave into nobody's hands: the realm's own price
  const found = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    let at = 0;
    for (;;) {
      const i = src.indexOf('prepareRealmRecord(ctx', at);
      if (i < 0) break;
      let depth = 0, j = src.indexOf('(', i);
      for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')' && --depth === 0) break; }
      const call = src.slice(i, j + 1);
      at = j;
      if (!/takeTradeGoods|payFromSave/.test(call)) continue;
      if (/outbound: (true|kind === 'deposit')/.test(call)) { found[f] = (found[f] ?? 0) + 1; continue; }
      assert.ok(SINKS[f] && --SINKS[f] >= 0, `${f}: a record's goods or gold out with no word that they leave for another player:\n${call.slice(0, 300)}`);
    }
  }
  assert.deepEqual(found, { 'alchemy.js': 1, 'cards.js': 1, 'guildVault.js': 1, 'guilds.js': 1, 'market.js': 2, 'rent.js': 1 });
  const trade = readFileSync(new URL('realmTrade.js', dir), 'utf8');
  assert.match(trade, /if \(\(gives\(firstHalf\) && holdRefusal\(other\)\) \|\| \(gives\(half\) && holdRefusal\(row\)\)\) return refuse\(db, sid, 'trade-held', playerId, asker, true\);/);
});

test('INT5/INT6: the service\'s own writes are WITNESSED, the next judgement charging none of them; the last clean checkpoint is KEPT past the rotation, and a staff rollback restores it', async () => {
  const s = await stand();
  const { who, R } = await s.seat('cai', freshSave({ name: 'cai', goldPieces: 100 }));
  const clean = s.row(R.id);
  assert.equal(clean.clean_seq, 2);
  const ctx = { db: s.env.DB, bucket: s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: 1 };
  const prep = await prepareRealmRecord(ctx, who.id, R.at(), (save) => (creditSave(save, 700) ? null : 'bad'));
  await s.env.DB.batch(prep.steps);
  await dropObjects(s.env.SAVES, [prep.prev]);   // as every caller does once its batch landed
  assert.equal(s.row(R.id).witnessed, 700, 'the credit witnessed');
  await s.put(who, R, freshSave({ name: 'cai', goldPieces: 800 }));
  assert.deepEqual([s.row(R.id).witnessed, s.row(R.id).wealth], [0, 800], 'the judgement takes it in');
  assert.deepEqual(s.findings(R.id), [], 'and charges none of it');
  // a lawless checkpoint: the clean one is kept while two more rotate past it
  const cleanKey = s.row(R.id).clean_obj;
  for (let i = 0; i < 3; i++) await s.put(who, R, freshSave({ name: 'cai', goldPieces: 800, items: [{ ...dagger(), group: 'Gems' }] }));
  assert.ok(s.env.SAVES._map.has(cleanKey), 'the last clean save stands');
  assert.equal(s.env.SAVES._map.size, 3, 'the save, the one before, and the clean one');
  // the review: a developer's alone
  const outsider = await s.registered('rando');
  assert.equal((await s.call('/v1/mod/realm-holds', {}, outsider.secret)).status, 403);
  const mac = await s.registered('mac');
  const holds = (await s.call('/v1/mod/realm-holds', {}, mac.secret)).body.characters;
  assert.deepEqual(holds.map((c) => [c.id, c.held, c.strikes]), [[R.id, 'law', 3]]);
  const f = (await s.call('/v1/mod/realm-findings', { id: R.id }, mac.secret)).body;
  assert.equal(f.findings.length, 3);
  assert.ok(f.hours.length >= 1, 'the wealth by the hour');
  const rb = await s.call('/v1/mod/realm-rollback', { id: R.id, note: 'the gem-daggers' }, mac.secret);
  assert.equal(rb.status, 200);
  const after = s.row(R.id);
  assert.deepEqual([after.obj, after.held, after.strikes, after.wealth], [cleanKey, null, 0, 800], 'the clean save is the record, the hold lifted');
  assert.equal(s.raw.prepare('SELECT lease FROM realm_characters WHERE id = ?').get(R.id).lease, null, 'the seat taken from the tab - the next join loads it');
  assert.deepEqual(s.findings(R.id).at(-1).detail, { act: 'rollback', by: 'mac', note: 'the gem-daggers', from: 7, to: 4 });
  assert.equal((await s.call('/v1/mod/realm-hold', { id: R.id, note: 'watching' }, mac.secret)).status, 200);
  assert.equal(s.row(R.id).held, 'staff');
  assert.equal((await s.call('/v1/mod/realm-clear', { id: R.id }, mac.secret)).status, 200);
  assert.equal(s.row(R.id).held, null);
  assert.equal((await s.call('/v1/mod/realm-rollback', { id: 'r00000000000000000000' }, mac.secret)).status, 404);
});
