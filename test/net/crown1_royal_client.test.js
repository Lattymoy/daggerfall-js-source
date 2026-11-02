// CROWN1 part two, the client (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): A ROYAL TOURNEY AS THIS
// CLIENT FIGHTS IT - the fold and the HUD's words (net/royalLink.js), the session (net/royalSession.js: the pass and its
// ring, the room, the card's Challenge as a challenge or an accept, the bout's one foe, the ring kept, the receipts),
// the ring from the town (systems/siegeField.js royalRingWire), the bouts' carrier (net/siege/siegeClaims.js createRoyalClaims),
// the socket's royal room (net/online.js), the Seat tab's doors (ui/seatTab.js) and the world's wiring.
// bible/11-Multiplayer/Seats-Arc.md 7.6; `06-Systems/Online-Arc.md` CROWN1 (part two, the client).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { foldRoyal, royalHudModel, royalAskStands, ROYAL_STATE_EMPTY, ROYAL_HUD_ROWS, ROYAL_LAST_SHOWN_MS } from '../../src/net/royalLink.js';
import { createRoyalSession, ROYAL_SESSION_TEXT, ROYAL_PASS_RETRY_MS } from '../../src/net/royalSession.js';
import { createRoyalClaims, royalClaimSettles, ROYAL_CLAIMS_KEY, ROYAL_CLAIMS_MAX } from '../../src/net/siege/siegeClaims.js';
import { royalRingWire, siegeWorldPoint, SIEGE_FIELD } from '../../src/systems/siegeField.js';
import { royalRoomKey, ROYAL_RING } from '../../src/net/siege/siegeRef.js';
import { mintRoyalReceipt } from '../../src/net/siege/siegeReceipt.js';
import { OnlineSession } from '../../src/net/online.js';
import { royalTourneyLines } from '../../src/net/townSeatLaw.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const AT = 1_800_000_000_000;
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const RING = [[23_600_000, 5_000_000]];
const pose = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0 });

test('CROWN1 THE ROYAL FOLD: the roll call, a vitality, a fall; a bout told (its two\'s challenges spent) and its end; the ladder; a challenge at me standing thirty seconds (mutants: each kind; the spent asks; the ask\'s life)', () => {
  let s = foldRoyal(ROYAL_STATE_EMPTY, { k: 'st', f: [['p1', 320, 320, 0], ['p2', 300, 320, 0]] }, 10);
  assert.deepEqual(s.roll, { p1: { hp: 320, max: 320, down: false }, p2: { hp: 300, max: 320, down: false } });
  s = foldRoyal(s, { k: 'hp', id: 'p2', h: 0, m: 320 }, 11);
  assert.equal(s.roll.p2.down, true);
  s = foldRoyal(s, { k: 'fell', id: 'p1', by: 'p2' }, 12);
  assert.deepEqual(s.roll.p1, { hp: 0, max: 320, down: true });
  s = foldRoyal(s, { k: 'ask', id: 'p2' }, 1000);
  s = foldRoyal(s, { k: 'ask', id: 'p3' }, 1000);
  assert.deepEqual([royalAskStands(s, 'p2', 1000 + ROYAL_RING.askMs), royalAskStands(s, 'p2', 1001 + ROYAL_RING.askMs), royalAskStands(s, 'p9', 1000)], [true, false, false]);
  s = foldRoyal(s, { k: 'bout', a: 'p1', b: 'p2', n: 4, s: 5000, e: 9000 }, 2000);
  assert.deepEqual(s.bout, { a: 'p1', b: 'p2', n: 4, s: 5000, e: 9000 });
  assert.deepEqual(Object.keys(s.asks), ['p3'], 'the bout\'s two\'s challenges spent');
  s = foldRoyal(s, { k: 'bend', n: 3, w: 'p1', l: 'p2', c: 1 }, 2100);
  assert.ok(s.bout, 'another bout\'s end leaves this one');
  s = foldRoyal(s, { k: 'bend', n: 4, w: 'p1', l: 'p2', c: 1 }, 2200);
  assert.deepEqual([s.bout, s.last], [null, { n: 4, w: 'p1', l: 'p2', c: 1, at: 2200 }]);
  s = foldRoyal(s, { k: 'lad', l: [['p1', 2, 0]] }, 2300);
  assert.deepEqual(s.ladder, [['p1', 2, 0]]);
  s = foldRoyal(s, { k: 'no', m: 'the ring is taken' }, 2400);
  assert.equal(s.no, 'the ring is taken');
  assert.equal(foldRoyal(s, null, 1), s);
  assert.equal(foldRoyal(ROYAL_STATE_EMPTY, { k: 'st', f: [['p9', 0, 320, 1]] }, 1).roll.p9.down, true, 'the roll call says who is down');
  assert.equal(foldRoyal(s, { k: 'f' }, 1), s, 'a siege\'s word is not the tourney\'s');
});

