// GUILD-SHOP and GUILD-LOGO (2026-10-30; bible/11-Multiplayer/Guild-Shop.md) - THE GUILD SHOP AND A GUILD'S OWN LOGO, ON
// THE SERVICE: a ware bought in silver - an account's from its balance by any member, a guild's from its treasury by the
// guildmaster - burnt and granted in one batch under a request id; every guild's arms by its tag for any session; a logo
// sent with its fee held, its card posted to the moderators, approved or turned down from Discord, withdrawn, and served.
// Driven through the real Worker over the real migrations (test/accountDb.mjs, test/realmSeat.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logoCard } from '../../server-account/src/guildLogos.js';   // AUDIT GUILD-SHOP D2

import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { discordInteraction } from '../../server-account/src/discord.js';
import { safetyMinute } from '../../server-account/src/safetyClock.js';
import { GUILD_POWERS } from '../../src/net/guild/guildLaw.js';
import {
  GUILD_SHOP_WARES, GUILD_SHOP_KEYS, GUILD_FURNITURE_MODELS, GUILD_RENAME_SILVER, GUILD_LOGO_FEE, guildWareOf, guildWaresHeld, guildWareOfModel, guildWareRoom,
} from '../../src/net/guild/guildShopLaw.js';
import { GUILD_LOGO_SIDE, GUILD_LOGO_MAX_BYTES, GUILD_LOGO_GAP_S, guildLogoShapeOf, guildLogoPathOf, guildLogoUrl } from '../../src/net/guild/guildLogoLaw.js';
import { ARMORY_PIECES, armoryKitOk } from '../../src/net/armoryLaw.js';
import { ICONS } from '../../src/net/identityToken.js';
import { MARKS_KINDS } from '../../src/net/marksLaw.js';
import { REFUSALS } from '../../src/net/accountClient.js';

const realNow = Date.now;
let _now = T0;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });

const MOD_ID = '111111111111111111';
/** A square PNG's first bytes - all the sniffer reads (src/poi/poiImage.js). */
function png(w, h = w, pad = 64) {
  const b = new Uint8Array(33 + pad);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
  return Buffer.from(b).toString('base64');
}

/** A service with Discord on, a guild founded by a realm character, a second member, and the moderator. */
async function stand() {
  const s = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', DISCORD_MOD_CHANNEL: '1560996671440293908', DISCORD_BOT_TOKEN: 'bot-token', DISCORD_MODERATORS: `${MOD_ID}:mac` });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const gid = found.body.guild.id;
  const member = await s.registered('Brenna');
  member.realm = await seatRealm(s.env, member.secret, 'Brenna', { name: 'Brenna', level: 3, goldPieces: 50, items: [], bankAccounts: [{ accountGold: 0 }] });
  member.character = member.realm.id;
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Brenna' }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/answer', { character: member.character, guild: gid, accept: true }, member.secret)).status, 200);
  const mod = await s.registered('Mac');
  const guildSilver = (n) => raw.prepare('INSERT INTO guild_marks (guild_id, balance) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET balance = excluded.balance').run(gid, n);
  const silverOf = () => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const balanceOf = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const ctx = () => ({ db: s.env.DB, nowS: _now, subtle: globalThis.crypto.subtle, rand: (b) => globalThis.crypto.getRandomValues(b) });
  const get = async (path) => { const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, { method: 'GET' }), s.env); return { status: res.status, headers: res.headers, bytes: new Uint8Array(await res.arrayBuffer()) }; };
  return { ...s, raw, gm, member, mod, gid, guildSilver, silverOf, balanceOf, ctx, get };
}

// ─── THE LAWS ────────────────────────────────────────────────────────

