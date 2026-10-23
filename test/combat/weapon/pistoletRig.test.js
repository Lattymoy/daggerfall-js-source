// AUDIT PISTOLET D11 (bible/01-Overview/audits/Audit-Pistolet.md): THE PISTOLET ON THE REAL RIG - createWeaponRig in Node
// (pistolRigHarness.js), every quad it hands the renderer and every sound: its own art, each hand of a pair its own item's,
// drawn in the striking hand's order at the art's own pose; the resting pistol never flashes; each hand's reload clacks; a
// shot kicks its own hand, a single gun at its own kick; the muzzle light from the side the gun is drawn on, at the gun's
// own reach; the pair slides away on a sheath; the Morrowind arm takes the firing hand's kick. Twelve mutants of the rig's
// Pistolet paths survived every suite before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pistolRig } from './pistolRigHarness.js';
import { createPistolet } from '../../../src/systems/pistolet.js';
import { mintGilded, SUNKEN_SOVEREIGN } from '../../../src/systems/gilded.js';
import { thunderlockMuzzleLight } from '../../../src/systems/thunderlock.js';
import { PISTOLET_FEEL, GUN_FEEL, createRecoil, armGunPose } from '../../../src/combat/gun/gunFeel.js';
import { fpArm } from '../../../src/combat/fpArm.js';
import { applyRarity, addProcLine } from '../../../src/systems/loot/lootRarity.js';
import { weaponElement } from '../../../src/systems/weaponGlow.js';

const idleOf = (q) => q.filter((x) => /:0$/.test(String(x.tex)));
const firingOf = (q) => q.find((x) => !/:0$/.test(String(x.tex)));

test('the Pistolet draws ITS OWN strip, at its art\'s own pose (mutants: the rifle\'s sheet; the pose ignored)', async () => {
  const { frame, uploads, canvas } = await pistolRig({ right: createPistolet() });
  assert.ok(uploads.some((n) => /^pistolet:\d$/.test(n)) && !uploads.some((n) => /thunderlock/.test(n)), `its six frames (${uploads.slice(0, 3)})`);
  const q = await frame();
  assert.equal(q.length, 1);
  // the union box at native scale x the owner's 1.05, on a 320-wide screen: 88 x 1.05 design pixels wide
  assert.ok(Math.abs(q[0].rect.w - 88 * PISTOLET_FEEL.scale * canvas.width / 320) < 1.5, `drawn ${q[0].rect.w.toFixed(1)} wide`);
});

test('a pair: each hand its own item\'s art, the left in the mirror, the striking hand over the other; the resting one never flashes (mutants: one art; a fixed order; the resting pistol flashing)', async () => {
  const gold = mintGilded(SUNKEN_SOVEREIGN);
  const { r, frame } = await pistolRig({ right: gold, left: createPistolet() });
  let q = await frame();
  assert.equal(q.length, 2);
  const right = q.find((x) => /gilded/.test(x.tex)), left = q.find((x) => !/gilded/.test(x.tex));
  assert.ok(right && left, `each hand its own picture (${q.map((x) => x.tex)})`);
  assert.ok(left.uv && !right.uv, 'the left drawn in the mirror');
  const restTint = left.tint;
  assert.ok(Array.isArray(restTint), 'the room\'s light on the pistols - a flash has a tint to lift');
  r.clickAttack();
  let checked = 0, flashed = false;
  for (let i = 0; i < 30 && r.playerWeapon.machine.state !== 'Idle'; i++) {
    q = await frame();
    assert.ok(/gilded/.test(q.at(-1).tex), 'the firing right drawn last');
    const resting = q.find((x) => !/gilded/.test(x.tex));
    assert.equal(resting.tex, 'pistolet:0', 'the resting left on its idle');
    assert.deepEqual(resting.tint, restTint, 'and unlit by the other\'s flash');
    if (q.at(-1).tint.some((v, k) => Math.abs(v - restTint[k]) > 0.05)) flashed = true;
    checked++;
  }
  assert.ok(checked > 3);
  assert.ok(flashed, 'while the firing pistol is lit by its own flash');
  while (!r.playerWeapon.handLoaded('L') || r.playerWeapon.machine.state !== 'Idle') await frame();
  r.clickAttack();
  q = await frame();
  assert.equal(r.playerWeapon.strike.hand, 'L');
  assert.ok(!/gilded/.test(q.at(-1).tex), 'the firing left drawn last');
});

test('each hand\'s reload clacks; a shot kicks its OWN hand - the Morrowind arm takes the firing hand\'s kick (mutants: the pair silent; the right always kicked; the arm off the lead)', async () => {
  const poses = [];
  const was = fpArm.setGunFeel;
  fpArm.setGunFeel = (p) => { poses.push(p); return was?.call(fpArm, p); };
  try {
    const { r, frame, audio } = await pistolRig({ right: createPistolet(), left: createPistolet() });
    r.clickAttack();
    while (r.playerWeapon.machine.state !== 'Idle') await frame();
    for (let i = 0; i < 40; i++) await frame();   // the right's spring settles
    poses.length = 0;
    r.clickAttack();
    assert.equal(r.playerWeapon.strike.hand, 'L');
    for (let i = 0; i < 12; i++) await frame();
    const neutral = JSON.stringify(armGunPose(0, null));
    assert.ok(poses.some((p) => JSON.stringify(p) !== neutral), 'the arm kicked by the left\'s shot');
    while (!(r.playerWeapon.handLoaded('R') && r.playerWeapon.handLoaded('L'))) await frame();
    for (let i = 0; i < 5; i++) await frame();
    const opens = audio.played.filter((k) => k === 'pistolet:open').length, closes = audio.played.filter((k) => k === 'pistolet:close').length;
    assert.ok(opens >= 2 && closes >= 2, `each hand's two clacks (${opens} open, ${closes} close)`);
  } finally {
    fpArm.setGunFeel = was;
  }
});

