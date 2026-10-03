// SILVER-WAYS (2026-10-03, Mac: "Do it"): SILVER OUTSIDE THE CRAFTS, AS THE GAME SAYS IT - a counted claim's silver lines
// in the book's own words (net/marksBook.js claimLines: a raid's or a gate's strike, the day's cap named, a guild deed,
// a contract's pay); the raid's and the gate's carriers saying every line (net/raidClaims.js, net/gateClaims.js); the
// Work tab's guild contracts (ui/workTab.js: a card under its guild, what it pays, the posters told they are not paid,
// Withdraw where the rank may, the post form with its every bound said); the doors to the service (net/accountClient.js
// accountWrits, net/writBook.js); the Guild tab's ledger words; and the world host's seams by source.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from './chargenDom.mjs';
import { T0 } from './accountDb.mjs';
import { createMarksBook, MARKS_TEXT } from '../src/net/marksBook.js';
import { createRaidClaims } from '../src/net/raidClaims.js';
import { createGateClaims } from '../src/net/gateClaims.js';
import { accountWrits, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { createWritBook } from '../src/net/writBook.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { GUILD_MARKS_LEDGER_WORDS } from '../src/ui/socialPanel.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { marksText } from '../src/net/marksLaw.js';
import { saleTax } from '../src/net/marketLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
const { subtle } = globalThis.crypto;
const DF = 17, WR = 23;
const DAY = 86_400;
const book = () => createMarksBook({ door: { account: () => 'acct-1', balance: async () => ({ ok: false }), exchange: async () => ({ ok: false }) } });
async function relayKey() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
}

// ─── THE LINES ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SILVER-WAYS the lines: a counted claim says its strike, a guild deed it completed and each contract that paid it, in that order; the day\'s cap names breaches and towns, a raid\'s capped line its town; a service from before them says only the strike (mutants: the deed unsaid; a contract unsaid; the raid\'s capped line the breach\'s)', () => {
  const b = book();
  const deed = { struck: 25, guild: { name: 'The Hound', tag: 'HND' } };
  const contracts = [{ contract: 'C1', guild: { name: 'The Silver Hand', tag: 'SH' }, pay: 38, tax: 2 }];
  assert.deepEqual(b.claimLines({ marks: { struck: 30, balance: 130 }, deed, contracts }, 'raid'), [
    '30 silver struck to your account. You hold 130 silver.',
    'A deed for The Hound: three of its members stood together. 25 silver struck to its treasury.',
    'The Silver Hand pays you 38 silver under its contract.',
  ]);
  assert.deepEqual(b.claimLines({ marks: { struck: 0, balance: 150, why: 'cap' } }, 'raid'), ['No silver for this town. The counting-houses strike 150 silver a day for breaches closed and towns defended.']);
  assert.deepEqual(b.claimLines({ marks: { struck: 0, balance: 150, why: 'cap' } }, 'gate'), ['No silver for this breach. The counting-houses strike 150 silver a day for breaches closed and towns defended.']);
  assert.deepEqual(b.claimLines({ marks: { struck: 50, balance: 50 }, deed: null }), ['50 silver struck to your account. You hold 50 silver.']);
  assert.deepEqual(b.claimLines({ recorded: true }), [], 'a service from before them');
  assert.deepEqual(b.claimLines(null), []);
  assert.equal(b.state.balance, 50, 'the balance the last strike answered');
  b.claimLines({ marks: { struck: 30, balance: 80, combat: { earned: 130, max: 150 } } }, 'raid');
  assert.deepEqual([b.state.today.combat, b.state.today.combatMax], [130, 150], 'the day\'s combat silver as the strike said it');
  assert.match(src('src/ui/enhancedPorts.js'), /\['From gates and raids today', `\$\{\(w\.hooks\.marks\.today\(\)\?\.combat \?\? 0\)\} of \$\{w\.hooks\.marks\.today\(\)\?\.combatMax \?\? MARKS_COMBAT\.perDay\}`\],/, 'the Bank\'s card says it');
  assert.equal(MARKS_TEXT.contract(12, null), 'A guild pays you 12 silver under its contract.');
});

