// HORSE-POV (2026-10-12, the owner: "Theres an issue when using the morrow8nd models for the horse, the 2d sprite is
// still painted on the screen, especially in third person"): the riding sprite (player/mountRig.js) is the view from
// the saddle; the Morrowind body in third person is seen from behind, its horse in the world in 3D (COATS3D) - so
// player/mwView.js mwViewHides hides the first-person horse there. Its own file: the hides read the lane, and the
// COATS3D file's earlier tests leave the sprite lane standing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
test('HORSE-POV (the owner: "when using the morrowind models for the horse, the 2d sprite is still painted on the screen, especially in third person"): the Morrowind body in third person hides the first-person riding sprite - its horse is in the world - and first person keeps it (mutants: the third-person arm dropped; first person hidden too)', async () => {
  const mv = await import('../../src/player/mwView.js');
  const { mwCamera } = await import('../../src/player/mwCamera.js');
  const base = mwCamera.baseDistance();
  try {
    mwCamera.restore({ firstPerson: true, baseDistance: base });
    assert.equal(mv.mwViewHides().horse, false, 'first person: the saddle\'s view is the sprite (or the 3D horse drawn in its place)');
    mwCamera.restore({ firstPerson: false, baseDistance: base });
    assert.equal(mv.mwViewHides().horse, true, 'third person: no riding sprite over the screen');
    assert.equal(mv.mwViewHides().weapon, false, 'only the horse - the hands are the rig\'s view mode');
  } finally { mwCamera.restore({ firstPerson: true, baseDistance: base }); }
  assert.match(rd('src/player/mwView.js'), /if \(!eotbLane\(\) && mwCamera\.thirdPerson\(\)\) return \{ \.\.\.hides, horse: true \};\n\s*return benchSeated/);
  // the sprite's gate is the hides' (both arms of mountRig.frame ask it)
  assert.match(rd('src/player/mountRig.js'), /if \(art && isRiding\(player\.transportMode\) && !ridePaused && !mwViewHides\(\)\.horse\) \{/);
});
