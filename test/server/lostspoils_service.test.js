// LOST-SPOILS (2026-10-22, the owner: "I want to utilize the mailbox as a way to obtain lost items/loot if not picked up
// from a boss. For example, the oblivion gates. Abyss dungeons, elite breaches, etc"; asked, "Mail the leftovers"): THE
// SERVICE'S SIDE - server-account/src/lostSpoils.js and its route, /v1/post/lost. A floor's leftovers are written as
// pieces of the server's post, one an item, from the Lost and Found - only under a kill the service itself recorded for
// the asking account (a gate's, an Hour's, a Redoubt that paid), within the window, each once; and their claim is charged
// to the budget, never witnessed. Every piece here is one the game's own rollers made (TEST THE SHAPE THE PRODUCER MINTS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { seatRealm, recordOf } from '../realmSeat.mjs';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';
import { LOST_SENDER, LOST_WORDS } from '../../server-account/src/lostSpoils.js';
import { LOST_INDEX_MAX, LOST_WINDOW_S, LOST_WAITING_MAX, LOST_FINAL, LOST_BATCH, LOST_ITEM_BYTES, LOST_BODY_MAX, lostKillOf, lostBatchOf, isLostBatch } from '../../src/net/lostLaw.js';
import { POST_BATCH_RE, POST_SENDER, POST_SUBJECT_MAX, POST_BODY_MAX, postHead } from '../../src/net/postLaw.js';
import { spoilsList } from '../../src/scenes/spoilsPool.js';
import { sdSpoilsList, sdSpoilsDay } from '../../src/systems/superDungeon/sdSpoils.js';
import { egSpoilsList, egSpoilsDay } from '../../src/systems/eliteGates/egSpoils.js';
import { mintHourlock, mintGilded, DRAGONFIRE_OATH, VOLENDRUNGS_ECHO, KETCHMASTERS_WORD } from '../../src/systems/gilded.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { createPistolet } from '../../src/systems/pistolet.js';

