// GUILD-UX (2026-10-19, Discord #suggestions "Guild Hall Storage Improvements", Alkfay, through Mac): "the inability to
// preview items (e.g. for legendary items that can have different bases you can't tell what base it is, and for rare
// items you can't see what their mods are... nor is there any way to filter items) ... With the guild stores ... you have
// to scroll past all of the stored materials to get to the input section, and then you have to manually enter the amount
// to store ... having an 'transfer all' button that empties your personal store into the guild's store would be
// wonderful". The vault's rows carry the pack's own card and the stores' own filter; the guild Stores' form comes first,
// an empty Units is all of it, and Put in all empties the character's Stores into the guild's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUILD_RANK_NAMES } from '../../../src/net/guild/guildLaw.js';
import { GuildBook } from '../../../src/net/guild/guildBook.js';
import { createSocialPanel, vaultRowAccepts, guildPutAll } from '../../../src/ui/socialPanel.js';
import { SocialState } from '../../../src/net/social.js';
import { materialCountLabel } from '../../../src/systems/professions/profItems.js';
import { GUILD_STORES_MAX } from '../../../src/net/writLaw.js';
import { STORES_MAX } from '../../../src/net/professionLaw.js';
import { pageOf } from '../../../src/ui/packPages.js';
import { weaponOfMaterial } from '../../../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../../../src/systems/item/itemTemplates.js';

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; },
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
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const order = (n, out = []) => { if (n.textContent) out.push(n.textContent); for (const c of n.children) order(c, out); return out; };
const button = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label || b.children[0]?.textContent === label || String(b.textContent).startsWith(label));
const settle = () => new Promise((r) => setImmediate(r));
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, hallGold: 0, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: null, renamedAt: null, renameAt: null,
  vault: { used: 3, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, ...over,
});
const OAK = 'log:oak', IRON = 'ore:iron', ASH = 'log:ash';

async function rig({ vaultItems = [], mine = new Map(), rows = [], refuse = null } = {}) {
  const calls = [];
  const guild = view();
  const writs = {
    busy: false, state: { guildStores: null, writBudget: null },
    guildStores: async () => { writs.state.guildStores = { rows, moves: [], mayWithdraw: true }; return { ok: true }; },
    deposit: async (k, n) => { calls.push(['deposit', k, n]); return refuse === k ? { ok: false, error: 'rate' } : { ok: true }; },
    withdrawStores: async (k, n) => { calls.push(['withdraw', k, n]); return { ok: true }; },
    budget: async () => ({ ok: true }),
  };
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    vault: async () => ({ ok: true, data: { vault: { max: 50, items: vaultItems, log: [], me: guild.vault.me } } }),
  };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }),
    pack: { items: () => [], add() {}, changed() {}, reach: () => true },
    profStores: { writs, open: () => true, mine: () => mine, name: (k, n) => materialCountLabel(k, n) } });
  const cards = [];
  const itemCard = { show: (rec, row, opts) => cards.push(['show', rec.name, row, opts]), hide: () => cards.push(['hide']) };
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc: fakeDocument(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false, itemCard });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 6; i++) { await settle(); panel.render(); } };
  return { calls, panel, go, cards };
}

test('GUILD-UX the guild Stores: the form and its acts come first and the stored rows after them; Units left empty puts in all you hold the guild has room for, and takes out all you may that your Stores have room for (mutants: the rows back above the form, empty read as nothing, the guild\'s room ignored)', async () => {
  const mine = new Map([[OAK, { material: OAK, own: 30, bought: 5 }]]);
  const r = await rig({ mine, rows: [{ material: OAK, qty: GUILD_STORES_MAX - 20, mine: 0 }] });
  await r.go('stores');
  const seen = order(r.panel.root);
  const putAt = seen.indexOf('Put in'), rowAt = seen.findIndex((x) => /Oak Logs$/.test(x) && /^\d/.test(x));
  assert.ok(putAt >= 0 && rowAt > putAt, `the form first (${putAt}) and the rows after (${rowAt})`);
  const units = find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Units (leave empty for all)');
  assert.ok(units, 'the field says what empty means');
  button(r.panel.root, 'Put in').fire('click');
  await settle(); await settle();
  assert.deepEqual(r.calls.at(-1), ['deposit', OAK, 20], 'all 35 held, but the guild has room for 20');
  r.panel.render();
  button(r.panel.root, 'Take out').fire('click');
  await settle(); await settle();
  assert.deepEqual(r.calls.at(-1), ['withdraw', OAK, STORES_MAX - 35], 'all an officer may, to the room the character\'s own Stores have');
});

