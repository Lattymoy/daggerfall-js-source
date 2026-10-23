// LOST-SPOILS (2026-10-22, the owner: "I want to utilize the mailbox as a way to obtain lost items/loot if not picked up
// from a boss"; asked, "Mail the leftovers"): THE CLIENT'S SIDE - net/lostSpoils.js (the pools' door, its one route and
// what an answer means), the post box's Claim all (net/serverPost.js), the window's (ui/enhanced/enhancedPost.js), and the
// whole road over the real service: a gate's kill recorded, its floor left, each item in the mailbox from the Lost and
// Found, the envelope lit, and every one claimed into the realm character being played.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { seatRealm, recordOf } from '../realmSeat.mjs';
import { lostSpoilsMail, lostAnswerOf, lostCall } from '../../src/net/lostSpoils.js';
import { LOST_FINAL } from '../../src/net/lostLaw.js';
import { LOST_SENDER, LOST_WORDS } from '../../server-account/src/lostSpoils.js';
import { PostBox } from '../../src/net/serverPost.js';
import { createSpoilsPool, spoilsList } from '../../src/scenes/spoilsPool.js';
import { postWindow, postRefusalText } from '../../src/ui/enhanced/enhancedPost.js';
import { t } from '../../src/systems/textManager.js';

const ray = (from, dir, len) => { if (dir[1] >= 0) return null; const k = from[1] / -dir[1]; return k <= len ? { dist: k, normal: [0, 1, 0] } : null; };
const mapStore = () => { const mem = new Map(); return { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k) }; };
const ioFor = (svc, who) => () => (who ? { fetch: (u, i) => svc.fetch(u, i), base: 'https://accounts.invalid', secret: who.secret, storage: null } : null);
const realmOf = (R) => ({ act: async ({ call, apply }) => { const r = await call(R.at()); if (r?.ok) apply?.(r); return r; }, abandon() {} });
/** Waits, on the clock, for what an answer from the real service brings - never a count of turns (a loaded machine
 *  answers slowly). */
const until = async (ok, ms = 20_000) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return ok(); };

