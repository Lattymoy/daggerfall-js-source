// GUILD2 (2026-10-03) - THE GUILD PAGE'S OVERHAUL, ON THE CLIENT: a new name for a price, the vault and the
// guildmaster's grants, the arms of forty devices on a divided field that every banner draws - and the Guild tab in
// pages under the guild's own header (bible/11-Multiplayer/Guild-Overhaul.md). The service's half is
// test/net/guild2_service.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUILD_RANK_NAMES, GUILD_POWERS, GUILD_RENAME_GOLD, GUILD_RENAME_COOLDOWN_S, guildRenameAt, guildRenameOpen } from '../../../src/net/guild/guildLaw.js';
import {
  GUILD_VAULT_SLOTS, guildVaultSlots, VAULT_RANK_DEFAULTS, VAULT_LIMIT_CHOICES, vaultStanding, vaultMayPut, vaultMayTake, vaultGrantOf,
  vaultStandingText,
} from '../../../src/net/guild/guildVaultLaw.js';
import {
  HERALDRY_DEVICES, HERALDRY_DIVISIONS, HERALDRY_DIVISION_NAMES, heraldryOf, heraldrySame, heraldryText, heraldryKey, heraldryInk,
} from '../../../src/net/heraldryLaw.js';
import { DEVICES_DRAWN, divisionPath, divisionComplement, bannerSvg, shieldSvg, drawBanner, drawShield, BANNER_CLOTH, SHIELD_CLOTH } from '../../../src/ui/heraldryArt.js';
import { bannerKeyOf } from '../../../src/scenes/hallBanners.js';
import { paintSwatch } from '../../../src/ui/heraldrySwatch.js';
import { GuildBook } from '../../../src/net/guild/guildBook.js';
import {
  createSocialPanel, GUILD_RENAME_COST_TEXT, guildRenameSoonText, GUILD_VAULT_REACH_TEXT, GUILD_VAULT_EMPTY_TEXT, armsWhy, guildWordText, GUILD_LEDGER_WORDS,
} from '../../../src/ui/socialPanel.js';
import { SocialState } from '../../../src/net/social.js';
import { REFUSALS, accountGuilds } from '../../../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };

// ─── THE LAW ────────────────────────────────────────────────────────

test('GUILD2a the law of a new name: 25,000 gold of the realm\'s from the treasury, the guildmaster\'s alone, a fortnight between (mutants: the price; the cooldown; an officer renaming)', () => {
  assert.equal(GUILD_RENAME_GOLD, 25_000);
  assert.equal(GUILD_RENAME_COOLDOWN_S, 14 * 86_400);
  assert.deepEqual([...GUILD_POWERS.rename], [0]);
  assert.deepEqual([...GUILD_POWERS.vaultGrant], [0]);
  assert.equal(guildRenameAt(null), null, 'never renamed: now');
  assert.equal(guildRenameAt(1000), 1000 + GUILD_RENAME_COOLDOWN_S);
  assert.deepEqual([guildRenameOpen(null, 5), guildRenameOpen(1000, 1000 + GUILD_RENAME_COOLDOWN_S - 1), guildRenameOpen(1000, 1000 + GUILD_RENAME_COOLDOWN_S)], [true, false, true]);
  assert.equal(guildRenameSoonText(86_400 * 3 + 10, 10), 'The guild was renamed recently. It can be renamed again in 3 days.');
  assert.equal(guildRenameSoonText(100, 10), 'The guild was renamed recently. It can be renamed again in 1 day.');
  assert.match(GUILD_RENAME_COST_TEXT, /25,000 gold/);
});

test('GUILD2b the vault\'s law: fifty slots and fifty more with a hall; officers take out ten a day, members and recruits put in; the guildmaster always takes out, unlimited - a grant on that row never read; a grant revoked is the rank\'s again (mutants: a recruit taking; the limit unread; the guildmaster limited)', () => {
  assert.deepEqual([GUILD_VAULT_SLOTS, guildVaultSlots(false), guildVaultSlots(true)], [50, 50, 100]);
  assert.deepEqual(Object.values(VAULT_RANK_DEFAULTS).map((d) => [d.level, d.limit]), [['withdraw', 0], ['withdraw', 10], ['deposit', 0], ['deposit', 0]]);
  assert.deepEqual(vaultStanding(0, { level: 'none', limit: 0 }), { level: 'withdraw', limit: 0, granted: false }, 'the guildmaster\'s row is never a grant');
  assert.deepEqual(vaultStanding(3, null), { level: 'deposit', limit: 0, granted: false });
  assert.deepEqual(vaultStanding(3, { level: 'withdraw', limit: 3 }), { level: 'withdraw', limit: 3, granted: true });
  assert.deepEqual(vaultStanding(1, { level: 'none', limit: 0 }), { level: 'none', limit: 0, granted: true }, 'an officer\'s taken away');
  assert.deepEqual(vaultStanding(2, { level: 'deposit', limit: 9 }), { level: 'deposit', limit: 0, granted: true }, 'a limit is a withdrawer\'s');
  assert.deepEqual([vaultMayPut({ level: 'deposit' }), vaultMayPut({ level: 'withdraw' }), vaultMayPut({ level: 'none' })], [true, true, false]);
  assert.deepEqual([vaultMayTake({ level: 'withdraw', limit: 0 }, 999), vaultMayTake({ level: 'withdraw', limit: 3 }, 2), vaultMayTake({ level: 'withdraw', limit: 3 }, 3), vaultMayTake({ level: 'deposit', limit: 0 }, 0)],
    [true, true, false, false]);
  assert.deepEqual(vaultGrantOf({ level: null }), { level: null, limit: 0 }, 'revoked');
  assert.deepEqual(vaultGrantOf({ level: 'withdraw', limit: 25 }), { level: 'withdraw', limit: 25 });
  for (const bad of [{ level: 'all' }, { level: 'withdraw', limit: 101 }, { level: 'withdraw', limit: -1 }, null, 'withdraw']) assert.equal(vaultGrantOf(bad), null, JSON.stringify(bad));
  assert.deepEqual(VAULT_LIMIT_CHOICES, [1, 3, 5, 10, 25, 0]);
  assert.deepEqual([vaultStandingText({ level: 'withdraw', limit: 10 }), vaultStandingText({ level: 'withdraw', limit: 0 }), vaultStandingText({ level: 'deposit' }), vaultStandingText(null)],
    ['Takes out, 10 a day', 'Takes out, any number', 'Puts in', 'No access']);
});

