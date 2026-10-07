// FIELD BUGS 2026-10-02 - the three that are not the climb (test/fb1002_climb.test.js holds those). The third,
// HUNT-FOES (a foe come near the text hunt's box), retired with the hunt itself (2026-10-04); two stand:
//   HELM-NET  - Cruor: "New fishing context pop up clashes with come sail away! Gets in the way especially when trying
//               to aim bow guns";
//   HELM-HUSH - (relayed) "audio cutting when taking helm of a ship".
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fishKind } from '../src/scenes/fishHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { scene } from './csaScene.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Fishing's kind at sea (the Ocean's climate: the net's water everywhere), `busy` the host's. */
function seaNet(busy) {
  const w = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 223, region: 17, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
  const prev = setForagingHost({ world: () => w, entity: () => null });
  const book = { state: { open: true, hauls: 0, caps: { stores: 5000 } }, taken: () => false, counting: () => false, held: () => 0 };
  const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: 223, region: 17 }), eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), feet: () => [0, 0, 0], hour: () => 12, storm: () => false, climateAt: () => 223, trophy: () => true, day: () => 20724, rand: () => 0.5, busy };
  return { k: fishKind({ book, host }), done: () => setForagingHost(prev) };
}

test('HELM-NET: the report - at sea the net\'s water is everywhere, and the cast stood under the crosshair at the helm and over the guns\' aim; while the hands are the ship\'s there is no cast, and a deck stood on still fishes (mutants: busy never asked; busy read backwards)', () => {
  let busy = false;
  const s = seaNet(() => busy);
  try {
    const entity = { items: [{ templateIndex: 1603, currentCondition: 50 }] };
    assert.equal(s.k.looseNodesOf({ entity, dungeon: false }).length, 1, 'on a deck: a cast');
    busy = true;
    assert.deepEqual(s.k.looseNodesOf({ entity, dungeon: false }), [], 'at the helm: none');
  } finally { s.done(); }
});

test('HELM-NET by source: the world host\'s fishing kind is busy at a helm, over laid guns and in a boarding', () => {
  assert.match(src('src/scenes/world.js'), /busy: \(\) => !!csaRuntime\?\.isSailing\?\.\(\) \|\| !!naval\?\.aiming \|\| !!naval\?\.boarding,/);
  assert.match(src('src/scenes/fishHost.js'), /if \(dungeon \|\| host\.busy\?\.\(\) \|\| !foragingToolIn\(entity, FT\.FishingNet\) \|\| !inWater\(\)\) return \[\];/);
});

test('HELM-HUSH: the report - at the helm, the first stroke past the wake\'s threshold and every slowing under it crossfade the boat\'s loops, and the crossfade played the loop it fades out again: the host heard a new play and cut it back to its first sample; a loop already playing goes on (mutants: every play counted again)', () => {
  const s = scene();
  const boat = s.place();
  for (let i = 0; i < 6; i++) s.rt.endOfFrame();   // the placement's fade done
  s.helm(boat);
  const slow = boat.AudioSourceSlow.plays;
  assert.equal(boat.AudioSourceSlow.isPlaying, true);
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  s.rt.update();   // under way past the threshold: PlayFast's crossfade
  assert.equal(boat.AudioSourceFast.isPlaying, true, 'the fast loop played');
  assert.equal(boat.AudioSourceSlow.plays, slow, 'the slow one goes on where it was, not from its first sample');
  for (let i = 0; i < 12; i++) s.rt.endOfFrame();   // the crossfade done: the slow one stopped
  assert.equal(boat.AudioSourceSlow.isPlaying, false);
  const fast = boat.AudioSourceFast.plays;
  s.rt.state.MoveVectorCurrent = [0, 0, 0];
  s.rt.update();   // under the threshold: PlaySlow's crossfade
  assert.equal(boat.AudioSourceFast.plays, fast, 'slowing, the fast one goes on too');
  assert.equal(boat.AudioSourceSlow.isPlaying, true, 'and the slow one plays again from silence');
});

test('HELM-HUSH: one fade handle is every boat\'s - a boat placed stopped another\'s fade-in where it stood, at nothing, the loop left playing silent; the stopped fade lands where it was going (mutants: the stopped fade left where it stood)', () => {
  const s = scene();
  const a = s.place();
  assert.equal(a.AudioSourceSlow.volume, 0, 'the first boat\'s fade at its first step');
  const b = s.place(1, 0, [140, 34, 200]);
  assert.equal(a.AudioSourceSlow.isPlaying, true);
  assert.ok(a.AudioSourceSlow.volume > 0, `the first boat's loop heard (volume ${a.AudioSourceSlow.volume})`);
  for (let i = 0; i < 6; i++) s.rt.endOfFrame();
  assert.ok(b.AudioSourceSlow.volume > 0, 'the second fades in as ever');
});