test('CROWN1 THE ROYAL HUD\'S WORDS: the tourney, its prize and its end; the ring empty, a bout\'s countdown, a bout\'s clock; the ladder\'s first five; my vitality in a bout, my record, a challenge at me, my bout\'s end and whether it counted; a spectator\'s (mutants: each line)', () => {
  const name = (id) => ({ p2: 'Bryn', p3: 'Cade' })[id] ?? '';
  const t = { seat: 'Wayrest', prize: 5000, endsMs: AT + 2 * 86_400_000 + 3 * 3_600_000 };
  let s = ROYAL_STATE_EMPTY;
  let m = royalHudModel(s, t, 'p1', AT, { name });
  assert.deepEqual(m.bar, ['THE ROYAL TOURNEY OF WAYREST   prize 5,000 silver   ends in 2d 3h', 'The ring is empty. Challenge a contender from their card.']);
  assert.equal(m.sides, 'No bout has been won yet.');
  assert.deepEqual(m.self, ['You have no bout won yet.']);
  assert.equal(m.card, null);
  assert.equal(royalHudModel(s, { ...t, endsMs: AT + 5 * 3_600_000 + 7 * 60_000 }, 'p1', AT, { name }).bar[0].endsWith('ends in 5h 7m'), true);
  assert.equal(royalHudModel(s, { ...t, endsMs: AT + 30 * 3_600_000 }, 'p1', AT, { name }).bar[0].endsWith('ends in 1d 6h'), true, 'a day and more in days');
  s = foldRoyal(s, { k: 'st', f: [['p1', 320, 320, 0], ['p2', 320, 320, 0], ['p3', 320, 320, 0]] }, AT);
  s = foldRoyal(s, { k: 'bout', a: 'p1', b: 'p2', n: 3, s: AT + 2500, e: AT + 302_500 }, AT);
  assert.equal(royalHudModel(s, t, 'p1', AT, { name }).bar[1], 'BOUT 3: You against Bryn - begins in 3');
  s = foldRoyal(s, { k: 'hp', id: 'p1', h: 160, m: 320 }, AT + 3000);
  m = royalHudModel(s, t, 'p1', AT + 62_500, { name });
  assert.equal(m.bar[1], 'BOUT 3: You against Bryn   4:00');
  assert.equal(m.self[0], 'vitality  |||||.....  160 / 320');
  assert.equal(royalHudModel(s, t, 'p3', AT + 62_500, { name }).self.some((l) => l.startsWith('vitality')), false, 'not mine: no vitality');
  s = foldRoyal(s, { k: 'lad', l: [['p1', 3, 1], ['p2', 1, 1], ['', 1, 0], ['p3', 0, 2], ['p4', 0, 1], ['p5', 0, 1]] }, AT);
  m = royalHudModel(s, t, 'p1', AT, { name });
  assert.equal(m.sides, '1. You 3-1   2. Bryn 1-1   3. someone gone 1-0   4. Cade 0-2   5. a contender 0-1');
  assert.equal(ROYAL_HUD_ROWS, 5);
  assert.ok(m.self.includes('You: 3 wins, 1 loss'));
  s = foldRoyal(s, { k: 'ask', id: 'p3' }, AT);
  assert.ok(royalHudModel(s, t, 'p1', AT + 1000, { name }).self.includes('Cade challenges you. Challenge them back from their card to accept.'));
  assert.ok(!royalHudModel(s, t, 'p1', AT + ROYAL_RING.askMs + 1, { name }).self.some((l) => l.includes('challenges you')), 'lapsed');
  s = foldRoyal(s, { k: 'bend', n: 3, w: 'p1', l: 'p2', c: 0 }, AT + 5000);
  assert.ok(royalHudModel(s, t, 'p1', AT + 5000, { name }).self.includes('You won the bout, but you two have met 3 times today, so it does not count on the ladder.'));
  assert.ok(royalHudModel(s, t, 'p2', AT + 5000, { name }).self.includes('You lost the bout.'));
  assert.ok(royalHudModel(s, t, 'p1', AT + 4999 + ROYAL_LAST_SHOWN_MS, { name }).self.some((l) => l.startsWith('You won the bout')));
  assert.ok(!royalHudModel(s, t, 'p1', AT + 5000 + ROYAL_LAST_SHOWN_MS, { name }).self.some((l) => l.startsWith('You won the bout')), 'said ten seconds');
  s = foldRoyal(s, { k: 'bend', n: 4, w: 'p1', l: 'p2', c: 1 }, AT + 9000);
  assert.ok(royalHudModel(s, t, 'p1', AT + 9000, { name }).self.includes('You won the bout.'));
  assert.deepEqual(royalHudModel(s, t, 'p1', AT, { name, watching: true }).self, ['Watching the Royal Tourney']);
});