test('GUILD2c the arms\' law: arms with no division and no colour of the device\'s own are exactly GUILD1d\'s three keys; a divided field takes a second colour - never Ash, never the field\'s; the device\'s colour differs from every colour of the field; the words and the key (mutants: a plain arms\' extra keys; the device lost on the second colour; the key of plain arms moved)', () => {
  assert.equal(HERALDRY_DEVICES.length, 40);
  assert.deepEqual(HERALDRY_DIVISIONS, ['plain', 'pale', 'fess', 'bend', 'bend-sinister', 'quarterly', 'chevron', 'saltire']);
  assert.deepEqual(Object.keys(heraldryOf(WOLF)), ['field', 'border', 'device'], 'GUILD1d\'s every stored heraldry unmoved');
  assert.deepEqual(heraldryOf({ ...WOLF, division: 'plain', field2: null, charge: null }), WOLF, 'a draft\'s empty fields dropped');
  assert.deepEqual(heraldryOf({ ...WOLF, charge: 'gold' }), WOLF, 'a device in the border\'s colour is the plain arms');
  const per = { ...WOLF, division: 'pale', field2: 'crimson' };
  assert.deepEqual(heraldryOf(per), per);
  assert.equal(heraldryOf({ ...WOLF, division: 'pale' }), null, 'a division wants its second colour');
  assert.equal(heraldryOf({ ...WOLF, division: 'pale', field2: 'azure' }), null, 'not the field\'s');
  assert.equal(heraldryOf({ ...WOLF, division: 'pale', field2: 'ash' }), null, 'never Ash');
  assert.equal(heraldryOf({ ...WOLF, division: 'pale', field2: 'gold' }), null, 'the device (the border\'s gold) lost on its own field');
  assert.equal(heraldryOf({ ...WOLF, field2: 'crimson' }), null, 'a second colour on a plain field');
  assert.equal(heraldryOf({ ...WOLF, division: 'wavy', field2: 'crimson' }), null);
  assert.deepEqual(heraldryOf({ ...WOLF, charge: 'argent' }), { ...WOLF, charge: 'argent' });
  assert.equal(heraldryOf({ ...WOLF, charge: 'azure' }), null, 'a device the field\'s colour');
  assert.equal(heraldryOf({ ...per, charge: 'crimson' }), null, 'nor the second\'s');
  assert.equal(heraldryInk(WOLF), 'gold');
  assert.equal(heraldryInk({ ...WOLF, charge: 'argent' }), 'argent');
  assert.equal(heraldryText(WOLF), 'Azure bordered Gold, a Wolf');
  assert.equal(heraldryText({ ...per, charge: 'argent', device: 'owl' }), 'Per pale Azure and Crimson, bordered Gold, an Owl Argent');
  assert.equal(heraldryKey(WOLF), 'azure|gold|wolf', 'every texture already cached keeps its key');
  assert.equal(heraldryKey(per), 'azure|gold|wolf|pale|crimson|');
  assert.equal(heraldrySame(per, { ...per }), true);
  assert.equal(heraldrySame(per, WOLF), false);
  assert.equal(heraldrySame({ ...WOLF, charge: 'argent' }, WOLF), false);
  assert.deepEqual(Object.keys(HERALDRY_DIVISION_NAMES), HERALDRY_DIVISIONS);
  // the Raise button's reason, in the law's own terms
  assert.equal(armsWhy({ ...WOLF, division: 'pale', field2: 'gold' }), 'a device that stands out from the field');
  assert.equal(armsWhy({ ...WOLF, field: 'ash' }), 'Ash only as the border');
  assert.equal(armsWhy({ ...WOLF, border: 'azure' }), 'a border unlike the field');
  assert.equal(armsWhy({ ...WOLF, division: 'pale', field2: 'ash' }), 'two different field colors, never Ash');
});

// ─── THE ART ────────────────────────────────────────────────────────

test('GUILD2c the drawing: every one of the forty devices drawn; each division a part of its own over the box; the banner and the shield fill the second colour and draw the device in its own; a street\'s banner of plain arms keeps its texture\'s key (mutants: a device\'s art gone; field2 unfilled; the ink the border\'s)', () => {
  assert.equal(DEVICES_DRAWN, true);
  assert.equal(divisionPath('plain', 100, 300), '');
  for (const d of HERALDRY_DIVISIONS.slice(1)) assert.match(divisionPath(d, 100, 300), /^M/, d);
  assert.equal(divisionPath('pale', 100, 300), 'M50 0 H100 V300 H50 Z', 'the sinister half');
  const arms = { field: 'azure', border: 'gold', device: 'owl', division: 'quarterly', field2: 'crimson', charge: 'argent' };
  for (const svg of [bannerSvg(arms), shieldSvg(arms)]) {
    assert.ok(svg.includes('fill="#b3262e"'), 'the second colour');
    assert.ok(svg.includes('#e6e6e6'), 'the device\'s own Argent');
  }
  assert.ok(!bannerSvg(WOLF).includes('#b3262e'), 'plain arms: one field');
  const calls = [];
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, a[0]?.d ?? null, o.fillStyle, o.strokeStyle]); }),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  drawBanner(ctx, arms, 64);
  delete globalThis.Path2D;
  const fills = calls.filter((c) => c[0] === 'fill');
  assert.equal(fills[0][1], BANNER_CLOTH);
  assert.deepEqual([fills[1][1], fills[1][2]], [divisionPath('quarterly', 100, 300), '#b3262e'], 'the second colour over the field, under the border');
  assert.ok(fills.slice(2).some((c) => c[2] === '#e6e6e6'), 'the owl in Argent');
  assert.equal(bannerKeyOf(WOLF), 'azure|gold|wolf');
  assert.equal(bannerKeyOf(arms), heraldryKey(arms));
});

// ─── THE BOOK ───────────────────────────────────────────────────────

