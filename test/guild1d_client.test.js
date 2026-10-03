// GUILD1d (2026-09-30, Mac: "Lets do this"): THE GUILD HALL AND HERALDRY, THE CLIENT'S HALF - the law both ends read
// (net/heraldryLaw.js, net/hallLaw.js, net/homeLaw.js), the drawing (ui/heraldryArt.js), the homes' registry and the
// door's rows (systems/onlineHomes.js), the guild book's acts (net/guildBook.js), the Guild tab's Hall and Heraldry
// (ui/socialPanel.js), the banners' anchors and the cloth (scenes/hallBanners.js, render/bannerPass.js), and the hosts'
// wiring by source. bible/11-Multiplayer/Seats-Arc.md 8; `06-Systems/Online-Arc.md` GUILD1d.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HERALDRY_COLOURS, HERALDRY_DEVICES, HERALDRY_UNHELD, HERALDRY_CHANGE_DRAKES, heraldryOf, heraldrySame, heraldryText, heraldryColourOf,
} from '../src/net/heraldryLaw.js';
import { GUILD_RANK_NAMES, GUILD_POWERS } from '../src/net/guildLaw.js';
import {
  HALL_POWERS, GUILD_HALL_ENTRIES, GUILD_HALL_ENTRY_DEFAULT, guildHallPrice, guildHallOwner, guildHallEntryOk, hallMay,
} from '../src/net/hallLaw.js';
import { HOME_ENTRIES, homeMayEnter, homeEntryOk } from '../src/net/homeLaw.js';
import { DEVICE_ART, DEVICES_DRAWN, bannerSvg, drawBanner, BANNER_CLOTH } from '../src/ui/heraldryArt.js';
import {
  createOnlineHomes, homeDoorTitle, homeLockedLine, homeBelongsLine, homeDoorAnswer, homeHallBuyRow, homeHallRows, hallNextEntry, HOME_VERB, HALL_VERB, homeVisitorRows,
  HOME_ENTRY_WORDS, homeNextEntry,
} from '../src/systems/onlineHomes.js';
import { GuildBook } from '../src/net/guildBook.js';
import { createSocialPanel, GUILD_HALL_NONE_TEXT, GUILD_HERALDRY_NONE_TEXT, GUILD_LEDGER_WORDS, guildHallWhereText } from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';
import { REFUSALS, accountGuilds } from '../src/net/accountClient.js';
import { doorCornersOf, hallBannerAnchors, createHallBanners, BANNER_TOP_M, BANNER_SIDE_GAP_M, BANNER_OUT_M } from '../src/scenes/hallBanners.js';
import {
  BannerRenderer, clothVertices, bannerClock, BANNER_ROWS, BANNER_CLOCK_PERIOD, BANNER_SWING_HZ, BANNER_RIPPLE_HZ, BANNER_W_M, BANNERS_MAX, BANNER_FS, BANNER_VS,
} from '../src/render/bannerPass.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };

test('GUILD1d the heraldry\'s law: sixteen colours in the record\'s order with its colours, twenty-four devices, Ash never the field, the two colours different; the words (mutants: Ash as a field; the same colour twice; a device off the list)', () => {
  assert.deepEqual(HERALDRY_COLOURS.map((c) => c.name), ['Azure', 'Crimson', 'Gold', 'Argent', 'Sable', 'Vert', 'Purpure', 'Tenné', 'Sanguine', 'Celeste', 'Murrey', 'Ochre', 'Teal', 'Rose', 'Ash', 'Umber']);
  assert.equal(heraldryColourOf('azure').hex, '#3b6fd8');
  assert.equal(heraldryColourOf('umber').hex, '#5a3e22');
  assert.equal(HERALDRY_DEVICES.length, 24);
  assert.deepEqual(HERALDRY_DEVICES.slice(0, 4), ['wolf', 'bear', 'boar', 'stag']);
  assert.equal(HERALDRY_UNHELD, 'ash');
  assert.equal(HERALDRY_CHANGE_DRAKES, 500);
  assert.deepEqual(heraldryOf(WOLF), WOLF);
  assert.equal(heraldryOf({ ...WOLF, field: 'ash' }), null, 'Ash is the unheld ring\'s');
  assert.deepEqual(heraldryOf({ ...WOLF, border: 'ash' }), { ...WOLF, border: 'ash' }, 'a border may be Ash');
  assert.equal(heraldryOf({ ...WOLF, border: 'azure' }), null, 'two colours, not one');
  assert.equal(heraldryOf({ ...WOLF, device: 'unicorn' }), null);
  assert.equal(heraldryOf({ ...WOLF, field: 'pink' }), null);
  assert.equal(heraldryOf(null), null);
  assert.equal(heraldryOf([WOLF]), null);
  assert.equal(heraldrySame(WOLF, { device: 'wolf', border: 'gold', field: 'azure' }), true);
  assert.equal(heraldrySame(WOLF, { ...WOLF, device: 'bear' }), false);
  assert.equal(heraldrySame(null, null), true);
  assert.equal(heraldrySame(WOLF, null), false);
  assert.equal(heraldryText(WOLF), 'Azure bordered Gold, a Wolf');
  assert.equal(heraldryText({ ...WOLF, device: 'eagle' }), 'Azure bordered Gold, an Eagle');
  assert.equal(heraldryText(null), '');
});

test('GUILD1d the hall\'s law: half again, rounded up; its entries its members\' or anyone\'s; its mark no character\'s id; the powers - the hall and heraldry the guildmaster\'s, who may walk in and the decor the Officers\' too; a home\'s `guild` entry (mutants: the price; an entry; a power; the guildmate unread)', () => {
  assert.equal(guildHallPrice(20_000), 30_000);
  assert.equal(guildHallPrice(1), 2);
  assert.equal(guildHallPrice(0), 0);
  assert.equal(guildHallPrice(1.5), 0);
  assert.deepEqual([...GUILD_HALL_ENTRIES], ['guild', 'public']);
  assert.equal(GUILD_HALL_ENTRY_DEFAULT, 'guild');
  assert.equal(guildHallEntryOk('private'), false);
  assert.equal(guildHallOwner('g0123456789'), 'guild:g0123456789');
  assert.ok(!/^[A-Za-z0-9_-]{4,64}$/.test(guildHallOwner('g0123456789')), 'outside CHAR_ID_RE');
  assert.deepEqual(Object.fromEntries(Object.entries(HALL_POWERS).map(([k, v]) => [k, [...v]])), { hall: [0], heraldry: [0], hallEntry: [0, 1], decorate: [0, 1], notes: [0, 1] });   // GUILD1e: the guild's board kept by its Officers
  assert.deepEqual([hallMay(0, 'hall'), hallMay(1, 'hall'), hallMay(1, 'hallEntry'), hallMay(2, 'decorate'), hallMay(0, 'nonsense')], [true, false, true, false, false]);
  assert.equal(GUILD_POWERS.hall, undefined, 'the hall\'s law is its own module - the guild law is the relay\'s, every byte a deploy');
  assert.deepEqual(HOME_ENTRIES, ['private', 'party', 'public', 'guild']);
  assert.equal(homeEntryOk('guild'), true);
  assert.equal(homeMayEnter({ owner: 'Olga', entry: 'guild', guildmate: true }), true);
  assert.equal(homeMayEnter({ owner: 'Olga', entry: 'guild' }), false);
  assert.equal(homeMayEnter({ owner: 'Olga', entry: 'guild' }, { partyNames: ['Olga'] }), false, 'a party is not a guild');
  const hall = { owner: 'The Hand', entry: 'guild', hall: { name: 'The Hand', tag: 'HND', heraldry: null } };
  assert.equal(homeMayEnter(hall), false);
  assert.equal(homeMayEnter({ ...hall, member: true }), true);
  assert.equal(homeMayEnter({ ...hall, entry: 'public' }), true);
  assert.equal(homeMayEnter({ ...hall, mine: true }), false, 'an account opens no hall by being its anchor');
  assert.equal(homeNextEntry('public'), 'guild');
  assert.equal(homeNextEntry('guild'), 'private');
  assert.equal(HOME_ENTRY_WORDS.guild, 'My guild');
});