test('CROWN1 THE RING FROM THE TOWN: a crown\'s Palace square - its field\'s fourth banner - as one world point; none for a palace\'s field (mutants: the banner; the tier)', () => {
  const f = { banners: [[1, 2], [3, 4], [5, 6], [7, 8 + SIEGE_FIELD.squareM]], throne: [0, 0], camps: { attack: [0, 0], defend: [0, 0] } };
  assert.deepEqual(royalRingWire(590, 166, f), [siegeWorldPoint(590, 166, [7, 8 + SIEGE_FIELD.squareM])]);
  assert.equal(royalRingWire(590, 166, { ...f, banners: f.banners.slice(0, 3) }), null);
  assert.equal(royalRingWire(590, 166, null), null);
});

test('CROWN1 THE SESSION: not in the city, an old relay; the ring unsettled asked again; a pass joins the tourney\'s room and mints for every hello; `in` said on an open socket; a challenge said; the card\'s Challenge challenges - or accepts one standing at me; a spectator challenges no one; in a bout its one foe and its ring; my blow on it alone; a mark moves me; a won bout\'s receipt kept and offered; the week\'s end leaves (mutants: each)', async () => {
  let now = AT;
  const sent = [], said = [], moved = [], kept = [];
  const online = { id: 'p1', room: '', status: 'closed', mintSiegePass: null, sendSiege: (f) => { sent.push(f); return true; } };
  const answers = [];
  const pass = async (seat, field, watch) => { answers.push([seat.key, field, watch]); return answers.length === 1 ? { ok: false, error: 'ring-unsettled', text: 'waiting' } : { ok: true, pass: 'v1.p.s', side: watch ? 'watch' : 'duel', week: 20, startsAt: AT / 1000 - 3600, endsAt: AT / 1000 + 86400 }; };
  const claims = { keep: (r) => { kept.push(r); return true; }, offer: () => kept.push('offer') };
  let hudModel = null;
  const hud = { update: (m) => { hudModel = m; }, hide: () => { hudModel = 'hidden'; } };
  const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const name = (id) => ({ p2: 'Bryn', p3: 'Cade' })[id] ?? '';
  let relay = false;
  const rs = createRoyalSession({ online, pass, claims, hud, nowMs: () => now, movePlayer: (p) => moved.push(p), say: (t) => said.push(t), relayOk: () => relay, name });
  assert.equal(rs.enter(WAYREST, { prize: 5000 }, RING), false);
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.old);
  relay = true;
  assert.equal(rs.enter(WAYREST, { prize: 5000 }, null), false);
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.notHere('Wayrest'));
  assert.equal(rs.enter(WAYREST, { prize: 5000 }, RING), true);
  await settle();
  assert.deepEqual(answers[0], [5023, RING, false]);
  assert.equal(said.at(-1), 'waiting');
  assert.equal(rs.room(), null);
  rs.tick(); await settle();
  assert.equal(answers.length, 1, 'not before its wait');
  now += ROYAL_PASS_RETRY_MS;
  rs.tick(); await settle();
  assert.equal(rs.room(), royalRoomKey(5023, 20));
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.entered('duel'));
  assert.equal(await online.mintSiegePass(), 'v1.p.s', 'a fresh pass for every hello');
  rs.tick();
  assert.equal(sent.length, 0, 'not before the room is open');
  online.room = rs.room(); online.status = 'open';
  rs.tick();
  assert.deepEqual(sent.at(-1), { k: 'in' });
  rs.tick();
  assert.equal(sent.filter((f) => f.k === 'in').length, 1, 'once');
  assert.equal(hudModel.bar[0].startsWith('THE ROYAL TOURNEY OF WAYREST'), true);
  // a challenge at me, and the card's Challenge as its accept; another's Challenge as a challenge
  rs.onSiege({ k: 'ask', id: 'p2' }, rs.room());
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.asked('Bryn'));
  rs.onSiege({ k: 'ask', id: 'p3' }, 'cell:1:2');
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.asked('Bryn'), 'another room\'s word reaches nothing');
  assert.equal(rs.challenge('p2'), true);
  assert.deepEqual(sent.at(-1), { k: 'yes', to: 'p2' });
  assert.equal(rs.challenge('p3'), true);
  assert.deepEqual(sent.at(-1), { k: 'ask', to: 'p3' });
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.sent('Cade'));
  assert.equal(rs.challenge('p1'), false, 'never myself');
  now += ROYAL_RING.askMs + 1;
  rs.challenge('p2');
  assert.deepEqual(sent.at(-1), { k: 'ask', to: 'p2' }, 'a lapsed challenge: mine is a challenge');
  // a bout: its marks, its one foe after the countdown, the ring
  rs.onSiege({ k: 'back', p: pose(10, 20) }, rs.room());
  assert.deepEqual(moved.at(-1), pose(10, 20));
  rs.onSiege({ k: 'bout', a: 'p2', b: 'p1', n: 5, s: now + 3000, e: now + 303_000 }, rs.room());
  assert.deepEqual(rs.foes(), [], 'the countdown');
  assert.deepEqual(rs.ring(), { centre: RING[0], radius: ROYAL_RING.radiusM }, 'held to the ring from the countdown');
  now += 3000;
  assert.deepEqual(rs.foes(), ['p2']);
  assert.equal(rs.blow('p3', { w: 123, m: 9, d: 40, r: 0 }), false, 'never another');
  assert.equal(rs.blow('p2', { w: 123, m: 9, d: 40, r: 0 }), true);
  assert.deepEqual(sent.at(-1), { k: 'blow', to: 'p2', w: 123, m: 9, d: 40, r: 0 });
  // another's bout: no foe of mine, no ring of mine
  const mine = rs.state.bout;
  rs.onSiege({ k: 'bend', n: 5, w: '', l: '', c: 0 }, rs.room());
  rs.onSiege({ k: 'bout', a: 'p2', b: 'p3', n: 6, s: now - 1, e: now + 300_000 }, rs.room());
  assert.deepEqual([rs.foes(), rs.ring()], [[], null], 'their bout');
  rs.onSiege({ k: 'bend', n: 6, w: '', l: '', c: 0 }, rs.room());
  rs.onSiege({ k: 'bout', ...mine }, rs.room());
  // a bout won: the receipt kept and offered
  const rc = await mintRoyalReceipt({ s: 'acct-p1', l: 'acct-p2', sk: 5023, sw: 20, n: 5 }, (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey, { subtle, nowS: Math.floor(now / 1000) });
  rs.onSiege({ k: 'bend', n: 5, w: 'p1', l: 'p2', c: 1 }, rs.room());
  rs.onSiege({ k: 'won', rc }, rs.room());
  assert.deepEqual(kept, [rc, 'offer']);
  rs.onSiege({ k: 'won', rc: 't1.junk.' }, rs.room());
  assert.equal(kept.length, 2, 'a receipt that is no receipt is not kept');
  assert.equal(rs.ring(), null);
  assert.deepEqual(rs.foes(), []);
  rs.onSiege({ k: 'no', m: 'the ring is taken' }, rs.room());
  assert.equal(said.at(-1), 'the ring is taken');
  assert.equal(rs.ringCentre(), RING[0]);
  // the week's end
  now = AT + 86_400_000;
  rs.tick();
  assert.equal(rs.active(), false);
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.left);
  assert.equal(hudModel, 'hidden');
  assert.equal(online.mintSiegePass, null);
  // a spectator
  const eye = createRoyalSession({ online, pass: async (seat, field, watch) => ({ ok: true, side: watch ? 'watch' : 'duel', week: 20, endsAt: AT / 1000 + 86400 }), relayOk: () => true, say: () => {} });
  eye.enter(WAYREST, { prize: 5000 }, RING, { watch: true });
  await settle();
  assert.equal(eye.side(), 'watch');
  assert.equal(eye.challenge('p2'), false, 'a spectator challenges no one');
  // a refusal leaves
  const no = createRoyalSession({ online, pass: async () => ({ ok: false, error: 'royal-none', text: 'none here' }), relayOk: () => true, say: (t) => said.push(t) });
  no.enter(WAYREST, {}, RING);
  await settle();
  assert.equal(no.active(), false);
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.refused('none here'));
});

