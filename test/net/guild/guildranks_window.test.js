// GUILD-RANKS and GUILD-REQUESTS (2026-10-30, the owner: "More guild ranks plus rank permission edits", "Player guild
// join requests"; bible/11-Multiplayer/Guild-Shop.md sections 13 and 14) - THE GUILD WINDOW'S RANKS PAGE AND ITS
// REQUESTS: the names edited four to eight and saved; the permission grid ticked and saved, or read; the requests to join
// answered on the Members page; a character in no guild asks one by its tag; a power the guild took away greys its button.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GUILD_RANK_NAMES, guildPowersOf } from '../../../src/net/guild/guildLaw.js';
import { GuildBook } from '../../../src/net/guild/guildBook.js';
import { setArmsDoor, _resetArmsBook } from '../../../src/net/guild/guildArmsBook.js';
import { createSocialPanel } from '../../../src/ui/socialPanel.js';
import { guildPowerName } from '../../../src/ui/guild/guildRanksPage.js';
import { guildAskedText } from '../../../src/ui/guild/guildRequestNodes.js';
import { SocialState } from '../../../src/net/social.js';

const table = (over = {}) => Object.fromEntries(Object.entries({ ...guildPowersOf(null, 4), ...over }).map(([p, r]) => [p, [...r]]));
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, foundedAt: 1_790_000_000, rank: 0, marks: 5_000,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }, { member: 'm2', name: 'Mara', rank: 3, joinedAt: 2, you: false }],
  invites: [], ledger: [], hall: null, heraldry: null, powers: table(),
  vault: { used: 1, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, logo: null, logoReview: null, ...over,
});

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); }, removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, remove() {},
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const buttons = (n) => find(n, 'dfsocial-btn');
const button = (n, label) => buttons(n).find((b) => b.children.length ? b.textContent === label || texts(b)[0] === label : b.textContent === label);
const settle = () => new Promise((r) => setImmediate(r));

const field = (n, label) => find(n, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);

async function rig(guild = view(), { requests = [] } = {}) {
  const asked = [];
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [], requests } }),
    ranks: async (c, names) => { asked.push(['ranks', names]); return { ok: true }; },
    powers: async (c, p) => { asked.push(['powers', p]); return { ok: true }; },
    request: async (c, tag) => { asked.push(['request', c, tag]); return { ok: true }; },
    requestWithdraw: async (c, g) => { asked.push(['requestWithdraw', c, g]); return { ok: true }; },
    requestAnswer: async (c, id, yes) => { asked.push(['requestAnswer', id, yes]); return { ok: true }; },
  };
  _resetArmsBook();
  setArmsDoor(door);
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack: { items: () => [], reach: () => true }, realm: { act: async ({ call }) => call(7) } });
  const doc = fakeDocument();
  const win = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc, win, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 5; i++) { await settle(); panel.render(); } };
  return { panel, root: panel.root, go, asked };
}

test('GUILD-RANKS the guildmaster\'s Ranks page: a field a rank, one added at the bottom and taken back, Save live on a change; the grid a power a row and a rank a column, a tick saved as the guild\'s table; Use the defaults pressed twice (mutants: Save on no change; the guildmaster\'s column drawn; a tick lost)', async () => {
  const t = await rig();
  await t.go('ranks');
  assert.equal(one(t.root, 'dfguild-main').dataset.page, 'ranks');
  assert.deepEqual(find(t.root, 'dfsocial-field').map((f) => f.value), [...GUILD_RANK_NAMES]);
  assert.equal(button(t.root, 'Save ranks').disabled, true, 'unchanged');
  assert.equal(button(t.root, 'Remove the lowest').disabled, true, 'four at least');
  button(t.root, 'Add a rank').fire('click');
  t.panel.render();
  assert.deepEqual(find(t.root, 'dfsocial-field').map((f) => f.value), [...GUILD_RANK_NAMES, 'Rank 5']);
  assert.equal(button(t.root, 'Save ranks').disabled, false);
  button(t.root, 'Save ranks').fire('click');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(t.asked.find((a) => a[0] === 'ranks'), ['ranks', [...GUILD_RANK_NAMES, 'Rank 5']]);
  // the grid: Officer, Member, Recruit - the guildmaster holds all, so no column of its own
  const grid = one(t.root, 'dfguild-grid');
  assert.deepEqual(grid.children[0].children.map((c) => c.textContent), ['', 'Officer', 'Member', 'Recruit']);
  assert.equal(grid.children.length, 12, 'a head and eleven powers');
  const box = (power, rank) => find(t.root, 'dfguild-grid')[0].children.flatMap((r) => r.children).flatMap((c) => c.children).find((b) => b.attrs['aria-label'] === `${guildPowerName(power)}: ${rank}`);
  assert.deepEqual([box('invite', 'Officer').checked, box('withdraw', 'Officer').checked, box('deposit', 'Recruit').checked], [true, false, true]);
  assert.equal(button(t.root, 'Save permissions').disabled, true);
  const w = box('withdraw', 'Officer');
  w.checked = true; w.fire('change');
  assert.equal(button(t.root, 'Save permissions').disabled, false, 'the live pass reads the tick');
  button(t.root, 'Save permissions').fire('click');
  await new Promise((r) => setImmediate(r));
  const sent = t.asked.find((a) => a[0] === 'powers')[1];
  assert.deepEqual(sent, { withdraw: [1] }, 'AUDIT GUILD-RANKS C1: only what differs from the defaults, so a default follows the guild as it grows');
  await t.go('ranks');
  button(t.root, 'Use the defaults').fire('click');
  t.panel.render();
  button(t.root, 'Sure? Defaults').fire('click');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(t.asked.filter((a) => a[0] === 'powers').at(-1), ['powers', {}]);
});

