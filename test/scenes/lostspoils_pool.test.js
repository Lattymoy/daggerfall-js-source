// LOST-SPOILS (2026-10-22, the owner: "I want to utilize the mailbox as a way to obtain lost items/loot if not picked up
// from a boss"; asked, "Mail the leftovers"): THE POOL'S SIDE - scenes/spoilsPool.js. Leaving a boss's floor, each item
// still on it is owed to the mailbox in ONE write of the spew's crash record (its `pieces` the pack's part, the rest its
// `mail`), sent, asked again while the answer is not a yes, and given to the pack on a refusal that will never be one or
// after LOST_OWED_MAX_MS; the gold goes to the purse as ever. And a new burst over a floor not yet left gathers it first.
// Every floor here is the game's own roll (spoilsList, sdSpoilsList, egSpoilsList).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSpoilsPool, spoilsList, recoverSpoils, mailOf, SPOILS_STORE_KEY, SPOILS_TEXT, LOST_TEXT, LOST_RETRY_MS, LOST_RETRY_MAX_MS, LOST_FIRST_MS } from '../../src/scenes/spoilsPool.js';
import { LOST_OWED_MAX_MS, LOST_INDEX_MAX, LOST_ITEM_BYTES, LOST_BODY_MAX } from '../../src/net/lostLaw.js';
import { sdSpoilsList, sdSpoilsDay } from '../../src/systems/superDungeon/sdSpoils.js';
import { egSpoilsList, egSpoilsDay } from '../../src/systems/eliteGates/egSpoils.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WALL = 1_700_000_000_000;
const ray = (from, dir, len) => { if (dir[1] >= 0) return null; const t = from[1] / -dir[1]; return t <= len ? { dist: t, normal: [0, 1, 0] } : null; };
/** A JSON store over a Map (the pool's own shape). */
const mapStore = () => { const mem = new Map(); return { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k), mem }; };
const plain = (v) => JSON.parse(JSON.stringify(v));
const flush = () => new Promise((r) => setImmediate(r));

/** A pool with the Lost and Found's door: `answers` what the service says to each send, in turn (a function: its own). */
function harness({ store = mapStore(), who = 'char-1', me = 'acct-a', ready = true, answers = [], recordsMax, mail = true } = {}) {
  const pack = [], said = [], mailSaid = [], sends = [], timers = [];
  const clock = { t: 1000, wall: WALL };
  const st = { who, me, ready, landed: 0 };
  const door = mail ? {
    ready: () => st.ready,
    send: async (o) => { sends.push(plain(o)); const a = answers.shift() ?? 'ok'; return typeof a === 'function' ? a() : a; },
    sent: () => { st.landed++; },
    say: (t) => mailSaid.push(t),
  } : null;
  const p = createSpoilsPool({
    ray, now: () => clock.t, take: (x) => pack.push(x), say: (t) => said.push(t), store, who: () => st.who, me: () => st.me, wall: () => clock.wall,
    mail: door, later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, ...(recordsMax ? { recordsMax } : {}),
  });
  return { p, pack, said, mailSaid, sends, timers, store, clock, st };
}
/** The pieces fly and come to rest. */
const settle = (h) => { for (let k = 0; k < 400; k++) { h.clock.t += 50; h.p.frame(); } };
/** The timers due, fired, and their sends answered. */
const fire = async (h) => { const due = h.timers.splice(0); for (const x of due) x.fn(); await flush(); };
const burst = (h, day = 700, seed = 99, level = 8) => h.p.spew({ day, seed, level, at: [0, 3, 0], bearing: 0, acct: 'acct-a' });
/** The item pieces of a list, by their place, but those pressed. */
const itemsLeft = (list, pressed = []) => list.map((piece, i) => ({ i, piece })).filter(({ piece, i }) => piece.kind === 'item' && !pressed.includes(i));

