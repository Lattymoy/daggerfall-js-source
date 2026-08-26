// V-DEPLOY: THE VERIFIER'S OWN CORRECTNESS.
//
// tools/verify-deploy.mjs is the one tool that decides whether a push
// actually reached the players, and it had been giving the wrong
// answer for months in one specific, common case: it compared the
// entry chunk's HASH and nothing else, so it could only pass while
// YOUR build tag was the head CI happened to build. Other sessions
// push to main constantly, so the deploy that lands is routinely a
// DESCENDANT of your commit - your work is on the site, the hash is
// somebody else's, and the tool polls for eight minutes and reports
// TIMEOUT. Four cycles were spent re-running it against perfectly
// good deploys before the shape of the bug was worth fixing.
//
// The fix needs the artifact to say what commit it is, so
// vite.config.js stamps <meta name="build-tag"> into every built page
// from the sha scripts/buildTag.mjs already writes into
// src/buildTag.js. This file pins BOTH halves: the stamp, by calling
// the real plugin out of the real config, and the verdict, by handing
// deployVerdict a git oracle it can control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  entryBundle, buildTagOf, deployVerdict,
} from '../tools/verify-deploy.mjs';
import viteConfig from '../vite.config.js';

const page = ({ bundle = 'assets/main-AAAA1111.js', tag = null, extra = '' } = {}) => `<!doctype html>
<html><head><meta charset="utf-8" />${tag === null ? '' : `<meta name="build-tag" content="${tag}">`}
<link rel="modulepreload" crossorigin href="./assets/other-ZZZZ9999.js">${extra}
</head><body><script type="module" crossorigin src="./${bundle}"></script></body></html>`;

test('V-DEPLOY: the entry bundle is the SCRIPT, never a modulepreload link', () => {
  // The preload <link> is written FIRST in real vite output, so a
  // matcher that is not anchored on <script reads the wrong chunk and
  // then waits forever for the site to serve it.
  assert.equal(entryBundle(page({ bundle: 'assets/main-AAAA1111.js' })), 'assets/main-AAAA1111.js');
  assert.equal(entryBundle('<html><head></head><body></body></html>'), null);
});

test('V-DEPLOY: the entry ref is read one directory up, where the game page writes it (U60)', () => {
  // The game sits at /play/ and vite's relative base writes its chunk
  // refs as ../assets/...; the matcher accepting "./" and "/" only read
  // a perfectly good dist/play/index.html as having no entry at all.
  const nested = page().replace('src="./assets/main-AAAA1111.js"', 'src="../assets/main-AAAA1111.js"');
  assert.match(nested, /src="\.\.\/assets\/main-AAAA1111\.js"/, 'the fixture is the nested shape');
  assert.equal(entryBundle(nested), 'assets/main-AAAA1111.js');
  // A build that writes chunk refs from the root keeps working too, so
  // the two kept shapes stay as they were.
  assert.equal(entryBundle(page().replace('src="./assets/', 'src="/assets/')), 'assets/main-AAAA1111.js');
});

test('V-DEPLOY: the build tag is read off the meta, whatever the attribute order', () => {
  assert.equal(buildTagOf(page({ tag: 'c65eb4f' })), 'c65eb4f');
  assert.equal(buildTagOf('<meta content="abc1234" name="build-tag">'), 'abc1234');
  // A page built before the stamp existed carries no tag, and that is
  // the case the exact-hash arm still has to cover.
  assert.equal(buildTagOf(page()), null);
  assert.equal(buildTagOf('<meta name="build-tag" content="">'), null);
  // Not any old meta - a mutant that drops the name check reads the
  // charset and reports the deploy is commit "utf-8".
  assert.equal(buildTagOf('<meta name="viewport" content="width=device-width">'), null);
});

test('V-DEPLOY: an exact chunk match verifies, stamped or not', () => {
  const local = page({ bundle: 'assets/main-BBBB2222.js' });
  const v = deployVerdict({ localHtml: local, liveHtml: local });
  assert.equal(v.kind, 'exact');
  // And it is decided BEFORE the tags are consulted, so an unstamped
  // pair on both sides still passes rather than falling to 'wait'.
  assert.equal(buildTagOf(local), null);
});

test('V-DEPLOY: a DESCENDANT deploy verifies - this is the whole bug', () => {
  const localHtml = page({ bundle: 'assets/main-AAAA1111.js', tag: 'aaaaaaa' });
  const liveHtml = page({ bundle: 'assets/main-CCCC3333.js', tag: 'ddddddd' });
  const asked = [];
  const v = deployVerdict({
    localHtml,
    liveHtml,
    contains: (a, d) => { asked.push([a, d]); return true; },
  });
  assert.equal(v.kind, 'ancestor');
  // The question is asked in ONE direction: is MY commit contained in
  // the DEPLOYED one. Reversed, a stale site passes.
  assert.deepEqual(asked, [['aaaaaaa', 'ddddddd']]);
});

