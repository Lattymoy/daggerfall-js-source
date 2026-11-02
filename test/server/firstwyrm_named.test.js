// FIRST-WYRM (2026-10-31, the owner: "Seasoning needs to be granted the first dragon rider. He hasnt recieved it"):
// FIRST_WYRM_RIDER_HANDLES grants First Wyrm Rider by handle. While it names anyone, the earliest brass tame holds the
// title only if listed - there is one First. First Aether Rider stays derived. FIRST-WYRM-NAME (the owner: "His name is
// Seanobi"): the account is Seanobi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { titlesHeld, isNamedFirstWyrm } from '../../server-account/src/titles.js';
import { utcDay } from '../../src/net/marksLaw.js';

const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const RIDERS = ['wyrmrider', 'firstwyrmrider', 'aetherrider', 'firstaetherrider'];

test('FIRST-WYRM THE LAW: a listed handle holds First Wyrm Rider, case-folded, never a guest; a listed First displaces the earliest tame\'s (mutants: the list ignored; the derived First kept beside it)', () => {
  const env = { FIRST_WYRM_RIDER_HANDLES: 'Seanobi' };
  assert.ok(isNamedFirstWyrm({ handle: 'seanobi' }, env));
  assert.ok(!isNamedFirstWyrm({ handle: null }, env), 'a guest never');
  assert.ok(!isNamedFirstWyrm({ handle: 'Seanobi' }, {}), 'unlisted, nothing');
  const riders = (p, e) => titlesHeld(p, e).filter((t) => RIDERS.includes(t));
  assert.deepEqual(riders({ handle: 'Seanobi', masteryMarks: [] }, env), ['firstwyrmrider'], 'by name, no row asked');
  const earliest = { handle: 'Other', masteryMarks: ['wyrmrider', 'firstwyrmrider', 'aetherrider', 'firstaetherrider'] };
  assert.deepEqual(riders(earliest, env), ['wyrmrider', 'aetherrider', 'firstaetherrider'], 'the named First is the one First');
  assert.deepEqual(riders(earliest, {}), RIDERS, 'an empty list leaves the derived First');
  assert.match(readFileSync(new URL('../../server-account/wrangler.toml', import.meta.url), 'utf8'), /^FIRST_WYRM_RIDER_HANDLES = "Seanobi"$/m, 'the owner\'s grant, by handle');
});

test('FIRST-WYRM THE SERVICE: the listed account wears First Wyrm Rider though another tamed first; the earliest tamer is refused it (mutants: the wardrobe reads the rows alone)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ FIRST_WYRM_RIDER_HANDLES: 'seanobi' });
  const raw = s.env.DB._raw;
  const named = await s.seated('Seanobi');
  const early = await s.seated('Early');
  raw.prepare('INSERT INTO dragon_mounts (id, account, char_id, look, watch, at) VALUES (?, ?, ?, 0, 1, 10)').run('d-early', early.id, `${early.character}-d`);
  const mine = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).wardrobe.titles.filter((x) => RIDERS.includes(x));
  assert.deepEqual(await mine(named), ['firstwyrmrider']);
  assert.deepEqual(await mine(early), ['wyrmrider']);
  assert.equal((await s.call('/v1/account/title', { title: 'firstwyrmrider' }, named.secret)).status, 200, 'worn');
  assert.equal((await s.call('/v1/account/title', { title: 'firstwyrmrider' }, early.secret)).status, 403, 'not the First');
});
