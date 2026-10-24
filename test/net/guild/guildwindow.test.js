// GUILD-WINDOW (2026-10-23, the owner: "overhaul the guild tab to be more of a full fledged detailed window with easy
// navigation and readabity instead of being stuffed as a small window in the social tab") - THE GUILD TAB IS A WINDOW
// OF ITS OWN (bible/11-Multiplayer/Guild-Overhaul.md GUILD-WINDOW): the panel in its guild mode while the Guild tab is
// up, its Social button back to the tab last up (the social tabs' badges summed on it), the social door never the
// window's, the pages a column with their names, counts and what each holds (the arrow keys walk it, and no arrow in
// the window is the world's), each page's sections in cards, the last act's words in the window's foot, the focus kept
// in the window, the scrolls kept across a repaint, and the window's own rules in the sheet - with AUDIT GUILD-WINDOW's
// sixteen findings pinned where a pin can hold them. GUILD2's pins (guild2_client.test.js) hold everything inside the
// pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GUILD_RANK_NAMES } from '../../../src/net/guild/guildLaw.js';
import { GuildBook } from '../../../src/net/guild/guildBook.js';
import { readFileSync } from 'node:fs';
import { createSocialPanel, SOCIAL_CSS, guildPageWords, guildPageNames, guildOnlineText, GUILD_SMALL_QUERY } from '../../../src/ui/socialPanel.js';
import { SocialState } from '../../../src/net/social.js';

const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, hallGold: 30_000, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: WOLF, renamedAt: null, renameAt: null,
  vault: { used: 1, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, ...over,
});

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; },
    remove() {},
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
const settle = () => new Promise((r) => setImmediate(r));

async function rig(guild = view(), { vaultItems = [], noBook = false, small = false } = {}) {
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    vault: async () => ({ ok: true, data: { vault: { max: 50, items: vaultItems, log: [], me: guild.vault.me } } }),
    vaultTake: async () => ({ ok: false, error: 'guild-vault-empty' }),
  };
  const pack = { items: () => [], add() {}, changed() {}, reach: () => true };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack, realm: { act: async ({ call }) => call(7) } });
  const doc = fakeDocument();
  const social = new SocialState({ acct: 'a' });
  const win = { addEventListener() {}, removeEventListener() {}, matchMedia: (q) => ({ matches: small && q === GUILD_SMALL_QUERY }) };
  const panel = createSocialPanel({ social, guild: noBook ? null : book, doc, win, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 4; i++) { await settle(); panel.render(); } };
  return { panel, doc, book, go, social, root: panel.root };
}
/** A key pressed on `target` and come up to the panel's root - the root's listeners are where the window hears keys. */
const press = (t, target, code, extra = {}) => t.root.fire('keydown', { code, target, ...extra });
const tabOf = (t, page) => find(t.root, 'dfsocial-subtab').find((b) => b.dataset.page === page);
const pageUp = (t) => one(t.root, 'dfguild-main').dataset.page;

