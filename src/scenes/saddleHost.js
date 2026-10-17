// @ts-check
// STEED-UI: THE SADDLE PANEL'S HOST (ui/enhanced/enhancedSaddle.js) - the one glue the two hosts that ride share
// (scenes/world.js, scenes/exterior.js - createSaddleHost), so neither builds the panel's read or answers its buttons
// on its own. scenes/worldModes.js (interiors) and scenes/dungeonContext.js (dungeons) stand no transport - a building
// or a dungeon puts the rider on foot (systems/transport.js dismountOnTransition) - and are named, not wired.
//
// Its doors, the host's:
//   upkeep          the host's upkeep (systems/upkeep/upkeepRuntime.js createUpkeep) - its `saddle` read and its `act`
//   runtime()       Horse Cart and Cargo's runtime while its switch is on, else null (the hosts' hccRuntimeOn)
//   items()         the pack                     wagonKg() / wagonLimit()   the wagon's load and its limit (kg)
//   say(text)       a line on the HUD            pass(minutes)              the clock passed (the kit's hour)
//   openStable()    the Holdings page's Stable   canView() / toggleView()   the view's toggle (player/mwView.js)
//   foot()          the classic transport's foot (Horse Cart and Cargo off: no mount key to press)
//
// Each frame the host hands `motion` what its motor rolled (the upkeep's own metres - the odometer's, never a placement)
// and the gait it took (HORSE-TIERS: the motor's own `rideWalking` - a gallop asked and refused rides DFU's pace in
// Boons and walks in Hard, which only the motor knows), and `frame` whether the panel may stand: Enhanced Plus, walking,
// outdoors - and what covers it.
import { drawEnhancedSaddle, hideEnhancedSaddle, enhancedSaddleMounted, toggleSaddlePanel } from '../ui/enhanced/enhancedSaddle.js';
import { upkeepReach } from '../systems/upkeep/upkeepRuntime.js';
import { activeWagonItem } from '../systems/wagon/wagonKinds.js';
import { wagonWord } from '../systems/wagon/wagonUpkeep.js';

/** The pace's smoothing, seconds (a frame's metres jitter with its length). */
export const SADDLE_SPEED_TAU = 0.35;
/** The modes the panel stands in: astride a horse, on a wagon's bench. */
export const SADDLE_MODES = Object.freeze(['Horse', 'Cart']);

/**
 * @param {{ upkeep: any, runtime: () => any, items: () => any[], wagonKg: () => number, wagonLimit: () => number,
 *   say: (t: string) => void, pass: (m: number) => void, openStable: () => void, canView: () => boolean,
 *   toggleView: () => void, foot: () => void }} deps
 */
export function createSaddleHost({ upkeep, runtime, items, wagonKg, wagonLimit, say, pass, openStable, canView, toggleView, foot }) {
  let speed = 0, galloping = false, walking = false;
  /** @type {any} the read the panel stands on now - the horse its Feed and its apple go to */
  let shown = null;
  /** The upkeep's reach for a press made in the saddle: the horse is under its rider, so it is always near. */
  const reach = () => { const rt = runtime(); return { ...upkeepReach(rt, !!rt), near: true, stabled: false }; };
  const act = (verb, arg = 0) => { const r = upkeep.act(verb, arg, { ...reach(), pass }); if (r?.text) say(r.text); return r; };
  const hooks = {
    // the feed and the apple to the horse the panel shows hungry - the one ridden, or the team's hungriest
    feed: () => act('feed', shown?.horse?.feed ?? 0), treat: () => act('treat', shown?.horse?.feed ?? 0), kit: () => act('kit'),
    cargo: () => { runtime()?.openWagonCargo?.(); },
    stable: () => openStable(),
    view: () => toggleView(),
    // Horse Cart and Cargo's mount key (its handler: the direct set to foot, its horse stood behind), else the classic foot
    dismount: () => { const rt = runtime(); if (rt) rt.handleQuickMountOrDismount(); else foot(); },
  };

  /** The frame's motion: `metres` rolled over `dt` seconds, `gallop` the run on a horse, `walk` the walk the motor took
   *  (its `rideWalking`). A pause holds the pace. */
  function motion(dt, metres, gallop, walk = false) {
    galloping = !!gallop;
    walking = !!walk;
    if (!(dt > 0) || !Number.isFinite(metres)) return;
    speed += (metres / dt - speed) * Math.min(1, dt / SADDLE_SPEED_TAU);
  }

  /** The panel's read for `mode`, or null out of the saddle. @param {string} mode */
  function read(mode) {
    if (!SADDLE_MODES.includes(mode)) return null;
    const rt = runtime(), r = reach();
    const base = upkeep.saddle(mode);
    const cart = mode === 'Cart';
    const w = cart ? activeWagonItem(items() ?? []) : null;
    const limit = cart ? wagonLimit() : 0;
    return {
      mode, name: rt?.hasHorseName ? rt.horseName : '', wagonName: w ? wagonWord(w) : '',
      speed, galloping: mode === 'Horse' && galloping,
      walks: mode === 'Horse' && walking,   // HORSE-WALK: the ride's own pace a walk - the word the motor took (HORSE-TIERS), so the panel says what it does
      horse: base.horse, wagon: cart ? base.wagon : null, oats: base.oats, apples: base.apples, kits: base.kits,
      load: cart && limit > 0 ? { kg: wagonKg(), limit } : null,
      near: true, wagonNear: r.wagonNear,
      cargo: cart && rt ? !!rt.canAccessWagonInventory?.()?.allowed : null,
      view: !!canView(), hcc: !!rt,
    };
  }

  /**
   * The panel's frame: `show` the host's gate (Enhanced Plus, walking, outdoors), `mode` the transport, `covered` a
   * window, a pause or a journey over the HUD; `touch`, `mouseFree`, `freeKey` and `keyOf` the helm's own. UI-CALM:
   * `toggle` the panel's key pressed this frame (the host's edge of 'SaddlePanel') - it puts the panel up or away, in
   * the saddle and with nothing over the HUD.
   * @param {{ show: boolean, mode: string, covered?: boolean, touch?: boolean, mouseFree?: boolean, freeKey?: string, keyOf?: (a: string) => string, toggle?: boolean }} f
   */
  function frame({ show, mode, covered = false, touch = false, mouseFree = true, freeKey = 'Y', keyOf, toggle = false }) {
    const s = show ? read(mode) : null;
    if (s && toggle && !covered) toggleSaddlePanel();
    shown = s;
    if (!s) { speed = 0; galloping = false; walking = false; if (enhancedSaddleMounted()) hideEnhancedSaddle(); return null; }
    return drawEnhancedSaddle({ saddle: s, covered, touch, mouseFree, freeKey, keyOf }, hooks);
  }

  return { motion, read, frame, hooks, hide: () => { speed = 0; hideEnhancedSaddle(); }, get speed() { return speed; } };
}
