// CROWN2 (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): FEALTY AND PACTS AS THE GAME SHOWS THEM - the
// Seat tab's rows for a guild's liege, vassals, Pacts and the offers standing, and an Officer's levers on each; the seat
// book's calls down their own paths and its words; the server's red lines off the seats' list, said once a device, and
// read again on their own clock; the world's wiring (bible/11-Multiplayer/Seats-Arc.md 7.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { politicsRows, POLITICS_ACTS, pactBrokenText, seatBattleLine, battleAnnouncement } from '../src/net/townSeatLaw.js';
import { createTownSeatBook, SEAT_RED_SEEN_KEY, SEAT_RED_SEEN_MAX, SEAT_RED_READ_MS } from '../src/net/townSeatBook.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';

const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' }, DG = { name: 'Daggers', tag: 'DG' };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });

test('CROWN2 THE POLITICS\' ROWS: sworn either way with its break; a fealty breaking ends at the Turning, no lever; an offer this guild made withdrawn, one made to it accepted; a Pact signed (its week, its warning) broken, offered withdrawn or signed; a name opening a sentence capitalised, the red line\'s too (mutants: each state; each side; each act; the tag; the capital)', () => {
  const f = (state, asVassal, mine = false) => ({ vassal: asVassal ? DG : SH, liege: asVassal ? SH : DG, state, mine, asVassal });
  assert.deepEqual(politicsRows({ fealty: [f('sworn', true)] }), [{ text: 'Your guild is sworn to the Silver Hand <SH>.', act: 'fealty-break', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ fealty: [f('sworn', false)] }), [{ text: 'The Silver Hand <SH> is sworn to your guild.', act: 'fealty-break', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ fealty: [f('breaking', true)] }), [{ text: 'The fealty between Daggers <DG> and the Silver Hand <SH> ends at the Turning.', act: null, tag: 'SH' }]);
  assert.deepEqual(politicsRows({ fealty: [f('offered', true, true)] }), [{ text: 'Your guild offers to swear fealty to the Silver Hand <SH>.', act: 'fealty-withdraw', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ fealty: [f('offered', false, true)] }), [{ text: 'Your guild offers to take the Silver Hand <SH> as its vassal.', act: 'fealty-withdraw', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ fealty: [f('offered', true)] }), [{ text: 'The Silver Hand <SH> offers to take your guild as its vassal.', act: 'fealty-accept', alt: 'fealty-decline', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ fealty: [f('offered', false)] }), [{ text: 'The Silver Hand <SH> offers to swear fealty to your guild.', act: 'fealty-accept', alt: 'fealty-decline', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ pacts: [{ with: SH, state: 'signed', until: 16, mine: true }] }),
    [{ text: 'A Pact of non-aggression with the Silver Hand <SH>, until week 16. Breaking it early is announced to everyone.', act: 'pact-break', tag: 'SH' }]);
  assert.deepEqual(politicsRows({ pacts: [{ with: EO, state: 'offered', until: 16, mine: true }] }), [{ text: 'Your guild offers Ebon Oath <EO> a Pact of non-aggression.', act: 'pact-withdraw', tag: 'EO' }]);
  assert.deepEqual(politicsRows({ pacts: [{ with: SH, state: 'offered', until: 16, mine: false }] }), [{ text: 'The Silver Hand <SH> offers your guild a Pact of non-aggression, until week 16.', act: 'pact-accept', alt: 'pact-decline', tag: 'SH' }]);
  assert.deepEqual(politicsRows(null), []);
  assert.equal(politicsRows({ fealty: [f('sworn', true)], pacts: [{ with: EO, state: 'offered', until: 8, mine: true }] }).length, 2, 'fealty first, then Pacts');
  assert.deepEqual({ ...POLITICS_ACTS }, { 'fealty-accept': 'Accept', 'fealty-withdraw': 'Withdraw', 'fealty-break': 'Break fealty', 'pact-accept': 'Sign', 'pact-withdraw': 'Withdraw', 'pact-break': 'Break the Pact', 'fealty-decline': 'Decline', 'pact-decline': 'Decline' });   // AUDIT-SEATS (PIN MOVED): an offer made to the guild has a Decline beside its Accept
  assert.equal(pactBrokenText(SH, DG), 'The Silver Hand <SH> has broken its Pact of non-aggression with Daggers <DG>.');
  assert.equal(seatBattleLine({ kind: 'siege', guild: SH, against: EO }), 'The Silver Hand <SH> has won a Right of Siege against Ebon Oath <EO> this week.');
  assert.match(battleAnnouncement({ kind: 'tourney', startsAt: 0, attackerGuild: SH, defenderGuild: EO }, 'Anticlere'), /^The Silver Hand <SH> and Ebon Oath <EO> meet/);
});

