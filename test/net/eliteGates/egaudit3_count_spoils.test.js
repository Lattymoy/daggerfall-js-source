// AUDIT EG III (2026-10-13, the Elite Gates arc's third audit; bible/11-Multiplayer/Elite-Gates.md sections 16.3, 19 and
// 27.6) - THE RELIQUARIES OPEN TO SOMETHING (lane 2's finding 1): an end's Reliquaries rolled off its receipt's seed at their
// Redoubts' depths with twice the Panoply chance (systems/eliteGates/egSpoils.js egReliquaryList, egReliquaryGrant) and given through
// the pool a Redoubt's spoils use (scenes/world.js egSpoilsPaid); the client's claim hands the service's `rl` to it and the
// recap's count to it, and tells the room of a Redoubt the service paid already this week (scenes/eliteGates/egClient.js flush,
// `wkpaid`); the recap counts THE SEAL's and a void's; the rest card shows the stake (ui/eliteGates/egHud.js egStakeText). Every
// fixture is the producers' own - the end receipt the director's (net/eliteGates/egBrain.js egEnd), minted and read as the relay and
// the client do (net/eliteGates/egReceipt.js), the service's answer from its own law over its own schema (server-account/src/
// egEconomy.js egReliquariesOf on test/accountDb.mjs's migrated database), the client headless (createEgClient).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egBreachNew, egEnter, egEnd, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { mintEgReceipt, readEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egPanoplyIn, egPanoplyDraw, egPanoplyHit, egPassSeed, EG_PANOPLY_IDS } from '../../../src/net/eliteGates/egPay.js';
import { arenaWeekOf } from '../../../src/net/arena/arenaLaw.js';
import { egReliquaryList, egReliquaryGrant, egReliquaryPanoply, egReliquarySeed, egReliquaryDay, egSpoilsGold, egSpoilsList, EG_RELIQUARY_PANOPLY_X, EG_RELIQUARIES_MAX, EG_SPOILS_TEXT } from '../../../src/systems/eliteGates/egSpoils.js';
import { egStakeText, egHudModel, egRecapModel, drawEgPanel, destroyEgHud } from '../../../src/ui/eliteGates/egHud.js';
import { EG_STATE_EMPTY, foldEg } from '../../../src/net/eliteGates/egLink.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egReliquariesOf } from '../../../server-account/src/egEconomy.js';
import { d1 } from '../../accountDb.mjs';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const ME = 'acct-0';
const CB = '0123456789abcdef';
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const wire = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };
const tick = () => new Promise((r) => setImmediate(r));
const isPanoply = (e) => e.kind === 'item' && EG_PANOPLY_IDS.includes(e.item?.aetheric);

/** A breach of two on seed 77 at hall `h`'s `sg`, both admitted - the director's own record. */
function breachAt(h = 12, sg = 'trial') {
  const clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: CB, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 }; B.rd = Math.floor((h - 1) / 5);
  return { B, clock };
}
/** The service's answer to an end's claim, by its own law over its own schema: `paid` the Redoubts of this breach recorded for
 *  the member (`w` -> paid), `week` the Redoubts it was paid this arena week in another breach. */
