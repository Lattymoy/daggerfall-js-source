// GUILD1e (2026-09-30, Mac: "Finish the seats"): A GUILD'S OWN BOARD, AS THE CLIENT HOLDS IT - the notice book's guild
// acts through the real Worker (test/accountDb.mjs), the Notice Board's Guilds tab and the hall's own board on the
// minimal DOM (test/chargenDom.mjs), the catalogue's hall board, and the hosts by their source.
// bible/11-Multiplayer/Seats-Arc.md 8.2; `06-Systems/Online-Arc.md` GUILD1e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from './chargenDom.mjs';
import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { accountBoard, SESSION_KEY } from '../src/net/accountClient.js';
import { createNoticeBook, GUILD_BOARD_WORDS } from '../src/net/noticeBook.js';
import { GUILD_NOTES_LIVE_MAX, BOARD_CACHE_MS } from '../src/net/boardLaw.js';
import { mountNoticeBoard, recruitPosters, GUILD_BOARD_EMPTY } from '../src/ui/noticeWindow.js';
import { HALL_BOARD_ENTRY, decorRoomEntries, decorCatalogue } from '../src/systems/decorCatalogue.js';
import { createDecorScan } from '../src/systems/decorScan.js';
import { BULLETIN_BOARD_MODEL_ID } from '../src/world/rmbLayout.js';
import { HALL_BOARD_TITLE, hallBoardShutLine, HALL_BOARD_COLD } from '../src/systems/onlineHomes.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TOWN = 7;
const noWait = () => Promise.resolve();
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
/** AUDIT SEATS-3 F1: the real service answers when it answers - wait for the state, not a count of ticks (bounded). */
const until = async (pred, n = 400) => { for (let i = 0; i < n && !pred(); i++) await tick(); };

/** A guild of Gwen's with heraldry, Rhea a Member; each one's notice book over the real service. */
async function stood() {
  const svc = await standService({ BOARD_OPEN: 'on' });
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: { field: 'azure', border: 'gold', device: 'wolf' } }, gm.secret)).status, 200);
  const rhea = await svc.registered('Rhea');
  const R = await seatRealm(svc.env, rhea.secret, 'Rhea', { name: 'Rhea', level: 5, goldPieces: 10, items: [] });
  rhea.character = R.id;
  await svc.call('/v1/guilds/invite', { character: gm.character, handle: 'Rhea' }, gm.secret);
  const inv = await svc.call('/v1/guilds/invites', {}, rhea.secret);
  await svc.call('/v1/guilds/answer', { character: rhea.character, guild: inv.body.invites[0].guild, accept: true }, rhea.secret);
  let n = 0;
  const bookOf = (who, door = null) => createNoticeBook({
    door: door ?? accountBoard({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), sleep: noWait, rid: () => `g1e-${who.handle}-${String(++n).padStart(4, '0')}`,
  });
  return { svc, gm, rhea, bookOf };
}

test('GUILD1e the book: the guild\'s board read through the service and kept a minute (a refusal too); a pin\'s request id kept until answered - twice pressed, one note; taken down and read again; the guild board\'s own words for its refusals (mutants: the cache; the kept id; the forced read after; the words)', async (t) => {
  let now = T0 * 1000;
  t.mock.method(Date, 'now', () => now);
  const { rhea, gm, bookOf } = await stood();
  let reads = 0;
  const book = bookOf(rhea);
  const r = await book.readGuild(rhea.character);
  assert.equal(r.error, null);
  assert.equal(r.data.guild.name, 'The Silver Hand');
  assert.deepEqual(r.data.notes, []);
  // a minute's cache, a refusal kept too
  const counting = createNoticeBook({ door: { guildRead: async () => { reads++; return { ok: false, error: 'no-guild' }; } }, sleep: noWait, nowMs: () => now });
  await counting.readGuild('char-x');
  await counting.readGuild('char-x');
  assert.equal(reads, 1, 'a refusal answers the minute');
  now += BOARD_CACHE_MS + 1;
  await counting.readGuild('char-x');
  assert.equal(reads, 2);
  // one pin, twice pressed
  const a = book.pinGuild(rhea.character, { subject: 'Muster', body: 'Friday', days: 3 });
  const b = book.pinGuild(rhea.character, { subject: 'Muster', body: 'Friday', days: 3 });
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.ok, true, JSON.stringify(ra));
  assert.equal(rb.ok, true);
  assert.equal(book.cachedGuild(rhea.character).notes.length, 1, 'one note, and the board read again after it');
  // a pin whose answer was lost keeps its id: asked again, the service answers the note it made
  let lose = true;
  const svc2 = await stood();
  const door = accountBoard({ fetch: svc2.svc.fetch, storage: sessionStorageOf(SESSION_KEY, svc2.rhea) });
  const lossy = { ...door, guildPin: async (note, id) => { const x = await door.guildPin(note, id); if (lose) { lose = false; return { ok: false, error: 'offline' }; } return x; } };
  let k = 0;
  const book2 = createNoticeBook({ door: lossy, sleep: noWait, rid: () => `g1e-kept-${String(++k).padStart(6, '0')}` });   // a fresh id each mint: only the KEPT one makes it one note
  const kept = await book2.pinGuild(svc2.rhea.character, { subject: 'Once', body: 'only', days: 1 });
  assert.equal(kept.ok, true);
  assert.equal(svc2.svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guild_notes').get().n, 1, 'the lost answer asked again under its id is the same note');
  // taken down, read again
  const id = book.cachedGuild(rhea.character).notes[0].id;
  const gmBook = bookOf(gm);
  const down = await gmBook.takeDownGuild(gm.character, id);
  assert.equal(down.ok, true, JSON.stringify(down));
  assert.deepEqual(gmBook.cachedGuild(gm.character).notes, []);
  // full: the guild board's own words
  for (let i = 0; i < GUILD_NOTES_LIVE_MAX; i++) assert.equal((await book.pinGuild(rhea.character, { subject: `n${i}`, body: 'b', days: 1 })).ok, true);
  const full = await book.pinGuild(rhea.character, { subject: 'one more', body: 'b', days: 1 });
  assert.equal(full.text, GUILD_BOARD_WORDS['notes-full']);
  assert.match(GUILD_BOARD_WORDS['notes-full'], new RegExp(`${GUILD_NOTES_LIVE_MAX} notes up on your guild's board`));
});

