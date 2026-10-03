// WB9g (2026-09-30, Mac: "Add a brand new title to the broker and a new addition (the aura), an animated burning ground
// aura that circles the ground where your character stands. These items should be expensive and sought after"): THE
// BROKER'S INSIGNIA - the Gatebreaker title and Dagon's Fire, bought with Deadlands Embers and kept by the ACCOUNT (the
// sale recorded on the row, the account's closed gates paying), signed into the token and read off it by the relay;
// the fire drawn at the feet of whoever wears it (render/auraRing.js), its shader RUN here rather than its text pinned.
// Design: bible/11-Multiplayer/World-Bosses.md section 14 (WB9g).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { INSIGNIA, INSIGNIA_COLUMN_MAX, insigniaById, insigniaVocabularyOk, insigniaHeld, insigniaWith, insigniaKeys, insigniaRefusal } from '../src/net/insignia.js';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken } from '../src/net/identityToken.js';
import { badged, readAura } from '../src/net/wire.js';
import { BROKER_PRICES, spendStones, spendableStonesIn, stoneCount, insigniaSale, insigniaUnheard, makeBrokerSale, brokerStock } from '../src/systems/sigilBroker.js';
import { sigilStone } from '../src/systems/gateSpoils.js';
import { setLocked } from '../src/systems/itemLock.js';
import { TITLE_TEXT, AURA_TEXT, TITLE_GRADIENT, TITLE_EDGE, badgeCss } from '../src/ui/playerBadge.js';
import {
  SESSION_KEY, adoptIdentity, keepSession, storedSession, accountRefusalText, equipAura, buyInsignia, readAccount,
} from '../src/net/accountClient.js';
import { ownAura, ownGlyphs } from '../src/systems/ownGlyphs.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import {
  AURA_RING_R, AURA_GROUND_R, AURA_FLAME_H, AURA_LIFT_M, AURA_STEPS, AURA_DRAW_MAX, AURA_RANGE_M, AURA_CLOCK_PERIOD,
  AURA_FLOW, AURA_ROUND, AURA_VS, AURA_FS, auraClock, auraWearers, auraFlowsWhole, auraFlameStrip, AuraRingRenderer,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';
import { fakeDom } from './invdrag.mjs';
import { mountBrokerWindow, insigniaLabel, INSIGNIA_HEAD, INSIGNIA_CARD, stonesText } from '../src/ui/brokerWindow.js';
import { AccountFlow } from '../src/ui/accountFlow.js';
import { accountCard } from '../src/ui/enhancedAccount.js';
import { standService, T0 } from './accountDb.mjs';
import { aurasHeld, auraWorn, auraRefusal, titlesHeld, wardrobeOf } from '../server-account/src/titles.js';
import { buyInsignia as serviceBuyInsignia } from '../server-account/src/accounts.js';   // AUDIT WB9 (insignia F3): the sale itself, under the interleaving real D1 allows

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
/** A pack's stack of `n` Deadlands Embers - one record, as addItem makes it. */
const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
/** A storage over a Map - the device's own, as the page's localStorage is. */
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

// ── THE LAW (net/insignia.js) ───────────────────────────────────────

test('WB9g the insignia\'s law: two pieces, the Gatebreaker title at 30 Deadlands Embers and Dagon\'s Fire at 50 - dearer than anything the day\'s stock sells (the Regalia is 12) - each key in the token\'s vocabulary; the column read as the ids it holds, once each, in their order (a stranger\'s word, a repeat and an over-long column hold nothing); a sale appends; the keys of a kind; the side\'s own refusals (mutants: a price cut; a repeat held twice; the column unbounded; an owned piece sold again; an offline sale; a short purse served)', () => {
  assert.deepEqual(INSIGNIA.map((r) => [r.id, r.kind, r.key, r.price]), [['title:gatebreaker', 'title', 'gatebreaker', 30], ['aura:dagonfire', 'aura', 'dagonfire', 50]]);
  assert.ok(Object.isFrozen(INSIGNIA) && INSIGNIA.every(Object.isFrozen), 'the law is not a table a caller can edit');
  const dearest = Math.max(...Object.values(BROKER_PRICES));
  assert.equal(dearest, 12, 'the Regalia, the day\'s dearest');
  for (const r of INSIGNIA) assert.ok(r.price >= 2 * dearest, `${r.id}: "expensive and sought after" - more than twice the day's dearest`);
  assert.ok(insigniaVocabularyOk(), 'a title a token could not carry would be a sale nobody sees');
  assert.ok(TITLES.includes('gatebreaker') && AURAS.includes('dagonfire'));
  assert.equal(GLYPHS.includes('gatebreaker'), false, 'a title and no glyph - the fire is its mark');
  assert.equal(insigniaById('aura:dagonfire').price, 50);
  assert.equal(insigniaById('title:founder'), null, 'a grant is not for sale');
  // the column
  assert.deepEqual(insigniaHeld(null), []);
  assert.deepEqual(insigniaHeld(''), []);
  assert.deepEqual(insigniaHeld(42), []);
  assert.deepEqual(insigniaHeld('aura:dagonfire title:gatebreaker'), ['aura:dagonfire', 'title:gatebreaker'], 'in the order bought');
  assert.deepEqual(insigniaHeld('aura:dagonfire aura:dagonfire'), ['aura:dagonfire'], 'a repeat is one piece');
  assert.deepEqual(insigniaHeld('title:founder aura:dagonfire'), ['aura:dagonfire'], 'a word that is no offer\'s id is not held');
  assert.equal(INSIGNIA_COLUMN_MAX, 'title:gatebreaker aura:dagonfire'.length);
  assert.deepEqual(insigniaHeld(`aura:dagonfire ${'x'.repeat(INSIGNIA_COLUMN_MAX)}`), [], 'a longer column is not one this law wrote');
  assert.equal(insigniaWith(null, 'aura:dagonfire'), 'aura:dagonfire');
  assert.equal(insigniaWith('aura:dagonfire', 'title:gatebreaker'), 'aura:dagonfire title:gatebreaker');
  assert.equal(insigniaWith('title:gatebreaker', 'title:gatebreaker'), 'title:gatebreaker', 'never twice');
  assert.deepEqual(insigniaKeys('aura:dagonfire title:gatebreaker', 'title'), ['gatebreaker']);
  assert.deepEqual(insigniaKeys('aura:dagonfire title:gatebreaker', 'aura'), ['dagonfire']);
  assert.deepEqual(insigniaKeys(null, 'aura'), []);
  // the side's own refusals
  const t = insigniaById('title:gatebreaker');
  assert.equal(insigniaRefusal(t, { held: [], stones: 30, online: true }), null, 'thirty stones buy it');
  assert.equal(insigniaRefusal(t, { held: [], stones: 29, online: true }), 'stones');
  assert.equal(insigniaRefusal(t, { held: ['title:gatebreaker'], stones: 99, online: true }), 'owned');
  assert.equal(insigniaRefusal(t, { held: [], stones: 99, online: false }), 'offline', 'the account keeps it - no account, no sale');
  assert.equal(insigniaRefusal({ id: 'title:founder', price: 1 }, { held: [], stones: 99, online: true }), 'gone');
  assert.equal(insigniaRefusal(null, { held: [], stones: 99, online: true }), 'gone');
});

// ── THE TOKEN, THE WIRE AND THE RELAY ───────────────────────────────

