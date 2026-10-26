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
//
// BR5 - DFO ONLINE (2026-10-11, Mac: "So next up I want to replace the current
// daggerfall online logo anywhere it's present with this logo. I want to
// comprehensively scan the repo, ingame, etc for any mentions of
// daggerfall/daggerfall online and change it to DFO Online/DFO. We are
// rebranding for our own sake and I want to do this right"; asked how far, he
// chose to MINIMIZE the original game's name too). Three laws now, each
// pinned below: the PRODUCT is DFO Online (DFO where a label is short); the
// ORIGINAL GAME is named only where it must be - the files a player brings,
// the credits and the licence, the trademark notice, and the world's own
// places, which are the game's and not the product's; everywhere else a
// player reads "the original game" or "classic". And the KEYS other systems
// hold keep their spelling, as BR1 ruled - each is listed with what moving it
// would break.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The name, its short form, its form in a file name, and the one sentence
 *  that says what it is - which names no other game (BR5). */
const NAME = 'DFO Online';
const SHORT_NAME = 'DFO';
const FILE_NAME = 'DFO-Online';
const TAGLINE = 'An open-source reimplementation of a classic 1996 RPG';

test('BR1: every surface the player reads carries the one name', () => {
  const landing = read('index.html');
  assert.match(landing, new RegExp(`<title>${NAME}</title>`), 'the landing page\'s title');
  assert.match(landing, new RegExp(`<meta property="og:title" content="${NAME}" />`), 'and what a link preview shows');
  // BR3 (Mac, 2026-09-14): the landing page's wordmark was TYPE - one word
  // over a tracked sub-line - after BR2's one day as an uploaded logo.
  // AUDIT BR5 (Mac, 2026-10-11: "Use the new logo"): it is the product's
  // logo again, the game's own file, named by its alt.
  // BR6 (Mac, 2026-10-26): the dragon mark, at its own 1232 x 1034.
  assert.ok(landing.includes(`<h1 class="wordmark"><img src="./src/assets/branding/dfo-online.png" alt="${NAME}" width="1232" height="1034" /></h1>`), 'the wordmark');
  assert.equal((landing.match(/<img\s/g) ?? []).length, 1, 'and it is the one image on the page');
  // THE WORDMARK SPLITS THE NAME ACROSS TWO ELEMENTS, so no adjacency
  // sweep can ever see it whole: the front door rendered DAGGERFALL over
  // a tracked sub-line reading JAVASCRIPT for the length of the rebrand
  // with `git grep 'Daggerfall JavaScript'` finding nothing. Every
  // wordmark is therefore pinned STRUCTURALLY - the sub-line's own text,
  // wherever the halves live.
  // INTRO2 (Mac, 2026-09-18): his supplied logo replaces the in-game
  // wordmark. The landing page and archived prototypes keep BR3's type.
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), /mark\.append\(brandMark\(\)\)/,
    'the front door uses the same accessible mark as the cinematic');
  assert.match(read('src/ui/brandMark.js'), new RegExp(`export const BRAND_LOGO_ALT = '${NAME}';`), 'the mark\'s own alt text - the product\'s name and no other game\'s (BR5)');
  for (const proto of ['menu-pixel.html', 'menu-redesign.html']) {
    assert.match(read(proto), new RegExp(`<h1 class="wordmark">${SHORT_NAME}<small>Online<\\/small><\\/h1>`), `${proto}'s wordmark`);
  }
  assert.match(landing, new RegExp(`<span>${NAME}</span>`), 'and the footer');
  assert.match(read('play/index.html'), new RegExp(`<title>${NAME}</title>`), 'the game\'s own page');

  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.name, NAME, 'the PWA\'s name');
  assert.equal(manifest.short_name, SHORT_NAME, 'the home-screen label stays the short one - it sits under an icon');
  assert.match(read('play/index.html'), new RegExp(`<meta name="apple-mobile-web-app-title" content="${SHORT_NAME}" />`), 'and so is the iPhone\'s (BR5)');

  const app = JSON.parse(read('app/package.json'));
  assert.equal(app.productName, NAME, 'the desktop shell');
  assert.equal(app.build.productName, NAME, 'and what electron-builder stamps into the installer');
  assert.ok(app.build.artifactName.startsWith(`${FILE_NAME}-`), 'and the download\'s filename');

  const mainCjs = read('app/main.cjs');
  assert.match(mainCjs, new RegExp(`title: '${NAME}',`), 'the desktop window title');
  assert.match(mainCjs, new RegExp(`${NAME} v\\$\\{app\\.getVersion\\(\\)\\} is the latest release`), 'and the up-to-date dialog');

  assert.match(read('src/main.js'), new RegExp(`document\\.title = \`${NAME} - \\$\\{msg\\}\``), 'the loading title');
  const ds = read('src/scenes/dataSource.js');
  assert.match(ds, new RegExp(`document\\.title = '${NAME} - close other game tabs to continue'`), 'the second-tab title');
  assert.match(ds, new RegExp(`<h2 style="margin-top:0">${NAME}</h2>`), 'and the second-tab panel');

  // PIN MOVED (REL8): the update number leads where the build knows it (rel8_updates runs the line both ways)
  assert.match(read('src/ui/pauseWindow.js'), new RegExp(`const ver = UPDATE \\? \\\`${NAME} \\$\\{UPDATE\\} \\(\\$\\{BUILD_TAG\\}\\)\\\` : \\\`${NAME} \\$\\{BUILD_TAG\\}\\\`;`),
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
  assert.ok(read('src/ui/enhanced/enhancedMenu.js').includes(`'${TAGLINE}.'`), 'the About panel\'s');
  assert.ok(read('README.md').includes(`${TAGLINE.toLowerCase().replace('rpg', 'RPG')},\nplayed from your own copy of The Elder Scrolls II: Daggerfall.`), 'and the README\'s - with the copy a player brings, named');
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), new RegExp(`el\\('h3', null, '${NAME}'\\)`), 'the About panel names the product');
});