test('SILVER-WAYS the carriers: a counted raid says its town\'s line and then every silver line its host gives; a counted gate says each of the lines its host gives for the answer (the strike, the deed); a host that throws loses no claim (mutants: the raid\'s lines unsaid; the gate\'s array said as one)', async () => {
  const key = await relayKey();
  const nowS = T0;
  const r = await mintRaidReceipt({ w: '17:3:900', s: 'acct-1', c: 1, y: 2 }, key, { subtle, nowS });
  const said = [];
  const answer = { recorded: true, defended: 4, renown: { credited: 0 }, marks: { struck: 30, balance: 30 }, deed: { struck: 25, guild: { name: 'The Hound' } }, contracts: [{ pay: 19, guild: { name: 'Silver Hand' } }] };
  const b = book();
  const rc = createRaidClaims({ claim: async () => ({ ok: true, data: answer }), me: () => 'acct-1', nowS: () => nowS, say: (t) => said.push(t), onMarks: (d) => b.claimLines(d, 'raid') });
  rc.add(r, 'char-1', 'Ann');
  await rc.flush();
  assert.deepEqual(said, [
    'The town will remember you. Towns defended: 4.',
    '30 silver struck to your account. You hold 30 silver.',
    'A deed for The Hound: three of its members stood together. 25 silver struck to its treasury.',
    'Silver Hand pays you 19 silver under its contract.',
  ]);
  const thrown = [];
  const rc2 = createRaidClaims({ claim: async () => ({ ok: true, data: answer }), me: () => 'acct-1', nowS: () => nowS, say: (t) => thrown.push(t), onMarks: () => { throw new Error('a host'); } });
  rc2.add(await mintRaidReceipt({ w: '17:4:900', s: 'acct-1', c: 1, y: 2 }, key, { subtle, nowS }), 'char-1');
  await rc2.flush();
  assert.equal(rc2.kept().length, 0, 'counted and let go all the same');
  const g = await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-1', c: 4242, x: 'dealt' }, key, { subtle, nowS });
  const gsaid = [];
  const gc = createGateClaims({
    claim: async () => ({ ok: true, data: { recorded: true, stones: 1, closed: 2, marks: { struck: 50, balance: 80 }, deed: { struck: 25, guild: { name: 'The Hound' } } } }),
    me: () => 'acct-1', nowS: () => nowS, say: (t) => gsaid.push(t), onMarks: (marks, data) => b.claimLines(data, 'gate'),
  });
  gc.add(g);
  await gc.flush();
  assert.deepEqual(gsaid.slice(1), ['50 silver struck to your account. You hold 80 silver.', 'A deed for The Hound: three of its members stood together. 25 silver struck to its treasury.']);
});

// ─── THE DOORS ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SILVER-WAYS the doors: a contract posted goes to /v1/writs/contract with the character and one request id kept for a press asked again; a withdrawal to /v1/writs/contract-withdraw; every refusal has its sentence (mutants: the route; the character unsent)', async () => {
  const asked = [];
  const fetch = async (u, i) => { asked.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response(JSON.stringify({ contract: { id: 'C1' } }), { status: 200 }); };
  const storage = { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 's'.repeat(43), id: 'acct-1' }) : null) };
  const door = accountWrits({ fetch, storage });
  const wb = createWritBook({ door, character: () => 'char-1', sleep: async () => {} });
  await wb.contract({ region: DF, kind: 'raid', pay: 20, deeds: 10 });
  await wb.withdrawContract('C1');
  assert.deepEqual(asked.map(([p]) => p), ['/v1/writs/contract', '/v1/writs/contract-withdraw']);
  assert.deepEqual({ ...asked[0][1], rid: 'x' }, { character: 'char-1', region: DF, kind: 'raid', pay: 20, deeds: 10, rid: 'x' });
  assert.deepEqual({ ...asked[1][1], rid: 'x' }, { character: 'char-1', contract: 'C1', rid: 'x' });
  for (const e of ['guild-contracts', 'guild-contracts-max', 'contract-kind', 'contract-pay', 'contract-deeds', 'contract-gone', 'no-contract']) assert.ok(REFUSALS[e], e);
  assert.equal(REFUSALS['contract-pay'], 'A contract pays 1 to 50 silver a defender.');
});

