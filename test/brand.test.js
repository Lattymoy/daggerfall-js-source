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
//
// BR4 - DAGGERFALL ONLINE (2026-09-27, Mac: "I want to rebrand Daggerfall:
// Enhanced to Daggerfall Online across every surface of the game and
// website. The logo attached is the new temporary logo ... (Don't forget
// about the intro video also)"). The same surfaces again, pinned HERE
// again: NAME below is the only line that says what the product is called,
// and the old name is swept for in both its whole and its split forms.
// The logo is Mac's own transparent cut, drawn with no blend mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The name, and the one sentence that says what it is. */
const NAME = 'Daggerfall Online';
const TAGLINE = 'An open-source reimplementation of The Elder Scrolls II: Daggerfall';

test('BR1: every surface the player reads carries the one name', () => {
  const landing = read('index.html');
  assert.match(landing, new RegExp(`<title>${NAME}</title>`), 'the landing page\'s title');
  assert.match(landing, new RegExp(`<meta property="og:title" content="${NAME}" />`), 'and what a link preview shows');
  // BR3 (Mac, 2026-09-14): the landing page's wordmark is TYPE again - one
  // word over a tracked sub-line, the shape ES1's door has always had -
  // after BR2's one day as an uploaded logo.
  assert.match(landing, /<h1 class="wordmark">Daggerfall<small>Online<\/small><\/h1>/, 'the wordmark');
  assert.doesNotMatch(landing, /<img\s/, 'and no image stands in for it (BR3)');
  // THE WORDMARK SPLITS THE NAME ACROSS TWO ELEMENTS, so no adjacency
  // sweep can ever see it whole: the front door rendered DAGGERFALL over
  // a tracked sub-line reading JAVASCRIPT for the length of the rebrand
  // with `git grep 'Daggerfall JavaScript'` finding nothing. Every
  // wordmark is therefore pinned STRUCTURALLY - the sub-line's own text,
  // wherever the halves live.
  // INTRO2 (Mac, 2026-09-18): his supplied logo replaces the in-game
  // wordmark. The landing page and archived prototypes keep BR3's type.
  assert.match(read('src/ui/enhancedMenu.js'), /mark\.append\(brandMark\(\)\)/,
    'the front door uses the same accessible mark as the cinematic');
  assert.match(read('src/ui/brandMark.js'), new RegExp(`'The Elder Scrolls II: ${NAME}'`), 'the mark\'s own alt text');
  for (const proto of ['menu-pixel.html', 'menu-redesign.html']) {
    assert.match(read(proto), /<h1 class="wordmark">Daggerfall<small>Online<\/small><\/h1>/, `${proto}'s wordmark`);
  }
  assert.match(landing, new RegExp(`<span>${NAME}</span>`), 'and the footer');
  assert.match(read('play/index.html'), new RegExp(`<title>${NAME}</title>`), 'the game\'s own page');

  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.name, NAME, 'the PWA\'s name');
  assert.equal(manifest.short_name, 'Daggerfall', 'the home-screen label stays the short one - it sits under an icon');

  const app = JSON.parse(read('app/package.json'));
  assert.equal(app.productName, NAME, 'the desktop shell');
  assert.equal(app.build.productName, NAME, 'and what electron-builder stamps into the installer');
  assert.match(app.build.artifactName, /^DaggerfallOnline-/, 'and the download\'s filename');

  const mainCjs = read('app/main.cjs');
  assert.match(mainCjs, new RegExp(`title: '${NAME}',`), 'the desktop window title');
  assert.match(mainCjs, new RegExp(`${NAME} v\\$\\{app\\.getVersion\\(\\)\\} is the latest release`), 'and the up-to-date dialog');

  assert.match(read('src/main.js'), new RegExp(`document\\.title = \`${NAME} - \\$\\{msg\\}\``), 'the loading title');
  const ds = read('src/scenes/dataSource.js');
  assert.match(ds, new RegExp(`document\\.title = '${NAME} - close other game tabs to continue'`), 'the second-tab title');
  assert.match(ds, new RegExp(`<h2 style="margin-top:0">${NAME}</h2>`), 'and the second-tab panel');

  assert.match(read('src/ui/pauseWindow.js'), new RegExp(`const ver = \\\`${NAME} \\$\\{BUILD_TAG\\}\\\`;`),
    'the PAUSE SCREEN\'s version line - the whole of the branding surface a player reads in game, and the working name sat on it');
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
  // THE ONE EXEMPTION, and it is a path not a name: the desktop shell's
  // storage root keeps the folder the shipped versions created, so the
  // old spelling appears there on purpose. It is pinned below.
  const survivors = hits.split('\n').filter((l) => l && !/appData/.test(l)).join('\n');
  assert.equal(survivors, '', `the old name survives:\n${survivors}`);

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
  // AND THE ONE THE REBRAND ITSELF BROKE FIRST. Electron derives
  // app.getPath('userData') from app.getName(), which prefers
  // productName - so renaming the product moved <appData>/Daggerfall
  // JavaScript out from under every existing install: saves, Prefs, and
  // config.json with the ARENA2 path in it. The storage root is pinned
  // to the folder that already exists, whatever the product is called.
  assert.match(read('app/main.cjs'),
    /else app\.setPath\('userData', path\.join\(app\.getPath\('appData'\), 'Daggerfall JavaScript'\)\);/,
    'the desktop shell keeps writing where it already wrote - a rebrand is a name, not a migration');
});