test('GUILD-UX Put in all: every material of the character\'s Stores, each to the guild\'s room for it, one deposit after another; a refusal stops the run and says how far it went; nothing to put in, no press (mutants: the room ignored, a refusal run past)', async () => {
  const mine = new Map([[OAK, { material: OAK, own: 30, bought: 5 }], [IRON, { material: IRON, own: 12, bought: 0 }], [ASH, { material: ASH, own: 0, bought: 0 }]]);
  const r = await rig({ mine, rows: [{ material: IRON, qty: GUILD_STORES_MAX - 4, mine: 0 }] });
  await r.go('stores');
  button(r.panel.root, 'Put in all').fire('click');
  for (let i = 0; i < 6; i++) await settle();
  assert.deepEqual(r.calls.filter((c) => c[0] === 'deposit'), [['deposit', OAK, 35], ['deposit', IRON, 4]], 'Iron to the guild\'s room; Ash held at none');
  const deposits = [];
  const W = { deposit: async (k, n) => { deposits.push(k); return k === IRON ? { ok: false, error: 'rate' } : { ok: true }; } };
  assert.deepEqual(await guildPutAll(W, [[OAK, 1], [IRON, 1], [ASH, 1]]), { ok: false, error: 'rate', moved: 1 });
  assert.deepEqual(deposits, [OAK, IRON], 'stopped at the refusal');
  assert.deepEqual(await guildPutAll(W, [[OAK, 1]]), { ok: true, moved: 1 });
  const full = await rig({ mine: new Map([[OAK, { material: OAK, own: 3, bought: 0 }]]), rows: [{ material: OAK, qty: GUILD_STORES_MAX, mine: 0 }] });
  await full.go('stores');
  assert.equal(button(full.panel.root, 'Put in all').disabled, true, 'no room for any of it');
});

// TEST THE SHAPE THE PRODUCER MINTS (Home.md): the pieces as the game makes them, named by their templates
const BLADE = weaponOfMaterial(120, 9);
const PLATE = mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 521, variant: 0 }));
const HERB = { group: 'Ingredients', templateIndex: 0, name: 'Elf Cup', stackCount: 6 };