test('GUILD-SHOP the law: ten wares in four sections - three an account\'s (each its own bit, its key the piece or icon it gives), seven a guild\'s (each a most and a model of its own); the rename and the logo in silver; the two new powers the guildmaster\'s (mutants: a bit shared; a ware\'s payer; a model shared; the room\'s most)', () => {
  assert.deepEqual(GUILD_SHOP_KEYS, ['insigniaarmlet', 'guildcrest', 'guildsails', 'banker', 'standard', 'crestplaque', 'throne', 'wartable', 'weaponrack', 'brazier']);
  const acct = GUILD_SHOP_WARES.filter((w) => w.payer === 'account');
  assert.deepEqual(acct.map((w) => [w.key, w.price, w.bit]), [['insigniaarmlet', 1_500, 1], ['guildcrest', 600, 2], ['guildsails', 1_200, 4]]);
  assert.equal(new Set(acct.map((w) => w.bit)).size, acct.length, 'a bit a ware');
  assert.deepEqual(GUILD_SHOP_WARES.filter((w) => w.payer === 'guild').map((w) => [w.key, w.price, w.max, w.model]), [
    ['banker', 6_000, 2, 864300], ['standard', 1_500, 6, 864301], ['crestplaque', 800, 8, 864302], ['throne', 4_000, 1, 864303],
    ['wartable', 3_000, 2, 864304], ['weaponrack', 1_200, 6, 864305], ['brazier', 900, 8, 864306]]);
  assert.equal(new Set(GUILD_FURNITURE_MODELS).size, 7);
  assert.ok(ARMORY_PIECES.some((p) => p.key === 'insigniaarmlet' && p.slot === 'arms' && p.line === 'guild' && p.source === 'guild'), 'the armlet is the arms slot\'s, the guild line\'s');
  assert.ok(ICONS.includes('guildcrest'));
  assert.deepEqual(guildWaresHeld(1 | 4), ['insigniaarmlet', 'guildsails']);
  assert.deepEqual(guildWaresHeld(0), []);
  assert.equal(guildWareOfModel(864303)?.key, 'throne');
  assert.equal(guildWareOfModel(41000), null, 'a catalogue model is no guild ware');
  assert.deepEqual([guildWareRoom(guildWareOf('throne'), 0), guildWareRoom(guildWareOf('throne'), 1), guildWareRoom(guildWareOf('guildcrest'), 0)], [true, false, false]);
  assert.deepEqual([GUILD_RENAME_SILVER, GUILD_LOGO_FEE], [2_500, 2_500]);
  assert.deepEqual([[...GUILD_POWERS.shop], [...GUILD_POWERS.logo]], [[0], [0]]);
  for (const k of ['guild-rename', 'guild-shop', 'logo-fee']) assert.equal(MARKS_KINDS[k], 'burn', k);
  for (const k of ['logo-escrow', 'logo-return']) assert.equal(MARKS_KINDS[k], 'move', k);
  // the kit's third line: the armlet alone in its slot
  assert.deepEqual([armoryKitOk('00c00'), armoryKitOk('c0000'), armoryKitOk('00c0c')], [true, false, false]);
});

test('GUILD-LOGO the law: a square PNG or WebP of 64 to 256 pixels and at most 48 KiB; an id of 32 hex is its address (mutants: the square; the bounds; the type)', () => {
  const meta = (format, w, h = w) => ({ format, w, h });
  assert.deepEqual(guildLogoShapeOf(meta('png', 128), 1000), { type: 'image/png', side: 128 });
  assert.deepEqual(guildLogoShapeOf(meta('webp', 64), 1000), { type: 'image/webp', side: 64 });
  assert.deepEqual(guildLogoShapeOf(meta('jpeg', 128), 1000), { error: 'logo-type' });
  assert.deepEqual(guildLogoShapeOf(meta('png', 128, 127), 1000), { error: 'logo-square' });
  assert.deepEqual(guildLogoShapeOf(meta('png', 63), 1000), { error: 'logo-side' });
  assert.deepEqual(guildLogoShapeOf(meta('png', 257), 1000), { error: 'logo-side' });
  assert.deepEqual(guildLogoShapeOf(meta('png', 128), GUILD_LOGO_MAX_BYTES + 1), { error: 'logo-bytes' });
  assert.equal(GUILD_LOGO_SIDE, 128);
  const id = 'ab'.repeat(16);
  assert.equal(guildLogoUrl('https://acct.example/', id), `https://acct.example/v1/guilds/logo/${id}`);
  assert.equal(guildLogoPathOf(`/v1/guilds/logo/${id}`), id);
  assert.deepEqual([guildLogoUrl('https://a', 'nope'), guildLogoPathOf('/v1/guilds/logo/xyz')], [null, null]);
  for (const w of ['guild-rename-silver', 'no-ware', 'guild-ware-held', 'guild-ware-max', 'guild-logo', 'logo-pending', 'logo-none', 'logo-bytes', 'logo-type', 'logo-square', 'logo-side']) {
    assert.equal(typeof REFUSALS[w], 'string', w);
  }
});

