// FIELD BUGS 2026-10-27 HELM-SIGHT (bible/01-Overview/bugs/Field-Bugs-2026-10-27.md; the Discord's #bug-reports,
// "Sailing Vessels Sometimes Have No Propulsion"): a party's journey holds the helm until its landing is sure
// (scenes/world.js fastTravelTo), so the world re-anchored under a held helm. Her boat was hidden for the far pixel and
// shown again on the way back, her sails' Animators started over stowed, and the helm still read them set: no way under
// sail, and W said "All sail is set." She stays in sight now; a landing that succeeds and lets the helm go from afar
// leaves a ship it does not pack at her own pixel, hidden (the arrival's pixel had been stamped on her, and her loop
// heard from wherever she lay). Driven on the real runtime (test/csaScene.mjs, the real SpawnBoat and Animators).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';
import { animatorOf } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';

const KN = 3600 / 1852;
const FAR_PIXEL = 40;
/** At the helm of `hull` under sail in a wind, then the world re-anchored to a far pixel and back, the helm held. */
function jumpedAndBack(hull) {
  const s = scene();
  s.deps.handling = () => 'responsive';
  const px = { X: 10, Y: 20 };
  s.deps.currentMapPixel = () => ({ ...px });
  s.rt.OnNewHour();
  const boat = s.helm(s.place(hull, 0));
  s.frame();
  s.rt.ToggleSails();
  for (let t = 0; t < 10; t += 0.25) s.frame();
  const before = s.rt.helmPanelState().way;
  px.X = FAR_PIXEL;
  s.rt.OnWorldReanchored([0, 0, 0]);
  const shownAway = boat.GameObject.activeSelf;
  // the party's wait: world.js holds the mod's frame (`_partyArrivalPending`), and its Animators still step
  for (let i = 0; i < 4; i++) { s.rt.endOfFrame(); s.rt.fixedUpdate({ paused: true }); s.rt.update({ paused: true }); s.rt.lateUpdate({ paused: true }); }
  px.X = 10;
  s.rt.OnWorldReanchored([0, 0, 0]);
  for (let t = 0; t < 15; t += 0.25) s.frame();
  return { s, boat, before, shownAway };
}

for (const [hull, name] of [[2, 'Small Ship'], [1, 'Large Boat'], [4, 'Carrack']]) {
  test(`HELM-SIGHT: a ${name} whose helm is held across a jump away and back keeps her sails set and makes way`, () => {
    const { s, boat, before, shownAway } = jumpedAndBack(hull);
    assert.ok(before * KN > 2, `under way before the jump (${(before * KN).toFixed(2)} kn)`);
    assert.equal(shownAway, true, 'the held helm\'s boat stays in sight across the jump');
    assert.equal(s.rt.helmPanelState().sailsUp, true);
    for (const sail of boat.Sails) assert.equal(animatorOf(sail).GetBool('Stowed'), false, 'no sail started over stowed');
    assert.ok(s.rt.helmPanelState().way * KN > 2, `under sail at ${(s.rt.helmPanelState().way * KN).toFixed(2)} kn (it made 0.00)`);
  });
}

test('HELM-SIGHT: a landing that succeeds lets the helm go from afar - a ship it does not pack keeps her own pixel and is hidden, her loop silent', () => {
  const s = scene();
  s.deps.handling = () => 'responsive';
  const px = { X: 10, Y: 20 };
  s.deps.currentMapPixel = () => ({ ...px });
  const boat = s.helm(s.place(4, 0));
  // AUDIT HELM-SIGHT C1: as the game mints her - crewed and packable, placed by her deed (its UID on her, takePlaceItem)
  // and that deed not in the pack, so PackBoat refuses her and she stays where she lies
  boat.uid = 7;
  assert.deepEqual([boat.crewed, boat.packable], [true, true]);
  s.frame();
  s.rt.ToggleSails();
  for (let i = 0; i < 8; i++) s.frame();
  px.X = FAR_PIXEL;
  s.rt.OnWorldReanchored([0, 0, 0]);
  s.rt.OnPreFastTravel();   // world.js fastTravelTo: the landing is sure
  assert.equal(s.rt.isSailing(), false);
  assert.ok(s.rt.AllBoats.includes(boat), 'not packed: her deed is not in the pack');
  assert.deepEqual(boat.MapPixel, { X: 10, Y: 20 }, 'her own pixel, not the landing\'s');
  assert.equal(boat.GameObject.activeSelf, false, 'hidden from the landing');
  assert.equal(boat.AudioSourceSlow.isPlaying, false, 'her loop silent');
  s.rt.OnPositionUpdate([0, 0, 0]);   // the next recentre at the landing
  assert.equal(boat.GameObject.activeSelf, false, 'still hidden');
  px.X = 10;
  s.rt.OnWorldReanchored([0, 0, 0]);   // her owner comes back for her
  assert.equal(boat.GameObject.activeSelf, true);
});

test('HELM-SIGHT: a boat nobody holds is still hidden for the far pixel and shown on the way back', () => {
  const s = scene();
  const px = { X: 10, Y: 20 };
  s.deps.currentMapPixel = () => ({ ...px });
  const moored = s.place(2, 0);
  const held = s.helm(s.place(1, 0, [100, 34, 260]));
  px.X = FAR_PIXEL;
  s.rt.OnWorldReanchored([0, 0, 0]);
  assert.deepEqual([moored.GameObject.activeSelf, held.GameObject.activeSelf], [false, true]);
  px.X = 10;
  s.rt.OnWorldReanchored([0, 0, 0]);
  assert.deepEqual([moored.GameObject.activeSelf, held.GameObject.activeSelf], [true, true]);
});
