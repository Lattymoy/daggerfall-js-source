// GUILD1b (2026-09-25) - THE GUILD TAB: net/guildBook.js (the character's guild as the client holds it, and the gold's
// order around every act) and ui/socialPanel.js's fourth tab, over a fake door and a fake document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GuildBook, GUILD_FRESH_MS, GUILD_DEPOSIT_UNSURE, guildRefused } from '../src/net/guildBook.js';
import { GUILD_FOUND_GOLD, GUILD_RANK_NAMES } from '../src/net/guildLaw.js';
import {
  createSocialPanel, GUILD_SIGNED_OUT_TEXT, GUILD_LOOKING_TEXT, GUILD_NONE_TEXT, GUILD_FOUND_COST_TEXT, GUILD_GOLD_SHORT_TEXT, guildWordText,
} from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';
import { REFUSALS } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ─── THE FAKES ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A guild as the service's viewOf answers it. */
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hound', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }], invites: [], ledger: [], ...over,
});

/** A door whose answers the test sets, recording every call. */
function fakeDoor() {
  const calls = [];
  const d = {
    calls,
    answers: {},
    mineGuild: null,
    inviteList: [],
    say(route, r) { d.answers[route] = r; },
  };
  const reply = (route, ok = { ok: true, data: {} }) => async (...args) => { calls.push([route, ...args]); return d.answers[route] ?? ok; };
  d.mine = async (c) => { calls.push(['mine', c]); return d.answers.mine ?? { ok: true, data: { guild: d.mineGuild } }; };
  d.invites = async () => { calls.push(['invites']); return d.answers.invites ?? { ok: true, data: { invites: d.inviteList } }; };
  for (const r of ['found', 'invite', 'answer', 'leave', 'remove', 'rank', 'ranks', 'deposit', 'withdraw', 'handOver', 'disband']) d[r] = reply(r);
  return d;
}
function fakeWallet(start) {
  const w = { gold: start, paid: [], credited: [] };
  w.make = () => ({ gold: () => w.gold, pay: (n) => { w.gold -= n; w.paid.push(n); }, credit: (n) => { w.gold += n; w.credited.push(n); } });
  return w;
}
const bookOf = ({ gold = 50_000, character = 'char-a' } = {}) => {
  const door = fakeDoor();
  const w = fakeWallet(gold);
  let now = 1_000_000;
  const book = new GuildBook({ door, character: () => character, wallet: w.make, now: () => now });
  return { door, w, book, tick: (ms) => { now += ms; } };
};
const routes = (door) => door.calls.map((c) => c[0]);

// ─── THE BOOK ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1b the book: a look reads the character\'s guild and the account\'s invitations; no session is signed out, a guest is a guest, another refusal an error; a look is stale after GUILD_FRESH_MS; the version moves only when what it holds does (mutants: the character unread, the guest read as an error, a look always moving the version)', async () => {
  const { door, book, tick } = bookOf();
  assert.equal(book.state, 'unknown');
  assert.equal(book.stale(), true);
  door.mineGuild = view(); door.inviteList = [];
  await book.refresh();
  assert.equal(book.state, 'ready');
  assert.equal(book.guild.name, 'The Hound');
  assert.deepEqual(door.calls.find((c) => c[0] === 'mine'), ['mine', 'char-a'], 'asked as the character playing');
  const v = book.version;
  await book.refresh();
  assert.equal(book.version, v, 'the same answer moves nothing');
  assert.equal(book.stale(), false);
  tick(GUILD_FRESH_MS);
  assert.equal(book.stale(), true);
  door.say('mine', { ok: false, error: 'no-session' });
  await book.refresh();
  assert.deepEqual([book.state, book.guild], ['signed-out', null]);
  door.say('mine', { ok: false, error: 'guilds-need-account' });
  await book.refresh();
  assert.equal(book.state, 'guest');
  door.say('mine', { ok: false, error: 'offline' });
  await book.refresh();
  assert.deepEqual([book.state, book.error], ['error', 'offline']);
  const none = new GuildBook({ door: fakeDoor(), character: () => null, wallet: fakeWallet(0).make });
  await none.refresh();
  assert.deepEqual([none.state, none.error], ['error', 'guild-character'], 'no character, no guild to read');
});

