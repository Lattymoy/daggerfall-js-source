// GUILD-SHOP (2026-10-30, the owner: "Redesign the guild menu and layout", "The new guild shop where you can purchase the
// insignia aura, guild furniture, guild profile icon, etc", "The ability for guilds to submit their own logos and approval
// on discord"; bible/11-Multiplayer/Guild-Shop.md) - THE GUILD WINDOW'S SHOP, ITS LOGO CARD AND ITS LOOK: the Shop page's
// wares by who pays, each with its price in silver and a Buy pressed twice; why a ware cannot be bought; the logo card's
// three states and the guildmaster's acts; the picker's square; the head's crest and the column's groups.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GUILD_RANK_NAMES } from '../../../src/net/guild/guildLaw.js';
import { GUILD_SHOP_WARES, GUILD_LOGO_FEE } from '../../../src/net/guild/guildShopLaw.js';
import { GUILD_LOGO_SIDE, GUILD_LOGO_MAX_BYTES } from '../../../src/net/guild/guildLogoLaw.js';
import { GuildBook } from '../../../src/net/guild/guildBook.js';
import { setArmsDoor, _resetArmsBook } from '../../../src/net/guild/guildArmsBook.js';
import { createSocialPanel, GUILD_SMALL_QUERY } from '../../../src/ui/socialPanel.js';
import { guildWareWhy, guildWareState } from '../../../src/ui/guild/guildShopPage.js';
import { guildWareSvg } from '../../../src/ui/guild/guildWareArt.js';
import { pickGuildLogo } from '../../../src/ui/guild/guildLogoPick.js';
import { GUILD_NAV_GROUPS, guildNavGroupAt, guildCrestSvg, GUILD_WINDOW_CSS } from '../../../src/ui/guild/guildWindowLook.js';
import { SocialState } from '../../../src/net/social.js';

const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, foundedAt: 1_790_000_000, rank: 0, marks: 5_000,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }], invites: [], ledger: [], hall: null, heraldry: WOLF,
  vault: { used: 1, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, logo: null, logoReview: null, ...over,
});
const shopOf = (over = {}) => ({
  open: true, marks: 1_000, guildMarks: 5_000, buysForGuild: true, ...over,
  wares: GUILD_SHOP_WARES.map((w) => (w.payer === 'account' ? { key: w.key, kind: w.kind, payer: w.payer, price: w.price, held: w.key === 'insigniaarmlet' }
    : { key: w.key, kind: w.kind, payer: w.payer, price: w.price, max: w.max, model: w.model, owned: w.key === 'throne' ? 1 : 0, placed: 0 })),
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

async function rig(guild = view(), shop = shopOf()) {
  const asked = [];
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    shop: async () => { asked.push(['shop']); return { ok: true, data: { shop } }; },
    shopBuy: async (c, ware, rid) => { asked.push(['buy', ware, rid]); return { ok: true, data: { shop } }; },
    logoWithdraw: async () => { asked.push(['withdraw']); return { ok: true }; }, logoClear: async () => { asked.push(['clear']); return { ok: true }; },
    logo: async (c, image, rid) => { asked.push(['logo', image, rid]); return { ok: true }; }, logoUrl: (id) => `https://acct.invalid/v1/guilds/logo/${id}`,
  };
  _resetArmsBook();
  setArmsDoor(door);
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack: { items: () => [], reach: () => true }, realm: { act: async ({ call }) => call(7) } });
  const doc = fakeDocument();
  const win = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc, win, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 5; i++) { await settle(); panel.render(); } };
  const tick = async () => { for (let i = 0; i < 5; i++) { await settle(); panel.render(); } };
  return { panel, root: panel.root, book, go, tick, asked, doc };
}

test('GUILD-SHOP why a ware waits, and what it says: silver closed; an account\'s ware held, or short of your silver; a guild\'s ware the guildmaster\'s, at its most, or short of the treasury (mutants: each refusal)', () => {
  const crest = { key: 'guildcrest', payer: 'account', price: 600, held: false };
  const throne = { key: 'throne', payer: 'guild', price: 4000, max: 1, owned: 0, placed: 0 };
  assert.equal(guildWareWhy({ open: false }, crest), 'silver is closed');
  assert.equal(guildWareWhy({ open: true, marks: 599 }, crest), 'not enough silver');
  assert.equal(guildWareWhy({ open: true, marks: 600 }, crest), null);
  assert.equal(guildWareWhy({ open: true, marks: 0 }, { ...crest, held: true }), null, 'held: nothing to buy, nothing refused');
  assert.equal(guildWareWhy({ open: true, guildMarks: 9e9, buysForGuild: false }, throne), 'the guildmaster buys these');
  assert.equal(guildWareWhy({ open: true, guildMarks: 9e9, buysForGuild: true }, { ...throne, owned: 1 }), 'the guild owns the most it may');
  assert.equal(guildWareWhy({ open: true, guildMarks: 3999, buysForGuild: true }, throne), 'the silver treasury is short');
  assert.equal(guildWareWhy({ open: true, guildMarks: 4000, buysForGuild: true }, throne), null);
  assert.equal(guildWareState({ ...throne, owned: 1, placed: 1 }), 'The guild owns 1 of 1. 1 set down.');
  assert.match(guildWareState({ ...crest, held: true }), /^You own this\. Choose it as your portrait icon/);
});