// ─── THE SHOP ───────────────────────────────────────────────────────

test('GUILD-SHOP an account\'s ware: any member buys it from their own silver - the burn and the bit in one batch; asked again it is the purchase made; held once; the armlet then worn in the arms slot and the crest as the portrait (mutants: the balance unread; the bit unset; a repeat paid twice)', async () => {
  const s = await stand();
  const shop = await s.call('/v1/guilds/shop', { character: s.member.character }, s.member.secret);
  assert.equal(shop.status, 200, JSON.stringify(shop.body));
  assert.deepEqual(shop.body.shop.wares.find((w) => w.key === 'insigniaarmlet'), { key: 'insigniaarmlet', kind: 'armory', payer: 'account', price: 1_500, held: false });
  assert.equal(shop.body.shop.buysForGuild, false, 'a Member buys no hall piece');
  const buy = (ware, rid, who = s.member) => s.call('/v1/guilds/shop/buy', { character: who.character, ware, rid }, who.secret);
  assert.deepEqual((await buy('insigniaarmlet', 'buy-armlet-1')).body, { error: 'marks-short' }, 'no silver, nothing bought');
  assert.deepEqual((await buy('nonesuch', 'buy-none-01')).body, { error: 'no-ware' });
  assert.deepEqual((await buy('insigniaarmlet', 'x')).body, { error: 'bad-rid' });
  s.seedMarks(s.member, 2_000);
  const r = await buy('insigniaarmlet', 'buy-armlet-2');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.ware, r.body.paid, r.body.shop.marks, r.body.shop.wares.find((w) => w.key === 'insigniaarmlet').held], ['insigniaarmlet', 1_500, 500, true]);
  assert.equal(s.balanceOf(s.member), 500);
  const line = s.raw.prepare("SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = 'guild-shop'").get();
  assert.deepEqual({ ...line }, { src_kind: 'account', src_id: s.member.id, dst_kind: 'burn', dst_id: 'insigniaarmlet', amount: 1_500 });
  const again = await buy('insigniaarmlet', 'buy-armlet-2');
  assert.deepEqual([again.status, again.body.repeat, s.balanceOf(s.member)], [200, true, 500], 'asked again: the purchase made, paid once');
  s.seedMarks(s.member, 5_000, 'more');
  assert.deepEqual((await buy('insigniaarmlet', 'buy-armlet-3')).body, { error: 'guild-ware-held' });
  // the armlet is an armory piece the account holds; the crest an icon
  const wear = await s.call('/v1/account/armory', { slot: 'arms', piece: 'insigniaarmlet' }, s.member.secret);
  assert.equal(wear.status, 200, JSON.stringify(wear.body));
  assert.equal(wear.body.armory, '00c00');
  assert.equal((await buy('guildcrest', 'buy-crest-01')).status, 200);
  const icon = await s.call('/v1/account/icon', { icon: 'guildcrest' }, s.member.secret);
  assert.equal(icon.status, 200, JSON.stringify(icon.body));
  assert.equal(icon.body.icon, 'guildcrest');
  // a character in no guild buys nothing here
  const loner = await s.registered('Cato');
  assert.equal((await s.call('/v1/guilds/shop/buy', { character: 'char-cato', ware: 'guildcrest', rid: 'buy-crest-02' }, loner.secret)).body.error, 'no-guild');
});

