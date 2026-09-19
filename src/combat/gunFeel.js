// THE DWARVEN THUNDERLOCK'S FEEL - the recoil spring and the shake,
// and the numbers Mac settled on the lab's own sliders.
//
// FIELD-GUN6 (2026-09-19, from the first play: "This isn't 1 to 1 with
// the prototype"). It was not, and this module is why it now can be.
//
// THE LAB IS WHERE THESE WERE DECIDED and the lab was where they
// STAYED: `gun-proto.html` drove a recoil spring, a trauma shake and a
// reload lower, and `combat/weaponRig.js` - the thing that actually
// draws the weapon in the game, in all four hosts - had none of the
// three. The sprite arrived, the sounds arrived, and the weapon sat
// dead still while it fired. A prototype whose findings do not reach
// the product is a demo.
//
// So the two machines move HERE, out of `src/tools/`, and the lab
// re-exports them - exactly what `combat/gunSheet.js` already is for
// the slicing laws. A number that appears in both places is a number
// that will disagree with itself; there is one home and the lab reads
// it, so tuning the lab tunes the game.
//
// WHAT IS NOT HERE: the Weapon Widget's Offset, Bob and Inertia. Those
// are RedRoryOTheGlen's modules, ported 1:1 in combat/weaponWidget.js,
// and the game already runs them on this weapon like any other. The
// lab ran the same three from the same home. They needed no second
// copy then and need none now.

/**
 * MAC'S NUMBERS, off the lab's panel, as one frozen row.
 *
 * These are not derived from anything and there is no DFU member
 * behind them - they are a person moving a slider until a gun felt
 * like a gun, which is the only way this kind of number is ever
 * settled. They are written down here so that the lab and the game
 * cannot drift, and so the next person to move one moves it once.
 */
export const GUN_FEEL = Object.freeze({
  // the spring (Mac, 2026-09-19: "kick 5, back 0, stiffness 400, damping 36")
  kick: 5, back: 0, stiff: 400, damp: 36,
  // the shake ("All screenshake values max with decay at 5")
  shake: 30, shakeRot: 4, shakeFreq: 60, shakeDecay: 5,
  // the reload ("Reload: 1700") and how far the weapon drops while it runs
  reloadMs: 1700,
  hiddenTarget: Object.freeze([0, 0.55]),
});

/**
 * THE RECOIL, as a DISPLACEMENT rather than an impulse.
 *
 * The barrel is already up by `kick` on the frame the trigger breaks,
 * and the spring's whole job is the ride down. An impulse (`vy +=
 * kick`) reads as a soft push - the peak lands two frames late and a
 * third of the size, which is the first thing the lab's probe caught.
 * A second shot fired into the recovery stacks on what is left, which
 * is the reason this is a spring at all rather than a curve.
 */
export function createRecoil({ kick = GUN_FEEL.kick, stiff = GUN_FEEL.stiff, damp = GUN_FEEL.damp, back = GUN_FEEL.back } = {}) {
  const r = { x: 0, y: 0, vx: 0, vy: 0, kick, stiff, damp, back };
  r.punch = (amount = r.kick) => { r.y += amount; r.x -= amount * r.back; };
  r.step = (dt) => {
    // sub-stepped: a spring this stiff integrated on a 30ms frame
    // explodes, and a weapon that only feels right at 120fps is no
    // weapon. The lab found this; the game inherits it.
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      r.vx += (-r.stiff * r.x - r.damp * r.vx) * h;
      r.vy += (-r.stiff * r.y - r.damp * r.vy) * h;
      r.x += r.vx * h; r.y += r.vy * h;
    }
    return { x: r.x, y: -r.y };   // +y is up in the impulse, down on screen
  };
  return r;
}

/**
 * NOT per-frame randomness, which reads as static at 60fps and -
 * worse - shakes twice as hard on a machine drawing twice as many
 * frames. Three sines per axis are continuous, frame-rate independent
 * and cost nothing. The lab's own function, carried verbatim: this is
 * the shape of the motion Mac tuned against, so re-deriving it would
 * be tuning a different gun.
 */
export const shakeNoise = (p, seed) => (
  Math.sin(p * seed * 1.7) * 0.6
  + Math.sin(p * seed * 3.1 + 1.3) * 0.3
  + Math.sin(p * seed * 7.3 + 2.7) * 0.1
);

/**
 * THE SHAKE - trauma SQUARED, which is Eiserloh's own law and the
 * reason a small shot barely moves the screen while a stacked pair
 * kicks it hard. `punch` adds trauma and the decay eats it; the
 * offsets are read off the noise above.
 *
 * IN THE GAME THIS MOVES THE ROOM, NOT THE WEAPON, because the camera
 * carries the weapon: shaking the sprite alone reads as a loose
 * sprite, and shaking the view reads as a gun going off. That is the
 * lab's own finding, in its probe's words - "it must move the ROOM and
 * not the weapon".
 */
export function createScreenShake({
  amount = GUN_FEEL.shake, decay = GUN_FEEL.shakeDecay, freq = GUN_FEEL.shakeFreq, rot = GUN_FEEL.shakeRot,
} = {}) {
  const s = { trauma: 0, t: 0, amount, decay, freq, rot };
  s.punch = (a = 1) => { s.trauma = Math.min(1, s.trauma + a); };
  s.step = (dt) => {
    s.t += dt;
    s.trauma = Math.max(0, s.trauma - s.decay * dt);
    const k = s.trauma * s.trauma;
    if (k === 0) return { x: 0, y: 0, rot: 0 };
    const p = s.t * s.freq;
    return {
      x: s.amount * k * shakeNoise(p, 1),
      y: s.amount * k * shakeNoise(p, 1.7),
      rot: s.rot * k * shakeNoise(p, 2.3) * Math.PI / 180,
    };
  };
  return s;
}
