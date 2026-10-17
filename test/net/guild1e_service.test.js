// GUILD1e (2026-09-30, Mac: "Finish the seats"): A GUILD'S OWN BOARD, AS THE SERVICE KEEPS IT - driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 8.2
// ("a private guild board (the board's Guilds tab, members only)"); `06-Systems/Online-Arc.md` GUILD1e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { GUILD_NOTES_LIVE_MAX, GUILD_NOTES_SHOWN, NOTE_DAY_S } from '../../src/net/boardLaw.js';
import { HALL_POWERS, hallMay } from '../../src/net/hallLaw.js';

/** A guild founded by Gwen; Otto joined and made an Officer, Rhea a Member; Sly in another guild. The board open. */
async function stood({ board = 'on' } = {}) {
  const svc = await standService(board ? { BOARD_OPEN: board } : {});
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const join = async (handle) => {
    const who = await svc.registered(handle);
    const R = await seatRealm(svc.env, who.secret, handle, { name: handle, level: 5, goldPieces: 50_000, items: [] });
    who.character = R.id; who.at = R.at;
    assert.equal((await svc.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret)).status, 200);
    const inv = await svc.call('/v1/guilds/invites', {}, who.secret);
    assert.equal((await svc.call('/v1/guilds/answer', { character: who.character, guild: inv.body.invites[0].guild, accept: true }, who.secret)).status, 200);
    return who;
  };
  const officer = await join('Otto');
  const member = await join('Rhea');
  const view = async (who = gm) => (await svc.call('/v1/guilds/mine', { character: who.character }, who.secret)).body.guild;
  const otto = (await view()).members.find((m) => m.name === 'Otto');
  assert.equal((await svc.call('/v1/guilds/rank', { character: gm.character, member: otto.member, rank: 1 }, gm.secret)).status, 200);
  const rival = await svc.registered('Sly', { renown: 12 });
  assert.equal((await svc.found(rival, { name: 'The Ebon Oath', tag: 'EO' })).status, 200);
  const read = (who) => svc.call('/v1/guilds/board', { character: who.character }, who.secret);
  const pin = (who, over = {}) => svc.call('/v1/guilds/board/pin', { character: who.character, subject: 'Muster', body: 'Friday at the hall.', days: 3, rid: `rid-${who.handle}-${Math.random().toString(36).slice(2, 10)}`, ...over }, who.secret);
  const down = (who, id) => svc.call('/v1/guilds/board/take-down', { character: who.character, id }, who.secret);
  return { svc, gm, officer, member, rival, read, pin, down, raw: svc.env.DB._raw };
}

test('GUILD1e the guild\'s board is its MEMBERS\': any member pins and reads it, under its name, tag and heraldry, newest first, the author its roster name; another guild\'s member, a guildless player and a guest read and pin nothing of it (mutants: the member\'s guild unasked; the author\'s account in the answer)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, member, rival, read, pin } = await stood();
  assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: { field: 'azure', border: 'gold', device: 'wolf' } }, gm.secret)).status, 200);
  const a = await pin(member, { subject: 'First', body: 'Rhea was here.' });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  t.mock.method(Date, 'now', () => (T0 + 60) * 1000);
  assert.equal((await pin(gm, { subject: 'Second' })).status, 200);
  const r = await read(member);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.guild, { id: r.body.guild.id, name: 'The Silver Hand', tag: 'SH', heraldry: { field: 'azure', border: 'gold', device: 'wolf' } });
  assert.deepEqual(r.body.notes.map((n) => n.subject), ['Second', 'First'], 'newest first');
  assert.equal(r.body.notes[1].from, 'Rhea', 'the member who pinned it, by the roster\'s name');
  assert.equal(r.body.notes[1].mine, true);
  assert.equal(r.body.notes[0].mine, false);
  assert.ok(!JSON.stringify(r.body).includes(member.id), 'no account id leaves the service');
  assert.deepEqual(r.body.me, { canPin: true, live: 1, max: GUILD_NOTES_LIVE_MAX, keeper: false });
  // another guild's board is its own
  const other = await read(rival);
  assert.equal(other.body.guild.name, 'The Ebon Oath');
  assert.deepEqual(other.body.notes, [], 'a rival reads nothing of the Silver Hand\'s');
  const loner = await svc.registered('Lone');
  const R = await seatRealm(svc.env, loner.secret, 'Lone', { name: 'Lone', level: 3, goldPieces: 10, items: [] });
  assert.equal((await svc.call('/v1/guilds/board', { character: R.id }, loner.secret)).body.error, 'no-guild');
  assert.equal((await svc.call('/v1/guilds/board/pin', { character: R.id, subject: 'x', body: 'y', days: 1, rid: 'rid-lone-0001' }, loner.secret)).body.error, 'no-guild');
  const guest = await svc.guest();
  assert.equal((await svc.call('/v1/guilds/board', { character: 'char-x' }, guest.secret)).status, 403, 'a guest is in no guild');
});

