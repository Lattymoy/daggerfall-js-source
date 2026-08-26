// THE BUILD MOVED WHILE THE PAGE WAS OPEN.
//
// A player got `boot failed: Failed to fetch dynamically imported
// module` on the deployed site. The build was sound - a fresh one
// fetches every chunk - and the cause was between deploys: index.html
// hard-references seventeen hashed chunk URLs, every deploy renames
// eight of them, GitHub Pages DELETES the old artifact, and main is
// redeployed several times a day. A cached index is a map of a build
// that is gone.
//
// The recovery is a reload. What is pinned here is the ladder that
// decides on one, and the two ways it can go wrong: not recognising a
// browser's phrasing, and reloading twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isStaleChunk, staleChunkAction, STALE_CHUNK_MESSAGES, STALE_CHUNK_TEXT, RELOAD_KEY,
} from '../src/systems/staleChunk.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('staleChunk: every browser that can say it is heard', () => {
  // FOUR VENDORS, four sentences, one event. A check that knew only
  // Chrome's phrasing would leave Firefox and Safari players sitting
  // on the dead page - and the reporter's console is the only place
  // the difference shows.
  assert.ok(isStaleChunk(new Error(
    'Failed to fetch dynamically imported module: https://x/assets/enhancedChargen-BDgBQOZ4.js')));
  assert.ok(isStaleChunk(new Error('error loading dynamically imported module')));
  assert.ok(isStaleChunk(new Error('Importing a module script failed.')));
  assert.ok(isStaleChunk(new Error('Unable to preload CSS for /assets/index-abc.css')));
  // ...and the list is the thing that answers, not a regex written
  // twice - so a vendor added there is a vendor heard here.
  for (const m of STALE_CHUNK_MESSAGES) assert.ok(isStaleChunk(new Error(m)), m);
  assert.equal(STALE_CHUNK_MESSAGES.length, 4);

  // CASE DOES NOT DECIDE IT. Firefox lowercases its first word where
  // Chrome capitalises, and that is not a difference worth failing on.
  assert.ok(isStaleChunk(new Error('FAILED TO FETCH DYNAMICALLY IMPORTED MODULE')));

  // Everything else is somebody else's problem, and must stay so: the
  // data-seam failures below have their own recovery in main.js, and
  // swallowing one into a reload would spin a player who needs to
  // re-pick their game folder.
  assert.equal(isStaleChunk(new Error('BSA file has an invalid DirectoryType.')), false);
  assert.equal(isStaleChunk(new Error('INVE00I0.IMG is not in the stored set - re-pick')), false);
  assert.equal(isStaleChunk(new Error('WebGL2 unavailable')), false);
  // and no error at all is not a chunk error
  assert.equal(isStaleChunk(null), false);
  assert.equal(isStaleChunk(undefined), false);
  assert.equal(isStaleChunk({}), false);
  // a bare string is accepted, because not everything thrown is an Error
  assert.ok(isStaleChunk('Failed to fetch dynamically imported module'));
});

test('staleChunk: the reload is spent ONCE, and then it speaks', () => {
  const stale = new Error('Failed to fetch dynamically imported module: /assets/main-x.js');
  const other = new Error('BSA file has an invalid DirectoryType.');

  // first time: fetch the current build
  assert.equal(staleChunkAction(stale, { reloaded: false }), 'reload');
  // second time: the reload did not mend it, so RELOADING AGAIN is an
  // infinite loop pointed at the player - a page that keeps blinking
  // with no error to report. Words instead.
  assert.equal(staleChunkAction(stale, { reloaded: true }), 'explain');
  // and a failure that is not this never takes the reload at all,
  // whichever state the flag is in
  assert.equal(staleChunkAction(other, { reloaded: false }), 'rethrow');
  assert.equal(staleChunkAction(other, { reloaded: true }), 'rethrow');
  // no options is a first attempt - the caller that forgets to pass
  // the flag must not silently lose its recovery
  assert.equal(staleChunkAction(stale), 'reload');

  // THE WORDS ARE ABOUT THE PLAYER, not about JavaScript. "Failed to
  // fetch dynamically imported module" is a sentence about a module
  // graph; this one has to tell someone what happened and what to
  // press.
  assert.match(STALE_CHUNK_TEXT, /older version/i);
  assert.match(STALE_CHUNK_TEXT, /hard refresh/i);
  assert.ok(!/dynamically imported module/i.test(STALE_CHUNK_TEXT),
    'the player is being shown the browser\'s sentence again');
});

test('staleChunk: main.js spends the reload once and gives it back', () => {
  const src = read('src/main.js');
  // the ladder is ASKED, not re-derived at the call site
  assert.match(src, /staleChunkAction\(e, \{ reloaded: reloadTried\(\) \}\)/);
  assert.match(src, /if \(act === 'reload' && rememberReload\(\)\) \{/,
    'a reload that could not be remembered must not happen - that is the loop');
  // A BOOT THAT WORKED GIVES THE RELOAD BACK. Without this the flag
  // outlives the problem and the NEXT deploy finds the retry spent.
  const then = src.slice(src.indexOf('boot().then('), src.indexOf('}).catch('));
  assert.match(then, /removeItem\(RELOAD_KEY\)/, 'the flag is never cleared, so it is spent forever');
  // every storage touch is shielded: sessionStorage THROWS in some
  // privacy modes, and a storage failure must not become the boot
  // failure
  const guard = src.slice(src.indexOf('const reloadTried'), src.indexOf('boot().then('));
  assert.equal((guard.match(/try \{/g) ?? []).length, 2, 'an unshielded storage read or write');
  assert.match(guard, /catch \{ return true; \}/,
    'a page that cannot remember it already tried must assume it did');
  // and the OTHER recovery still runs - the re-pick path is a
  // different failure with a different answer
  assert.match(src, /re-pick\|not in the stored/);
});

test('staleChunk: the key is a TAB\'s memory, not a machine\'s', () => {
  // sessionStorage, deliberately: a player who hits this on Tuesday
  // must still get their free reload on Wednesday.
  assert.match(read('src/main.js'), /globalThis\.sessionStorage/);
  assert.ok(!/globalThis\.localStorage\?\.getItem\(RELOAD_KEY\)/.test(read('src/main.js')));
  assert.equal(typeof RELOAD_KEY, 'string');
  assert.ok(RELOAD_KEY.length > 0);
});