test('WB9g the token and the wire: a token may carry the aura worn (`au`), absent for none and refused for a word the vocabulary does not hold; it verifies with it; `badged` stamps it off the verified claims alone and `readAura` reads it back, null for none and for a stranger\'s word; the relay\'s own hello reads it out of the signature onto the attached row (mutants: an unknown aura signed; the relay drops it; the reader believes any word)', async () => {
  const nowS = T0;
  const base = { v: 1, s: 'acct-wb9g', n: 'Gatebreaker', k: 'linked', i: nowS, e: nowS + 60 };
  assert.equal(claimsValid({ ...base, t: 'gatebreaker', au: 'dagonfire' }), true);
  assert.equal(claimsValid(base), true, 'none worn: absent');
  assert.equal(claimsValid({ ...base, au: 'hellfire' }), false, 'a word the vocabulary does not hold is refused');
  assert.equal(claimsValid({ ...base, au: '' }), false, 'present and empty is not none');
  assert.equal(claimsValid({ ...base, au: null }), false, 'nor is null - none is absent');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const token = await mintToken({ ...base, t: 'gatebreaker', au: 'dagonfire' }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(token, kp.publicKey, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.au, 'dagonfire');
  assert.equal(r.claims.t, 'gatebreaker');
  // the wire
  assert.deepEqual(badged({ id: 'p1' }, { title: 'gatebreaker', au: 'dagonfire' }), { id: 'p1', title: 'gatebreaker', au: 'dagonfire' });
  assert.deepEqual(badged({ id: 'p1' }, { au: 'hellfire' }), { id: 'p1' }, 'a word the vocabulary does not hold is never stamped');
  assert.deepEqual(badged({ id: 'p1' }, {}), { id: 'p1' }, 'none is absent, never null');
  assert.equal(readAura({ au: 'dagonfire' }), 'dagonfire');
  assert.equal(readAura({ au: 'hellfire' }), null, 'a stranger\'s word about themselves');
  assert.equal(readAura({}), null);
  assert.equal(readAura(null), null);
  // the relay: the hello's verified identity carries it, and the attached row it is stamped from carries it on
  const relay = rd('server/src/index.js');
  assert.match(relay, /return \{ name: c\.n, kind: c\.k, subject: c\.s, title: c\.t, ts: c\.ts, glyphs: c\.g, gx: c\.gx, au: c\.au, rb: c\.rb, mu, lv: c\.lv, \.\.\.guild, gio: c\.i, ar: c\.ar, cl: c\.cl \};/, 'off the signature (SEASON1 part two, PIN MOVED: a Season\'s banner ribbon beside it; ARENA4, PIN MOVED: the season\'s rating after it; ARENA4b, PIN MOVED: the character\'s level after that)');
  assert.match(relay, /this\._setAttach\(ws, \{ \.\.\.a, id: m\.id, name: who\.name, title: who\.title, \.\.\.\(who\.ts \? \{ ts: who\.ts \} : \{\}\), glyphs: who\.glyphs, gx: who\.gx, au: who\.au, \.\.\.\(who\.rb \? \{ rb: who\.rb \} : \{\}\), lv: who\.lv,/, 'onto the socket\'s row (SEAT1c: a seat title\'s claim beside the title)');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** Gates closed for `who`, by hand - one row a game day, as claimGate writes them (WB5b). */
const closeGates = (env, who, n, from = 1000) => {
  const ins = env.DB._raw.prepare('INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (?, ?, \'ruhn\', \'dealt\', ?)');
  for (let d = from; d < from + n; d++) ins.run(d, who.id, T0);
};
const getAccount = async (fetch, who) => {
  const res = await fetch('https://accounts.invalid/v1/account', { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } });
  return { status: res.status, body: await res.json() };
};

test('WB9g the service\'s sale: a piece is bought ONCE for an ACCOUNT, paid for by the gates it closed (one Deadlands Ember a gate) less what its insignia already cost - short refused with what the gates can still pay; the title held from the sale on, as a founder\'s is, and wearable; the aura held and not worn until pressed; owned refused; a guest and an unknown piece refused; the account view says the purse (mutants: the gates never counted; the spend never added; a piece sold twice; the title not held; a guest served)', async () => {
  // the service's laws on the row, derived at every ask
  const bought = { handle: 'B', created_at: 1_900_000_000, registered_at: 1_900_000_000, insignia: 'aura:dagonfire title:gatebreaker', aura: 'dagonfire' };
  assert.deepEqual(aurasHeld(bought), ['dagonfire']);
  assert.equal(auraWorn(bought), 'dagonfire');
  assert.equal(auraWorn({ ...bought, insignia: 'title:gatebreaker' }), undefined, 'a stored aura the row does not hold is not worn');
  assert.equal(auraWorn({ ...bought, aura: null }), undefined);
  assert.deepEqual([auraRefusal(null, {}), auraRefusal('dagonfire', bought), auraRefusal('dagonfire', {}), auraRefusal('hellfire', bought)], [null, null, 'not-held', 'no-aura']);
  assert.ok(titlesHeld(bought, {}).includes('gatebreaker'), 'a title bought is a title held');
  assert.ok(!titlesHeld({ ...bought, insignia: null }, {}).includes('gatebreaker'));
  assert.deepEqual(wardrobeOf(bought, {}, 1_900_000_000).insignia, ['aura:dagonfire', 'title:gatebreaker']);
  const { env, call, guest, registered, fetch } = await standService();
  const me = await registered('Breaker');
  const buy = (id, who = me) => call('/v1/account/insignia', { item: id }, who.secret);
  let r = await buy('title:gatebreaker');
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'short', purse: 0, price: 30 }, 'no gate closed, nothing to pay with');
  closeGates(env, me, 29);
  r = await buy('title:gatebreaker');
  assert.deepEqual([r.status, r.body.purse], [409, 29], 'one gate short');
  closeGates(env, me, 1, 5000);
  r = await buy('title:gatebreaker');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bought, 'title:gatebreaker');
  assert.ok(r.body.titles.includes('gatebreaker'), 'held from the sale on');
  assert.deepEqual(r.body.insignia, ['title:gatebreaker']);
  assert.equal(r.body.purse, 0, 'the thirty gates spent');
  assert.equal(r.body.title, null, 'bought is not worn - the player presses it on');
  const row = env.DB._raw.prepare('SELECT insignia, insignia_spent, aura FROM players WHERE id = ?').get(me.id);
  assert.deepEqual({ ...row }, { insignia: 'title:gatebreaker', insignia_spent: 30, aura: null });
  assert.deepEqual([(await buy('title:gatebreaker')).status, (await buy('title:gatebreaker')).body.error], [409, 'owned'], 'owned, and nothing spent again');
  assert.equal(env.DB._raw.prepare('SELECT insignia_spent AS s FROM players WHERE id = ?').get(me.id).s, 30);
  // the aura: fifty more gates
  r = await buy('aura:dagonfire');
  assert.deepEqual([r.status, r.body], [409, { error: 'short', purse: 0, price: 50 }], 'the gates already spent do not pay twice');
  closeGates(env, me, 50, 2000);
  r = await buy('aura:dagonfire');
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.auras, r.body.aura, r.body.insignia, r.body.purse], [['dagonfire'], null, ['title:gatebreaker', 'aura:dagonfire'], 0]);
  // worn: the title through the title's door, the aura through its own
  r = await call('/v1/account/title', { title: 'gatebreaker' }, me.secret);
  assert.deepEqual([r.status, r.body.title], [200, 'gatebreaker'], 'a bought title is worn as any held one');
  r = await call('/v1/account/aura', { aura: 'dagonfire' }, me.secret);
  assert.deepEqual([r.status, r.body.aura, r.body.auras], [200, 'dagonfire', ['dagonfire']]);
  assert.equal((await call('/v1/account/aura', { aura: 'hellfire' }, me.secret)).body.error, 'no-aura');
  // the account view: the wardrobe whole, and the purse
  const view = await getAccount(fetch, me);
  assert.equal(view.status, 200);
  assert.deepEqual([view.body.wardrobe.title, view.body.wardrobe.aura, view.body.wardrobe.insignia, view.body.wardrobe.purse], ['gatebreaker', 'dagonfire', ['title:gatebreaker', 'aura:dagonfire'], 0]);
  // refused: somebody else's fire, a guest, a piece that does not exist, no credential
  const other = await registered('Watcher');
  r = await call('/v1/account/aura', { aura: 'dagonfire' }, other.secret);
  assert.deepEqual([r.status, r.body.error], [403, 'not-held'], 'held is what the row records, never what the caller says');
  assert.equal((await call('/v1/account/title', { title: 'gatebreaker' }, other.secret)).status, 403);
  const g = await guest();
  closeGates(env, g, 60, 7000);
  r = await buy('title:gatebreaker', g);
  assert.deepEqual([r.status, r.body.error], [403, 'guest'], 'a guest row is one storage clear from gone - it keeps nothing');
  r = await buy('title:founder');
  assert.deepEqual([r.status, r.body.error], [400, 'no-insignia']);
  assert.equal((await call('/v1/account/insignia', { item: 'title:gatebreaker' })).status, 401);
});