test('CROWN1 THE BOUTS CARRIED: the siege\'s carrier over `t1` receipts in a store of their own - kept, offered, settled by a count, the tourney gone or over, a receipt not the relay\'s; kept for the rest (mutants: the store; the reader; the answers)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(AT / 1000);
  const rc = (n) => mintRoyalReceipt({ s: 'acct-me', l: 'acct-them', sk: 5023, sw: 20, n }, kp.privateKey, { subtle, nowS });
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const answers = [{ ok: true, counted: true }, { ok: false, error: 'royal-over' }, { ok: false, error: 'offline' }];
  const asked = [];
  const c = createRoyalClaims({ claim: async (r) => { asked.push(r); return answers.shift(); }, me: () => 'acct-me', nowMs: () => AT, storage });
  const [a, b, d] = [await rc(1), await rc(2), await rc(3)];
  for (const r of [a, b, d]) assert.equal(c.keep(r), true);
  assert.equal(c.keep(a), false, 'once');
  assert.ok(store.has(ROYAL_CLAIMS_KEY));
  assert.equal(await c.offer({ force: true }), 2);
  assert.deepEqual(c.list(), [d], 'the network\'s failure keeps it');
  assert.deepEqual([royalClaimSettles({ ok: true }), royalClaimSettles({ error: 'royal-none' }), royalClaimSettles({ error: 'royal-over' }), royalClaimSettles({ error: 'receipt', why: 'signature' }), royalClaimSettles({ error: 'receipt' }), royalClaimSettles({ error: 'not-yours' })],
    [true, true, true, false, true, false]);
  assert.deepEqual([ROYAL_CLAIMS_MAX, ROYAL_CLAIMS_KEY], [40, 'crown1.royalClaims'], 'a store of its own, never the siege\'s');
  const again = createRoyalClaims({ claim: async () => ({ ok: true }), me: () => 'acct-me', nowMs: () => AT, storage });
  assert.deepEqual(again.list(), [d], 'read back from its own store');
  const s1 = 's1.eyJ.abc';
  assert.equal(again.keep(s1), false, 'a siege\'s receipt is not a bout\'s');
});