const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, hallGold: 30_000, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: WOLF, renamedAt: null, renameAt: null,
  vault: { used: 1, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, ...over,
});
const ARROWS = { group: 'Weapons', templateIndex: 131, material: 0, name: 'Arrow', value: 1, stackCount: 40 };
function guildRig(guild = view(), { vaultItems = [], pack = [] } = {}) {
  const calls = [];
  const answers = {};
  const reply = (route) => async (...a) => { calls.push([route, ...a]); return answers[route] ?? { ok: true, data: {} }; };
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    vault: async (c) => { calls.push(['vault', c]); return answers.vault ?? { ok: true, data: { vault: { max: 50, items: vaultItems, log: [], me: guild.vault.me } } }; },
  };
  for (const r of ['rename', 'vaultPut', 'vaultTake', 'vaultGrant']) door[r] = reply(r);
  const items = [...pack];
  let changed = 0;
  let reach = true;
  const hostPack = { items: () => items, add: (rec) => items.push(rec), changed: () => { changed++; }, reach: () => reach };
  const realm = { act: async ({ reserve, apply, call }) => { const undo = reserve?.(); const r = await call(7); if (r?.ok) apply?.(r); else undo?.(); return r; } };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack: hostPack, realm });
  return { book, calls, answers, items, changed: () => changed, setReach: (x) => { reach = x; } };
}

test('GUILD2 the book: a rename through the door as the character playing; the vault read; a piece put in leaves the pack at once and comes back on a refusal - a part of a stack the same; a piece taken lands in the pack on the answer; a grant through the door (mutants: the reserve unrolled on a refusal; the stack\'s part lost; the taken piece unminted)', async () => {
  const arrows = { ...ARROWS };
  const r = guildRig(view(), { pack: [arrows] });
  await r.book.refresh();
  assert.equal((await r.book.rename('The Open Hand', 'OPH')).ok, true);
  assert.deepEqual(r.calls.find((c) => c[0] === 'rename'), ['rename', 'rabc', 'The Open Hand', 'OPH']);
  await r.book.readVault();
  assert.deepEqual(r.book.vaultView.items, []);
  r.answers.vaultPut = { ok: false, error: 'guild-vault-full' };
  const no = await r.book.vaultPut(arrows, 15);
  assert.deepEqual(no, { ok: false, error: 'guild-vault-full' });
  assert.equal(arrows.stackCount, 40, 'the part given back');
  assert.deepEqual(r.calls.find((c) => c[0] === 'vaultPut')[1], { character: 'rabc', realm: 7, pick: 0, item: { ...ARROWS }, count: 15 }, 'the record as it stood, its place in the pack');
  r.answers.vaultPut = { ok: true, data: {} };
  assert.equal((await r.book.vaultPut(arrows, 15)).ok, true);
  assert.equal(arrows.stackCount, 25, 'fifteen gone into the vault');
  assert.equal((await r.book.vaultPut(arrows)).ok, true);
  assert.equal(r.items.includes(arrows), false, 'the rest, whole');
  assert.deepEqual(await r.book.vaultPut({ ...ARROWS }, 1), { ok: false, error: 'vault-goods' }, 'a piece the pack does not hold - AUDIT2 K15: never "more than the stack holds"');
  assert.deepEqual(await r.book.vaultTake(3), { ok: false, error: 'guild-vault-empty' }, 'a slot the last read did not show');
  const shelf = guildRig(view(), { vaultItems: [{ slot: 3, rec: null, name: 'Arrow', count: 25, by: 'Aldric', at: 99 }] });
  await shelf.book.refresh(); await shelf.book.readVault();
  shelf.answers.vaultTake = { ok: true, data: { item: { ...ARROWS, stackCount: 1 } } };
  assert.equal((await shelf.book.vaultTake(3, 1)).ok, true);
  assert.deepEqual(shelf.calls.find((c) => c[0] === 'vaultTake')[1], { character: 'rabc', realm: 7, slot: 3, count: 1, at: 99 }, 'the slot as it was read - never one filled again since');
  assert.deepEqual(shelf.items, [{ ...ARROWS, stackCount: 1 }], 'into the pack on the answer');
  assert.ok(shelf.changed() > 0, 'the host told');
  assert.equal((await r.book.vaultGrant('m2', 'withdraw', 3)).ok, true);
  assert.deepEqual(r.calls.find((c) => c[0] === 'vaultGrant'), ['vaultGrant', 'rabc', 'm2', 'withdraw', 3]);
  const offline = new GuildBook({ door: {}, character: () => 'c', wallet: () => ({}) });
  assert.deepEqual(await offline.vaultPut(arrows), { ok: false, error: 'realm-only' });
});

test('GUILD2 the book (AUDIT2 K1/K14/S2/S7): a vault take NEEDS its answer - the piece is the answer, and one lost ends the session for a join to read the record; the last vault read asked is the one shown; a refusal keeps its reason - the word caught, when the next name may come - and the tab says it ; a rename\'s treasury line says a rename (mutants: the take asked as any act; an earlier read shown over a later; `why` and `at` dropped; a rename said as put in)', async () => {
  // K1
  const shelf = guildRig(view(), { vaultItems: [{ slot: 3, rec: null, name: 'Arrow', count: 25, by: 'Aldric', at: 99 }] });
  const acts = [];
  let abandoned = null;
  shelf.book.realm = { act: async (o) => { acts.push(o); const r = await o.call(7); if (r?.ok) o.apply?.(r); return r; }, abandon: (why) => { abandoned = why; } };
  await shelf.book.refresh(); await shelf.book.readVault();
  shelf.answers.vaultTake = { ok: true, landed: true, seq: 8 };   // realmGoldAct's word for a landed act heard without its answer
  await shelf.book.vaultTake(3);
  assert.equal(acts[0].needsAnswer, true, 'a landed take with no piece is never taken as done');
  assert.deepEqual([abandoned, shelf.items.length], ['unknown', 0], 'the session given up: a join reads the record, which holds it');
  // K14: two reads out - the first answered last is not the vault
  const r2 = guildRig(view());
  await r2.book.refresh();
  let release;
  const gate = new Promise((res) => { release = res; });
  let n = 0;
  const vaultOf = (items) => ({ ok: true, data: { vault: { max: 50, items, log: [], me: { level: 'withdraw', limit: 0, taken: 0 } } } });
  r2.book.door.vault = async () => (++n === 1 ? (await gate, vaultOf([{ slot: 0, rec: null, name: 'Old Sword', count: 1, by: 'A', at: 1 }])) : vaultOf([]));
  const first = r2.book.readVault();
  await r2.book.readVault();
  release();
  await first;
  assert.deepEqual(r2.book.vaultNow().items, [], 'the take\'s own read, never the look from before it');
  // S2/S7: the reason kept, and said
  const r3 = guildRig(view());
  await r3.book.refresh();
  r3.answers.rename = { ok: false, error: 'guild-name-word', why: 'mod' };
  const word = await r3.book.rename('The Mods', null);
  assert.deepEqual(word, { ok: false, error: 'guild-name-word', why: 'mod' });
  assert.equal(guildWordText(word.error, word), 'A guild\'s name and tag may not contain "mod". That word is not allowed in names.');
  r3.answers.rename = { ok: false, error: 'guild-rename-soon', at: 1_000_000 + 3 * 86_400 };
  const soon = await r3.book.rename('The Open Hand', null);
  assert.equal(soon.at, 1_000_000 + 3 * 86_400);
  assert.equal(guildWordText(soon.error, soon, 1_000_000), 'The guild was renamed recently. It can be renamed again in 3 days.');
  assert.equal(guildWordText('guild-name-word'), REFUSALS['guild-name-word'], 'no reason named: the sentence');
  // a rename's treasury line is a payment out, said as one
  assert.equal(GUILD_LEDGER_WORDS.rename, 'renamed the guild for');
  const led = await tab(view({ ledger: [{ at: 1, who: 'Aldric', kind: 'rename', amount: 25_000, balance: 5_000 }] }), {}, 'treasury');
  assert.ok(texts(led.panel.root).includes('Aldric renamed the guild for 25,000'), 'never "put in 25,000"');
});

