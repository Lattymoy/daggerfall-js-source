// AUDIT HELM-SIGHT (bible/01-Overview/audits/Audit-Helm-Sight.md): FIELD BUGS 2026-10-27 HELM-SIGHT read cold. The runtime's
// halves of its findings, on the real runtime (test/csaScene.mjs, the real SpawnBoat and Animators), each re-anchor
// moved by the frame's own offset as world.js _teleportToPixel moves it. The world host's halves are
// test/scenes/audit_helmsight_world.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';

const TS = 819.2;
/** At the helm of `hull` under sail in a wind at pixel 10,20 - placed by her deed as the game places a ship, its deed not in
 *  the pack, so a let-go never packs her. */
function underWay(hull = 4) {
  const s = scene();
  s.deps.handling = () => 'responsive';
  const px = { X: 10, Y: 20 };
  s.deps.currentMapPixel = () => ({ ...px });
  s.rt.OnNewHour();
  const boat = s.helm(s.place(hull, 0));
  boat.uid = 7;
  s.frame();
  s.rt.ToggleSails();
  for (let t = 0; t < 10; t += 0.25) s.frame();
  return { s, boat, px };
}
/** A jump of the world's frame to `to`, with the offset _teleportToPixel's init gives it. */
function jump(s, px, to) {
  const offset = [(px.X - to.X) * TS, 0, (to.Y - px.Y) * TS];
  Object.assign(px, to);
  s.rt.OnWorldReanchored(offset);
}

for (const [name, to] of [['one pixel east', { X: 11, Y: 20 }], ['two pixels east', { X: 12, Y: 20 }], ['forty pixels south', { X: 10, Y: 60 }], ['one pixel south-west', { X: 9, Y: 21 }]]) {
  test(`AUDIT HELM-SIGHT A2, C2: a party's landing ${name} of her lets the helm go with her own pixel left on her`, () => {
    const { s, boat, px } = underWay();
    jump(s, px, to);
    assert.equal(boat.helmAfar, true, 'held from another pixel than hers');
    s.rt.OnPreFastTravel();   // world.js fastTravelTo's let-go, the landing sure
    assert.ok(s.rt.AllBoats.includes(boat), 'not packed');
    assert.deepEqual(boat.MapPixel, { X: 10, Y: 20 }, 'the landing\'s pixel was stamped on her');
    assert.equal(boat.helmAfar, false, 'C5: the let-go clears it - the world host silences her loops while it holds');
    const near = Math.max(Math.abs(to.X - 10), Math.abs(to.Y - 20)) <= 1;
    assert.equal(boat.GameObject.activeSelf, near, near ? 'within a pixel of her: in sight' : 'past a pixel: hidden');
    // the owner walks to the pixel west of her: one pixel off, she stands
    jump(s, px, { X: 9, Y: 20 });
    assert.equal(boat.GameObject.activeSelf, true);
  });
}

test('AUDIT HELM-SIGHT A2: a jump that lands on her own pixel leaves the helm as aboard - not afar, her pixel stamped as the mod stamps it', () => {
  const { s, boat, px } = underWay();
  jump(s, px, { X: 10, Y: 20 });
  assert.equal(boat.helmAfar, false);
  s.rt.StopSailing();
  assert.deepEqual(boat.MapPixel, { X: 10, Y: 20 });
  assert.equal(boat.GameObject.activeSelf, true);
});

test('AUDIT HELM-SIGHT A3: a re-anchor while the disembark key\'s stop is in flight hides her for the far landing, as any boat no helm holds', () => {
  const { s, boat, px } = underWay();
  s.rt.StopSailingDelayed();   // its head ran; CurrentBoat goes at the next frame's end
  jump(s, px, { X: 40, Y: 20 });
  assert.equal(boat.helmAfar, false, 'no helm holds her');
  assert.equal(boat.GameObject.activeSelf, false, 'thirty pixels off: hidden');
  s.rt.OnPreFastTravel();   // the landing: nothing sails, nothing to let go
  for (let i = 0; i < 8; i++) s.frame();
  assert.equal(s.rt.state.CurrentBoat, null);
  assert.equal(boat.GameObject.activeSelf, false);
  assert.equal(boat.AudioSourceFast.isPlaying, false, 'her loops stopped with her');
});

test('AUDIT HELM-SIGHT A4: held from another pixel she is marked so (the world host does not play her loops) until the helm is let go or she is home', () => {
  const { s, boat, px } = underWay();
  jump(s, px, { X: 40, Y: 20 });
  assert.deepEqual([boat.GameObject.activeSelf, boat.helmAfar], [true, true], 'in sight for her sails, marked unheard');
  jump(s, px, { X: 10, Y: 20 });   // the landing failed: back at her helm
  assert.equal(boat.helmAfar, false, 'home: heard again');
  assert.equal(s.rt.isSailing(), true);
});

test('AUDIT HELM-SIGHT A1: a helm still held from another pixel when the frame runs again - a party\'s jump to a pixel this client does not stream, no landing to let it go - is let go there, never pinning the player back at the departure', () => {
  const { s, boat, px } = underWay();
  jump(s, px, { X: 40, Y: 20 });   // the core took the landing's word away: nothing let go there
  s.player.position = [400, 30, 400];   // stood at the landing
  s.frame();   // the journey over, world.js lets the mod's frame run
  assert.equal(s.rt.isSailing(), false);
  assert.deepEqual(s.player.position, [400, 30, 400], 'not pinned back at the departure helm');
  assert.deepEqual([boat.MapPixel, boat.GameObject.activeSelf], [{ X: 10, Y: 20 }, false]);
});

test('AUDIT HELM-SIGHT A1: through the party\'s wait (the mod\'s frame held) the helm stays held - only the frame that runs again lets it go', () => {
  const { s, px } = underWay();
  jump(s, px, { X: 40, Y: 20 });
  for (let i = 0; i < 4; i++) { s.rt.endOfFrame(); s.rt.fixedUpdate({ paused: true }); s.rt.update({ paused: true }); s.rt.lateUpdate({ paused: true }); }
  assert.equal(s.rt.isSailing(), true, 'a landing still to come may yet let it go itself, or bring her back aboard');
});

test('AUDIT HELM-SIGHT C5 (the fold): a disembark begun while the helm is held from another pixel clears the flag as it lets go - her loops are heard again', () => {
  const { s, boat, px } = underWay();
  jump(s, px, { X: 40, Y: 20 });
  assert.equal(boat.helmAfar, true);
  s.rt.StopSailingDelayed();
  s.rt.endOfFrame();   // the stop's unparent, at the frame's end
  assert.equal(boat.helmAfar, false);
});