test('CROWN1 THE SOCKET\'S ROYAL ROOM: its hello carries a fresh pass; its words reach the tourney; my words leave only at a relay that keeps Royal Tourneys (mutants: the room; the relay\'s floor)', async () => {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => AT });
  o.mintSiegePass = async (room) => `v1.royal.${room.length}`;
  const heard = [];
  o.onSiege = (g, room) => heard.push([g.k, room]);
  const room = royalRoomKey(5023, 20);
  o.join(room, pose(0, 0));
  const ws = sockets.at(-1);
  ws.open(); await settle();
  assert.equal(ws.sent[0].sp, `v1.royal.${room.length}`);
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null, now: AT, v: 'world147' });
  assert.deepEqual([o.siegeOk, o.royalOk], [true, false]);
  assert.equal(o.sendSiege({ k: 'in' }), false, 'a relay that fights sieges but keeps no Royal Tourney');
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null, now: AT, v: 'world149' });
  assert.equal(o.royalOk, true);
  assert.equal(o.sendSiege({ k: 'ask', to: 'peer-0002' }), true);
  assert.deepEqual(ws.sent.at(-1), { t: 'siege', k: 'ask', to: 'peer-0002' });
  ws.receive({ t: 'siege', k: 'lad', l: [['peer-0002', 1, 0]] });
  assert.deepEqual(heard, [['lad', room]]);
});

