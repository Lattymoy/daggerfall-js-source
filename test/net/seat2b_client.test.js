// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): THE WORKS ON THE SEAT TAB - each work the seat may raise, its tier and what it does, the project and what it
// still wants (or its day), the stockpile, and the holder's lever a work (bible/11-Multiplayer/Seats-Arc.md 7.5, 7.9;
// src/ui/seatWorks.js, src/net/fortLaw.js fortWorkLine). `06-Systems/Online-Arc.md` SEAT2b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../chargenDom.mjs';
import { drawSeatWorks, fortLeverText, SEAT_WORKS_WORDS } from '../../src/ui/seatWorks.js';
import { fortWorkLine, FORT_EFFECT_WORDS } from '../../src/net/fortLaw.js';

const NAMES = { 'stone:cut': 'Cut Stone', 'plank:oak': 'Oak Planks', 'ingot:iron': 'Iron Ingots', 'metal:silver': 'Silver' };
const nameOf = (k) => NAMES[k] ?? k;

test('SEAT2b THE WORKS\' WORDS: a tier and what it does; a project and what it still wants, or the day it stands; every work\'s effect said at its tiers (mutants: the wanting; the day; each effect\'s words)', () => {
  assert.equal(fortWorkLine('walls', { tier: 0, building: null }), 'Walls: none raised.');
  assert.equal(fortWorkLine('walls', { tier: 1, building: 2, standsAt: null, needs: [['stone:cut', 800], ['ingot:iron', 200]], held: [['stone:cut', 480], ['ingot:iron', 0]] }, { nameOf }),
    'Walls: tier 1 - the defenders\' wave 3 s faster. Raising tier 2: 320 Cut Stone, 200 Iron Ingots still wanted.');
  assert.equal(fortWorkLine('shrine', { tier: 0, building: 1, standsAt: 1_800_000_000, needs: [['stone:cut', 100]], held: [['stone:cut', 100]] }, { whenOf: (ms) => `at ${ms}` }),
    'Shrine: none raised. Tier 1 stands at 1800000000000.');
  assert.equal(fortWorkLine('walls', { tier: 0, building: 1, standsAt: null, needs: [['stone:cut', 400]], held: [['stone:cut', 400]] }, { nameOf }), 'Walls: none raised. Raising tier 1: every need met.');
  assert.equal(fortWorkLine('nope', { tier: 1 }), '');
  assert.deepEqual(Object.entries(FORT_EFFECT_WORDS).map(([id, f]) => `${id}: ${f(2)}`), [
    'walls: the defenders\' wave 6 s faster',
    'gatehouse: its vitality 40,000',
    'watchtowers: the holder is warned when a challenger gets past a quarter of its defense',
    'barracks: 4 town guards fight for the holder',
    'market: the town\'s boards list 50% more, the Tithe\'s cap 2 points higher',
    'shrine: Standing +2 a week, +100 influence for each gate felled in the region',
    'forge: members smithing here 2 quality steps better',
    'workshop: members\' carpentry, outfitting and masonry here 2 quality steps better',
    'apothecary: members\' jewelry here 2 quality steps better, their dishes twice the XP, their brews +20% Potent chance',
    'harbour: a port for the holder\'s members',
  ]);
  assert.deepEqual([FORT_EFFECT_WORDS.watchtowers(1), FORT_EFFECT_WORDS.forge(1), FORT_EFFECT_WORDS.market(1)],
    ['the holder is warned when a challenger gets past half of its defense', 'members smithing here a quality step better', 'the town\'s boards list 25% more, the Tithe\'s cap 1 point higher']);
});