test('GUILD2 the client\'s door: the five routes and their bodies; every refusal the service says has a sentence (mutants: a route\'s path; a refusal unsaid)', async () => {
  const seen = [];
  const door = accountGuilds({
    fetch: async (u, i) => { seen.push([new URL(u).pathname, JSON.parse(i.body)]); return { ok: true, status: 200, json: async () => ({}) }; },
    storage: { getItem: () => JSON.stringify({ id: 'a', secret: 's'.repeat(43) }), setItem() {}, removeItem() {} },
  });
  await door.rename('rabc', 'The Open Hand', null);
  await door.vault('rabc');
  await door.vaultPut({ character: 'rabc', realm: 7, pick: 2, item: { a: 1 }, count: 3 });
  await door.vaultTake({ character: 'rabc', realm: 7, slot: 4, at: 9 });
  await door.vaultGrant('rabc', 'm2', null, 0);
  await door.vaultGrant('rabc', 'm3', 'withdraw');
  assert.deepEqual(seen, [
    ['/v1/guilds/rename', { character: 'rabc', name: 'The Open Hand' }],
    ['/v1/guilds/vault', { character: 'rabc' }],
    ['/v1/guilds/vault/put', { character: 'rabc', realm: 7, pick: 2, item: { a: 1 }, count: 3 }],
    ['/v1/guilds/vault/take', { character: 'rabc', realm: 7, slot: 4, at: 9 }],
    ['/v1/guilds/vault/grant', { character: 'rabc', member: 'm2', level: null, limit: 0 }],
    ['/v1/guilds/vault/grant', { character: 'rabc', member: 'm3', level: 'withdraw', limit: null }],   // AUDIT2 S6: none named - the law's ten
  ]);
  for (const w of ['guild-rename-same', 'guild-name-word', 'guild-rename-soon', 'guild-rename-siege', 'guild-rename-gold', 'guild-rename-moved',
    'guild-vault-rank', 'guild-vault-limit', 'guild-vault-full', 'guild-vault-empty', 'guild-vault-moved', 'guild-vault', 'vault-goods',
    'bad-vault-item', 'bad-vault-count', 'bad-vault-slot', 'bad-vault-grant']) assert.equal(typeof REFUSALS[w], 'string', w);
  assert.match(REFUSALS['guild-rename-gold'], /25,000 gold/);
  const svc = src('server-account/src/service.js'), idx = src('server-account/src/index.js');
  for (const r of ['/v1/guilds/rename', '/v1/guilds/vault', '/v1/guilds/vault/put', '/v1/guilds/vault/take', '/v1/guilds/vault/grant']) {
    assert.ok(svc.includes(`'${r}'`), r); assert.ok(idx.includes(`'${r}':`), r);
  }
});

// ─── THE TAB ────────────────────────────────────────────────────────

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
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const buttons = (root, label) => find(root, 'dfsocial-btn').filter((b) => b.textContent === label || b.children[0]?.textContent === label || String(b.textContent).startsWith(label));
const button = (root, label) => buttons(root, label)[0];
const settle = () => new Promise((r) => setImmediate(r));
async function tab(guild, opts = {}, page = null) {
  const rig = guildRig(guild, opts);
  const social = new SocialState({ acct: 'a' });
  const doc = fakeDocument();
  const panel = createSocialPanel({ social, guild: rig.book, doc, win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 4; i++) { await settle(); panel.render(); } };
  await go(page);
  return { ...rig, panel, go, social, doc };
}

test('GUILD2 the tab in pages: the guild\'s header over every page - its banner, name and tag, the reader\'s rank and the treasury - and a strip of pages, the guild Stores among them only where the professions are this account\'s; a page the guild does not show opens the Overview; the focus follows the page turned to (AUDIT2 U9) (mutants: the strip lost; the Stores page offline; the focus dropped)', async () => {
  const t = await tab(view());
  const strip = find(t.panel.root, 'dfsocial-subtab');
  assert.deepEqual(strip.map((b) => b.dataset.page), ['overview', 'members', 'treasury', 'vault', 'arms', 'settings']);
  assert.deepEqual(strip.map((b) => b.attrs['aria-selected']), ['true', 'false', 'false', 'false', 'false', 'false']);
  const all = texts(t.panel.root);
  assert.ok(all.includes('The Hand [HND]'));
  assert.ok(all.includes('You are Guildmaster - the treasury holds 30,000 gold'), 'GUILD1b\'s line, kept');
  assert.ok(all.includes('1/75 members - the vault 1/50'));
  strip[2].fire('click');
  t.panel.render();
  assert.equal(find(t.panel.root, 'dfsocial-subtab')[2].attrs['aria-selected'], 'true');
  // AUDIT2 U9: the focus on the page turned to - never left on a button the strip drew over
  assert.equal(t.doc.activeElement, find(t.panel.root, 'dfsocial-subtab')[2], 'the new Treasury tab holds the focus');
  assert.ok(texts(t.panel.root).includes('Treasury'));
  await t.go('stores');
  assert.equal(find(t.panel.root, 'dfsocial-subtab')[0].attrs['aria-selected'], 'true', 'no Stores here: the Overview');
});

