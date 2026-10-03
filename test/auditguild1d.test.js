// AUDIT GUILD1d (2026-09-30, Mac: "let's do an audit on this"): three lanes read GUILD1d adversarially - the service's
// money, state and races; who can reach a hall and what a visit does; the client's book, the Guild tab, the drawing and
// the banner pass. Every finding was checked against the code before it was fixed, and each fix is pinned here (the
// service's through the real Worker over node:sqlite, a race by landing the other request between a read and its
// write). `06-Systems/Online-Arc.md` GUILD1d, THE AUDIT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { guildHallPrice } from '../src/net/hallLaw.js';
import { GUILD_TREASURY_MAX, GUILD_RANK_NAMES } from '../src/net/guildLaw.js';
import { homeSaleRefund } from '../src/net/homeLaw.js';
import { HERALDRY_CHANGE_DRAKES } from '../src/net/heraldryLaw.js';
import { hallBannerAnchors } from '../src/scenes/hallBanners.js';
import { BannerRenderer, BANNER_TEXTURE_IDLE_S, BANNER_VS, BANNER_FS } from '../src/render/bannerPass.js';
import { createOnlineHomes, hallOfferLabel, HALL_DROP_TEXT, HALL_VISITOR_MAGIC_TEXT, HALL_CHEST_TITLE } from '../src/systems/onlineHomes.js';
import { GuildBook } from '../src/net/guildBook.js';
import { homeBedIsMine } from '../src/systems/homeRent.js';
import { createSocialPanel, GUILD_MARKS_LEDGER_WORDS, guildHallSoldText } from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';
import { REFUSALS } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HALL = { mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: null };   // AUDIT PRE-MERGE 1003 WD1: a hall says its town's layout (none: an old build's, 426)
const piece = (over = {}) => ({ id: 'bench1', model: 41000, flat: null, pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });
const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };

/** A guild of Gwen's, `gold` of realm gold in its treasury; Otto an Officer, both realm characters. */
async function stood({ gold = 60_000, marks = false, hall = true } = {}) {
  const svc = await standService(marks ? { MARKS_OPEN: 'on' } : {});
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
  const officer = await svc.registered('Otto');
  const R = await seatRealm(svc.env, officer.secret, 'Otto', { name: 'Otto', level: 5, goldPieces: 50_000, items: [] });
  officer.character = R.id; officer.at = R.at;
  await svc.call('/v1/guilds/invite', { character: gm.character, handle: 'Otto' }, gm.secret);
  const inv = await svc.call('/v1/guilds/invites', {}, officer.secret);
  await svc.call('/v1/guilds/answer', { character: officer.character, guild: inv.body.invites[0].guild, accept: true }, officer.secret);
  const view = async (who = gm) => (await svc.call('/v1/guilds/mine', { character: who.character }, who.secret)).body.guild;
  const otto = (await view()).members.find((m) => m.name === 'Otto');
  await svc.call('/v1/guilds/rank', { character: gm.character, member: otto.member, rank: 1 }, gm.secret);
  if (hall) assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  return { svc, gm, officer, view, raw: svc.env.DB._raw, gid: (await view()).id };
}
/** THE OTHER REQUEST, LANDED BETWEEN A READ AND ITS WRITE: `fn` runs once, just before the first batch the service sends. */
function beforeNextBatch(env, fn) {
  const orig = env.DB.batch.bind(env.DB);
  let fired = false;
  env.DB.batch = async (list) => { if (!fired) { fired = true; fn(); } return orig(list); };
}
/** ...or a whole other REQUEST, awaited there: it reads, writes and answers before this one's batch goes. */
function requestBeforeNextBatch(env, call) {
  const orig = env.DB.batch.bind(env.DB);
  let fired = false, answer = null;
  env.DB.batch = async (list) => { if (!fired) { fired = true; answer = await call(); } return orig(list); };
  return () => answer;
}
/** ...or just before the first statement whose SQL carries `needle` runs (`after`: just after it has). */
function aroundStatement(env, needle, fn, { after = false } = {}) {
  const orig = env.DB.prepare.bind(env.DB);
  let fired = false;
  env.DB.prepare = (sql) => {
    const st = orig(sql);
    if (fired || !sql.includes(needle)) return st;
    for (const m of ['first', 'run', 'all']) {
      const f = st[m];
      st[m] = async (...a) => {
        if (fired) return f(...a);
        fired = true;
        if (!after) fn();
        const r = await f(...a);
        if (after) fn();
        return r;
      };
    }
    return st;
  };
}