test('SEAT2b THE WORKS PANEL: the works a palace may raise (no Gatehouse below tier-3 Walls, no Harbour inland), each line; the stockpile; the holder\'s lever a work at its next tier, none for one building or at its last, none for a reader without the rank; the lever\'s press begins that work (mutants: which works; the lever\'s rules; its words; the press)', () => {
  const forts = {
    works: { walls: { tier: 1, building: null }, shrine: { tier: 2, building: null }, market: { tier: 0, building: 1, standsAt: null, needs: [['plank:oak', 200], ['stone:cut', 100]], held: [['plank:oak', 50], ['stone:cut', 100]] } },
    stockpile: [['ingot:iron', 40], ['stone:cut', 0]],
  };
  const begun = [];
  const host = document.createElement('div');
  const buttons = drawSeatWorks(host, { forts, seat: { tier: 'palace' }, lever: true, nameOf, onBegin: (w) => begun.push(w) });
  const lines = byClass(host, 'notice-seat-works-line').map((n) => n.textContent);
  assert.deepEqual(lines.map((l) => l.split(':')[0]), ['Walls', 'Watchtowers', 'Barracks', 'Market Hall', 'Shrine', 'Forge', 'Workshop', 'Apothecary'], 'no Gatehouse, no Harbour; the Apothecary now its stations stand (AUDIT SEATS-2 L5; PIN MOVED (PROF12))');
  assert.match(lines[3], /Raising tier 1: 150 Oak Planks still wanted\./);
  assert.equal(byClass(host, 'notice-seat-works-stock')[0].textContent, 'The stockpile: 40 Iron Ingots.');
  assert.deepEqual(Object.keys(buttons), ['walls', 'watchtowers', 'barracks', 'forge', 'workshop', 'apothecary'], 'none for the Market Hall (building) nor the Shrine (at its last tier); the Apothecary\'s now its stations stand (AUDIT SEATS-2 L5; PIN MOVED (PROF12))');
  assert.equal(buttons.walls.textContent, 'Raise the Walls to grade 2 (3,000 silver)');
  buttons.forge.click();
  assert.deepEqual(begun, ['forge']);
  // a port and tier-3 Walls: the Harbour and a gate of its own
  const h2 = document.createElement('div');
  const b2 = drawSeatWorks(h2, { forts: { works: { walls: { tier: 3, building: null } }, stockpile: [] }, seat: { tier: 'palace' }, port: true, lever: true, nameOf });
  assert.ok(b2.gatehouse && b2.harbour && !b2.walls);
  assert.equal(byClass(h2, 'notice-seat-works-stock')[0].textContent, SEAT_WORKS_WORDS.emptyStock);
  // no rank: the lines, no lever; reading: the words
  const h3 = document.createElement('div');
  assert.deepEqual(Object.keys(drawSeatWorks(h3, { forts, seat: { tier: 'crown' }, lever: false, nameOf })), []);
  assert.ok(byClass(h3, 'notice-seat-works-line').some((n) => n.textContent.startsWith('Gatehouse')), 'a crown\'s gate');
  const h4 = document.createElement('div');
  drawSeatWorks(h4, { forts: null, seat: { tier: 'palace' } });
  assert.equal(h4.textContent, `${SEAT_WORKS_WORDS.head}${SEAT_WORKS_WORDS.reading}`);
  assert.equal(fortLeverText('shrine', 3), '', 'no such tier');
});

