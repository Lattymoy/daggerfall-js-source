// THE DWARVEN THUNDERLOCK'S FEEL - the recoil spring and the shake,
// and the numbers Mac settled on the lab's own sliders.
//
// FIELD-GUN6 (2026-09-19, from the first play: "This isn't 1 to 1 with
// the prototype"). It was not, and this module is why it now can be.
//
// THE LAB IS WHERE THESE WERE DECIDED and the lab was where they
// STAYED: `gun-proto.html` drove a recoil spring, a trauma shake and a
// reload lower, and `combat/weapon/weaponRig.js` - the thing that actually
// draws the weapon in the game, in all four hosts - had none of the
// three. The sprite arrived, the sounds arrived, and the weapon sat
// dead still while it fired. A prototype whose findings do not reach
// the product is a demo.
//
// So the two machines move HERE, out of `src/tools/`, and the lab
// re-exports them - exactly what `combat/gun/gunSheet.js` already is for
// the slicing laws. A number that appears in both places is a number
// that will disagree with itself; there is one home and the lab reads
// it, so tuning the lab tunes the game.
//
// WHAT IS NOT HERE: the Weapon Widget's Offset, Bob and Inertia. Those
// are RedRoryOTheGlen's modules, ported 1:1 in combat/weapon/weaponWidget.js,
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
  // ── THE POSE (the lab's panel: size 49, raise -8) ────────────────
  // `widthPct` is the gun's own box as a fraction of the 320-wide
  // design surface, and `raise` is the lab's offsetHeight - NEGATIVE
  // sits it lower on the screen, which is the classic rect's own
  // sign (`y = height - h - offsetHeight`).
  widthPct: 0.49, raise: -8,

  // ── THE CADENCE (fps 14, reload 1700, hit on frame 1) ────────────
  // THE THREE THAT MATTER MOST, and the three that were missed: in
  // the game a weapon's frame clock is SPD-driven
  // (getMeleeWeaponAnimTime) and its ranged cooldown is SPD-driven
  // (getBowCooldownTime), so the gun ran at about five frames a
  // second at average speed where the lab runs fourteen, reloaded in
  // 1.33s where the lab takes 1.7, and landed its damage a frame late
  // on the melee hit frame. A weapon whose cycle is three times
  // slower than the thing it was tuned as is not the same weapon.
  //
  // So these are FIXED, which is itself the departure: a gun's
  // mechanism does not care how agile you are. Drawing the bowstring
  // does, which is why the classic formulas stay exactly where they
  // are for everything else.
  fps: 14, reloadMs: 1700, hitFrame: 1,

  // ── THE SPRING (Mac: "kick 5, back 0, stiffness 400, damping 36")
  kick: 5, back: 0, stiff: 400, damp: 36,
  // ── THE SHAKE ("All screenshake values max with decay at 5")
  shake: 30, shakeRot: 4, shakeFreq: 60, shakeDecay: 5,
  /** FIELD-GUN8: what the ROOM's shake is worth, in the camera
   *  shaker's own units rather than the lab's.
   *
   *  These two scales are NOT convertible and pretending otherwise
   *  would be a made-up number wearing a derivation. The lab's
   *  `shake: 30` is a peak in native 320x200 PIXELS of a 2D canvas;
   *  Better Ambience's shaker is a 3D magnitude whose own producer
   *  (DamageShaker) answers 10 for a blow that took your whole
   *  health bar, clamped there by the player's maxShake. So this is
   *  a JUDGEMENT stated as one: a shot is worth about a third of
   *  dying, which reads as a hard kick without throwing the view.
   *  It is one named number for Mac to move, like the doll's offset. */
  roomShake: 3,
  // ── THE VOICE (the lab's panel: volume 1, pitch vary 0.19) ──────
  // A gun fired six times in four seconds is exactly the case where
  // the ear notices a sample repeating, so the lab varies playback
  // rate - and DFU's own weapon code varies swing pitch for the same
  // reason. The game was playing all three clips at full volume with
  // no variance at all.
  //
  // FIELD-GUN15 (2026-09-20, Mac, with the panel open: "Use these
  // sounds"). Both moved, and they moved TOGETHER for one reason: the
  // three picks changed (systems/thunderlock.js SFX_FILES), and
  // `fire-dry` is a flat crack with no room tail where `fire-shotgun`
  // carried a real room's. A drier, quieter sample wants the gain back
  // - hence 1 - and a sample with no tail to hide a repeat behind wants
  // three times the pitch jitter, which is what 0.19 is. Tuned on the
  // lab's own sliders against the clips they are for, not adjusted in
  // the abstract.
  sfxVolume: 1, sfxVary: 0.19,
  // how far the weapon drops while the reload runs
  hiddenTarget: Object.freeze([0, 0.55]),
  /** FIELD-GUN13 (Mac: "The weapon should come up from the bottom
   *  screen into frame when unholstering, not pop in") - and how far
   *  it drops when it is PUT AWAY, which is a different distance for
   *  a reason. The reload lower is a dip: the weapon has to stay
   *  readable while the pump runs, which is what 0.55 buys. A holster
   *  has to LEAVE, so its target is a full frame height down - past
   *  `widgetTransformRect`'s own floor clamp, which parks the sprite's
   *  top on the bottom edge and no further. Same easing, same module,
   *  one number apart. */
  sheathTarget: Object.freeze([0, 1]),

  // ── THE FLASH (the lab's panel: light 0.6, over its own 1.9 gain)
  /** FIELD-GUN13 (Mac: "The muzzle flash itself shouldn't be affected
   *  by the darkening lighting. It should produce lighting").
   *
   *  `flashLight` x `flashGain` is `gun-proto.html`'s own expression -
   *  `state.room * (1 + muzzleLight(...) * state.light * 1.9)` - and
   *  the lab's panel defaults for the two. In the lab that lands on
   *  1.33 at the peak against a room lit 0.62, which SATURATES: the
   *  flash frame is drawn at full brightness there. The port lerps to
   *  white rather than multiplying so it saturates in a black dungeon
   *  too, which is the half of the ask a multiply would quietly drop
   *  (0.15 x 2.14 is still dark). Everything below the peak rides the
   *  same curve down. */
  flashLight: 0.6, flashGain: 1.9,
  /** How far the flash throws light into the room, at the peak. A
   *  JUDGEMENT stated as one, like `roomShake`: the classic torch is a
   *  14-unit radius and the lantern 16 (their templates' own
   *  capacityOrTarget), and a barrel going off in a corridor lights it
   *  further than a lantern does - for two frames. It falls with the
   *  curve, so frame 3 is already under a candle. */
  flashRange: 20,
});