test('GUILD-WINDOW the Guild tab is the window: the panel in its guild mode, named Guild (and its Close so), the social tabs put away behind its Social button - which goes back to the tab last up, the focus with it; a panel with no guild book has no such button and never leaves its social mode (mutants: the mode unwritten; the name unmoved; the way back to Friends always; the Close misnamed; the focus left behind)', async () => {
  const t = await rig();
  assert.equal(t.root.dataset.mode, 'social', 'made social');
  t.panel.open();
  find(t.root, 'dfsocial-tab').find((b) => b.dataset.tab === 'party').fire('click');
  assert.deepEqual([t.root.dataset.mode, one(t.root, 'dfsocial-title').textContent, t.root.attrs['aria-label']], ['social', 'Social', 'Friends and party']);
  await t.go();
  assert.deepEqual([t.panel.tab(), t.root.dataset.mode, one(t.root, 'dfsocial-title').textContent, t.root.attrs['aria-label']], ['guild', 'guild', 'Guild', 'Guild']);
  assert.equal(one(t.root, 'dfsocial-close').attrs['aria-label'], 'Close guild', 'AUDIT W11');
  const back = one(t.root, 'dfsocial-back');
  assert.equal(back.parent, one(t.root, 'dfsocial-head'), 'in the window\'s own head');
  assert.equal(back.attrs['aria-label'], 'Back to Social', 'AUDIT W11: its name holds the word it shows');
  back.fire('click');
  assert.deepEqual([t.panel.tab(), t.root.dataset.mode, one(t.root, 'dfsocial-title').textContent, one(t.root, 'dfsocial-close').attrs['aria-label']], ['party', 'social', 'Social', 'Close social'], 'back to the Party tab it came from');
  assert.equal(t.doc.activeElement, find(t.root, 'dfsocial-tab').find((b) => b.dataset.tab === 'party'), 'AUDIT W10: the focus on the tab come back to, never left on a button put away');
  const bare = await rig(view(), { noBook: true });
  bare.panel.open();
  assert.equal(find(bare.root, 'dfsocial-back').length, 0);
  assert.equal(bare.panel.openGuild(), false);
  assert.equal(bare.root.dataset.mode, 'social');
});

test('GUILD-WINDOW AUDIT W5/W16: the social door - the chat\'s Social button, the interact key with no one in front - opens the social panel, never the Guild window it was last left on; and in the window the social tabs\' badges stand summed on its Social button (mutants: the door left on the guild; the badge unsummed; the badge unread on the live pass)', async () => {
  const t = await rig();
  await t.go('vault');   // the hall's chest
  t.panel.close();
  t.panel.toggle();
  assert.deepEqual([t.panel.tab(), t.root.dataset.mode], ['friends', 'social'], 'the toggle: the tab last up before the window');
  t.panel.close();
  await t.go('members');
  t.panel.close();
  t.panel.open();
  assert.deepEqual([t.panel.tab(), t.root.dataset.mode], ['friends', 'social'], 'and the open');
  await t.go('members');
  const badge = one(t.root, 'dfguild-backbadge');
  assert.equal(badge.parent, one(t.root, 'dfsocial-back'));
  assert.equal(badge.textContent, '', 'nothing waiting');
  t.social.in = [{ acct: 'b', name: 'Bran' }, { acct: 'c', name: 'Cass' }];
  t.panel.render();   // the live pass: no version moved
  assert.equal(badge.textContent, '2', 'two requests waiting on Friends, said where Friends is put away');
});

test('GUILD-WINDOW the column of pages: each page its name and the words under it in the player\'s language, its count where it has one - the members and the vault; one tab in the Tab order, the one up; its orientation as it is drawn (AUDIT W9, W11) (mutants: a count lost; the words unread; the names unread; every tab in the Tab order; the orientation fixed)', async () => {
  const t = await rig();
  await t.go();
  const nav = one(t.root, 'dfguild-nav');
  assert.ok(String(nav.className).split(/\s+/).includes('dfsocial-subtabs'), 'GUILD2\'s strip, a column now');
  assert.equal(nav.attrs['aria-orientation'], 'vertical');
  const words = guildPageWords(), names = guildPageNames();
  assert.deepEqual([names.overview, names.settings, words.vault], ['Overview', 'Settings', 'The pieces the guild keeps']);
  assert.deepEqual(find(nav, 'dfsocial-subtab').map((b) => [b.dataset.page, one(b, 'dfguild-navlabel').textContent, one(b, 'dfguild-navcount')?.textContent ?? null, one(b, 'dfguild-navsub').textContent, b.attrs.tabindex]), [
    ['overview', names.overview, null, words.overview, '0'], ['members', names.members, '1/75', words.members, '-1'],
    ['treasury', names.treasury, null, words.treasury, '-1'], ['vault', names.vault, '1/50', words.vault, '-1'],
    ['arms', names.arms, null, words.arms, '-1'], ['settings', names.settings, null, words.settings, '-1'],
  ]);
  const main = one(t.root, 'dfguild-main');
  assert.deepEqual([main.attrs.role, main.attrs['aria-label']], ['tabpanel', 'Overview'], 'the panel its tabs show, named for its page');
  const small = await rig(view(), { small: true });
  await small.go();
  assert.equal(one(small.root, 'dfguild-nav').attrs['aria-orientation'], 'horizontal', 'a row across a small screen');
});

