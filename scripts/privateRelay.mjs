// Bundles what a player's PC runs to host a private server (app/lib/privateHost.mjs). The game's relay
// (server/src/index.js, unchanged) goes into dist/private/relay.mjs - IN THE GAME, so a version the game channel
// brings carries the relay its own wire law speaks, and a host never runs a relay older than its guests' game. The
// host module itself (it imports the token law from src/net/identityToken.js) goes into app/private/host.mjs, the
// shell's. Both are build output; `npm run build` runs this after vite.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({ entryPoints: [`${root}server/src/index.js`], outfile: `${root}dist/private/relay.mjs`, bundle: true, format: 'esm', platform: 'neutral', logLevel: 'warning' });
await build({ entryPoints: [`${root}app/lib/privateHost.mjs`], outfile: `${root}app/private/host.mjs`, bundle: true, format: 'esm', platform: 'node', external: ['miniflare'], logLevel: 'warning' });
console.log('private server: dist/private/relay.mjs, app/private/host.mjs');