test('LOST-SPOILS the door: an answer is a yes, a refusal that will never be one, or later - a service from before LOST-SPOILS among the refusals; a box not ready takes nothing; a send goes on the box\'s own session to the one route and the box looks again when one lands (mutants: a final refusal asked forever; a send with no session)', async () => {
  assert.equal(lostAnswerOf({ ok: true, data: {} }), 'ok');
  for (const w of LOST_FINAL) assert.equal(lostAnswerOf({ ok: false, error: w }), 'refused', w);
  for (const w of ['offline', 'server', 'rate', 'auth', 'lost-no-kill', undefined]) assert.equal(lostAnswerOf({ ok: false, error: w }), 'later', String(w));
  assert.ok(LOST_FINAL.includes('not-found') && LOST_FINAL.includes('method'), 'a service from before the route: the pack');
  const calls = [];
  let looked = 0;
  const box = { state: 'guest', ioOf: () => null, refresh: async () => { looked++; } };
  const door = lostSpoilsMail({ box: () => box });
  assert.equal(door.ready(), false, 'a guest\'s box takes no post');
  assert.equal(await door.send({ day: 1, pieces: [] }), 'later', 'no session: later');
  box.state = 'ready';
  box.ioOf = () => ({ secret: 's3cret', base: 'https://accounts.invalid', fetch: async (u, i) => { calls.push([u, i.method, JSON.parse(i.body), i.headers.authorization]); return new Response(JSON.stringify({ ok: true, sent: 1, kept: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  assert.equal(door.ready(), true);
  assert.equal(await door.send({ day: 700, pieces: [{ i: 1, item: { name: 'x' } }] }), 'ok');
  assert.deepEqual(calls, [['https://accounts.invalid/v1/post/lost', 'POST', { day: 700, pieces: [{ i: 1, item: { name: 'x' } }] }, 'Bearer s3cret']]);
  door.sent();
  assert.equal(looked, 1, 'the box looks again');
  assert.equal(typeof lostCall, 'function');
});

test('LOST-SPOILS THE WHOLE ROAD over the real service: a gate\'s receipt claimed, its floor left with all but one piece on it - each item in the mailbox from the Lost and Found, the gold in the purse, the envelope counting them - and Claim all puts every one into the realm record and the pack (mutants: the kill unrecorded; the box never told; a piece claimed twice)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const R = await seatRealm(svc.env, ann.secret, 'Ann', { name: 'Ann', level: 20, goldPieces: 50, items: [] });
  const day = 20390;
  assert.equal((await svc.claim(ann, day, Math.floor(Date.now() / 1000))).status, 200, 'the kill recorded');
  const pack = [], packed = [], said = [];
  const box = new PostBox({ ioOf: ioFor(svc, ann), character: () => R.id, realm: realmOf(R), pack: { add: (rec) => packed.push(rec), changed() {} } });
  await box.refresh();
  assert.equal(box.state, 'ready');
  const pool = createSpoilsPool({ ray, now: () => clock, take: (x) => pack.push(x), say: () => {}, store: mapStore(), who: () => R.id, me: () => ann.id, wall: () => Date.now(),
    mail: lostSpoilsMail({ box: () => box, say: (x) => said.push(x) }), later: () => 0 });
  let clock = 1000;
  const list = spoilsList(4242, 20);
  assert.equal(pool.spew({ day, seed: 4242, level: 20, at: [0, 3, 0], bearing: 0, acct: ann.id }), true);
  for (let k = 0; k < 400; k++) { clock += 50; pool.frame(); }
  assert.equal(pool.pick('spoil:0'), true);
  pool.gather();
  const left = list.map((p, i) => ({ p, i })).filter(({ p, i }) => p.kind === 'item' && i !== 0);
  assert.ok(await until(() => box.post.length === left.length), 'the box looked again and holds them');
  assert.deepEqual(pack.map((p) => p.kind), ['item', 'gold'], 'the pressed piece and the gold - nothing else');
  assert.ok(box.post.every((p) => p.from === LOST_SENDER && p.subject === LOST_WORDS.gate.subject && p.item && !p.claimed));
  assert.equal(box.waiting, left.length, 'the envelope counts each');
  const r = await box.claimAll();
  assert.deepEqual([r.ok, r.items.length], [true, left.length]);
  assert.deepEqual(packed.map((x) => x.name).sort(), left.map(({ p }) => p.item.name).sort(), 'every one into the pack');
  assert.deepEqual(recordOf(svc.env, R.id).items.map((x) => x.name).sort(), left.map(({ p }) => p.item.name).sort(), 'and into the realm record');
  assert.equal(box.unclaimed, 0);
  assert.deepEqual(await box.claimAll(), { ok: true, items: [] }, 'nothing left: nothing twice');
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM server_post WHERE to_id = ? AND claimed_at IS NOT NULL').get(ann.id).n, left.length);
});

test('LOST-SPOILS Claim all: one claim after another, each the box\'s own; a piece claimed meanwhile passed over; stopped at the first refusal the next would meet too, saying what landed; never two at once (mutants: the loop never stops; a second Claim all beside the first)', async () => {
  const order = [];
  const box = new PostBox({ ioOf: () => null });
  box.post = [{ id: 'a', item: { name: 'A' }, claimed: false }, { id: 'b', item: { name: 'B' }, claimed: false }, { id: 'c', item: { name: 'C' }, claimed: false }, { id: 'd', item: null, claimed: false }];
  const answers = { a: { ok: true, item: { name: 'A' } }, b: { ok: false, error: 'post-claimed' }, c: { ok: true, item: { name: 'C' } } };
  box.claim = async (id) => { order.push(id); assert.equal(box.claimingAll, true); return answers[id]; };
  const first = box.claimAll();
  assert.deepEqual(await box.claimAll(), { ok: false, error: 'busy', items: [] }, 'never two at once');
  assert.deepEqual(await first, { ok: true, items: [{ name: 'A' }, { name: 'C' }] });
  assert.deepEqual(order, ['a', 'b', 'c'], 'each with an item, in the box\'s order');
  assert.equal(box.claimingAll, false);
  answers.a = { ok: false, error: 'realm-only' };
  order.length = 0;
  assert.deepEqual(await box.claimAll(), { ok: false, error: 'realm-only', items: [] });
  assert.deepEqual(order, ['a'], 'a refusal the next would meet too stops it');
});

// ── the window ────────────────────────────────────────────────────────

function fakeDoc() {
  const node = (tag) => {
    const n = { tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', disabled: false, isConnected: true,
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k] ?? null; },
      addEventListener(e, f) { (n.listeners[e] ??= []).push(f); }, contains: () => false,
      querySelector() { return null; },
      classList: { toggle(c, on) { const cs = new Set(String(n.className).split(' ').filter(Boolean)); if (on) cs.add(c); else cs.delete(c); n.className = [...cs].join(' '); } } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  return { createElement: node, activeElement: null };
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };

test('LOST-SPOILS the window\'s Claim all: above the list while two or more items wait, its count said; down while a claim or a Claim all runs; pressed, every one claimed and what landed said - or where it stopped (mutants: shown for one; never down; the count unsaid)', async () => {
  const post = [
    { id: 'p1'.padEnd(24, '0'), from: LOST_SENDER, subject: LOST_WORDS.gate.subject, sentAt: 1_800_000_000, read: false, item: { name: 'Ebony Katana', rarity: 'rare' }, claimed: false },
    { id: 'p2'.padEnd(24, '0'), from: LOST_SENDER, subject: LOST_WORDS.gate.subject, sentAt: 1_800_000_000, read: false, item: { name: 'Ring', rarity: 'magic' }, claimed: false },
    { id: 'p3'.padEnd(24, '0'), from: 'The Developers', subject: 'Welcome', sentAt: 1_800_000_000, read: true, item: null, claimed: false },
  ];
  const box = { state: 'ready', post, version: 1, busy: false, claimingAll: false, refresh: async () => {},
    claimAll: async () => { for (const p of post) if (p.item) p.claimed = true; box.version++; return { ok: true, items: [{ name: 'Ebony Katana' }, { name: 'Ring' }] }; } };
  const view = postWindow(fakeDoc(), { box: () => box, onClose() {}, every: 1e9 });
  view.stop();
  const [btn] = all(view.root, 'pm-claimall');
  assert.ok(btn, 'two waiting: Claim all');
  assert.equal(btn.textContent, t('post.claimAll', 'Claim all ({n})', { n: 2 }));
  assert.equal(btn.textContent, 'Claim all (2)');
  assert.equal(btn.disabled, false);
  await btn.listeners.click[0]();
  await new Promise((r) => setImmediate(r));
  assert.equal(all(view.root, 'pm-say')[0].textContent, '2 items are in your pack.');
  assert.equal(all(view.root, 'pm-claimall').length, 0, 'none waiting: no Claim all');
  // one waiting: no Claim all; busy: down; a stop said with what landed
  post[0].claimed = false; box.version++;
  view.draw(true);
  assert.equal(all(view.root, 'pm-claimall').length, 0, 'one alone is claimed by its own Claim');
  post[1].claimed = false; box.busy = true; box.version++;
  view.draw(true);
  assert.equal(all(view.root, 'pm-claimall')[0].disabled, true, 'down while a claim runs');
  box.busy = false; box.claimAll = async () => ({ ok: false, error: 'realm-only', items: [{ name: 'Ebony Katana' }] });
  box.version++;
  view.draw(true);
  await all(view.root, 'pm-claimall')[0].listeners.click[0]();
  assert.equal(all(view.root, 'pm-say')[0].textContent, `1 item is in your pack. ${postRefusalText('realm-only')}`);
});