test('GUILD-WINDOW AUDIT W3/W4/W10: the window\'s arrow keys - on the column of pages they turn the page both ways round, the focus with it; anywhere else in the window they are kept from the world and left to the browser; a field\'s caret and a list\'s choice their own; a held key turns one page; the focus comes into the window with it and back to the page\'s tab when a press draws the page again (mutants: the walk one way; a key not ours stopped; the world handed an arrow; a repeat turning; no focus in; the focus lost to a press)', async () => {
  const t = await rig();
  await t.go();
  assert.equal(t.doc.activeElement, tabOf(t, 'overview'), 'into the window, the focus on the page\'s tab');
  const down = press(t, tabOf(t, 'overview'), 'ArrowDown');
  assert.deepEqual([pageUp(t), !!down.prevented, !!down.stopped], ['members', true, true]);
  assert.equal(t.doc.activeElement, tabOf(t, 'members'), 'the focus on the page turned to');
  press(t, tabOf(t, 'members'), 'ArrowUp'); press(t, tabOf(t, 'overview'), 'ArrowLeft');
  assert.equal(pageUp(t), 'settings', 'up from the first is the last');
  press(t, tabOf(t, 'settings'), 'ArrowRight');
  assert.equal(pageUp(t), 'overview', 'and on from the last the first');
  const held = press(t, tabOf(t, 'overview'), 'ArrowDown', { repeat: true });
  assert.deepEqual([pageUp(t), !!held.prevented, !!held.stopped], ['overview', true, true], 'a repeat turns nothing, and is still the window\'s');
  const card = one(one(t.root, 'dfguild-main'), 'dfguild-card');
  const inPage = press(t, card, 'ArrowDown');
  assert.deepEqual([pageUp(t), !!inPage.prevented, !!inPage.stopped], ['overview', false, true], 'in the page: the browser\'s scroll, never the world\'s Professions door');
  const other = press(t, tabOf(t, 'overview'), 'KeyW');
  assert.deepEqual([pageUp(t), !!other.prevented, !!other.stopped], ['overview', false, false], 'a key not an arrow goes on to the world');
  const field = { tagName: 'INPUT', parent: card }, list = { tagName: 'SELECT', parent: card };
  for (const target of [field, list]) {
    const e = press(t, target, 'ArrowDown');
    assert.deepEqual([pageUp(t), !!e.prevented, !!e.stopped], ['overview', false, true], `${target.tagName}: its own caret or choice, and never the world's`);
  }
  await t.go('members');
  t.doc.activeElement = find(one(t.root, 'dfguild-main'), 'dfsocial-field')[0];   // the Invite field, say - then a look lands
  t.panel.openGuild();
  assert.equal(t.doc.activeElement, tabOf(t, 'members'), 'drawn again, the focus on the page\'s tab - never the document\'s body, where an arrow is the world\'s');
  t.panel.close();
  t.panel.open();   // the social panel: no focus taken
  const social = press(t, t.root, 'ArrowDown');
  assert.deepEqual([!!social.prevented, !!social.stopped], [false, false], 'the social mode keys nothing');
});