test('GUILD1b founding: the purse must hold the fee before anything is asked; the service founds first and the purse pays after - purse, then bank, the wallet\'s order; a purse emptied while the answer was out disbands the guild it just founded and pays nothing; a refusal pays nothing (mutants: paid before the answer, the fee unchecked, the short founder keeping the guild)', async () => {
  const short = bookOf({ gold: GUILD_FOUND_GOLD - 1 });
  assert.deepEqual(await short.book.found('The Hound', 'HND'), { ok: false, error: 'gold' });
  assert.deepEqual(routes(short.door), [], 'nothing asked of the service');
  const { door, w, book } = bookOf({ gold: GUILD_FOUND_GOLD + 5 });
  const order = [];
  door.found = async () => { order.push(['found', w.gold]); return { ok: true, data: { guild: view() } }; };
  const r = await book.found('The Hound', 'HND');
  assert.equal(r.ok, true);
  assert.deepEqual(order, [['found', GUILD_FOUND_GOLD + 5]], 'the service answered while the gold was still in the purse');
  assert.deepEqual([w.paid, w.gold], [[GUILD_FOUND_GOLD], 5], 'and the fee is paid after');
  assert.ok(routes(door).includes('mine'), 'and the book looks again');
  // the purse moves while the answer is out
  const racing = bookOf({ gold: GUILD_FOUND_GOLD });
  racing.door.found = async () => { racing.w.gold = 10; return { ok: true, data: { guild: view() } }; };
  assert.deepEqual(await racing.book.found('The Hound', 'HND'), { ok: false, error: 'gold' });
  assert.ok(routes(racing.door).includes('disband'), 'the guild just founded goes again');
  assert.deepEqual(racing.w.paid, [], 'and nothing is paid');
  const refused = bookOf();
  refused.door.say('found', { ok: false, error: 'guild-name-taken' });
  assert.deepEqual(await refused.book.found('The Hound', 'HND'), { ok: false, error: 'guild-name-taken' });
  assert.deepEqual(refused.w.paid, []);
});

test('GUILD1b the treasury\'s gold: a deposit leaves the purse first and comes back on the service\'s REFUSAL - never on a lost answer, which may have landed; a withdrawal is the treasury\'s first and the purse\'s after, and a refused one gives nothing (mutants: a refund on a lost answer, no refund on a refusal, a withdrawal credited before or without the answer)', async () => {
  const { door, w, book } = bookOf({ gold: 1000 });
  assert.deepEqual(await book.deposit(1001), { ok: false, error: 'gold' });
  assert.deepEqual(await book.deposit(0), { ok: false, error: 'bad-gold' });
  assert.deepEqual(routes(door), [], 'neither asked');
  let seen = null;
  door.deposit = async (c, n) => { seen = [c, n, w.gold]; return { ok: true, data: { treasury: n } }; };
  assert.equal((await book.deposit(300)).ok, true);
  assert.deepEqual(seen, ['char-a', 300, 700], 'the purse paid before the treasury was asked');
  assert.deepEqual([w.gold, w.credited], [700, []]);
  door.deposit = async () => ({ ok: false, error: 'guild-treasury-full' });
  assert.deepEqual(await book.deposit(100), { ok: false, error: 'guild-treasury-full' });
  assert.deepEqual([w.gold, w.credited], [700, [100]], 'refused: it comes back');
  for (const lost of ['offline', 'server']) {
    door.deposit = async () => ({ ok: false, error: lost });
    const before = w.gold;
    assert.deepEqual(await book.deposit(50), { ok: false, error: 'guild-unsure' });
    assert.equal(w.gold, before - 50, `${lost}: the gold may be in the treasury, so it does not come back`);
  }
  assert.deepEqual([guildRefused('guild-rank'), guildRefused('offline'), guildRefused('server')], [true, false, false]);
  // withdraw
  let at = null;
  door.withdraw = async (c, n) => { at = w.gold; return { ok: true, data: { treasury: 0 } }; };
  const g = w.gold;
  assert.equal((await book.withdraw(200)).ok, true);
  assert.deepEqual([at, w.gold], [g, g + 200], 'the treasury gave first, the purse took after');
  door.withdraw = async () => ({ ok: false, error: 'guild-rank' });
  const g2 = w.gold;
  assert.deepEqual(await book.withdraw(200), { ok: false, error: 'guild-rank' });
  assert.equal(w.gold, g2);
});

