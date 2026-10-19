// @ts-check
/// <reference types="vite/client" />
// DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): THE SERVICES A BUILD CALLS HOME.
//
// A build is the players' unless it was made for the dev environment. `.github/workflows/dev-deploy.yml` builds main
// with the dev environment's relay and account service named - VITE_DFO_RELAY and VITE_DFO_ACCOUNTS, which Vite reads
// as it builds and writes into the bundle - and every tab of that build calls them home, never the players'. A release,
// a desktop build and a node test name neither, so they keep the players' services: DEFAULT_SERVER (online.js) and
// DEFAULT_ACCOUNT_SERVICE (accountClient.js), the constants the production deploys read. Each module checks its own
// value with its own law (online.js's relayUrl, accountClient.js's SERVICE_URL).
//
// AUDIT RELEASE-FLOW E1: A STAMP THE LAW REFUSES IS NEVER THE PLAYERS' SERVICE. It was: a refused stamp fell back to the
// players' relay and account service, so a dev build with a stamp mistyped - plain ws:// inside the network, a stray
// newline - played main's unreleased code against them, signed in with real accounts. Now a refused stamp stops every
// tab of the build, said (online.js homeServerOf, accountClient.js homeAccountServiceOf), and dev-deploy.yml asks both
// laws before it builds anything.
//
// What a tab overrides is still the tab's - `?server=`, the Relay field, a stored service (accountClient.js
// serviceBase): "a test deployment can be pointed at without a build" holds as it did.

// AUDIT RELEASE-FLOW E2: EACH STAMP READ BY ITS OWN NAME - `import.meta.env.VITE_DFO_RELAY`, the spelling Vite writes in
// as it builds and serves in its dev server alike (vite/client's types above take it). The whole `env` object, read
// through a cast, was never served by the dev server - `npm run dev` with a stamp called the players' services - and in a
// build wrote every `VITE_*` variable of the builder's environment into the bundle. In node, a Worker or a test there is
// no `import.meta.env`, so no stamp.

/** The relay a build made for the dev environment calls home, as stamped - or null: none stamped, the players'. */
export const BUILD_RELAY = import.meta.env?.VITE_DFO_RELAY ?? null;
/** The account service a build made for the dev environment calls home, as stamped - or null: none stamped, the players'. */
export const BUILD_ACCOUNTS = import.meta.env?.VITE_DFO_ACCOUNTS ?? null;