test('GUILD-WINDOW a page in cards and the window\'s foot: every section heading opens a card of its own, what stands before the first is a card too; the foot is always drawn, and the last act\'s words stand in it - never in the page\'s column (AUDIT W13) (mutants: the cards unmade; the heading not opening one; the words in the column; the foot only with words)', async () => {
  const t = await rig(view(), { vaultItems: [{ slot: 3, rec: null, name: 'Arrow', count: 25, by: 'Aldric', at: 99 }] });
  await t.go('members');
  const main = one(t.root, 'dfguild-main');
  assert.equal(main.parent, one(t.root, 'dfguild-layout'));
  assert.equal(one(t.root, 'dfguild-layout').children[0], one(t.root, 'dfguild-nav'), 'the column of pages beside the page');
  for (const sec of find(main, 'dfsocial-sec')) {
    assert.equal(sec.parent.className, 'dfguild-card', sec.textContent);
    assert.equal(sec.parent.children[0], sec, `${sec.textContent} heads its card`);
  }
  assert.deepEqual(main.children.map((c) => c.className), ['dfguild-card', 'dfguild-card'], 'Members, then Invite');
  const body = one(t.root, 'dfsocial-body');
  assert.deepEqual(body.children.map((c) => c.className.split(' ')[0]), ['dfsocial-letterhead', 'dfguild-layout', 'dfguild-foot']);
  assert.deepEqual([one(t.root, 'dfguild-foot').children.length, one(t.root, 'dfguild-foot').attrs.role], [0, 'status'], 'the foot drawn with nothing in it');
  await t.go('vault');
  find(t.root, 'dfsocial-btn').find((b) => b.textContent === 'Take').fire('click');
  for (let i = 0; i < 4; i++) { await settle(); t.panel.render(); }
  const said = one(t.root, 'dfguild-said');
  assert.ok(said, 'the answer said');
  assert.equal(said.parent, one(t.root, 'dfguild-foot'), 'in the foot, seen however far the page is scrolled');
  assert.equal(find(one(t.root, 'dfguild-main'), 'dfguild-said').length, 0);
  assert.ok(String(said.className).split(/\s+/).includes('dfsocial-err'), 'a refusal still dressed as one');
  const none = await rig(view());
  none.book.refresh = async () => {};
  none.panel.openGuild();
  const alone = one(none.root, 'dfguild-main');
  assert.ok(String(alone.className).split(/\s+/).includes('dfguild-alone'), 'looking: one column, no pages');
  assert.equal(alone.children[0].className, 'dfguild-card');
  assert.deepEqual(one(none.root, 'dfsocial-body').children.map((c) => c.className.split(' ')[0]), ['dfguild-main', 'dfguild-foot']);
});

test('GUILD-WINDOW the scrolls keep their places: drawn again on the same page, the page\'s column and the body (a short screen\'s) are where they were; another page starts at their top; the row of pages keeps its own across either (AUDIT W6, W12) (mutants: the place lost; the place carried to another page; the body\'s place lost; the row\'s place lost)', async () => {
  const t = await rig();
  await t.go('members');
  const body = one(t.root, 'dfsocial-body');
  const fill = body.replaceChildren;
  body.replaceChildren = (...cs) => { body.scrollTop = 0; fill(...cs); };   // a browser's worst case: the place clamped as the old content goes
  one(t.root, 'dfguild-main').scrollTop = 300; body.scrollTop = 120; one(t.root, 'dfguild-nav').scrollLeft = 80;
  t.panel.openGuild();   // a fresh look: the page drawn again
  assert.deepEqual([one(t.root, 'dfguild-main').dataset.page, one(t.root, 'dfguild-main').scrollTop, body.scrollTop, one(t.root, 'dfguild-nav').scrollLeft], ['members', 300, 120, 80]);
  t.panel.openGuild('settings');
  assert.deepEqual([!(one(t.root, 'dfguild-main').scrollTop > 0), body.scrollTop, one(t.root, 'dfguild-nav').scrollLeft], [true, 0, 80], 'Settings from its top, the row where it stood');
});