test('LOST-SPOILS what is left on the floor goes to the mailbox: a pressed piece and the gold in the pack, every other item owed in the record\'s one write and sent, a piece by its place; landed, the record keeps the pack\'s part for its save and the box looks again; the words said (mutants: the gather into the pack; the record\'s pieces kept whole; the send never made; a landed send kept owed)', async () => {
  const h = harness();
  const list = spoilsList(99, 8);
  assert.equal(burst(h), true);
  settle(h);
  assert.equal(h.p.pick('spoil:0'), true, 'one pressed');
  assert.equal(h.p.gather(), list.length - 1, 'how many were left');
  const left = itemsLeft(list, [0]);
  assert.ok(left.length >= 3);
  assert.deepEqual(h.pack, [list[0], list.at(-1)], 'the pressed piece and the gold - never an item left on the floor');
  const [rec] = h.store.get(SPOILS_STORE_KEY);
  assert.deepEqual(rec.pieces, plain([list[0], list.at(-1)]), 'the record\'s pack part: what the pack holds');
  assert.deepEqual(rec.mail, plain(left), 'the rest owed to the mailbox, each by its place in the spoils');
  assert.deepEqual([rec.acct, rec.mailAt], ['acct-a', WALL]);
  await flush();
  assert.deepEqual(h.sends, [{ day: 700, pieces: plain(left.map(({ i, piece }) => ({ i, item: piece.item }))) }], 'one send, the record\'s day and its pieces');
  assert.equal(h.st.landed, 1, 'the box told to look');
  const [after] = h.store.get(SPOILS_STORE_KEY);
  assert.equal('mail' in after, false, 'nothing owed');
  assert.deepEqual(after.pieces, rec.pieces, 'and the pack\'s part waits for the save that holds it');
  assert.deepEqual(h.mailSaid, [LOST_TEXT.mailed()]);
  assert.ok(h.said.includes(SPOILS_TEXT.gathered), 'the gold gathered, said as ever');
  assert.equal(h.p.saved('char-1'), 1);
  assert.equal(h.store.get(SPOILS_STORE_KEY), null, 'saved: the record goes');
  assert.equal(await h.p.mailOwed(), 0);
  // every item pressed: nothing left, nothing sent
  const all = harness();
  burst(all, 701, 5, 3);
  settle(all);
  spoilsList(5, 3).forEach((p, i) => all.p.pick(`${p.kind === 'gold' ? 'spoilGold:' : 'spoil:'}${i}`));
  assert.equal(all.p.gather(), 0);
  await flush();
  assert.deepEqual([all.sends.length, all.mailSaid.length], [0, 0]);
});

test('LOST-SPOILS the mailbox will not take them: a refusal that will never be a yes gives them to the pack (the record first, then the pack, held for the save); a later asks again on the timer; past LOST_OWED_MAX_MS they go to the pack unasked; another character\'s wait for it, another account\'s are never sent on mine (mutants: a refusal kept owed; the retry never armed; the deadline dropped; given to the wrong character; sent on another\'s session)', async () => {
  const list = spoilsList(99, 8), left = itemsLeft(list);
  const h = harness({ answers: ['later', 'refused'] });
  burst(h); settle(h); h.p.gather();
  await flush();
  assert.deepEqual([h.sends.length, h.pack.map((p) => p.kind)], [1, ['gold']], 'asked once, the gold in the purse');
  assert.equal(mailOf(h.store.get(SPOILS_STORE_KEY)[0]).length, left.length, 'still owed');
  assert.deepEqual(h.timers.map((t) => t.ms), [LOST_FIRST_MS], 'asked again on the pool\'s timer (the first look\'s, already armed)');
  await fire(h);
  assert.equal(h.sends.length, 2);
  assert.deepEqual(h.pack.slice(1).map((p) => p.item.name), left.map(({ piece }) => piece.item.name), 'refused: into the pack');
  const [rec] = h.store.get(SPOILS_STORE_KEY);
  assert.equal('mail' in rec, false);
  assert.deepEqual(rec.pieces.length, list.length, 'the record holds them as the pack\'s now, for a crash');
  assert.deepEqual(h.mailSaid, [LOST_TEXT.mailed(), LOST_TEXT.back()]);
  assert.equal(h.p.saved('char-1'), 1, 'held: the next save clears it');
  assert.equal(h.store.get(SPOILS_STORE_KEY), null);

  // a later, then the retry armed for it - twice as long after each round that landed nothing, to the most
  const r = harness({ answers: ['later', 'later', 'ok'] });
  await fire(r);   // the first look's timer, with nothing owed yet: it asks nothing and arms nothing
  assert.deepEqual([r.sends.length, r.timers.length], [0, 0]);
  burst(r); settle(r); r.p.gather();
  await flush();
  assert.deepEqual(r.timers.map((t) => t.ms), [LOST_RETRY_MS]);
  await fire(r);
  assert.deepEqual([r.sends.length, r.timers.map((t) => t.ms)], [2, [LOST_RETRY_MS * 2]], 'asked again, and again later');
  await fire(r);
  assert.deepEqual([r.sends.length, r.timers.length, r.st.landed], [3, 0, 1], 'landed: no more asking');
  const slow = harness({ answers: Array.from({ length: 12 }, () => 'later') });
  await fire(slow);
  burst(slow); settle(slow); slow.p.gather();
  await flush();
  for (let k = 0; k < 10; k++) await fire(slow);
  assert.deepEqual(slow.timers.map((t) => t.ms), [LOST_RETRY_MAX_MS], 'never past the most');
  assert.ok(LOST_RETRY_MAX_MS <= 30 * 60_000 && 2 * LOST_OWED_MAX_MS / LOST_RETRY_MAX_MS < 1000, 'a kill never recorded is asked hundreds of times in its window, not tens of thousands');

  // past the deadline: to the pack, unasked
  const d = harness({ answers: ['later'] });
  burst(d); settle(d); d.p.gather();
  await flush();
  d.clock.wall += LOST_OWED_MAX_MS;
  await fire(d);
  assert.equal(d.sends.length, 1, 'never asked again');
  assert.equal(d.pack.length, 1 + left.length, 'given to the pack');

  // another character standing: its record waits for its own; another account's session sends nothing of it
  const c = harness({ answers: ['later', 'refused', 'refused'] });
  burst(c); settle(c); c.p.gather();
  await flush();
  c.st.who = 'char-2';
  await fire(c);
  assert.equal(c.pack.length, 1, 'refused, but its character is not the one standing: it waits');
  assert.equal(mailOf(c.store.get(SPOILS_STORE_KEY)[0]).length, left.length);
  c.st.who = 'char-1';
  await fire(c);
  assert.equal(c.pack.length, 1 + left.length, 'and goes to its own');
  const o = harness({ answers: ['later'] });
  burst(o); settle(o); o.p.gather();
  await flush();
  o.st.me = 'acct-b';
  await fire(o);
  assert.equal(o.sends.length, 1, 'never sent on another account\'s session');
  assert.equal(o.timers.length, 1, 'asked again later');
});