test('V-DEPLOY: a site that does NOT contain the commit keeps waiting', () => {
  const v = deployVerdict({
    localHtml: page({ bundle: 'assets/main-AAAA1111.js', tag: 'aaaaaaa' }),
    liveHtml: page({ bundle: 'assets/main-CCCC3333.js', tag: 'bbbbbbb' }),
    contains: () => false,
  });
  assert.equal(v.kind, 'wait');
});

test('V-DEPLOY: "cannot tell" is not a yes', () => {
  // git exits 128 on a commit this clone has never fetched. A verdict
  // that treats anything-but-false as containment would report
  // VERIFIED against a deploy it knows nothing about.
  const v = deployVerdict({
    localHtml: page({ bundle: 'assets/main-AAAA1111.js', tag: 'aaaaaaa' }),
    liveHtml: page({ bundle: 'assets/main-CCCC3333.js', tag: 'bbbbbbb' }),
    contains: () => null,
  });
  assert.equal(v.kind, 'wait');
  // And with no oracle supplied at all it must not pass either.
  assert.equal(deployVerdict({
    localHtml: page({ bundle: 'assets/main-AAAA1111.js', tag: 'aaaaaaa' }),
    liveHtml: page({ bundle: 'assets/main-CCCC3333.js', tag: 'bbbbbbb' }),
  }).kind, 'wait');
});

test('V-DEPLOY: the same commit serving a different chunk is a DIRTY LOCAL BUILD, and fails', () => {
  // This arm has to stand AHEAD of the ancestry question, because git
  // answers that a commit is an ancestor of itself - so without it,
  // a dist/ built from a dirty tree reports VERIFIED against a deploy
  // that does not contain the uncommitted changes. Which is exactly
  // the lie the whole tool exists to prevent.
  let asked = 0;
  const v = deployVerdict({
    localHtml: page({ bundle: 'assets/main-AAAA1111.js', tag: 'aaaaaaa' }),
    liveHtml: page({ bundle: 'assets/main-CCCC3333.js', tag: 'aaaaaaa' }),
    contains: () => { asked += 1; return true; },
  });
  assert.equal(v.kind, 'dirty');
  assert.equal(asked, 0, 'the ancestry question must not be reachable for one commit against itself');
});

test('V-DEPLOY: an unstamped LIVE page falls back to waiting, never to ancestry', () => {
  // The site can be serving a build made before the stamp landed.
  // There is no commit to compare, so the only honest answer is the
  // old exact-hash behaviour.
  let asked = 0;
  const v = deployVerdict({
    localHtml: page({ bundle: 'assets/main-AAAA1111.js', tag: 'aaaaaaa' }),
    liveHtml: page({ bundle: 'assets/main-CCCC3333.js' }),
    contains: () => { asked += 1; return true; },
  });
  assert.equal(v.kind, 'wait');
  assert.equal(asked, 0);
});

test('V-DEPLOY: no local entry script is a caller error, not a poll', () => {
  assert.equal(deployVerdict({ localHtml: '<html></html>', liveHtml: '' }).kind, 'nolocal');
});

test('V-DEPLOY: the stamp is a real build plugin, wired into the real config', () => {
  const plugin = viteConfig.plugins.find((p) => p?.name === 'build-tag-meta');
  assert.ok(plugin, 'vite.config.js must carry the build-tag-meta plugin');
  assert.equal(plugin.apply, 'build', 'the dev server must not be stamped');
  const sha = readFileSync('src/buildTag.js', 'utf8').match(/'([^']*)'/)?.[1];
  const injected = plugin.transformIndexHtml();
  assert.deepEqual(injected, [{
    tag: 'meta', attrs: { name: 'build-tag', content: sha }, injectTo: 'head',
  }], 'the plugin must stamp the SAME sha scripts/buildTag.mjs wrote');
  // And what it emits has to be readable by the thing that reads it -
  // the two halves are pinned against each other rather than against
  // a hand-written string.
  const html = `<head><meta ${Object.entries(injected[0].attrs)
    .map(([k, val]) => `${k}="${val}"`).join(' ')}></head>`;
  assert.equal(buildTagOf(html), sha);
});

test('V-DEPLOY: importing the tool does not run it', () => {
  // tools/musicNames.mjs reported `# tests 1 / # fail 0` for a file of
  // eleven because importing it hit a top-level process.exit and killed
  // the runner. Reaching this line at all is the proof for this file;
  // the guard itself is pinned so it cannot be deleted quietly.
  const src = readFileSync('tools/verify-deploy.mjs', 'utf8');
  assert.ok(src.includes('import.meta.url === pathToFileURL(process.argv[1]).href'),
    'verify-deploy.mjs must only run main() when it IS the program');
  assert.ok(/if \(process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href\) main\(\);/.test(src),
    'the guard must gate the main() call itself, not merely appear in the file');
});