const nowS = () => Math.floor(Date.now() / 1000);
/** A floor's leftovers as the pool sends them: each item piece of the spoils as rolled, by its place. */
const leftovers = (list) => list.map((p, i) => ({ i, p })).filter(({ p }) => p.kind === 'item').map(({ i, p }) => ({ i, item: JSON.parse(JSON.stringify(p.item)) }));
const box = async (svc, who) => {
  const res = await svc.fetch('https://accounts.invalid/v1/post/box', { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } });
  return (await res.json());
};
const lost = (svc, who, body) => svc.call('/v1/post/lost', body, who.secret);
/** An Hour's kill row as sds.js claimSd writes it, and a Redoubt's as egEconomy.js egRedoubtPay does. */
const sdKill = (svc, who, slot, at = nowS()) => svc.env.DB._raw.prepare('INSERT INTO sd_kills (slot, account, boss, earned, lv, nonce, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(slot, who.id, 'remnant', 'dealt', 20, 'n0', at);
const egKill = (svc, who, b, w, paid, at = nowS()) => svc.env.DB._raw.prepare('INSERT INTO eg_redoubts (b, account, w, h, t, at, wk, paid, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(b, who.id, w, w, 0, at, 0, paid, 'n0');

test('LOST-SPOILS the law and the door: one route behind a session, a registered account\'s alone (the post\'s wall); a floor\'s day names its kill - a gate\'s day, an Hour\'s slot, a breach\'s Redoubt - and every batch fits the post\'s shape and is the Lost and Found\'s; the words within the post\'s bounds (mutants: the route open; a guest let in; a kill misread)', async () => {
  assert.ok(ROUTES.has('/v1/post/lost') && !OPEN_ROUTES.has('/v1/post/lost'));
  assert.deepEqual(lostKillOf(20380), { kind: 'gate', day: 20380, key: 'gate-20380' });
  assert.deepEqual(lostKillOf(sdSpoilsDay(12)), { kind: 'sd', slot: 12, key: 'sd-12' });
  assert.deepEqual(lostKillOf(egSpoilsDay('0123456789abcdef', 5)), { kind: 'eg', b: '0123456789abcdef', w: 5, key: 'eg-0123456789abcdef-5' });
  for (const junk of [0, -3, 1.5, '20380', 'sd:0', 'eg:xyz:1', null, {}]) assert.equal(lostKillOf(junk), null, String(junk));
  const longest = lostBatchOf(lostKillOf(egSpoilsDay('f'.repeat(16), 99999)), LOST_INDEX_MAX - 1);
  assert.match(longest, POST_BATCH_RE, 'the longest batch fits the post\'s own shape');
  assert.ok(isLostBatch(longest) && !isLostBatch('spire-stake-x') && !isLostBatch('hours-first-hourlock'));
  assert.equal(LOST_BATCH, 'lost-');
  for (const k of ['gate', 'sd', 'eg']) {
    assert.ok(LOST_WORDS[k].subject.length <= POST_SUBJECT_MAX && LOST_WORDS[k].body.length <= POST_BODY_MAX, k);
    assert.ok(LOST_WORDS[k].body.endsWith(`- ${LOST_SENDER}`), `${k} is signed`);
  }
  assert.notEqual(LOST_SENDER, POST_SENDER, 'never the developers\' name');
  const svc = await standService();
  const g = await svc.guest();
  assert.deepEqual(await lost(svc, g, { day: 20380, pieces: [{ i: 0, item: mintHourlock() }] }), { status: 403, body: { error: 'post-needs-account' } }, 'a guest has no mailbox');
  assert.ok(LOST_FINAL.includes('post-needs-account'), 'and the client gives a guest\'s floor to the pack');
});

test('LOST-SPOILS a gate\'s leftovers: written under the kill its receipt recorded, a piece an item from the Lost and Found, the record as rolled - and asked again, nothing written twice; the box lists them as waiting gifts (mutants: the kill unasked; once a piece dropped; the sender the developers\')', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const day = 20380;
  const list = spoilsList(4242, 20);
  const send = leftovers(list).slice(1);   // the first pressed on the floor; the rest left there
  assert.ok(send.length >= 3);
  assert.deepEqual(await lost(svc, ann, { day, pieces: send }), { status: 409, body: { error: 'lost-no-kill' } }, 'no kill recorded yet: asked again later');
  assert.equal((await svc.claim(ann, day, nowS())).status, 200, 'the receipt claimed - the kill recorded');
  const r = await lost(svc, ann, { day, pieces: send });
  assert.deepEqual(r, { status: 200, body: { ok: true, sent: send.length, kept: send.length } });
  const rows = svc.env.DB._raw.prepare('SELECT batch, sender, subject, body, item FROM server_post WHERE to_id = ? ORDER BY batch').all(ann.id);
  assert.deepEqual(rows.map((x) => x.batch).sort(), send.map((p) => lostBatchOf(lostKillOf(day), p.i)).sort(), 'a batch a piece, its place in the spoils');
  for (const row of rows) {
    assert.deepEqual([row.sender, row.subject, row.body], [LOST_SENDER, LOST_WORDS.gate.subject, LOST_WORDS.gate.body]);
    const i = Number(row.batch.split('-').at(-1));
    assert.deepEqual(JSON.parse(row.item), send.find((p) => p.i === i).item, 'the item as it was rolled');
  }
  assert.deepEqual(await lost(svc, ann, { day, pieces: send }), { status: 200, body: { ok: true, sent: 0, kept: send.length } }, 'asked again (its answer lost): nothing twice');
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM server_post WHERE to_id = ?').get(ann.id).n, send.length);
  const b = await box(svc, ann);
  assert.equal(b.unclaimed, send.length, 'each waiting to be claimed');
  assert.deepEqual(b.post.map(postHead), b.post, 'read through the post\'s law');
  assert.ok(b.post.every((p) => p.from === LOST_SENDER && p.item && p.claimed === false));
  // a piece already there is sent whatever else stands now: the window past, a second send of the same pieces still ok
  svc.env.DB._raw.prepare('UPDATE gate_kills SET at = ? WHERE account = ?').run(nowS() - LOST_WINDOW_S - 10, ann.id);
  assert.deepEqual((await lost(svc, ann, { day, pieces: send })).body, { ok: true, sent: 0, kept: send.length }, 'a send that landed is never refused later');
  assert.deepEqual(await lost(svc, ann, { day, pieces: leftovers(list).slice(0, 1) }), { status: 409, body: { error: 'lost-spent' } }, 'but a new piece past the window is not taken');
});

test('LOST-SPOILS the kill is the service\'s, and the account\'s: another account\'s kill holds none of mine; an Hour\'s slot; a Redoubt only where it paid (a week\'s second pays its gold alone); the window (mutants: another\'s kill taken; a gold-only Redoubt taken; the window dropped)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob');
  const day = 20381;
  assert.equal((await svc.claim(bob, day, nowS())).status, 200);
  assert.deepEqual((await lost(svc, ann, { day, pieces: leftovers(spoilsList(1, 5)) })).body, { error: 'lost-no-kill' }, 'Bob\'s kill is not Ann\'s');
  // the Hour
  const sd = leftovers(sdSpoilsList(77, 30));
  assert.deepEqual((await lost(svc, ann, { day: sdSpoilsDay(9), pieces: sd })).body, { error: 'lost-no-kill' });
  sdKill(svc, ann, 9);
  assert.deepEqual((await lost(svc, ann, { day: sdSpoilsDay(9), pieces: sd })).body, { ok: true, sent: sd.length, kept: sd.length });
  assert.equal(svc.env.DB._raw.prepare('SELECT subject FROM server_post WHERE to_id = ? LIMIT 1').get(ann.id).subject, LOST_WORDS.sd.subject);
  // a Redoubt
  const b = '0123456789abcdef', eg = leftovers(egSpoilsList(55, 30, 5, { lord: '', pity: [], goldOnly: false, embers: 2 }));
  egKill(svc, ann, b, 5, 0);
  assert.deepEqual((await lost(svc, ann, { day: egSpoilsDay(b, 5), pieces: eg })).body, { error: 'lost-no-kill' }, 'a Redoubt that paid its gold alone threw no items');
  egKill(svc, ann, b, 10, 1);
  assert.deepEqual((await lost(svc, ann, { day: egSpoilsDay(b, 10), pieces: eg })).body, { ok: true, sent: eg.length, kept: eg.length });
  // the window
  sdKill(svc, ann, 10, nowS() - LOST_WINDOW_S - 5);
  assert.deepEqual((await lost(svc, ann, { day: sdSpoilsDay(10), pieces: sd })).body, { error: 'lost-spent' });
  sdKill(svc, ann, 11, nowS() - LOST_WINDOW_S + 60);
  assert.equal((await lost(svc, ann, { day: sdSpoilsDay(11), pieces: sd })).status, 200, 'inside it');
});