test('BR4: the intro and the doors carry the name too', () => {
  const intro = read('src/ui/introScreen.js');
  assert.match(intro, new RegExp(`host\\.setAttribute\\('aria-label', '${NAME} introduction'\\)`), 'what a screen reader hears as the film opens');
  assert.match(intro, new RegExp(`'intro-title-fallback', '${NAME}'`), 'and the title the film draws if the logo cannot load');
  assert.match(read('src/ui/enhancedMenu.js'), new RegExp(`homeMark\\.setAttribute\\('aria-label', '${NAME} — main menu'\\)`), 'the masthead\'s way home');
  assert.match(read('src/systems/saveTransfer.js'), /TRANSFER_ZIP_NAME = 'DaggerfallOnline-Saves\.zip'/, 'the saves a player carries away are named for it');
  assert.match(read('src/systems/customClass.js'), new RegExp(`That is not a ${NAME} class file\\.`), 'the class importer\'s refusal');
  assert.match(read('src/ui/enhancedChargen.js'), new RegExp(`Paste it into Import on any ${NAME} character\\.`), 'and its copy note');
  assert.match(read('SUPPORT.md'), new RegExp(`^# Support ${NAME}\\n`), 'the support page\'s first line');
});

test('BR4: the logo is Mac\u2019s transparent cut, and nothing blends it away', () => {
  // INTRO2's logo was a JPEG on black, and every surface drew it with
  // mix-blend-mode: screen to lose the black. The Online logo carries its
  // own alpha and is MADE of black - the outlines round every letter, the
  // ONLINE lettering on the banner - so screen would erase the art itself.
  const mark = read('src/ui/brandMark.js');
  assert.match(mark, /new URL\('\.\.\/assets\/branding\/daggerfall-online\.png', import\.meta\.url\)/, 'the one asset');
  assert.match(mark, /image\.className = 'brand-logo';/);
  const intro = read('src/ui/introScreen.js'), style = read('src/ui/enhancedStyle.js');
  const introTitle = intro.match(/\.intro-title\{[^}]*\}/)[0];
  assert.doesNotMatch(introTitle, /mix-blend-mode/, 'the film draws it as it is');
  const logoRule = style.match(/\n\.brand-logo \{[^}]*\}/)[0];
  assert.doesNotMatch(logoRule, /mix-blend-mode/, 'and so do the doors');
  // The file's last 81 of 850 rows are empty canvas: the doors pull what
  // follows up over them, as a % of the WIDTH (2112).
  assert.match(style, /\.px-wordmark \.brand-logo, \.brand-home \.brand-logo \{ margin-bottom: calc\(-100% \* 81 \/ 2112\); \}/);
});