test('BR1: no surface still says the old name', () => {
  // git grep, so the sweep is over what is TRACKED - dist/ is a build
  // output and node_modules is not ours.
  // git grep exits 1 when it finds NOTHING, which is the passing case.
  let hits = '';
  try {
    hits = execFileSync('git', ['grep', '-n', '-E', 'Daggerfall ?JavaScript|DaggerfallJS|Daggerfall JS\\b', '--', ':!bible', ':!test/ui/brand.test.js'],
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
    split = execFileSync('git', ['grep', '-n', '-E', "<small>JavaScript</small>|el\\('small', null, 'JavaScript'\\)", '--', ':!test/ui/brand.test.js'],
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
  assert.match(read('test/systems/potions.test.js'), /the half a JS port gets wrong by default/,
    'a technical statement about the language survives the rebrand');
  // And a QUOTE is a quote. TI2's header quotes Mac asking to "enhance
  // the mobile element of DFJS" - his words, at the time he said them.
  assert.match(read('src/ui/touch/touchLook.js'), /element of DFJS in terms of camera movement/,
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
  const intro = read('src/ui/intro/introScreen.js');
  assert.match(intro, new RegExp(`host\\.setAttribute\\('aria-label', t\\('menu\\.intro\\.aria', '${NAME} introduction'\\)\\)`), 'what a screen reader hears as the film opens');
  assert.match(intro, new RegExp(`'intro-title-fallback', '${NAME}'`), 'and the title the film draws if the logo cannot load');
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), new RegExp(`homeMark\\.setAttribute\\('aria-label', t\\('menu\\.home\\.homeAria', '${NAME} — main menu'\\)\\)`), 'the masthead\'s way home');
  assert.match(read('src/systems/save/saveTransfer.js'), new RegExp(`TRANSFER_ZIP_NAME = '${FILE_NAME}-Saves\\.zip'`), 'the saves a player carries away are named for it');
  assert.match(read('src/systems/customClass.js'), new RegExp(`That is not a ${NAME} class file\\.`), 'the class importer\'s refusal');
  assert.match(read('src/ui/enhanced/enhancedChargen.js'), new RegExp(`Paste it into Import on any ${NAME} character\\.`), 'and its copy note');
  assert.match(read('SUPPORT.md'), new RegExp(`^# Support ${NAME}\\n`), 'the support page\'s first line');
});

test('BR4: the logo is Mac’s transparent cut, and nothing blends it away - BR5: the DFO mark, in boxes that keep the height they had', () => {
  // INTRO2's logo was a JPEG on black, and every surface drew it with
  // mix-blend-mode: screen to lose the black. BR4's carried its own alpha and
  // was MADE of black, so screen would erase the art itself; BR5's DFO mark
  // is the same - white letters inside dark outlines over a soft shadow.
  const mark = read('src/ui/brandMark.js');
  assert.match(mark, /new URL\('\.\.\/assets\/branding\/dfo-online\.png', import\.meta\.url\)/, 'the one asset');
  assert.match(mark, /image\.className = 'brand-logo';/);
  const intro = read('src/ui/intro/introScreen.js'), style = read('src/ui/enhanced/enhancedStyle.js');
  const introTitle = intro.match(/\.intro-title\{[^}]*\}/)[0];
  assert.doesNotMatch(introTitle, /mix-blend-mode/, 'the film draws it as it is');
  const logoRule = style.match(/\n\.brand-logo \{[^}]*\}/)[0];
  assert.doesNotMatch(logoRule, /mix-blend-mode/, 'and so do the doors');
  // BR5: THE MARK IS 1.63:1 AND PAINTED TO ITS EDGES, where BR4's was 2.48:1
  // with its last 81 of 850 rows empty canvas (which the doors pulled what
  // followed up over). Every box keeps the HEIGHT it had, so nothing above or
  // below a mark moves: its new width is the old one's height at the new
  // ratio - worked here from the file's own IHDR, so the next logo's size
  // reddens this, not a layout. BR6's dragon mark (Mac, 2026-10-26) is the
  // next logo: 1232 x 1034, 1.19:1, so every box below narrowed to its height.
  const png = readFileSync(join(root, 'src/assets/branding/dfo-online.png'));
  const ratio = png.readUInt32BE(16) / png.readUInt32BE(20);
  // AUDIT BR5: the site's and the launcher's logo reserve the file's own size, so neither page moves as it loads
  for (const page of ['index.html', 'app/launcher/index.html']) {
    assert.match(read(page), new RegExp(`dfo-online\\.png" alt="${NAME}" width="${png.readUInt32BE(16)}" height="${png.readUInt32BE(20)}"`), `${page}: the logo's own size`);
  }
  const door = (w) => w * 769 / 2112 * ratio, film = (w) => w * 850 / 2112 * ratio;
  const px = (v) => `${Math.round(v)}px`, vw = (v) => `${Math.round(v * 10) / 10}vw`;
  assert.ok(style.includes(`.px-wordmark:has(.brand-logo) { width: min(${px(door(540))}, ${vw(door(84))});`), 'the door: BR4\'s 540px and 84vw, at their height');
  assert.ok(style.includes(`.px-wordmark:has(.brand-logo) { width: min(${px(door(394))}, ${vw(door(56))}); }`), 'a short landscape screen: BR4\'s 394px and 56vw');
  assert.ok(style.includes(`.brand-home .brand-logo { width: ${Math.round(door(100) * 10) / 10}%; margin: 0 auto; }`), 'the masthead: the column\'s width at 769/2112 of it, centred');
  assert.ok(intro.includes(`.intro-title{position:absolute;left:50%;top:48%;width:min(${vw(film(86))},${px(film(1240))});`), 'the film: its box at BR4\'s height - its probe measures that box against the tap target');
  assert.ok(intro.includes(`.intro-title{width:min(${vw(film(74))},${px(film(1000))})}`), 'and on a short screen');
  assert.doesNotMatch(style, /margin-bottom: calc\(-100% \* 81 \/ 2112\)/, 'and nothing pulls up over rows the file no longer has');
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
    hits = execFileSync('git', ['grep', '-n', '-E', 'Daggerfall ?Enhanced|DaggerfallEnhanced', '--', ':!bible', ':!test/ui/brand.test.js', ':!tools/mutants'],
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
    /^test\/tooling\/relwin1\.test\.js:[23]:\/\/ /,
    /^test\/tooling\/relwin1\.test\.js:9:\/\/ `artifactName`, so both wrote DaggerfallEnhanced-<v>-win-x64\.exe/,
    /^test\/ui\/enhanced\/landing\.test\.js:\d+:\s*\/\/ logo to the original Daggerfall Enhanced text"\)/,
  ];
  const survivors = hits.split('\n').filter((l) => l && !SAID.some((re) => re.test(l))).join('\n');
  assert.equal(survivors, '', `the old name survives:\n${survivors}`);

  let split = '';
  try {
    split = execFileSync('git', ['grep', '-n', '-E', "<small>Enhanced</small>|el\\('small', null, 'Enhanced'\\)", '--', ':!bible', ':!test/ui/brand.test.js', ':!tools/mutants'],
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
  // tree follows them and never leads. The invite has since moved twice
  // on Discord's side - discord.gg/dfenhanced stopped resolving and the
  // server's invite was discord.gg/daggerfallonline (2026-09-28), then Mac
  // gave discord.gg/jM2JdwSM8w (2026-10-09) - and the pin moved with it
  // each time. The Patreon page keeps the old spelling.
  assert.ok(read('index.html').includes('https://www.patreon.com/c/dfenhanced'), 'the Patreon page is where it is');
  assert.ok(read('index.html').includes('https://discord.gg/jM2JdwSM8w'), 'and so is the Discord');
  // The desktop shell's install identity and storage root, as BR1 left them.
  assert.match(read('app/package.json'), /"appId": "dev\.daggerfalljs\.app"/, 'an update installs over the copy that is there');
  assert.match(read('app/main.cjs'), /app\.setPath\('userData', path\.join\(app\.getPath\('appData'\), 'Daggerfall JavaScript'\)\)/,
    'and the saves stay where they are');
});

test('BR5: no surface still says Daggerfall Online - whole, split across a wordmark, or in a file name', () => {
  // The BR1 sweep, for the name BR4 gave it. Case-sensitive, so the keys
  // spelled `daggerfall-online` and `daggerfallonline` (the relay's worker,
  // the Ko-fi page) are no hit: they are named in the next test, on purpose.
  let hits = '';
  try {
    hits = execFileSync('git', ['grep', '-n', '-E', 'Daggerfall ?Online|DaggerfallOnline|DAGGERFALL ?ONLINE|Daggerfall-Online', '--', ':!bible', ':!test/ui/brand.test.js', ':!tools/mutants'],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    assert.equal(e.status, 1, `git grep failed: ${e.stderr || e.message}`);
  }
  // AUDIT BR5: THE ONE PLACE IT STAYS, ON PURPOSE - the four download names every copy built before the rename asks
  // for (app/lib/downloads.cjs LEGACY_DOWNLOAD_FILES), each line whole and only those four; the next test names them.
  const LEGACY_LINE = /^app\/lib\/downloads\.cjs:\d+: {2}(winSetup|winPortable|mac|linux): 'DaggerfallOnline-[\w.-]+',$/;
  const lines = hits ? hits.split('\n') : [];
  assert.equal(lines.filter((l) => LEGACY_LINE.test(l)).length, 4, 'the old download names, four and no more');
  hits = lines.filter((l) => !LEGACY_LINE.test(l)).join('\n');
  assert.equal(hits, '', `the old name survives:\n${hits}`);
  let split = '';
  try {
    split = execFileSync('git', ['grep', '-n', '-E', "class=\"wordmark\">Daggerfall<small>|el\\('div', 'sub', 'Daggerfall'\\)", '--', ':!bible', ':!test/ui/brand.test.js', ':!tools/mutants'],
      { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    assert.equal(e.status, 1, `git grep failed: ${e.stderr || e.message}`);
  }
  assert.equal(split, '', `a wordmark still spells the old name across two elements:\n${split}`);
  assert.match(read('src/ui/enhanced/enhancedChargen.js'), new RegExp(`brand\\.append\\(el\\('div', 'sub', '${NAME}'\\)\\);`), 'the new character\'s masthead');
  // AUDIT BR5: the launcher wears the logo too, the game's own file, named by its alt
  assert.ok(read('app/launcher/index.html').includes(`<h1 class="wordmark"><img src="dfo-online.png" alt="${NAME}" width="1232" height="1034"></h1>`), 'and the desktop launcher\'s');
  assert.match(read('src/ui/screenshot.js'), /return `dfo-\$\{d\.getFullYear\(\)\}/, 'a screenshot is named for the product');
  assert.match(read('src/ui/shotsPane.js'), /a\.download = `dfo-shot-\$\{s\.id\}\.jpg`;/, 'and so is a saved loading shot');
  assert.match(read('server-account/src/patreon.js'), new RegExp(`<title>\\$\\{esc\\(heading\\)\\} - ${NAME}</title>`), 'and the Patreon link\'s page');
  for (const doc of ['terms', 'privacy']) {
    assert.match(read(`${doc}/index.html`), new RegExp(`<h1>${NAME.toUpperCase()} MULTIPLAYER — `), `the ${doc} name the operator`);
  }
});

test('BR5: the original game is named only where it must be - in what a player reads, the original game or the classic', async () => {
  // Mac's choice, asked: MINIMIZE. "Daggerfall" stays where it is the TRUTH
  // about something that is not this product - the files a player brings, the
  // credits and the licence, the trademark notice, Daggerfall Unity and the
  // mods by their own names, and the Iliac Bay's own places (the city, the
  // kingdom, the bank). Everywhere else the reader is told "the original game"
  // or "classic". Read off the PRODUCERS, not the files, so a new row that
  // says "as Daggerfall does" reddens here wherever it is written.
  const OTHERS = /Daggerfall Unity|Daggerfall Enemy Expansion|(World|Windmills|Villages|Cities) of Daggerfall/g;   // DEX0: a mod by its own name
  const named = (v) => /Daggerfall/.test(String(v).replace(OTHERS, ''));
  const strings = (v, out = [], at = '') => {
    if (typeof v === 'string') out.push([at, v]);
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) { let x; try { x = v[k]; } catch { continue; } strings(x, out, `${at}.${k}`); }
    return out;
  };
  const { FEATURES } = await import('../../src/systems/features.js');
  const { OVERHAUL_PANELS } = await import('../../src/systems/overhauls.js');
  const { MOD_SETTINGS } = await import('../../src/systems/modSettings.js');
  const { levelingOptions } = await import('../../src/ui/levelingChoice.js');
  const { LEVELING_CROSS_LINE } = await import('../../src/systems/realmCustoms.js');
  const { INSTEAD } = await import('../../src/ui/settings/settingsCopy.js');
  const { FOOT_GROUPS } = await import('../../src/ui/skinCard.js');
  const { LAND_VIEW_TIERS } = await import('../../src/world/landView.js');
  const said = [
    ...strings(FEATURES, [], 'FEATURES'),
    ...OVERHAUL_PANELS.flatMap((p) => p.options.flatMap((o) => strings({ name: o.name, by: typeof o.by === 'function' ? '' : o.by, blurb: o.blurb }, [], `${p.id}.${o.id}`))),
    // a mod's OWN switches are its author's words, verbatim; the Enabled row is the port's
    ...Object.entries(MOD_SETTINGS).flatMap(([v, m]) => strings({ enabled: m.keys?.Enabled?.description ?? '' }, [], v)),
    // ...and one of the port's own beside a mod's, for the skills tier Daggerfall has and Morrowind does not
    ['primarySkillsImpact', MOD_SETTINGS['oblivion-remaster-leveling'].keys.primarySkillsImpact.description],
    ...strings(levelingOptions(), [], 'levelingOptions'),
    ...strings(LEVELING_CROSS_LINE, [], 'LEVELING_CROSS_LINE'),
    ...strings(INSTEAD, [], 'INSTEAD'),
    ...strings(FOOT_GROUPS, [], 'FOOT_GROUPS'),
    ...strings(LAND_VIEW_TIERS, [], 'LAND_VIEW_TIERS'),
  ];
  assert.ok(said.length > 300, 'the walk has stopped reading the producers');
  const naming = said.filter(([, v]) => named(v));
  assert.deepEqual(naming, [], 'a player reads the original game\'s name where it is not owed');
  assert.ok(said.some(([, v]) => /the original game/.test(v)), 'and reads what it is instead');
  // The doors' own words, which are drawn rather than exported.
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  // PIN MOVED (L10N4): the classic door's words said through t(), its English as BR5 left it
  assert.match(menu, /c\.append\(el\('h3', null, t\('menu\.begin\.title', 'Classic'\)\)\);\n {2}c\.append\(el\('p', 'meta', t\('menu\.begin\.blurb', 'The classic start: the original game\\u2019s own title, intro and menu/, 'the classic door');
  assert.doesNotMatch(TAGLINE, /Daggerfall|Elder Scrolls/, 'and the sentence that says what this is names only what it is');
  // WHERE IT IS OWED, it stays - pinned so a later sweep does not take it too.
  const landing = read('index.html');
  assert.ok(landing.includes('You need <b>your own copy</b> of The Elder Scrolls II: Daggerfall, free since 2009.'), 'the copy a player brings, by its whole name');
  assert.ok(landing.includes('The Elder Scrolls and Daggerfall are trademarks of ZeniMax Media Inc.'), 'the trademark notice on the site');
  assert.ok(read('README.md').includes('The Elder Scrolls and Daggerfall are trademarks of ZeniMax\nMedia Inc.'), 'and in the README');
  assert.ok(read('LICENSE').includes('The Elder Scrolls II: Daggerfall is the property of Bethesda Softworks.'), 'the licence\'s own line');
  assert.match(read('src/ui/credits.js'), /title: 'The Elder Scrolls II: Daggerfall',\n {6}author: 'Bethesda Softworks',/, 'the credits\' first row');
  assert.match(read('app/lib/launcherState.cjs'), /title: 'Where is Daggerfall\?',/, 'the launcher asks for the files by the game\'s name');
  assert.match(read('src/formats/mapsTables.js'), /'Wrothgarian Mountains', 'Daggerfall', 'Glenpoint'/, 'and the Bay\'s own region keeps its name');
});

test('AUDIT BR5: the drawn words no producer exports - the profession pages, the stats card, the decor line, the shots pane, the packs, the menu - name the original game only where it is owed', async () => {
  // The walk above reads what the settings EXPORT. These files draw their words where they are written, so the audit
  // found "Daggerfall's own potion maker" still standing in the Professions page after BR5 (A-2). Read as code -
  // comments out, where the port's notes name what they port - every line that still names it must be owed: the
  // files a player brings, asked for by the game's name.
  const OTHERS = /Daggerfall Unity|(World|Windmills|Villages|Cities) of Daggerfall/g;
  const OWED = [
    "+ 'Pick the ARENA2 folder inside your Daggerfall install (on Steam it is under DF/DAGGER/ARENA2;",
    "<p>Daggerfall's game data is freeware but can't be bundled.</p>",
    'none of them Daggerfall\\u2019s). Pick the ARENA2 folder itself',
  ];
  const DRAWN = ['src/ui/professions/profPages.js', 'src/ui/statsCard.js', 'src/ui/decorPanel.js', 'src/ui/shotsPane.js', 'src/scenes/dataSource.js',
    'src/ui/enhanced/enhancedMenu.js', 'src/ui/pauseWindow.js', 'src/systems/passiveSpecials.js', 'src/systems/customClass.js',
    'src/systems/shellUpdates.js', 'src/main.js', 'src/ui/screenshot.js', 'src/ui/tutorialsPane.js', 'src/systems/tutorialCatalogue.js'];
  const named = [], owed = new Set();
  for (const f of DRAWN) {
    let inBlock = false;
    read(f).split('\n').forEach((line, i) => {
      let code = line;
      if (inBlock) {
        const end = code.indexOf('*/');
        if (end < 0) return;
        code = code.slice(end + 2);
        inBlock = false;
      }
      code = code.replace(/\/\*.*?\*\//g, '');
      const open = code.indexOf('/*');
      if (open >= 0) { inBlock = true; code = code.slice(0, open); }
      code = code.replace(/(^|[^:'"`\\])\/\/.*$/, '$1');   // a line comment - never a URL's //
      if (!/\bDaggerfall\b/.test(code.replace(OTHERS, ''))) return;
      const o = OWED.find((w) => line.includes(w));
      if (o) owed.add(o);
      else named.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(named, [], 'a player reads the original game\'s name where it is not owed');
  assert.equal(owed.size, OWED.length, 'and every owed line is still where it was read - the walk still sees the files');
  // A-2, A-4 and A-5 as they read now: the potion maker is the classic one, the map joins the BAY's own coast (not
  // "the classic coast", which said nothing), and the cries are the ORIGINAL game's (not "the game", which is this one)
  assert.ok(read('src/ui/professions/profPages.js').includes("A potion maker anywhere else, such as a temple\\'s, still works, but what it mixes earns no Provisioning experience.';"), 'A-2');   // PIN MOVED (POTION-DOOR): the maker brews at a station now - the one anywhere else says it earns nothing, the original game unnamed
  const { FEATURES } = await import('../../src/systems/features.js');
  const note = (id) => FEATURES.find((f) => f.id === id)?.note ?? '';
  assert.match(note('tamriel-map'), /joined to the Bay’s own coast\./, 'A-4');
  assert.ok(FEATURES.some((f) => /The sounds are in the original game but go unused\./.test(f.note)), 'A-5');
});

test('BR5: the keys other systems hold keep their spelling, and what moving each would break', () => {
  // Pinned as deliberately unchanged, as BR1 pinned the repository and the
  // domain: each is a name another system holds, and each moves with that
  // system or not at all. Mac weighed them (2026-10-11): the domain and the
  // servers can move together behind a new domain, a migration of its own.
  assert.match(read('src/net/online.js'), /export const DEFAULT_SERVER = 'wss:\/\/daggerfall-online\.mackcothran\.workers\.dev';/,
    'the relay\'s address - every client of every version dials it; it moves with a new hostname, not a commit');
  assert.match(read('src/net/accountClient.js'), /export const DEFAULT_ACCOUNT_SERVICE = 'https:\/\/daggerfall-accounts\.mackcothran\.workers\.dev';/,
    'the account service\'s - the same');
  assert.match(read('server/wrangler.toml'), /^name = "daggerfall-online"$/m, 'the relay Worker\'s name IS its hostname');
  assert.match(read('server-account/src/patreon.js'), /salt: enc\.encode\('daggerfall-accounts patreon-link'\)/,
    'a key-derivation salt - change it and every linked Patreon\'s stored secret stops opening');
  assert.match(read('.github/workflows/account-deploy.yml'), /DB_NAME: daggerfall-accounts/, 'the D1 database, by its name');
  assert.ok(read('.github/FUNDING.yml').includes('ko_fi: daggerfallonline'), 'the Ko-fi page is where it is - an account outside the tree, as the Patreon is');
  assert.ok(read('src/ui/supportAsks.js').includes("url: 'https://ko-fi.com/daggerfallonline'"), 'and the game links it there');
  assert.equal(JSON.parse(read('app/package.json')).name, 'daggerfall-js-app', 'the shell\'s package, and the User-Agent GitHub\'s API sees');
  assert.match(read('src/systems/modSettings.js'), /const STORE_KEY = 'dfjs-mod-settings';/, 'a live localStorage key, as BR1 pinned it');
  // AUDIT BR5: the names a copy built before the rename downloads by - it asks releases/latest/download/<name> for
  // exactly these and can learn no other, so every release carries its downloads under them too (scripts/
  // desktopRelease.mjs alias). They go once no copy older than BR5 is left to ask; a copy from BR5 on reads its
  // download off the release (releaseAssetUrl) and will not need them.
  assert.deepEqual({ ...require('../../app/lib/downloads.cjs').LEGACY_DOWNLOAD_FILES }, {
    winSetup: 'DaggerfallOnline-win-x64-setup.exe',
    winPortable: 'DaggerfallOnline-win-x64-portable.exe',
    mac: 'DaggerfallOnline-mac-arm64.dmg',
    linux: 'DaggerfallOnline-linux-x86_64.AppImage',
  }, 'the downloads a copy from before the rename asks for, by the names it was built with');
});