test('GUILD-UX the vault: each row\'s card is the pack\'s own, on a hover and on a press of its name, and goes with the pointer and at every repaint; the filter hides rows in place by page, rarity and search, kept across a repaint and let go with another vault (mutants: no card, the card left up, the search unread, the page unread)', async () => {
  const items = [
    { slot: 0, rec: BLADE, name: BLADE.name, count: 1, by: 'Aldric' },
    { slot: 1, rec: PLATE, name: PLATE.name, count: 1, by: 'Aldric' },
    { slot: 2, rec: HERB, name: HERB.name, count: 6, by: 'Bran' },
  ];
  const r = await rig({ vaultItems: items });
  await r.go('vault');
  const rows = () => find(r.panel.root, 'dfsocial-row').filter((n) => /put in by/.test(order(n).join('|')));
  assert.equal(rows().length, 3);
  rows()[0].fire('pointerenter', { pointerType: 'mouse' });
  assert.deepEqual(r.cards.at(-1).slice(0, 2), ['show', 'Longsword'], 'the piece\'s own record on the card');
  rows()[0].fire('pointerleave', { pointerType: 'mouse' });
  assert.deepEqual(r.cards.at(-1), ['hide']);
  find(rows()[1], 'dfsocial-name')[0].fire('click');
  assert.deepEqual(r.cards.at(-1).slice(0, 2), ['show', 'Cuirass'], 'a finger\'s press of the name');
  const shownNames = () => rows().filter((n) => n.style.display !== 'none').map((n) => find(n, 'dfsocial-name')[0].textContent);
  const q = find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Find a piece');
  q.value = 'cuir'; q.fire('input');
  assert.deepEqual(shownNames(), ['Daedric Cuirass']);
  q.value = ''; q.fire('input');
  const page = find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'A page of the pack');
  const weaponsId = page.children.map((o) => o.value).find((v) => v !== 'all' && /Weapon/i.test(page.children.find((o) => o.value === v).textContent));
  page.value = weaponsId; page.fire('change');
  assert.deepEqual(shownNames(), ['Daedric Longsword']);
  r.cards.length = 0;
  r.panel.openGuild('vault'); r.panel.render();
  assert.ok(r.cards.some((c) => c[0] === 'hide'), 'a repaint takes the card down');
  assert.deepEqual(shownNames(), ['Daedric Longsword'], 'the filter stands across a repaint');
});

test('GUILD-UX vaultRowAccepts: the record\'s page and rarity and the shown name\'s search; an empty filter answers every row', () => {
  const row = { rec: BLADE, name: BLADE.name };
  assert.equal(vaultRowAccepts(row, { cat: 'all', rarity: 'all', query: '' }), true);
  assert.equal(vaultRowAccepts(row, { query: 'LONG' }), true, 'case blind');
  assert.equal(vaultRowAccepts(row, { query: 'axe' }), false);
  assert.equal(vaultRowAccepts(row, { cat: pageOf(BLADE) }), true, 'the blade\'s own page');
  assert.equal(vaultRowAccepts({ rec: HERB, name: HERB.name }, { cat: pageOf(BLADE) }), false, 'a herb is not on it');
});

// ── AUDIT SUGGESTIONS-1019 L4 (bible/01-Overview/audits/Audit-Suggestions-1019.md) ──

test('AUDIT L4-1: an empty Units out of the guild Stores asks no more than the room the service counts - gold-bought and loose units fill it too (mutant: the room read off own and bought alone)', async () => {
  const mine = new Map([[OAK, { material: OAK, own: 4000, bought: 0, gold: 900, loose: 50 }]]);
  const r = await rig({ mine, rows: [{ material: OAK, qty: 1000, mine: 0 }] });
  await r.go('stores');
  button(r.panel.root, 'Take out').fire('click');
  await settle(); await settle();
  assert.deepEqual(r.calls.at(-1), ['withdraw', OAK, 5000 - 4950]);
});

test('AUDIT L4-2 and L4-3: the vault card goes when the panel closes; a touch\'s pointer brings no card, and a press of the name toggles one, asked (mutants: the card left up at the close; a touch\'s enter shows it; the second press shows it again)', async () => {
  const items = [{ slot: 0, rec: BLADE, name: 'Longsword', count: 1, by: 'Aldric' }];
  const r = await rig({ vaultItems: items });
  await r.go('vault');
  const row = find(r.panel.root, 'dfsocial-row').find((n) => /put in by/.test(order(n).join('|')));
  r.cards.length = 0;
  row.fire('pointerenter', { pointerType: 'touch' });
  assert.equal(r.cards.filter((c) => c[0] === 'show').length, 0, 'a finger passing brings nothing');
  const name = find(row, 'dfsocial-name')[0];
  name.fire('click');
  assert.equal(r.cards.at(-1)[0], 'show');
  assert.deepEqual(r.cards.at(-1)[3], { asked: true }, 'a card asked for');
  name.fire('click');
  assert.deepEqual(r.cards.at(-1), ['hide'], 'the second press takes it away');
  name.fire('click');
  r.cards.length = 0;
  r.panel.close();
  assert.deepEqual(r.cards, [['hide']], 'the close takes it');
});

