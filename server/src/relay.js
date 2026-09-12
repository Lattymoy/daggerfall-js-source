// ONLINE1 (2026-09-12): THE RELAY'S LAW - one home, the port's own
// src/net/wire.js (AUDIT ONLINE B7/B8: what the relay refuses the client
// never sends, and what the relay sends the client checks by the same
// law). wrangler bundles the relative import; test/online_relay.test.js
// executes it through this door.
export * from '../../src/net/wire.js';