test('LOST-SPOILS a send\'s shape and its pieces\' law: places under LOST_INDEX_MAX, none twice; an item the box can name; no crafted provenance, a checkpoint\'s uid dropped; the item law\'s refusal; the account\'s waiting bound (mutants: a place unbounded; a forged piece taken; the uid kept; the bound dropped)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const day = 20382;
  assert.equal((await svc.claim(ann, day, nowS())).status, 200);
  const [a, c] = leftovers(spoilsList(9, 12));
  const no = async (pieces, error = 'lost-pieces') => assert.deepEqual((await lost(svc, ann, { day, pieces })).body, { error }, JSON.stringify(pieces).slice(0, 80));
  await no([]);
  await no('x');
  await no([{ ...a, i: LOST_INDEX_MAX }]);
  await no([{ ...a, i: -1 }]);
  await no([a, { ...c, i: a.i }]);
  await no([{ i: 0, item: { ...a.item, name: '' } }]);
  await no([{ i: 0, item: { ...a.item, provenance: 'p'.repeat(24) } }]);
  await no([{ i: 0, item: { ...a.item, name: 'Bigger', notes: 'x'.repeat(LOST_ITEM_BYTES) } }]);
  assert.deepEqual((await lost(svc, ann, { day, pieces: Array.from({ length: 9 }, (_, i) => ({ i, item: { ...a.item, notes: 'x'.repeat(3900) } })) })).body, { error: 'body' }, 'a send past LOST_BODY_MAX is never read');
  assert.ok(LOST_FINAL.includes('body'), 'and given to the pack');
  const big = Array.from({ length: 6 }, (_, i) => ({ i: 20 + i, item: { ...a.item, notes: 'x'.repeat(1000) } }));
  const bytes = Buffer.byteLength(JSON.stringify({ day, pieces: big }));
  assert.ok(bytes > 4096 && bytes < LOST_BODY_MAX, `${bytes}`);
  assert.equal((await lost(svc, ann, { day, pieces: big })).status, 200, 'a send past every other route\'s 4 KiB is read to its own bound');
  svc.env.DB._raw.prepare("DELETE FROM server_post WHERE to_id = ? AND batch LIKE 'lost-gate-20382-2_'").run(ann.id);
  await no(Array.from({ length: LOST_INDEX_MAX + 1 }, (_, i) => ({ i, item: a.item })));
  assert.deepEqual((await lost(svc, ann, { day: 'nowhere', pieces: [a] })).body, { error: 'lost-pieces' });
  // the item law: a forged piece is refused whole, the send with it
  assert.deepEqual((await lost(svc, ann, { day, pieces: [a, { i: 30, item: { ...c.item, templateIndex: 99999 } }] })).body, { error: 'lost-item' });
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM server_post WHERE to_id = ?').get(ann.id).n, 0, 'nothing of a refused send');
  // a uid is a checkpoint's stamp: dropped, so the post's piece is a new one to the ledger
  assert.equal((await lost(svc, ann, { day, pieces: [{ i: a.i, item: { ...a.item, uid: '0123456789abcdef' } }] })).status, 200);
  assert.equal('uid' in JSON.parse(svc.env.DB._raw.prepare('SELECT item FROM server_post WHERE to_id = ?').get(ann.id).item), false);
  // the account's waiting bound: past it, the floor goes to the pack
  const ins = svc.env.DB._raw.prepare('INSERT INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (let k = 1; k < LOST_WAITING_MAX; k++) ins.run(`w${String(k).padStart(23, '0')}`, ann.id, `lost-gate-1-${k}`.slice(0, 48), LOST_SENDER, 'x', 'y', JSON.stringify(a.item), nowS());
  assert.deepEqual((await lost(svc, ann, { day, pieces: [c] })).body, { error: 'lost-full' }, `${LOST_WAITING_MAX} waiting`);
  svc.env.DB._raw.prepare("UPDATE server_post SET claimed_at = 1 WHERE batch = 'lost-gate-1-1'").run();
  assert.equal((await lost(svc, ann, { day, pieces: [c] })).status, 200, 'one claimed, room for one');
  for (const w of ['lost-pieces', 'lost-item', 'lost-spent', 'lost-full']) assert.ok(LOST_FINAL.includes(w), `${w}: the client gives up and gives the pack`);
  assert.ok(!LOST_FINAL.includes('lost-no-kill'), 'a kill not yet recorded is asked again');
});

