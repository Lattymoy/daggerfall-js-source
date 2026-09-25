// FOUNDER2 (2026-09-24, Mac: "I want to grant all current accounts the founder
// title if they dont have it already"). Founder is DERIVED - held by every
// account registered on or before FOUNDER_UNTIL (ACC3's design: no row is ever
// written) - and TITLE-R had closed it at 2026-09-23T00:00Z, so the accounts
// registered since held nothing. The grant is the cutoff moved to the end of
// the day it was asked, 2026-09-25T00:00Z: every account registered by then
// holds and may wear it, and past it the title is closed again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titlesHeld, titleWorn, equipRefusal, FOUNDER_UNTIL } from '../server-account/src/titles.js';

test('FOUNDER2: every account registered by the end of 2026-09-24 holds Founder, and may wear it; past it, none (mutants: the old cutoff; the cutoff an open end)', () => {
  const closedAt = Date.UTC(2026, 8, 23) / 1000;   // TITLE-R's close, the day before
  const since = { handle: 'Since', registered_at: closedAt + 3600, title: null };
  assert.deepEqual(titlesHeld(since, {}), ['founder'], 'registered after TITLE-R closed it: granted now');
  assert.equal(equipRefusal('founder', since, {}), null, 'and it may be worn');
  assert.equal(titleWorn({ ...since, title: 'founder' }, {}), 'founder');
  const lastSecond = { handle: 'Late', registered_at: Date.UTC(2026, 8, 25) / 1000 };
  assert.deepEqual(titlesHeld(lastSecond, {}), ['founder'], 'the cutoff second is inside');
  assert.deepEqual(titlesHeld({ handle: 'After', registered_at: Date.UTC(2026, 8, 25) / 1000 + 1 }, {}), [], 'a second past: closed again');
  assert.equal(FOUNDER_UNTIL, Date.UTC(2026, 8, 25) / 1000);
  assert.deepEqual(titlesHeld({ handle: 'Old', registered_at: 1 }, {}), ['founder'], 'the first founders keep it');
  assert.deepEqual(titlesHeld({ created_at: 1, registered_at: null }, {}), [], 'a guest still holds none');
});
