// SRV-N (2026-09-17): THE RELAY'S VERSION, ASKED IN A WAY THAT STAYS TRUE.
//
// NINE separate pins asserted `RELAY_VERSION === 'world66'` by hand -
// and the count is the point: the first five were found by bumping the
// relay and reading the red, and the other four only turned up on the
// NEXT full run, because five of the nine live in suites the first run
// had already passed. Nobody knew there were nine.
//
// Each was written by a slice that had just bumped the relay, and each
// meant "MY slice bumped it" - a statement that stops being true the
// moment the next slice bumps it again. So every relay-changing slice
// since has had to walk nine files and retype one number, and the drift
// this guarantees is already in the tree: `auditworld6biiic.test.js`'s
// test NAME still said "the relay says world64" over an assertion that
// had been retyped to 'world66' twice.
//
// That is "a rule enforced by an enumeration is a rule enforced by
// memory", and the enumeration was nine copies of a moving target.
//
// What those pins actually want is MONOTONIC: the relay is at or past
// the deploy my slice shipped. That is permanently true once it is true,
// it fails on a downgrade, on a deleted constant and on a version that
// stops being a deploy name at all - and it needs no retyping ever
// again.
//
// It is deliberately NOT "the version equals RELAY_VERSION", which would
// pass under every mutation and is the vacuous pin this replaces. A
// slice that needs to prove IT bumped the relay asserts against the
// version that is LIVE (`assert.notEqual(RELAY_VERSION, 'world66')` in
// srvn_updatenotice.test.js), because shipping a client against the
// deploy already serving players is the actual hazard.
import { RELAY_VERSION } from '../src/net/wire.js';   // LOCALDEV1: the worker entry exports handlers alone

/** The deploy's number, or NaN when the name has stopped being one. */
export const relayVersionNumber = () => Number(/^world(\d+)$/.exec(String(RELAY_VERSION ?? ''))?.[1] ?? NaN);

/** True when the relay is at or past deploy `n`. */
export function relayVersionAtLeast(n) {
  const got = relayVersionNumber();
  return Number.isFinite(got) && got >= n;
}
