// SLAM8 (2026-09-16, AUDIT SLAM): RELAY_VERSION CANNOT BE FORGOTTEN AGAIN.
//
// The line above `RELAY_VERSION` has said "Bump it with every relay-changing slice" since WORLD1, and SLAM5 changed
// the relay's hello path - the 130-player wall - and left it at `world67`. So `world67` named BOTH the relay that
// stops an event at 130 players and the one that does not, and `/health` is the only pre-flight check this port has
// on event day: the relay is deployed by hand and nothing in CI deploys it.
//
// A hand-maintained constant beside a comment asking politely will be forgotten again; that is what a comment is.
// So the version is bound to the LAW ITSELF here. `server/src/index.js` is the relay and `src/net/wire.js` is the
// law it runs (re-exported by server/src/relay.js), and a change to either is a change to what a deployed worker
// does. Change one of those files and this pin fails until a NEW version with its own hash is added below - and it
// has to be new, because the old version's recorded hash is the old bytes and stays that way.
//
// This deliberately fires for a comment-only edit too. `/health` answers "is the worker running the bundle I built?",
// and a bundle whose comments differ is a different bundle; a version that is only sometimes trustworthy is the
// thing that just cost us.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RELAY_VERSION } from '../server/src/index.js';

/** Every relay this repo has shipped a law for, and the sha256 of (server/src/index.js + src/net/wire.js) that IS it.
 *  Append; never edit an existing row - an old row is a historical fact about bytes that have already been deployed. */
const LAW = {
  world69: '27da57b0787d8e18e93dea8358614d9af2e9c65133774755f39960e0ec8f89de',
};

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url));

test('SLAM8: RELAY_VERSION names exactly one relay law - change the worker or the wire without bumping it and this fails (mutants: the relay edited under a version already shipped, which is SLAM5 verbatim; a row rewritten in place, which relabels bytes that are already deployed)', () => {
  const hash = createHash('sha256').update(rd('server/src/index.js')).update(rd('src/net/wire.js')).digest('hex');
  assert.ok(LAW[RELAY_VERSION], `RELAY_VERSION is '${RELAY_VERSION}' and this file has no law recorded for it - add the row`);
  assert.equal(hash, LAW[RELAY_VERSION],
    `THE RELAY'S LAW CHANGED UNDER '${RELAY_VERSION}'.\n`
    + `  Bump RELAY_VERSION in server/src/index.js and add a row here in the SAME commit:\n`
    + `      ${'<new version>'}: '${hash}',\n`
    + `  /health is the only pre-flight check the event has, and it has to mean something.`);
  assert.equal(new Set(Object.values(LAW)).size, Object.keys(LAW).length, 'two versions cannot name the same bytes');
  assert.ok(/^world\d+$/.test(RELAY_VERSION), 'the shape law (nine test files hard-code this spelling)');
});