test('GUILD-SHOP the Shop page: read at each turn to it; a card for the purse, then the wares by who pays - each drawn, named, priced in silver; an account\'s ware held says so, a ware at its most says why; Buy pressed twice buys it under one request id, its use said in the foot (mutants: the read, the sections, the two presses, the rid)', async () => {
  const t = await rig();
  await t.go('shop');
  assert.equal(one(t.root, 'dfguild-main').dataset.page, 'shop');
  assert.equal(t.asked.filter((a) => a[0] === 'shop').length, 1, 'read once at the turn');
  const secs = find(one(t.root, 'dfguild-main'), 'dfsocial-sec').map((n) => n.textContent);
  assert.deepEqual(secs, ['Guild Shop', 'For you', 'For the hall']);
  const rows = find(t.root, 'dfguild-ware');
  assert.deepEqual(rows.map((r) => r.dataset.ware), GUILD_SHOP_WARES.map((w) => w.key));
  assert.ok(rows.every((r) => r.children[0].tagName === 'IMG' && r.children[0].src.startsWith('data:image/svg+xml')), 'each ware drawn, a picture of our own');
  const row = (k) => rows.find((r) => r.dataset.ware === k);
  assert.equal(one(row('insigniaarmlet'), 'dfguild-wareheld').textContent, 'Owned');
  assert.equal(one(row('guildcrest'), 'dfguild-wareprice').textContent, '600 silver');
  assert.equal(buttons(row('throne'))[0].disabled, true, 'the guild owns the one it may');
  assert.match(texts(buttons(row('throne'))[0]).join(' '), /the guild owns the most it may/);
  assert.equal(buttons(row('guildsails'))[0].disabled, true, '1,200 silver wanted, 1,000 held');
  button(row('guildcrest'), 'Buy').fire('click');
  await t.tick();
  const sure = buttons(find(t.root, 'dfguild-ware').find((r) => r.dataset.ware === 'guildcrest'))[0];
  assert.equal(texts(sure)[0], 'Sure? 600 silver');
  assert.equal(t.asked.filter((a) => a[0] === 'buy').length, 0, 'one press buys nothing');
  sure.fire('click');
  await t.tick();
  const buy = t.asked.find((a) => a[0] === 'buy');
  assert.equal(buy[1], 'guildcrest');
  assert.match(buy[2], /^[A-Za-z0-9_-]{8,}$/, 'under a request id');
  assert.match(one(t.root, 'dfguild-foot').children.map((c) => c.textContent).join(' '), /Guild Crest bought\. Choose it as your portrait icon/);
});

test('GUILD-LOGO the Arms page\'s logo card, over the arms: a member is told the guildmaster sends one; the guildmaster picks a picture and sends it, twice pressed, its fee from the treasury; a review under way withdrawn; an approved logo shown and taken down, twice pressed (mutants: the rank, the states, the acts)', async () => {
  const member = await rig(view({ rank: 3, members: [{ member: 'm1', name: 'Aldric', rank: 3, joinedAt: 1, you: true }] }));
  await member.go('arms');
  const secs = find(one(member.root, 'dfguild-main'), 'dfsocial-sec').map((n) => n.textContent);
  assert.deepEqual(secs.slice(0, 2), ['Guild logo', 'Arms'], 'the logo first, then the arms drawn');
  assert.ok(texts(member.root).includes('The guildmaster sends a logo.'));
  const gm = await rig();
  await gm.go('arms');
  const send = buttons(gm.root).find((b) => texts(b)[0] === 'Send for review (2,500 silver)');
  assert.equal(send.disabled, true, 'no picture yet');
  assert.ok(find(gm.root, 'dfsocial-field').some((n) => n.type === 'file'), 'a picture chosen from a file');
  const review = await rig(view({ logoReview: { at: 1 } }));
  await review.go('arms');
  assert.match(texts(review.root).join(' '), /A new logo is under review\. Its fee of 2,500 silver is held/);
  button(review.root, 'Withdraw it').fire('click');
  await review.tick();
  assert.deepEqual(review.asked.filter((a) => a[0] === 'withdraw'), [['withdraw']]);
  const approved = await rig(view({ logo: 'a'.repeat(32) }));
  await approved.go('arms');
  const logo = one(approved.root, 'dfguild-logo').children[0];
  assert.equal(logo.src, `https://acct.invalid/v1/guilds/logo/${'a'.repeat(32)}`);
  button(approved.root, 'Take the logo down').fire('click');
  await approved.tick();
  assert.equal(approved.asked.filter((a) => a[0] === 'clear').length, 0);
  buttons(approved.root).find((b) => texts(b)[0] === 'Sure? The device returns').fire('click');
  await approved.tick();
  assert.deepEqual(approved.asked.filter((a) => a[0] === 'clear'), [['clear']]);
  // the head's crest is the logo, in its ring
  const crest = one(approved.root, 'dfguild-crest');
  assert.ok(String(crest.className).includes('dfguild-crestlogo') && crest.src.endsWith('a'.repeat(32)));
  assert.equal(GUILD_LOGO_FEE, 2_500);
});

