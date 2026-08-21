// The gate's static-analysis leg (added after the trs/index crash):
// unbound identifiers are invisible to node --check, vite build, and
// headless tests - no-undef catches the whole class.
export default [
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
        // Node 17+ and every browser this port targets. The quest lane
        // uses it for its resource snapshots; without it declared, main
        // was lint-red on twelve call sites.
        structuredClone: 'readonly',
        Image: 'readonly', ImageData: 'readonly', OffscreenCanvas: 'readonly', FileReader: 'readonly',
        WebGL2RenderingContext: 'readonly', AudioContext: 'readonly', createImageBitmap: 'readonly',
        TextDecoder: 'readonly', TextEncoder: 'readonly', DecompressionStream: 'readonly', Response: 'readonly', Blob: 'readonly',
        KeyboardEvent: 'readonly', Touch: 'readonly', TouchEvent: 'readonly', innerWidth: 'readonly',
      },
    },
    rules: { 'no-undef': 'error' },
  },
];