test('SEAT2b SEAT WRITS ON THE WORK TAB: the guild\'s seats of the region offered as where a writ\'s units go - the stockpile it holds, the Siege Camp it is pledged to - a seat\'s writ asking only what a work asks, posted with its seat; a seat writ\'s card says so, under its guild\'s banner (mutants: the choice; the materials; the post; the card\'s words; the banner)', async () => {
  const { createWorkTab, seatWritFor, seatWritPlace } = await import('../../src/ui/workTab.js');
  const { FORT_MATERIALS, RAM_KIT_KEY } = await import('../../src/net/fortLaw.js');
  const T = 1_800_000_000;
  const posted = [];
  const w = { writs: { state: { workDrafts: null }, post: async (req) => { posted.push(req); return { ok: true }; } }, held: () => 0, region: 21, regionName: 'Anticlere', regionNameOf: () => 'Elsewhere', countName: (k) => k, pieces: () => [], reload() {} };
  const ui = { busy: () => false, run: async (f) => { await f(); }, rerender() {}, nowS: () => T };
  const tab = createWorkTab(w, ui);
  tab._state.form = 'writ';
  const heraldry = { field: 'azure', border: 'gold', device: 'eagle' };
  const data = {
    writs: [], today: { filled: 0, max: 3 }, commissions: [], balance: 0, writsOpen: true, me: 'Me',
    guildWrits: [{ id: 'S1', kind: 'guild', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry }, region: 21, material: 'stone:cut', units: 300, left: 280, pay: 3, escrow: 840, at: 0, expiresAt: T + 5 * 86400, state: 'open', mine: false, may: false, room: null, seat: 3021, camp: false, seatName: 'Anticlere' },
      { id: 'S2', kind: 'guild', guild: { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: null }, region: 21, material: 'plank:oak', units: 100, left: 100, pay: 1, escrow: 100, at: 0, expiresAt: T + 5 * 86400, state: 'open', mine: false, may: false, room: null, seat: 3021, camp: true, seatName: 'Anticlere' }],
    yours: { commissions: [], guildWrits: [] },
    guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', rank: 0, mayPost: true, marks: 100_000, budget: 0, spent: 0, left: 0,
      seats: [{ key: 3021, name: 'Anticlere', camp: false }, { key: 3022, name: 'Ashfield', camp: true }] },
  };
  const find = (root, label) => root.querySelectorAll('*').find((n) => n.getAttribute?.('aria-label') === label);
  let node = tab.node(data);
  const where = find(node, "Where the writ's units go");
  assert.deepEqual(where.children.map((o) => [o.value, o.textContent]), [['', 'The guild Stores'], ['3021', "Anticlere's stockpile"], ['3022', 'The Siege Camp at Ashfield']]);
  assert.ok(find(node, 'The material the writ asks').children.length > FORT_MATERIALS.length, 'the guild Stores: the whole catalogue');
  assert.equal(find(node, 'The material the writ asks').children.some((o) => o.value === RAM_KIT_KEY), false, 'SEAT2b part two: never a Ram Kit for the guild Stores');
  where.value = '3021'; where.onchange();
  node = tab.node(data);
  assert.deepEqual(find(node, 'The material the writ asks').children.map((o) => o.value).sort(), [...FORT_MATERIALS].sort(), 'a stockpile\'s writ asks what a work asks');
  where.value = '3022'; where.onchange();
  node = tab.node(data);
  const mats = find(node, 'The material the writ asks').children.map((o) => o.value);
  assert.deepEqual(mats.sort(), [...FORT_MATERIALS, RAM_KIT_KEY].sort(), 'a Siege Camp\'s writ asks what a work asks - SEAT2b part two (PIN MOVED): and Ram Kits');
  node.querySelectorAll('*').find((n) => n.className?.includes?.('work-post')).click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posted.at(-1).seat, 3022);
  // the cards
  const cards = tab.cards(data);
  assert.match(cards[0].textContent, /^Seat writ/);
  assert.match(cards[0].textContent, /The Silver Hand \[SH\] needs 280 more stone:cut for Anticlere's stockpile/);
  assert.match(cards[1].textContent, /Ebon Oath \[EO\] needs 100 more plank:oak for the Siege Camp at Anticlere/);
  assert.equal(cards[0].querySelectorAll('*').filter((n) => n.className?.includes?.('writ-banner')).length, 1, 'its guild\'s banner');
  assert.equal(cards[1].querySelectorAll('*').filter((n) => n.className?.includes?.('writ-banner')).length, 0, 'none without heraldry');
  assert.deepEqual([seatWritPlace({ name: 'Silas', camp: false }), seatWritFor({ camp: true })], ["Silas' stockpile", 'for the Siege Camp at the seat']);
});

test('SEAT2b THE WORKS ON THE SEAT TAB: read with the standings and drawn under a held seat; the holder\'s Officer begins a work through the book with the town\'s port, and the board is read again; another guild\'s reader sees the works without a lever; an unheld seat draws none (mutants: the read; the holder gate; the lever\'s rank and guild; the port; the reload)', async () => {
  const { createSeatTab } = await import('../../src/ui/seatTab.js');
  const { GUILD_RANK_MASTER } = await import('../../src/net/guild/guildLaw.js');
  const SEAT = { key: 3021, name: 'Anticlere', region: 17, tier: 'palace' };
  const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
  const settle = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
  const FORTS = { works: { walls: { tier: 1, building: null } }, stockpile: [['stone:cut', 40]] };
  const rig = ({ holder = SH, guild = 'g1', rank = GUILD_RANK_MASTER, port = false } = {}) => {
    const t = { reads: 0, forced: 0, funded: [] };
    const data = { seat: SEAT, week: 6, phase: 'muster', reckoningAt: 1_800_003_600, turningAt: 1_800_086_400, defence: 4500, holder: holder ? { guild: holder, since: 3, standing: 55, tithe: 6, edict: null } : null,
      battle: null, standings: [], chronicle: [], mine: { guild, rank, seasoned: true, bound: guild, pledges: [], influence: 0, tributeRoom: 0 } };
    const book = {
      zero: null,
      standings: async (k, o) => { t.reads++; if (o?.force) t.forced++; return { data, error: null }; },
      forts: async (k) => { assert.equal(k, 3021); return { data: FORTS, error: null }; },
      fortFund: async (seat, work, p) => { t.funded.push([seat.key, work, p]); return { ok: true, text: 'begun' }; },
    };
    const ui = { busy: () => false, run: (start) => start(), rerender: () => {}, nowS: () => 1_800_000_000, alive: () => true };
    t.tab = createSeatTab({ seat: SEAT, book, port, countName: (k, n) => (k === 'stone:cut' ? 'Cut Stone' : k) }, ui);
    return t;
  };
  const t = rig({ port: true });
  await t.tab.open(); await settle();
  let body = t.tab.body();
  assert.equal(byClass(body, 'notice-seat-works').length, 1, 'the panel, under a held seat');
  assert.ok(body.textContent.includes('The stockpile: 40 Cut Stone.'), 'the stockpile in the host\'s words');
  const lever = byClass(body, 'notice-seat-fort-walls')[0];
  assert.equal(lever?.textContent, fortLeverText('walls', 2));
  assert.equal(byClass(body, 'notice-seat-fort-harbour').length, 1, 'a port\'s Harbour offered');
  const before = t.forced;
  await lever.onclick({}); await settle();
  assert.deepEqual(t.funded, [[3021, 'walls', true]], 'the book asked for that work, with the town\'s port');
  assert.equal(t.forced, before + 1, 'and the board read afresh after');
  // a reader of another guild: the works, no lever
  const o = rig({ guild: 'g2' });
  await o.tab.open(); await settle();
  body = o.tab.body();
  assert.equal(byClass(body, 'notice-seat-works').length, 1);
  assert.equal(byClass(body, 'act').filter((b) => /notice-seat-fort-/.test(b.className)).length, 0, 'no lever for another guild');
  assert.equal(byClass(body, 'notice-seat-fort-harbour').length, 0, 'an inland town offers no Harbour');
  // the holder's member below an Officer: no lever
  const m = rig({ rank: 3 });
  await m.tab.open(); await settle();
  assert.equal(byClass(m.tab.body(), 'notice-seat-fort-walls').length, 0, 'no lever below an Officer');
  assert.ok(!m.tab.body().textContent.includes('Harbour'), 'an inland town shows no Harbour');
  // an unheld seat: no panel
  const u = rig({ holder: null });
  await u.tab.open(); await settle();
  assert.equal(byClass(u.tab.body(), 'notice-seat-works').length, 0, 'none at an unheld seat');
});

