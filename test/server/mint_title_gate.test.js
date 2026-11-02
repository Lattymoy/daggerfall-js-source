// MINT-TITLE-GATE (2026-10-29, the account database overloaded from 01:15 UTC; bible/11-Multiplayer/Scale-Arc.md
// MINT-TITLE-GATE): the token's mint read the Charter titles (seatTitlesOf, two statements) and the Marks of Mastery (one)
// on every mint, though only the title worn is signed. A family is read now only when the title worn is one of it, and
// the token signed is the one it was. tools/mutants/mint_title_gate.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';

const SEAT_READS = /FROM town_seat_holds|FROM town_seat_titles/;
const MARK_READS = /FROM hunt_clears|FROM serpent_kills|FROM prof_tracks/;

test('MINT-TITLE-GATE: a mint reads the Charter titles only for a seat title worn and the Marks of Mastery only for a mastery or chapter title worn - none for no title or another title - and signs the same token: a family\'s rows change nothing while none of it is worn, and a worn one is signed with its claim (mutants: the seats never read; the seats always read; the marks always read; the marks never read)', async () => {
  const S = await standService({ SEATS_OPEN: 'on' });
  const raw = S.env.DB._raw;
  const who = await S.registered('Wayfarer');
  const asked = [];
  const prepare = raw.prepare.bind(raw);
  raw.prepare = (sql) => { asked.push(sql); return prepare(sql); };
  const mint = async () => {
    asked.length = 0;
    const r = await S.call('/v1/auth/token', { character: who.character }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { i, e, ...claims } = JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString());
    assert.equal(e - i, 300);
    return claims;
  };
  const read = (re) => asked.some((sql) => re.test(sql));
  const wear = async (title) => assert.equal((await S.call('/v1/account/title', { title }, who.secret)).status, 200, `${title} worn`);

  // untitled: neither family read
  const bare = await mint();
  assert.equal(bare.t, undefined);
  assert.deepEqual([read(SEAT_READS), read(MARK_READS)], [false, false], 'no title worn, no family read');

  // another family's title (a founder's): neither read, and the families' rows sign nothing new
  raw.prepare('UPDATE players SET registered_at = 1700000000 WHERE id = ?').run(who.id);
  await wear('founder');
  const founder = await mint();
  assert.equal(founder.t, 'founder');
  assert.deepEqual([read(SEAT_READS), read(MARK_READS)], [false, false], 'a title of no family read');
  raw.prepare("INSERT INTO town_seat_titles (account, title, key, week, at) VALUES (?, 'champion', 152, 1, 1)").run(who.id);
  for (let n = 0; n < 25; n++) raw.prepare("INSERT INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at) VALUES (?, ?, 'board', ?, 'x', 0, NULL, 1, 1)").run(who.id, who.character, `k${n}`);
  assert.deepEqual(await mint(), founder, 'the token the rows signed before');

  // a seat title worn: the Charter titles read, the marks not, its claim signed
  await wear('champion');
  const champion = await mint();
  assert.equal(champion.t, 'champion');
  assert.ok(Array.isArray(champion.ts) && champion.ts[0] === 152, 'with its claim');
  assert.deepEqual([read(SEAT_READS), read(MARK_READS)], [true, false]);

  // a mastery title worn: the marks read, the Charter titles not
  await wear('bloodhound');
  const hound = await mint();
  assert.equal(hound.t, 'bloodhound');
  assert.deepEqual([read(SEAT_READS), read(MARK_READS)], [false, true]);
  assert.deepEqual({ ...hound, t: undefined }, { ...founder, t: undefined }, 'the rest of the token as before');
});