test('GUILD1b the other acts: each goes through the door as the character playing, then the book looks again; `busy` stands while one is out (mutants: an act as another character, no look after)', async () => {
  const { door, book } = bookOf();
  door.mineGuild = view();
  const acts = [
    ['invite', () => book.invite('Mara'), ['invite', 'char-a', 'Mara']],
    ['answer', () => book.answer('g0123456789', true), ['answer', { character: 'char-a', guild: 'g0123456789', accept: true }]],
    ['leave', () => book.leave(), ['leave', 'char-a']],
    ['remove', () => book.remove('m2'), ['remove', 'char-a', 'm2']],
    ['rank', () => book.rank('m2', 1), ['rank', 'char-a', 'm2', 1]],
    ['ranks', () => book.renameRanks(['A', 'B', 'C', 'D']), ['ranks', 'char-a', ['A', 'B', 'C', 'D']]],
    ['handOver', () => book.handOver('m2'), ['handOver', 'char-a', 'm2']],
    ['disband', () => book.disband(), ['disband', 'char-a']],
  ];
  for (const [route, run, want] of acts) {
    door.calls.length = 0;
    const p = run();
    assert.equal(book.busy, true, `${route}: busy while out`);
    await p;
    assert.deepEqual(door.calls[0], want);
    assert.ok(routes(door).includes('mine'), `${route}: and a look after`);
    assert.equal(book.busy, false);
  }
  assert.equal((await book.answer('g0123456789', 'yes')).ok, true);
  assert.equal(door.calls.find((c) => c[0] === 'answer')[1].accept, false, 'only a true accept is an acceptance');
});