test('AUDIT L4-4: the vault\'s own card is the enhanced skin\'s alone - on the classic skin it draws nothing (mutant: the skin unread)', async () => {
  const { ITEM_CARD } = await import('../../../src/ui/socialPanel.js');
  const { setUiSkin, isEnhanced } = await import('../../../src/systems/uiSkin.js');
  const had = isEnhanced();
  setUiSkin('classic');
  // a row to stand beside (no document here: a card built at all would throw - on the classic skin none is)
  try { assert.doesNotThrow(() => ITEM_CARD.show(BLADE, { getBoundingClientRect: () => ({}) }, { asked: true })); } finally { setUiSkin(had ? 'enhanced' : 'classic'); }
});

test('AUDIT L4-5: Put in all stopped part way says what went in before the refusal and why (mutants: the run\'s count unsaid)', async () => {
  const mine = new Map([[OAK, { material: OAK, own: 5, bought: 0 }], [IRON, { material: IRON, own: 7, bought: 0 }]]);
  const r = await rig({ mine, rows: [], refuse: IRON });
  await r.go('stores');
  button(r.panel.root, 'Put in all').fire('click');
  for (let i = 0; i < 6; i++) await settle();
  r.panel.render();
  assert.match(order(r.panel.root).join('|'), /1 material went in, then the guild Stores refused: /);
});

test('AUDIT L4-6 and L4-7: an unidentified piece\'s row and its search say what the pack says, never its true name; a filter that hides every row says so (mutants: the record\'s name; the note never shown)', async () => {
  const ring = { group: 'Jewellery', templateIndex: 0, name: 'Ring of the Fire Mage', identified: false, enchantments: [{ type: 1, param: 0 }] };
  const items = [{ slot: 0, rec: ring, name: 'Ring of the Fire Mage', count: 1, by: 'Aldric' }];
  const r = await rig({ vaultItems: items });
  await r.go('vault');
  const all = order(r.panel.root).join('|');
  assert.ok(!all.includes('Fire Mage'), 'the true name nowhere on the page');
  const q = find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Find a piece');
  q.value = 'fire'; q.fire('input');
  const note = find(r.panel.root, 'dfsocial-empty').find((n) => n.textContent === 'No piece in the vault matches.');
  assert.ok(note, 'the note');
  assert.equal(note.style.display, '', 'shown: nothing matches "fire"');
  q.value = ''; q.fire('input');
  assert.equal(note.style.display, 'none');
});

test('AUDIT L6-7: the rarity menu filters, its counts the vault\'s, and the search holds across a repaint of the same vault (mutants: the rarity unread; the counts dropped)', async () => {
  const rare = { ...weaponOfMaterial(116, 9), rarity: 'rare' };
  const items = [{ slot: 0, rec: BLADE, name: 'Longsword', count: 1, by: 'Aldric' }, { slot: 1, rec: rare, name: rare.name, count: 1, by: 'Bran' }];
  const r = await rig({ vaultItems: items });
  await r.go('vault');
  const rarity = find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'A rarity');
  assert.match(rarity.children[0].textContent, /\(2\)$/, 'Any Rarity counts the vault');
  const rareOpt = rarity.children.find((o) => o.value === 'rare');
  assert.match(rareOpt.textContent, /\(1\)$/);
  rarity.value = 'rare'; rarity.fire('change');
  const visible = () => find(r.panel.root, 'dfsocial-row').filter((n) => /put in by/.test(order(n).join('|')) && n.style.display !== 'none').length;
  assert.equal(visible(), 1, 'the rare piece alone');
  const q = find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Find a piece');
  q.value = 'zzz'; q.fire('input');
  assert.equal(visible(), 0);
  r.panel.openGuild('vault'); r.panel.render();
  assert.equal(visible(), 0, 'the same vault keeps it');
});
