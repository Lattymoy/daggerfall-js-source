// GUILD-LIVE + GUILD-WRAP (2026-09-27, Discord: "Guild issues. Buttons not selectable until closed and reopened.
// Depositing stretches names a lot with a syllable on each line").
//
// GUILD-LIVE: the Guild tab's draft buttons (Found, Invite, Deposit, Withdraw, Rename ranks) were enabled once, at the
// build, and a keystroke rebuilds nothing under the caret - so an amount typed left Deposit dead until the panel was
// shut and opened. They read the draft on every keystroke and on the live pass now, and what a press does is read off
// the draft at the press. GUILD-WRAP: a roster row's acts are one group that wraps below the name (MAIL1's friends
// row), so a deposit's "a moment" on every button no longer squeezes a name to a syllable a line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GuildBook } from '../src/net/guildBook.js';
import { GUILD_RANK_NAMES } from '../src/net/guildLaw.js';
import { createSocialPanel } from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hound', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }], invites: [], ledger: [], ...over,
});
function fakeDoor() {
  const calls = [];
  const d = { calls, answers: {}, mineGuild: null, inviteList: [], hold: null };
  const reply = (route) => async (...args) => {
    calls.push([route, ...args]);
    if (d.hold) await d.hold;
    return d.answers[route] ?? { ok: true, data: {} };
  };
  d.mine = async (c) => { calls.push(['mine', c]); return { ok: true, data: { guild: d.mineGuild } }; };
  d.invites = async () => { calls.push(['invites']); return { ok: true, data: { invites: d.inviteList } }; };
  for (const r of ['found', 'invite', 'answer', 'leave', 'remove', 'rank', 'ranks', 'deposit', 'withdraw', 'handOver', 'disband']) d[r] = reply(r);
  return d;
}
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; },
    remove() { n.removed = true; },
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
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const button = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label);
const settle = () => new Promise((r) => setImmediate(r));
const field = (root, label) => find(root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);

