// WYRM-RIDER (2026-10-30, the owner: "we need a title thats basd ass for this DRAGON TAMER"): an account that holds a tamed
// Dwarven Dragon holds Wyrm Rider; the account whose tame is the earliest of all also holds First Wyrm Rider. Derived from the
// service's own rows (dragon_mounts) as the Marks of Mastery are - held on the wardrobe, worn, signed into the token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { verifyToken, TITLES } from '../../src/net/identityToken.js';
import { masteryMarksOf, MASTERY_MARKS, DRAGON_TITLES } from '../../src/net/huntLaw.js';
import { withMasteryMarksAll } from '../../server-account/src/hunts.js';
import { DRAGON_TAME_ONE_IN } from '../../server-account/src/dragons.js';
import { DRAGON_TAME_ODDS, WARDROBE } from '../../src/ui/collections/wardrobeCatalogue.js';
import { TITLE_TEXT, TITLE_GRADIENT } from '../../src/ui/playerBadge.js';
import { utcDay } from '../../src/net/marksLaw.js';

const { subtle } = globalThis.crypto;
const NOON = utcDay(T0) * 86_400 + 12 * 3600;

test('WYRM-RIDER THE LAW: a tamed dragon holds Wyrm Rider, the earliest tame First Wyrm Rider beside it; none without a dragon (mutants: the first without a dragon; the rider unheld)', () => {
  assert.deepEqual(DRAGON_TITLES, { rider: 'wyrmrider', first: 'firstwyrmrider' });
  assert.deepEqual(masteryMarksOf({}), []);
  assert.deepEqual(masteryMarksOf({ dragons: 1 }), ['wyrmrider']);
  assert.deepEqual(masteryMarksOf({ dragons: 2, firstTame: true }), ['wyrmrider', 'firstwyrmrider']);
  assert.deepEqual(masteryMarksOf({ dragons: 0, firstTame: true }), [], 'no dragon, no title');
  assert.deepEqual(TITLES.slice(-2), ['wyrmrider', 'firstwyrmrider'], 'the token\'s vocabulary, last');
  assert.ok(MASTERY_MARKS.includes('wyrmrider') && MASTERY_MARKS.includes('firstwyrmrider'));
  assert.equal(TITLE_TEXT.wyrmrider, 'Wyrm Rider');
  assert.equal(TITLE_TEXT.firstwyrmrider, 'First Wyrm Rider');
  assert.equal(TITLE_GRADIENT.wyrmrider.length, 4);
  assert.equal(TITLE_GRADIENT.firstwyrmrider.length, 4);
  assert.equal(DRAGON_TAME_ODDS, DRAGON_TAME_ONE_IN, 'the wardrobe says the service\'s own odds');
  assert.equal(WARDROBE.title.wyrmrider.src, 'dragon');
  assert.equal(WARDROBE.title.firstwyrmrider.avail, 'closed');
});

test('WYRM-RIDER THE SERVICE: the rows grant it - held on the wardrobe, worn, signed into the token; the earliest tame alone the First; a board\'s batch reads the same (mutants: the first read off any tame; the batch blind to dragons)', async (t) => {
  let clock = NOON * 1000;
  t.mock.method(Date, 'now', () => clock);
  const s = await standService({});
  const raw = s.env.DB._raw;
  const a = await s.seated('Rider');
  const b = await s.seated('Second');
  const wardrobe = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).wardrobe;
  const mine = async (who) => (await wardrobe(who)).titles.filter((x) => x === 'wyrmrider' || x === 'firstwyrmrider');
  assert.deepEqual(await mine(a), []);
  const tame = (id, who, at) => raw.prepare('INSERT INTO dragon_mounts (id, account, char_id, look, watch, at) VALUES (?, ?, ?, 0, 1, ?)').run(id, who.id, who.character, at);
  tame('d-b', b, 200);
  tame('d-a', a, 100);
  assert.deepEqual(await mine(a), ['wyrmrider', 'firstwyrmrider'], 'the earliest tame of all');
  assert.deepEqual(await mine(b), ['wyrmrider'], 'a later tame: the rider alone');
  const rows = raw.prepare('SELECT * FROM players WHERE id IN (?, ?) ORDER BY id').all(a.id, b.id);
  const batch = await withMasteryMarksAll({ db: s.env.DB }, rows);
  for (const r of batch) assert.deepEqual(r.masteryMarks.filter((x) => x.includes('wyrm')), r.id === a.id ? ['wyrmrider', 'firstwyrmrider'] : ['wyrmrider']);
  assert.equal((await s.call('/v1/account/title', { title: 'firstwyrmrider' }, b.secret)).status, 403, 'not the first');
  assert.equal((await s.call('/v1/account/title', { title: 'firstwyrmrider' }, a.secret)).status, 200, 'worn');
  const tok = (await s.call('/v1/auth/token', { secret: a.secret, character: a.character })).body.token;
  const v = await verifyToken(tok, s.identityPublic, { subtle, nowS: NOON });
  assert.ok(v.ok, v.why);
  assert.equal(v.claims.t, 'firstwyrmrider', 'signed into the token');
  clock += 1;
});
