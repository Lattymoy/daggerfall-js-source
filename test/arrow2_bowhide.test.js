// ARROW2 (Discord: "when shooting arrows with the sprite bow it shoots
// sprite arrows and 3d arrows at the same time"): FPSWeapon.AnimateWeapon
// hides the bow the moment its release runs off the last frame
// (FPSWeapon.cs:527-531, "so its idle frame doesn't show before it is
// hidden for its cooldown"), and WeaponManager's cooldown early return
// (:229-233) leaves it hidden until the cooldown ends. The idle and draw
// frames (0-3) carry the nocked arrow; drawn while the loosed 99800 shaft
// flies, the player sees two arrows. Driven through the real rig and the
// real Weapon Widget, over a synthetic one-record WEAPON09.CIF.
//
// And the two DFU laws behind the widget lane: the bow idles at frame 3
// with BowDrawback off (FPSWeapon.cs:533-534), so the instant shot looses
// at +2 ticks as the widget's clone does, not after a whole draw; and the
// machine steps ONCE per resume (FPSWeapon.cs:545), so it never runs
// ahead of the clone's coroutine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';

/** WEAPON09.CIF: one WeaponAnim record, 7 frames of 100x80 (all index 0, one shared RLE block). */
function bowCif() {
  const W = 100, H = 80, head = 12 + 31 * 2 + 2;
  const runs = Math.ceil((W * H) / 128);
  const b = new Uint8Array(head + runs * 2);
  const v = new DataView(b.buffer);
  v.setUint16(0, W, true); v.setUint16(2, H, true);
  for (let f = 0; f < 7; f++) v.setUint16(12 + f * 2, head, true);
  for (let k = 0; k < runs; k++) b[head + k * 2] = 255;   // a run of 128 transparent pixels
  v.setUint16(12 + 62, b.length, true);
  return b;
}
const NOCKED = /:0:[0-3]$/;   // fpw:WEAPON09.CIF:<metal>:<record 0>:<frame 0..3>

async function bowRig({ drawback, widget, doubleScale = false }) {
  resetToDefaults(); _resetModSettings();
  setValue('Controls', 'BowDrawback', drawback ? 'True' : 'False');
  setModSetting('weapon-widget', 'Enabled', widget);
  // DISC14-B: the law is pinned on the mod's SHIPPED Weapon Widget settings. The port defaults DoubleScaleTextures on
  // now, and its doubled-idle bob (bobStep's xMin/yMax 0) can lift the hidden bow a sliver - the case below.
  setModSetting('weapon-widget', 'Modules.DoubleScaleTextures', doubleScale);
  const quads = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex, rect) => quads.push({ tex, rect }) };
  const canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200 };
  const entity = {
    items: [{ name: 'Arrow', templateIndex: 131, stackCount: 20 }],
    equip: { slots: { [EQUIP_SLOTS.RightHand]: { name: 'Long Bow', templateIndex: 130, material: 0 } } },
    stats: { speed: 50 },
  };
  let activate = false;
  const r = createWeaponRig({
    renderer, canvas, entity, audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
    fetchBytes: async () => bowCif(), activateHeld: () => activate,
  });
  r.toggleSheath();
  for (let i = 0; i < 90; i++) { r.frame(1 / 60); r.draw(); }
  await new Promise((res) => setTimeout(res, 0));   // the art's promise lands
  for (let i = 0; i < 5; i++) { r.frame(1 / 60); r.draw(); }
  /** One frame: input, the rig's step, the draw; answers the events and the visible weapon quad. */
  const step = (held, dt, { cancel = false } = {}) => {
    activate = cancel;
    r.attackInput(0, 0, held);
    const evs = r.frame(dt);
    quads.length = 0;
    r.draw();
    const q = quads.find((x) => typeof x.tex === 'string' && x.tex.startsWith('fpw:'));
    return { evs, drawn: q && q.rect.y < canvas.height ? q.tex : null, shown: q ? Math.max(0, canvas.height - q.rect.y) : 0 };
  };
  return { r, step, m: r.playerWeapon.machine };
}

/** Shoots once; answers every frame from the loose to the end of the cooldown and the first frames after. */
async function shoot({ drawback, widget, fps = 60, doubleScale = false }) {
  const { step, m } = await bowRig({ drawback, widget, doubleScale });
  const dt = 1 / fps, rows = [];
  let loosed = false, held = 0, looseAt = -1;
  if (!drawback) assert.equal(m.frame, 3, 'BowDrawback off: the idle bow the player looks at is the drawn frame (FPSWeapon.cs:533-534)');
  for (let i = 0; i < fps * 3; i++) {
    let press = i === 0;
    if (drawback && m.state === 'StrikeUp') press = !(m.frame === 3 && ++held > 10);
    const { evs, drawn, shown } = step(press, dt);
    // from the frame AFTER the loose: the shaft's mesh lands through a promise (arrowFlight.js `m.gpu`), so the
    // frame that creates it cannot draw it - the first frame two arrows could share is the next one
    if (loosed) rows.push({ drawn, shown, cooling: m.now < m.cooldownUntil, state: m.state });
    if (evs.includes('hit')) { loosed = true; if (looseAt < 0) looseAt = i; }
  }
  assert.ok(loosed, 'the shot was loosed');
  // the click's frame counts, as the machine's first wait does: two whole ticks from the click, and never a draw first
  // (a resume is the first frame whose summed seconds reach the tick: 4 frames at 60 or 50 fps, so the loose is frame 7)
  if (!drawback) assert.equal(looseAt, 2 * Math.ceil(T16 * fps) - 1, 'the instant shot looses at +2 ticks, as DFU and the widget\'s clone do');
  return rows;
}