test('GUILD-RANKS a member reads the page: the ranks with their counts, the grid in marks, nothing to press; a power taken from its rank greys its button and says so (mutants: a member editing; the default read over the guild\'s)', async () => {
  const t = await rig(view({ rank: 2, members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1 }, { member: 'm2', name: 'Mara', rank: 2, joinedAt: 2, you: true }], powers: table({ deposit: [0, 1] }) }));
  await t.go('ranks');
  assert.equal(find(t.root, 'dfsocial-field').length, 0);
  assert.deepEqual(find(t.root, 'dfguild-rankrow').map((r) => r.textContent), ['1. Guildmaster - 1 member', '2. Officer - 0 members', '3. Member - 1 member', '4. Recruit - 0 members']);
  assert.equal(button(t.root, 'Save permissions'), undefined);
  const cells = one(t.root, 'dfguild-grid').children.find((r) => r.children[0].textContent === guildPowerName('deposit')).children.slice(1).map((c) => c.textContent);
  assert.deepEqual(cells, ['\u2713', '\u2013', '\u2013']);
  await t.go('treasury');
  const gold = field(t.root, 'Gold');
  gold.value = '10'; gold.fire('input');
  assert.equal(button(t.root, 'Deposit').disabled, true);
  assert.ok(texts(button(t.root, 'Deposit')).includes('not your rank\'s'));
});

test('GUILD-REQUESTS the Members page lists the requests to a rank that may invite, Accept and Decline answering by id; a character in no guild asks by tag, its own requests with Withdraw (mutants: the list to all; the tag unchecked)', async () => {
  const t = await rig(view({ requests: [{ id: 'q5', name: 'Fen', at: 1_790_000_000 }] }));
  await t.go('members');
  const secs = find(one(t.root, 'dfguild-main'), 'dfsocial-sec').map((n) => n.textContent);
  assert.ok(secs.includes('Requests to join (1)'), secs.join('|'));
  const row = find(t.root, 'dfsocial-row').find((r) => texts(r).includes('Fen'));
  button(row, 'Accept').fire('click');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(t.asked.find((a) => a[0] === 'requestAnswer'), ['requestAnswer', 'q5', true]);
  const member = await rig(view({ rank: 3, requests: undefined }));
  await member.go('members');
  assert.ok(!find(one(member.root, 'dfguild-main'), 'dfsocial-sec').some((n) => n.textContent.startsWith('Requests to join')));
  const none = await rig(null, { requests: [{ guild: 'g0000000001', character: 'rabc', name: 'The Pale Hand', tag: 'PALE', at: 1_790_000_000 }, { guild: 'g0000000002', character: 'other', name: 'Not Mine', tag: 'NOT', at: 1 }] });
  await none.go();
  const all = texts(none.root);
  // AUDIT GUILD-RANKS C2: the account's every request, the cap being the account's; another character's said so
  assert.ok(all.includes('The Pale Hand [PALE]') && all.includes('Not Mine [NOT]'));
  assert.ok(all.some((x) => /another character$/.test(x)));
  assert.equal(button(none.root, 'Send request').disabled, true, 'no tag yet');
  const tag = field(none.root, 'Guild tag');
  tag.value = 'iron'; tag.fire('input');
  assert.equal(button(none.root, 'Send request').disabled, false);
  button(none.root, 'Send request').fire('click');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(none.asked.find((a) => a[0] === 'request'), ['request', 'rabc', 'IRON']);
  const pale = find(none.root, 'dfsocial-row').find((r) => texts(r).includes('The Pale Hand [PALE]'));
  button(pale, 'Withdraw').fire('click');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(none.asked.find((a) => a[0] === 'requestWithdraw'), ['requestWithdraw', 'rabc', 'g0000000001']);
  assert.equal(guildAskedText(1_790_000_000, 1_790_000_000_000 + 3 * 86_400_000), 'sent 3 days ago');
});
