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
import { dirname, join, relative } from 'node:path';
import { RELAY_VERSION } from '../src/net/wire.js';   // LOCALDEV1: the worker entry exports handlers alone

/** SLAM13 (AUDIT SLAM, final lens): THE LAW IS THE WHOLE BUNDLE, not two files. wrangler bundles every relative import
 *  the worker reaches - server/src/relay.js, src/net/wire.js and, since ONCRASH1, src/world/mat4.js (wrapAngle, which
 *  poseChanged and validPose run on every pose) - and an edit to any of them is a different deployed worker under the
 *  same name. So from world73 on the hash walks the import graph from server/src/index.js: every relative `from '...'`,
 *  depth first, each file once, in the order the imports are written. A file joining the graph changes the hash too,
 *  which is the point - a new import is a new bundle. Rows before world73 were sha256(index.js + wire.js) and stay
 *  as recorded: they are facts about bytes already deployed, under the hash law of their day. */
function graph(entry) {
  const out = [];
  const walk = (file) => {
    if (out.includes(file)) return;
    out.push(file);
    const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
    for (const m of src.matchAll(/\bfrom\s+'(\.[^']+)'|\bexport\s+\*\s+from\s+'(\.[^']+)'|\bimport\s+'(\.[^']+)'/g)) {
      const spec = m[1] ?? m[2] ?? m[3];
      walk(relative('.', join(dirname(file), spec)).split('\\').join('/'));
    }
  };
  walk(entry);
  return out;
}
export const RELAY_GRAPH = graph('server/src/index.js');

/** A version bump is `sed world<N>/world<N+1>` over nine test files - RUN IT WITH THIS FILE EXCLUDED, or it
 *  rewrites a row's KEY and relabels bytes already deployed (AUDIT SLAM / SLAM9 did exactly that, and this pin caught it).
 *  Every relay this repo has shipped a law for, and the sha256 of its law that IS it (see `graph` for what the law is).
 *  Append; never edit an existing row - an old row is a historical fact about bytes that have already been deployed. */
const LAW = {
  world69: '27da57b0787d8e18e93dea8358614d9af2e9c65133774755f39960e0ec8f89de',   // SLAM8: a keepalive is never tiered; turn counts what was relayed
  world70: '06cb8eb45de961f9756a71a3cfba19fd84e3a3e7a5217d5e3798e3b11cf4ebed',   // SLAM9: the who budget derived from the socket gates, spent before the scan
  world71: '37bfb4d0bc508775233bcbabbe4bbd7b1b4dc4fccd148e9a17c72fba0dd0e877',   // SLAM10: the far tier bucketed by the listener's id, stable under movement
  world72: 'de19e038912ea8e2e0568923bcf398b86ea2c80c173051129c0ece93bf6efa51',   // SLAM11: the memory push and the act fan borrow against their budgets and land whole
  world73: 'c12e8b6497602a53eead0f4b7abb41a0f6b65be217e174e9ed11c0244a9362ba',   // SLAM13: the keepalive floor, the sender's act share, the memory a listener at a time, the yaw seam, the version in the welcome (first row over the import graph)
  world74: 'f09ab5bdcc836a30fe540d4558a7d0a6c1c933130d9db4d61d5e86c896b55595',   // MERGE (SLAM13 + SRV-N/CHAT-G onto main): one `v` on every welcome, last; the chat's third gate reaches nameFilter.js
  world75: '4587d8fa5adbfc5df062feb6831c1d191ac0563b7312d4bff7d311aa00093cac',   // SLAM15: a stop is heard whole, under the keepalive's floor
  world76: '6f7d8d11d5c055d02fadc70935d9951b3c99732f8b59c9f9f4b72363b873781f',   // LOCALDEV1: the worker entry no longer exports the version string (workerd refused the bundle locally)
};

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url));

test('SLAM8: RELAY_VERSION names exactly one relay law - change the worker or the wire without bumping it and this fails (mutants: the relay edited under a version already shipped, which is SLAM5 verbatim; a row rewritten in place, which relabels bytes that are already deployed)', () => {
  // MERGE onto main (SRV-N / CHAT-G): wire.js reaches net/nameFilter.js now - the chat's third gate - and this pin caught the graph growing, as it is for
  assert.deepEqual(RELAY_GRAPH, ['server/src/index.js', 'server/src/relay.js', 'src/net/wire.js', 'src/world/mat4.js', 'src/net/nameFilter.js'], 'the bundle the worker is: a new file here is a new law, and this row says so until it is written down');
  const h = createHash('sha256');
  for (const f of RELAY_GRAPH) h.update(rd(f));
  const hash = h.digest('hex');
  assert.ok(LAW[RELAY_VERSION], `RELAY_VERSION is '${RELAY_VERSION}' and this file has no law recorded for it - add the row`);
  assert.equal(hash, LAW[RELAY_VERSION],
    `THE RELAY'S LAW CHANGED UNDER '${RELAY_VERSION}'.\n`
    + `  Bump RELAY_VERSION in src/net/wire.js and add a row here in the SAME commit:\n`
    + `      ${'<new version>'}: '${hash}',\n`
    + `  /health is the only pre-flight check the event has, and it has to mean something.`);
  assert.equal(new Set(Object.values(LAW)).size, Object.keys(LAW).length, 'two versions cannot name the same bytes');
  assert.ok(/^world\d+$/.test(RELAY_VERSION), 'the shape law (nine test files hard-code this spelling)');
});