test('LOST-SPOILS A DOOR LEAVES ONLY WHAT IT DROPS: never a gun - the Sky-Ketch\'s alone - and no Gilded but its own (an Hour the Hourlock, a gate the Oath, a Redoubt none); every such piece refused whole, the send with it (AUDIT SHIP C1; mutants: a gun mailed under an Hour\'s kill; a Ketch Gilded under a gate\'s; any Gilded under any kill)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const day = 20383;
  assert.equal((await svc.claim(ann, day, nowS())).status, 200);
  sdKill(svc, ann, 12);
  const sdDay = sdSpoilsDay(12), plain = (x) => JSON.parse(JSON.stringify(x));
  for (const [d, item] of [[sdDay, createThunderlock()], [sdDay, createPistolet()], [sdDay, mintGilded(VOLENDRUNGS_ECHO)], [sdDay, mintGilded(DRAGONFIRE_OATH)], [day, mintGilded(KETCHMASTERS_WORD)], [day, mintHourlock()]]) {
    assert.deepEqual((await lost(svc, ann, { day: d, pieces: [{ i: 0, item: plain(item) }] })).body, { error: 'lost-item' }, `${item.name} under ${d}`);
  }
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM server_post WHERE to_id = ?').get(ann.id).n, 0);
  assert.equal((await lost(svc, ann, { day: sdDay, pieces: [{ i: 0, item: plain(mintHourlock()) }] })).status, 200, 'an Hour\'s own');
  assert.equal((await lost(svc, ann, { day, pieces: [{ i: 0, item: plain(mintGilded(DRAGONFIRE_OATH)) }] })).status, 200, 'a gate\'s own');
});

test('LOST-SPOILS THE CLAIM IS CHARGED TO THE BUDGET: a Lost and Found piece claimed into the realm record lands as any gift does, but the record\'s witnessed gain stays where it was - the floor\'s piece is the budget\'s, so the mailbox is no road past it - where a developers\' gift is witnessed (mutants: the lost piece witnessed; every gift unwitnessed)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const R = await seatRealm(svc.env, ann.secret, 'Ann', { name: 'Ann', level: 20, goldPieces: 50, items: [] });
  const day = 20383;
  assert.equal((await svc.claim(ann, day, nowS())).status, 200);
  const [piece] = leftovers(spoilsList(31337, 20)).filter((p) => (p.item.value ?? 0) > 0);
  assert.equal((await lost(svc, ann, { day, pieces: [piece] })).status, 200);
  const witnessed = () => svc.env.DB._raw.prepare('SELECT witnessed FROM realm_characters WHERE id = ?').get(R.id).witnessed;
  const id = (await box(svc, ann)).post[0].id;
  const before = witnessed();
  const r = await svc.call('/v1/post/claim', { id, character: R.id, realm: R.at() }, ann.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(recordOf(svc.env, R.id).items, [piece.item], 'in the record');
  assert.equal(witnessed(), before, 'never witnessed - charged as the floor\'s piece is');
  // the developers' gift, the same claim: witnessed, as every act of the service's own is
  svc.env.DB._raw.prepare('INSERT INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('g'.repeat(24), ann.id, 'a-gift', POST_SENDER, 'A gift', 'For you.', JSON.stringify(mintHourlock()), nowS());
  const w0 = witnessed();
  assert.equal((await svc.call('/v1/post/claim', { id: 'g'.repeat(24), character: R.id, realm: R.at() }, ann.secret)).status, 200);
  assert.ok(witnessed() > w0, 'a gift the service minted is witnessed');
});