test('AUDIT GUILD1d S1: a lone guildmaster deleting its realm character sells the hall first (`guild-hall`) - deleted, the guild stood memberless with the hall, never reclaimed: the building, the name and the deed share gone for good (mutants: the hall unasked)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, raw } = await stood();
  raw.prepare('DELETE FROM guild_members WHERE rank <> 0').run();
  raw.prepare("UPDATE guilds SET treasury = 0, realm_gold = 0, moved_by = 'x', moved_at = 1").run();
  const del = await svc.call('/v1/realm/delete', { id: gm.character }, gm.secret);
  assert.deepEqual([del.status, del.body.error], [409, 'guild-hall']);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_members').get().n, 1, 'the guildmaster stays');
  assert.equal(typeof REFUSALS['guild-hall'], 'string', 'and is told so');
});

test('AUDIT GUILD1d S2: a hall\'s keeper is a REALM character - an Officer seated under a made-up id moved a piece into a 200,000-gold station on its client\'s word; the realm Officer\'s own moves still land (mutants: the realm clause dropped)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, view, raw } = await stood();
  assert.equal((await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: officer.character, piece: piece(), realm: officer.at() }, officer.secret)).status, 200);
  // the guildmaster seats a made-up character of their own account and makes it an Officer
  await svc.call('/v1/guilds/invite', { character: gm.character, handle: 'Gwen' }, gm.secret);
  const inv = await svc.call('/v1/guilds/invites', {}, gm.secret);
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 1, ?, ?)').run(gm.id, 'alt-made-up', inv.body.invites[0].guild, 'Gwen', T0);
  const station = { pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, station: 'enchant' };
  const lie = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: 'alt-made-up', id: 'bench1', place: station }, gm.secret);
  assert.equal(lie.body.error, 'no-decor', 'no keeper on a client\'s word');
  assert.equal(raw.prepare("SELECT json_extract(place, '$.station') AS s FROM home_decor").get().s, null);
  const shrink = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: officer.character, id: 'bench1', realm: officer.at(), place: { ...station, station: undefined, paid: 60 } }, officer.secret);
  assert.equal(shrink.status, 200, JSON.stringify(shrink.body));
  void view;
});