test('GUILD-SHOP a guild\'s ware: the guildmaster buys hall furniture from the silver treasury, up to each ware\'s most; a Member may not; the guild\'s silver line names the ware (mutants: the rank unread; the most unread; the treasury unread)', async () => {
  const s = await stand();
  const buy = (ware, rid, who = s.gm) => s.call('/v1/guilds/shop/buy', { character: who.character, ware, rid }, who.secret);
  s.seedMarks(s.member, 50_000);
  assert.deepEqual((await buy('banker', 'buy-banker-m1', s.member)).body, { error: 'guild-rank' }, 'a Member\'s own silver buys no hall piece');
  assert.deepEqual((await buy('banker', 'buy-banker-01')).body, { error: 'guild-marks-short' });
  s.guildSilver(10_000);
  const r = await buy('banker', 'buy-banker-02');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([s.silverOf(), r.body.shop.guildMarks, r.body.shop.wares.find((w) => w.key === 'banker')], [4_000, 4_000,
    { key: 'banker', kind: 'furniture', payer: 'guild', price: 6_000, max: 2, model: 864300, owned: 1, placed: 0 }]);
  assert.equal((await buy('throne', 'buy-throne-01')).status, 200);
  assert.deepEqual((await buy('throne', 'buy-throne-02')).body, { error: 'guild-ware-max' }, 'one seat to a guild');
  assert.equal(s.silverOf(), 0);
  const view = await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret);
  const lines = view.body.guild.marksLedger.filter((l) => l.raw === 'guild-shop');
  assert.deepEqual(lines.map((l) => [l.ware, l.amount, l.out, l.who]), [['throne', 4_000, true, 'Aldric'], ['banker', 6_000, true, 'Aldric']]);
  // a piece set down in the hall is counted as placed
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, region, price, paid, bought_at, guild_id, owner_name) VALUES (1, 'b1', ?, ?, 0, 100, 100, 1, ?, 'The Iron Oath')").run(s.gm.id, s.gm.character, s.gid);
  s.raw.prepare("INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (1, 'b1', 'p1', 864300, '{\"pos\":[0,0,0],\"rot\":[0,0,0],\"scale\":1,\"light\":null,\"storage\":false,\"paid\":0}', 1, 0, 0)").run();
  const shop = await s.call('/v1/guilds/shop', { character: s.gm.character }, s.gm.secret);
  assert.equal(shop.body.shop.wares.find((w) => w.key === 'banker').placed, 1);
});

test('GUILD-SHOP every guild\'s arms by its tag, for any session - its heraldry and its approved logo; a tag no guild bears is none (mutants: the logo\'s state unread; the tag\'s shape)', async () => {
  const s = await stand();
  s.raw.prepare('UPDATE guilds SET heraldry = ? WHERE id = ?').run(JSON.stringify({ field: 'azure', border: 'gold', device: 'owl' }), s.gid);
  const guest = (await s.call('/v1/auth/guest', { accepted: undefined, ...(await import('../../src/net/legalLaw.js')).ACCEPTED })).body;
  const r = await s.call('/v1/guilds/arms', { tags: ['IRON', 'NONE', 'bad tag', 7] }, guest.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.arms, { IRON: { name: 'The Iron Oath', heraldry: { field: 'azure', border: 'gold', device: 'owl' }, logo: null } });
  const id = 'cd'.repeat(16);
  s.raw.prepare(`INSERT INTO guild_logos (id, guild_id, state, obj, src, type, bytes, side, fee, by_player, by_name, rid, at) VALUES (?, ?, 'pending', 'o', 's', 'image/png', 10, 128, 0, 'p', 'A', 'r1', 1)`).run(id, s.gid);
  s.raw.prepare('UPDATE guilds SET logo = ? WHERE id = ?').run(id, s.gid);
  assert.equal((await s.call('/v1/guilds/arms', { tags: ['IRON'] }, guest.secret)).body.arms.IRON.logo, null, 'a logo not approved is worn by nobody');
  s.raw.prepare("UPDATE guild_logos SET state = 'approved' WHERE id = ?").run(id);
  assert.equal((await s.call('/v1/guilds/arms', { tags: ['IRON'] }, guest.secret)).body.arms.IRON.logo, id);
});

// ─── THE LOGO ───────────────────────────────────────────────────────

