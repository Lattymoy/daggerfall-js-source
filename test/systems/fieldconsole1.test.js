// A PLAYER'S CONSOLE, READ LINE BY LINE. Two of its lines were faults:
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
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('FIELD-CONSOLE1: the region read townTalk makes at load is a hoisted declaration, declared from the first line', () => {
  const w = read('src/scenes/world.js');
  const build = w.indexOf('const townTalk = createTownTalk({');
  assert.ok(build > 0);
  assert.match(w.slice(build, build + 2000), /regionIndex: \(\) => _questRegionIndex\(\),/, 'the load reads it');
  // A raid parsed at sea reads the crown's region through its pin, for the length of the parse
  assert.match(w, /\n  function _questRegionIndex\(\) \{\n    if \(_questRegionPin != null\) return _questRegionPin;[^\n]*\n    const px = playerTravelPixel\(\);\n    return maps\.getRegionIndexAt\(px\.x, px\.y\);\n  \}/);
  // everything its body reads is declared before townTalk is built (the load may resume at any later await)
  // PIN MOVED: the maps are handed to the staff hook's place picker as they are made (net/staffPlaces.js gameMaps)
  for (const decl of ['function playerTravelPixel()', 'let _questRegionPin = null;', 'const maps = gameMaps(new MapsFile());', 'const state = new StreamingWorldState(', 'const cam = {', 'const walkMode = ', 'const player = new PlayerMotor(']) {
    const at = w.indexOf(decl);
    assert.ok(at > 0, decl);
    if (!decl.startsWith('function')) assert.ok(at < build, `${decl} is declared before townTalk is built`);
  }
  assert.match(w, /\n  var modes = createWorldModes\(\{/, '`modes` is a var: `modes?.mode` reads undefined, not a dead zone');
});

test('FIELD-CONSOLE1: a torch frame the set does not carry is a miss, never a fetch', async () => {
  // The set is our recipes (handheldTorchesArt.js) and the rebuilt candles - nothing is fetched at all
  const ht = read('src/systems/handheldTorches.js');
  assert.doesNotMatch(ht, /import\.meta\.glob|fetch\(/, 'no file to glob, nothing to fetch');
  assert.match(ht, /async function defaultLoadSprite\(record, frame\) \{\n\s*if \(!vendoredTexture\(`\$\{SPRITE_ARCHIVE\}_\$\{record\}-\$\{frame\}\.png`\)\) return null;/);
  const dt = read('src/scenes/droppedTorches.js');
  assert.match(dt, /async function defaultLoadTexture\(record, frame\) \{\n\s*if \(!vendoredTexture\(`\$\{DROPPED_ARCHIVE\}_\$\{record\}-\$\{frame\}\.png`\)\) return null;/);
  const { SPRITE_ARCHIVE, DROPPED_ARCHIVE, vendoredTexture } = await import('../../src/systems/handheldTorches.js');
  for (const arch of [SPRITE_ARCHIVE, DROPPED_ARCHIVE]) assert.equal(vendoredTexture(`${arch}_0-0.png`), true, `${arch}'s first frame, as the loader spells it`);
  assert.equal(vendoredTexture('112359_0-4.png'), false, 'a frame past the last is a miss');
});