for (const drawback of [false, true]) {
  for (const widget of [false, true]) {
    for (const fps of widget ? [60, 50] : [60]) {
      test(`ARROW2: no nocked frame is drawn while the loosed arrow flies (drawback ${drawback}, widget ${widget}, ${fps} fps)`, async () => {
        const rows = await shoot({ drawback, widget, fps });
        const during = rows.filter((x) => x.state !== 'Idle' || x.cooling);
        const bad = during.filter((x) => x.drawn && NOCKED.test(x.drawn));
        assert.equal(bad.length, 0, `a nocked frame (${bad[0]?.drawn}) is on screen on ${bad.length} frames after the loose, before the cooldown ends - FPSWeapon.cs:531 hides the bow there`);
        assert.ok(rows.some((x) => !x.cooling && x.state === 'Idle' && x.drawn), 'and the bow comes back once the cooldown ends');
      });
    }
  }
}

test('ARROW2 under DISC14-B\'s defaults (DoubleScaleTextures on): while the arrow flies the bow is off the screen, and through the cooldown no more than a sliver of it ever shows - under a pixel of the 200-line screen, the doubled-idle bob\'s lift', async () => {
  for (const fps of [60, 50]) {
    const rows = await shoot({ drawback: true, widget: true, fps, doubleScale: true });
    assert.equal(rows.filter((x) => x.state !== 'Idle' && x.drawn && NOCKED.test(x.drawn)).length, 0, `${fps} fps: no nocked frame while the loose plays out`);
    const worst = Math.max(0, ...rows.filter((x) => x.cooling && x.drawn && NOCKED.test(x.drawn)).map((x) => x.shown));
    assert.ok(worst < 1, `${fps} fps: the most of a nocked bow on screen before the cooldown ends is ${worst.toFixed(2)} of 200 rows`);
    assert.ok(rows.some((x) => !x.cooling && x.state === 'Idle' && x.drawn), 'and the bow comes back once the cooldown ends');
  }
});

test('ARROW2: an un-draw (ActivateCenterObject at the hold frame) is no one-shot end - the bow stays shown through its cooldown, as DFU keeps it', async () => {
  const { step, m } = await bowRig({ drawback: true, widget: false });
  let held = 0, undrawn = false, shownCooling = 0, arrows = 0;
  for (let i = 0; i < 90; i++) {
    const drawn = m.state === 'StrikeUp' && m.frame === 3 && ++held > 10;
    const { evs, drawn: tex } = step(i === 0 || m.state === 'StrikeUp', 1 / 60, { cancel: drawn && !undrawn });
    if (drawn && !undrawn && m.state === 'Idle') undrawn = true;
    if (evs.includes('hit')) arrows++;
    if (undrawn && m.now < m.cooldownUntil && tex) shownCooling++;
  }
  assert.ok(undrawn, 'the draw was let go');
  assert.equal(arrows, 0, 'no arrow');
  assert.ok(shownCooling > 30, 'the idle bow is drawn through the un-draw\'s cooldown');
});

import { createWeaponMachine, machineAttack, machineStep, CLASSIC_UPDATE_INTERVAL as T16 } from '../src/characters/weaponStates.js';

test('ARROW2: BowDrawback off, the bow idles DRAWN (frame 3) and the instant shot twangs at +1 tick and looses at +2 - FPSWeapon.cs:533-534 and :261-262', () => {
  const m = createWeaponMachine(true);
  m.bowIdleDrawn = true;
  machineStep(m, T16 * 0.5, 50);
  assert.equal(m.frame, 0, 'the idle has not run off its frame yet');
  machineStep(m, T16 * 0.5, 50);
  assert.equal(m.frame, 3, 'one tick: the one-frame Idle runs off its end onto the drawn frame');
  assert.equal(machineAttack(m, 'StrikeDown'), true);
  assert.equal(m.frame, 3, 'a bow keeps its frame into the strike');
  assert.deepEqual(machineStep(m, T16, 50), ['bowSound'], '+1 tick: frame 4, the twang');
  assert.deepEqual(machineStep(m, T16, 50), ['hit'], '+2 ticks: frame 5, the shaft');
  m.bowIdleDrawn = false;
  const b = createWeaponMachine(true); b.frame = 3;
  machineStep(b, T16, 50);
  assert.equal(b.frame, 0, 'BowDrawback on: the idle loops to 0 (the draw starts there)');
  const c = createWeaponMachine(true); c.bowIdleDrawn = true; c.cooldownUntil = 10;
  machineStep(c, T16 * 4, 50);
  assert.equal(c.frame, 0, 'not while cooling: AnimateWeapon does not step a bow it has hidden');
});

test('ARROW2: ONE step per resume - a long frame on the release moves one frame, never StrikeDown to Idle at once (FPSWeapon.cs:545); the port\'s own gun keeps its clock', () => {
  const m = createWeaponMachine(true);
  m.bowIdleDrawn = true; m.frame = 3;
  machineAttack(m, 'StrikeDown');
  assert.deepEqual(machineStep(m, 0.5, 50), ['bowSound'], 'a half-second frame is one resume: frame 4 only');
  assert.equal(m.state, 'StrikeDown');
  assert.equal(m.acc, 0, 'the remainder is dropped, not carried');
  assert.deepEqual(machineStep(m, T16 * 0.99, 50), [], 'and the next wait is a whole tick');
  const g = createWeaponMachine(false);
  g.tick = 0.07; g.frames = { StrikeDown: 6 };
  machineAttack(g, 'StrikeDown');
  machineStep(g, 0.07 * 3 + 0.001, 50);
  assert.equal(g.frame, 3, 'FIELD-GUN7\'s lab clock is no FPSWeapon: it still carries');
});