test('GUILD1d the drawing: every device drawn; the banner\'s SVG is the field, the border and the device in the two colours, a plain Ash cloth for none; the canvas paints the same parts in the same order (mutants: a device\'s art gone; the colours swapped; a hole in the device\'s colour)', () => {
  assert.equal(DEVICES_DRAWN, true);
  assert.deepEqual(Object.keys(DEVICE_ART).sort(), [...HERALDRY_DEVICES].sort());
  const svg = bannerSvg(WOLF, { width: 40 });
  assert.match(svg, /width="40" height="120"/);
  assert.ok(svg.includes(`<path d="${BANNER_CLOTH}" fill="#3b6fd8"/>`), 'the field the first colour');
  assert.ok(svg.includes('stroke="#d4a017"'), 'the border the second');
  assert.ok(svg.includes(`fill="#d4a017"/>`), 'the device in the second');
  const plain = bannerSvg(null);
  assert.ok(plain.includes('fill="#8a8a8a"') && !plain.includes('stroke='), 'no heraldry: the plain Ash cloth');
  const calls = [];
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, a[0]?.d ?? null, o.fillStyle, o.strokeStyle]); }),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  drawBanner(ctx, { ...WOLF, device: 'eye' }, 64);
  const fills = calls.filter((c) => c[0] === 'fill');
  assert.equal(fills[0][1], BANNER_CLOTH);
  assert.equal(fills[0][2], '#3b6fd8', 'the field first');
  assert.deepEqual(fills.slice(1).map((c) => c[2]), ['#d4a017', '#3b6fd8', '#d4a017'], 'the eye: the almond, its hole in the field\'s colour, the pupil');
  assert.ok(calls.some((c) => c[0] === 'stroke' && c[3] === '#d4a017'), 'the border');
  delete globalThis.Path2D;
});

test('GUILD1d the homes\' registry reads a hall: its guild, whether the character is a member and a keeper, a home\'s guildmate; the door\'s words for a hall (mutants: the hall unread; member read as keeper; the titles a home\'s)', async () => {
  const api = { town: async () => ({ ok: true, data: { homes: [
    { buildingKey: 300, owner: 'The Hand', entry: 'guild', mine: false, hall: { name: 'The Hand', tag: 'HND', heraldry: WOLF }, member: true, keeper: true },
    { buildingKey: 301, owner: 'The Hand', entry: 'guild', mine: false, hall: { name: 'The Hand', tag: 'HND', heraldry: { ...WOLF, field: 'ash' } } },
    { buildingKey: 302, owner: 'Olga', entry: 'guild', mine: false, guildmate: true },
  ] } }) };
  const homes = createOnlineHomes({ api, character: () => 'rabc' });
  await homes.ensure(7);
  const hall = homes.homeAt(7, 300);
  assert.deepEqual(hall.hall, { name: 'The Hand', tag: 'HND', heraldry: WOLF });
  assert.equal(hall.member, true);
  assert.equal(hall.keeper, true);
  assert.equal(hall.own, false, 'a hall is nobody\'s own');
  const other = homes.homeAt(7, 301);
  assert.equal(other.hall.heraldry, null, 'a heraldry the law refuses reads as none');
  assert.equal(other.member, false);
  assert.equal(homes.homeAt(7, 302).guildmate, true);
  assert.equal(homeDoorAnswer(hall), 'enter');
  assert.equal(homeDoorAnswer(other), 'locked');
  assert.equal(homeDoorAnswer(homes.homeAt(7, 302)), 'enter');
  assert.equal(homeDoorTitle(hall), "Your guild's hall");
  assert.equal(homeDoorTitle(other), "The Hand's hall <HND>");
  assert.equal(homeLockedLine(other), 'This is the hall of The Hand. Its doors open to its members.');
  assert.equal(homeBelongsLine(other), 'This belongs to The Hand.');
});