// ─── THE TAB ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
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
const fakeWin = () => ({ addEventListener() {}, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const buttons = (root, label) => find(root, 'dfsocial-btn').filter((b) => b.textContent === label || b.children[0]?.textContent === label || String(b.textContent).startsWith(label));
const button = (root, label) => buttons(root, label)[0];
const settle = () => new Promise((r) => setImmediate(r));

async function tabRig({ guild = view(), invites = [], state = 'ready', gold = 50_000 } = {}) {
  const { door, w, book } = bookOf({ gold });
  door.mineGuild = guild; door.inviteList = invites;
  if (state === 'signed-out') door.say('mine', { ok: false, error: 'no-session' });
  if (state === 'guest') door.say('mine', { ok: false, error: 'guilds-need-account' });
  const social = new SocialState({ acct: 'acct-a' });
  const panel = createSocialPanel({ social, guild: book, doc: fakeDocument(), win: fakeWin(), overlay: () => false, touch: false });
  const frame = async () => { await settle(); await settle(); panel.render(); };
  return { door, w, book, panel, frame };
}

test('GUILD1b the tab: a fourth tab only where the host hands a guild book; it says it is looking until the first answer, and signed out or a guest it says why (mutants: the tab without a book, the guest\'s sentence lost)', async () => {
  const bare = createSocialPanel({ social: new SocialState({ acct: 'a' }), doc: fakeDocument(), win: fakeWin(), overlay: () => false, touch: false });
  assert.deepEqual(find(bare.root, 'dfsocial-tab').map((t) => t.dataset.tab), ['friends', 'party']);
  assert.equal(bare.openGuild(), false);
  const { panel, frame } = await tabRig();
  assert.deepEqual(find(panel.root, 'dfsocial-tab').map((t) => t.dataset.tab), ['friends', 'party', 'guild']);
  panel.openGuild(); panel.render();
  assert.equal(panel.tab(), 'guild');
  assert.ok(texts(panel.root).includes(GUILD_LOOKING_TEXT));
  await frame();
  assert.ok(texts(panel.root).includes('The Hound [HND]'));
  const out = await tabRig({ state: 'signed-out' });
  out.panel.openGuild(); await out.frame();
  assert.ok(texts(out.panel.root).includes(GUILD_SIGNED_OUT_TEXT));
  const guest = await tabRig({ state: 'guest' });
  guest.panel.openGuild(); await guest.frame();
  assert.ok(texts(guest.panel.root).includes(REFUSALS['guilds-need-account']));
});

test('GUILD1b no guild: the invitations, joined or declined as this character, and the badge counting them; the founding form says its cost, and Found stands disabled until the name and the tag are the law\'s shape (mutants: Found enabled on a bad shape, Join answering no, the badge lost)', async () => {
  const invites = [{ guild: 'g0123456789', name: 'The Hound', tag: 'HND', by: 'Aldric', at: 1 }];
  const { door, panel, frame } = await tabRig({ guild: null, invites });
  panel.openGuild(); await frame();
  const all = texts(panel.root);
  assert.ok(all.includes(GUILD_NONE_TEXT) && all.includes(GUILD_FOUND_COST_TEXT));
  assert.ok(all.includes('The Hound [HND]') && all.includes('invited by Aldric'));
  const tab = find(panel.root, 'dfsocial-tab').find((t) => t.dataset.tab === 'guild');
  assert.equal(find(tab, 'dfsocial-badge')[0].textContent, '1', 'an invitation waiting');
  assert.equal(button(panel.root, 'Found').disabled, true, 'no name, no guild');
  const [name, tagField] = find(panel.root, 'dfsocial-field');
  name.value = 'The Order'; name.fire('input');
  tagField.value = 'ord'; tagField.fire('input');
  panel.render();
  // a repaint keeps what was typed
  panel.openGuild(); await frame();
  const [name2, tag2] = find(panel.root, 'dfsocial-field');
  assert.deepEqual([name2.value, tag2.value], ['The Order', 'ord'], 'the draft survives a repaint');
  assert.equal(button(panel.root, 'Found').disabled, false);
  button(panel.root, 'Join').fire('click');
  await frame();
  assert.deepEqual(door.calls.find((c) => c[0] === 'answer'), ['answer', { character: 'char-a', guild: 'g0123456789', accept: true }]);
});

test('GUILD1b the officer\'s view: members and recruits promoted and demoted within the ranks below, never an officer touched; Remove arms and the second press removes; Withdraw disabled as the guildmaster\'s alone; the ledger drawn; no rank names to change (mutants: an officer promoting to officer, Remove in one press, Withdraw offered to an officer)', async () => {
  const members = [
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: false },
    { member: 'm2', name: 'Mara', rank: 1, joinedAt: 2, you: true },
    { member: 'm3', name: 'Bran', rank: 2, joinedAt: 3, you: false },
    { member: 'm4', name: 'Cass', rank: 3, joinedAt: 4, you: false },
  ];
  const ledger = [{ at: 5, who: 'Cass', kind: 'deposit', amount: 500, balance: 500 }];
  const { door, panel, frame } = await tabRig({ guild: view({ rank: 1, members, treasury: 500, ledger }) });
  panel.openGuild(); await frame();
  const rowOf = (n) => find(panel.root, 'dfsocial-row').find((r) => texts(r).includes(n));
  assert.equal(buttons(rowOf('Aldric'), 'Promote').length + buttons(rowOf('Aldric'), 'Remove').length, 0, 'the guildmaster is not an officer\'s to touch');
  assert.equal(buttons(rowOf('Bran'), 'Promote').length, 0, 'a member is never made an officer by an officer');
  assert.equal(buttons(rowOf('Bran'), 'Demote').length, 1);
  assert.equal(buttons(rowOf('Cass'), 'Promote').length, 1);
  assert.equal(buttons(rowOf('Mara (you)'), 'Remove').length, 0);
  button(rowOf('Cass'), 'Remove').fire('click');
  assert.equal(buttons(rowOf('Cass'), 'Sure?').length, 1, 'armed');
  assert.ok(!door.calls.some((c) => c[0] === 'remove'), 'nothing removed yet');
  button(rowOf('Cass'), 'Sure?').fire('click');
  await frame();
  assert.deepEqual(door.calls.find((c) => c[0] === 'remove'), ['remove', 'char-a', 'm4']);
  const gold = find(panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Gold');
  gold.value = '100'; gold.fire('input');
  panel.openGuild(); await frame();
  assert.equal(button(panel.root, 'Deposit').disabled, false, 'an amount typed: anyone deposits');
  assert.equal(button(panel.root, 'Withdraw').disabled, true, 'but only the guildmaster withdraws');
  assert.ok(texts(button(panel.root, 'Withdraw')).includes('the guildmaster\'s alone'));
  assert.ok(texts(panel.root).includes('Cass put in 500'));
  assert.equal(buttons(panel.root, 'Rename ranks').length, 0);
  assert.equal(buttons(panel.root, 'Disband').length, 0);
});

test('GUILD1b the guildmaster\'s view: alone with gold in the treasury, Leave and Disband stand disabled and say to take the gold out; with the treasury empty, Disband arms and the second press disbands; with members, Leave says to hand the guild on; the rank names are theirs to change (mutants: a disband with gold in it, leaving members behind, a rename offered to nobody)', async () => {
  const rich = await tabRig({ guild: view({ treasury: 40 }) });
  rich.panel.openGuild(); await rich.frame();
  assert.equal(button(rich.panel.root, 'Disband').disabled, true);
  assert.ok(texts(button(rich.panel.root, 'Disband')).includes('take the gold out first'));
  assert.equal(button(rich.panel.root, 'Leave').disabled, true);
  const poor = await tabRig({ guild: view({ treasury: 0 }) });
  poor.panel.openGuild(); await poor.frame();
  button(poor.panel.root, 'Disband').fire('click');
  button(poor.panel.root, 'Sure?').fire('click');
  await poor.frame();
  assert.ok(poor.door.calls.some((c) => c[0] === 'disband'));
  const members = [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }, { member: 'm2', name: 'Mara', rank: 3, joinedAt: 2, you: false }];
  const led = await tabRig({ guild: view({ members }) });
  led.panel.openGuild(); await led.frame();
  assert.ok(texts(button(led.panel.root, 'Leave')).includes('hand the guild on first'));
  assert.equal(buttons(led.panel.root, 'Rename ranks').length, 1);
  assert.equal(buttons(led.panel.root, 'Make guildmaster').length, 1);
});

test('GUILD1b the words: the purse\'s own sentence, the lost deposit\'s, and every other the service\'s (mutants: a lost deposit said as a refusal)', () => {
  assert.equal(guildWordText('gold'), GUILD_GOLD_SHORT_TEXT);
  assert.equal(guildWordText('guild-unsure'), GUILD_DEPOSIT_UNSURE);
  assert.equal(guildWordText('guild-rank'), REFUSALS['guild-rank']);
});

test('GUILD1b the host: world.js hands the panel a guild book over GUILD1a\'s door, as the character playing, paying from the purse and then the bank account of the region the player stands in (mutants: the book unhanded, the bank before the purse)', () => {
  const w = src('src/scenes/world.js');
  const made = w.slice(w.indexOf('guildBook = new GuildBook({'), w.indexOf('socialPanel = createSocialPanel({'));
  assert.match(made, /door: accountGuilds\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\) \}\)/);
  assert.match(made, /character: \(\) => characterIdOf\(playerEntity\)/);
  assert.match(made, /const short = deductGold\(playerEntity, n\); if \(account && short > 0\) account\.accountGold -= short;/, 'the purse first, the shortfall from the bank');
  assert.match(made, /playerEntity\.bankAccounts\[_questRegionIndex\(\) \?\? 0\]/, 'the region the player stands in');
  assert.match(w, /socialPanel = createSocialPanel\(\{\n\s+social,\n\s+mail,\n\s+guild: guildBook,/);
});