test('SEAT2b THE BOOK\'S WORKS: the read is refused while the seats are shut; a project begun carries one request id until an answer comes - the same work asked after a lost answer carries it again, a refusal or an answer lets it go - and says the work, its tier and its Drakes (mutants: the gate; the id kept; the id let go; the words)', async () => {
  const { createTownSeatBook } = await import('../../src/net/townSeatBook.js');
  const SEAT = { key: 3021, name: 'Anticlere', region: 17, tier: 'palace' };
  const asks = [];
  let answer = { ok: false, error: 'offline' };
  const door = {
    list: async () => ({ ok: true, data: { seats: [] } }),
    forts: async () => ({ ok: true, data: { works: { walls: { tier: 1 } }, stockpile: [['stone:cut', 4]] } }),
    fortFund: async (c, key, work, rid, port) => { asks.push([c, key, work, rid, port]); return answer; },
  };
  let n = 0;
  const book = createTownSeatBook({ door: /** @type {any} */ (door), character: () => 'c1', storage: null, nowMs: () => 1_800_000_000_000, rid: () => `rid-0000-${++n}` });
  assert.deepEqual(await book.forts(3021), { data: null, error: 'seats-closed' }, 'shut before the list is read');
  await book.read();
  assert.deepEqual((await book.forts(3021)).data, { works: { walls: { tier: 1 } }, stockpile: [['stone:cut', 4]] });
  assert.equal((await book.fortFund(SEAT, 'walls', true)).ok, false);
  await book.fortFund(SEAT, 'walls', true);
  assert.equal(asks[0][3], asks[1][3], 'a lost answer: the same id asked again');
  assert.deepEqual(asks[0], ['c1', 3021, 'walls', 'rid-0000-1', true]);
  answer = { ok: true, data: { work: 'walls', tier: 2, marks: 3000 } };
  const r = await book.fortFund(SEAT, 'walls', true);
  assert.equal(r.text, 'Work on the Walls at Anticlere is begun toward grade 2: 3,000 silver from the treasury. Seat writs deliver what they need.');
  await book.fortFund(SEAT, 'walls', true);
  assert.notEqual(asks[3][3], asks[2][3], 'an answer lets the id go');
  answer = { ok: false, error: 'fort-building' };
  await book.fortFund(SEAT, 'shrine');
  await book.fortFund(SEAT, 'shrine');
  assert.notEqual(asks[5][3], asks[4][3], 'a refusal lets it go');
  answer = { ok: true, data: { repeat: true, work: 'walls' } };
  assert.equal((await book.fortFund(SEAT, 'walls')).text, 'Work on the Walls at Anticlere was already begun.');
});