test('GUILD1d the door\'s rows: "Buy it for <guild>" to a guildmaster whose guild holds no hall, at half again, armed by its first press; a hall\'s "Go in" to its members and "Who may enter" to its keepers (mutants: an Officer offered the buy; a guild with a hall offered it; the entry row to a member)', () => {
  const gm = { name: 'The Hand', rank: 0, hall: false, treasury: 50_000 };
  assert.deepEqual(homeHallBuyRow(20_000, gm), { id: HALL_VERB.buy, label: 'Buy it for The Hand: 30000 gold from the treasury' });
  assert.equal(homeHallBuyRow(20_000, gm, true).label, 'Click again to buy it for The Hand: 30000 gold');
  assert.equal(homeHallBuyRow(20_000, { ...gm, rank: 1 }), null, 'the guildmaster\'s alone');
  assert.equal(homeHallBuyRow(20_000, { ...gm, hall: true }), null, 'one hall');
  assert.equal(homeHallBuyRow(20_000, null), null);
  const hall = { entry: 'guild', hall: { name: 'The Hand' }, member: true };
  assert.deepEqual(homeHallRows(hall, 'enter'), [{ id: HOME_VERB.enter, label: 'Go in' }]);
  assert.deepEqual(homeHallRows({ ...hall, hallEntry: true }, 'enter')[1], { id: HALL_VERB.entry, label: 'Who may enter: Members' });   // AUDIT PROF-541 G2: the service's `hallEntry`
  assert.deepEqual(homeVisitorRows({ ...hall, hallEntry: true, rent: { vacant: 1, from: 5 } }, 'enter'), homeHallRows({ ...hall, hallEntry: true }, 'enter'), 'a hall is visited as a hall - no room to rent');
  assert.equal(homeHallRows(hall, 'locked'), null);
  assert.equal(hallNextEntry('guild'), 'public');
  assert.equal(hallNextEntry('public'), 'guild');
});

/** A guild book over a door that answers ok, recording calls. */
function hallBook(guild = { id: 'g0123456789', name: 'The Hand', tag: 'HND', rank: 0, members: [], ledger: [], hall: { mapId: 9, buildingKey: 5, region: 17, entry: 'guild', price: 100, paid: 150 } }) {
  const calls = [];
  const told = [];
  const answers = {};
  const reply = (route) => async (...a) => { calls.push([route, ...a]); return answers[route] ?? { ok: true, data: {} }; };
  const door = { mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }) };
  for (const r of ['hallBuy', 'hallSell', 'hallEntry', 'heraldry']) door[r] = reply(r);
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), onHall: (m) => told.push(m) });
  return { book, calls, told, answers };
}