test('GUILD-LOGO a review: the guildmaster sends a square picture, its fee held from the treasury in the row\'s batch; one at a time; the picture served while under review, never kept; the minute posts its card with the picture and two buttons; a moderator\'s Approve wears it, burns the fee and writes the guildmaster a letter; a second press decides nothing (mutants: the fee unheld; the pending index; the card\'s buttons; the approval\'s guard)', async () => {
  const s = await stand();
  const send = (image, rid, who = s.gm) => s.call('/v1/guilds/logo', { character: who.character, image, rid }, who.secret);
  assert.deepEqual((await send(png(128), 'logo-rid-m', s.member)).body, { error: 'guild-rank' });
  assert.deepEqual((await send(png(128, 100), 'logo-rid-1')).body, { error: 'logo-square' });
  assert.deepEqual((await send(png(32), 'logo-rid-2')).body, { error: 'logo-side' });
  assert.deepEqual((await send('not base64!', 'logo-rid-3')).body, { error: 'logo-bytes' });
  assert.deepEqual((await send(png(128), 'logo-rid-4')).body, { error: 'guild-marks-short' }, 'the fee is the treasury\'s');
  s.guildSilver(GUILD_LOGO_FEE + 100);
  const r = await send(png(128), 'logo-rid-5');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.logo;
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(s.silverOf(), 100, 'the fee held');
  const esc = s.raw.prepare("SELECT src_kind, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = 'logo-escrow'").get();
  assert.deepEqual({ ...esc }, { src_kind: 'guild', dst_kind: 'escrow', dst_id: `logo:${id}`, amount: GUILD_LOGO_FEE });
  assert.deepEqual([(await send(png(128), 'logo-rid-5')).body.repeat, s.silverOf()], [true, 100], 'asked again: the review it opened');
  s.guildSilver(GUILD_LOGO_FEE * 3);
  assert.deepEqual((await send(png(128), 'logo-rid-6')).body, { error: 'logo-pending' }, 'one review at a time');
  const view = await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret);
  assert.deepEqual([view.body.guild.logo, view.body.guild.logoReview], [null, { at: _now }]);
  const pic = await s.get(`/v1/guilds/logo/${id}`);
  assert.deepEqual([pic.status, pic.headers.get('content-type'), pic.headers.get('cache-control'), pic.bytes.byteLength], [200, 'image/png', 'no-store', 97]);
  assert.equal((await s.get(`/v1/guilds/logo/${'0'.repeat(32)}`)).status, 404);
  // the minute posts the card
  const sent = [];
  const fetchFn = async (url, init) => { sent.push({ url, init: { ...init, body: JSON.parse(init.body) } }); return new Response(JSON.stringify({ id: '424242424242424242' }), { status: 200 }); };
  await safetyMinute(s.ctx(), s.env, { fetchFn });
  assert.equal(sent.length, 1);
  const card = sent[0].init.body;
  assert.equal(sent[0].init.method, 'POST');
  assert.match(card.embeds[0].title, /The Iron Oath <IRON>/);
  assert.equal(card.embeds[0].image.url, `https://accounts.invalid/v1/guilds/logo/${id}`, 'the picture, at the service\'s own address');
  assert.deepEqual(card.components[0].components.map((b) => [b.label, b.custom_id]), [['Approve', `glogo:ok:${id}`], ['Turn down', `glogo:no:${id}`]]);
  assert.equal(s.raw.prepare('SELECT discord_state FROM guild_logos WHERE id = ?').get(id).discord_state, 'posted');
  // a stranger's press is no moderator's
  const press = (user, act) => discordInteraction(s.ctx(), s.env, { type: 3, member: { user: { id: user } }, data: { custom_id: `glogo:${act}:${id}` } });
  assert.match((await press('222222222222222222', 'ok')).data.content, /Only the game's moderators/);
  const ok = await press(MOD_ID, 'ok');
  assert.equal(ok.type, 7, 'the card redrawn in place');
  // PIN MOVED (AUDIT GUILD-SHOP D2): decided, a worn logo's card keeps one button - Take down
  assert.deepEqual(ok.data.components.flatMap((r) => r.components.map((b) => b.custom_id)), [`glogo:off:${id}`]);
  assert.match(ok.data.embeds[0].description, /^Approved by Mac /, 'who decided, on the card');
  assert.deepEqual([s.raw.prepare('SELECT logo FROM guilds WHERE id = ?').get(s.gid).logo, s.raw.prepare('SELECT state FROM guild_logos WHERE id = ?').get(id).state], [id, 'approved']);
  assert.equal(s.raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'logo-fee'").get().amount, GUILD_LOGO_FEE, 'the fee burnt out of its escrow');
  assert.equal(s.raw.prepare("SELECT subject FROM server_post WHERE to_id = ?").get(s.gm.id).subject, 'Your guild\'s logo is approved');
  await press(MOD_ID, 'no');
  assert.equal(s.raw.prepare('SELECT state FROM guild_logos WHERE id = ?').get(id).state, 'approved', 'a second press decides nothing');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind IN ('logo-fee', 'logo-return')").get().n, 1);
  assert.equal((await s.get(`/v1/guilds/logo/${id}`)).headers.get('cache-control'), 'public, max-age=86400', 'approved: kept a day');
  assert.equal((await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild.logo, id);
  // taken down: the guild's own device again, the picture served no more
  assert.deepEqual((await s.call('/v1/guilds/logo/clear', { character: s.member.character }, s.member.secret)).body, { error: 'guild-rank' });
  assert.deepEqual((await s.call('/v1/guilds/logo/clear', { character: s.gm.character }, s.gm.secret)).body, { ok: true, cleared: id });
  assert.equal((await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild.logo, null);
  assert.equal((await s.get(`/v1/guilds/logo/${id}`)).status, 404);
  // AUDIT GUILD-SHOP D2: a moderator's take-down reads as such on its card (a guildmaster's clear does not)
  const row = s.raw.prepare('SELECT * FROM guild_logos WHERE id = ?').get(id);
  assert.match(logoCard({ ...row, decided_by: 'Mac (Discord)' }, { name: 'X', tag: 'XX' }).embeds[0].description, /^Taken down by Mac /);
  assert.match(logoCard(row, { name: 'X', tag: 'XX' }).embeds[0].description, /^Withdrawn by the guild/);
  assert.deepEqual((await s.call('/v1/guilds/logo/clear', { character: s.gm.character }, s.gm.secret)).body, { error: 'logo-none' });
});

test('GUILD-LOGO turned down or withdrawn: the fee home and the guild\'s arms unchanged; a review under way holds the guild from going (mutants: the return; the withdrawal\'s rank; the hold)', async () => {
  const s = await stand();
  s.guildSilver(GUILD_LOGO_FEE);
  const first = await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(96), rid: 'logo-deny-1' }, s.gm.secret);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(s.silverOf(), 0);
  const deny = await discordInteraction(s.ctx(), s.env, { type: 3, member: { user: { id: MOD_ID } }, data: { custom_id: `glogo:no:${first.body.logo}` } });
  assert.match(deny.data.embeds[0].description, /^Turned down/);
  assert.deepEqual([s.silverOf(), s.raw.prepare('SELECT logo FROM guilds WHERE id = ?').get(s.gid).logo], [GUILD_LOGO_FEE, null], 'the fee home, nothing worn');
  assert.equal((await s.get(`/v1/guilds/logo/${first.body.logo}`)).status, 404, 'a picture turned down is served to nobody');
  // AUDIT GUILD-SHOP S3: one a quarter hour - a withdrawn and sent again review is a card each for the moderators
  const soon = await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(128), rid: 'logo-deny-2' }, s.gm.secret);
  assert.deepEqual([soon.status, soon.body.error, soon.body.at], [429, 'logo-soon', _now + GUILD_LOGO_GAP_S]);
  _now += GUILD_LOGO_GAP_S;
  const second = await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(128), rid: 'logo-deny-2' }, s.gm.secret);
  assert.equal(second.status, 200);
  assert.equal(s.raw.prepare('SELECT discord_state FROM guild_logos WHERE id = ?').get(second.body.logo).discord_state, 'due');
  const disband = await s.call('/v1/guilds/disband', { character: s.gm.character }, s.gm.secret);
  assert.ok(disband.body.keeps.includes('guild-logo'), JSON.stringify(disband.body));
  assert.deepEqual((await s.call('/v1/guilds/logo/withdraw', { character: s.member.character }, s.member.secret)).body, { error: 'guild-rank' });
  const w = await s.call('/v1/guilds/logo/withdraw', { character: s.gm.character }, s.gm.secret);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(s.silverOf(), GUILD_LOGO_FEE, 'withdrawn: the fee home');
  assert.deepEqual((await s.call('/v1/guilds/logo/withdraw', { character: s.gm.character }, s.gm.secret)).body, { error: 'logo-none' });
  // AUDIT GUILD-SHOP S3, S10: a card never posted is not posted for its ending; a picture nobody may wear is kept no more
  assert.equal(s.raw.prepare('SELECT discord_state FROM guild_logos WHERE id = ?').get(second.body.logo).discord_state, 'off');
  const objOf = (id) => s.raw.prepare('SELECT obj FROM guild_logos WHERE id = ?').get(id).obj;
  assert.deepEqual([s.env.SAVES._map.has(objOf(first.body.logo)), s.env.SAVES._map.has(objOf(second.body.logo))], [false, false]);
  // AUDIT GUILD-SHOP S8: a leave or disband held by a review under way is a conflict, as every hold
  _now += GUILD_LOGO_GAP_S;
  await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(128), rid: 'logo-deny-3' }, s.gm.secret);
  assert.equal((await s.call('/v1/guilds/disband', { character: s.gm.character }, s.gm.secret)).status, 409);
});