test('GUILD2a the Settings page: a new name is the guildmaster\'s, its price said; Rename arms and the second press pays; it waits on the realm\'s gold in the treasury and on the fortnight, each said; an Officer sees none (mutants: one press; the gold unread; the cooldown unread)', async () => {
  const t = await tab(view(), {}, 'settings');
  assert.ok(texts(t.panel.root).includes(GUILD_RENAME_COST_TEXT));
  const field = (label) => find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);
  assert.equal(field('Guild name').value, 'The Hand', 'the draft starts at the name that stands');
  assert.equal(button(t.panel.root, 'Rename').disabled, true, 'already the guild\'s');
  field('Guild name').value = 'The Open Hand'; field('Guild name').fire('input');
  assert.equal(button(t.panel.root, 'Rename').disabled, false);
  button(t.panel.root, 'Rename').fire('click');
  t.panel.render();
  assert.equal(t.calls.some((c) => c[0] === 'rename'), false, 'the first press arms');
  button(t.panel.root, 'Sure? 25,000 gold').fire('click');
  await settle(); await settle();
  assert.deepEqual(t.calls.find((c) => c[0] === 'rename'), ['rename', 'rabc', 'The Open Hand', 'HND']);
  const poor = await tab(view({ hallGold: 24_999 }), {}, 'settings');
  const pf = find(poor.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Tag');
  pf.value = 'OPH'; pf.fire('input');
  assert.equal(button(poor.panel.root, 'Rename').disabled, true);
  assert.ok(texts(button(poor.panel.root, 'Rename')).includes('25,000 of the realm\'s gold in the treasury'));
  const nowS = Math.floor(Date.now() / 1000);
  const soon = await tab(view({ renamedAt: nowS - 86_400, renameAt: nowS + 13 * 86_400 }), {}, 'settings');
  assert.ok(texts(soon.panel.root).includes(guildRenameSoonText(nowS + 13 * 86_400, nowS)));
  const sf = find(soon.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Tag');
  sf.value = 'OPH'; sf.fire('input');
  assert.ok(texts(button(soon.panel.root, 'Rename')).includes('not yet'));
  const officer = await tab(view({ rank: 1, members: [{ member: 'm2', name: 'Mara', rank: 1, joinedAt: 1, you: true }] }), {}, 'settings');
  assert.equal(buttons(officer.panel.root, 'Rename').filter((b) => b.textContent !== 'Rename ranks').length, 0);
  assert.equal(texts(officer.panel.root).includes(GUILD_RENAME_COST_TEXT), false);
});

test('GUILD2b the Vault page: each piece with who put it in; Take and Take one for a member who may take out, none for one who only puts in; Put in from the pack, a piece and how many, never the bag or a worn piece; away from a town it says so and every act waits (mutants: Take offered to a depositor; the town unread)', async () => {
  const pieces = [{ slot: 0, name: 'Arrow', count: 25, by: 'Aldric', at: 5 }, { slot: 1, name: 'Dagger', count: 1, by: 'Mara', at: 6 }];
  const worn = { group: 'Armor', templateIndex: 102, material: 0, name: 'Cuirass', value: 5, equipSlot: 1 };
  const bag = { group: 'UselessItems2', templateIndex: 600, name: 'Materials Bag', value: 250 };
  const t = await tab(view(), { vaultItems: pieces, pack: [{ ...ARROWS }, worn, bag, { ...ARROWS, name: 'Locked Arrow', locked: true }] }, 'vault');
  const all = texts(t.panel.root);
  assert.ok(all.includes('Arrow x25') && all.includes('put in by Aldric') && all.includes('Dagger'));
  const row = (n) => find(t.panel.root, 'dfsocial-row').find((r) => texts(r).includes(n));
  assert.deepEqual(find(row('Arrow x25'), 'dfsocial-btn').map((b) => b.children[0]?.textContent ?? b.textContent), ['Take', 'Take one']);
  assert.deepEqual(find(row('Dagger'), 'dfsocial-btn').map((b) => b.children[0]?.textContent ?? b.textContent), ['Take']);
  const pick = find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'A piece of your pack');
  assert.deepEqual(pick.children.map((o) => o.textContent), ['Arrow x40'], 'never a worn piece, the bag, nor a locked one (AUDIT2 U4)');
  assert.equal(button(t.panel.root, 'Put in').disabled, false);
  button(row('Arrow x25'), 'Take one').fire('click');
  await settle(); await settle();
  assert.deepEqual(t.calls.find((c) => c[0] === 'vaultTake')[1], { character: 'rabc', realm: 7, slot: 0, count: 1, at: 5 });
  const member = await tab(view({ rank: 2, members: [{ member: 'm3', name: 'Bran', rank: 2, joinedAt: 1, you: true }], vault: { used: 2, max: 50, me: { level: 'deposit', limit: 0, granted: false, taken: 0 } } }),
    { vaultItems: pieces, pack: [{ ...ARROWS }] }, 'vault');
  assert.equal(buttons(member.panel.root, 'Take').length, 0, 'a depositor takes nothing');
  assert.ok(button(member.panel.root, 'Put in'));
  assert.ok(texts(member.panel.root).includes('Your standing: Puts in.'));
  const away = await tab(view(), { vaultItems: pieces, pack: [{ ...ARROWS }] }, 'vault');
  away.setReach(false); away.panel.render(); await away.go('vault');
  assert.ok(texts(away.panel.root).includes(GUILD_VAULT_REACH_TEXT));
  assert.equal(button(away.panel.root, 'Take').disabled, true);
  assert.equal(button(away.panel.root, 'Put in').disabled, true);
  const empty = await tab(view(), { vaultItems: [] }, 'vault');
  assert.ok(texts(empty.panel.root).includes(GUILD_VAULT_EMPTY_TEXT));
});