async function serviceRl(c, nowS, { here = {}, week = [] } = {}) {
  const db = d1();
  db._raw.exec('PRAGMA foreign_keys = OFF');
  const wk = arenaWeekOf(nowS);
  for (const [w, paid] of Object.entries(here)) db._raw.prepare('INSERT INTO eg_redoubts (b, account, w, h, t, at, wk, paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(c.b, c.s, Number(w), Number(w) * 5, 60, nowS, wk, paid ? 1 : 0);
  for (const w of week) db._raw.prepare('INSERT INTO eg_redoubts (b, account, w, h, t, at, wk, paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('fedcba9876543210', c.s, w, w * 5, 60, nowS, wk, 1);
  return egReliquariesOf({ db, nowS }, { id: c.s }, c);
}

test('AUDIT EG III #1 A RELIQUARY\'S ROLL (section 16.3: "one more spoils roll at that Redoubt\'s depth, at twice the Panoply chance"): each circle an end opens one pass at its own depth - its gold the depth\'s, the seed\'s fifth either way - on its own seed off the end receipt\'s (never a Redoubt pass\'s); its Panoply piece exactly when its own stream says so at EG_RELIQUARY_PANOPLY_X (2) times its Redoubt\'s odds - about 1 in 6 at Redoubt 1 where the Redoubt is 1 in 12, a draw between the two a Reliquary\'s alone; the same seed and circles the same spoils (mutants: the chance not doubled; one seed for every Reliquary; the depth unread; a pass\'s Panoply off another stream)', () => {
  assert.equal(EG_RELIQUARY_PANOPLY_X, 2);
  const lv = 30;
  const a = egReliquaryList(4242, lv, [1, 5, 9]);
  assert.equal(JSON.stringify(a), JSON.stringify(egReliquaryList(4242, lv, [1, 5, 9])), 'the same seed, the same spoils');
  const golds = a.filter((e) => e.kind === 'gold').map((e) => e.gold);
  assert.equal(golds.length, 3, 'one pass a Reliquary');
  [1, 5, 9].forEach((w, i) => { const g = egSpoilsGold(lv, w); assert.ok(golds[i] >= Math.round(0.8 * g) && golds[i] <= Math.round(1.2 * g), `circle ${w}'s gold at its depth (${golds[i]} of ${g})`); });
  assert.notDeepEqual(egReliquaryList(4242, lv, [1, 1]).filter((e) => e.kind === 'gold').map((e) => e.gold).reduce((p, g, i, all) => p && g === all[0], true), true, 'two Reliquaries of one circle roll apart');
  for (let i = 0; i < 4; i++) for (const p of [0, 1]) assert.notEqual(egReliquarySeed(4242, i), egPassSeed(4242, p), 'never a Redoubt pass\'s seed');
  // the Panoply: exactly the stream's word, at twice the Redoubt's odds
  let hits = 0, between = null;
  const N = 6000;
  for (let s = 1; s <= N; s++) {
    const hit = egReliquaryPanoply(s, 1, 0);
    assert.equal(hit, egPanoplyDraw(s, 16) * egPanoplyIn(1) < 2);
    if (hit) hits++;
    if (!between && hit && !egPanoplyHit(s, 1, 0) && egPanoplyDraw(s, 16) * egPanoplyIn(1) >= 1) between = s;
  }
  assert.ok(Math.abs(hits / N - 2 / egPanoplyIn(1)) < 0.015, `about 1 in 6 at Redoubt 1 (${hits} of ${N})`);
  assert.ok(between, 'a draw past the Redoubt\'s odds and inside the Reliquary\'s');
  const withPiece = (s, w) => egReliquaryList(s, lv, [w]).some(isPanoply);
  let checked = 0;
  for (let s = 1; s <= 400; s++) { assert.equal(withPiece(s, 3), egReliquaryPanoply(s, 3, 0), `seed ${s}: a piece exactly when the stream says`); checked++; }
  assert.equal(checked, 400);
  assert.equal(egReliquaryList(4242, lv, []).length, 0);
  assert.equal(EG_RELIQUARIES_MAX, 64, 'the end receipt\'s own trim (net/eliteGates/egBrain.js oweEnd)');
  assert.equal(egReliquaryList(4242, lv, Array(70).fill(1)).filter((e) => e.kind === 'gold').length, 64, 'sixty-four at most');
});

test('AUDIT EG III #1 WHAT AN END\'S CLAIM OPENS (scenes/world.js egSpoilsPaid through systems/eliteGates/egSpoils.js egReliquaryGrant): the director\'s end receipt names its circles (`rl`), the service opens those that pay this week by its own law - a circle whose Redoubt this breach recorded unpaid opens none, one never recorded opens unless paid elsewhere this week - and the grant rolls exactly those, once an end (`eg:<b>:rl`), said; a Redoubt\'s receipt, an end opening none or a seedless one grants nothing; the host gives it through the pool a Redoubt\'s spoils use (mutants: the service\'s answer unread; the end\'s seed unread; the day shared with a Redoubt\'s)', async () => {
  const { B, clock } = breachAt(17);
  B.mem[ME].rel = [1, 2, 3, 3];
  egEnd(B, 'seal', clock, []);
  const claims = B.owe.find((o) => o.sub === ME && o.claims.q === 'x').claims;
  assert.deepEqual(claims.rl, [1, 2, 3, 3], 'THE SEAL names them');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(clock / 1000);
  const c = readEgReceipt(await mintEgReceipt({ ...claims, c: 0x51ed }, kp.privateKey, { subtle, nowS }));
  const d = await serviceRl(c, nowS, { here: { 1: true, 2: false }, week: [3] });
  assert.deepEqual(d, { rl: [1] }, 'circle 2 recorded unpaid, circle 3 paid this week elsewhere');
  const d2 = await serviceRl(c, nowS, { here: { 1: true, 2: false } });
  assert.deepEqual(d2, { rl: [1, 3, 3] });
  const g = egReliquaryGrant(c, d2, 30);
  assert.deepEqual([g.day, g.n, g.text], [egReliquaryDay(CB), 3, EG_SPOILS_TEXT.opened(3)]);
  assert.equal(g.day, `eg:${CB}:rl`);
  assert.equal(JSON.stringify(g.roll()), JSON.stringify(egReliquaryList(0x51ed, 30, [1, 3, 3])), 'the end\'s seed, the circles the service opened');
  assert.notEqual(g.day, `eg:${CB}:1`, 'never a Redoubt\'s day');
  assert.equal(egReliquaryGrant(c, { rl: [] }, 30), null, 'none opening');
  assert.equal(egReliquaryGrant({ ...c, q: 'w', w: 1 }, d2, 30), null, 'a Redoubt\'s receipt');
  assert.equal(egReliquaryGrant({ ...c, c: undefined }, d2, 30), null, 'no seed');
  assert.equal(EG_SPOILS_TEXT.opened(1), 'Your Reliquary opens: its spoils are in your pack.');
  assert.notDeepEqual(egReliquaryList(0x51ed, 30, [1]), egSpoilsList(0x51ed, 30, 1), 'a Reliquary is not the Redoubt\'s own roll');
  const host = rd('src/scenes/world.js');
  const fn = host.slice(host.indexOf('function egSpoilsPaid(c, d) {'), host.indexOf('function egSpoilsPaid(c, d) {') + 900);
  assert.match(fn, /if \(c\?\.q === 'x'\) \{\s*const g = egReliquaryGrant\(c, d, spoilsLevel\(playerEntity\.level \?\? 1, c\.l\)\);\s*if \(g\) spoilsLock\(\(\) => sdSpoilsPool\.grant\(\{ day: g\.day, acct: c\.s, roll: g\.roll, text: g\.text \}\)\)/, 'the host grants it through the pool, at the level the breach admitted');
});

/** A client inside the breach `B` (test/net/eliteGates/egz_recap.test.js's harness), its account's claim answered by `answer(claims)`. */
function inside(B, clock, answer) {
  const sent = [], paid = [], claims = [];
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => Math.ceil(B.h / 5), egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  const mem = new Map();
  const account = { me: () => ME, guest: () => false, keys: async () => ({ ok: false, error: 'offline' }), claim: async (r) => { const c = readEgReceipt(r); claims.push(c); return { ok: true, data: await answer(c) }; } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) }, paid: (c, d) => paid.push([c, d]) });
  const tell = (w) => { const v = wire(w); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(B, clock));
  const spec = egHallOf(B.seed, B.h, 0);
  if (spec.arrive) player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, sent, paid, claims, tell };
}
function fakeDocument() {
  const node = (tag) => {
    const n = { tagName: tag, children: [], parent: null, attrs: {}, id: '', _text: '', className: '', style: {} };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); } });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = () => {};
    n.querySelectorAll = (sel) => { const m = /^\[([a-z-]+)\]$/.exec(sel); const out = []; const walk = (x) => { for (const c of x.children) { if (m && c.attrs[m[1]] != null) out.push(c); walk(c); } }; walk(n); return out; };
    return n;
  };
  const doc = { createElement: node, head: node('head'), body: node('body'), getElementById: () => null };
  return doc;
}

