// THE CRASH LINE. Pulled out of main.js so it can be pinned: main.js
// is the entry point and runs `addEventListener`/`document` at import,
// so nothing headless can load it, and this decision was wrong for a
// year in a way only a real player's screenshot revealed.
//
// The overlay used to print `err.stack` ALONE, which is a
// browser-dependent decision it did not know it was making:
//   V8 (Chrome):        "TypeError: mesh is null\n    at drawMesh (...)"
//   SpiderMonkey (FF):  "drawMesh@https://.../main.js:404:11594"
// V8 folds the message into `stack`; SpiderMonkey does NOT. So every
// crash report from a Firefox player arrived with the single most
// useful line missing - and one did: two frames, no message, no way to
// tell WHAT was null. Compose the head here rather than hoping the
// engine put it there.

/**
 * @param {*} err            the thrown value (an Error, or anything)
 * @param {ErrorEvent} [event]  the window error event, for its coordinates
 * @returns {string} "Name: message" then the frames, never one without the other
 */
export function crashText(err, event = null) {
  // A rejection reason can be ANY value. Only an object may lend a
  // name; a bare string reason is its own message and must not be
  // dressed up as "Error: ..." - the report would then claim a shape
  // the throw did not have.
  const isObj = err !== null && typeof err === 'object';
  const name = isObj ? (err.name ?? '') : '';
  const message = isObj ? (err.message ?? '') : (err == null ? '' : String(err));
  const head = name && message ? `${name}: ${message}` : (message || name || 'unknown error');
  const stack = typeof err?.stack === 'string' ? err.stack : '';
  // Chrome already leads with the message; do not print it twice.
  const frames = stack.startsWith(head) ? stack.slice(head.length).trim() : stack;
  const where = event?.filename ? `\nat ${event.filename}:${event.lineno}:${event.colno}` : '';
  return frames ? `${head}\n${frames}${where}` : `${head}${where}`;
}