/**
 * PISTOLET (2026-10-21): THE DWARVEN PISTOLET'S FEEL - the owner's panel off the pistol lab (pistol-proto.html,
 * bible/05-Combat/Pistol-Lab.md), "Must be these values/sounds exactly". The Thunderlock's rule, one weapon along: the
 * lab settled these and the game reads them HERE, and the lab reads them back from here (src/tools/pistolLab.js
 * PISTOL_OPENING), so the two cannot drift.
 *
 * Its own fields beside GUN_FEEL's shape:
 *   - `scale` - the pose is NATIVE: one art pixel to one pixel of the 320-wide surface (the strip is a WEAPON*.CIF
 *     record's size), times this. The rig turns it into `widthPct` off the art's own measured anchor.
 *   - `widget` - Weapon Widget's Bob and Inertia, TUNED for this weapon on the lab's panel. The game takes the panel's
 *     own settings - these MAGNITUDES, its three modules on - with the player's own Offset and Bob SWITCHES over them
 *     (combat/gun/pistolViewmodel.js PISTOL_PANEL, pistolWidgetSettings; PISTOL-PORT, AUDIT PISTOL-PORT D8).
 *   - `sfx` - the three picks, file stems in public/sfx; systems/pistolet.js PISTOLET_SFX_FILES is built from them.
 *   - `alphaCut` - the 1-bit cut the strip is hardened at (the screen quad's 0.5).
 * `roomShake` and `flashRange` are the two judgements GUN_FEEL states as judgements, scaled: the lab's shake is 20 to the
 * Thunderlock's 30, so its room shake is 2 to the Thunderlock's 3; a pistol's flash throws a torch's 14 where the
 * rifle's throws 20.
 */