test('AUDIT EG III #1 THE CLIENT\'S CLAIM OPENS THEM (scenes/eliteGates/egClient.js flush): my end\'s claim answered with the Reliquaries the service opens hands them to the host\'s pool (`paid`, the end\'s claims and the answer whole) and the recap\'s count becomes the service\'s - the room counted three, the service opens two; an end opening none hands nothing (mutants: the end\'s answer unread; the recap\'s count the room\'s)', async (t) => {
  let wall = 5_000_000;
  t.mock.method(Date, 'now', () => wall);
  const doc = fakeDocument(), had = globalThis.document;
  globalThis.document = doc;
  try {
    const { B, clock } = breachAt(17);
    B.mem[ME].rel = [1, 2, 3];
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const nowS = Math.floor(clock / 1000);
    const P = inside(B, clock, (c) => serviceRl(c, nowS, { here: { 1: true, 2: false, 3: true } }).then((d) => ({ recorded: true, q: 'x', b: CB, keys: 0, ...d })));
    P.client.frame();
    const out = [];
    egEnd(B, 'void', clock, out);   // a void after the first wake (a force deploy's): a good end the recap once counted none of
    for (const f of out) P.tell(f);
    P.tell(egStateOf(B, clock));
    P.client.frame();   // the recap stands, the room's three
    const relText = () => doc.body.children.flatMap((n) => n.querySelectorAll('[data-rel]')).map((n) => n.textContent).join('|');
    for (let i = 0; i < 12; i++) { wall += 450; P.client.frame(); }
    assert.equal(relText(), 'Reliquaries opened: 3', 'a void opens them: the room\'s count first');
    const claims = B.owe.find((o) => o.sub === ME && o.claims.q === 'x').claims;
    P.client.word({ k: 'rcpt', r: await mintEgReceipt({ ...claims, c: 77 }, kp.privateKey, { subtle, nowS }) });
    for (let i = 0; i < 8; i++) await tick();
    assert.equal(P.paid.length, 1, 'handed to the host');
    const [c, d] = P.paid[0];
    assert.deepEqual([c.q, c.why, c.c, c.rl, d.rl], ['x', 'void', 77, [1, 2, 3], [1, 3]]);
    assert.equal(egReliquaryGrant(c, d, 30).n, 2, 'the host\'s grant rolls the two');
    wall += 450; P.client.frame();
    assert.equal(relText(), 'Reliquaries opened: 2', 'the recap\'s count the service\'s');
    // an end that opens none hands nothing
    const { B: B2, clock: c2 } = breachAt(17);
    B2.mem[ME].rel = [2];
    const Q = inside(B2, c2, () => ({ recorded: true, q: 'x', b: CB, keys: 0, rl: [] }));
    const o2 = [];
    egEnd(B2, 'last', c2, o2);
    for (const f of o2) Q.tell(f);
    Q.client.word({ k: 'rcpt', r: await mintEgReceipt({ ...B2.owe.find((o) => o.sub === ME && o.claims.q === 'x').claims, c: 5 }, kp.privateKey, { subtle, nowS }) });
    for (let i = 0; i < 8; i++) await tick();
    assert.deepEqual([Q.claims.length, Q.paid.length], [1, 0], 'claimed; nothing handed');
  } finally { globalThis.document = had; destroyEgHud(); }
});

