// MWNPC15 (2026-10-10, the MW-NPC arc's fifteenth slice - bible/04-Characters/Morrowind-NPCs.md section 20): THE
// WEREWOLF FOE IN BLOODMOON'S WOLF. The player's werewolf (WEREWOLF1) and a peer's already stand in it, PeerBodies
// building the wolf for a pose whose `wb` bit says so and refusing it - once, for the data - where Bloodmoon is not
// attached. A werewolf foe is a person in its beast form: its look says `wolf`, the lane hands PeerBodies the wire's own
// bit (characters/npcBodies.js npcShown), and the wolf it builds is the one a transformed player wears; where it is
// refused, the foe's sprite stands. Pinned on the foes' looks, on the pose, and on a lane of stub rigs that record what
// they are asked to build and refuse a wolf at its skeleton.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foeActor, isPersonFoe, rosterLook, WOLF_MOBILE } from '../src/characters/foeBodies.js';
import { residentLook } from '../src/characters/rosterBodies.js';
import { CREATURE_MATCH } from '../src/characters/creatureBodies.js';
import { createNpcBodies, npcShown } from '../src/characters/npcBodies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { createEquipTable } from '../src/characters/equipTable.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const foe = (mobileType) => ({ mobileType, marker: [4, 0, 2], gender: 'male', entity: { isClass: mobileType >= 128, equip: createEquipTable(), items: [] }, ai: { feet: [0, 0, -3], yaw: 0, moving: false, giveUpTimer: 0 } });

test('MWNPC15-1 the werewolf is a person in its beast form: its look a person\'s marked wolf, bare-handed; the pose carries the wire\'s wolf bit; the living none; never a creature; a road\'s the same', () => {
  assert.equal(WOLF_MOBILE, M.Werewolf);
  const w = foe(M.Werewolf);
  assert.equal(isPersonFoe(w), true);
  const a = foeActor(w);
  assert.equal(a.look.wolf, true);
  assert.equal(npcShown(a).wb, 1, 'the wire\'s own bit');
  assert.equal(npcShown(foeActor(foe(M.Thief))).wb, 0, 'a person on two legs');
  assert.equal(npcShown(foeActor(foe(M.Rat))).wb, 0, 'a creature is no wolf');
  assert.ok(CREATURE_MATCH[M.Werewolf].miss, 'never a creature');
  assert.equal(CREATURE_MATCH[M.Wereboar].miss, 'no wereboar', 'Bloodmoon has no boar');
  const r = rosterLook({}, { mobileType: M.Werewolf, seed: 2 });
  assert.equal(r.wolf, true);
  assert.equal(r.items.filter((it) => it.group === 'Weapons').length, 0, 'its claws its own');
  assert.equal(residentLook({}, { id: 'enc:2', cls: M.Werewolf, sex: 'male', name: '' })?.wolf, true, 'a road\'s werewolf');
});

test('MWNPC15-2 the lane builds it as Bloodmoon\'s wolf (the build asked for the werewolf) and stands it; where the data refuses the wolf at its skeleton, it is refused once and the sprite stands', async () => {
  const asked = [];
  const rig = (wolfOk) => () => {
    const r = { mode: 'first', skinned: false, attach() {},
      async build(o) { asked.push(o); await flush(); return o.werewolf && !wolfOk ? { ok: false, stage: 'skeleton', error: 'no wolf' } : { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned,
      update(dt, o) { if (o?.pose !== false) r.skinned = true; }, drawThird() { return true; }, unload() {}, setSheathed() {}, revive() {} };
    return r;
  };
  const run = async (wolfOk) => {
    asked.length = 0;
    const lane = createNpcBodies({ renderer: {}, tier: () => 'near', createRig: rig(wolfOk), now: () => 1000, warn: () => {} });
    const wolf = foeActor(foe(M.Werewolf)), man = { ...foeActor(foe(M.Thief)), id: 'man', feet: [1, 0, -3] };
    for (let i = 0; i < 12; i++) { lane.begin(); lane.stand('foe', wolf); lane.stand('foe', man); lane.end(1 / 60, [0, 0, 0]); await flush(); await flush(); }
    const out = { wolf: lane.has('foe', wolf.id), man: lane.has('foe', 'man'), werewolfBuilds: asked.filter((o) => o.werewolf).length };
    lane.destroy();
    return out;
  };
  const ok = await run(true);
  assert.deepEqual([ok.wolf, ok.man], [true, true], 'the wolf stands in its body');
  assert.ok(ok.werewolfBuilds >= 1, 'built as the werewolf');
  const refused = await run(false);
  assert.equal(refused.wolf, false, 'no wolf in this data: its sprite');
  assert.equal(refused.man, true, 'the man beside it unaffected');
  assert.equal(refused.werewolfBuilds, 1, 'refused once for the data, never asked again every frame');
});