/** The reload's second clack lands this long before the gun is ready - the lab's 420ms. One number for the Thunderlock's
 *  voice (combat/weapon/weaponRig.js) and the Pistolet's, the page's own (combat/gun/pistolViewmodel.js
 *  pistolReloadVoice) - AUDIT PISTOLET B6: it was two literals. */
export const RELOAD_CLOSE_LEAD = 0.42;

export const PISTOLET_FEEL = Object.freeze({
  scale: 1.05, raise: -60, offset: 0,   // PISTOL-RAISE (Mac, 2026-10-25): "Placement needs to be -60 ... the raise"
  fps: 12, reloadMs: 1400, hitFrame: 1,
  kick: 3, back: 0, stiff: 400, damp: 36,
  shake: 20, shakeRot: 2.5, shakeFreq: 60, shakeDecay: 5,
  roomShake: 2,
  sfxVolume: 1, sfxVary: 0.19,
  sfx: Object.freeze({ fire: 'fire-shotgun', open: 'open-shell', close: 'close-ready' }),
  hiddenTarget: Object.freeze([0, 0.7]),
  sheathTarget: Object.freeze([0, 1]),
  flashLight: 0.6, flashGain: 1.9, flashRange: 14,
  alphaCut: 128,
  widget: Object.freeze({
    'Offset.Speed': 1,
    'Bob.Length': 146, 'Bob.SizeX': 1, 'Bob.SizeY': 0.7, 'Bob.SpeedMove': 1, 'Bob.SpeedState': 1,
    'Bob.Shape': 0, 'Bob.BobWhileIdle': true,
    'Inertia.Scale': 2, 'Inertia.Speed': 2, 'Inertia.ForwardDepth': 0, 'Inertia.ForwardSpeed': 1,
  }),
});
/** The Pistolet's frame clock and reload in seconds (GUN_TICK_SECONDS's pair) - the cadence its machines run at
 *  (combat/gun/pistolPair.js, built from PISTOLET_FEEL's fps and reloadMs), named for what reads it in seconds. */
export const PISTOLET_TICK_SECONDS = 1 / PISTOLET_FEEL.fps;
export const PISTOLET_COOLDOWN_SECONDS = PISTOLET_FEEL.reloadMs / 1000;

/**
 * THE MUZZLE CURVE. The flash is on frames 1-2 of the sheet
 * (0-indexed), so the room it lights brightens on those and falls away
 * over the smoke - a lamp, not a step.
 *
 * FIELD-GUN13: this moved out of `src/tools/gunLab.js` for the reason
 * everything else in this file did - the game needs it now, and a
 * number that appears in two places is a number that will disagree
 * with itself. The lab re-exports its own `muzzleLight(state, frame)`
 * over this, so `gun-proto.html` is unchanged.
 */
export const MUZZLE_CURVE = Object.freeze([0, 1, 0.82, 0.3, 0.12, 0.04]);
/** THUNDERLOCK-ART2: the Thunderlock's own - the owner's strip draws its flash on frame 1 alone (the sheet's burned on two),
 *  so the light falls away from the next frame's smoke as the sheet's did from its second flash. MUZZLE_CURVE stays the
 *  Pistolet's. */
export const THUNDERLOCK_MUZZLE_CURVE = Object.freeze([0, 1, 0.3, 0.12, 0.04, 0, 0]);

/** The curve, read. `firing` is the machine off Idle, `curve` the gun's; answers 0..1. */
export function muzzleGlow(firing, frame, curve = MUZZLE_CURVE) {
  if (!firing) return 0;
  return curve[frame] ?? 0;
}

/** The lab's pitch jitter, as the one line both sides read. */
export const gunPitch = (rolls = Math.random, feel = GUN_FEEL) => 1 + (rolls() * 2 - 1) * feel.sfxVary;   // PISTOLET: a gun's own row

/** The lab's frame clock as a tick, which is what the machine reads. */
export const GUN_TICK_SECONDS = 1 / GUN_FEEL.fps;
/** ...and its cooldown in the seconds the machine counts. */
export const GUN_COOLDOWN_SECONDS = GUN_FEEL.reloadMs / 1000;

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

