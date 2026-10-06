// FIELD BUGS 2026-10-06c CAT-MEOW (bible/01-Overview/Field-Bugs-2026-10-06c.md; Flylighter on Discord, with a video:
// "NPC sound glitch of a rapid cat meow. This one is in Chesterwark, Daggerfall; doubtful it's the only one").
//
// A person's name is StaticNPC.DisplayName (characters/staticNpc.js staticNpcName): DFRandom seeded with the NPC's
// nameSeed, the name drawn off it. The plaque (ui/worldPlaque.js worldHoverFrame) asks its namers EVERY frame - the
// mod asked once per new hit - so while the player looked at a townsperson the classic stream restarted at that
// person's seed each frame and every later draw was the same number. The town animals roll that stream at 16 Hz
// (systems/animalAmbience.js, DFU's rand() <= 100), so beside the one person whose next draw came under 101 a cat
// meowed on every tick. Driven here through the real hover door, the real DisplayName and the real animal pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldHoverFrame, destroyWorldPlaque } from '../src/ui/worldPlaque.js';
import { resetQuickLoot } from '../src/systems/quickLoot.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { staticNpcName } from '../src/characters/staticNpc.js';
import { BANK_TYPES, GENDERS } from '../src/characters/nameHelper.js';
import { createAnimalAmbience } from '../src/systems/animalAmbience.js';
import { srand, rand, getSeed } from '../src/formats/dfRandom.js';
import { SOUND } from '../src/systems/soundClips.js';

/** A Breton man of the street: his name's next classic draw is 38 - under the animals' 101. */
const TRISTASTYR = Object.freeze({ nameSeed: 296, gender: GENDERS.Male, factionID: 0 });

/** The plaque over one person within reach, named by DisplayName - the host namers' own call. */
function hoverPerson(data, named) {
  return worldHoverFrame({
    eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
    targets: () => [{ key: 'person:0', aabb: { min: [-0.5, -1, 1], max: [0.5, 1, 1.5] }, distance: 1, reach: 6.4 }],
    name: () => { named.n++; return { title: staticNpcName(data, { nameBank: BANK_TYPES.Breton }) }; },
  });
}

/** Ten seconds in the street, sixty frames a second, a cat three metres off: the ticks the cat meowed on. */
function street(look) {
  const named = { n: 0 };
  const meows = [];
  let tick = 0;
  const cat = [{ pos: [3, 0, 3], sound: SOUND.AnimalCat }];
  const ambience = createAnimalAmbience({ play3d: (clip) => meows.push({ tick, clip }) }, () => { tick++; return cat; });
  for (let f = 0; f < 600; f++) {
    if (look) hoverPerson(look, named);
    ambience.update(1 / 60, [0, 0, 0]);
  }
  return { meows, ticks: tick, named: named.n };
}

const setup = () => { resetPrefs(); resetQuickLoot(); setUiSkin('classic'); };
const teardown = () => { destroyWorldPlaque(); resetPrefs(); resetQuickLoot(); };

test('CAT-MEOW: the plaque names the person and leaves the classic stream where it found it', () => {
  setup();
  srand(777);
  const before = getSeed();
  const named = { n: 0 };
  const f = hoverPerson(TRISTASTYR, named);
  assert.equal(f?.title, 'Tristastyr Moorton', 'DisplayName answered the plaque');
  assert.equal(named.n, 1);
  assert.equal(getSeed(), before, 'the name\'s srand and draws are put back');
  // the field's own number: the stream DisplayName leaves behind draws 38 next, under the animals' roll
  staticNpcName(TRISTASTYR, { nameBank: BANK_TYPES.Breton });
  assert.equal(rand(), 38);
  teardown();
});

test('CAT-MEOW: looking at the person beside the cat changes no tick the cat meows on', () => {
  setup();
  srand(1);
  const alone = street(null);
  srand(1);
  const looking = street(TRISTASTYR);
  assert.equal(looking.named, 600, 'the plaque asked its namer every frame, as the hosts drive it');
  assert.equal(alone.ticks, 160, 'ten seconds of the classic 16 Hz update');
  assert.equal(looking.ticks, 160);
  assert.deepEqual(looking.meows, alone.meows, 'the same meows on the same ticks - not one on every tick');
  assert.ok(alone.meows.length < 8, `a cat's meow stays rare (rand() <= 100 of 32768): ${alone.meows.length} in 160 ticks`);
  teardown();
});

test('CAT-MEOW: a namer that seeds and then throws leaves the stream as it was too', () => {
  setup();
  srand(4242);
  const before = getSeed();
  const f = worldHoverFrame({
    eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
    targets: () => [{ key: 'person:0', aabb: { min: [-0.5, -1, 1], max: [0.5, 1, 1.5] }, distance: 1, reach: 6.4 }],
    name: () => { srand(9); rand(); throw new Error('a third party namer'); },
  });
  assert.equal(f, null, 'the contained fault stands the plaque down');
  assert.equal(getSeed(), before);
  teardown();
});