test('AUDIT GUILD-SHOP a logo replaced is served no more, nor one taken down, and its picture goes; a sending whose answer was lost is the review it opened, its picture kept; a review sent while Discord was off goes up once it is on (mutants: the old approval kept; the lost answer\'s picture dropped; the off row never posted)', async () => {
  const s = await stand();
  s.guildSilver(GUILD_LOGO_FEE * 4);
  const press = (id) => discordInteraction(s.ctx(), s.env, { type: 3, member: { user: { id: MOD_ID } }, data: { custom_id: `glogo:ok:${id}` } });
  const a = (await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(128), rid: 'logo-rep-1' }, s.gm.secret)).body.logo;
  await press(a);
  _now += GUILD_LOGO_GAP_S;
  // the answer lost: the batch landed, then the call threw
  const batch = s.env.DB.batch.bind(s.env.DB);
  s.env.DB.batch = async (...x) => { s.env.DB.batch = batch; await batch(...x); throw new Error('the answer lost'); };
  const lost = await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(128), rid: 'logo-rep-2' }, s.gm.secret);
  assert.equal(lost.status, 200, JSON.stringify(lost.body));
  const b = lost.body.logo;
  assert.equal((await s.get(`/v1/guilds/logo/${b}`)).status, 200, 'its picture kept');
  await press(b);
  assert.equal(s.raw.prepare('SELECT logo FROM guilds WHERE id = ?').get(s.gid).logo, b);
  assert.deepEqual([(await s.get(`/v1/guilds/logo/${a}`)).status, s.raw.prepare('SELECT state FROM guild_logos WHERE id = ?').get(a).state], [404, 'withdrawn'], 'the logo before it retired');
  assert.equal(s.env.SAVES._map.has(s.raw.prepare('SELECT obj FROM guild_logos WHERE id = ?').get(a).obj), false);
  await s.call('/v1/guilds/logo/clear', { character: s.gm.character }, s.gm.secret);
  assert.equal((await s.get(`/v1/guilds/logo/${b}`)).status, 404);
  // a review sent while Discord was off
  _now += GUILD_LOGO_GAP_S;
  s.raw.prepare("UPDATE guild_logos SET discord_state = 'posted'").run();
  const c = (await s.call('/v1/guilds/logo', { character: s.gm.character, image: png(128), rid: 'logo-rep-3' }, s.gm.secret)).body.logo;
  s.raw.prepare("UPDATE guild_logos SET discord_state = 'off' WHERE id = ?").run(c);
  const sent = [];
  await safetyMinute(s.ctx(), s.env, { fetchFn: async (url, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: '434343434343434343' }), { status: 200 }); } });
  assert.equal(sent.length, 1, 'the card goes up');
  assert.equal(s.raw.prepare('SELECT discord_state FROM guild_logos WHERE id = ?').get(c).discord_state, 'posted');
});