test('WB9g the service\'s sale, pressed twice at once: ONE UPDATE is the sale - the id joins the column and the price the spend only where the row does not hold it yet and its gates still cover it - so two sales racing spend the same stones once, and one piece is never bought twice (mutants: the check read before the write; the owned test off the UPDATE)', async () => {
  const { env, call, registered } = await standService();
  const me = await registered('Racer');
  closeGates(env, me, 60);   // enough for either piece, never both
  const [a, b] = await Promise.all([
    call('/v1/account/insignia', { item: 'title:gatebreaker' }, me.secret),
    call('/v1/account/insignia', { item: 'aura:dagonfire' }, me.secret),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'one sale, one refusal');
  const lost = a.status === 409 ? a : b;
  assert.equal(lost.body.error, 'short');
  const row = env.DB._raw.prepare('SELECT insignia, insignia_spent FROM players WHERE id = ?').get(me.id);
  assert.equal(insigniaHeld(row.insignia).length, 1, 'one piece recorded');
  assert.equal(row.insignia_spent, insigniaById(insigniaHeld(row.insignia)[0]).price, 'its price spent, once');
  // the same piece, twice at once
  const you = await registered('Twin');
  closeGates(env, you, 200);
  const both = await Promise.all([0, 1].map(() => call('/v1/account/insignia', { item: 'title:gatebreaker' }, you.secret)));
  assert.deepEqual(both.map((x) => x.status).sort(), [200, 409]);
  assert.deepEqual(both.find((x) => x.status === 409).body, { error: 'owned' });
  assert.equal(env.DB._raw.prepare('SELECT insignia_spent AS s FROM players WHERE id = ?').get(you.id).s, 30, 'paid for once');
});

test('WB9g the token signs the aura worn: minted with `au` while it is worn and held, and the answer says it beside the title; taken off, the next token carries none and says null (mutants: the mint reads no aura; the answer leaves it out)', async () => {
  const { env, call, registered, identityPublic } = await standService();
  const me = await registered('Flame');
  closeGates(env, me, 50);
  assert.equal((await call('/v1/account/insignia', { item: 'aura:dagonfire' }, me.secret)).status, 200);
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(v.ok, v.why);
    return { answer: r.body, claims: v.claims };
  };
  let m = await mint();
  assert.equal('au' in m.claims, false, 'bought and not worn: nothing signed');
  assert.equal(m.answer.aura, null);
  await call('/v1/account/aura', { aura: 'dagonfire' }, me.secret);
  m = await mint();
  assert.equal(m.claims.au, 'dagonfire', 'worn: signed');
  assert.equal(m.answer.aura, 'dagonfire', 'and said beside the token, for my own feet');
  await call('/v1/account/aura', { aura: null }, me.secret);
  m = await mint();
  assert.equal('au' in m.claims, false);
  assert.equal(m.answer.aura, null);
});

// ── THE CLIENT ──────────────────────────────────────────────────────

test('WB9g the client\'s doors: the aura and the sale through the one call door, against the real service; each refusal a sentence; the stored session learns the aura worn from any answer that states it (a token\'s, a wardrobe\'s), one that exists or none, into the session that asked and never writing what did not change; `ownAura` reads it back per frame, nothing parsed twice (mutants: the aura never kept; a stranger\'s word kept; another session\'s answer adopted)', async () => {
  const { env, registered, fetch } = await standService();
  const me = await registered('Doors');
  const io = { fetch, base: 'https://accounts.invalid', secret: me.secret };
  let r = await buyInsignia(io, 'aura:dagonfire');
  assert.deepEqual([r.ok, r.error, r.status], [false, 'short', 409]);
  closeGates(env, me, 50);
  r = await buyInsignia(io, 'aura:dagonfire');
  assert.ok(r.ok);
  assert.deepEqual(r.data.auras, ['dagonfire']);
  r = await equipAura(io, 'dagonfire');
  assert.deepEqual([r.ok, r.data.aura], [true, 'dagonfire']);
  r = await readAccount(io);
  assert.equal(r.data.wardrobe.aura, 'dagonfire');
  for (const w of ['no-aura', 'no-insignia', 'owned', 'short', 'guest']) {
    const s = accountRefusalText(w);
    assert.ok(typeof s === 'string' && s.length > 20 && !s.includes(w), `${w}: a sentence, never the machine word`);
  }
  assert.equal(accountRefusalText('short'), 'Your account has too few embers for that.');   // WB13b: the card says the rule; AUDIT WB12d (A4): the purse is embers
  // the stored session
  const st = memStorage();
  keepSession(st, { id: me.id, name: 'Doors', kind: 'linked', sessionId: 's1', secret: me.secret, glyphs: [] });
  assert.equal(ownAura(st), null, 'none stated yet');
  assert.equal(adoptIdentity(st, { aura: 'dagonfire', secret: me.secret }), true);
  assert.equal(storedSession(st).aura, 'dagonfire');
  assert.equal(ownAura(st), 'dagonfire');
  assert.deepEqual(ownGlyphs(st), [], 'the glyphs read beside it, unchanged');
  let writes = 0;
  const set = st.setItem;
  st.setItem = (k, v) => { writes++; set(k, v); };
  assert.equal(adoptIdentity(st, { aura: 'dagonfire', secret: me.secret }), false, 'the same aura is not written again - a write is an event in every open tab');
  assert.equal(adoptIdentity(st, { name: 'Doors', secret: me.secret }), false, 'an answer that states no aura says nothing about it');
  assert.equal(storedSession(st).aura, 'dagonfire');
  assert.equal(adoptIdentity(st, { aura: 'dagonfire', secret: 'another-sessions-secret' }), false, 'AUDIT B4: never into a session that did not ask');
  assert.equal(adoptIdentity(st, { aura: 'hellfire', secret: me.secret }), true, 'a stranger\'s word...');
  assert.equal(storedSession(st).aura, null, '...is none');
  assert.equal(ownAura(st), null);
  assert.equal(adoptIdentity(st, { aura: null, secret: me.secret }), false, 'none again: nothing to write');
  assert.equal(writes, 1);
  st._m.set(SESSION_KEY, JSON.stringify({ ...storedSession(st), aura: 'dagonfire' }));
  assert.equal(ownAura(st), 'dagonfire', 'a write from another tab is read on the next frame');
  st._m.set(SESSION_KEY, JSON.stringify({ ...storedSession(st), aura: 'hellfire' }));
  assert.equal(ownAura(st), null, 'a stored word the vocabulary does not hold lights nothing');
});

