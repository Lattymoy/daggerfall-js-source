// TWO-HANDS (2026-10-16): THE SPRITE LANE'S TWO HANDS - both fists up, a pair of weapons, and the hands that run.
// Design and record: bible/05-Combat/Two-Hands.md; the law (which hand strikes, the mirror, the guard, the pump):
// combat/twoHands/handsLaw.js. Wired by combat/weapon/weaponRig.js, the one surface all four hosts mount (THE FOUR HOSTS RULE: world.js,
// exterior.js, worldModes.js and dungeonContext.js each build a rig and carry no line of this).
//
// DFU draws one hand: FPSWeapon's one sprite, and the Weapon Widget clone (weaponWidget.js) in its place. A second hand is
// the same picture in the mirror - THE LEFT HAND IS A RIGHT HAND IN THE MIRROR, as CLIMB-HANDS drew Mac's fist (its
// painting a left hand, mirrored for the right: combat/climbHands.js). So nothing here paints: each hand is placed by the
// very arithmetic the one hand always was (fpsWeaponQuad - FPSWeapon's - or a widget clone, the rig's own for the right
// hand and this module's for the left), as DFU would draw a RIGHT hand, and the hand on the left of the screen is mirrored
// whole about the screen's middle - every state, its strike mapped to its mirror (handsLaw.js mirrorStrike), so a left
// hand's sweep to the right is the right hand's forehand seen in the glass.
//
// THE PAINTED ARM (handsLaw.js MELEE_PAINTED_ARM, strikePicture). A weapon file paints the right arm alone; the bare
// hand's WEAPON10.CIF paints BOTH - classic Daggerfall threw its StrikeDown, StrikeLeft and StrikeUp with the left fist.
// So each hand's picture is chosen, not assumed: the record as painted when it paints that hand, else the mirror of the
// mirrored strike - and the arm on the screen is always the hand that throws the blow (never two right fists).
//
// THE MACHINE IS ONE. The rig's PlayerWeapon runs DFU's machine and the law gives each strike a hand; each hand here sees
// a VIEW of the machine (`view(hand)`): the strike while it is that hand's, the idle otherwise. A widget clone shadows a
// machine (it plays a strike the machine starts, LateUpdate 0x1b97); handed its hand's view, each clone plays its own
// hand's blows and holds its idle - bob, slide and all - through the other's.
//
// THE GUARD (handsLaw.js GUARD): while one hand strikes the other draws in toward the middle and down - a pair's resting
// weapon only down, by a share of its own height (its art is cut at its outer side, which stays on the view's edge) -
// the way the climbing hands carry a held hand from one place to the next (ClimbPose's limb law, eased - no pop); the
// fists' guard is alive at rest, the two out of step.
//
// THE RUNNING HANDS (handsLaw.js RUN_PUMP): running with nothing in either hand, the two arms pump with the stride - the right
// forward as the left foot falls, one stroke a step on the head bob's own clock (DFU's HeadBobber walks its timer by the
// footstep interval). A running hand is the art's own arm - the bare hand's jab across, a fist's back on its forearm - drawn
// with its foot on the view's bottom edge, never lifted (the idle fist is cut at the wrist: lifted, it floated). The fists
// go down out of the view as the run starts and the arms come up from under it, and back when it ends; a punch thrown on
// the run takes the fist at once.

import { createWeaponWidget } from '../weapon/weaponWidget.js';
import { fpsWeaponQuad, getWeaponAnims, STATE_INDEX, WEAPON_TYPES, NATIVE_W, NATIVE_H } from '../fpsWeapon.js';
import {
  HANDS_MODE, twoHanded, otherHand, mirrorRect, MIRROR_UV, handOnLeft, MELEE_PAINTED_ARM, strikePicture,
  guardStep, guardOffset, easeTo, runPhaseFollow, runPhaseOfBob, pumpOf, runWeightStep, RUN_PUMP,
} from './handsLaw.js';