test('GUILD-WINDOW AUDIT W1: the invitation toast says where it ends, for the Guild window to start below it on a narrow screen - measured as it comes up and as its words change, never on a quiet frame (mutants: the foot unpublished; a quiet frame measured)', async () => {
  const t = await rig();
  const set = [];
  t.doc.documentElement = { style: { setProperty: (k, v) => set.push([k, v]) } };
  let reads = 0;
  t.panel.toast.getBoundingClientRect = () => { reads++; return { height: 117, bottom: 125 }; };
  const inv = { party: 'p1', from: { name: 'Bran the Unusually Long-Named' }, members: [{ name: 'Cass' }], expires: t.social.now() + 120_000 };
  t.social.invites.set('p1', inv);
  t.social.onInvite(inv);
  assert.deepEqual(set, [['--dfsocial-toast-b', '125px']], 'up: its foot published');
  const was = reads;
  t.panel.render();
  t.panel.render();
  assert.equal(reads, was, 'a quiet frame reads no layout');
});

test('GUILD-WINDOW the header\'s Members tile says how many are online, by the roster rows\' own reading - the reader always, a member inside the grace, never one past it or with no stamp - and reads it again on the live pass (mutants: the unstamped counted; the line painted once)', async () => {
  const now = 1_800_000_000_000, nowS = now / 1000;
  assert.equal(guildOnlineText([{ seenAt: nowS - 5 }, { seenAt: nowS - 86_400 }, { you: true, seenAt: 1 }, {}], now), '2 online');
  assert.equal(guildOnlineText([], now), '0 online');
  assert.equal(guildOnlineText(null, now), '0 online');
  const seen = Math.floor(Date.now() / 1000);
  const t = await rig(view({ members: [...view().members, { member: 'm2', name: 'Bran', rank: 2, joinedAt: 1, seenAt: seen, vault: null }] }));
  await t.go();
  const line = one(t.root, 'dfguild-statsub');
  assert.equal(line.textContent, '1 online', 'Bran at play; the reader with no stamp says nothing');
  t.book.guild.members.find((m) => m.member === 'm2').seenAt = seen - 86_400;
  t.panel.render();
  assert.equal(line.textContent, '0 online', 'his sitting lapsed: the live pass, no repaint');
});