test('AUDIT GUILD1d S3: the hall\'s rule is inside the placement\'s write - a hall bought between the rule\'s read and the INSERT takes no keeper\'s own thing and no yard piece, and says why (mutants: the INSERT\'s hall clause; its word)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, raw, gid } = await stood({ hall: false });
  const buyNow = () => raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, guild_id)
    VALUES (7, 300, ?, ?, 'The Silver Hand', 17, 'guild', 20000, ?, 30000, ?)`).run(gm.id, `guild:${gid}`, T0, gid);
  aroundStatement(svc.env, 'SELECT guild_id FROM homes WHERE map_id = ? AND building_key = ?', buyNow, { after: true });
  const own = await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: gm.character, piece: piece({ id: 'own1', model: null, flat: [204, 1], paid: 0, item: { t: 1 } }), realm: gm.at() }, gm.secret);
  assert.equal(own.body.error, 'hall-item');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0);
});

test('AUDIT GUILD1d S4/S5: the same heraldry change and the same hall claim, each raced by itself, answer as made and charge once - the loser read `heraldry-drakes` and `home-taken` (mutants: the raced answer)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, raw } = await stood({ marks: true, hall: false });
  const buy = () => svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret);
  // the second claim lands whole between the first's reads and its batch: the first's INSERT meets the row
  let other = requestBeforeNextBatch(svc.env, buy);
  const a = await buy(), b = other();
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  assert.deepEqual([a.body.repeat, b.body.repeat], [true, undefined], 'the claim that landed, and the loser answered as it');
  assert.equal(a.body.hall?.buildingKey, HALL.buildingKey, 'with the hall it names');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM guild_ledger WHERE kind = 'hall'").get().n, 1, 'charged once');
  assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: WOLF }, gm.secret)).status, 200);
  svc.seedMarks(gm, 2000);
  await svc.call('/v1/marks/guild/deposit', { character: gm.character, marks: 800, rid: 'deposit-01' }, gm.secret);
  const change = () => svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: { ...WOLF, device: 'bear' }, rid: 'herald-race' }, gm.secret);
  other = requestBeforeNextBatch(svc.env, change);
  const c = await change(), d = other();
  assert.deepEqual([c.status, d.status], [200, 200], JSON.stringify([c.body, d.body]));
  assert.deepEqual([c.body.repeat, d.body.repeat], [true, undefined], 'the change that landed, and the loser answered as it');
  assert.equal(c.body.heraldry?.device, 'bear');
  assert.equal(raw.prepare('SELECT balance FROM guild_marks').get().balance, 800 - HERALDRY_CHANGE_DRAKES, 'burnt once');
});

test('AUDIT GUILD1d S6/S7: the rooms\' read calls a hall no account\'s; who may walk in and the heraldry ask the rank in their own writes - an Officer demoted, a guildmaster handed on, between the read and the write, change nothing (mutants: the rooms\' guard; each write\'s rank)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, raw } = await stood();
  const rooms = await svc.call('/v1/homes/rooms', { mapId: 7, buildingKey: 300, character: gm.character }, gm.secret);
  assert.equal(rooms.body.mine, false, 'the buying account is no owner');
  assert.equal(rooms.body.due, undefined);
  aroundStatement(svc.env, 'UPDATE homes SET entry', () => raw.prepare('UPDATE guild_members SET rank = 2 WHERE rank = 1').run());
  const e = await svc.call('/v1/guilds/hall/entry', { character: officer.character, entry: 'public' }, officer.secret);
  assert.equal(e.body.error, 'guild-rank');
  assert.equal(raw.prepare('SELECT entry FROM homes').get().entry, 'guild', 'nothing turned');
  aroundStatement(svc.env, 'UPDATE guilds SET heraldry', () => raw.prepare('UPDATE guild_members SET rank = 1 WHERE rank = 0').run());
  const h = await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: WOLF }, gm.secret);
  assert.equal(h.body.error, 'guild-rank');
  assert.equal(raw.prepare('SELECT heraldry FROM guilds').get().heraldry, null);
});

test('AUDIT GUILD1d S7: the rank is still ASKED FIRST, so a member is told the rank - never "no hall" or "too few Drakes", a guard it could not pass anyway (mutants: GUILD1d\'s own rank reads, which the writes\' guards made silent)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, raw } = await stood({ marks: true, hall: false });
  raw.prepare('UPDATE guild_members SET rank = 2 WHERE rank = 1').run();
  const e = await svc.call('/v1/guilds/hall/entry', { character: officer.character, entry: 'public' }, officer.secret);
  assert.equal(e.body.error, 'guild-rank', 'no hall, and a member: the rank is the answer');
  assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: WOLF }, gm.secret)).status, 200);
  const h = await svc.call('/v1/guilds/heraldry', { character: officer.character, heraldry: { ...WOLF, device: 'bear' }, rid: 'member-asks-1' }, officer.secret);
  assert.equal(h.body.error, 'guild-rank', 'no Drakes, and a member: the rank is the answer');
});

test('AUDIT GUILD1d S9: the guards no pin held - the buy takes realm_gold with the treasury; the sale holds the pieces, what the treasury paid and the rank as they were read; a piece\'s half and a sale stop at the treasury\'s cap and take nothing; a piece\'s half is realm gold; the next plain move is no hall\'s line; the heraldry changes only from what was read (mutants: each of those clauses)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  {
    const { raw, view } = await stood();
    const g = raw.prepare('SELECT treasury, realm_gold FROM guilds').get();
    assert.deepEqual({ ...g }, { treasury: 60_000 - guildHallPrice(20_000), realm_gold: 60_000 - guildHallPrice(20_000) }, 'realm_gold with the treasury');
    void view;
  }
  // the sale, raced: a piece taken out, what the treasury paid moved, the guildmaster demoted
  for (const race of ['DELETE FROM home_decor', 'UPDATE homes SET paid = paid + 1', 'UPDATE guild_members SET rank = 1 WHERE rank = 0']) {
    const { svc, gm, raw } = await stood();
    assert.equal((await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: gm.character, piece: piece(), realm: gm.at() }, gm.secret)).status, 200);
    const before = raw.prepare('SELECT treasury FROM guilds').get().treasury;
    beforeNextBatch(svc.env, () => raw.prepare(race).run());
    const sold = await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret);
    assert.equal(sold.body.error, 'guild-hall-moved', race);
    assert.equal(raw.prepare('SELECT treasury FROM guilds').get().treasury, before, `${race}: nothing paid`);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes').get().n, 1, `${race}: the hall stands`);
  }
  // the buy, raced: the guildmaster demoted
  {
    const { svc, gm, raw } = await stood({ hall: false });
    beforeNextBatch(svc.env, () => raw.prepare('UPDATE guild_members SET rank = 1 WHERE rank = 0').run());
    assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).body.error, 'guild-rank');
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes').get().n, 0);
  }
  // the cap: a piece's half and the sale into a treasury that cannot hold them
  {
    const { svc, gm, raw, view } = await stood();
    assert.equal((await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: gm.character, piece: piece(), realm: gm.at() }, gm.secret)).status, 200);
    const realmBefore = raw.prepare('SELECT realm_gold FROM guilds').get().realm_gold;
    raw.prepare("UPDATE guilds SET treasury = ?, moved_by = 'x', moved_at = 1").run(GUILD_TREASURY_MAX - 10);
    const gone = await svc.call('/v1/homes/decor/remove', { mapId: 7, buildingKey: 300, character: gm.character, id: 'bench1', realm: gm.at() }, gm.secret);
    assert.deepEqual([gone.status, gone.body.error], [409, 'guild-treasury-full']);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 1, 'the piece stays');
    assert.equal((await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret)).body.error, 'guild-treasury-full');
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes').get().n, 1, 'the hall stands');
    raw.prepare("UPDATE guilds SET treasury = 1000, moved_by = 'x', moved_at = 1").run();
    assert.equal((await svc.call('/v1/homes/decor/remove', { mapId: 7, buildingKey: 300, character: gm.character, id: 'bench1', realm: gm.at() }, gm.secret)).status, 200);
    assert.equal(raw.prepare('SELECT realm_gold FROM guilds').get().realm_gold, realmBefore + 60, 'the half is realm gold');
    assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 5, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
    assert.deepEqual((await view()).ledger.slice(0, 2).map((l) => l.kind), ['deposit', 'hall-piece'], 'the next plain move is a deposit');
    void homeSaleRefund;
  }
  // the heraldry, raced: changed by another between the read and the write
  {
    const { svc, gm, raw } = await stood({ marks: true, hall: false });
    aroundStatement(svc.env, 'UPDATE guilds SET heraldry', () => raw.prepare(`UPDATE guilds SET heraldry = '{"field":"vert","border":"gold","device":"stag"}'`).run());
    assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: WOLF }, gm.secret)).body.error, 'heraldry-moved', 'the first, raced');
    svc.seedMarks(gm, 2000);
    await svc.call('/v1/marks/guild/deposit', { character: gm.character, marks: 800, rid: 'deposit-01' }, gm.secret);
    beforeNextBatch(svc.env, () => raw.prepare(`UPDATE guilds SET heraldry = '{"field":"vert","border":"gold","device":"boar"}'`).run());
    assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: WOLF, rid: 'herald-00' }, gm.secret)).body.error, 'heraldry-moved');
    assert.equal(raw.prepare('SELECT balance FROM guild_marks').get().balance, 800, 'nothing burnt');
  }
});

test('AUDIT GUILD1d S8 + R5: the restore reads a hall as its guild\'s, never a home bought again; the guild\'s Drakes ledger calls a heraldry changed a heraldry, never a deposit, and the tab says so (mutants: the restore\'s guard; the kind; the words)', async (t) => {
  assert.match(src('tools/realmRestore.mjs'), /if \(nowHome && \(nowHome\.player !== player \|\| String\(nowHome\.char_id\)\.startsWith\('guild:'\)\)\) \{/);
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, view } = await stood({ marks: true, hall: false });
  await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: WOLF }, gm.secret);
  svc.seedMarks(gm, 2000);
  await svc.call('/v1/marks/guild/deposit', { character: gm.character, marks: 800, rid: 'deposit-01' }, gm.secret);
  await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: { ...WOLF, device: 'bear' }, rid: 'herald-01' }, gm.secret);
  assert.deepEqual((await view()).marksLedger.map((l) => l.kind), ['heraldry', 'deposit']);
  assert.equal(GUILD_MARKS_LEDGER_WORDS.heraldry, 'changed the heraldry for');
  assert.match(src('src/ui/socialPanel.js'), /GUILD_MARKS_LEDGER_WORDS\[l\.kind\] \?\? GUILD_MARKS_LEDGER_WORDS\.deposit/);
});

test('AUDIT GUILD1d A1-A9: members rest (the online bed its own permanence), use the forge, workbench and loom, see their chest and cast in their hall; a visitor\'s drop and spell in a hall\'s own words; the plaque-less offer carries the hall; one buy out a house; the doors read again when the guild is known; the decorator neither pays a hall\'s half to the purse nor says it does (mutants: each by source; the offer\'s label; the bump)', () => {
  const wm = src('src/scenes/worldModes.js');
  // PIN MOVED (the merge of main's RENT-REST, FIELD BUGS 2026-10-01): A1's online bed is RENT-REST's one rule now - the
  // home's bed (homeRent.js homeBedIsMine) rides the rest's bag as `homeBed`, its own permanence and its own ownership
  // (restSession.js interiorRestPlace) - and a hall's member is one of its sleepers
  assert.deepEqual([homeBedIsMine({ hall: { name: 'H' }, member: true }, 0), homeBedIsMine({ hall: { name: 'H' }, member: false }, 0), homeBedIsMine({ own: false }, 0)], [true, false, false], 'A1');
  assert.match(wm, /homeBed: homeBedIsMine\(interiorHome, Math\.floor\(Date\.now\(\) \/ 1000\)\) \|\| !!interiorSeatHall\?\.member,/, 'A1: the host hands it');   // PIN MOVED (SEAT-HALL): and the palace holder's members rest there
  for (const s of ['forge', 'workbench', 'loom']) assert.match(wm, new RegExp(`if \\(hallMemberHere\\(\\) && interiorDecor\\.list\\(\\)\\.some\\(\\(p\\) => p\\?\\.station === '${s}'\\)\\) return \\{ kind: 'home', fee: 0 \\};`), `A2 ${s}`);
  assert.match(wm, /if \(t && hallMemberHere\(\)\) return \{ title: HALL_CHEST_TITLE \};/, 'A6');
  assert.equal(HALL_CHEST_TITLE, "The Guild's Chest");
  assert.match(wm, /\(interiorHome\.hall \? HALL_DROP_TEXT : HOME_VISITOR_DROP_TEXT\)/, 'A7 the drop');
  assert.match(wm, /const visitorMagicRefusal = \(\) => \(visitorDropRefusal\(\) && !hallMemberHere\(\) \? \(interiorHome\?\.hall \? HALL_VISITOR_MAGIC_TEXT : HOME_VISITOR_MAGIC_TEXT\) : null\);/, 'A7 the spell');
  assert.ok(HALL_DROP_TEXT && HALL_VISITOR_MAGIC_TEXT);
  assert.match(wm, /\.\.\.\(homeHallBuyRow\(price, hallGuild\(\)\) \? \[\{ code: 'KeyG', label: hallOfferLabel\(price, hallGuild\(\)\), action: \(\) => \{ buyHallAt\(bd, price\); \} \}\] : \[\]\),/, 'A3');
  assert.equal(hallOfferLabel(20_000, { name: 'The Hand' }), 'G - buy it for The Hand: 30000 gold from the treasury');
  assert.match(wm, /if \(_hallBuying\.has\(id\)\) return;\n\s*_hallBuying\.add\(id\);/, 'A8');
  assert.match(wm, /\.finally\(\(\) => \{ _hallBuying\.delete\(id\); \}\);/);
  const w = src('src/scenes/world.js');
  assert.match(w, /onRank: \(\) => \{ onlineHomes\?\.bump\?\.\(\); /, 'A5');   // PIN MOVED (AUDIT PROF-541 G1): the guild book's onRank, told at every look
  const homes = createOnlineHomes({ api: { town: async () => ({ ok: true, data: { homes: [] } }) } });
  const v0 = homes.version();
  homes.bump();
  assert.equal(homes.version(), v0 + 1);
  const dt = src('src/scenes/decorTool.js');
  assert.match(dt, /back = r\.hall \? 0 : decorRefund\(paid\);/, 'A4 the removal');
  assert.match(dt, /if \(price\.refund > 0 && !r\.hall\) deps\.wallet\(\)\.credit\?\.\(price\.refund\);/, 'A4 the shrink');
  assert.match(dt, /hall: !!r\?\.hall,/);
  assert.match(src('src/ui/decorPanel.js'), /back\$\{view\?\.hall \? " to the guild's treasury" : ''\}/, 'A9');
});

test('AUDIT GUILD1d R1-R4, R6-R9: the banners sway on the wind\'s own 0..1, out along their face alone, drawn before every glow; their width runs from their face whatever the door\'s vertex order; a failed picture still marks the seam and is asked again; an idle texture is given back; premultiplied, and lit by the moon (mutants: the slider; the two-way swing; the order; the width off the record; the true; the null kept; the prune; the premultiply; the moon)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /wind: Math\.min\(1, wd\.strength01 \* wd\.gust\),/, 'R1');
  assert.ok(w.indexOf('const hung = bannersHung();') < w.indexOf('    drawVeiledPeerBodies();   // INVIS-LOOK'), 'R3: before the veiled bodies');
  assert.ok(w.indexOf('const hung = bannersHung();') < w.indexOf('duelWall.draw(rings'), 'R3: before the duel walls');
  const bannerDraw = w.slice(w.indexOf('const hung = bannersHung();'), w.indexOf('})) renderer.markForeignPass();', w.indexOf('const hung = bannersHung();')));
  assert.match(bannerDraw, /light: \{[^}]*moonDir: renderer\._moonDir, moonScale: renderer\._moonScale, moonCol: renderer\._moonColor \},/, 'R9: the banners\' own light carries the moon');
  assert.match(BANNER_VS, /float swing = 0\.5 \+ 0\.5 \* sin\(/, 'R2');
  assert.match(BANNER_VS, /float ripple = 0\.5 \+ 0\.5 \* sin\(/);
  assert.match(BANNER_FS, /t\.rgb \/= t\.a;/, 'R8');
  assert.match(BANNER_FS, /uMoonCol \* uMoonScale/, 'R9');
  // R4: the reversed vertex order hangs the same cloth, the same way round
  const box = [0, 0, 0, 10, 6, 10];
  const fwd = hallBannerAnchors({ box, door: { a: [4, 0, 0], b: [6, 2.5, 0] } });
  const rev = hallBannerAnchors({ box, door: { a: [6, 0, 0], b: [4, 2.5, 0] } });
  assert.deepEqual(rev.map((x) => x.right), fwd.map((x) => x.right));
  assert.deepEqual(fwd[0].right, [1, 0, 0]);
  assert.deepEqual(fwd[0].out, [0, 0, -1]);
  // R6/R7: a fake GL counting textures
  const made = [], gone = [], pix = [];
  const gl = new Proxy({}, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : () => ({})) });
  gl.getProgramParameter = () => true; gl.getShaderParameter = () => true;
  gl.createTexture = () => { const t = { n: made.length }; made.push(t); return t; };
  gl.deleteTexture = (t) => gone.push(t);
  gl.pixelStorei = (k, v) => pix.push([k, v]);
  let paints = 0, fail = true;
  const r = new BannerRenderer(/** @type {any} */ (gl), { paint: () => { paints++; return fail ? null : {}; } });
  const one = [{ key: 'k', heraldry: WOLF, top: [0, 0, 0], right: [1, 0, 0], out: [0, 0, 1] }];
  assert.equal(r.draw(one, new Float32Array(16), new Float32Array(16), [0, 0, 0], 1), true, 'R6: the program changed - the seam is marked');
  assert.equal(r.drawn, 0);
  r.draw(one, new Float32Array(16), new Float32Array(16), [0, 0, 0], 2);
  assert.equal(paints, 2, 'R7: a failed picture asked again');
  fail = false;
  r.draw(one, new Float32Array(16), new Float32Array(16), [0, 0, 0], 3);
  assert.equal(made.length, 1);
  assert.deepEqual(pix.filter((p) => p[0] === 'UNPACK_PREMULTIPLY_ALPHA_WEBGL'), [['UNPACK_PREMULTIPLY_ALPHA_WEBGL', true], ['UNPACK_PREMULTIPLY_ALPHA_WEBGL', false]], 'R8: premultiplied, and put back');
  r.draw([], new Float32Array(16), new Float32Array(16), [0, 0, 0], 3 + BANNER_TEXTURE_IDLE_S + 1);
  assert.deepEqual(gone, [made[0]], 'R7: idle, given back');
  assert.equal(r.textures.size, 0);
});

// ─── THE TAB AND THE BOOK ────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), src: '',
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
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
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const button = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label || b.children[0]?.textContent === label || String(b.textContent).startsWith(label));
const settle = () => new Promise((r) => setImmediate(r));
const guildView = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }], invites: [], ledger: [], hall: null, heraldry: WOLF, ...over,
});
function rig(first) {
  let guild = first;
  const calls = [];
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    heraldry: async (...a) => { calls.push(a); return { ok: false, error: 'offline' }; },
  };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }) });
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc: fakeDocument(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  return { panel, book, calls, set: (g) => { guild = g; } };
}

test('AUDIT GUILD1d R10-R14: a heraldry draft is one guild\'s; a select changes the picture and the button in place, never the select; with Drakes shut the reason says so; the sale says the service\'s own sum; an older answer never clears a newer choice\'s id (mutants: the draft\'s key; the repaint on change; the Drakes reason; the sale\'s words; the rid compared)', async () => {
  const r = rig(guildView({ marks: 900 }));
  r.panel.openGuild(); await settle(); await settle(); r.panel.render();
  const field = () => find(r.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'The field');
  const sel = field();
  sel.value = 'crimson'; sel.fire('change');
  assert.equal(field(), sel, 'R11: the same select - nothing repainted under the keyboard');
  const img = find(r.panel.root, 'dfsocial-banner')[0].children[0];
  assert.ok(img.src.includes(encodeURIComponent('#b3262e')), 'the picture is the draft');
  assert.equal(button(r.panel.root, 'Change it').disabled, false, 'a change the treasury can pay');
  // another guild's tab: the draft starts again from what stands there
  r.set(guildView({ id: 'g9999999999', name: 'The Other', heraldry: { field: 'vert', border: 'argent', device: 'tree' }, marks: 900 }));
  await r.book.refresh(); r.panel.render(); await settle(); r.panel.render();
  assert.ok(find(r.panel.root, 'dfsocial-banner')[0].children[0].src.includes(encodeURIComponent('#2f8f4e')), 'R10: the other guild\'s own banner');
  assert.equal(button(r.panel.root, 'Change it').disabled, true, 'R10: its own heraldry, nothing to change');
  // Drakes shut: the service's own word
  const shut = rig(guildView({ heraldry: WOLF }));
  shut.panel.openGuild(); await settle(); await settle(); shut.panel.render();
  const f2 = find(shut.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'The device');
  f2.value = 'bear'; f2.fire('change');
  assert.equal(button(shut.panel.root, 'Change it').attrs.title, REFUSALS['marks-closed'], 'R12');
  assert.equal(guildHallSoldText({ data: { back: 25_620 } }), 'The hall is sold. 25,620 gold went back into the treasury.', 'R13');
  assert.match(src('src/ui/socialPanel.js'), /run: \(\) => guildDo\(g\.sellHall\(\), guildHallSoldText\) \}\)/);
  void texts;
  // R14: the first choice's answer lands after a second choice was asked
  let hold;
  const door = { mine: async () => ({ ok: true, data: { guild: guildView() } }), invites: async () => ({ ok: true, data: { invites: [] } }), heraldry: (c, h, rid) => new Promise((res) => { if (!hold) hold = () => res({ ok: false, error: 'heraldry-same' }); else res({ ok: false, error: 'offline', rid }); }) };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }) });
  const first = book.setHeraldry({ ...WOLF, device: 'bear' });
  await settle();
  book._heraldryAsk = { key: 'newer', rid: 'newer-rid-01' };   // a newer choice asked meanwhile
  hold();
  await first;
  assert.deepEqual(book._heraldryAsk, { key: 'newer', rid: 'newer-rid-01' }, 'the newer choice keeps its id');
});