test('GUILD2b the Vault page (AUDIT M1-M3): the town read live - a page left open on the road shuts Take and sends nothing; the vault read again at each look; another guild\'s pieces never shown, nor taken from (mutants: the town read once; read once a session; a stale view shown)', async () => {
  const pieces = [{ slot: 0, name: 'Ebony Dagger', count: 1, by: 'Aldric', at: 5 }];
  const t = await tab(view(), { vaultItems: pieces }, 'vault');
  const take = button(t.panel.root, 'Take');
  assert.equal(take.disabled, false);
  t.setReach(false);
  t.panel.render();   // the frame's live pass, nothing rebuilt
  assert.equal(take.disabled, true, 'shut on the road');
  take.disabled = false; take.fire('click');   // and a press that slipped through still sends nothing
  await settle(); await settle();
  assert.equal(t.calls.filter((c) => c[0] === 'vaultTake').length, 0);
  t.setReach(true);
  t.panel.render();
  assert.equal(take.disabled, false, 'open again in a town');
  // read again at each look: the tab opened again, the page turned to
  const reads = () => t.calls.filter((c) => c[0] === 'vault').length;
  const first = reads();
  await t.go('overview');
  await t.go('vault');
  assert.ok(reads() > first, 'read again');
  find(t.panel.root, 'dfsocial-subtab').find((b) => b.dataset.page === 'overview').fire('click');
  const before = reads();
  find(t.panel.root, 'dfsocial-subtab').find((b) => b.dataset.page === 'vault').fire('click');
  for (let i = 0; i < 3; i++) { await settle(); t.panel.render(); }
  assert.ok(reads() > before, 'and at the page\'s own tab');
  // a read that fails shows no pieces - the last guild's least of all
  t.answers.vault = { ok: false, error: 'server' };
  await t.book.readVault();
  assert.equal(t.book.vaultNow(), null);
  await t.go('vault');
  assert.equal(buttons(t.panel.root, 'Take').length, 0, 'no Take on a view not read');
  assert.equal(t.book.vaultView, null);
  t.answers.vault = undefined;
  await t.book.readVault();
  assert.equal(t.book.vaultNow()?.items?.length, 1);
  t.book.guild = { ...t.book.guild, id: 'gOTHER000000' };
  assert.equal(t.book.vaultNow(), null, 'another guild\'s view is no view');
  assert.deepEqual(await t.book.vaultTake(0), { ok: false, error: 'guild-vault-empty' }, 'nor taken from');
});

test('GUILD2b the Members page: the guildmaster sets each member\'s standing at the vault - as their rank, no access, puts in, takes out with a limit a day - and Set says it; revoking is "as their rank"; an officer sees each standing but sets none (mutants: grants offered to an officer; the limit unsent)', async () => {
  const members = [
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } },
    { member: 'm3', name: 'Bran', rank: 2, joinedAt: 2, you: false, vault: { level: 'deposit', limit: 0, granted: false } },
  ];
  const t = await tab(view({ members }), {}, 'members');
  assert.ok(texts(t.panel.root).includes('Member - Puts in'));
  const sel = (label) => find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);
  assert.equal(sel('Aldric\'s vault access'), undefined, 'never the guildmaster\'s own row');
  const access = sel('Bran\'s vault access');
  assert.deepEqual(access.children.map((o) => o.value), ['', 'none', 'deposit', 'withdraw']);
  assert.equal(button(find(t.panel.root, 'dfsocial-grant')[0], 'Set').disabled, true, 'unchanged');
  access.value = 'withdraw'; access.fire('change');
  // AUDIT GUILD2: drawn again in place, the focus kept on the level; a member made a withdrawer starts at ten a day (the
  // limit counts takes - PIN MOVED: "pieces a day")
  assert.equal(t.doc.activeElement, sel('Bran\'s vault access'), 'the focus on the level, drawn again');
  assert.equal(sel('Bran\'s takes a day').children.find((o) => o.selected)?.value, '10', 'an Officer\'s ten, never "Any number" unasked');
  t.panel.render();
  const limit = sel('Bran\'s takes a day');
  assert.ok(limit, 'a withdrawer\'s limit');
  limit.value = '5'; limit.fire('change');
  button(find(t.panel.root, 'dfsocial-grant')[0], 'Set').fire('click');
  await settle(); await settle();
  assert.deepEqual(t.calls.find((c) => c[0] === 'vaultGrant'), ['vaultGrant', 'rabc', 'm3', 'withdraw', 5]);
  const granted = [members[0], { ...members[1], vault: { level: 'withdraw', limit: 5, granted: true } }];
  const g2 = await tab(view({ members: granted }), {}, 'members');
  assert.ok(texts(g2.panel.root).includes('Member - Takes out, 5 a day (granted)'));
  const back = find(g2.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Bran\'s vault access');
  back.value = ''; back.fire('change');
  g2.panel.render();
  button(find(g2.panel.root, 'dfsocial-grant')[0], 'Set').fire('click');
  await settle(); await settle();
  assert.deepEqual(g2.calls.find((c) => c[0] === 'vaultGrant'), ['vaultGrant', 'rabc', 'm3', null, 0], 'revoked: the rank\'s again');
  const officer = await tab(view({ rank: 1, members: [{ ...members[0], you: false }, { member: 'm2', name: 'Mara', rank: 1, joinedAt: 1, you: true }, members[1]] }), {}, 'members');
  assert.equal(find(officer.panel.root, 'dfsocial-grant').length, 0);
  assert.ok(texts(officer.panel.root).includes('Member - Puts in'), 'but reads them');
});

test('GUILD2b (AUDIT2 U7/U10): a grant\'s draft is of the standing it was made from - a standing moved since starts it again; the vault\'s Put in picks a piece, never a place in the list, and is this guild\'s (mutants: the draft kept over a new standing; the pick an index)', async () => {
  const members = [
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } },
    { member: 'm3', name: 'Bran', rank: 2, joinedAt: 2, you: false, vault: { level: 'deposit', limit: 0, granted: false } },
  ];
  const t = await tab(view({ members }), {}, 'members');
  const sel = (label) => find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);
  sel('Bran\'s vault access').value = 'withdraw'; sel('Bran\'s vault access').fire('change');   // a draft, unset
  const moved = view({ members: [members[0], { ...members[1], vault: { level: 'none', limit: 0, granted: true } }] });   // a Set from another tab, read since
  t.book.door.mine = async () => ({ ok: true, data: { guild: moved } });
  await t.book.refresh(); t.panel.render();
  assert.equal(sel('Bran\'s vault access').children.find((o) => o.selected)?.value, 'none', 'the standing as it stands, never the old draft');
  assert.equal(button(find(t.panel.root, 'dfsocial-grant')[0], 'Set').disabled, true, 'unchanged against the new');
  // U10: the second piece picked; the first put in elsewhere (the list shifts) - the pick stays the piece
  const dagger = { group: 'Weapons', templateIndex: 113, material: 0, name: 'Dagger', value: 5 };
  const arrows = { ...ARROWS };
  const sword = { group: 'Weapons', templateIndex: 115, material: 1, name: 'Longsword', value: 300 };
  const v = await tab(view(), { pack: [arrows, dagger, sword] }, 'vault');
  const pick = () => find(v.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'A piece of your pack');
  pick().value = '1'; pick().fire('change');
  v.items.splice(0, 1);   // the arrows gone from the pack
  v.panel.render(); await v.go('vault');
  assert.deepEqual(pick().children.map((o) => [o.textContent, !!o.selected]), [['Dagger', true], ['Longsword', false]], 'the dagger still, never the place it stood');
  button(v.panel.root, 'Put in').fire('click');
  await settle(); await settle();
  assert.equal(v.calls.find((c) => c[0] === 'vaultPut')[1].item.name, 'Dagger', 'the piece picked, never the one after it');
});