/**
 * MW-GUN-FEEL (2026-10-07, Mac: "overhauling the thunderlock in general including the morrowinds gun model and proper
 * animations"): THE SAME SPRING AND THE SAME RELOAD, ON THE MORROWIND ARM.
 *
 * Under the Morrowind arm the gun borrows the crossbow's groups (characters/ownModels/ownWeaponModels.js animateAs) - and a
 * crossbow has no kick and loads its bolt on the WIND-UP ("shoot attach", before the release), so after the bang the
 * hands simply stood still for the gun's 1.7s reload: no recoil, no reload, the pump's two clacks over an idle pose.
 * The classic sprite has had both since FIELD-GUN6 - the recoil spring above and the reload lower - and this hands
 * them to the arm as ONE POSE in the eye's own axes, laid over the whole viewmodel at its draw (combat/fpArm.js
 * setGunFeel): the spring is the SAME spring (the classic one, stepped once, its displacement read here), so a kick Mac
 * tunes on the lab's panel moves both views; the reload is the cooldown's own clock, from the shot to the weapon's
 * ready, so the gun comes back up exactly as it can fire again.
 *
 * These numbers are JUDGEMENTS, stated as ones, like `roomShake`: the lab's are pixels of a 320x200 sprite and the arm's
 * are degrees and metres, and no conversion between the two is honest. The spring's 5px peak is 3 degrees of muzzle
 * climb and 2.5cm into the shoulder; the pump tips the gun 20 degrees down and drops it 12cm - in from the shot over a
 * fifth of the reload, back up over its last quarter - about the classic dip's weight on a 3D arm.
 */
export const ARM_GUN_FEEL = Object.freeze({
  kickDegPerPx: 0.6, kickBackPerPx: 0.005,
  reloadPitchDeg: 20, reloadDropM: 0.12, reloadIn: 0.2, reloadOut: 0.25,
  /** The shoulder the pose turns about, in the eye's own axes (right, up, toward the eye), metres. */
  pivot: Object.freeze([0, -0.22, -0.32]),
});

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** THE PUMP'S DEPTH, 0..1, at a share of the reload (0 the shot, 1 the weapon ready) - down over `reloadIn`, held,
 *  back up over the last `reloadOut`, nothing outside the reload. */
export function reloadDip(share, f = ARM_GUN_FEEL) {
  if (share == null || !(share > 0) || !(share < 1)) return 0;
  return smooth(0, f.reloadIn, share) * (1 - smooth(1 - f.reloadOut, 1, share));
}

/** A spring this damped never quite reaches nought - its tail is 1e-20 of a pixel a second later; under a thousandth
 *  of a native pixel the arm is at rest, so the arm's pose can be none again. */
export const ARM_KICK_REST_PX = 1e-3;
/** The arm's pose for a frame: the spring's displacement (`kickPx`, the classic recoil's own, +up) and the reload's
 *  share (null outside one) as `{ pitch, back, down }` - radians (+ the muzzle up) and metres. */
export function armGunPose(kickPx, reloadShare, f = ARM_GUN_FEEL) {
  const k = Number.isFinite(kickPx) && Math.abs(kickPx) >= ARM_KICK_REST_PX ? kickPx : 0;
  const d = reloadDip(reloadShare, f);
  return { pitch: (k * f.kickDegPerPx - d * f.reloadPitchDeg) * (Math.PI / 180), back: k * f.kickBackPerPx, down: d * f.reloadDropM };
}

/** The pose as a matrix in the VIEW's space (column-major, the port's mat4.js layout; the eye looks down -Z, +Y up):
 *  turned `pitch` about the shoulder, then moved `back` toward the eye and `down`. `unitsPerMetre` is the rig's scale.
 *  Laid in front of a view matrix (K x view), it moves the whole viewmodel and nothing else in the pass. */
export function armKickMatrix({ pitch = 0, back = 0, down = 0 } = {}, unitsPerMetre = 1, pivot = ARM_GUN_FEEL.pivot) {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  const py = pivot[1] * unitsPerMetre, pz = pivot[2] * unitsPerMetre;
  const ty = py - (c * py - s * pz) - down * unitsPerMetre;
  const tz = pz - (s * py + c * pz) + back * unitsPerMetre;
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, ty, tz, 1]);
}