test('GUILD1d the guild book\'s hall acts: through the door as the character playing, the hall\'s town told to the host on a landing (the old hall\'s on a sale); a heraldry change keeps ONE request id while the same choice is asked again, a new one for a new choice, none past an answer (mutants: onHall unsaid; the sale telling no town; the rid minted each ask)', async () => {
  const { book, calls, told, answers } = hallBook();
  await book.refresh();
  assert.equal((await book.buyHall({ mapId: 7, buildingKey: 300, region: 17, price: 20_000 })).ok, true);
  assert.deepEqual(calls[0], ['hallBuy', { character: 'rabc', mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: null }]);   // AUDIT PRE-MERGE 1003 WD1: the town's layout passed through
  assert.deepEqual(told, [7]);
  await book.sellHall();
  assert.deepEqual(calls[1], ['hallSell', 'rabc']);
  assert.deepEqual(told, [7, 9], 'the hall the book knew');
  assert.equal((await book.setHallEntry('private')).error, 'bad-entry');
  await book.setHallEntry('public');
  assert.deepEqual(calls[2], ['hallEntry', 'rabc', 'public']);
  answers.heraldry = { ok: false, error: 'offline' };
  await book.setHeraldry(WOLF);
  await book.setHeraldry(WOLF);
  const rids = calls.filter((c) => c[0] === 'heraldry').map((c) => c[3]);
  assert.equal(rids.length, 2);
  assert.equal(rids[0], rids[1], 'asked again: one line');
  assert.match(rids[0], /^[A-Za-z0-9_-]{8,40}$/);
  await book.setHeraldry({ ...WOLF, device: 'bear' });
  assert.notEqual(calls.at(-1)[3], rids[0], 'a new choice, a new request');
  answers.heraldry = { ok: true, data: {} };
  await book.setHeraldry({ ...WOLF, device: 'bear' });
  const last = calls.at(-1)[3];
  await book.setHeraldry({ ...WOLF, device: 'bear' });
  assert.notEqual(calls.at(-1)[3], last, 'an answer lets it go');
  assert.equal((await book.setHeraldry({ ...WOLF, field: 'ash' })).error, 'bad-heraldry');
});

test('GUILD1d the client\'s door: the four routes and their bodies; every refusal the service says has a sentence (mutants: a route\'s path; a refusal unsaid)', async () => {
  const seen = [];
  const store = { getItem: () => JSON.stringify({ secret: 's', id: 'p' }) };
  const door = accountGuilds({ fetch: async (url, init) => { seen.push([String(url).replace(/^.*\/v1/, '/v1'), JSON.parse(init.body)]); return new Response('{}', { status: 200 }); }, storage: store });
  await door.hallBuy({ character: 'rabc', mapId: 7, buildingKey: 300, region: 17, price: 20_000 });
  await door.hallSell('rabc');
  await door.hallEntry('rabc', 'public');
  await door.heraldry('rabc', WOLF, 'herald-01');
  await door.heraldry('rabc', WOLF);
  assert.deepEqual(seen.map((s) => s[0]), ['/v1/guilds/hall/buy', '/v1/guilds/hall/sell', '/v1/guilds/hall/entry', '/v1/guilds/heraldry', '/v1/guilds/heraldry']);
  assert.deepEqual(seen[0][1], { character: 'rabc', mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: null });   // AUDIT PRE-MERGE 1003 WD1: always said
  assert.deepEqual(seen[3][1], { character: 'rabc', heraldry: WOLF, rid: 'herald-01' });
  assert.equal(seen[4][1].rid, undefined, 'the first choice needs none');
  for (const w of ['guild-hall-have', 'guild-hall-none', 'guild-hall-moved', 'guild-hall', 'hall-item', 'hall-yard', 'bad-heraldry', 'heraldry-same', 'heraldry-moved', 'heraldry-drakes']) {
    assert.equal(typeof REFUSALS[w], 'string', w);
  }
  assert.match(REFUSALS['heraldry-drakes'], /500 silver/);
});

