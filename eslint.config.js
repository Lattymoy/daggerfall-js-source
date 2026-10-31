// The gate's static-analysis leg (added after the trs/index crash):
// unbound identifiers are invisible to node --check, vite build, and
// headless tests - no-undef catches the whole class.
import { readFileSync } from 'node:fs';

/** The folders the formatter owns (LEGIBLE 3). */
const FORMATTED = JSON.parse(readFileSync(new URL('./tools/formatted.json', import.meta.url), 'utf8'));

/** LEGIBLE 4 (AUDIT, 2026-10-31): the files that still hold a comma sequence in its own parentheses, `(act(), answer)`,
 *  each at its count. test/tooling/legible4_sequences.test.js holds each count exactly, so the list only shrinks. */
export const SEQUENCES_HELD = Object.freeze({
  'src/combat/weapon/weaponRig.js': 1,
  'src/net/gate/gateBrain.js': 1,
  'src/render/farRing.js': 1,
  'src/render/underwaterFog.js': 1,
  'src/scenes/arena/arenaBouts.js': 1,
  'src/scenes/comeSailAway/shipLiveryPaint.js': 1,
  'src/scenes/dragonHost.js': 1,
  'src/scenes/dungeonContext.js': 1,
  'src/scenes/eliteGates/egSpan.js': 1,
  'src/scenes/homeYards.js': 1,
  'src/scenes/huntHost.js': 1,
  'src/scenes/world.js': 1,
  'src/scenes/worldModes.js': 4,
  'src/systems/dragon/dragonFlight.js': 1,
  'src/systems/item/itemTransfer.js': 1,
  'src/systems/legacy/family.js': 1,
  'src/systems/loot/lootRarity.js': 1,
  'src/systems/naval/navalAI.js': 1,
  'src/systems/quickslots.js': 1,
  'src/systems/revenant/revenant.js': 3,
  'src/ui/input.js': 19,
  'src/ui/listPicker.js': 1,
  'src/ui/marketTab.js': 1,
  'src/world/prefabColliders.js': 1,
  'tools/grassLookProbe.mjs': 1,
  'tools/tellDuel.mjs': 1,
});

export default [
  {
    // ONLINE1 / AUDIT ONLINE A13: the relay's Worker is linted with the tree - its globals are the runtime's
    // ACC1b: and the ACCOUNT Worker beside it - a second Worker whose
    // globals are the same runtime's, so it shares this block rather
    // than growing a near-identical one below it.
    files: ['server/src/**/*.js', 'server-account/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: { console: 'readonly', Response: 'readonly', Request: 'readonly', URL: 'readonly', WebSocketPair: 'readonly', WebSocketRequestResponsePair: 'readonly', crypto: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', atob: 'readonly', btoa: 'readonly', fetch: 'readonly', AbortSignal: 'readonly', URLSearchParams: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },   // DISCORD-GATES: the hub posts to a Discord webhook; PATREON-LINK: the account service speaks Patreon's OAuth forms; SCALE5b: a room's batch of poses is flushed on a timer (a Durable Object's own, while it is awake)
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }], 'no-dupe-keys': 'error', 'no-dupe-class-members': 'error' },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly', window: 'readonly', document: 'readonly',
        indexedDB: 'readonly', localStorage: 'readonly', location: 'readonly',
        addEventListener: 'readonly', removeEventListener: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        performance: 'readonly', fetch: 'readonly', navigator: 'readonly',
        globalThis: 'readonly', URLSearchParams: 'readonly', URL: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', alert: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        // AUDIT-SRVN F3: the build poll cancels a request on a deadline
        // rather than leaking the socket. Node 17.3+ and every browser
        // this port targets; the one call site guards for its absence.
        AbortSignal: 'readonly',
        // Node 17+ and every browser this port targets. The quest lane
        // uses it for its resource snapshots; without it declared, main
        // was lint-red on twelve call sites.
        structuredClone: 'readonly',
        Image: 'readonly', ImageData: 'readonly', OffscreenCanvas: 'readonly', FileReader: 'readonly',
        WebGL2RenderingContext: 'readonly', AudioContext: 'readonly', createImageBitmap: 'readonly',
        TextDecoder: 'readonly', TextEncoder: 'readonly', DecompressionStream: 'readonly', Response: 'readonly', Blob: 'readonly',
        // REALM-GZIP: a realm save rides packed (src/net/realm/realmSaveCodec.js) - every browser this port targets, Node 18+ and
        // workerd; the codec asks for it before it packs.
        CompressionStream: 'readonly',
        KeyboardEvent: 'readonly', Touch: 'readonly', TouchEvent: 'readonly', innerWidth: 'readonly',
        // RA1: the road bake's module Worker. `new Worker(new URL(...))`
        // must stay in exactly that spelling - Vite's static analysis
        // matches the bare constructor to bundle the worker entry, so
        // `globalThis.Worker` would lint clean and break the build.
        Worker: 'readonly',
      },
    },
    // AUDIT 26's duplicate-key class: `{ toggleRest: A, ..., toggleRest: B }`
    // parses, runs, and silently discards A - node --check, vite build and
    // headless tests all see a valid object, so a complete code path can be
    // dead in main for months. no-dupe-keys catches every instance at lint
    // time. no-dupe-class-members is the same defect one scope up (the later
    // method wins); no-unsafe-negation catches `!a in b` / `!a instanceof B`,
    // where the negation binds to the wrong operand and the test always
    // reads false. All three are clean on the tree as of this change.
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unsafe-negation': 'error',
    },
  },
  {
    // AUDIT 68 X2: tests, tools, scripts, the desktop shell and these
    // configs, held to the STRUCTURAL rules (no globals list needed) - a
    // dropped fixture key, a reassigned const, dead code after a return.
    files: ['test/**/*.{js,mjs}', 'tools/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'app/**/*.{cjs,js}', '*.config.js'],
    languageOptions: { ecmaVersion: 'latest' },
    // these files carry disable comments for rules only the src block runs
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unsafe-negation': 'error',
      'no-const-assign': 'error',
      'no-unreachable': 'error',
    },
  },
  {
    // LEGIBLE 4 (bible/01-Overview/Readability-Arc.md): no comma sequence in shipped code - `(a(), b)` hides a
    // statement inside an expression - parenthesized or not, but in the files held above.
    files: ['src/**/*.js', 'server/src/**/*.js', 'server-account/src/**/*.js', 'tools/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}'],
    rules: { 'no-sequences': ['error', { allowInParentheses: false }] },
  },
  {
    // LEGIBLE 4: a held file keeps its parenthesized sequences at their count; a bare one is refused there too.
    files: Object.keys(SEQUENCES_HELD),
    rules: { 'no-sequences': ['error', { allowInParentheses: true }] },
  },
  {
    // LEGIBLE 4: one statement a line in the folders and files the formatter owns (tools/formatted.json, LEGIBLE 3).
    files: FORMATTED.map((entry) => (/\.m?js$/.test(entry) ? entry : `${entry}/*.{js,mjs}`)),
    rules: { 'max-statements-per-line': ['error', { max: 1 }] },
  },
  // generated and gitignored trees the lint paths above reach into
  { ignores: ['app/release/**', 'tools/parity/dfu/**', 'tools/parity/cs/api/**', 'tools/parity/out/**'] },
];
