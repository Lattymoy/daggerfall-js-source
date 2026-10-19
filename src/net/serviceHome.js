// @ts-check
// DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): THE SERVICES A BUILD CALLS HOME.
//
// A build is the players' unless it was made for the dev environment. `.github/workflows/dev-deploy.yml` builds main
// with the dev environment's relay and account service named - VITE_DFO_RELAY and VITE_DFO_ACCOUNTS, which Vite reads
// as it builds and writes into the bundle - and every tab of that build calls them home, never the players'. A release,
// a desktop build and a node test name neither, so they keep the players' services: DEFAULT_SERVER (online.js) and
// DEFAULT_ACCOUNT_SERVICE (accountClient.js), the constants the production deploys read. Each module checks its own
// value with its own law (online.js's relayUrl, accountClient.js's SERVICE_URL), and a value that fails it is no home.
//
// What a tab overrides is still the tab's - `?server=`, the Relay field, a stored service (accountClient.js
// serviceBase): "a test deployment can be pointed at without a build" holds as it did.

/** What Vite stamped into this build: its `VITE_*` variables (none in node, in a Worker, or before a build). Read as
 *  `(import.meta).env` - the one spelling Vite replaces that the type check also takes. */
const stamped = /** @type {Record<string, string|undefined>} */ (/** @type {any} */ (import.meta).env ?? {});

/** The relay a build made for the dev environment calls home, as stamped - or null: the players' relay. */
export const BUILD_RELAY = stamped.VITE_DFO_RELAY || null;
/** The account service a build made for the dev environment calls home, as stamped - or null: the players'. */
export const BUILD_ACCOUNTS = stamped.VITE_DFO_ACCOUNTS || null;