test('CROWN1 THE SEAT TAB\'S DOORS: a crown\'s Royal Tourney said - its prize, its ladder - with a door to contend and one to watch, each through the world\'s hook; and the world\'s wiring by source (mutants: the lines; the doors; the watch flag; the hook)', async () => {
  assert.deepEqual(royalTourneyLines(null), []);
  assert.deepEqual(royalTourneyLines({ prize: 5000, ladder: [] }).slice(1), ['No bout has been won yet.']);
  assert.deepEqual(royalTourneyLines({ prize: 5000, ladder: [{ name: 'Arden', wins: 4, losses: 1 }, { name: '', wins: 1, losses: 0 }] }),
    ['A Royal Tourney is proclaimed: a duel ladder all week at the castle\'s square, every blow refereed. The week\'s champion takes 5,000 silver and the title for good.', '1. Arden - 4 won, 1 lost', '2. Someone - 1 won, 0 lost']);
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const royal = { prize: 5000, startsAt: now - 3600, endsAt: now + 86400, ladder: [{ name: 'Arden', wins: 2, losses: 0 }] };
  const data = { seat: WAYREST, week: 16, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: 0, holder: null, battle: null, standings: [], chronicle: [], royal };
  const entered = [];
  const host = document.createElement('div');
  const seatBook = { open: true, standings: async () => ({ data, error: null }), pledge: async () => ({ ok: true }), unpledge: async () => ({ ok: true }), tribute: async () => ({ ok: true }) };
  const v = mountNoticeBoard(host, { town: { name: 'Wayrest', mapId: 5023 }, book: noticeBook, nowS: () => now, seat: { seat: WAYREST, book: seatBook }, seatRoyal: (seat, r, watch) => { entered.push([seat.key, r.prize, watch]); return true; } });
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  assert.match(host.textContent, /A Royal Tourney is proclaimed/);
  assert.match(host.textContent, /1\. Arden - 2 won, 0 lost/);
  byClass(host, 'notice-seat-royal-enter')[0].click();
  await tick();
  byClass(host, 'notice-seat-royal-watch')[0].click();
  await tick();
  assert.deepEqual(entered, [[5023, 5000, false], [5023, 5000, true]]);
  v.unmount();
  // the world: the door, the session, the room, the card's Challenge, the arm, the ring, the beat
  const w = rd('src/scenes/world.js');
  assert.match(w, /seatRoyal: \(st, r, w\) => royalEnter\(st, r, w\)/);
  assert.match(w, /field = royalRingWire\(t\.px, t\.py, t\.field\)/);
  assert.match(w, /online\.onSiege = \(g, room\) => \{ siegeSession\?\.onSiege\(g, room\); royalSession\?\.onSiege\(g, room\); \};/);
  assert.match(w, /key = siegeSession\?\.room\(\) \?\? royalSession\?\.room\(\) \?\? roomKeyFor/);
  assert.match(w, /if \(royalSession\?\.active\(\)\) \{ if \(!royalSession\.challenge\(peerId\)\)/);
  // PIN MOVED (AUDIT SEATS-3 F5): each arm's own - the line stands in both
  assert.match(w, /const battle = royalSession\?\.active\(\) \? royalSession : siegeSession;   \/\/ CROWN1 part two/);
  assert.match(w, /const battle = royalSession\?\.active\(\) \? royalSession : siegeSession;\n\s*if \(!to \|\| !battle\?\.active\(\)/);
  assert.match(w, /if \(royalRing\) player\.arena = \{ centre: campToScene/);
  assert.match(w, /const rc = royalSession\?\.ringCentre\(\);/);
  assert.match(w, /royalSession\?\.tick\(\);/);
  assert.match(w, /relayOk: \(\) => online\.royalOk/);
});