test('GUILD1e the Guilds tab: the reader\'s guild\'s notes under its banner, the pin form and its note up, the town\'s recruitment posters with their guilds\' banners; a guildless reader told so (mutants: the tab unshown; the posters\' filter; the banner; the pin act)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, rhea, bookOf } = await stood();
  assert.equal((await svc.call('/v1/board/pin', { map: TOWN, subject: 'The Hand recruits', body: 'Join us', days: 7, button: 'guild', character: gm.character, rid: 'g1e-poster-0001' }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/board/pin', { map: TOWN, subject: 'A plain note', body: 'hello', days: 1, rid: 'g1e-plain-0001' }, gm.secret)).status, 200);
  const book = bookOf(rhea);
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: TOWN }, book, guilds: true, character: () => rhea.character });
  await until(() => /pinned here/.test(host.textContent));   // AUDIT SEATS-3 F1: the town's board read
  const tabs = byClass(host, 'notice-tab');
  assert.deepEqual(tabs.map((x) => x.textContent.replace(/\d+$/, '')), ['Notices', 'Guilds'], 'BOARD-UI: a tab\'s count of new notes beside its name');
  tabs[1].onclick();
  await until(() => /on The Silver Hand's board/.test(host.textContent));   // AUDIT SEATS-3 F1: the guild's board read
  const text = host.textContent;
  assert.match(text, /<SH> The Silver Hand - members only/);   // BOARD-UI (PIN MOVED)
  assert.match(text, new RegExp(GUILD_BOARD_EMPTY.none('The Silver Hand')));
  assert.match(text, /Recruiting in Daggerfall/);
  const posters = byClass(host, 'notice-poster');
  assert.equal(posters.length, 1, 'the recruitment note alone');
  assert.match(posters[0].textContent, /<SH> The Silver Hand/);
  assert.ok(byClass(host, 'notice-banner').length >= 2, 'the guild\'s banner over its notes and on its poster');
  assert.match(byClass(host, 'notice-banner')[0].src, /^data:image\/svg\+xml/);
  // pin a note for the guild
  byClass(host, 'notice-pinbtn')[0].click();
  const inputs = byClass(host, 'notice-input');
  inputs[0].value = 'Muster'; inputs[0].oninput();
  const area = byClass(host, 'notice-textarea')[0];
  area.value = 'Friday at the hall.'; area.oninput();
  byClass(host, 'notice-dopin')[0].click();
  await until(() => /Your note is up on the guild's board\./.test(host.textContent));   // AUDIT SEATS-3 F1
  assert.match(host.textContent, /Your note is up on the guild's board\./);
  assert.equal(byClass(host, 'notice-card').filter((c) => c.textContent.includes('Muster')).length, 1);
  v.unmount();
  // a reader in no guild
  const loner = await svc.registered('Lone');
  const L = await seatRealm(svc.env, loner.secret, 'Lone', { name: 'Lone', level: 3, goldPieces: 10, items: [] });
  const host2 = document.createElement('div');
  const v2 = mountNoticeBoard(host2, { town: { name: 'Daggerfall', mapId: TOWN }, book: bookOf(loner), guilds: true, character: () => L.id });
  await until(() => /pinned here/.test(host2.textContent));   // AUDIT SEATS-3 F1
  byClass(host2, 'notice-tab')[1].onclick();
  await until(() => !/Reading/.test(host2.textContent));   // AUDIT SEATS-3 F1: the guild read answered (a refusal)
  assert.match(host2.textContent, new RegExp(GUILD_BOARD_EMPTY['no-guild'].replace(/[.']/g, '.')));
  assert.equal(byClass(host2, 'notice-pinbtn').length, 0, 'nothing to pin to');
  v2.unmount();
  assert.deepEqual(recruitPosters({ notes: [{ button: 'guild', guild: { name: 'x' } }, { button: 'guild' }, { button: 'party', guild: { name: 'y' } }] }).length, 1);
});

test('GUILD1e the hall\'s board: the guild\'s notes ALONE under the guild\'s name, no town read; an author and a keeper take a note down (mutants: the town read in guildOnly; the take-down\'s who)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { gm, rhea, bookOf } = await stood();
  const rb = bookOf(rhea);
  assert.equal((await rb.pinGuild(rhea.character, { subject: 'Rhea\'s', body: 'mine', days: 1 })).ok, true);
  let townReads = 0;
  const gmBook = bookOf(gm);
  const counting = { read: async () => { townReads++; return { ok: true, data: { notes: [], notices: [] } }; } };
  const book = createNoticeBook({ door: { ...counting, guildRead: (c) => gmBook.readGuild(c).then((r) => (r.data ? { ok: true, data: r.data } : { ok: false, error: r.error })) }, sleep: noWait });
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'The Silver Hand', mapId: 0 }, guildOnly: { name: 'The Silver Hand' }, book, character: () => gm.character });
  await until(() => /on The Silver Hand's board/.test(host.textContent));   // AUDIT SEATS-3 F1
  assert.equal(townReads, 0, 'the hall\'s board reads no town');
  assert.deepEqual(byClass(host, 'notice-tab').map((x) => x.textContent), ['Guild notes']);
  assert.match(host.textContent, /The board of The Silver Hand/);
  assert.doesNotMatch(host.textContent, /Recruiting in/, 'no posters in the hall');
  v.unmount();
  // the take-down: Rhea (a Member) on her own note alone; the guildmaster (a keeper) on anyone's
  assert.equal((await gmBook.pinGuild(gm.character, { subject: 'Gwen\'s', body: 'hers', days: 1 })).ok, true);
  const hr = document.createElement('div');
  const vr = mountNoticeBoard(hr, { town: { name: 'x', mapId: 0 }, guildOnly: { name: 'The Silver Hand' }, book: bookOf(rhea), character: () => rhea.character });   // a fresh book: Rhea's has the minute's read
  await until(() => byClass(hr, 'notice-card').length === 2);   // AUDIT SEATS-3 F1
  const cardOf = (h, words) => byClass(h, 'notice-card').find((c) => c.textContent.includes(words));
  cardOf(hr, 'Gwen\'s').onclick();
  assert.equal(byClass(hr, 'notice-takedown').length, 0, 'a Member takes down nobody else\'s');
  byClass(hr, 'notice-close')[0].click();
  cardOf(hr, 'Rhea\'s').onclick();
  assert.equal(byClass(hr, 'notice-takedown').length, 1, 'an author their own');
  vr.unmount();
  const host2 = document.createElement('div');
  const v2 = mountNoticeBoard(host2, { town: { name: 'x', mapId: 0 }, guildOnly: { name: 'The Silver Hand' }, book: gmBook, character: () => gm.character });
  await until(() => byClass(host2, 'notice-card').length === 2);   // AUDIT SEATS-3 F1
  byClass(host2, 'notice-card').find((c) => c.textContent.includes('Rhea\'s')).onclick();
  assert.equal(byClass(host2, 'notice-takedown').length, 1, 'a keeper takes down anyone\'s');
  byClass(host2, 'notice-takedown')[0].click();
  for (let i = 0; i < 400 && !/The note is taken down\./.test(host2.textContent); i++) await tick();   // AUDIT SEATS-3 E3: the service's answer, however loaded the run
  assert.match(host2.textContent, /The note is taken down\./);
  assert.deepEqual(gmBook.cachedGuild(gm.character).notes.map((x) => x.subject), ['Gwen\'s']);
  v2.unmount();
});

test('GUILD1e the catalogue: Daggerfall\'s own board is the hall\'s board - offered in a hall\'s room alone, never a home\'s or a yard, measured and priced as every piece (mutants: the hall filter; the yard; the scan\'s entry)', () => {
  assert.equal(HALL_BOARD_ENTRY.model, BULLETIN_BOARD_MODEL_ID);
  assert.equal(HALL_BOARD_ENTRY.key, `m${BULLETIN_BOARD_MODEL_ID}`);
  assert.equal(HALL_BOARD_ENTRY.name, 'Notice Board');
  assert.equal(HALL_BOARD_ENTRY.hall, true);
  const list = [{ key: 'm1', kind: 'furniture' }, { key: 'm9', kind: 'door' }, HALL_BOARD_ENTRY];
  assert.deepEqual(decorRoomEntries(list, { hall: false }).map((e) => e.key), ['m1', 'm9'], 'a home offers no hall board');
  assert.deepEqual(decorRoomEntries(list, { hall: true }).map((e) => e.key), ['m1', 'm9', HALL_BOARD_ENTRY.key]);
  assert.deepEqual(decorRoomEntries(list, { hall: true, yard: true }).map((e) => e.key), ['m1'], 'no board and no door in a yard');
  assert.equal(decorRoomEntries(null, {}), null);
  assert.ok(!decorCatalogue(new Map()).some((e) => e.hall), 'the blocks\' own catalogue carries none');
  const scan = createDecorScan({ blocks: { count: 0, getBlockType: () => 0, getBlock: () => null }, isTownBlock: () => true, modelRadius: (id) => (id === BULLETIN_BOARD_MODEL_ID ? 1.2 : null), flatRadius: () => null });
  scan.step(); scan.step();
  assert.ok(scan.entries().some((e) => e.key === HALL_BOARD_ENTRY.key), 'the scan appends it');
  assert.equal(scan.radiusOf(HALL_BOARD_ENTRY), 1.2, 'and measures it, so it has a price');
});

test('GUILD1e the hosts by source: the hall\'s board pressed opens the guild\'s notes for a member and says whose it is to anyone else; its name on the plaque; the world host\'s door in guildOnly; the town boards carry the Guilds tab; the four hosts named (mutants: the member asked; the model asked; guildOnly; guilds)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const isHallBoard = \(piece\) => \(!!interiorHome\?\.hall \|\| !!interiorSeatHall\) && piece\?\.model === BULLETIN_BOARD_MODEL_ID && !piece\.item;/);   // PIN MOVED (SEAT-HALL): the palace's hall shares the line
  assert.match(wm, /if \(isHallBoard\(piece\)\) \{ openHallBoard\(\); return; \}/);
  const open = wm.slice(wm.indexOf('function openHallBoard() {'), wm.indexOf('\n  }', wm.indexOf('function openHallBoard() {')));
  assert.match(open, /if \(!hallMemberHere\(\)\) \{ say\(hallBoardShutLine\(hallNameHere\(\)\)\); return; \}/);   // PIN MOVED (SEAT-HALL): the palace's hall shares the line
  assert.match(open, /if \(!host\.guildHall\?\.openBoard\?\.\(hallNameHere\(\)\)\) say\(HALL_BOARD_COLD\);/);   // PIN MOVED (SEAT-HALL): the palace's hall shares the line
  assert.match(wm, /if \(isHallBoard\(piece\) && hallMemberHere\(\)\) return \{ title: HALL_BOARD_TITLE \};/);
  assert.equal(HALL_BOARD_TITLE, "The Guild's Board");
  assert.equal(hallBoardShutLine('The Silver Hand'), "This board is The Silver Hand's. Its notes are for its members.");
  assert.equal(HALL_BOARD_COLD, "The guild's board cannot be read now.");
  const w = src('src/scenes/world.js');
  assert.match(w, /openBoard: \(name\) => openGuildBoard\(name\),/);
  assert.match(w, /const openGuildBoard = \(name\) => \(noticeBook \? showNoticeWindow\(\{ town: \{ name: name \|\| 'the guild', mapId: 0 \}, guildOnly: \{ name: name \|\| 'the guild' \} \}\) : false\);/);
  // THE ONE CONSTRUCTION SEAM: a town's board and the hall's are both built by the one builder
  const seam = w.slice(w.indexOf('const showNoticeWindow = (deps) => {'), w.indexOf('\n  };', w.indexOf('const showNoticeWindow = (deps) => {')));
  assert.match(seam, /const ov = createNoticeOverlay\(\{\s*book: noticeBook, character: \(\) => characterIdOf\(playerEntity\),/);
  assert.match(seam, /townTalk\.showOverlay\(ov\);/);
  assert.match(w, /return showNoticeWindow\(\{\s*town: \{ name: town\.name, mapId: town\.mapId \}/);
  assert.match(w, /guilds: true,   \/\/ GUILD1e: the Guilds tab/);
  assert.doesNotMatch(src('src/scenes/dungeonContext.js'), /openGuildBoard|HALL_BOARD/, 'no hall stands underground');
  assert.doesNotMatch(src('src/scenes/exterior.js'), /openGuildBoard|HALL_BOARD/, 'the fixed city holds no online hall');
  assert.match(src('src/net/accountClient.js'), /guildRead: \(character\) => post\('\/v1\/guilds\/board', \{ character \}\),/);
});
