// @ts-check
// PVP-GUARDS (systems/wild/villainHunt.js): THE HUNT, ON THIS PAGE - the module the world host wires (src/scenes/
// fishHost.js is the shape; it hands the rules host on, so the wiring is the flag's own line). Guards are this client's
// NPCs (scenes/cityGuards.js), so the hunt is too: the relay already says my meter (`wref` `vil`). While I am a red
// villain in a settlement's streets of the open zone, the watch's ring sends my mirrors and keeps them on me; once I
// leave the streets, fall, or am a villain no more, they walk away, as DFU's watch does at the location's edge.
import { wildHere } from '../systems/wild/wildZone.js';
import { isVillain } from '../systems/wild/villainLaw.js';
import { t } from '../systems/textManager.js';
import { huntDue, villainHunted, villainMirror } from '../systems/wild/villainHunt.js';

/** How often the hunt polls, ms. */
export const PVP_GUARDS_POLL_MS = 1000;
/** A hunter's pursuit, in AI ticks - the crime watch's tripled give-up (cityGuards.js spawnGuardAt). */
const HUNT_TICKS = 600;

export const PVP_GUARDS_TEXT = Object.freeze({
  get come() {
    return t('pvp.guards.come', 'You are a villain. This town is no safe zone for you, and the guards come for you.');
  },
  get gone() {
    return t('pvp.guards.gone', 'The guards stop the hunt.');
  },
});

/**
 * The host's own (positional, so the wiring is one line of it): the rules host (handed back whole), the host's lets
 * read at each poll - `[watch, feet, yaw, mode, settled]`: the street's city watch, my feet in its frame, the view's yaw,
 * the mode, and whether I stand in a settlement's streets - the player entity, and the mid-screen line.
 * @template {{ flag: { villainy: () => number | null } }} R
 * @param {R} rules @param {() => any[]} live @param {any} entity @param {(line: string) => void} midScreen
 * @param {{ zone?: () => boolean, now?: () => number, every?: ((fn: () => void, ms: number) => any) | null }} [o]
 */
export function createPvpGuardsHost(
  rules,
  live,
  entity,
  midScreen,
  { zone = wildHere, now = Date.now, every = typeof setInterval === 'undefined' ? null : setInterval } = {},
) {
  let hunt = /** @type {{ at: number, sent: number } | null} */ (null);
  let watch = /** @type {any} */ (null),
    pending = 0;
  const hunters = new Set();
  const standing = () => {
    for (const g of hunters) if (g.dead || !watch?.guards?.includes(g)) hunters.delete(g); // slain, or swept with the world
    return hunters.size;
  };
  const end = () => {
    if (!hunt) return;
    hunt = null;
    for (const g of hunters) watch?.removeGuard?.(g);
    hunters.clear();
    midScreen(PVP_GUARDS_TEXT.gone);
  };
  const tick = () => {
    const [w, feet, yaw, mode, settled] = live() ?? [];
    if (w) watch = w;
    const on =
      !!w &&
      !!feet &&
      villainHunted({
        meterRed: isVillain(rules.flag?.villainy?.()),
        zone: !!zone(),
        outdoors: mode === 'exterior',
        settled: !!settled,
        alive: entity?.health > 0,
      });
    if (!on) {
      end();
      return;
    }
    if (!hunt) {
      hunt = { at: now(), sent: 0 };
      midScreen(PVP_GUARDS_TEXT.come);
    }
    for (const g of hunters) if (!g.dead && !g.ai?.detected) g.ai?.makeHostileToPlayer?.(HUNT_TICKS, [...feet]); // "constantly come after": a lost trail is found again
    const due = huntDue(hunt.at, now(), hunt.sent, standing() + pending);
    hunt.sent = due.sent;
    if (!due.send) return;
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)],
      mirror = villainMirror(entity);
    for (let i = 0; i < due.send; i++) {
      pending++;
      Promise.resolve(w.huntGuard([...feet], fwd, mirror))
        .then((g) => {
          if (g && hunt) hunters.add(g);
          else if (g) w.removeGuard(g);
        }) // the hunt ended while he came: he walks away
        .catch((e) => console.error('[pvp guards]', e))
        .finally(() => {
          pending--;
        });
    }
  };
  every?.(tick, PVP_GUARDS_POLL_MS);
  return { ...rules, tick, hunting: () => !!hunt, hunters: () => [...hunters] };
}