test('AUDIT GUILD-SHOP an Admin holds every account ware and is sold none; a character in no guild reads its account\'s wares alone (mutants: the Admin charged; the guildless read refused)', async () => {
  const s = await stand();
  const view = await s.call('/v1/guilds/shop', { character: s.mod.character ?? 'char-mac00001' }, s.mod.secret);
  assert.equal(view.status, 200, JSON.stringify(view.body));
  assert.deepEqual(view.body.shop.wares.map((w) => [w.key, w.held]), [['insigniaarmlet', true], ['guildcrest', true], ['guildsails', true]]);
  assert.equal(view.body.shop.member, false);
  const plain = await s.registered('Cora');
  const mine = await s.call('/v1/guilds/shop', { character: 'char-cora0001' }, plain.secret);
  assert.deepEqual(mine.body.shop.wares.map((w) => w.held), [false, false, false]);
  // an Admin in a guild is sold none
  await s.call('/v1/guilds/invite', { character: s.gm.character, handle: 'Mac' }, s.gm.secret);
  await s.call('/v1/guilds/answer', { character: 'char-mac00001', guild: s.gid, accept: true }, s.mod.secret);
  const buy = await s.call('/v1/guilds/shop/buy', { character: 'char-mac00001', ware: 'insigniaarmlet', rid: 'admin-buy-0001' }, s.mod.secret);
  assert.equal(buy.body.error, 'guild-ware-held');
});