test('GUILD2c (AUDIT G11-G14): a hole shows the field beneath it - both colours of a divided one, in the parts\' own order - and plain arms draw as GUILD1d\'s did; every cache keyed by the whole arms; a border never the second colour; a pair named as one (mutants: the hole in the first colour alone; a swatch keyed by three; a border of the second colour; "a Swords")', () => {
  const owl = { field: 'azure', border: 'gold', device: 'owl', division: 'pale', field2: 'crimson' };
  for (const svg of [bannerSvg(owl), shieldSvg(owl)]) {
    const id = /<clipPath id="([^"]+d)">/.exec(svg)?.[1];
    assert.ok(id, 'the division\'s own clip');
    assert.ok(svg.includes(`<g clip-path="url(#${id})"><g transform=`), 'a hole painted again inside the division\'s part');
    assert.ok(svg.split(`clip-path="url(#${id})"`).length - 1 >= 4, 'each of the owl\'s holes');
    assert.ok(/clip-path="url\(#[^"]+d\)"><g transform="[^"]+"><path d="[^"]+" fill="#b3262e"\/>/.test(svg), 'in the second colour');
  }
  // plain arms: one device group, no division clip - the picture GUILD1d cached
  const plain = bannerSvg(WOLF);
  assert.equal(plain.split('<g transform=').length - 1, 1);
  assert.ok(!/<clipPath id="[^"]+d">/.test(plain));
  // the canvas: a hole filled in the first colour, then clipped to the division and filled in the second, in order
  const calls = [];
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, a[0]?.d ?? null, o.fillStyle]); }),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  drawBanner(ctx, { ...owl, device: 'key' }, 64);
  delete globalThis.Path2D;
  const after = calls.slice(calls.findIndex((c) => c[0] === 'stroke'));
  const hole = after.findIndex((c) => c[0] === 'fill' && c[2] === '#3b6fd8');
  assert.ok(hole > 0, 'the key\'s bow in the first colour');
  assert.deepEqual(after.slice(hole + 1).filter((c) => c[0] === 'clip' || c[0] === 'fill').slice(0, 2).map((c) => [c[0], c[0] === 'fill' ? c[2] : c[1]]),
    [['clip', divisionPath('pale', 100, 300)], ['fill', '#b3262e']], 'then again in the second, inside the division');
  // G12: a swatch painted again when only the division or the device's colour changed
  const img = { style: {}, src: '', alt: '', title: '' };
  paintSwatch(img, WOLF);
  const first = img.src;
  paintSwatch(img, { ...WOLF, division: 'pale', field2: 'sable', charge: 'argent' });
  assert.notEqual(img.src, first);
  assert.equal(img.alt, heraldryText({ ...WOLF, division: 'pale', field2: 'sable', charge: 'argent' }));
  for (const f of ['src/ui/nameLayer.js', 'src/ui/travel/travelViewHud.js']) assert.match(src(f), /heraldryKey\((arms|h)\)/, f);
  // G13
  assert.equal(heraldryOf({ ...owl, field2: 'gold', charge: 'argent' }), null, 'a border of the second colour, the device its own');
  assert.equal(armsWhy({ ...owl, field2: 'gold', charge: 'argent' }), 'a border unlike either field color');
  assert.ok(heraldryOf({ ...owl, field2: 'sable', charge: 'argent' }), 'and one unlike both stands');
  // G14
  assert.equal(heraldryText({ field: 'azure', border: 'gold', device: 'swords' }), 'Azure bordered Gold, a Pair of Swords');
  assert.equal(heraldryText({ field: 'azure', border: 'gold', device: 'scales', charge: 'argent' }), 'Azure bordered Gold, a Pair of Scales Argent');
});