test('BR4: no surface still says the old name - whole, or split across a wordmark', () => {
  // The BR1 sweep, for the name BR1 gave it. Case-sensitive, so Mac's
  // lower-case "keep the daggerfall Enhanced title" (the landing page's
  // and its test's quote of him) is no hit; the capitalised survivors are
  // named below. The bible is the record of what the project was called
  // when, and is not swept.
  let hits = '';
  try {
    // Nor are the mutant records: a record's `new` is the old name ON
    // PURPOSE - it is how tools/mutants/br4.json proves this sweep fails.
    hits = execFileSync('git', ['grep', '-n', '-E', 'Daggerfall ?Enhanced|DaggerfallEnhanced', '--', ':!bible', ':!test/brand.test.js', ':!tools/mutants'],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    assert.equal(e.status, 1, `git grep failed: ${e.stderr || e.message}`);
  }
  // THE SURVIVORS ARE WORDS SOMEONE SAID OR WROTE DOWN AT THE TIME, each
  // named: a player's Discord question (REL2), Mac's BR3 ruling as the
  // landing test quotes it, and REL2's record of the file the release
  // actually carried. None is a surface. (The patch notes announcing the
  // rename were a fourth until REL6 took notes out of the tree. The sweep
  // reads git's INDEX: the first run of this pin went green with those
  // notes and br4.json on disk but not yet added, and red in CI on the
  // commit that carried them.)
  const SAID = [
    /^test\/relwin1\.test\.js:[23]:\/\/ /,
    /^test\/relwin1\.test\.js:9:\/\/ `artifactName`, so both wrote DaggerfallEnhanced-<v>-win-x64\.exe/,
    /^test\/landing\.test\.js:\d+:\s*\/\/ logo to the original Daggerfall Enhanced text"\)/,
  ];
  const survivors = hits.split('\n').filter((l) => l && !SAID.some((re) => re.test(l))).join('\n');
  assert.equal(survivors, '', `the old name survives:\n${survivors}`);

  let split = '';
  try {
    split = execFileSync('git', ['grep', '-n', '-E', "<small>Enhanced</small>|el\\('small', null, 'Enhanced'\\)", '--', ':!bible', ':!test/brand.test.js', ':!tools/mutants'],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    assert.equal(e.status, 1, `git grep failed: ${e.stderr || e.message}`);
  }
  assert.equal(split, '', `a wordmark still spells the old name across two elements:\n${split}`);
});

test('BR4: what the rebrand deliberately did NOT touch, and why', () => {
  // "ENHANCED" IS ALSO THE SKIN. Enhanced Plus, Enhanced lighting, the
  // Enhanced pane: those are the port's own departures, named before and
  // apart from the product, and they keep their names.
  assert.match(read('src/systems/uiSkin.js'), /enhanced: 'Enhanced Plus'/, 'the UI skin is not the brand');
  // A FILE FORMAT IS A KEY. Every class a player has exported says
  // `daggerfall-enhanced/custom-class` inside it; rename the constant and
  // each of those files is refused on import.
  assert.match(read('src/systems/customClass.js'), /export const CLASS_FILE_FORMAT = 'daggerfall-enhanced\/custom-class';/,
    'exported class files keep importing');
  // THE ADDRESSES OTHER PEOPLE HOLD. The Patreon page and the Discord
  // invite are accounts outside the tree, as the domain was for BR1: the
  // tree follows them and never leads. The invite has since followed the
  // name on Discord's side - discord.gg/dfenhanced stopped resolving and
  // the server's invite is discord.gg/daggerfallonline (2026-09-28) - so
  // the pin moved with it. The Patreon page keeps the old spelling.
  assert.ok(read('index.html').includes('https://www.patreon.com/c/dfenhanced'), 'the Patreon page is where it is');
  assert.ok(read('index.html').includes('https://discord.gg/daggerfallonline'), 'and so is the Discord');
  // The desktop shell's install identity and storage root, as BR1 left them.
  assert.match(read('app/package.json'), /"appId": "dev\.daggerfalljs\.app"/, 'an update installs over the copy that is there');
  assert.match(read('app/main.cjs'), /app\.setPath\('userData', path\.join\(app\.getPath\('appData'\), 'Daggerfall JavaScript'\)\)/,
    'and the saves stay where they are');
});
