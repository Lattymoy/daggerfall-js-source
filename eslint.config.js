// The gate's static-analysis leg (added after the trs/index crash):
// unbound identifiers are invisible to node --check, vite build, and
// headless tests - no-undef catches the whole class.
export default [
  {
    // ONLINE1 / AUDIT ONLINE A13: the relay's Worker is linted with the tree - its globals are the runtime's
    // ACC1b: and the ACCOUNT Worker beside it - a second Worker whose
    // globals are the same runtime's, so it shares this block rather
    // than growing a near-identical one below it.
    files: ['server/src/**/*.js', 'server-account/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: { console: 'readonly', Response: 'readonly', Request: 'readonly', URL: 'readonly', WebSocketPair: 'readonly', WebSocketRequestResponsePair: 'readonly', crypto: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', atob: 'readonly', btoa: 'readonly' },
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
    files: ['test/**/*.{js,mjs}', 'tools/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'app/**/*.cjs', '*.config.js'],
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
  // generated and gitignored trees the lint paths above reach into
  { ignores: ['app/release/**', 'tools/parity/dfu/**', 'tools/parity/cs/api/**', 'tools/parity/out/**'] },
];