/** The fists' guard bounce comes and goes over this (the guard alive at rest, gone in a strike or a walk). */
const BOUNCE_TAU = 0.3;
/** Below the view: a hand on its way into or out of the run (the fists' rest going down, the running arm coming up) is
 *  this far under the screen's bottom edge at the far end, in its own heights (CLIMB-HANDS' BOTTOM_SLACK). */
const BELOW = 0.15;
/** The bare hand's records by state - WeaponBasics' melee anims (the art the fists are drawn in). */
const MELEE_ANIMS = getWeaponAnims(WEAPON_TYPES.Melee);

/**
 * The component. `deps` are the left hand's clone's (createWeaponWidget's): the audio its swing voices, its miss
 * effects, its environment cast and the settings both clones read. The right hand's clone is the rig's own.
 */
export function createTwoHands({ audio = null, envHit = null, missEffect = null, settings } = {}) {
  /** The left hand's clone. Never flipped by Handedness: a pair's hand is drawn as a right hand and mirrored whole. */
  const offWidget = createWeaponWidget({ audio, envHit, missEffect, settings, handedness: () => false, hidden: true });   // AUDIT 2: born resting out of sight - single-hand play never steps it
  const st = {
    mode: HANDS_MODE.Single, machine: null, strikeHand: null, leftHanded: false, time: 0,
    guard: { R: 0, L: 0 }, bounce: 0,
    run: { w: 0, phase: 0, wanted: false },
    fromBelow: null,   // AUDIT 2: the hand whose punch was thrown off the running arm (fromBelow)
  };

  /** The side the hands' art paints a state's record from (handsLaw.js MELEE_PAINTED_ARM) - by DFU's state index (a
   *  widget clone's own state) or by name: the bare hand's two arms with both fists up, the right arm for every weapon. */
  const paintedAt = (i) => (st.mode === HANDS_MODE.Fists ? MELEE_PAINTED_ARM[MELEE_ANIMS[i]?.Record ?? 0] ?? 'R' : 'R');
  const painted = (state) => paintedAt(STATE_INDEX[state] ?? 0);
  /** The side of the screen a hand is drawn on (a left-handed player's are crossed - FlipHorizontal's whole picture). */
  const sideOf = (hand) => (handOnLeft(hand, st.leftHanded) ? 'L' : 'R');
  /** ONE RULE FOR EVERY DRAW: a record is drawn in the mirror exactly when the arm it paints is not the hand's side - so
   *  whatever record is on the screen (the picture strikePicture chose, or a clone's a frame behind it, or the idle) the
   *  arm drawn is that hand's. strikePicture's three cases are this rule over the state it picks. */
  const mirrorOf = (hand, paintedSide) => paintedSide !== sideOf(hand);
  /** A hand's picture this frame (handsLaw.js strikePicture): the strike while it is this hand's in a pair, the idle
   *  otherwise - the state whose record it draws, and whether in the mirror. */
  const mine = (hand) => !!st.machine && twoHanded(st.mode) && st.strikeHand === hand && st.machine.state !== 'Idle';
  const picture = (hand) => strikePicture(hand, mine(hand) ? st.machine.state : 'Idle', { leftHanded: st.leftHanded, painted });

  /** A hand's view of the machine: its picture's state (the strike's own, or its mirror's) while the strike is this
   *  hand's in a pair, and the idle otherwise. */
  function view(hand) {
    return {
      get state() { return mine(hand) ? picture(hand).state : 'Idle'; },
      get frame() { return mine(hand) ? st.machine.frame : 0; },
      get isBow() { return !!st.machine?.isBow; },
      get isUnarmed() { return !!st.machine?.isUnarmed; },
      get now() { return st.machine?.now ?? 0; },
    };
  }
  const views = Object.freeze({ R: view('R'), L: view('L') });

  /**
   * The frame (the rig's LateUpdate block, after the machine's step):
   *   mode, machine, strike (the strike in flight - PlayerWeapon.strikeInFlight - or null), leftHanded;
   *   run: { wanted, punching, speed, bob } - the run's answer (runHandsKept), a strike in flight, metres a second over
   *     the ground, the head bob's timer. A hand taken mid-run lets the run go as any end does - eased out - and the draw
   *     yields it at once to whatever picture takes the hands (AUDIT 2: the rig's seam, `running`);
   *   standing - the body still (the fists' guard bounces only standing).
   */
  function step(dt, { mode = HANDS_MODE.Single, machine = null, strike = null, leftHanded = false, run = null, standing = false } = {}) {
    const d = Math.max(0, Math.min(0.1, dt || 0));
    st.mode = mode; st.machine = machine; st.leftHanded = !!leftHanded;
    // AUDIT 2: a punch thrown off the running ARM (the run at or past its swap) - its Weapon Widget clone winds up from
    // below the view (fromBelow), where the arm went, never from the fists' rest it was not standing at
    if (strike?.hand && strike.hand !== st.strikeHand) st.fromBelow = st.run.w >= RUN_PUMP.SWAP ? strike.hand : null;
    else if (!strike) st.fromBelow = null;
    st.strikeHand = strike?.hand ?? null;
    st.time += d;
    const two = twoHanded(mode);
    for (const h of /** @type {const} */ (['R', 'L'])) st.guard[h] = guardStep(st.guard[h], two && st.strikeHand === otherHand(h), d);
    st.bounce = easeTo(st.bounce, mode === HANDS_MODE.Fists && !st.strikeHand && standing ? 1 : 0, BOUNCE_TAU, d);
    const r = run ?? {};
    st.run.wanted = !!r.wanted;
    // AUDIT: on the bob's clock; AUDIT 2: following it, never jumping with it (handsLaw.js runPhaseFollow - the 3D arms' law)
    if (st.run.wanted || st.run.w > 0) st.run.phase = runPhaseFollow(st.run.phase, Number.isFinite(r.bob) ? runPhaseOfBob(r.bob) : null, r.speed ?? 0, d, !(st.run.w > 0));
    st.run.w = runWeightStep(st.run.w, st.run.wanted, !!r.punching, d);
    // AUDIT 2: a hand TAKEN mid-run eases the run out as any end does; the first audit ended it at once, which emptied
    // the view in a frame where nothing took the hands' place (a spell readied with its hands off, a swap's pause). The
    // seam yields the run at once to a picture that does take them (weaponRig.js `runHands`), so it never holds one
    if (!st.run.wanted && st.run.w < 1e-3) st.run.w = 0;
  }

  /** The guard's offset for a hand in canvas pixels, ON THE SCREEN - toward the middle from the hand's own side, and
   *  down, and the fists' bounce. Laid on the picture after its mirror (a hand's picture may be its own arm as painted
   *  or the other's in the mirror - the painted arm, strikePicture - so the side is the hand's, never the picture's).
   *  `h` is the picture's drawn height: a pair's weapon lowers by its share of it (GUARD.LOWER). THE GUARD IS THE RESTING
   *  HAND'S (AUDIT 2): a `striking` picture is never moved - a flurry's blow began with its hand still lowered from the
   *  guard it was easing out of, which sliced a blade's or a flail's top flat inside the view on every second blow. */
  function nudge(hand, canvas, h = null, striking = false) {
    if (striking) return [0, 0];
    const height = st.mode === HANDS_MODE.Dual && Number.isFinite(h) ? /** @type {number} */ (h) * NATIVE_H / canvas.height : null;
    const [gx, gy] = guardOffset(st.guard[hand], handOnLeft(hand, st.leftHanded) ? 'left' : 'right', { time: st.time, bounce: st.bounce, hand, height });
    return [gx * canvas.width / NATIVE_W, gy * canvas.height / NATIVE_H];
  }
  /** The same offset laid BEFORE a mirror (a widget clone's transform runs ahead of its mirror): x turned about. */
  const nudgeBefore = (hand, canvas, mirror, h = null, striking = false) => { const [dx, dy] = nudge(hand, canvas, h, striking); return [mirror ? -dx : dx, dy]; };
  const moved = (r, [dx, dy]) => ({ ...r, x: r.x + dx, y: r.y + dy });

  /** The two hands in the order they are drawn: the one striking last, over the other. */
  const drawOrder = () => (st.strikeHand === 'L' ? ['R', 'L'] : ['L', 'R']);

  /**
   * One hand of a pair through the CLASSIC sprite - FPSWeapon's own placement of its picture's frame, unflipped, the
   * mirror over it when the picture asks one and the guard on the screen. Returns the rect it drew, or null.
   */
  function drawClassicHand(renderer, canvas, hand, art, { tint = null, offsetHeight = 0, glow = null } = {}) {
    const v = views[hand];
    const q = fpsWeaponQuad(canvas, art, v.state, v.frame, { flipHorizontal: false, offsetHeight });
    if (!q) return null;
    const mirror = mirrorOf(hand, painted(v.state));
    const rect = moved(mirror ? mirrorRect(q.rect, canvas.width) : q.rect, nudge(hand, canvas, q.rect.h, v.state !== 'Idle'));
    const uv = mirror ? MIRROR_UV : q.uv;
    renderer.drawScreenQuad(q.tex, rect, uv, tint ?? undefined);
    // WEAPON-GLOW1 (bible/05-Combat/Weapon-Glow.md): this hand's own weapon's element, its outline over its own picture -
    // the mirror's rect and source, measured in the record's own pixels (drawFpsWeapon's line)
    if (glow) renderer.drawScreenQuadGlow?.(q.tex, rect, uv, glow, { art: [q.rec.width, q.rec.height], view: [canvas.width, canvas.height] });
    return rect;
  }

  /**
   * THE PAIR, DRAWN - both hands, the striking one over the other, unless the running hands hold them (drawRun). `widget`
   * is the right hand's clone (the rig's), used with the left's own while the Weapon Widget is on; a clone with nothing to
   * draw (its art still loading) falls through to the classic sprite for that hand, as the one hand's seam does (WW4).
   * `artFor(hand)` answers a hand's classic art, `glowFor(hand)` its weapon's element (WEAPON-GLOW1 - a widget clone is
   * handed its own in its frame). `running` the seam's word that the running hands are drawn this frame (it yields them
   * to any picture that takes the hands). True when it owned the seam.
   */
  function drawPair(renderer, canvas, { widget = null, widgetOn = false, artFor, glowFor = () => null, shown = true, tint = null, offsetHeight = 0, running = st.run.w > 0 } = {}) {
    if (!renderer || !canvas || !twoHanded(st.mode)) return false;
    // the running hands own the fists (drawRun, before this) - all but a punch thrown on the run, drawn here over them
    for (const hand of drawOrder()) {
      if (running && hand !== st.strikeHand) continue;
      const clone = hand === 'R' ? widget : offWidget;
      const shows = clone?.state ?? 0;   // the record the clone draws - it plays its strike a frame behind the machine
      const mirror = mirrorOf(hand, paintedAt(shows));
      if (widgetOn && clone?.draw(renderer, canvas, tint, { transform: (r) => moved(r, nudgeBefore(hand, canvas, mirror, r.h, shows !== 0)), mirror })) continue;
      if (shown) drawClassicHand(renderer, canvas, hand, artFor(hand), { tint, offsetHeight, glow: glowFor(hand) });
    }
    return true;
  }

  /** Where a hand is at rest on screen this frame (the run's start and end): its clone's rect or its classic one, the
   *  guard and the mirror on it - null when nothing of it shows (the run then rises from below). */
  function restRect(hand, canvas, { widget = null, widgetOn = false, art = null, shown = true, offsetHeight = 0 } = {}) {
    if (!twoHanded(st.mode) || st.mode !== HANDS_MODE.Fists) return null;
    const mirror = mirrorOf(hand, painted('Idle'));
    const clone = hand === 'R' ? widget : offWidget;
    let rect = null;
    if (widgetOn && clone?.drawing()) rect = clone.pairRect(mirror);   // the rect its draw lays the mirror over
    else if (shown && art) rect = fpsWeaponQuad(canvas, art, 'Idle', 0, { flipHorizontal: false, offsetHeight })?.rect ?? null;
    if (!rect) return null;
    return moved(mirror ? mirrorRect(rect, canvas.width) : rect, nudge(hand, canvas));
  }

  /**
   * THE RUNNING HANDS, DRAWN (handsLaw.js RUN_PUMP) - every hand not throwing a punch. Below the run's SWAP weight they are
   * the fists' own rest (the idle frame, `fistArt`'s record 0, where the pair draws it - restRect), lowered out of the
   * view by the weight (a sheathed body's fists were down: nothing to lower); above it, THE RUNNING ARM - the art's own
   * jab across (RUN_PUMP.ARM_STATE's frame, the fist's back), placed as FPSWeapon places a frame (its foot on
   * the view's bottom edge, so the forearm runs off the screen) at the idle's own place across the view, the pump's
   * dx/dy on it and the rest of the weight under the view. The art changes only there, never in sight. The hand on its
   * back stroke first, the one coming forward over it. True when it drew.
   */
  function drawRun(renderer, canvas, fistArt, { widget = null, widgetOn = false, shown = true, tint = null, offsetHeight = 0 } = {}) {
    const w = st.run.w;
    if (!(w > 0) || !renderer || !canvas || !fistArt) return false;
    const hands = /** @type {const} */ (['R', 'L']).filter((hand) => hand !== st.strikeHand);   // a punch on the run is drawPair's
    const under = (r) => canvas.height + BELOW * r.h;   // a rect's top just under the view
    if (w < RUN_PUMP.SWAP) {
      const k = w / RUN_PUMP.SWAP;
      const q = fpsWeaponQuad(canvas, fistArt, 'Idle', 0, { flipHorizontal: false, offsetHeight });
      if (!q) return false;
      for (const hand of hands) {
        const rest = restRect(hand, canvas, { widget, widgetOn, art: fistArt, shown, offsetHeight });
        if (!rest) continue;
        const mirror = mirrorOf(hand, painted('Idle'));
        renderer.drawScreenQuad(q.tex, { ...rest, y: rest.y + (under(rest) - rest.y) * k }, mirror ? MIRROR_UV : q.uv, tint ?? undefined);
      }
      return true;
    }
    const k = (w - RUN_PUMP.SWAP) / (1 - RUN_PUMP.SWAP);
    const idle = fpsWeaponQuad(canvas, fistArt, 'Idle', 0, { flipHorizontal: false, offsetHeight });
    if (!idle) return false;
    const cx = idle.rect.x + idle.rect.w / 2;   // the right hand's place across the view: where its fist rests
    const drawn = [];
    for (const hand of hands) {
      const p = pumpOf(st.run.phase, hand);
      const q = fpsWeaponQuad(canvas, fistArt, RUN_PUMP.ARM_STATE, p.frame, { flipHorizontal: false, offsetHeight });
      if (!q) continue;
      // placed as the right hand, then turned about for a hand on the left (the side is the hand's - the mirror of the
      // art is the painted arm's rule, as every draw's)
      const right = { x: cx - q.rect.w / 2 - p.dx * canvas.width, y: q.rect.y + p.dy * q.rect.h, w: q.rect.w, h: q.rect.h };
      const placed = handOnLeft(hand, st.leftHanded) ? mirrorRect(right, canvas.width) : right;
      const rect = { ...placed, y: placed.y + (under(placed) - placed.y) * (1 - k) };
      drawn.push({ tex: q.tex, uv: mirrorOf(hand, painted(RUN_PUMP.ARM_STATE)) ? MIRROR_UV : q.uv, rect, s: p.s });
    }
    drawn.sort((a, b) => a.s - b.s);
    for (const h of drawn) renderer.drawScreenQuad(h.tex, h.rect, h.uv, tint ?? undefined);
    return true;
  }

  return {
    step, drawPair, drawRun, restRect, view: (hand) => views[hand], offWidget,
    /** AUDIT 2: the hand's punch was thrown off the running arm - its clone winds up from below the view. */
    fromBelow: (hand) => st.fromBelow === hand,
    /** The running hands are on the screen (or on their way off it). */
    get running() { return st.run.w > 0; },
    /** The pins' read of the state. */
    get state() { return { mode: st.mode, strikeHand: st.strikeHand, guard: { ...st.guard }, bounce: st.bounce, run: { ...st.run } }; },
  };
}
