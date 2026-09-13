// BR1 - DAGGERFALL ENHANCED (2026-09-13, Mac: "I want to rebrand across
// the board as Daggerfall Enhanced ... Daggerfall Enhanced / An
// open-source reimplementation of The Elder Scrolls II: Daggerfall. We
// need to tackle any javascript mention across the website, game, and
// note this in the bible").
//
// THE NAME HAD NO PIN AT ALL. The rebrand touched nine surfaces - the
// landing page's title, wordmark and cards, the game page, the PWA
// manifest, the Electron shell's product name and window title, the
// About panel, the two document.title writers - and the whole suite
// stayed green through every one of them, which is the definition of an
// unguarded law. A name that lives in nine files and is checked in none
// drifts the moment somebody edits eight.
//
// So this file is the name's one home. There is no brand module to
// import because three of the surfaces are static HTML and one is a
// JSON manifest; the constants below are the source, and every surface
// is asserted against them.
//
// It also pins what did NOT change, and why. The GitHub repository
// (Lattymoy/daggerfall-js-source), the live domain (daggerfalljs.dev)
// and the desktop app's identifier (dev.daggerfalljs.app) still carry
// the old spelling. Those are not branding, they are keys other systems
// hold: renaming the repo breaks every link in the bible and every
// release URL, changing the domain breaks the site, and changing the
// appId orphans every installed copy from its updates - an install-over
// becomes a second app beside the first. Each is a move outside this
// tree, so each is pinned as deliberately unchanged rather than left to
// look like an oversight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The name, and the one sentence that says what it is. */
const NAME = 'Daggerfall Enhanced';
const TAGLINE = 'An open-source reimplementation of The Elder Scrolls II: Daggerfall';

test('BR1: every surface the player reads carries the one name', () => {
  const landing = read('index.html');
  assert.match(landing, new RegExp(`<title>${NAME}</title>`), 'the landing page\'s title');
  assert.match(landing, new RegExp(`<meta property="og:title" content="${NAME}" />`), 'and what a link preview shows');
  // The wordmark is one word over a tracked sub-line - the shape ES1's
  // door has always had, with the sub-line's letter-spacing pinned in
  // landing.test.js. Only the word changed.
  assert.match(landing, /<h1 class="wordmark">Daggerfall<small>Enhanced<\/small><\/h1>/, 'the wordmark');
  // THE WORDMARK SPLITS THE NAME ACROSS TWO ELEMENTS, so no adjacency
  // sweep can ever see it whole: the front door rendered DAGGERFALL over
  // a tracked sub-line reading JAVASCRIPT for the length of the rebrand
  // with `git grep 'Daggerfall JavaScript'` finding nothing. Every
  // wordmark is therefore pinned STRUCTURALLY - the sub-line's own text,
  // wherever the halves live.
  assert.match(read('src/ui/enhancedMenu.js'), /const mark = el\('h1', 'px-wordmark', 'Daggerfall'\);\s*\n\s*mark\.append\(el\('small', null, 'Enhanced'\)\);/,
    'the IN-GAME wordmark, which is the first thing a player sees');
  for (const proto of ['menu-pixel.html', 'menu-redesign.html']) {
    assert.match(read(proto), /<h1 class="wordmark">Daggerfall<small>Enhanced<\/small><\/h1>/, `${proto}'s wordmark`);
  }
  assert.match(landing, new RegExp(`<span>${NAME}</span>`), 'and the footer');
  assert.match(read('play/index.html'), new RegExp(`<title>${NAME}</title>`), 'the game\'s own page');

  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.name, NAME, 'the PWA\'s name');
  assert.equal(manifest.short_name, 'Daggerfall', 'the home-screen label stays the short one - it sits under an icon');

  const app = JSON.parse(read('app/package.json'));
  assert.equal(app.productName, NAME, 'the desktop shell');
  assert.equal(app.build.productName, NAME, 'and what electron-builder stamps into the installer');
  assert.match(app.build.artifactName, /^DaggerfallEnhanced-/, 'and the download\'s filename');

  const mainCjs = read('app/main.cjs');
  assert.match(mainCjs, new RegExp(`title: '${NAME}',`), 'the desktop window title');
  assert.match(mainCjs, new RegExp(`${NAME} v\\$\\{app\\.getVersion\\(\\)\\} is the latest release`), 'and the up-to-date dialog');

  assert.match(read('src/main.js'), new RegExp(`document\\.title = \`${NAME} - \\$\\{msg\\}\``), 'the loading title');
  const ds = read('src/scenes/dataSource.js');
  assert.match(ds, new RegExp(`document\\.title = '${NAME} - close other game tabs to continue'`), 'the second-tab title');
  assert.match(ds, new RegExp(`<h2 style="margin-top:0">${NAME}</h2>`), 'and the second-tab panel');

  assert.match(read('README.md'), new RegExp(`^# ${NAME}\\n`), 'the repository\'s own first line');
});