// ─── THE TAB ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, innerHTML: '',
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
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const button = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label || b.children[0]?.textContent === label || String(b.textContent).startsWith(label));
const settle = () => new Promise((r) => setImmediate(r));
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }], invites: [], ledger: [], hall: null, heraldry: null, ...over,
});
async function tabRig(guild) {
  const { book, calls } = hallBook(guild);
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc: fakeDocument(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  panel.openGuild();
  await settle(); await settle(); panel.render();
  return { panel, calls, book };
}

test('GUILD1d the Guild tab: with no hall how one is bought; with one where it stands, who may walk in (an Officer\'s to turn) and its sale the guildmaster\'s, pressed twice; the banner every member\'s to see, its choice the guildmaster\'s - the first free, a change costing Drakes; the ledger\'s hall lines; leaving and disbanding held by the hall (mutants: the sale one press; a Recruit offered the entry; the change enabled with no Drakes; the ledger\'s kinds unread)', async () => {
  const none = await tabRig(view());
  const t0 = texts(none.panel.root);
  assert.ok(t0.includes(GUILD_HALL_NONE_TEXT), 'how a hall is bought');
  assert.ok(t0.includes(GUILD_HERALDRY_NONE_TEXT));
  assert.ok(t0.includes('The first choice is free.'));
  assert.equal(button(none.panel.root, 'Raise it').disabled, false, 'the default draft is a heraldry');
  button(none.panel.root, 'Raise it').fire('click');
  await settle();
  assert.deepEqual(none.calls.find((c) => c[0] === 'heraldry').slice(1, 3), ['rabc', WOLF]);
  const hall = { mapId: 7, buildingKey: 300, region: 17, entry: 'guild', price: 20_000, paid: 30_000 };
  const ledger = [{ at: 1, who: 'Aldric', kind: 'hall', amount: 30_000, balance: 5 }, { at: 1, who: 'Aldric', kind: 'hall-piece', amount: 60, balance: 65 }];
  const gm = await tabRig(view({ hall, heraldry: WOLF, ledger, treasury: 5, marks: 100 }));
  const t1 = texts(gm.panel.root);
  assert.ok(t1.includes(guildHallWhereText(hall)));
  assert.ok(t1.includes(`Aldric ${GUILD_LEDGER_WORDS.hall} 30,000`));
  assert.ok(t1.includes(`Aldric ${GUILD_LEDGER_WORDS['hall-piece']} 60`));
  assert.ok(t1.includes('Azure bordered Gold, a Wolf'));
  assert.equal(button(gm.panel.root, 'Change it').disabled, true, 'the same heraldry');
  assert.ok(button(gm.panel.root, 'Sell the hall'));
  button(gm.panel.root, 'Sell the hall').fire('click');
  gm.panel.render();
  assert.equal(gm.calls.filter((c) => c[0] === 'hallSell').length, 0, 'the first press arms');
  button(gm.panel.root, 'Sure?').fire('click');
  await settle();
  assert.equal(gm.calls.filter((c) => c[0] === 'hallSell').length, 1);
  button(gm.panel.root, 'Open it to anyone').fire('click');
  await settle();
  assert.deepEqual(gm.calls.find((c) => c[0] === 'hallEntry').slice(1), ['rabc', 'public']);
  assert.equal(button(gm.panel.root, 'Leave').disabled, true);
  assert.equal(button(gm.panel.root, 'Disband').disabled, true, 'sell the hall first');
  // a change short of Drakes
  const [field] = find(gm.panel.root, 'dfsocial-field').filter((f) => f.attrs['aria-label'] === 'The field');
  field.value = 'crimson'; field.fire('change'); gm.panel.render();
  assert.equal(button(gm.panel.root, 'Change it').disabled, true, `${HERALDRY_CHANGE_DRAKES} Drakes wanted, 100 held`);
  const recruit = await tabRig(view({ rank: 3, hall, heraldry: WOLF, members: [{ member: 'm2', name: 'Rhea', rank: 3, joinedAt: 1, you: true }] }));
  const t3 = texts(recruit.panel.root);
  assert.ok(t3.includes('Azure bordered Gold, a Wolf'), 'every member sees the banner');
  assert.equal(button(recruit.panel.root, 'Open it to anyone'), undefined);
  assert.equal(button(recruit.panel.root, 'Sell the hall'), undefined);
  assert.equal(button(recruit.panel.root, 'Change it'), undefined);
  const [banner] = find(recruit.panel.root, 'dfsocial-banner');
  assert.ok(banner.children[0].src.startsWith('data:image/svg+xml') && banner.children[0].src.includes(encodeURIComponent('#3b6fd8')), 'the banner a picture of its own drawing, never markup');
});

test('GUILD1d the banners\' anchors: a door\'s corners through its building\'s matrix; two cloths beside it, each past a jamb, hanging off its face away from the building\'s middle, their tops over its foot (mutants: the face toward the building; one banner; the gap dropped; the foot the top corner)', () => {
  const m = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 10, 0, 20, 1];   // a quarter turn about Y, then (10, 0, 20)
  const c = doorCornersOf({ vert0: { x: -1, y: 0, z: 0 }, vert2: { x: 1, y: 2.5, z: 0 } }, m);
  assert.deepEqual(c, { a: [10, 0, 21], b: [10, 2.5, 19] });
  assert.equal(doorCornersOf({}, m), null);
  // a door 2 m wide in the south wall (z = 0) of a building standing north of it (z 0..10)
  const frame = { box: [0, 0, 0, 10, 6, 10], door: { a: [4, 0, 0], b: [6, 2.5, 0] } };
  const [left, right] = hallBannerAnchors(frame);
  assert.deepEqual(left.out, [0, 0, -1], 'its face: away from the building\'s middle');
  assert.equal(left.top[1], BANNER_TOP_M, 'over the foot');
  const side = 1 + BANNER_SIDE_GAP_M + BANNER_W_M / 2;
  assert.ok(Math.abs(left.top[0] - (5 - side)) < 1e-9 && Math.abs(right.top[0] - (5 + side)) < 1e-9, 'past each jamb');
  assert.ok(Math.abs(left.top[2] + BANNER_OUT_M) < 1e-9, 'off the wall');
  assert.deepEqual(right.right, [1, 0, 0]);
  assert.equal(hallBannerAnchors({ box: frame.box, door: { a: [5, 0, 0], b: [5.1, 2, 0] } }), null, 'no door a man goes through');
  assert.equal(hallBannerAnchors({ box: frame.box }), null);
});