test('CROWN2 THE BOOK\'S CALLS: fealty offered as vassal or liege, accepted, broken (a vassal\'s without a tag) or withdrawn; a Pact offered or signed, broken or withdrawn - each down its own path with the character and tag, its words said back, a refusal in its own words (mutants: each path; each word; the tag left off)', async () => {
  const calls = [];
  let answer = {};
  const door = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return Promise.resolve(typeof answer === 'string' ? { ok: false, error: answer } : { ok: true, data: answer }); } });
  const book = createTownSeatBook({ door, character: () => 'c1', storage: null });
  assert.equal((await book.offerFealty('SH', 'vassal')).text, 'Your guild offers to swear fealty to <SH>.');
  assert.equal((await book.offerFealty('DG', 'liege')).text, 'Your guild offers to take <DG> as its vassal.');
  assert.equal((await book.acceptFealty('SH')).text, 'The fealty with <SH> is sworn.');
  answer = { breaking: true };
  assert.equal((await book.breakFealty('SH')).text, 'The fealty ends at the Turning. Your guild loses 10 Standing at each seat it holds.');
  answer = { withdrawn: true };
  assert.equal((await book.breakFealty(null)).text, 'Your guild\'s offer of fealty is withdrawn.');
  answer = { signed: false };
  assert.equal((await book.offerPact('EO')).text, 'Your guild offers <EO> a Pact of non-aggression.');
  answer = { signed: true, until: 16 };
  assert.equal((await book.offerPact('EO')).text, 'The Pact with <EO> is signed, until week 16.');
  answer = { announced: true };
  assert.equal((await book.breakPact('EO')).text, 'Your guild has broken its Pact with <EO>. Everyone has been told.');
  answer = { announced: false };
  assert.equal((await book.breakPact('EO')).text, 'The offer of a Pact with <EO> is withdrawn.');
  assert.deepEqual(calls, [
    ['fealty', 'c1', 'SH', 'vassal'], ['fealty', 'c1', 'DG', 'liege'], ['fealtyAccept', 'c1', 'SH'], ['fealtyBreak', 'c1', 'SH'], ['fealtyBreak', 'c1', null],
    ['pact', 'c1', 'EO'], ['pact', 'c1', 'EO'], ['pactBreak', 'c1', 'EO'], ['pactBreak', 'c1', 'EO'],
  ]);
  answer = 'fealty-unfit';
  assert.deepEqual(await book.offerFealty('SH', 'vassal'), { ok: false, text: accountRefusalText('fealty-unfit') });
  // the door's own paths and bodies
  const posted = [];
  const { accountSeats } = await import('../src/net/accountClient.js');
  const seats = accountSeats({ fetch: async (u, i) => { posted.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true}', { status: 200 }); }, storage: { getItem: () => JSON.stringify({ id: 'p1', secret: 's' }), setItem() {}, removeItem() {} } });
  await seats.fealty('c1', 'SH', 'vassal'); await seats.fealtyAccept('c1', 'SH'); await seats.fealtyBreak('c1', null); await seats.fealtyBreak('c1', 'SH'); await seats.pact('c1', 'EO'); await seats.pactBreak('c1', 'EO');
  assert.deepEqual(posted, [
    ['/v1/seats/fealty', { character: 'c1', tag: 'SH', as: 'vassal' }], ['/v1/seats/fealty/accept', { character: 'c1', tag: 'SH' }],
    ['/v1/seats/fealty/break', { character: 'c1' }], ['/v1/seats/fealty/break', { character: 'c1', tag: 'SH' }],
    ['/v1/seats/pact', { character: 'c1', tag: 'EO' }], ['/v1/seats/pact/break', { character: 'c1', tag: 'EO' }],
  ]);
});