test('AUDIT EG III #1 THE CLIENT TELLS THE ROOM OF A REDOUBT PAID ALREADY THIS WEEK (scenes/eliteGates/egClient.js flush, section 16.3): my Redoubt\'s receipt answered `paid: false` (its gold alone - recorded, or carried again) says `wkpaid` to the breach\'s room while I stand in it; a paid one, a breach of another, or one that has ended says nothing (mutants: the word never said; said for a paid Redoubt; said into an ended breach)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const run = async ({ paid = false, again = false, b = CB, ended = false } = {}) => {
    const { B, clock } = breachAt(6, 'rest');
    B.rd = 1;
    if (ended) egEnd(B, 'tear', clock, []);
    const P = inside(B, clock, (c) => ({ ...(again ? { recorded: false, why: 'claimed', again: true } : { recorded: true }), q: 'w', b: c.b, w: c.w, paid, keys: 0, pity: [] }));
    const nowS = Math.floor(clock / 1000);
    P.client.word({ k: 'rcpt', r: await mintEgReceipt({ q: 'w', b, s: ME, z: 'z'.repeat(16), c: 3, w: 1, h: 5, t: 300, n: 2, ew: 0, l: 30 }, kp.privateKey, { subtle, nowS }) });
    for (let i = 0; i < 8; i++) await tick();
    assert.equal(P.claims.length, 1, 'claimed');
    return P.sent.filter((w) => w.k === 'wkpaid');
  };
  assert.deepEqual(await run(), [{ k: 'wkpaid', w: 1 }], 'its gold alone: the room told');
  assert.deepEqual(await run({ again: true }), [{ k: 'wkpaid', w: 1 }], 'carried again: told again (the room answers it once)');
  assert.deepEqual(await run({ paid: true }), [], 'a paid Redoubt: nothing');
  assert.deepEqual(await run({ b: 'ffffffffffffffff' }), [], 'another breach\'s: nothing');
  assert.deepEqual(await run({ ended: true }), [], 'an ended breach: nothing');
});