test('BR1: the tagline is one sentence, and it is the same sentence everywhere', () => {
  // The landing page, the manifest, the About panel and the README all
  // answer "what is this" - and before BR1 they answered it four ways,
  // one of which ("a 1:1 JavaScript port of Daggerfall") named the
  // implementation language as if it were the product.
  assert.ok(read('index.html').includes(TAGLINE), 'the landing page\'s description');
  assert.ok(JSON.parse(read('public/manifest.webmanifest')).description.startsWith(TAGLINE), 'the PWA\'s');
  assert.ok(read('src/ui/enhancedMenu.js').includes(`'${TAGLINE}.'`), 'the About panel\'s');
  assert.ok(read('README.md').includes('an open-source reimplementation of The Elder Scrolls\nII: Daggerfall'), 'and the README\'s, wrapped');
  assert.match(read('src/ui/enhancedMenu.js'), new RegExp(`el\\('h3', null, '${NAME}'\\)`), 'the About panel names the product');
});

test('BR1: no surface still says the old name', () => {
  // git grep, so the sweep is over what is TRACKED - dist/ is a build
  // output and node_modules is not ours.
  // git grep exits 1 when it finds NOTHING, which is the passing case.
  let hits = '';
  try {
    hits = execFileSync('git', ['grep', '-n', '-E', 'Daggerfall ?JavaScript|DaggerfallJS|Daggerfall JS\\b', '--', ':!bible', ':!test/brand.test.js'],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    assert.equal(e.status, 1, `git grep failed: ${e.stderr || e.message}`);
  }
  assert.equal(hits, '', `the old name survives:\n${hits}`);

  // ...and the split form the adjacency sweep above is blind to.
  let split = '';
  try {
    split = execFileSync('git', ['grep', '-n', '-E', "<small>JavaScript</small>|el\\('small', null, 'JavaScript'\\)", '--', ':!test/brand.test.js'],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    assert.equal(e.status, 1, `git grep failed: ${e.stderr || e.message}`);
  }
  assert.equal(split, '', `a wordmark still spells the old name across two elements:\n${split}`);
});

test('BR1: what the rebrand deliberately did NOT touch, and why', () => {
  // THE LANGUAGE IS NOT THE BRAND, but it is still the language. A
  // comment that explains a C# integer overflow a JavaScript port gets
  // wrong by default is a true statement about the implementation, and
  // rewriting it to avoid the word would make the source lie about what
  // it is. Same for MIME types. The sweep above is scoped to the
  // PRODUCT NAME for exactly this reason.
  assert.match(read('test/potions.test.js'), /the half a JS port gets wrong by default/,
    'a technical statement about the language survives the rebrand');
  // And a QUOTE is a quote. TI2's header quotes Mac asking to "enhance
  // the mobile element of DFJS" - his words, at the time he said them.
  assert.match(read('src/ui/touchLook.js'), /element of DFJS in terms of camera movement/,
    'the owner\'s own words are not edited to match a later name');

  // THE KEYS OTHER SYSTEMS HOLD. Each of these is the old spelling on
  // purpose; changing one here without the matching move outside the
  // tree breaks something live, so each fails loudly instead.
  assert.match(read('app/package.json'), /"appId": "dev\.daggerfalljs\.app"/,
    'the appId is an INSTALL IDENTITY - change it and every installed copy stops seeing updates and an install-over leaves two apps');
  assert.match(read('app/package.json'), /"homepage": "https:\/\/daggerfalljs\.dev\/"/,
    'the domain is live - it moves with DNS, not with a commit');
  assert.match(read('app/main.cjs'), /api\.github\.com\/repos\/Lattymoy\/daggerfall-js-source\/releases\/latest/,
    'the releases API is the REPOSITORY\'s name - a rename redirects, but the bible\'s links and every past release URL are written against this one');
  assert.equal(JSON.parse(read('package.json')).name, 'daggerfall-js-source', 'and the package name follows the repository');
  assert.match(read('src/systems/modSettings.js'), /const STORE_KEY = 'dfjs-mod-settings';/,
    'the mod settings key is a LIVE localStorage key - rename it and every player silently loses the mods they had turned on');
});