test('GUILD1d the streets\' banners: a hall wearing its heraldry hangs two in its pixel where the scene has it now; a hall without, or a home, none; read again when the registry moves; at most a frame\'s, the nearest first (mutants: a home\'s banners; the translation unread; the version unread)', () => {
  let v = 1;
  const rows = new Map([[300, { hall: { heraldry: WOLF } }], [301, { hall: { heraldry: null } }], [302, {}]]);
  const homes = { homeAt: (_m, bk) => rows.get(bk) ?? null, version: () => v };
  const frame = { box: [0, 0, 0, 10, 6, 10], door: { a: [4, 0, 0], b: [6, 2.5, 0] } };
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames: new Map([[300, frame], [301, frame], [302, frame]]) }]]);
  let t = [100, 0, 200];
  const hb = createHallBanners({ built: () => built, homes, translation: () => t, now: () => 0 });
  const list = hb.list();
  assert.equal(list.length, 2);
  assert.equal(list[0].key, 'azure|gold|wolf');
  assert.equal(list[0].top[0], 100 + 5 - (1 + BANNER_SIDE_GAP_M + BANNER_W_M / 2));
  t = [0, 0, 0];
  assert.equal(hb.list()[0].top[2], -BANNER_OUT_M, 'where the scene has it now');
  rows.set(301, { hall: { heraldry: { ...WOLF, device: 'bear' } } });
  assert.equal(hb.list().length, 2, 'the registry unmoved: held');
  v = 2;
  assert.equal(hb.list().length, 4, 'moved: read again');
  const many = new Map([...Array(20)].map((_, i) => [400 + i, frame]));
  for (const k of many.keys()) rows.set(k, { hall: { heraldry: WOLF } });
  built.set('0,0', { px: 0, py: 0, homeTown: 7, homeFrames: many });
  v = 3;
  assert.equal(hb.list().length, BANNERS_MAX);
});