// ─── THE WORK TAB ────────────────────────────────────────────────────────────────────────────────────────────────────

const noticesStub = () => ({
  seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: { canPin: true } } }), markSeen() {}, cached: () => null,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }),
});
function workRig(data) {
  const calls = [];
  const profBook = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 0, writs: async () => ({ data, error: null, stale: false }) };
  const writs = {
    busy: false, state: {},
    withdrawContract: async (id) => { calls.push(['withdrawContract', id]); return { ok: true, data: {} }; },
    contract: async (req) => { calls.push(['contract', req]); return { ok: true, data: {} }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const host = document.createElement('div');
  mountNoticeBoard(host, {
    town: { name: 'Daggerfall', mapId: 5 }, book: noticesStub(), answer: () => ({ ok: true }),
    work: {
      book: profBook, region: DF, regionName: 'Daggerfall', countName: (k, n) => materialCountLabel(k, n), writs,
      regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], pieces: () => [], settle: () => writs.settle(),
    },
  });
  return { host, calls };
}
const contractData = (over = {}) => ({
  writs: [], today: { filled: 0, max: 3 }, guildWrits: [], commissions: [], yours: { commissions: [], guildWrits: [] },
  contracts: [
    { id: 'C1', kind: 'raid', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH' }, region: DF, pay: 40, deeds: 10, left: 7, escrow: 280, at: 0, expiresAt: T0 + 5 * DAY, state: 'open', mine: false, may: true },
    { id: 'C2', kind: 'raid', guild: { id: 'g2', name: 'The Hound', tag: 'HND' }, region: DF, pay: 20, deeds: 3, left: 1, escrow: 20, at: 0, expiresAt: T0 + 2 * DAY, state: 'open', mine: false, may: false },
  ],
  yoursContracts: [{ id: 'C9', kind: 'raid', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH' }, region: WR, pay: 10, deeds: 5, left: 5, escrow: 50, at: 0, expiresAt: T0 + 3 * DAY, state: 'open', mine: true, may: true }],
  contractPost: true,
  guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', rank: 1, mayPost: true, marks: 5_000, budget: 500, spent: 120, left: 380 },
  balance: 1_234, writsOpen: true, me: 'Me', ...over,
});

test('SILVER-WAYS the Work tab\'s contracts: each a card under its guild - what it pays a defender, how many are left, the time left; the reader\'s own guild\'s Officers told they are not paid; Withdraw where the rank may; "Yours" every region; the post form says every bound before the press - the treasury, the budget, the five (mutants: a card unshown; the posters\' word; the budget unsaid)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { host, calls } = workRig(contractData());
  await ticks();
  byClass(host, 'notice-tab')[1].click();
  await ticks();
  const cards = byClass(host, 'notice-writ');
  assert.equal(cards.length, 2);
  assert.match(cards[0].textContent, /Guild contractThe Silver Hand \[SH\] pays the defenders of Daggerfall's towns against raiders/);
  assert.match(cards[0].textContent, /40 silver each - 7 defenders left of 10/);
  assert.match(cards[0].textContent, /5 days left/);
  assert.match(cards[0].textContent, /Your guild's Officers and Guildmaster are not paid by its contracts\./, 'an Officer of the posting guild');
  assert.match(cards[1].textContent, new RegExp(`paid as your raid is counted, less ${marksText(saleTax(20))} tax`));
  assert.equal(byClass(cards[1], 'work-withdraw').length, 0, 'another guild\'s: no Withdraw');
  byClass(cards[0], 'work-withdraw')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['withdrawContract', 'C1']);
  assert.match(host.textContent, /The Silver Hand \[SH\]: 10 silver to each of 5 defenders more/);
  assert.match(host.textContent, /Wayrest · 3 days left/);
  // the form
  const open = byClass(host, 'work-open').find((b) => b.textContent === 'Post a guild contract');
  assert.ok(open, 'offered to a rank that may post');
  open.click();
  await ticks();
  const form = byClass(host, 'work-form')[0];
  assert.match(form.textContent, /Post a guild contract - The Silver Hand \[SH\]/);
  assert.match(form.textContent, /Holds 200 silver from the guild's treasury \(it holds 5,000 silver\)/);
  assert.match(form.textContent, /Your writ budget this week: 380 silver of 500 silver left\./);
  const deeds = form.querySelectorAll('input').find((i) => i.getAttribute('data-focus') === 'contract|deeds');
  deeds.value = '20'; deeds.oninput();
  assert.match(form.textContent, /That is past your writ budget this week \(380 silver left\)\./);
  assert.equal(byClass(form, 'work-post')[0].disabled, true);
  deeds.value = '5'; deeds.oninput();
  byClass(form, 'work-post')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['contract', { region: DF, kind: 'raid', pay: 20, deeds: 5 }]);
  // a rank that may not post is offered no form
  const member = workRig(contractData({ contractPost: false, guild: { ...contractData().guild, rank: 2, mayPost: false } }));
  await ticks();
  byClass(member.host, 'notice-tab')[1].click();
  await ticks();
  assert.equal(byClass(member.host, 'work-open').some((b) => b.textContent === 'Post a guild contract'), false);
});

// ─── THE GUILD TAB AND THE HOST ──────────────────────────────────────────────────────────────────────────────────────

test('SILVER-WAYS the Guild tab\'s treasury lines: a deed, a contract put up and what came home each in its own words, never a deposit; the service\'s kinds map to them (mutants: a kind left a deposit)', () => {
  assert.deepEqual([GUILD_MARKS_LEDGER_WORDS.deed, GUILD_MARKS_LEDGER_WORDS.contract, GUILD_MARKS_LEDGER_WORDS['contract-return']],
    ['completed a guild deed:', 'put up a contract of', 'came home with']);
  const g = src('server-account/src/guilds.js');
  assert.match(g, /'guild-withdraw': 'withdraw', heraldry: 'heraldry', 'guild-deed': 'deed', 'contract-escrow': 'contract', 'contract-return': 'contract-return',/);
  assert.match(g, /kind: GUILD_MARKS_LINE_KIND\[l\.kind\] \?\? 'deposit'/);
});

test('SILVER-WAYS the world host by source: the raid claims say the book\'s silver lines; the gate claim carries the claiming character whether or not the scan found the region; a guild with a contract standing is kept from going (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  // HAUL-CARDS (PIN MOVED): the silver as cards too (ui/haulCards.js claimHauls), the book's lines said as ever
  assert.match(w, /onMarks: \(data\) => \{ showHaul\(claimHauls\(data, 'raid'\)\); return marksBook\?\.claimLines\(data, 'raid'\) \?\? null; \},/);
  assert.match(w, /onMarks: \(marks, data\) => \{ showHaul\(claimHauls\(data \?\? \{ marks \}, 'gate'\)\); return marksBook\?\.claimLines\(data \?\? \{ marks \}, 'gate'\) \?\? null; \},/);
  assert.match(w, /return site \? \{ region: site\.region, character \} : character \? \{ character \} : null;/);
  assert.match(src('server-account/src/guilds.js'), /OR EXISTS \(SELECT 1 FROM guild_contracts WHERE guild_id = \$\{p\} AND \(state = 'open' OR \(returned = 0 AND escrow > 0\)\)\)/);
});