test('AUDIT EG III #1 THE RECAP AND THE STAKE (sections 16.3 and 27.6): the recap counts the Reliquaries THE SEAL and a void open, as the way home and the last word do, and none at a tear; the rest card shows the stake - how many, how many of a Valkynaz\'s Redoubt, and about 1 in how many hold a Panoply piece at twice each Redoubt\'s odds (*likely* past two in three); none, no line (mutants: THE SEAL or a void left out; the odds not doubled; the Valkynaz uncounted)', () => {
  const E0 = { ...EG_STATE_EMPTY, b: CB, h: 17, rd: 3, seed: 77, wk: T0, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]], ms: [[ME, 3, 0, 0, 0, [], [], -1, [1, 2, 3]]] };
  for (const [why, n] of [['home', 3], ['seal', 3], ['last', 3], ['void', 3], ['tear', 0], ['wipe', 0]]) assert.equal(egRecapModel(E0, ME, [], T0 + 60_000, { why }).opened, n, why);
  assert.equal(egStakeText([1]), '1 Reliquary - a Panoply piece about 1 in 6', 'twice Redoubt 1\'s 1 in 12');
  assert.equal(egStakeText([1, 2, 3, 4]), '4 Reliquaries - a Panoply piece about 1 in 2');
  assert.equal(egStakeText([2, 3, 4, 5]), '4 Reliquaries - 1 Valkynaz - a Panoply piece likely');
  assert.equal(egStakeText([16]), '1 Reliquary - a Panoply piece about 1 in 2', 'twice Redoubt 16\'s 1 in 4');
  assert.equal(egStakeText([]), '');
  // on the HUD at the rest, from the room's own state
  const { B, clock } = breachAt(15, 'rest');
  B.rd = 3; B.mem[ME].rel = [1, 2, 3]; B.su = clock + 60_000;
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, clock)), clock);
  const hud = egHudModel(E, ME, clock, { inSpire: true });
  assert.ok(hud.sub.startsWith(`${egStakeText([1, 2, 3])}. `), `the stake on the rest's line (${hud.sub})`);
  B.sg = 'trial';
  assert.ok(!egHudModel(foldEg(EG_STATE_EMPTY, wire(egStateOf(B, clock)), clock), ME, clock, { inSpire: true }).sub.includes('Reliquar'), 'a trial shows no stake');
  void drawEgPanel;
});