test('CROWN2 THE RED LINES: each the seats\' list carries said once, oldest first, its time in ms; remembered on the device past a reload (newest SEAT_RED_SEEN_MAX); one not taken (no chat yet) offered again; a bad row never said; the list read again for them each SEAT_RED_READ_MS while the seats are open, never while shut (mutants: the once; the store; the cap; the refusal kept; the clock; the shut)', async () => {
  let now = 1_000_000, red = [{ id: 3, text: 'Daggers <DG> has broken its Pact.', at: 900 }, { id: 4, text: 'Second.', at: 950 }, { id: 'x', text: 'bad', at: 1 }, { id: 5, text: null, at: 1 }];
  let lists = 0, ok = true;
  const door = { list: async () => { lists++; return ok ? { ok: true, data: { seats: [], red } } : { ok: false, error: 'seats-closed' }; } };
  const store = memStore();
  const said = [];
  let take = true;
  const book = createTownSeatBook({ door, storage: store, nowMs: () => now, onRed: (l) => (take ? (said.push(l), true) : false) });
  await book.read();
  assert.deepEqual(said, [{ text: 'Daggers <DG> has broken its Pact.', at: 900_000 }, { text: 'Second.', at: 950_000 }]);
  assert.deepEqual(JSON.parse(store.getItem(SEAT_RED_SEEN_KEY)), [3, 4]);
  await book.read({ force: true });
  assert.equal(said.length, 2, 'said once');
  // a reload: the device remembers
  const again = [];
  const book2 = createTownSeatBook({ door, storage: store, nowMs: () => now, onRed: (l) => { again.push(l); return true; } });
  red = [...red, { id: 6, text: 'Third.', at: 990 }];
  await book2.read();
  assert.deepEqual(again.map((l) => l.text), ['Third.']);
  // no chat yet: offered again at the next read
  take = false;
  red = [{ id: 7, text: 'Fourth.', at: 995 }];
  await book.read({ force: true });
  assert.equal(said.length, 2);
  take = true;
  await book.read({ force: true });
  assert.deepEqual(said.at(-1), { text: 'Fourth.', at: 995_000 });
  // the cap
  red = Array.from({ length: SEAT_RED_SEEN_MAX + 5 }, (_, i) => ({ id: 100 + i, text: `r${i}`, at: 1 }));
  await book.read({ force: true });
  const kept = JSON.parse(store.getItem(SEAT_RED_SEEN_KEY));
  assert.equal(kept.length, SEAT_RED_SEEN_MAX);
  assert.equal(kept.at(-1), 100 + SEAT_RED_SEEN_MAX + 4, 'the newest kept');
  // the clock
  lists = 0;
  book.redTick();
  assert.equal(lists, 0, 'read just now');
  now += SEAT_RED_READ_MS - 1; book.redTick(); assert.equal(lists, 0);
  now += 1; book.redTick(); await tick(); assert.equal(lists, 1, 'its minutes up: read again');
  assert.equal(SEAT_RED_READ_MS, 15 * 60_000);
  ok = false;
  now += SEAT_RED_READ_MS; book.redTick(); await tick();
  assert.equal(lists, 2);
  now += SEAT_RED_READ_MS; book.redTick(); await tick();
  assert.equal(lists, 2, 'shut: never read for red lines');
});

