// AUDIT 17i: THE ONE CONSTRUCTION SEAM. Three separate bugs came from
// hosts building a ChargenFlow by hand and missing a dependency it had
// grown - the starting spellbook (17f), the starting kit (17f) and the
// biography (17h). These pins are the guard rail: the seam must attach
// everything, and no host may construct a flow of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createChargenFlow } from '../src/systems/chargenSession.js';

/** A fetchBytes over the real ARENA2 when it is there; the seam only
 *  needs CLASS*.CFG, SPELLS.STD and BIOG*.TXT. */
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 ? 'ARENA2_PATH not set - real-data validation skipped' : false;
const fetchBytes = async (name) => new Uint8Array(readFileSync(join(ARENA2 ?? '', name)));

test('17i: the seam hands back a flow with EVERY dependency attached', { skip: skipReal }, async () => {
  const { flow, careers, spellsByIndex, biogs } = await createChargenFlow(fetchBytes);
  // the three a host used to have to remember
  assert.equal(careers.length, 18, 'the careers');
  assert.ok(spellsByIndex?.size > 0, 'SPELLS.STD, so a town-created Mage has a spellbook');
  assert.equal(biogs.length, 18, 'the biography question sets');
  // and they are ON the flow, not merely returned beside it
  assert.equal(typeof flow.biogFor, 'function');
  assert.ok(flow.biogFor(0)?.questions?.length, 'the flow can reach question one');
  assert.equal(flow.careers.length, 18);
  assert.equal(flow.state, 'name', 'and it starts at the beginning');
});

test('17i: no host CONSTRUCTS a ChargenFlow of its own', () => {
  // The rule, enforced. A host that news up a flow gets whatever
  // dependencies existed the day it was written and silently misses
  // every one added since - which is exactly how three bugs happened.
  // The seam (chargenSession.js) is the only place allowed to.
  const dir = 'src/scenes';
  const offenders = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(dir, f), 'utf8');
    if (/new\s+ChargenFlow\s*\(/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], 'hosts must call createChargenFlow instead');
});
