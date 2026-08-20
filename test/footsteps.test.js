// FS-slice: PLAYER FOOTSTEPS (PlayerFootsteps.cs verbatim). The
// sound-set decision + the classic 2.5-unit stride machine, and the
// four-host wiring sweep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FootstepMachine, pickFootstepSet, FOOTSTEP, WALK_STEP_INTERVAL, FOOTSTEP_VOLUME } from '../src/systems/footsteps.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('footsteps: the sound-set decision - place, season, snow gate, and the override order', () => {
  // outside, summer -> Outside pair
  assert.deepEqual(pickFootstepSet({ inside: false, climateIndex: CLIMATES.Woodlands }),
    [FOOTSTEP.Outside1, FOOTSTEP.Outside2]);
  // winter turns to snow - unless the climate never snows
  assert.deepEqual(pickFootstepSet({ inside: false, winter: true, climateIndex: CLIMATES.Woodlands }),
    [FOOTSTEP.Snow1, FOOTSTEP.Snow2]);
  assert.deepEqual(pickFootstepSet({ inside: false, winter: true, climateIndex: CLIMATES.Desert }),
    [FOOTSTEP.Outside1, FOOTSTEP.Outside2], 'IsSnowFreeClimate: no snow steps in the desert');
  // buildings walk on wood; dungeons on stone
  assert.deepEqual(pickFootstepSet({ inside: true, inBuilding: true }), [FOOTSTEP.Wood1, FOOTSTEP.Wood2]);
  assert.deepEqual(pickFootstepSet({ inside: true }), [FOOTSTEP.Stone1, FOOTSTEP.Stone2]);
  // the overrides in DFU's write order: water, then path
  assert.deepEqual(pickFootstepSet({ inside: false, onExteriorWater: true }),
    [FOOTSTEP.Submerged, FOOTSTEP.Submerged]);
  assert.deepEqual(pickFootstepSet({ inside: false, onExteriorPath: true }),
    [FOOTSTEP.Stone1, FOOTSTEP.Stone2], 'paths ring like the dungeon set');
  // dungeon water: swimming submerged, wading shallow
  assert.deepEqual(pickFootstepSet({ inside: true, dungeonSwimming: true }),
    [FOOTSTEP.Submerged, FOOTSTEP.Submerged]);
  assert.deepEqual(pickFootstepSet({ inside: true, dungeonShallow: true }),
    [FOOTSTEP.Shallow, FOOTSTEP.Shallow]);
  // out of the water the stateless pick lands back on stone by itself
  assert.deepEqual(pickFootstepSet({ inside: true, dungeonSwimming: false, dungeonShallow: false }),
    [FOOTSTEP.Stone1, FOOTSTEP.Stone2]);
});

test('footsteps: the stride - 2.5 units, alternating clips, the half-speed volume, stillness', () => {
  const m = new FootstepMachine();
  m.ignoreLostGrounding = false;   // boot swallow tested separately
  const set = [FOOTSTEP.Outside1, FOOTSTEP.Outside2];
  const flags = { grounded: true, standingStill: false, swimming: false, levitating: false, halfSpeed: false };
  const walk = (x) => m.update([x, 0, 0], flags, set);
  assert.equal(walk(0), null, 'the first frame seeds the position');
  assert.equal(walk(2.0), null, 'under the interval');
  const s1 = walk(2.6);
  assert.deepEqual(s1, { clip: FOOTSTEP.Outside1, volume: FOOTSTEP_VOLUME }, 'over 2.5: the first step');
  const s2 = walk(5.2);
  assert.equal(s2.clip, FOOTSTEP.Outside2, 'the steps alternate');
  // standing still accumulates nothing even as time passes
  const before = m.distance;
  m.update([5.2, 0, 0], { ...flags, standingStill: true }, set);
  assert.equal(m.distance, before);
  // half speed halves the volume (IsMovingLessThanHalfSpeed)
  const s3 = m.update([8.0, 0, 0], { ...flags, halfSpeed: true }, set);
  assert.equal(s3.volume, FOOTSTEP_VOLUME * 0.5);
  assert.equal(WALK_STEP_INTERVAL, 2.5, 'walking and running share the classic interval');
});

test('footsteps: losing the ground silences; the landing plays ONE step; the first landing is swallowed', () => {
  const m = new FootstepMachine();
  const set = [FOOTSTEP.Stone1, FOOTSTEP.Stone2];
  const on = { grounded: true, standingStill: false, swimming: false, levitating: false };
  const off = { ...on, grounded: false };
  m.update([0, 0, 0], on, set);
  // airborne: distance resets, nothing plays no matter how far
  assert.equal(m.update([10, 5, 0], off, set), null);
  assert.equal(m.distance, 0);
  // the FIRST landing after boot is swallowed (ignoreLostGrounding)
  assert.equal(m.update([10, 0, 0], on, set), null, 'the boot landing is silent');
  // the next fall lands with an immediate step
  m.update([12, 4, 0], off, set);
  const land = m.update([12, 0, 0], on, set);
  assert.ok(land && (land.clip === FOOTSTEP.Stone1 || land.clip === FOOTSTEP.Stone2), 'a real landing steps at once');
  // levitation silences and resets the stride
  m.distance = 2.0;
  assert.equal(m.update([20, 0, 0], { ...on, levitating: true }, set), null);
  assert.equal(m.distance, 0);
});

test('footsteps: every host drives the machine into playOneShot', () => {
  for (const f of ['world.js', 'exterior.js', 'worldModes.js', 'dungeon.js']) {
    const s = readFileSync(join(root, 'src/scenes', f), 'utf8');
    assert.ok(/footsteps\.update\(player\.pos|_footsteps\.update\(player\.pos/.test(s), `${f}: the stride runs off the live motor`);
    assert.ok(s.includes('audio.playOneShot(_step.clip, _step.volume)'), `${f}: and plays what comes back`);
    assert.ok(s.includes('pickFootstepSet('), `${f}: with a per-frame set pick`);
  }
  // the modal host splits wood/stone by mode; the exteriors read the snow gate
  const wm = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');
  assert.ok(wm.includes("mode === 'interior'") && wm.includes('inBuilding: true'), 'buildings walk on wood');
  assert.ok(wm.includes('dungeonShallow:'), 'the dungeon water arms ride the block water line');
  for (const f of ['world.js', 'exterior.js']) {
    const s = readFileSync(join(root, 'src/scenes', f), 'utf8');
    assert.ok(s.includes('winter: season === SEASON.Winter'), `${f}: the season feeds the snow gate`);
  }
});