test('GUILD1e a pin: noteWords\' law with no button, a member\'s live notes bounded apart from the town\'s inside the INSERT, asked again under its rid the note it made, the hour bounded; a member removed between the read and the write pins nothing (mutants: the live bound; the membership in the INSERT; the rid answered)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, member, pin, read, raw } = await stood();
  assert.deepEqual([GUILD_NOTES_LIVE_MAX, GUILD_NOTES_SHOWN], [3, 30], 'the law\'s numbers (PROF0 10.1, 10.6)');
  assert.equal((await pin(member, { days: 2 })).body.error, 'bad-note-days');
  assert.equal((await pin(member, { subject: '' })).body.error !== undefined, true, 'an empty subject is refused');
  const once = await pin(member, { rid: 'rid-rhea-same-01' });
  const twice = await pin(member, { rid: 'rid-rhea-same-01' });
  assert.equal(twice.body.repeat, true);
  assert.equal(twice.body.note.id, once.body.note.id, 'the same note, never two');
  for (let i = 1; i < GUILD_NOTES_LIVE_MAX; i++) assert.equal((await pin(member)).status, 200);
  const full = await pin(member);
  assert.deepEqual([full.status, full.body.error], [409, 'notes-full']);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_notes').get().n, GUILD_NOTES_LIVE_MAX);
  // a town's board is a separate bound - the guild's notes take none of its places
  const town = await svc.call('/v1/board/pin', { map: 7, subject: 'Hello', body: 'town', days: 1, rid: 'rid-rhea-town-1' }, member.secret);
  assert.equal(town.status, 200, JSON.stringify(town.body));
  // the week runs out: the places come back
  t.mock.method(Date, 'now', () => (T0 + 3 * NOTE_DAY_S + 1) * 1000);
  assert.equal((await read(member)).body.me.live, 0);
  assert.equal((await pin(member)).status, 200);
  // removed between the read and the write
  const orig = svc.env.DB.prepare.bind(svc.env.DB);
  let fired = false;
  svc.env.DB.prepare = (sql) => {
    if (!fired && sql.startsWith('INSERT INTO guild_notes')) { fired = true; raw.prepare("DELETE FROM guild_members WHERE name = 'Rhea'").run(); }
    return orig(sql);
  };
  const gone = await pin(member);
  assert.equal(gone.body.error, 'no-guild', 'nothing pinned by a member no longer there');
});