test('GUILD2c (AUDIT2 G2/G3): a hole is painted once in each colour, each inside its own part - the first colour clipped to the division\'s complement (even-odd), never whole under the second; every division a part of its own at the banner\'s box and the shield\'s; the canvas shield divides as the SVG does (mutants: the first colour painted whole; the complement non-zero; a division drawn on the banner\'s box alone)', () => {
  const owl = { field: 'azure', border: 'gold', device: 'owl', division: 'pale', field2: 'crimson' };
  // G3: each division at both boxes - its own part, and its complement the box less it
  for (const d of HERALDRY_DIVISIONS.slice(1)) {
    for (const [w, h] of [[100, 300], [100, 104]]) {
      const part = divisionPath(d, w, h);
      assert.match(part, /^M/, `${d} ${w}x${h}`);
      assert.equal(divisionComplement(part, w, h), `M0 0 H${w} V${h} H0 Z ${part}`);
      assert.ok(!part.includes('NaN'), `${d} ${w}x${h}`);
    }
  }
  assert.equal(divisionPath('fess', 100, 104), 'M0 52 H100 V104 H0 Z', 'the shield\'s own middle, never the banner\'s');
  assert.equal(divisionComplement('', 100, 104), '', 'plain: none');
  // G2, the SVG: the first colour's hole inside the complement's clip, even-odd; never a hole painted in it unclipped
  for (const [svg, box] of [[bannerSvg(owl), [100, 300]], [shieldSvg(owl), [100, 104]]]) {
    const c = /<clipPath id="([^"]+c)"><path d="([^"]+)" clip-rule="evenodd"\/><\/clipPath>/.exec(svg);
    assert.ok(c, 'the first part\'s clip, even-odd');
    assert.equal(c[2], divisionComplement(divisionPath('pale', ...box), ...box));
    assert.ok(new RegExp(`clip-path="url\\(#${c[1]}\\)"><g transform="[^"]+"><path d="[^"]+" fill="#3b6fd8"/>`).test(svg), 'the hole in the first colour, inside its part');
    const devices = svg.slice(svg.indexOf('</defs>'));
    const unclipped = devices.split('<g transform=').slice(1).filter((x, i, all) => /fill="#3b6fd8"/.test(x.split('</g>')[0]));
    const holesClipped = (devices.match(new RegExp(`url\\(#${c[1]}\\)`, 'g')) ?? []).length;
    assert.equal(unclipped.length, holesClipped, 'every first-colour hole is inside the complement\'s clip');
  }
  // G2/G3, the canvas: banner and shield - the first colour clipped even-odd, the second inside the division
  const run = (draw) => {
    const calls = [];
    globalThis.Path2D = class { constructor(d) { this.d = d; } };
    const ctx = new Proxy({}, {
      get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, a[0]?.d ?? null, o.fillStyle, a[1] ?? null]); }),
      set: (o, k, v) => { o[k] = v; return true; },
    });
    draw(ctx);
    delete globalThis.Path2D;
    return calls;
  };
  for (const [calls, box] of [[run((ctx) => drawBanner(ctx, { ...owl, device: 'key' }, 64)), [100, 300]], [run((ctx) => drawShield(ctx, { ...owl, device: 'key' }, 0, 0, 32)), [100, 104]]]) {
    const part = divisionPath('pale', ...box);
    assert.ok(calls.some((c) => c[0] === 'fill' && c[1] === part && c[2] === '#b3262e'), 'the second colour over its part');
    const comp = calls.findIndex((c) => c[0] === 'clip' && c[1] === divisionComplement(part, ...box));
    assert.ok(comp > 0, 'the first part clipped');
    assert.equal(calls[comp][3], 'evenodd');
    const next = calls.slice(comp + 1).filter((c) => c[0] === 'fill' || c[0] === 'clip').slice(0, 3).map((c) => [c[0], c[0] === 'fill' ? c[2] : c[1]]);
    assert.deepEqual(next, [['fill', '#3b6fd8'], ['clip', part], ['fill', '#b3262e']], 'the bow in each colour, each in its part');
  }
  const plainCalls = run((ctx) => drawShield(ctx, { field: 'azure', border: 'gold', device: 'key' }, 0, 0, 32));
  assert.equal(plainCalls.filter((c) => c[0] === 'clip').length, 1, 'plain arms: the shield\'s own clip alone, as GUILD1d drew');
  assert.ok(plainCalls.some((c) => c[0] === 'fill' && c[1] === SHIELD_CLOTH));
});

test('GUILD2c the Arms page: the guildmaster\'s choices are pictures - the division a tile each, drawn on the draft\'s own colours; the colours swatches, the ones the law refuses shut and saying why (AUDIT2 U14); the device a tile of forty; the device\'s own colour; the banner, the shield and the tag as they will stand (mutants: a refused colour offered; the second colour row on a plain field)', async () => {
  const t = await tab(view({ marks: 900 }), {}, 'arms');
  const tiles = find(t.panel.root, 'dfsocial-tile');
  assert.equal(tiles.filter((x) => /^Field: /.test(x.attrs['aria-label'])).length, 8);
  assert.equal(tiles.filter((x) => /^Device: /.test(x.attrs['aria-label'])).length, 40);
  const sw = (label) => find(t.panel.root, 'dfsocial-swatch').find((x) => x.attrs['aria-label'] === label || x.attrs['aria-label'].startsWith(`${label} (`));
  assert.equal(sw('Field color: Ash').disabled, true, 'Ash never the field');
  assert.match(src('src/ui/socialPanel.js'), /\.dfsocial\.touch \.dfsocial-swatch \{ width: 44px; height: 44px; \}/, 'AUDIT2 D4: a finger\'s swatch');
  assert.equal(sw('Field color: Gold').disabled, true, 'nor the border\'s colour');
  // AUDIT2 U14: a shut swatch says why - on its label and title, and drawn under its row for a finger
  assert.equal(sw('Field color: Gold').attrs['aria-label'], 'Field color: Gold (unavailable: the arms need a border unlike the field)');
  assert.equal(sw('Field color: Gold').attrs.title, 'Gold (unavailable: the arms need a border unlike the field)');
  assert.ok(texts(t.panel.root).some((x) => /^Unavailable: the arms need .*a border unlike the field/.test(x)), 'drawn');
  assert.equal(sw('Second color: Crimson'), undefined, 'a plain field has no second colour');
  tiles.find((x) => x.attrs['aria-label'] === 'Field: Per pale').fire('click');
  assert.ok(sw('Second color: Crimson'), 'divided, it has');
  assert.equal(sw('Second color: Azure').disabled, true, 'never the field\'s');
  sw('Second color: Crimson').fire('click');
  sw('Device color (matches the border unless chosen): Argent').fire('click');
  const [banner] = find(t.panel.root, 'dfsocial-armspics')[0].children;
  assert.ok(decodeURIComponent(banner.src).includes('fill="#b3262e"'), 'the banner wears the draft');
  assert.ok(texts(t.panel.root).includes('Per pale Azure and Crimson, bordered Gold, a Wolf Argent'));
  assert.equal(button(t.panel.root, 'Change it').disabled, false);
  assert.ok(find(t.panel.root, 'dfsocial-tagchip')[0].textContent.includes('HND'));
  // AUDIT GUILD2: every swatch asks the law itself - the device's colour against the second field colour was left open,
  // and a pick of it made arms the law refused (the border's too, while the device wears the border's)
  assert.equal(sw('Device color (matches the border unless chosen): Crimson').disabled, true, 'never the second colour');
  sw('Device color (matches the border unless chosen): Gold').fire('click');   // the border's again
  assert.equal(sw('Border: Crimson').disabled, true, 'a border the device would wear against the second colour');
  for (const label of find(t.panel.root, 'dfsocial-swatch').map((b) => b.attrs['aria-label'])) {
    const b = sw(label);   // drawn again at each pick: the swatch as it stands now
    if (!b || b.disabled) continue;
    b.fire('click');
    const raise = button(t.panel.root, 'Change it');
    assert.equal(raise.disabled, false, `${label} - an open swatch makes arms the law takes (${raise.whyEl?.textContent ?? ''})`);
  }
});