test('WB9g the online session: my own aura adopted through the wire\'s reader (an answer from a service before acct38 says nothing, and keeps it); a peer\'s off its introduction, its newest hello\'s whatever it is (a taken-off aura is gone at the next), and kept in the session\'s memory so a peer re-stood after a blip wears it at once; `auraOf` answers mine and any peer\'s (mutants: the peer\'s aura never read; the refresh keeping the first; the memory losing it)', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  assert.equal(s.auraOf('mac-0001'), null);
  assert.equal(s.adoptIdentity({ name: 'Mac', aura: 'dagonfire' }), true);
  assert.equal(s.auraOf('mac-0001'), 'dagonfire');
  assert.equal(s.adoptIdentity({ name: 'Mac' }), false, 'an older service\'s answer says nothing about it');
  assert.equal(s.au, 'dagonfire');
  assert.equal(s.adoptIdentity({ name: 'Mac', aura: 'hellfire' }), true);
  assert.equal(s.au, null, 'a word the vocabulary does not hold is none');
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:2,12', pose); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'peer-0002', name: 'Ember', au: 'dagonfire', pose }], host: null, world: null });
  assert.equal(s.auraOf('peer-0002'), 'dagonfire', 'off the introduction the relay stamped');
  sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Ember', pose });
  assert.equal(s.auraOf('peer-0002'), null, 'the newest hello\'s, including none');
  sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Ember', au: 'dagonfire', pose });
  assert.equal(s.auraOf('peer-0002'), 'dagonfire');
  sockets[0].receive({ t: 'join', id: 'peer-0003', name: 'Liar', au: 'hellfire', pose });
  assert.equal(s.auraOf('peer-0003'), null, 'a word no relay stamps is read as none');
  // a blip: the peer gone from the room, then re-stood by a bare pose - wearing its fire at once, from memory
  sockets[0].receive({ t: 'leave', id: 'peer-0002' });
  assert.equal(s.peers.has('peer-0002'), false);
  assert.equal(s.auraOf('peer-0002'), 'dagonfire', 'an introduction is a fact about an id, kept');
  sockets[0].receive({ t: 'pose', id: 'peer-0002', p: { ...pose, x: 4 } });
  assert.equal(s.peers.get('peer-0002')?.au, 'dagonfire', 'SLAM9\'s memory carries it onto the re-stood peer');
}));

test('WB9g the pack\'s half: the price taken from the spendable stones, first records first - a stack the price empties gone, one it draws on at what it keeps - all of it or none (a locked stack is not spendable); the sale\'s and the insignia\'s one hand (mutants: a short pack emptied; a locked stack spent; the drawn stack left whole)', () => {
  const locked = stack(40);
  setLocked(locked, true);
  let pack = [stack(20), locked, stack(15)];
  assert.equal(spendStones(pack, 30), true);
  assert.deepEqual(pack.map((x) => x.stackCount), [40, 5], 'the first stack gone, the next drawn on, the locked one untouched');
  assert.equal(pack[0], locked);
  pack = [stack(10), locked];
  assert.equal(spendStones(pack, 30), false, 'ten spendable is short of thirty, whatever is locked');
  assert.deepEqual(pack.map((x) => x.stackCount), [10, 40], 'nothing taken');
  assert.equal(spendStones(pack, 0), false);
  assert.equal(spendStones(null, 5), false);
  pack = [sigilStone(), sigilStone(), stack(3)];
  assert.equal(stoneCount(spendableStonesIn(pack)), 5);
  assert.equal(spendStones(pack, 4), true);
  assert.deepEqual(pack.map((x) => x.stackCount ?? 1), [1]);
  const src = rd('src/systems/sigilBroker.js');
  assert.equal(src.match(/else item\.stackCount = have - count;/g)?.length, 1, 'one hand takes stones from a pack');
  assert.match(src, /takeFromPack\(items, sale\.take\);/);
  assert.match(src, /takeFromPack\(items, stonesToTake\(spendable, price\)\);/);
});

// ── THE FIRE (render/auraRing.js) ───────────────────────────────────