test('GUILD1e taken down: an author their own; an Officer and the guildmaster anyone\'s (HALL_POWERS.notes); a Member nobody else\'s; another guild\'s never - the rank asked in the DELETE itself (mutants: the rank list; the guild in the DELETE; the author clause)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, member, rival, pin, down, read, raw } = await stood();
  assert.deepEqual(HALL_POWERS.notes, [0, 1]);
  assert.equal(hallMay(2, 'notes'), false);
  const a = (await pin(member)).body.note.id;
  const b = (await pin(gm)).body.note.id;
  const c = (await pin(officer)).body.note.id;
  assert.equal((await down(member, b)).body.error, 'no-note', 'a Member takes down nobody else\'s');
  assert.equal((await down(rival, a)).body.error, 'no-note', 'another guild\'s guildmaster reaches nothing here');
  assert.equal((await down(member, a)).status, 200, 'an author their own');
  assert.equal((await down(officer, b)).status, 200, 'an Officer anyone\'s');
  // demoted between the read and the DELETE: their own only
  const d = (await pin(gm)).body.note.id;
  const orig = svc.env.DB.prepare.bind(svc.env.DB);
  let fired = false;
  svc.env.DB.prepare = (sql) => {
    if (!fired && sql.startsWith('DELETE FROM guild_notes WHERE id = ?1')) { fired = true; raw.prepare("UPDATE guild_members SET rank = 2 WHERE name = 'Otto'").run(); }
    return orig(sql);
  };
  assert.equal((await down(officer, d)).body.error, 'no-note', 'the rank the DELETE reads, not the one read before it');
  svc.env.DB.prepare = orig;
  assert.equal((await down(gm, c)).status, 200, 'the guildmaster anyone\'s');
  assert.deepEqual((await read(gm)).body.notes.map((n) => n.id), [d]);
  assert.equal((await read(gm)).body.me.keeper, true);
});

test('GUILD1e the Notice Board\'s switch and its mute stand on the guild\'s board; a muted author\'s notes leave everyone\'s view but their own; the board shows its newest GUILD_NOTES_SHOWN; a guild gone takes its notes (mutants: the switch; the mute\'s filter; the cascade)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const shut = await stood({ board: null });
  assert.equal((await shut.read(shut.member)).body.error, 'board-closed');
  const { svc, gm, member, pin, read, raw } = await stood();
  const n = (await pin(member)).body.note.id;
  raw.prepare("UPDATE players SET muted_until = ? WHERE handle = 'Rhea'").run(T0 + 3600);
  assert.equal((await pin(member)).body.error, 'muted');
  assert.deepEqual((await read(gm)).body.notes, [], 'a muted author\'s note leaves the board');
  assert.deepEqual((await read(member)).body.notes.map((x) => x.id), [n], 'but for its author');
  raw.prepare("UPDATE players SET muted_until = NULL WHERE handle = 'Rhea'").run();
  const g = raw.prepare('SELECT guild_id FROM guild_notes').get().guild_id;
  for (let i = 0; i < GUILD_NOTES_SHOWN + 2; i++) {
    raw.prepare(`INSERT INTO guild_notes (id, guild_id, author, char_id, author_name, subject, body, at, expires_at, rid) VALUES (?, ?, ?, ?, 'Gwen', ?, 'b', ?, ?, ?)`)
      .run(`note-seed-${String(i).padStart(4, '0')}-xxxxxxxx`, g, gm.id, gm.character, `s${i}`, T0 + i, T0 + 9999, `seed-${i}-xxxxxx`);
  }
  const all = (await read(gm)).body.notes;
  assert.equal(all.length, GUILD_NOTES_SHOWN);
  assert.equal(all[0].subject, `s${GUILD_NOTES_SHOWN + 1}`, 'the newest');
  raw.prepare('DELETE FROM guild_members WHERE guild_id = ?').run(g);
  raw.prepare('DELETE FROM guilds WHERE id = ?').run(g);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_notes').get().n, 0, 'a guild gone takes its notes');
  void svc;
});

test('GUILD1e the town board\'s recruitment note carries its guild\'s heraldry - the Guilds tab\'s poster (mutants: the heraldry dropped)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm } = await stood();
  assert.equal((await svc.call('/v1/guilds/heraldry', { character: gm.character, heraldry: { field: 'crimson', border: 'argent', device: 'tower' } }, gm.secret)).status, 200);
  const r = await svc.call('/v1/board/pin', { map: 9, subject: 'Recruiting', body: 'Join us', days: 7, button: 'guild', character: gm.character, rid: 'rid-gwen-recruit1' }, gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.note.guild, { name: 'The Silver Hand', tag: 'SH', heraldry: { field: 'crimson', border: 'argent', device: 'tower' } });
  const b = await svc.call('/v1/board/read', { map: 9 }, gm.secret);
  assert.deepEqual(b.body.notes[0].guild.heraldry, { field: 'crimson', border: 'argent', device: 'tower' });
});