test('CROWN2 THE SEAT TAB\'S POLITICS: every member reads its guild\'s rows; an Officer or the guildmaster has each row\'s lever, calling the book with the other guild\'s tag, and offers fealty either way or a Pact to a tag typed (none with no tag); a Member none; a guild with none says so (mutants: the rank; each lever; the tag; the empty line)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const acts = [];
  const politics = {
    fealty: [{ vassal: DG, liege: SH, state: 'sworn', mine: false, asVassal: true }, { vassal: { name: 'Wolves', tag: 'WF' }, liege: DG, state: 'offered', mine: false, asVassal: false }],
    pacts: [{ with: EO, state: 'offered', until: 16, mine: false }, { with: { name: 'Ravens', tag: 'RV' }, state: 'signed', until: 16, mine: true }],
  };
  const mount = (rank, p = politics) => {
    const host = document.createElement('div');
    const data = { seat: ANTICLERE, week: 6, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: null, holder: null, standings: [], chronicle: [],
      mine: { guild: 'g1', rank, seasoned: true, bound: 'g1', pledges: [], influence: 0, tributeRoom: 0, politics: p } };
    const seatBook = {
      open: true, standings: async () => ({ data, error: null }),
      acceptFealty: async (t) => { acts.push(['acceptFealty', t]); return { ok: true, text: 'ok' }; },
      breakFealty: async (t) => { acts.push(['breakFealty', t]); return { ok: true, text: 'ok' }; },
      offerFealty: async (t, as) => { acts.push(['offerFealty', t, as]); return { ok: true, text: 'ok' }; },
      offerPact: async (t) => { acts.push(['offerPact', t]); return { ok: true, text: 'ok' }; },
      breakPact: async (t) => { acts.push(['breakPact', t]); return { ok: true, text: 'ok' }; },
      declineFealty: async (t) => { acts.push(['declineFealty', t]); return { ok: true, text: 'ok' }; },   // AUDIT-SEATS: an offer turned down
      declinePact: async (t) => { acts.push(['declinePact', t]); return { ok: true, text: 'ok' }; },
    };
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANTICLERE, book: seatBook } });
    byClass(host, 'notice-tab')[1].onclick();
    return host;
  };
  let host = mount(1);
  await tick();
  assert.match(host.textContent, /Fealty and Pacts/);
  assert.match(host.textContent, /Your guild is sworn to the Silver Hand <SH>\./);
  assert.match(host.textContent, /Ebon Oath <EO> offers your guild a Pact of non-aggression, until week 16\./);
  byClass(host, 'notice-seat-fealty-break')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['breakFealty', 'SH']);
  assert.match(host.textContent, /Wolves <WF> offers to swear fealty to your guild\./);
  byClass(host, 'notice-seat-fealty-accept')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['acceptFealty', 'WF']);
  byClass(host, 'notice-seat-fealty-decline')[0].click(); await tick();   // AUDIT-SEATS: its Decline beside its Accept
  assert.deepEqual(acts.at(-1), ['declineFealty', 'WF']);
  assert.equal(byClass(host, 'notice-seat-fealty-decline')[0].textContent, 'Decline');
  byClass(host, 'notice-seat-pact-decline')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['declinePact', 'EO']);
  byClass(host, 'notice-seat-pact-accept')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['offerPact', 'EO']);
  assert.equal(byClass(host, 'notice-seat-pact-accept')[0].textContent, 'Sign');
  byClass(host, 'notice-seat-pact-break')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['breakPact', 'RV']);
  const n = acts.length;
  byClass(host, 'notice-seat-swear')[0].click(); await tick();
  assert.equal(acts.length, n, 'no tag: nothing asked');
  const tag = byClass(host, 'notice-seat-politics-tag')[0];
  tag.value = ' OA '; tag.oninput();
  byClass(host, 'notice-seat-swear')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['offerFealty', 'OA', 'vassal']);
  byClass(host, 'notice-seat-take')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['offerFealty', 'OA', 'liege']);
  byClass(host, 'notice-seat-pact')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['offerPact', 'OA']);
  // a Member: the rows, no lever
  host = mount(2);
  await tick();
  assert.match(host.textContent, /Your guild is sworn to the Silver Hand <SH>\./);
  assert.equal(byClass(host, 'notice-seat-fealty-break').length + byClass(host, 'notice-seat-pact-accept').length + byClass(host, 'notice-seat-swear').length + byClass(host, 'notice-seat-politics-tag').length, 0);
  host = mount(0, { fealty: [], pacts: [] });
  await tick();
  assert.match(host.textContent, /Your guild has no liege, no vassal and no Pact\./);
  assert.equal(byClass(host, 'notice-seat-pact').length, 1, 'the guildmaster: the offers');
});

test('CROWN2 THE WIRING BY SOURCE: the world hands the seat book a red line\'s door that answers false until the chat stands, which it sets with the chat; the frame reads the list again for them; the service\'s list carries them (mutants: each seam)', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /onRed: \(line\) => \(redChat \? redChat\(line\) : false\),/);
  assert.match(world, /redChat = \(line\) => \{ if \(!chatLog\) return false; chatLog\.pushAll\(\{ text: line\.text, at: line\.at, red: true \}\); return true; \};/);
  assert.match(world, /seatBook\?\.redTick\(\);/);
  const idx = readFileSync(new URL('../server-account/src/index.js', import.meta.url), 'utf8');
  assert.match(idx, /red: await redOf\(ctx\.db, nowS\)/);
  const tab = readFileSync(new URL('../src/ui/seatTab.js', import.meta.url), 'utf8');
  assert.match(tab, /if \(data\.mine\?\.politics\) mine\.append\(politicsNode\(data\.mine\.politics, SEAT_LEVER_RANKS\.includes\(data\.mine\.rank\)\)\);/);
});
