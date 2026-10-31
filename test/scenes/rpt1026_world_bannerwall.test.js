// RPT1026-WORLD BANNER-WALL (a private report, 2026-10-25: a guild hall bought in Wildertown, a small square house
// whose new door cloths flank its door, one of them hanging in mid-air): A CLOTH HANGS
// ON ITS WALL OR NOT AT ALL. The house's frame as the pixel build makes it (scenes/pixelBuild.js: the first model's box,
// its first door's corners and outward normal - hallBanners.js doorCornersOf, doorNormalOf) over the player's own data,
// Wildertown laid out with the town packs on the door as the game serves it (test/arena1Data.mjs), and the law
// (hallBanners.js hallBannerAnchors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAS_ARENA2, bootDoor, classicModels } from '../arena1Data.mjs';
import { layoutLocation } from '../../src/world/locationLayout.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';
import { trs, multiply } from '../../src/world/mat4.js';
import { transformedAabb, localAabb } from '../../src/render/frustum.js';
import { doorCornersOf, doorNormalOf, hallBannerAnchors, BANNER_OUT_M, BANNER_SIDE_GAP_M, BANNER_WALL_PAD_M } from '../../src/scenes/hallBanners.js';
import { BANNER_W_M } from '../../src/render/bannerPass.js';

/** A town's building frames as the pixel build takes them, by building key. */
async function framesOf(name) {
  const { maps, blocks } = await bootDoor({ packs: true, arena: true });
  const modelOf = classicModels();
  let loc = null;
  for (let r = 0; r < maps.regionCount && !loc; r++) {
    if (!maps.loadRegion(r)) continue;
    const reg = maps._regions[r]?.dfRegion;
    if (reg?.mapNameLookup?.has(name)) loc = maps.getLocation(r, reg.mapNameLookup.get(name));
  }
  const lay = layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true });
  const frames = new Map();
  for (const b of lay.blocks) {
    const origin = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      if (!Number.isSafeInteger(placed.recordIndex)) continue;
      const cpu = modelOf(placed.modelIdNum);
      if (!cpu) continue;
      const local = multiply(origin, placed.matrix);
      const key = makeBuildingKey(b.x, b.y, placed.recordIndex);
      let f = frames.get(key);
      if (!f) frames.set(key, f = { model: placed.modelIdNum, box: [...transformedAabb(localAabb(cpu.positions), local)] });
      if (cpu.doors?.length && !f.door) { f.door = doorCornersOf(cpu.doors[0], local); f.normal = doorNormalOf(cpu.doors[0], local); }
    }
  }
  return frames;
}
/** Whether a cloth's two ends, where it meets its wall, stand on its building's box. */
const onTheBox = (a, box) => [-1, 1].every((e) => {
  const x = a.top[0] - a.out[0] * BANNER_OUT_M + a.right[0] * e * BANNER_W_M / 2, z = a.top[2] - a.out[2] * BANNER_OUT_M + a.right[2] * e * BANNER_W_M / 2;
  return x >= box[0] - BANNER_WALL_PAD_M && x <= box[3] + BANNER_WALL_PAD_M && z >= box[2] - BANNER_WALL_PAD_M && z <= box[5] + BANNER_WALL_PAD_M;
});

test('BANNER-WALL the law: a door in its wall\'s middle hangs two; one at the wall\'s end, the one on the wall; a door no wider than its wall, none; a frame without a door or a box, null', () => {
  const box = [0, 0, 0, 10, 6, 6];   // a house 10 m along x, its front at z = 0, its door facing -z
  const door = (x0, x1) => ({ a: [x0, 0, 0], b: [x1, 2.2, 0] });
  const mid = hallBannerAnchors({ box, door: door(4.4, 5.6), normal: [0, 0, -1] });
  assert.equal(mid.length, 2);
  const reach = 0.6 + BANNER_SIDE_GAP_M + BANNER_W_M;   // the door's half, the jamb's gap, the cloth
  const end = hallBannerAnchors({ box, door: door(10 - 1.2, 10), normal: [0, 0, -1] });
  assert.equal(end.length, 1, 'the far cloth would hang past x = 10');
  assert.ok(end[0].top[0] < 10 - 0.6 - BANNER_SIDE_GAP_M && end[0].top[0] > 10 - 0.6 - reach - 0.01, 'the near one, by the door');
  assert.deepEqual(hallBannerAnchors({ box: [0, 0, 0, 1.3, 6, 6], door: door(0, 1.2), normal: [0, 0, -1] }), [], 'a booth: no room for either');
  assert.equal(hallBannerAnchors({ box }), null);
  assert.equal(hallBannerAnchors({ door: door(4, 5) }), null);
});