test('GUILD-LOGO the picker: the picture\'s middle square, drawn 128 across, written a PNG - a WebP where the PNG is over the size; a picture under 64 on its short side, or none to be read, refused in the service\'s own words (mutants: the crop, the size, the fallback)', async () => {
  const drawn = [];
  let urls = [];
  const doc = { createElement: () => ({ getContext: () => ({ drawImage: (...a) => drawn.push(a) }), toDataURL: (type) => urls.shift()?.(type) ?? 'data:,' }) };
  const bitmap = (w, h) => async () => ({ width: w, height: h, close() {} });
  urls = [(type) => `data:${type};base64,AAAA`];
  let r = await pickGuildLogo({ size: 10 }, { doc, bitmap: bitmap(300, 200) });
  assert.deepEqual(r, { ok: true, image: 'AAAA', url: 'data:image/png;base64,AAAA' });
  assert.deepEqual(drawn[0].slice(1), [50, 0, 200, 200, 0, 0, GUILD_LOGO_SIDE, GUILD_LOGO_SIDE], 'the middle square, 128 across');
  const big = 'A'.repeat(Math.ceil((GUILD_LOGO_MAX_BYTES + 10) / 3) * 4);
  urls = [(type) => `data:${type};base64,${big}`, (type) => `data:${type};base64,BBBB`];
  r = await pickGuildLogo({ size: 10 }, { doc, bitmap: bitmap(128, 128) });
  assert.deepEqual([r.ok, r.url], [true, 'data:image/webp;base64,BBBB'], 'over the size: a WebP');
  urls = [(type) => `data:${type};base64,${big}`, () => 'data:image/png;base64,x', (type) => `data:${type};base64,${big}`];
  assert.deepEqual(await pickGuildLogo({ size: 10 }, { doc, bitmap: bitmap(128, 128) }), { ok: false, error: 'logo-bytes' });
  assert.deepEqual(await pickGuildLogo({ size: 10 }, { doc, bitmap: bitmap(63, 400) }), { ok: false, error: 'logo-side' });
  assert.deepEqual(await pickGuildLogo({ size: 10 }, { doc, bitmap: async () => { throw new Error('no'); } }), { ok: false, error: 'logo-unread' });
  assert.deepEqual(await pickGuildLogo({ size: 9e9 }, { doc, bitmap: bitmap(128, 128) }), { ok: false, error: 'logo-file' });
});

test('GUILD-SHOP the window\'s look: the column\'s pages in three groups, a group named over its first page shown; the head\'s crest the guild\'s shield on a ring of its border, an undrawn guild a plain one; every ware drawn in the guild\'s field; the look\'s small screens the window\'s (mutants: the groups, the crest, the query)', async () => {
  assert.deepEqual(GUILD_NAV_GROUPS.map((g) => g.id), ['guild', 'wealth', 'look']);
  const shown = ['overview', 'members', 'ranks', 'treasury', 'vault', 'shop', 'arms', 'settings'];   // GUILD-RANKS: the Ranks page among the guild's
  assert.deepEqual(shown.map((p) => guildNavGroupAt(p, shown)), ['guild', null, null, 'wealth', null, null, 'look', null]);
  assert.equal(guildNavGroupAt('vault', ['overview', 'vault']), 'wealth', 'the group\'s first shown');
  const t = await rig();
  await t.go();
  const nav = one(t.root, 'dfguild-nav');
  assert.deepEqual(find(nav, 'dfguild-navgroup').map((n) => [n.textContent, n.attrs['aria-hidden']]), [['Guild', 'true'], ['Wealth', 'true'], ['Identity', 'true']]);
  assert.match(guildCrestSvg(WOLF), /#d4a017/);
  assert.match(guildCrestSvg(WOLF), /#3b6fd8/);
  assert.doesNotMatch(guildCrestSvg(null), /#3b6fd8/);
  for (const w of GUILD_SHOP_WARES) assert.match(guildWareSvg(w.key, WOLF), /^<svg[\s\S]*<\/svg>$/, w.key);
  assert.match(guildWareSvg('standard', WOLF), /#3b6fd8/, 'the guild\'s field');
  assert.equal(guildWareSvg('nope', WOLF), '');
  assert.ok(GUILD_WINDOW_CSS.includes(`@media ${GUILD_SMALL_QUERY} {`), 'the window\'s own small screens');
  assert.equal(one(t.root, 'dfguild-motto').textContent, 'Azure bordered Gold, a Wolf');
});
