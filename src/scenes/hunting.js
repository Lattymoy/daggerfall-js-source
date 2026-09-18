// SURV6 - THE HUNT, COMPOSED FOR A HOST. The overworld host (world.js -
// the one host that walks the wilderness; exterior.js lives inside the
// town rect and never rolls) hands in its readers and its doors, and
// this ticks the minute's roll (survival/hunting.js huntRoll), opens
// the window (ui/huntWindow.js) in the overlay slot, rolls and applies
// the outcome at the busy page's end, passes the search's minutes
// offline, tallies the skills the search used, and stands the beast
// through the host's encounter placement when the box closes.
//
//   env()          -> { minute, climateIndex, luck, winter, outdoors,
//                       inLocationRect, night, enemiesNear, resting,
//                       hasBow, skills: { archery, stealth,
//                       criticalStrike, climbing } }
//   showOverlay(w) - the slot; overlayActive() - the slot's latch
//   advanceMinutes(n) - the host's ticker (offline the clock moves;
//                       online it stands, WORLD5)
//   spawnBeast({ mobileType, count }) - the host's placement door
//   inflictPoison / inflictDisease - the formulas (the law is pure)
//   tally(skillId) - the host's tallySkill
import { survivalOn } from '../systems/survival/switch.js';
import { survivalOf } from '../systems/survival/needs.js';
import {
  huntRoll, huntOutcome, applyHuntOutcome, huntPrompt, HUNT_BUSY, HUNT_MINUTES, huntRealSeconds,
} from '../systems/survival/hunting.js';
import { HuntWindow } from '../ui/huntWindow.js';

const range = ([min, max], rolls) => min + Math.floor(rolls() * (max - min + 1));

export function createHunting({
  entity, env, showOverlay = null, overlayActive = () => false, advanceMinutes = null, spawnBeast = null,
  inflictPoison = null, inflictDisease = null, tally = null, rolls = Math.random,
} = {}) {
  let _lastMinute = null;
  let _win = null;

  /** Once a game minute: the roll, and the window when it lands. */
  function tick() {
    if (!survivalOn() || !entity) return null;
    const e = env?.() ?? {};
    const minute = Math.floor(e.minute ?? 0);
    if (minute === _lastMinute) return null;
    _lastMinute = minute;
    if (_win || overlayActive()) return null;
    const ev = huntRoll(survivalOf(entity, minute), { ...e, minute }, rolls);
    return ev ? open(ev, e) : null;
  }

  /** The event's window, in the slot. */
  function open(ev, e = env?.() ?? {}) {
    const minutes = range(HUNT_MINUTES, rolls);
    let outcome = null;
    _win = new HuntWindow({
      prompt: huntPrompt(ev, { winter: !!e.winter }),
      busy: HUNT_BUSY[ev.kind],
      seconds: huntRealSeconds(minutes),
      onSearched: () => {
        const now = env?.() ?? e;
        const minute = Math.floor(now.minute ?? 0);
        outcome = huntOutcome(ev, { hasBow: !!now.hasBow, skills: now.skills ?? {}, luck: now.luck ?? 50, rolls });
        const rows = applyHuntOutcome(entity, entity.items ?? (entity.items = []), outcome, {
          now: minute, currentDay: Math.trunc(minute / 1440), rolls, inflictPoison, inflictDisease,
        });
        for (const id of outcome.skills ?? []) tally?.(id);
        advanceMinutes?.(minutes);
        return rows;
      },
      onClosed: () => {
        _win = null;
        if (outcome?.beast) spawnBeast?.(outcome.beast);
      },
    });
    showOverlay?.(_win);
    return _win;
  }

  return { tick, open, get window() { return _win; } };
}