test('GUILD1d the cloth: rows of two triangles; the clock wrapped and every rate whole over it; the shader cuts the swallowtail and swings on the wind below its nailed top; nothing to draw touches nothing, and a frame that drew none still marks its seam (mutants: the discard; the swing at the top; a rate off the period)', () => {
  assert.equal(clothVertices().length, BANNER_ROWS * 12);
  assert.deepEqual([...clothVertices(1)], [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  assert.equal(bannerClock(BANNER_CLOCK_PERIOD + 3), 3);
  assert.equal(bannerClock(-1), BANNER_CLOCK_PERIOD - 1);
  for (const hz of [BANNER_SWING_HZ, BANNER_RIPPLE_HZ]) assert.equal(Number.isInteger(hz * BANNER_CLOCK_PERIOD), true);
  assert.match(BANNER_FS, /if \(t\.a < 0\.5\) discard;/);
  assert.match(BANNER_VS, /p \+= uOut \* d \* d \* uSize\.y/, 'the top stays nailed');
  const gl = new Proxy({}, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => ({})) });
  gl.getProgramParameter = () => true; gl.getShaderParameter = () => true;
  const r = new BannerRenderer(/** @type {any} */ (gl), { paint: () => null });
  assert.equal(r.draw([], new Float32Array(16), new Float32Array(16), [0, 0, 0], 1), false);
  assert.equal(r.draw([{ key: 'k', heraldry: WOLF, top: [0, 0, 0], right: [1, 0, 0], out: [0, 0, 1] }], new Float32Array(16), new Float32Array(16), [0, 0, 0], 1), true, 'the program changed - the host marks the seam (AUDIT GUILD1d R6)');
  assert.equal(r.drawn, 0, 'a heraldry that cannot be painted draws nothing');
});

test('GUILD1d wired: the building host - the hall\'s rows and its buy, the chest, stations and rest for members, the keepers\' decor as a hall; the world host - the door measured at the build, the banners built and drawn after the duel walls, the guild\'s hall handed down; the decorator offers a hall no personal things (by source)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /if \(home\) return homeVisitorRows\(home, homeDoorFor\(bd, home\)\);[^\n]*GUILD1d/);
  assert.match(wm, /const hall = homeHallBuyRow\(price, hallGuild\(\), hallArmed\(bd\)\);/);
  assert.match(wm, /if \(verb === HALL_VERB\.buy && price\) \{ pressHallBuy\(bd, price\); return true; \}/);
  assert.match(wm, /if \(c && \(\(interiorHome\?\.hall && interiorHome\.member\) \|\| interiorSeatHall\?\.member\)\) \{ openHallChest\(\); return true; \}/);   // PIN MOVED (SEAT-HALL): the palace's hall shares the line
  assert.match(wm, /if \(!decorOwnerHere\(\)\) \{\n\s*if \(!hallMemberHere\(\)\) \{   \/\/ GUILD1d: a hall's stations are its members'/);
  assert.match(wm, /if \(interiorHome\?\.hall\) return \{ kind: 'home', hall: true, where: "Your guild's hall"/);
  assert.match(src('src/systems/homeRent.js'), /home\.own === true \|\| !!\(home\.hall && home\.member\) \|\| rentDaysLeft/);   // PIN MOVED (the merge of main's RENT-REST): a member's bed is the home's bed rule's, homeBedIsMine
  assert.match(wm, /if \(mode !== 'interior' \|\| !b \|\| !\(decorOwnerHere\(\) \|\| decorKeeperHere\(\)\)\) return null;/);
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(hf && !hf\.door\) hf\.door = doorCornersOf\(cpu\.doors\[0\], local\);/);
  assert.match(w, /const hallBanners = onlineHomes && bannerPass \? createHallBanners\(\{/);
  assert.ok(w.indexOf('const hung = bannersHung();') < w.indexOf('    drawVeiledPeerBodies();   // INVIS-LOOK'), 'before every glow (AUDIT GUILD1d R3; SEAT1a: the seats\' banners with the halls\')');
  assert.match(w, /openStores: \(\) => socialPanel\?\.openGuild\?\.\(\) === true,/);
  assert.match(w, /onHall: \(mapId\) => \{ onlineHomes\?\.ensure\?\.\(mapId, \{ force: true \}\); \},/);
  const dt = src('src/scenes/decorTool.js');
  assert.match(dt, /own: r\?\.hall \? \[\] : ownEntries\(\),/);
});
