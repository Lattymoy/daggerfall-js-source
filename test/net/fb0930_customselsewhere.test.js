// CUSTOMS-ELSEWHERE (2026-09-30, FIELD BUGS 2026-09-30 - Dwarfblood in #dev-chat: the Online door's "The realm has no
// record of this character from before it opened ... so it cannot come in", of Tabby the Sneaky, "And yes, I did go
// online with this one in an older build"; bible/01-Overview/bugs/Field-Bugs-2026-09-30.md). The census (realm_census) counts
// a character under the ACCOUNT it went online with - and a player with a guest on one browser and a handle on another,
// or the desktop app beside the web, played one character on two accounts. Customs asked this account's census alone and
// said "no record" of a character the realm DID count, on the other account: the one refusal that sent the player to the
// Discord for a pass they did not need. It names the other account's case now; the gate itself (customsRealm's one
// guarded write) is unchanged, so nothing is let in that was not.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { accountRefusalText, REFUSALS } from '../../src/net/accountClient.js';

const ORIGIN = 'tabby-the-sneaky-01';

test('CUSTOMS-ELSEWHERE a character the census counted on ANOTHER account is refused as that - sign in with it - never "no record"; one it counted nowhere is still "no record", and one already brought in anywhere is "already" (mutants: the other account unread; a spent row read as waiting; the refusal unsaid)', async () => {
  const s = await standService();
  const here = await s.registered('Dwarfblood');
  const there = await s.registered('DwarfbloodGuest');
  const customs = (who, origin) => s.call('/v1/realm/customs', { origin, name: 'Tabby', summary: { level: 1 } }, who.secret);
  // counted nowhere: the one refusal that sends the player to the developers
  const none = await customs(here, ORIGIN);
  assert.deepEqual([none.status, none.body?.error], [403, 'customs-never-online']);
  // counted on the other account, still waiting there
  s.env.DB._raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(there.id, ORIGIN);
  const elsewhere = await customs(here, ORIGIN);
  assert.deepEqual([elsewhere.status, elsewhere.body?.error], [403, 'customs-other-account']);
  assert.equal(s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM realm_characters').get().n, 0, 'and nothing let in');
  assert.match(accountRefusalText('customs-other-account'), /another account/);
  assert.notEqual(accountRefusalText('customs-other-account'), REFUSALS.server);
  // the account that counted it brings it in; after that it is "already" from anywhere
  const brought = await customs(there, ORIGIN);
  assert.equal(brought.status, 200);
  const late = await customs(here, ORIGIN);
  assert.deepEqual([late.status, late.body?.error], [409, 'customs-already']);
});