test('a single Pistolet kicks at ITS kick - the feel\'s, never the spring\'s default (the Thunderlock\'s 5) (mutant: the kick ignored)', async () => {
  // a SOURCE pin: the drawn rect carries the kick among the widget's own offsets, so a pixel measure cannot tell 3 from 5
  // cleanly - the punch's line can
  const { readFileSync } = await import('node:fs');
  // PIN MOVED (PISTOL-PORT): a Pistolet's shot is punched by its lane at the feel's kick (the page's `shot`); the rig's own
  // spring line is the Thunderlock's alone now
  const rig = readFileSync('src/combat/weapon/weaponRig.js', 'utf8');
  assert.match(readFileSync('src/combat/gun/pistolLane.js', 'utf8'), /pistolHandFired\(hands, h, feel\.kick\);/);
  assert.match(rig, /_tlRecoil\.kick = feel\.kick; _tlRecoil\.back = feel\.back; _tlRecoil\.punch\(\);/);
  assert.notEqual(PISTOLET_FEEL.kick, GUN_FEEL.kick, 'the two guns kick apart - the line is what tells them');
  assert.equal(createRecoil().kick, GUN_FEEL.kick, 'the spring\'s default is the rifle\'s');
});

for (const leftHanded of [false, true]) {
  test(`A9: ${leftHanded ? 'LEFT' : 'right'}-handed, each shot's light is thrown from the side its gun is drawn on, at the Pistolet's reach (mutants: the light always right; the rifle's reach)`, async () => {
    for (const pair of [true, false]) {
      const { r, frame, entity } = await pistolRig({ right: createPistolet(), left: pair ? createPistolet() : null, leftHanded });
      for (let n = 0; n < (pair ? 2 : 1); n++) {
        while (!r.playerWeapon.handLoaded(r.playerWeapon.leadHand === 'R' && n ? 'L' : r.playerWeapon.leadHand) || r.playerWeapon.machine.state !== 'Idle') await frame();
        r.clickAttack();
        let seen = null;
        for (let i = 0; i < 40 && !seen; i++) {
          const q = await frame();
          if ((entity._thunderlockFlash ?? 0) > 0.9) {
            const firing = firingOf(q) ?? q.at(-1);
            seen = { drawnLeft: firing.rect.x + firing.rect.w / 2 < 160, lightLeft: thunderlockMuzzleLight(entity, [0, 0, 0], 0).x < 0 };
          }
        }
        assert.ok(seen, 'the shot flashed');
        assert.equal(seen.lightLeft, seen.drawnLeft, `${pair ? 'a pair' : 'one gun'}, shot ${n + 1}: the light on the drawn side`);
        assert.equal(entity._thunderlockFlashRange, PISTOLET_FEEL.flashRange, 'at the Pistolet\'s own reach');
        while (r.playerWeapon.machine.state !== 'Idle') await frame();
      }
    }
  });
}

/** A Rare Pistolet whose proc line is `element` (the roll a minted Rare takes - lootRarity.js rollProcLine), identified. */
function elementalPistolet(element) {
  for (let seed = 1; seed < 5000; seed++) {
    let s = seed; const rolls = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const it = applyRarity(createPistolet(), 'rare', rolls);
    const line = addProcLine(it, rolls);
    if (line?.id !== 'elemental' || line.param !== element) continue;
    it.isIdentified = true;
    if (weaponElement(it, { ladder: true })?.element === element) return it;
  }
  throw new Error(`no ${element} Pistolet`);
}

test('PISTOLET-NAMES (the owner: "These new weapons get the element effects ... etc"): each pistol wears ITS OWN element\'s outline (WEAPON-GLOW1) - one fire gun burns; a pair of fire and frost each its own, a plain one none (mutant: WR-pair-wears-the-held-glow)', async () => {
  const fire = elementalPistolet('fire'), frost = elementalPistolet('frost');
  let { frame, glows } = await pistolRig({ right: fire });
  await frame();
  assert.deepEqual(glows.map((g) => g.look), ['fire'], 'one fire Pistolet');
  ({ frame, glows } = await pistolRig({ right: fire, left: frost }));
  await frame();
  assert.deepEqual(glows.map((g) => g.look).sort(), ['fire', 'frost'], 'a pair: each its own');
  ({ frame, glows } = await pistolRig({ right: fire, left: createPistolet() }));
  await frame();
  assert.deepEqual(glows.map((g) => g.look), ['fire'], 'and a plain left none');
});

test('sheathed, the pair slides away rather than vanishing (mutant: the pair popped off)', async () => {
  const { r, frame } = await pistolRig({ right: createPistolet(), left: createPistolet() });
  r.toggleSheath();
  const after = await frame();
  assert.equal(idleOf(after).length, 2, 'both still drawn the frame after the sheath - sliding');
  let n = 0;
  while ((await frame()).length && n < 120) n++;
  assert.ok(n > 3 && n < 120, `and gone after the slide (${n} frames)`);
});
