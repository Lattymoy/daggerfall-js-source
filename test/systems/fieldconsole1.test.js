// FIELD-CONSOLE1 (2026-09-27) - A PLAYER'S CONSOLE, READ LINE BY LINE. Two of its lines were faults:
//
//   [town] FACTION.TXT unavailable: Cannot access 'Ut' before initialization
//     townTalk's load (built far up bootWorld) resumes after its FACTION.TXT fetch and reads the region through
//     `_questRegionIndex` - which was a `const` declared thousands of lines below, AFTER `await loadQuestPack()`.
//     bootWorld is suspended at that await when the fetch lands, so the read hit the dead zone and the region's
//     people never loaded: every town talk ran without its people. It is a hoisted declaration now.
//
//   /assets/undefined 404 (twice at boot, twice at every door)
//     Handheld Torches' two loaders probe frames until one is missing - the mod's own TryImportTexture loop -
//     and in the bundle a frame past the last has no file, so Vite's dynamic URL is `/assets/undefined` and the
//     probe's miss went out as a request. The vendored set is known at build time; a frame not in it is a miss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('FIELD-CONSOLE1: the region read townTalk makes at load is a hoisted declaration, declared from the first line', () => {
  const w = read('src/scenes/world.js');
  const build = w.indexOf('const townTalk = createTownTalk({');
  assert.ok(build > 0);
  assert.match(w.slice(build, build + 2000), /regionIndex: \(\) => _questRegionIndex\(\),/, 'the load reads it');
  // AUDIT NAV1 (B2): a raid parsed at sea reads the crown's region through its pin, for the length of the parse
  assert.match(w, /\n  function _questRegionIndex\(\) \{\n    if \(_questRegionPin != null\) return _questRegionPin;[^\n]*\n    const px = playerTravelPixel\(\);\n    return maps\.getRegionIndexAt\(px\.x, px\.y\);\n  \}/);
  // everything its body reads is declared before townTalk is built (the load may resume at any later await)
  // PIN MOVED (STAFF-EVENT): the maps are handed to the staff hook's place picker as they are made (net/staffPlaces.js gameMaps)
  for (const decl of ['function playerTravelPixel()', 'let _questRegionPin = null;', 'const maps = gameMaps(new MapsFile());', 'const state = new StreamingWorldState(', 'const cam = {', 'const walkMode = ', 'const player = new PlayerMotor(']) {
    const at = w.indexOf(decl);
    assert.ok(at > 0, decl);
    if (!decl.startsWith('function')) assert.ok(at < build, `${decl} is declared before townTalk is built`);
  }
  assert.match(w, /\n  var modes = createWorldModes\(\{/, '`modes` is a var: `modes?.mode` reads undefined, not a dead zone');
});

test('FIELD-CONSOLE1: a torch frame the vendored set does not carry is a miss, never a fetch', async () => {
  const ht = read('src/systems/handheldTorches.js');
  assert.match(ht, /const VENDORED_TEXTURES = typeof window !== 'undefined'\n\s*\? import\.meta\.glob\('\.\.\/\.\.\/vendor\/handheld-torches\/Textures\/\*\.png', \{ eager: true, query: '\?url', import: 'default' \}\)\n\s*: null;/);
  assert.match(ht, /async function defaultLoadSprite\(record, frame\) \{\n\s*if \(!vendoredTexture\(`\$\{SPRITE_ARCHIVE\}_\$\{record\}-\$\{frame\}\.png`\)\) return null;/);
  const dt = read('src/scenes/droppedTorches.js');
  assert.match(dt, /async function defaultLoadTexture\(record, frame\) \{\n\s*if \(!vendoredTexture\(`\$\{DROPPED_ARCHIVE\}_\$\{record\}-\$\{frame\}\.png`\)\) return null;/);
  // the names the loaders ask are the vendored files' own spelling
  const files = readdirSync(new URL('../../vendor/handheld-torches/Textures/', import.meta.url)).filter((f) => f.endsWith('.png'));
  const { SPRITE_ARCHIVE, DROPPED_ARCHIVE, vendoredTexture } = await import('../../src/systems/handheldTorches.js');
  for (const arch of [SPRITE_ARCHIVE, DROPPED_ARCHIVE]) {
    assert.ok(files.some((f) => f.startsWith(`${arch}_0-0.png`)), `${arch}'s first frame is vendored as the loader spells it`);
  }
  assert.equal(vendoredTexture('112359_0-4.png'), true, 'node has no table: the loaders fetch as before (the tests hand their own)');
});