test('LOST-SPOILS a box not known to take post gathers into the pack as ever - a guest, signed out, not yet looked at; another account\'s spoils; no door at all; a record this device would not keep (mutants: mailed unready; mailed on another\'s account; mailed onto a record in memory alone)', async () => {
  const list = spoilsList(99, 8);
  const unheld = () => { const st = mapStore(); return { ...st, persisted: () => false }; };   // a store whose writes this device would not keep
  for (const v of [{ ready: false }, { me: 'acct-b' }, { mail: false }, { store: unheld() }]) {
    const h = harness(v);
    burst(h); settle(h);
    assert.equal(h.p.gather(), list.length);
    await flush();
    assert.deepEqual(h.pack, list, Object.keys(v).join());
    assert.equal('mail' in h.store.get(SPOILS_STORE_KEY)[0], false);
    assert.deepEqual([h.sends.length, h.mailSaid.length], [0, 0]);
    assert.deepEqual(h.said.at(-1), SPOILS_TEXT.gathered);
  }
});

test('LOST-SPOILS ONE WRITE: the device restarted with a send out hands the pack\'s part alone, and the next sitting sends what is owed; a save before it lands holds the pack\'s part and the record stays for the mail; the records\' cap never drops one still owing (mutants: two writes; a saved record dropped with its mail; the cap over a mail record)', async () => {
  const list = spoilsList(99, 8), left = itemsLeft(list, [0]);
  const store = mapStore();
  const h = harness({ store, answers: [() => new Promise(() => {})] });   // the tab dies with the send out
  burst(h); settle(h); h.p.pick('spoil:0'); h.p.gather();
  await flush();
  const handed = [];
  assert.equal(recoverSpoils(store, (x) => handed.push(x), { who: 'char-1' }), 2);
  assert.deepEqual(handed.map((p) => (p.kind === 'gold' ? 'gold' : p.item.name)), [list[0].item.name, 'gold'], 'the crash\'s door: the pack\'s part, never what the mailbox is owed');
  const next = harness({ store });
  assert.deepEqual(next.timers.map((t) => t.ms), [LOST_FIRST_MS], 'the next sitting asks of its own');
  await fire(next);
  assert.deepEqual(next.sends.map((s) => s.pieces.map((p) => p.i)), [left.map((x) => x.i)]);
  assert.equal(mailOf(store.get(SPOILS_STORE_KEY)[0]).length, 0, 'landed');

  const s = harness({ answers: ['later'] });
  burst(s); settle(s); s.p.pick('spoil:0'); s.p.gather();
  await flush();
  assert.equal(s.p.saved('char-1'), 1);
  const [kept] = s.store.get(SPOILS_STORE_KEY);
  assert.deepEqual([kept.pieces, mailOf(kept).length], [[], left.length], 'saved: the pack\'s part held, the mail still owed');
  const again = [];
  assert.equal(recoverSpoils(s.store, (x) => again.push(x), { who: 'char-1' }), 0, 'and nothing of it handed again');

  const cap = harness({ answers: ['later'], recordsMax: 2 });
  burst(cap); settle(cap); cap.p.gather();
  await flush();
  for (const day of [701, 702, 703]) cap.p.grant({ day, seed: day, level: 3, acct: 'acct-a' });
  const recs = cap.store.get(SPOILS_STORE_KEY);
  assert.deepEqual(recs.map((r) => r.day), [700, 702, 703], 'the oldest without mail went; the one still owing stayed, and took no crash record\'s place');
});