test('GUILD-WINDOW the sheet: the window sized past every place the social mode takes (the chat\'s fits included), on dvh where the browser has it; beside the chat where the screen holds both; the social tabs put away, the Social button and its badge the window\'s alone; the touch sizes over the reading sizes; a small screen taken whole, a short one scrolled as one, and the toasts\' strip left to them (AUDIT W1, W2, W6, W7, W16) (mutants: a rule lost)', () => {
  const css = SOCIAL_CSS.replace(/\s+/g, ' ');
  const has = (rule, why) => assert.ok(css.includes(rule), why ?? rule);
  has(':root .dfsocial[data-mode="guild"][data-open], :root .dfsocial.touch[data-mode="guild"][data-open] { --dfguild-w: min(1060px, calc(100vw - 28px)); left: calc((100vw - var(--dfguild-w)) / 2); width: var(--dfguild-w); top: calc((100vh - min(740px, calc(100vh - 56px))) / 2); top: calc((100dvh - min(740px, calc(100dvh - 56px))) / 2); height: min(740px, calc(100vh - 56px)); height: min(740px, calc(100dvh - 56px)); max-height: none;');
  assert.ok(css.indexOf(':root .dfsocial[data-mode="guild"][data-open]') > css.indexOf(':root[data-dfchat-fit="below"] .dfsocial, :root[data-dfchat-fit="below"] .dfsocial.touch'), 'after the chat\'s fits, which it outweighs');
  has('@media (min-width: 1240px) and (min-height: 521px) { :root[data-dfchat-fit] .dfsocial[data-mode="guild"][data-open], :root[data-dfchat-fit] .dfsocial.touch[data-mode="guild"][data-open] { --dfguild-l: max(calc((100vw - var(--dfguild-w)) / 2), min(calc(26px + min(var(--dfchat-w, 440px), calc(100vw - 28px)) + env(safe-area-inset-left, 0px)), calc(100vw - 774px))); left: var(--dfguild-l); width: min(var(--dfguild-w), calc(100vw - 14px - var(--dfguild-l))); }', 'W7: beside the chat');
  has('.dfsocial[data-mode="guild"] .dfsocial-tabs { display: none; }');
  has('.dfsocial-back { display: none;');
  has('.dfsocial[data-mode="guild"] .dfsocial-back { display: block; }');
  has('.dfsocial.touch .dfsocial-back { min-height: 44px; padding: 4px 12px; }');
  has('.dfguild-backbadge:empty { display: none; }');
  has('.dfsocial[data-mode="guild"] .dfsocial-body { overflow: hidden; padding: 0; }', 'the page\'s column scrolls, not the window');
  has('.dfguild-main { flex: 1; min-width: 0; overflow-y: auto;');
  has('.dfsocial[data-mode="guild"] .dfguild-nav { width: 232px; flex-direction: column;');
  has('.dfguild-foot { flex: none; box-sizing: border-box; min-height: 34px;');
  has('.dfsocial.touch[data-mode="guild"] .dfguild-main .dfsocial-swatch { width: 44px; height: 44px; }', 'W2');
  has('.dfsocial.touch[data-mode="guild"] .dfguild-main .dfsocial-field { font-size: 16px; min-height: 44px; }', 'W2');
  assert.ok(css.indexOf('.dfsocial.touch[data-mode="guild"] .dfguild-main .dfsocial-swatch') > css.indexOf('.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-swatch { width: 24px'), 'after the reading sizes');
  has(`@media ${GUILD_SMALL_QUERY} { :root .dfsocial[data-mode="guild"][data-open], :root .dfsocial.touch[data-mode="guild"][data-open] { left: calc(6px + env(safe-area-inset-left, 0px)); top: calc(6px + env(safe-area-inset-top, 0px)); width: calc(100vw - 12px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)); height: calc(100vh - 12px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); height: calc(100dvh - 12px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); }`);
  assert.equal(GUILD_SMALL_QUERY, '(max-width: 760px), (max-height: 520px)');
  has('.dfguild-layout { flex-direction: column; }');
  has('.dfsocial[data-mode="guild"] .dfguild-nav { width: auto; flex: none; flex-direction: row; overflow-x: auto;');
  has('@media (max-height: 520px) { .dfsocial[data-mode="guild"] .dfsocial-body { overflow-y: auto; } .dfsocial[data-mode="guild"] .dfguild-layout { flex: none; } .dfsocial[data-mode="guild"] .dfguild-main { flex: none; overflow: visible; } .dfsocial[data-mode="guild"] .dfguild-nav { position: sticky; top: 0; z-index: 1; } .dfsocial[data-mode="guild"] .dfguild-foot { position: sticky; bottom: 0;', 'W6');
  has('@media (max-width: 600px) { :root:has(.dfsocial-toast[data-up="1"]) .dfsocial[data-mode="guild"][data-open], :root:has(.dfduel-toast[data-up="1"]) .dfsocial[data-mode="guild"][data-open] { --dfguild-t: max(calc(76px + env(safe-area-inset-top, 0px)), calc(var(--dfsocial-toast-b, 0px) + 6px)); top: var(--dfguild-t);', 'W1');
  has(':root:has(.dfduel-toast.second[data-up="1"]) .dfsocial[data-mode="guild"][data-open] { top: calc(144px + env(safe-area-inset-top, 0px));', 'W1: and below a second toast');
});

test('GUILD-WINDOW AUDIT W14: the status widget does not fold under the Guild window - the HUD\'s band reads the Social panel in its social mode alone (mutants: the window read again)', () => {
  const hud = readFileSync(new URL('../../../src/ui/enhanced/enhancedHud.js', import.meta.url), 'utf8');
  assert.ok(hud.includes(`const STAT_ABOVE = '.dfchat, .dfsocial[data-open="1"]:not([data-mode="guild"]), .wb-boss-bar,`));
});
