// BOW-CLOCK (FIELD BUGS 2026-10-09f, a player's "Archery is weird when turning off 'draw weapon' animation and double
// shot bug", and the owner beside it: "the arrow on the morrowind weapon isnt shown be drawn and shot, or it's
// misalligned"). Under the Morrowind arm a shot's hit waits for the arm's "shoot release" (MW-D42), and the machine's
// cycle could end while the arm was still drawing: the next click started a shot the arm refused to draw, its arrow rode
// the last draw's release (two arrows, one draw) or the 1.2s ceiling (an arrow mid-draw), and the release left over then
// loosed the next draw's arrow at its click. One click is one draw and one arrow now; the arm's leftover release is
// not the next draw's; and the instant shot (BowDrawback off) repeats while the button is held - the owner's departure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { fpArm, createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY } from '../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { getBowCooldownTime } from '../src/characters/weaponStates.js';

const DT = 1 / 60;
const LONG_BOW = () => ({ name: 'Long Bow', templateIndex: 130, material: 0 });
const ARROWS = () => ({ name: 'Arrow', templateIndex: 131, stackCount: 99 });

/** A real rig on a bow, `speed` its Speed; `arm` stands the Morrowind arm in (null: the classic sprite lane). */
function bowRig({ speed = 50, drawback = false } = {}) {
  resetToDefaults(); _resetModSettings();
  setValue('Controls', 'BowDrawback', drawback ? 'True' : 'False');
  const entity = { items: [ARROWS()], equip: { slots: { [EQUIP_SLOTS.RightHand]: LONG_BOW() } }, stats: { speed } };
  const r = createWeaponRig({
    renderer: { uploadTexture: (_k, name) => name, drawScreenQuad: () => {} },
    canvas: { width: 320, height: 200, clientWidth: 320, clientHeight: 200 },
    entity, audio: { playOneShot: () => {}, play: () => {}, play3d: () => {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
    fetchBytes: async () => { throw new Error('no art in this pin'); }, activateHeld: () => false,
  });
  r.toggleSheath();
  for (let i = 0; i < 90; i++) r.frame(DT);
  return r;
}

/**
 * The Morrowind arm stood in, on the real arm's own acceptance law: attack() takes an idle or following-through arm
 * and refuses one still drawing or loosing (fpArm.js attack's `upper !== WeaponEquipped` after AttackEnd's cut), its
 * "shoot release" lands `draw` seconds after the draw began, and shotBusy answers for the draw. `clearsStale` is the
 * real arm's BOW-CLOCK clear at the draw; false stands in the arm as it was.
 */
function standInArm({ draw, clearsStale = true }) {
  const keys = ['ready', 'active', 'thirdActive', 'attack', 'takeShootRelease', 'shotBusy', 'update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setHipLight', 'setWerewolf', 'setWeapon', 'setScreenTransform', 'draw'];
  const saved = Object.fromEntries(keys.map((k) => [k, fpArm[k]]));
  const st = { t: 0, at: -1, released: false, draws: [], asked: 0 };
  const drawing = () => st.at >= 0 && st.t - st.at < draw;
  Object.assign(fpArm, {
    ready: () => true, active: () => true, thirdActive: () => false, setWeapon: () => true,
    attack: () => {
      st.asked++;
      if (drawing()) return null;
      st.at = st.t; st.draws.push(st.t);
      if (clearsStale) st.released = false;
      return 'shoot';
    },
    takeShootRelease: () => { if (!st.released) return false; st.released = false; return true; },
    shotBusy: () => drawing(),
    update: (dt) => { st.t += dt; if (st.at >= 0 && st.t - st.at >= draw && st.t - dt - st.at < draw) st.released = true; },
  });
  for (const k of ['release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setHipLight', 'setWerewolf', 'setScreenTransform', 'draw']) fpArm[k] = () => {};
  return { st, restore: () => Object.assign(fpArm, saved) };
}

/** Drive `seconds` of input - `press(i)` the button on frame i - and answer the frame of every arrow. */
function play(r, seconds, press) {
  const arrows = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    r.attackInput(0, 0, press(i));
    for (const ev of r.frame(DT)) if (ev === 'hit') arrows.push(i);
  }
  return arrows;
}

const spam = (i) => i % 12 < 3;   // a 50 ms click every 200 ms

test('BOW-CLOCK: spam-clicking under a slow-drawing arm - one arrow per draw, each at its own draw\'s release', () => {
  // Speed 90 cycles the instant shot in ~1.17s (four ticks and getBowCooldownTime); a 1.4s draw outlasts it. Before:
  // a click at the cycle's end started a shot the arm refused, and two arrows left one draw.
  for (const [speed, draw] of [[90, 1.4], [50, 1.4], [90, 0.8], [50, 2.2]]) {
    const r = bowRig({ speed });
    const { st, restore } = standInArm({ draw });
    try {
      st.t = 0;
      const t0 = st.t;
      const arrows = play(r, 8, spam).map((i) => (i + 1) * DT);
      const draws = st.draws.map((t) => t - t0);
      assert.ok(draws.length >= 3, `speed ${speed}, draw ${draw}s: the arm drew (${draws.length})`);
      assert.equal(st.asked, draws.length, `speed ${speed}, draw ${draw}s: every shot the rig started, the arm drew`);
      // every arrow is its own draw's, at that draw's release - never two in one draw, never one with no draw
      for (const [k, a] of arrows.entries()) {
        assert.ok(k < draws.length, `speed ${speed}, draw ${draw}s: arrow ${k} has a draw of its own`);
        assert.ok(Math.abs(a - (draws[k] + draw)) <= 2 * DT,
          `speed ${speed}, draw ${draw}s: arrow ${k} at ${a.toFixed(2)}s, its draw's release ${(draws[k] + draw).toFixed(2)}s`);
      }
      assert.ok(arrows.length >= draws.length - 1, `speed ${speed}, draw ${draw}s: no draw loosed nothing but the last`);
    } finally {
      restore();
    }
  }
});

test('BOW-CLOCK: the touch button\'s tap waits on the arm as the drag does', () => {
  const r = bowRig({ speed: 90 });
  const { st, restore } = standInArm({ draw: 1.4 });
  try {
    const arrows = [];
    for (let i = 0; i < 8 * 60; i++) {
      if (i % 12 === 0) r.clickAttack();   // ClickToAttack, the touch layer's door
      for (const ev of r.frame(DT)) if (ev === 'hit') arrows.push(i);
    }
    assert.ok(st.draws.length >= 3, `the arm drew (${st.draws.length})`);
    assert.equal(st.asked, st.draws.length, 'every tap the rig took, the arm drew');
    assert.ok(arrows.length >= st.draws.length - 1 && arrows.length <= st.draws.length, `one arrow a draw (${arrows.length} arrows, ${st.draws.length} draws)`);
  } finally {
    restore();
  }
});

test('BOW-CLOCK: an arm still drawing past the 1.2s ceiling keeps the arrow until its release - and never for ever', () => {
  {
    const r = bowRig({ speed: 50 });
    const { st, restore } = standInArm({ draw: 2.0 });
    try {
      const arrows = play(r, 2.5, (i) => i === 0);
      assert.equal(arrows.length, 1, 'one arrow');
      assert.ok(Math.abs((arrows[0] + 1) * DT - (st.draws[0] + 2.0)) <= 2 * DT, `at the release, 2.0s in - not at the ceiling (${((arrows[0] + 1) * DT).toFixed(2)}s)`);
    } finally {
      restore();
    }
  }
  {
    // A SILENT ARM (no "shoot release" in its .kf, so never busy and never releasing): each shot falls to the 1.2s
    // ceiling - and the next waits for it. At Speed 90 the machine cycles in ~1.17s, inside the ceiling, and a shot
    // started over a held one merged into it: two draws, one arrow.
    const r = bowRig({ speed: 90 });
    const { st, restore } = standInArm({ draw: 1e9 });
    try {
      fpArm.shotBusy = () => false;
      fpArm.attack = () => { st.draws.push(st.t); return 'shoot'; };
      const arrows = play(r, 8, () => true);
      assert.ok(arrows.length >= 4, `the silent arm still shoots (${arrows.length})`);
      assert.ok(st.draws.length - arrows.length <= 1, `every shot its arrow - ${st.draws.length} shots, ${arrows.length} arrows`);
    } finally {
      restore();
    }
  }
  {
    // NEVER-TRAPS: an arm that says it is drawing for ever still lets the arrow go, at the cap
    const r = bowRig({ speed: 50 });
    const { restore } = standInArm({ draw: 1e9 });
    try {
      const arrows = play(r, 5, (i) => i === 0);
      assert.equal(arrows.length, 1, 'the shot is not swallowed');
      const at = (arrows[0] + 1) * DT;
      assert.ok(at > 3.9 && at < 4.3, `it lands at the 4s cap (${at.toFixed(2)}s)`);
    } finally {
      restore();
    }
  }
});

test('BOW-CLOCK: the instant shot repeats while the button is held, at the machine\'s own rate - on the sprite and under the arm', () => {
  // THE OWNER'S DEPARTURE: DFU's WeaponManager looses again only once the button was released since the last shot
  // (lastAttackHand == Hand.None). With BowDrawback off a held button looses the moment the bow is ready.
  const cycle = 4 * 0.0625 + getBowCooldownTime(50);   // StrikeDown from the drawn frame 3 to 7, then the cooldown
  {
    const r = bowRig({ speed: 50 });
    const arrows = play(r, 6, () => true);
    assert.ok(arrows.length >= 3, `the sprite bow looses again and again (${arrows.length} in 6s)`);
    for (let k = 1; k < arrows.length; k++) {
      assert.ok((arrows[k] - arrows[k - 1]) * DT >= cycle - 2 * DT, `never faster than the machine allows (${((arrows[k] - arrows[k - 1]) * DT).toFixed(2)}s)`);
    }
  }
  {
    const r = bowRig({ speed: 50 });
    const { st, restore } = standInArm({ draw: 0.8 });
    try {
      const arrows = play(r, 6, () => true);
      assert.ok(arrows.length >= 3 && st.draws.length >= arrows.length, `under the arm too, each with its draw (${arrows.length} arrows, ${st.draws.length} draws)`);
    } finally {
      restore();
    }
  }
  {
    // the drawn bow keeps DFU's edge: held, it draws once and holds - it looses on the release
    const r = bowRig({ speed: 50, drawback: true });
    const arrows = play(r, 6, () => true);
    assert.equal(arrows.length, 0, 'a drawn bow held looses nothing');
  }
  {
    // and under the arm its release is never held back: the arm is still drawing when the button lets go (shotBusy),
    // and only a shot's START waits on that
    const r = bowRig({ speed: 50, drawback: true });
    const { st, restore } = standInArm({ draw: 2.0 });
    try {
      const arrows = play(r, 3, (i) => i < 30);
      assert.equal(arrows.length, 1, 'the drawn bow looses on the release');
      assert.ok(Math.abs((arrows[0] + 1) * DT - (st.draws[0] + 2.0)) <= 2 * DT, 'at the arm\'s release key');
    } finally {
      restore();
    }
  }
});

// --- the real arm's two clocks, on the fixtures --------------------------------------------------

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};
function bowDeps() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
    ['meshes/w/arrow.nif', f('arrow.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = Uint8Array.from([
    ...wpdt('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
    ...wpdt('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
  ]);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
}

test('BOW-CLOCK: the real arm - shotBusy through the bow coming up and the draw, and a leftover release cleared at the next draw', async () => {
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  const res = await arm.build({ race: 'fprace', weapon: { templateIndex: 130 }, hasAmmo: true, deps: bowDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.update(0.05);
  assert.equal(arm.shotBusy(), false, 'a sheathed arm holds no shot up');
  arm.setSheathed(false);
  arm.update(0.01);
  assert.equal(arm.status().upper, UPPER_BODY.Equipping);
  assert.equal(arm.shotBusy(), true, 'the bow coming up cannot draw yet');
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.shotBusy(), false, 'the bow up and idle can');
  assert.equal(arm.attack('StrikeDown'), 'shoot');
  assert.equal(arm.shotBusy(), true, 'drawing');
  // shoot start 5.8 -> shoot max attack 6.2 -> shoot release 6.4: busy every frame until the release, and not after
  let busyFrames = 0;
  for (let i = 0; i < 40 && arm.status().upper !== UPPER_BODY.AttackEnd; i++) {
    if (arm.shotBusy()) busyFrames++;
    arm.update(0.05);
  }
  assert.equal(arm.status().upper, UPPER_BODY.AttackEnd, 'the arrow loosed');
  assert.ok(busyFrames >= 10, `busy through the draw and the release (${busyFrames} frames of 0.05s)`);
  assert.equal(arm.shotBusy(), false, 'past "shoot release" the follow-through takes the next draw');
  // the rig never asked for this release (its arrow already went at the ceiling): it is LEFT OVER
  for (let i = 0; i < 40 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.attack('StrikeDown'), 'shoot', 'the next draw');
  assert.equal(arm.takeShootRelease(), false, 'and the last draw\'s release is not its own');
  for (let i = 0; i < 40 && !arm.takeShootRelease(); i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.AttackEnd, 'its own comes at its own "shoot release"');
});