test('LOST-SPOILS A NEW BURST OVER A FLOOR NOT YET LEFT GATHERS IT FIRST - a breach\'s next Redoubt had thrown its spoils over the last one\'s, whose leftovers were on no floor and in no pack until the next boot handed back the whole of them, pressed pieces too; with a door, the old floor\'s items go to the mailbox (mutants: the old floor dropped under the new)', async () => {
  const one = spoilsList(99, 8), two = spoilsList(7, 8);
  const h = harness({ mail: false });
  burst(h, 700, 99); settle(h); h.p.pick('spoil:0');
  assert.equal(burst(h, 701, 7), true, 'the next burst');
  assert.deepEqual(h.pack, one, 'the first floor\'s every piece in the pack - the pressed one once');
  assert.equal(h.p.saved('char-1'), 1, 'and its record held, cleared by the save');
  const handed = [];
  recoverSpoils(h.store, (x) => handed.push(x), { who: 'char-1' });
  assert.equal(handed.length, two.length, 'the next boot hands the second floor\'s alone, never the first again');
  const m = harness();
  burst(m, 700, 99); settle(m); m.p.pick('spoil:0');
  burst(m, 701, 7);
  await flush();
  assert.deepEqual(m.sends.map((s) => [s.day, s.pieces.map((p) => p.i)]), [[700, itemsLeft(one, [0]).map((x) => x.i)]], 'the first floor\'s items to the mailbox');
});

test('LOST-SPOILS the sizes the law names hold the game\'s own spoils: the gate\'s (a portent night, the rite broken), the Brass Remnant\'s and a Valkynaz\'s Redoubt - every list under LOST_INDEX_MAX places, every item under LOST_ITEM_BYTES, every send under LOST_BODY_MAX (mutants: a bound under the spoils)', () => {
  let send = 0, item = 0, places = 0;
  const measure = (day, list) => {
    places = Math.max(places, list.length);
    const pieces = itemsLeft(list).map(({ i, piece }) => ({ i, item: piece.item }));
    send = Math.max(send, Buffer.byteLength(JSON.stringify({ day, pieces })));
    for (const p of pieces) item = Math.max(item, Buffer.byteLength(JSON.stringify(p.item)));
  };
  for (let s = 1; s <= 60; s++) {
    for (const lv of [1, 30, 60]) {
      measure(20380, spoilsList(s * 7919, lv, { p: 3, r: 1 }));
      measure(sdSpoilsDay(123456789), sdSpoilsList(s * 104729, lv));
      measure(egSpoilsDay('f'.repeat(16), 10), egSpoilsList(s * 1299709, lv, 10, { lord: 'x', pity: [1, 1], goldOnly: false, embers: 3 }));
    }
  }
  assert.ok(places < LOST_INDEX_MAX, `${places} places`);
  assert.ok(item < LOST_ITEM_BYTES, `${item} bytes an item`);
  assert.ok(send > 4096 && send < LOST_BODY_MAX, `${send} bytes a send - past the service's 4 KiB, under the route's own`);
});

test('LOST-SPOILS the seams by source: the world host builds the door over its post box, its lines in the chat, and hands it to the court\'s pool and the Hour\'s (the Brass Remnant\'s and the breach\'s Redoubts) - the raids\', the serpent\'s and the stars\' have no floor; the service reads the route to its own bound; a claimed piece goes into the pack by a spoil\'s own door (the ember\'s book) (mutants: a pool left without the door; the bound dropped)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const lostMail = lostSpoilsMail\(\{ box: \(\) => postBox, say: \(text\) => chatNotice\(text\) \}\);/);
  assert.match(w, /const spoilsPool = createSpoilsPool\(\{\n {4}renderer, gl: renderer\.gl, getTexture, uploadRecordFrame, audio, mail: lostMail,/);
  assert.match(w, /const sdSpoilsPool = createSpoilsPool\(\{\n {4}renderer, gl: renderer\.gl, getTexture, uploadRecordFrame, audio, mail: lostMail,/);
  assert.equal((w.match(/mail: lostMail/g) ?? []).length, 2, 'the two pools with a floor');
  assert.match(w, /pack: \{ add: \(rec\) => \{ playerEntity\.items \?\?= \[\]; takeGateSpoil\(\{ kind: 'item', item: setItemFields\(rec\) \}\); \}/);
  assert.match(src('server-account/src/index.js'), /path === '\/v1\/post\/lost' \? LOST_BODY_MAX : MAX_BODY_BYTES/);
});