async function rig(guild = view(), invites = []) {
  const door = fakeDoor();
  door.mineGuild = guild; door.inviteList = invites;
  const w = { gold: 50_000 };
  const book = new GuildBook({ door, character: () => 'char-a', wallet: () => ({ gold: () => w.gold, pay: (n) => { w.gold -= n; }, credit: (n) => { w.gold += n; } }), now: () => 1_000_000 });
  const panel = createSocialPanel({ social: new SocialState({ acct: 'acct-a' }), guild: book, doc: fakeDocument(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  const frame = async () => { await settle(); await settle(); panel.render(); };
  panel.openGuild(); await frame();
  return { door, panel, frame };
}

test('GUILD-LIVE: an amount typed brings Deposit alive at the keystroke - no repaint, no reopen - and the press puts in what is typed at the press; emptied, it is dead again and says why (mutants: the state read at the build alone; the amount captured at the build; a dead press acting)', async () => {
  const { door, panel } = await rig();
  const deposit = button(panel.root, 'Deposit');
  assert.equal(deposit.disabled, true, 'no amount, no deposit');
  const gold = field(panel.root, 'Gold');
  gold.value = '250'; gold.fire('input');
  assert.equal(button(panel.root, 'Deposit'), deposit, 'the same button - nothing was rebuilt under the caret');
  assert.equal(deposit.disabled, false, 'alive at the keystroke');
  assert.equal(deposit.whyEl?.textContent ?? '', '', 'and no reason beside it');
  gold.value = '300'; gold.fire('input');
  deposit.fire('click');
  await settle();
  assert.deepEqual(door.calls.find((c) => c[0] === 'deposit'), ['deposit', 'char-a', 300], 'the amount at the press');
  const again = await rig();
  const g2 = field(again.panel.root, 'Gold');
  g2.value = '5'; g2.fire('input');
  g2.value = ''; g2.fire('input');
  const d2 = button(again.panel.root, 'Deposit');
  assert.equal(d2.disabled, true);
  assert.equal(d2.whyEl.textContent, 'an amount');
  d2.fire('click');
  await settle();
  assert.equal(again.door.calls.some((c) => c[0] === 'deposit'), false, 'a dead button does nothing');
  // and one whose press WOULD act: a member's Withdraw, an amount typed, is the guildmaster's alone - dead, and its press
  // reaches no service
  const member = await rig(view({ rank: 2, members: [{ member: 'm1', name: 'Aldric', rank: 2, joinedAt: 1, you: true }] }));
  const mg = field(member.panel.root, 'Gold');
  mg.value = '10'; mg.fire('input');
  const w2 = button(member.panel.root, 'Withdraw');
  assert.equal(w2.disabled, true, 'the guildmaster\'s alone');
  w2.fire('click');
  await settle();
  assert.equal(member.door.calls.some((c) => c[0] === 'withdraw'), false, 'a dead press reaches nothing');
});

test('GUILD-LIVE: a field\'s value is the draft only through its keystroke (a frame alone moves nothing), and every draft button is a live one - Found, Invite, Withdraw, Rename ranks (mutants: a draft button built plain)', async () => {
  const none = await rig(null);
  const found = button(none.panel.root, 'Found');
  assert.equal(found.disabled, true);
  const name = field(none.panel.root, 'Guild name'), tag = field(none.panel.root, 'Tag');
  name.value = 'The Order'; tag.value = 'ORD';   // written without an input event: the frame's live pass reads them
  none.panel.render();
  assert.equal(found.disabled, true, 'a draft is written by its keystroke, and none came');
  name.fire('input'); tag.fire('input');
  assert.equal(found.disabled, false);
  const master = await rig(view({ members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }] }));
  const invite = button(master.panel.root, 'Invite');
  const handle = field(master.panel.root, 'Username');
  handle.value = 'Mara'; handle.fire('input');
  assert.equal(invite.disabled, false);
  const withdraw = button(master.panel.root, 'Withdraw');
  const gold = field(master.panel.root, 'Gold');
  gold.value = '10'; gold.fire('input');
  assert.equal(withdraw.disabled, false, 'the guildmaster withdraws what is typed');
  const S = src('src/ui/socialPanel.js');
  for (const label of ['Found', 'Invite', 'Deposit', 'Withdraw', 'Rename ranks']) {
    assert.match(S, new RegExp(`liveBtn\\('${label}', \\(\\) => \\(\\{ enabled: !g\\.busy`), `${label} is a live button`);
  }
  assert.match(S, /f\.addEventListener\('input', \(\) => \{ onInput\(f\.value\); paintLiveBtns\(\); \}\);/);
  assert.match(S, /ticking = \[\]; liveSubs = \[\]; liveBtns = \[\];/, 'a repaint forgets the last body\'s buttons');
});

test('GUILD-WRAP: a roster row\'s acts are one wrapping group, a guildmaster\'s four and an invitation\'s two; a row with none carries none (mutants: the acts on the row itself; the wrap class dropped)', async () => {
  const members = [
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true },
    { member: 'm2', name: 'Maraliandrelle', rank: 2, joinedAt: 2, you: false },
  ];
  const { panel } = await rig(view({ members }));
  const rowOf = (n) => find(panel.root, 'dfsocial-row').find((r) => texts(r).includes(n));
  const mara = rowOf('Maraliandrelle');
  assert.ok(mara.className.split(/\s+/).includes('wrap'));
  const acts = find(mara, 'dfsocial-rowacts');
  assert.equal(acts.length, 1);
  assert.deepEqual(acts[0].children.map((b) => b.textContent), ['Promote', 'Demote', 'Remove', 'Make guildmaster']);
  assert.equal(mara.children.filter((c) => String(c.className).includes('dfsocial-btn')).length, 0, 'no button straight on the row');
  const me = rowOf('Aldric (you)');
  assert.equal(find(me, 'dfsocial-rowacts').length, 0, 'my own row has no acts');
  const inv = await rig(null, [{ guild: 'g0123456789', name: 'The Hound', tag: 'HND', by: 'Aldric', at: 1 }]);
  const invRow = find(inv.panel.root, 'dfsocial-row').find((r) => texts(r).includes('The Hound [HND]'));
  assert.ok(invRow.className.split(/\s+/).includes('wrap'));
  assert.deepEqual(find(invRow, 'dfsocial-rowacts')[0].children.map((b) => b.textContent), ['Join', 'Decline']);
  assert.match(src('src/ui/socialPanel.js'), /\.dfsocial-why:empty \{ display: none; \}/);
});