test('WB9g the aura, who and when: the wearers within AURA_RANGE_M of the eye, nearest first, at most AURA_DRAW_MAX, into one list refilled every frame; one without an aura or a place is not drawn; the clock wraps whole for every flow; the flames\' strip is AURA_STEPS quads round (mutants: the far drawn; the cap gone; the order reversed; a flow off the clock)', () => {
  const out = [];
  const w = (id, x, aura = 'dagonfire') => ({ id, at: [x, 0, 0], aura });
  const list = [w('far', AURA_RANGE_M + 1), w('c', 30), w('a', 2), w('none', 1, null), { id: 'nowhere', aura: 'dagonfire' }, w('b', -10)];
  const got = auraWearers(list, [0, 0, 0], out);
  assert.equal(got, out, 'the same list, refilled - no garbage a frame (AUDIT WB D10)');
  assert.deepEqual(got.map((x) => x.id), ['a', 'b', 'c'], 'within range, nearest first');
  const many = Array.from({ length: AURA_DRAW_MAX + 9 }, (_, i) => w(`p${i}`, i));
  assert.equal(auraWearers(many, [0, 0, 0], out).length, AURA_DRAW_MAX);
  assert.deepEqual(out.map((x) => x.id), many.slice(0, AURA_DRAW_MAX).map((x) => x.id), 'the nearest kept');
  assert.deepEqual(auraWearers(null, [0, 0, 0], out), []);
  assert.deepEqual(auraWearers(list, null, out), []);
  assert.equal(auraClock(AURA_CLOCK_PERIOD * 3 + 7.25), 7.25);
  assert.equal(auraClock(-1), AURA_CLOCK_PERIOD - 1);
  assert.ok(auraFlowsWhole(), 'every flow is whole over the clock');
  for (const r of Object.values(AURA_FLOW)) assert.ok(Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
  assert.ok(Object.values(AURA_ROUND).every(Number.isInteger), 'the lattice closes round the ring');
  const strip = auraFlameStrip();
  assert.equal(strip.length, AURA_STEPS * 12);
  assert.deepEqual([...strip.slice(0, 12)], [0, 0, 1 / AURA_STEPS, 0, 1 / AURA_STEPS, 1, 0, 0, 1 / AURA_STEPS, 1, 0, 1].map((v) => Math.fround(v)));
  assert.equal(strip[strip.length - 3], 1, 'the last step closes the ring');
  assert.ok(AURA_RING_R < AURA_GROUND_R && AURA_FLAME_H < 1 && AURA_LIFT_M > 0 && AURA_LIFT_M < 0.1, 'a ring about the feet, low flames, lifted off the stone');
});

/** The fire's colour at a point - the shader's own main(), run. */
const fireAt = (kind, vP, { t = 13.5, seed = 0.37, kindle = 1, world = [0, 0, 0], fog = null } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: world, uKind: kind, uTime: t, uSeed: seed, uKindle: kindle, uRingR: AURA_RING_R, uGroundR: AURA_GROUND_R,
    uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
/** The ground's mean brightness round a circle of radius `r`, at `n` angles. */
const ringMean = (r, t = 13.5, n = 24) => { let s = 0; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; s += lum(fireAt(0, [Math.cos(a) * r, Math.sin(a) * r], { t })); } return s / n; };

test('WB9g the aura\'s light, the shader RUN: added onto the frame (alpha 1 under ONE, ONE); the ring burns brightest in its band - far brighter than the stone inside it and the ground past it - in fire\'s colours (red over green over blue); nothing past the quad\'s round edge; no seam where the ring closes behind the wearer; the picture at the clock\'s wrap the picture at zero; the flames hot at the root and gone at the tip; a fire not yet kindled draws nothing; the fog thins it (mutants: the band\'s edges reversed; the noise not periodic; the kindle ignored; the flames upside down)', () => {
  const band = ringMean(AURA_RING_R), inside = ringMean(0.3), past = ringMean(AURA_GROUND_R - 0.05);
  assert.ok(band > 0.35, `the band burns (${band.toFixed(3)})`);
  assert.ok(band > inside * 2.5, `brighter than the stone within (${band.toFixed(3)} vs ${inside.toFixed(3)})`);
  assert.ok(inside > 0.02, 'but the stone within glows');
  assert.ok(band > past * 4, `and far brighter than the ground past it (${past.toFixed(3)})`);
  let red = 0, green = 0, blue = 0;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const c = fireAt(0, [Math.cos(a) * AURA_RING_R, Math.sin(a) * AURA_RING_R]); red += c[0]; green += c[1]; blue += c[2]; }
  assert.ok(red > green && green > blue, 'fire\'s colours: red over green over blue');
  assert.equal(fireAt(0, [AURA_RING_R, 0])[3], 1, 'alpha 1 under ONE, ONE: the light is ADDED');
  assert.throws(() => fireAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  // the seam behind the wearer: either side of the ring's closing angle
  for (const r of [AURA_RING_R - 0.1, AURA_RING_R, AURA_RING_R + 0.1]) {
    const a = fireAt(0, [-r, 1e-7]), b = fireAt(0, [-r, -1e-7]);
    assert.ok(Math.abs(lum(a) - lum(b)) < 1e-3, `no seam at ${r}: ${lum(a)} vs ${lum(b)}`);
  }
  for (let i = 0; i < 6; i++) {
    const p = [Math.cos(i) * (0.4 + i * 0.15), Math.sin(i) * (0.4 + i * 0.15)];
    const a = fireAt(0, p, { t: 0 }), b = fireAt(0, p, { t: AURA_CLOCK_PERIOD });
    assert.ok(Math.abs(lum(a) - lum(b)) < 1e-6, `the ground at the wrap is the ground at zero (${p})`);
    const fa = fireAt(1, [i / 6, 0.3], { t: 0 }), fb = fireAt(1, [i / 6, 0.3], { t: AURA_CLOCK_PERIOD });
    assert.ok(Math.abs(lum(fa) - lum(fb)) < 1e-6, 'and the flames');
  }
  // the flames: the root against the tip, round the ring
  let root = 0, tip = 0;
  for (let i = 0; i < 32; i++) { root += lum(fireAt(1, [i / 32, 0.08])); tip += lum(fireAt(1, [i / 32, 0.92])); }
  assert.ok(root > 0.5 * 32 * 0.2, `the flames stand (${(root / 32).toFixed(3)} at the root)`);
  assert.ok(root > tip * 6, `hot at the root, gone at the tip (${(root / 32).toFixed(3)} vs ${(tip / 32).toFixed(3)})`);
  assert.ok(Math.abs(lum(fireAt(1, [1e-7, 0.2])) - lum(fireAt(1, [1 - 1e-7, 0.2]))) < 1e-3, 'the flames close round the ring');
  assert.equal(lum(fireAt(0, [AURA_RING_R, 0], { kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(lum(fireAt(0, [AURA_RING_R, 0], { kindle: 0.5 })) < lum(fireAt(0, [AURA_RING_R, 0])) * 0.51, 'kindling: a share of it');
  assert.ok(lum(fireAt(0, [AURA_RING_R, 0], { world: [0, 0, 400], fog: { density: 0.01 } })) < lum(fireAt(0, [AURA_RING_R, 0])) * 0.1, 'the fog thins it');
  // the vertex half: the ground flat at the lift about the feet; a flame's foot on the ring, its tip AURA_FLAME_H up
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (kind, aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: kind, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: AURA_RING_R, uFlameH: AURA_FLAME_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(vs(0, [1, -1]), [10 + AURA_GROUND_R, 2 + AURA_LIFT_M, -4 - AURA_GROUND_R]), 'the ground quad\'s corner');
  assert.ok(near(vs(1, [0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + AURA_RING_R]), 'a flame\'s foot on the ring');
  assert.ok(near(vs(1, [0.25, 1]), [10, 2 + AURA_LIFT_M + AURA_FLAME_H, -4 + AURA_RING_R]), 'its tip over it');
});

test('WB9g the aura\'s draw: nothing to draw touches nothing; two draws a wearer (the ground, the flames) placed by uniforms; ONE, ONE; no depth written and the mask put back; the ground offset off the stone; culling back and blending off after; the fog\'s focus uploaded (AUDIT DEEP R-1); `drawn` counts them (mutants: depth written; the offset left on; a wearer\'s flames skipped)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  r.draw([], I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
  assert.equal(r.drawn, 0);
  const focus = new Float32Array([1, 2, 3, 1]);
  r.draw([{ at: [1, 0, 1], seed: 0.1, kindle: 1 }, { at: [5, 0, 5], seed: 0.2, kindle: 0.5 }, { at: [9, 0, 9] }], I, I, [0, 0, 0], 130, { mode: 2, density: 0.01, range: [0, 1], camPos: [0, 0, 0], focus });
  assert.equal(r.drawn, 3);
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.deepEqual(draws.map((c) => c[3]), [6, AURA_STEPS * 6, 6, AURA_STEPS * 6, 6, AURA_STEPS * 6], 'the ground, then the flames, each wearer');
  assert.equal(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uAt').length, 3, 'each placed by its uniform - the buffers never change');
  assert.deepEqual(calls.find((c) => c[0] === 'blendFunc').slice(1), [gl.ONE, gl.ONE]);
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true]);
  const names = calls.map((c) => c[0]);
  const last = names.lastIndexOf('drawArrays');
  assert.ok(calls.some((c, i) => i < names.indexOf('drawArrays') && c[0] === 'enable' && c[1] === gl.POLYGON_OFFSET_FILL), 'offset on before');
  assert.ok(calls.some((c, i) => i > last && c[0] === 'disable' && c[1] === gl.POLYGON_OFFSET_FILL), 'and off after');
  assert.ok(calls.some((c, i) => i > last && c[0] === 'enable' && c[1] === gl.CULL_FACE), 'culling back on after');
  assert.ok(calls.some((c, i) => i > last && c[0] === 'disable' && c[1] === gl.BLEND), 'blending off after');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4fv' && c[1] === 'uFocus')?.[2], focus, 'the travel view\'s focus, as every fogged program');
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uTime')[2], auraClock(130), 'the clock wrapped');
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uKindle').map((c) => c[2]), [1, 0.5, 1], 'a wearer with no kindling is lit whole');
});

// ── THE BROKER'S WINDOW ─────────────────────────────────────────────

/** withDom (test/invdrag.mjs), for a flow that awaits: the fake document stands until `fn` settles. */
async function withDomAsync(fn) {
  const dom = fakeDom();
  const saved = { doc: globalThis.document, hadDoc: 'document' in globalThis, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 0;
  try { return await fn(dom); } finally {
    if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.rem;
    globalThis.requestAnimationFrame = saved.raf;
  }
}
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const settle = () => new Promise((r) => setTimeout(r, 0));

test('WB9g the Broker\'s window: under the day\'s stock, the Insignia - its heading, a row a piece in the wares\' own grid (the title\'s word in its own fire, the aura\'s ring turning), each a control the pad and the keyboard reach (U10), its price, and a button that says why not ("Need 12 more") or what a press does (Buy, Wear, Take off); a press says "Buying..." until the account answers, nothing else pressable meanwhile, then the word; a row pressed shows the piece\'s card; the wardrobe asked for as the window opens (mutants: the rows never drawn; a short purse offered the Buy; a second press while one is in flight; the card of a ware instead)', async () => {
  await withDomAsync(async () => {
    const rows = [
      { id: 'title:gatebreaker', kind: 'title', key: 'gatebreaker', price: 30, name: 'Gatebreaker', owned: false, worn: false },
      { id: 'aura:dagonfire', kind: 'aura', key: 'dagonfire', price: 50, name: 'Dagon\'s Fire', owned: true, worn: false },
    ];
    const purse = [stack(38)];
    let loads = 0, busy = false;
    const asked = [];
    let answer = null;
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => [], day: () => 1, now: () => 0, items: () => purse, bought: () => [],
      buy: () => ({ ok: false }), picture: () => null, wearer: null, nameOf: (it) => it.name,
      insignia: () => rows, insigniaLoad: async () => { loads++; }, insigniaBusy: () => busy,
      buyInsignia: (g) => { asked.push(['buy', g.id]); return new Promise((res) => { answer = res; }); },
      wearInsignia: async (g) => { asked.push(['wear', g.id]); return { ok: true, text: `Wearing ${g.name}.` }; },
    });
    try {
      await settle();
      assert.equal(loads, 1, 'the wardrobe asked for once, as the window opens');
      const shell = one(host, 'broker-shell');
      assert.equal(one(shell, 'broker-insignia-title').textContent, INSIGNIA_HEAD);
      let ins = kids(shell, 'broker-insig');
      assert.deepEqual(ins.map((r) => r.dataset.insignia), ['title:gatebreaker', 'aura:dagonfire']);
      assert.ok(ins.every((r) => r.classList.contains('broker-offer')), 'in the wares\' own grid');
      assert.deepEqual(ins.map((r) => [r.attrs.role, r.attrs.tabindex]), [['button', '0'], ['button', '0']], 'U10: controls');
      // AUDIT WB9 (the shots): the row's 36 px sign cut the whole word to "tebreak" - it is the word's first letter, in its
      // own fire, and the row's name says the word
      assert.equal(one(ins[0], 'insignia-word').textContent, 'G', 'the title\'s first letter, in its own fire');
      assert.ok(one(ins[0], 'insignia-word').classList.contains('mono'));
      assert.ok(one(ins[0], 'insignia-word').style.backgroundImage.startsWith('linear-gradient('), 'painted as the title is worn');
      assert.equal(one(ins[0], 'broker-name').textContent, 'Gatebreaker');
      assert.ok(one(ins[1], 'aura-ring').classList.contains('aura-dagonfire'), 'the aura\'s ring');
      assert.equal(one(ins[0], 'broker-price').textContent, stonesText(30));
      assert.equal(one(ins[1], 'broker-price').textContent, 'Owned');
      const btn = (r) => one(r, 'broker-buy');
      assert.equal(btn(ins[0]).textContent, 'Buy', 'thirty-eight stones buy the title');
      assert.equal(btn(ins[1]).textContent, 'Wear');
      assert.match(ins[0].attrs['aria-label'], /^Gatebreaker, a title, 30 Deadlands Embers$/);
      assert.match(ins[1].attrs['aria-label'], /^Dagon's Fire, an aura, 50 Deadlands Embers, owned$/);
      // the card
      ins[1].onkeydown({ key: 'Enter', target: ins[1], preventDefault() {} });
      let card = one(shell, 'broker-insignia-card');
      assert.ok(card, 'a row pressed shows the piece\'s card');
      assert.equal(card.children.find((c) => c.tagName === 'H3').textContent, INSIGNIA_CARD.aura[0]);
      assert.equal(kids(shell, 'broker-card').length, 1, 'one card - the piece\'s, not a ware\'s');
      const t0 = kids(shell, 'broker-insig')[0];
      t0.onkeydown({ key: 'Enter', target: t0, preventDefault() {} });
      assert.equal(one(one(shell, 'broker-insignia-card'), 'insignia-word').textContent, 'Gatebreaker', 'the card\'s sign says the whole word');
      // the buy: pending until the account answers
      ins = kids(shell, 'broker-insig');
      btn(ins[0]).onclick({ stopPropagation() {} });
      await settle();
      assert.deepEqual(asked, [['buy', 'title:gatebreaker']]);
      ins = kids(shell, 'broker-insig');
      assert.equal(btn(ins[0]).textContent, 'Buying...');
      assert.ok(ins.every((r) => btn(r).attrs.disabled === ''), 'nothing else pressable while it is in flight');
      btn(ins[1]).onclick({ stopPropagation() {} });
      await settle();
      assert.equal(asked.length, 1, 'a second press waits on the first');
      rows[0].owned = true;
      answer({ ok: true, text: 'Bought: Gatebreaker, for 30 Deadlands Embers.' });
      await settle(); await settle();
      assert.equal(one(shell, 'broker-note').textContent, 'Bought: Gatebreaker, for 30 Deadlands Embers.');
      assert.ok(one(shell, 'broker-note').classList.contains('ok'));
      ins = kids(shell, 'broker-insig');
      assert.equal(btn(ins[0]).textContent, 'Wear', 'owned now');
      assert.equal(btn(ins[0]).attrs.disabled, undefined);
      // wearing
      btn(ins[1]).onclick({ stopPropagation() {} });
      await settle(); await settle();
      assert.deepEqual(asked.at(-1), ['wear', 'aura:dagonfire']);
      assert.equal(one(shell, 'broker-note').textContent, 'Wearing Dagon\'s Fire.');
      // a short purse, and the host busy
      rows[0].owned = false; purse[0].stackCount = 18;
      view.repaint();
      ins = kids(shell, 'broker-insig');
      assert.equal(btn(ins[0]).textContent, 'Need 12 more');
      assert.equal(btn(ins[0]).attrs.disabled, '', 'a short purse cannot press it');
      busy = true;
      view.repaint();
      assert.ok(kids(shell, 'broker-insig').every((r) => btn(r).attrs.disabled === ''), 'the host mid-sale: nothing pressable');
      card = one(shell, 'broker-insignia-card');
      assert.ok(card);
    } finally { view.unmount(); }
  });
  assert.deepEqual([
    insigniaLabel({ owned: false, price: 30 }, { have: 30, busy: false, pending: false }),
    insigniaLabel({ owned: false, price: 30 }, { have: 7, busy: false, pending: false }),
    insigniaLabel({ owned: true, worn: false }, { have: 0, busy: false, pending: false }),
    insigniaLabel({ owned: true, worn: true }, { have: 0, busy: false, pending: false }),
    insigniaLabel({ owned: false, price: 30 }, { have: 30, busy: false, pending: true }),
    insigniaLabel({ owned: true }, { have: 0, busy: false, pending: true }),
  ], ['Buy', 'Need 23 more', 'Wear', 'Take off', 'Buying...', 'A moment...']);
});

// ── THE ACCOUNT CARD ────────────────────────────────────────────────

/** The card's smallest document (acc4played.test.js's). */
function cardDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', disabled: false, children: [], attrs: {},
      append: (...k) => n.children.push(...k.filter(Boolean)),
      setAttribute(k, v) { n.attrs[k] = v; },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  return { createElement: mk };
}

test('WB9g the account card and its flow: an Aura row beside the titles when the account holds one - the button in the Gatebreaker\'s own fire, its word its own (a title\'s word rule stays one per gradient title); pressing it asks the service, the answer replaces the wardrobe, pressing the worn one takes it off, a refusal writes nothing; the stored session learns the aura worn, so the fire at my own feet lights at once (mutants: the client decides what is held; the refusal writes anyway; the stored session never told)', async () => {
  const storage = memStorage();
  keepSession(storage, { id: 'acct-card', name: 'Card', kind: 'linked', sessionId: 's', secret: 'sec-card', glyphs: [] });
  const sent = [];
  let refuse = false;
  const wardrobe = (aura) => ({ titles: ['gatebreaker'], title: null, glyphs: [], auras: ['dagonfire'], aura, insignia: ['title:gatebreaker', 'aura:dagonfire'] });
  const io = {
    base: 'https://accounts.invalid',
    fetch: async (url, init) => {
      const body = init?.body ? JSON.parse(init.body) : null;
      sent.push([new URL(url).pathname, body]);
      if (refuse) return new Response(JSON.stringify({ error: 'not-held' }), { status: 403 });
      return new Response(JSON.stringify({ ok: true, ...wardrobe(body?.aura ?? null), titles: ['founder', 'gatebreaker'] }), { status: 200 });   // the service's word on what is held, which the answer brings whole
    },
  };
  const flow = AccountFlow({ io, storage });
  flow.stage = 'in';
  flow.account = { name: 'Card', handle: 'Card', kind: 'linked' };
  flow.wardrobe = { ...wardrobe(null), purse: 4 };
  const card = accountCard(cardDoc(), flow);
  card.paint();
  const auraBtn = () => card.root.all.find((n) => n.tag === 'button' && n.className.includes('actaura'));
  let b = auraBtn();
  assert.ok(b, 'an Aura row');
  assert.equal(b.className, 'acttitle actaura aura-dagonfire');
  assert.equal(b.children[0].className, 'actauraword');
  assert.equal(b.children[0].textContent, AURA_TEXT.dagonfire);
  assert.equal(b.attrs['aria-pressed'], 'false');
  assert.ok(card.root.all.some((n) => n.className === 'fieldlabel' && n.textContent === 'Aura'));
  assert.equal(await b.onclick(), true);
  assert.deepEqual(sent.at(-1), ['/v1/account/aura', { aura: 'dagonfire' }]);
  assert.equal(flow.wardrobe.aura, 'dagonfire', 'the answer\'s word');
  assert.deepEqual(flow.wardrobe.titles, ['founder', 'gatebreaker'], 'the answer REPLACES what the card knew - the client never decides what is held');
  assert.equal(flow.wardrobe.purse, 4, 'what no wear changes is kept');
  assert.equal(ownAura(storage), 'dagonfire', 'my own feet told at once');
  card.paint();
  b = auraBtn();
  assert.equal(b.className, 'acttitle actaura aura-dagonfire worn');
  assert.equal(b.attrs['aria-pressed'], 'true');
  assert.equal(await flow.wearAura('dagonfire'), true);
  assert.deepEqual(sent.at(-1), ['/v1/account/aura', { aura: null }], 'pressing the one worn takes it off');
  assert.equal(ownAura(storage), null);
  refuse = true;
  assert.equal(await flow.wearAura('dagonfire'), false);
  assert.equal(flow.wardrobe.aura, null, 'a refusal writes nothing');
  assert.equal(ownAura(storage), null);
  assert.ok(flow.error.length > 0);
  // a wear in flight: a second press waits
  refuse = false;
  const first = flow.wearAura('dagonfire');
  assert.equal(await flow.wearAura('dagonfire'), false, 'one press at a time');
  await first;
  // the paint: the Gatebreaker's fire on the button and its word; one word rule per gradient title
  const css = badgeCss();
  assert.match(css, /\.card button\.acttitle\.actaura\.aura-dagonfire \{ color: #[0-9a-f]{6}; \}/);
  assert.match(css, /\.card button\.acttitle\.actaura\.aura-dagonfire \.actauraword \{ background-image: linear-gradient/);
  assert.equal((css.match(/\.acttitleword/g) ?? []).length, Object.keys(TITLE_GRADIENT).length);
  assert.equal(TITLE_TEXT.gatebreaker, 'Gatebreaker');
  assert.ok(TITLE_GRADIENT.gatebreaker.length >= 3, 'coal, fire and ember');
  assert.deepEqual([...TITLE_EDGE.gatebreaker], [0, 0, 0, 1], 'its ember end bright - edged in black');
});

// ── THE WORLD HOST ──────────────────────────────────────────────────

test('WB9g the world host, by source: the auras gathered with the peers each frame (mine off the stored session, a concealed peer\'s concealed, none under the travel view) and drawn after each mode\'s opaque world through the veiled bodies\' hook under the frame\'s own camera - a foreign pass; the Broker\'s sale both halves through the sale\'s one law (AUDIT WB9); a wear the service\'s, told to my own name and feet at once; the window handed its doors (mutants: the auras never gathered; never drawn)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /auraFrame\(seen\);   \/\/ WB9g/);
  assert.match(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); drawAuras\(\); nodeGlowPass\.draw\(travelView\?\.active \? null : nodeMarksAt\(enchantFeet\(\)\)\); \};/);   // NODE-MARKS: the nodes' glow rides the hook after the auras
  assert.match(w, /function auraFrame\(seen\) \{\n    _auraWearers\.length = 0;\n    if \(!online \|\| travelView\?\.active\) return;/);
  assert.match(w, /const mine = ownAura\(\);/);
  assert.match(w, /if \(_veils\.has\(d\.id\) \|\| !d\.shown\) continue;   \/\/ a concealed peer's fire is concealed with them/);
  assert.match(w, /const proj = renderer\._proj, view = renderer\._view, eye = renderer\._camPos;/);
  assert.match(w, /if \(_auraPass\?\.drawn\) renderer\.markForeignPass\(\);/);
  assert.match(w, /_auraWearers\.length = 0;   \/\/ this frame's, drawn once: a frame that gathers none \(the seat left, death, offline\) draws none/, 'a frame that gathers none draws none');
  assert.match(w, /peerRiders\.settle\([^\n]*\n    auraFrame\(seen\);   \/\/ WB9g/, 'gathered once the bodies and the riders have stood');
  assert.match(w, /try \{ _auraPass = new AuraRingRenderer\(renderer\.gl\); \} catch \(e\) \{ console\.warn\('\[online\] the aura would not build'/, 'a fire that will not build costs the fire, never the game');
  const buy = w.slice(w.indexOf('async function insigniaBuy(offer) {'), w.indexOf('async function insigniaWear(offer) {'));
  // AUDIT WB9 (insignia F1, F2): both halves through the sale's one law (systems/sigilBroker.js insigniaSale, driven in
  // the audit's pins below) - the pack's price held first, given back unless the service holds the sale, a lost answer
  // asked after, a held sale saved at once
  assert.match(buy, /const r = await insigniaSale\(offer, \{\n        items: playerEntity\.items, buy: \(id\) => buyInsignia\(io, id\), save: \(\) => saveSoon\.changed\(\),/);
  assert.match(buy, /held: async \(id\) => \{ const a = await readAccount\(io\); const w = a\.ok \? a\.data\?\.wardrobe : null; return Array\.isArray\(w\?\.insignia\) && w\.insignia\.includes\(id\) \? w : null; \},/);
  assert.ok(!/spendStones/.test(buy), 'the pack paid through the sale alone, never beside it');
  assert.ok(buy.indexOf('if (!r.ok) return') > buy.indexOf('await insigniaSale('), 'a refused sale adopts nothing');
  const wear = w.slice(w.indexOf('async function insigniaWear(offer) {'), w.indexOf('const openBroker = () => {'));
  assert.match(wear, /offer\.kind === 'title' \? await equipTitle\(io, want\) : await equipAura\(io, want\)/);
  assert.match(wear, /insigniaSelf\(r\.data, io\.secret\);/);
  assert.match(w, /online\?\.adoptIdentity\?\.\(\{ title: _insignia\.title, glyphs: online\.glyphs, level: online\.lv, aura: _insignia\.aura \}\);/);
  assert.match(w, /adoptSessionIdentity\(appStorage\(\), \{ glyphs: answer\?\.glyphs, glyphsOff: answer\?\.glyphsOff, aura: _insignia\.aura, secret \}\);/);
  assert.match(w, /insignia: insigniaRows, insigniaLoad, buyInsignia: insigniaBuy, wearInsignia: insigniaWear, insigniaBusy: \(\) => _insignia\.busy,/);
  // the service's side: the routes behind the door, the version moved, the deploy watching the law
  const svc = rd('server-account/src/service.js');
  assert.match(svc, /'\/v1\/account\/insignia', '\/v1\/account\/aura',/);
  assert.match(rd('.github/workflows/account-deploy.yml'), /- "src\/net\/insignia\.js"/, 'the Worker bundles the law - a change to it deploys');
  assert.match(rd('server-account/migrations/0040_insignia.sql'), /ALTER TABLE players ADD COLUMN insignia TEXT;\nALTER TABLE players ADD COLUMN insignia_spent INTEGER NOT NULL DEFAULT 0;\nALTER TABLE players ADD COLUMN aura TEXT;/);
});

// ── AUDIT WB9 (2026-09-30, before the merge): the insignia's findings ──

test('AUDIT WB9 insignia F1/F2 - the sale\'s two halves (systems/sigilBroker.js insigniaSale): the pack\'s price taken BEFORE the service is asked, so a ware bought meanwhile cannot leave it untaken (35 stones bought the title AND a 12-stone Regalia); a sale the service holds saved at once (a page closed before the next checkpoint kept the stones as well); the service\'s refusal gives the stones back; a lost answer (unreached, a 5xx) asked after - held, it is the sale; not held, or not heard either, the stones back; a short pack asks nothing (mutants: the stones never given back; a lost answer taken for a refusal; a 5xx taken for a refusal; the sale never saved; the price never held)', async () => {
  const OFFER = INSIGNIA[0];
  const count = (pack) => stoneCount(spendableStonesIn(pack));
  let saved = 0;
  const save = () => { saved++; };
  // held: the price gone before the service answers, and saved once it holds the sale
  let pack = [stack(20), stack(15)], seen = null;
  let r = await insigniaSale(OFFER, { items: pack, save, held: async () => null, buy: async (id) => { seen = count(pack); return { ok: true, data: { insignia: [id] } }; } });
  assert.deepEqual([r.ok, r.data.insignia, seen, count(pack), saved], [true, ['title:gatebreaker'], 5, 5, 1]);
  // F2: a Regalia bought while the service is asked - the title's price is already out of the pack
  const day = 20_000, regalia = brokerStock(day).find((o) => o.price === 12);
  assert.ok(regalia, 'the day\'s stock sells a piece at 12');
  pack = [stack(35)];
  let ware = null;
  r = await insigniaSale(OFFER, { items: pack, save, held: async () => null, buy: async (id) => { ware = makeBrokerSale(regalia, { items: pack, day }); return { ok: true, data: { insignia: [id] } }; } });
  assert.deepEqual([r.ok, ware.ok, ware.reason, count(pack)], [true, false, 'stones', 5], 'thirty-five stones do not buy the title and the Regalia');
  // the service's own refusal (a 4xx): the stones back, nothing saved, the lost answer's question never asked
  for (const refused of [{ ok: false, error: 'short', status: 409 }, { ok: false, error: 'owned', status: 409 }, { ok: false, error: 'guest', status: 403 }]) {
    pack = [stack(20), stack(15)]; saved = 0;
    r = await insigniaSale(OFFER, { items: pack, save, held: async () => { throw new Error('asked'); }, buy: async () => refused });
    assert.deepEqual([r, count(pack), saved], [{ ok: false, error: refused.error }, 35, 0], refused.error);
  }
  // the answer lost, the sale written all the same: asked after, held - the sale, saved
  for (const lost of [{ ok: false, error: 'offline' }, { ok: false, error: 'server', status: 502 }, { ok: false, error: 'internal', status: 500 }]) {
    pack = [stack(35)]; saved = 0;
    r = await insigniaSale(OFFER, { items: pack, save, held: async (id) => ({ insignia: [id] }), buy: async () => lost });
    assert.deepEqual([r.ok, r.data?.insignia, count(pack), saved], [true, ['title:gatebreaker'], 5, 1], `${lost.error}: held - the sale`);
  }
  // lost and not held, or not heard either (and a throw is a lost answer): the stones back
  for (const held of [async () => null, async () => { throw new Error('offline'); }]) {
    pack = [stack(35)]; saved = 0;
    r = await insigniaSale(OFFER, { items: pack, save, held, buy: async () => { throw new Error('reset'); } });
    assert.deepEqual([r, count(pack), saved], [{ ok: false, error: 'offline' }, 35, 0]);
  }
  // a pack short of the price: the service never asked
  pack = [stack(29)];
  let asked = 0;
  r = await insigniaSale(OFFER, { items: pack, save, held: async () => null, buy: async () => { asked++; return { ok: true }; } });
  assert.deepEqual([r, asked, count(pack)], [{ ok: false, error: 'stones' }, 0, 29]);
  assert.deepEqual([{ ok: false, error: 'offline' }, { ok: false, status: 500 }, { ok: false, status: 503 }, { ok: false, error: 'short', status: 409 }, { ok: false, status: 429 }, { ok: true, status: 200 }].map(insigniaUnheard), [true, true, true, false, false, false]);
});

test('AUDIT WB9 insignia F2 - the Broker\'s window: a ware\'s Buy is not pressable while a piece of the insignia is being bought, and pressable again once the account answers (mutants: the wares pressable mid-sale)', async () => {
  await withDomAsync(async () => {
    const day = 20_000, stock = brokerStock(day);
    const rows = [{ id: 'title:gatebreaker', kind: 'title', key: 'gatebreaker', price: 30, name: 'Gatebreaker', owned: false, worn: false }];
    const purse = [stack(64)];
    let answer = null, sold = 0;
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => stock, day: () => day, now: () => 0, items: () => purse, bought: () => [], picture: () => null, wearer: null, nameOf: (it) => it.name,
      buy: () => { sold++; return { ok: true }; }, insignia: () => rows, insigniaBusy: () => false,
      buyInsignia: () => new Promise((res) => { answer = res; }), wearInsignia: async () => ({ ok: true }),
    });
    try {
      await settle();
      const shell = one(host, 'broker-shell');
      const wares = () => kids(shell, 'broker-offer').filter((r) => !r.classList.contains('broker-insig'));
      const buyOf = (r) => one(r, 'broker-buy');
      assert.ok(wares().length > 0 && wares().every((r) => buyOf(r).attrs.disabled === undefined), 'sixty-four stones: every ware pressable');
      buyOf(kids(shell, 'broker-insig')[0]).onclick({ stopPropagation() {} });
      await settle();
      assert.ok(wares().every((r) => buyOf(r).attrs.disabled === ''), 'the title in flight: no ware pressable');
      buyOf(wares()[0]).onclick({ stopPropagation() {} });
      assert.equal(sold, 0, 'nor sold by a press that reaches it');
      answer({ ok: true, text: 'Bought.' });
      await settle(); await settle();
      assert.ok(wares().every((r) => buyOf(r).attrs.disabled === undefined), 'answered: the wares pressable again');
    } finally { view.unmount(); }
  });
});

test('AUDIT WB9 insignia F3 - the service\'s sale of two pieces at once, each request having read the row before either wrote (the interleaving real D1 allows): both sales held - the id APPENDED to the column the UPDATE matched, never the column read before written over it - and each price spent once; a third refused owned; the same piece twice from rows read before either wrote, the second refused by the UPDATE\'s own test (mutants: the column written from the row read before; the update sells an owned piece)', async () => {
  const { env, registered } = await standService();
  const me = await registered('Racer');
  closeGates(env, me, 100);
  const ctx = { db: env.DB, nowS: T0 };
  const readRow = () => env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(me.id).first();
  const [pA, pB] = [await readRow(), await readRow()];
  const a = await serviceBuyInsignia(ctx, pA, env, 'title:gatebreaker');
  const b = await serviceBuyInsignia(ctx, pB, env, 'aura:dagonfire');
  assert.deepEqual([a.ok, b.ok], [true, true]);
  assert.deepEqual(b.insignia, ['title:gatebreaker', 'aura:dagonfire'], 'the second sale\'s answer holds both');
  const row = env.DB._raw.prepare('SELECT insignia, insignia_spent FROM players WHERE id = ?').get(me.id);
  assert.deepEqual({ ...row }, { insignia: 'title:gatebreaker aura:dagonfire', insignia_spent: 80 }, 'both held, each paid for once - the column the law\'s own shape (insigniaWith)');
  assert.equal(row.insignia, insigniaWith(insigniaWith(null, 'title:gatebreaker'), 'aura:dagonfire'));
  const c = await serviceBuyInsignia(ctx, await readRow(), env, 'title:gatebreaker');
  assert.equal(c.error, 'owned');
  assert.equal(env.DB._raw.prepare('SELECT insignia_spent AS s FROM players WHERE id = ?').get(me.id).s, 80);
  // the SAME piece twice, each request having read the row before either wrote: the UPDATE's own test refuses the second
  const you = await registered('Twin');
  closeGates(env, you, 100);
  const youRow = () => env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(you.id).first();
  const [qA, qB] = [await youRow(), await youRow()];
  assert.equal((await serviceBuyInsignia(ctx, qA, env, 'title:gatebreaker')).ok, true);
  assert.equal((await serviceBuyInsignia(ctx, qB, env, 'title:gatebreaker')).error, 'owned', 'the second refused by the UPDATE itself - its row read before the first wrote');
  assert.deepEqual({ ...env.DB._raw.prepare('SELECT insignia, insignia_spent FROM players WHERE id = ?').get(you.id) }, { insignia: 'title:gatebreaker', insignia_spent: 30 }, 'held once, paid once');
});
