// @ts-check
// PVP-FLAG (systems/wild/pvpFlag.js): THE FLAG, ON THIS PAGE - the module the world host wires (src/scenes/fishHost.js is
// the shape). It holds my flag and every peer's as the zone's referee says them (`wref` k 'flag'), notes my last PvP blow
// given or taken (`wref` k 'hp'), toggles on its key (PvpFlag, Caps Lock by default) or the HUD button, and answers the
// two doors the host asks: may I strike a player (my flag up), and is a Portal Stone free of the zone's law (I am not
// flagged - the owner: "with no flagg we will allow player to use portal stone anywwere").
import { pvpFlagRefusal, PVP_FLAG, pvpAggroLeft } from '../systems/wild/pvpFlag.js';
import { t } from '../systems/textManager.js';
import { noteCaps } from '../ui/capsFix.js';
import { skullSrc } from '../ui/pvpSkull.js';
import { CONCEAL_MODE } from '../systems/combatVisuals.js'; // PVP-BAR
import { isVillain } from '../systems/wild/villainLaw.js'; // PVP-VILLAIN
import { wildHere, WILD_TEXT } from '../systems/wild/wildZone.js'; // PVP-FLAG-ZONE
import { setPvpFoeSight, pvpGearStruck } from '../combat/pvpGearPowers.js'; // PVP-GEAR: a foe's bar and my hits taken
import {
  PVP_FLAG_SPOT,
  createPvpHud,
  pvpHitLine,
  pvpHitsAdd,
  pvpLockOverText,
  pvpSlewText,
  PVP_SAY_S,
} from '../ui/pvpHud.js'; // PVP-HUD
import { eventActions, mouseCode, isDomControlTarget, neverTheFocus } from '../ui/input.js'; // PVP-KEY: the flag's key is the registry's
import { overlayOpen } from '../ui/enhanced/enhancedOverlays.js'; // AUDIT PVP-KEY B1: a window up has the keys
import { actionKeyWord } from '../ui/quickslotTags.js';

/** PVP-KEY: the flag's action in the bindings registry (systems/inputActions.js). */
export const PVP_FLAG_ACTION = 'PvpFlag';

/** PVP-BAR: a concealed player in a PvP fight - a faint body that keeps its skull and bar (the name is taken). */
export const PVP_FIGHT_VEIL = Object.freeze({ mode: CONCEAL_MODE.reveal, alpha: 0.3, t: 0, phase: 0, named: true });
/** PVP-BAR: how long a frame's veil stands for the name pass that follows it. */
const VEIL_FRAME_MS = 250;
/** PVP-BAR: a point's whole name taken, its skull and bar kept. */
const nameless = (p) => ({
  ...p,
  name: '',
  title: null,
  glyphs: [],
  lv: null,
  gt: null,
  rb: null,
  house: null,
  tint: null,
});

// PVP-FLAG-LOOK: flag down, a dim skull in a bronze frame
// as big as the others, never a small green ring.
const SKULL_EDGE = Object.freeze({ off: '#5a4a30', white: '#8a7246', gold: '#e8b62c', red: '#d42a1e' });

/**
 * The host's own (positional, so the wiring is one line of it): its live link, the player, the mid-screen line and the
 * town talk a line is said on.
 * @param {() => any} online @param {any} player @param {(line: string, s?: number) => void} midScreen @param {{ say: (line: string) => void, overlayActive?: boolean }} talk
 * @param {{ doc?: Document | null, now?: () => number, zone?: () => boolean, keyActions?: (e: { code: string | null, shiftKey?: boolean, ctrlKey?: boolean, altKey?: boolean }) => string[], keyWord?: () => string, windowUp?: () => boolean }} [o]
 */
export function createPvpFlagHost(
  online,
  player,
  midScreen,
  talk,
  {
    doc = typeof document === 'undefined' ? null : document,
    now = Date.now,
    zone = wildHere,
    keyActions = eventActions,
    keyWord = () => actionKeyWord(PVP_FLAG_ACTION),
    windowUp = () => !!talk?.overlayActive || overlayOpen(),
  } = {},
) {
  const level = () => Math.trunc(player?.level || 1);
  const say = (line) => {
    midScreen(line);
    talk.say(line);
  };
  const sayLock = (line) => {
    midScreen(line, PVP_SAY_S);
    talk.say(line);
  }; // PVP-HUD: a combat timer's line, 3 s
  let on = false,
    fightAt = -Infinity,
    button = /** @type {HTMLButtonElement | null} */ (null);
  const peers = new Map(); // PVP-SKULL: a flagged peer's id -> when its aggro ends (gold until then)
  const bars = new Map(); // PVP-BAR: a flagged peer's id -> its bar `{ h, s }`, per cent
  const veiled = new Map(); // PVP-BAR: a concealed peer in a fight -> when a frame last drew it faint
  const foes = new Map(); // PVP-CONE: a peer I struck or was struck by -> when
  const reds = new Set(); // PVP-VILLAIN: the flagged peers the referee says are villains
  let villainy = /** @type {number | null} */ (null); // my own meter, the referee's word (null: not heard)
  const names = new Map(); // PVP-HUD: a peer's id -> the name my name layer last showed (a stranger's none)
  let hitLines = /** @type {string[]} */ ([]),
    wasLock = false,
    hud = /** @type {any} */ (null);
  const nameOf = (id) => names.get(id) ?? null;
  const noteName = (id, n) => {
    if (!n || n === WILD_TEXT.stranger) {
      names.delete(id);
      return;
    }
    names.set(id, n);
    if (names.size > 64) names.delete(names.keys().next().value);
  };
  const me = () => online()?.id ?? null;
  /** PVP-FLAG-ZONE: the flag is the zone's alone - Cyrodiil, the open sea, their halls. */
  const here = () => !!online()?.wildOk && !!zone();
  /** PVP-SKULL: a skull's kind - none unflagged, red a villain, gold in aggro, white else. */
  const skullOf = (id) => (peers.has(id) ? (reds.has(id) ? 'red' : peers.get(id) > now() ? 'gold' : 'white') : null);
  /** PVP-CONE: a peer I struck or was struck by within PVP_FLAG.lockMs - my foe. */
  const foeOf = (id) => foes.has(id) && now() - foes.get(id) < PVP_FLAG.lockMs;
  const mySkull = () =>
    on ? (isVillain(villainy) ? 'red' : now() - fightAt < PVP_FLAG.lockMs ? 'gold' : 'white') : null;
  const paint = () => {
    if (!button) return;
    const kind = mySkull();
    Object.assign(button.style, {
      backgroundImage: `url("${skullSrc(kind ?? 'white')}")`,
      borderColor: SKULL_EDGE[kind ?? 'off'],
      filter: kind ? '' : 'grayscale(1) brightness(0.6)',
      boxShadow: kind === 'gold' ? `0 0 0 3px ${SKULL_EDGE.gold}55` : '',
    });
    const key = keyWord() || t('pvp.flag.noKey', 'no key'); // PVP-KEY: the key it answers now
    button.title = on
      ? t('pvp.flag.onTitle', 'PvP on ({key})', { key })
      : t('pvp.flag.offTitle', 'PvP off ({key})', { key });
    button.setAttribute('aria-label', button.title);
    hud?.draw({ kind, left: pvpAggroLeft(fightAt, now()), shown: here(), hits: hitLines });
  };
  /** PVP-HUD: the lock's end said once, and the panel's lines cleared with it. */
  const beat = () => {
    const lock = pvpAggroLeft(fightAt, now()) > 0;
    if (wasLock && !lock) {
      hitLines = [];
      sayLock(pvpLockOverText());
    }
    wasLock = lock;
  };
  const set = (v) => {
    on = v;
    online()?.setWildFlag?.(v);
    paint();
  };
  /** The key or the button: up at once from level 30, down at once outside the lock. */
  const toggle = () => {
    if (!on && !zone()) return false; // PVP-FLAG-ZONE: up only in the zone
    const why = pvpFlagRefusal({ on: !on, level: level(), fightAt, now: now(), red: isVillain(villainy) });
    if (why) {
      (on && pvpAggroLeft(fightAt, now()) > 0 ? sayLock : say)(why);
      return false;
    }
    set(!on);
    say(on ? t('pvp.flag.on', 'PvP is on. Flagged players can attack you.') : t('pvp.flag.off', 'PvP is off.'));
    return true;
  };
  /** PVP-FLAG-ZONE: out of the zone the flag comes down, as soon as the lock and a villain's meter let it. */
  const leave = () => {
    if (!on || zone() || pvpFlagRefusal({ on: false, fightAt, now: now(), red: isVillain(villainy) })) return false;
    set(false);
    say(t('pvp.flag.off', 'PvP is off.'));
    return true;
  };
  /** The referee's word: a flag (mine is its to hold - a drop refused in the lock comes back up), or a blow on me or by me. */
  const heard = (g) => {
    if (g?.k === 'flag') {
      if (g.id !== me() && g.f === 1 && g.v === 1) reds.add(g.id);
      else reds.delete(g.id);
      if (g.id === me()) {
        on = g.f === 1;
        paint();
      } else if (g.f === 1) peers.set(g.id, g.a ? now() + g.a : -Infinity);
      else {
        peers.delete(g.id);
        bars.delete(g.id);
      }
      return true;
    }
    if (g?.k === 'vil') {
      villainy = g.n;
      paint();
      return true;
    } // PVP-VILLAIN: my meter, for the sheet
    if (g?.k === 'bar') {
      bars.set(g.id, { h: g.h, s: g.s ?? 0 });
      return true;
    } // PVP-BAR: the referee's word on a flagged fighter's bar
    if (g?.k === 'fell' && g.by === me() && g.id !== me()) {
      sayLock(pvpSlewText(nameOf(g.id)));
      return false;
    } // PVP-HUD: my kill, named
    if (g?.k !== 'hp') return false;
    if (g.by === me() || g.to === me()) {
      fightAt = now();
      wasLock = true;
      if (g.to === me() && g.d > 0) pvpGearStruck(player); // PVP-GEAR: Bedrock's stack, Hex's window
      foes.set(g.by === me() ? g.to : g.by, fightAt);
      hitLines = pvpHitsAdd(hitLines, pvpHitLine(g, me(), nameOf)); // PVP-HUD: the last hits panel
      paint();
    }
    for (const [id, hp, max] of g.h ?? [])
      if (max > 0)
        bars.set(id, {
          h: hp > 0 ? Math.max(1, Math.min(100, Math.round((100 * hp) / max))) : 0,
          s: bars.get(id)?.s ?? 0,
        }); // PVP-BAR: a blow's own count, at once
    return false;
  };
  /** AUDIT PVP-KEY B1: the world has the key - no window up (a game window, the pause, the Tab dial) and no window's own
   *  control in focus. A letter bound to the flag was typed into the game's text boxes as a flag. */
  const inGame = (el) => !windowUp() && !isDomControlTarget(el) && !el?.closest?.('[data-dom-focus]');
  if (doc) {
    doc.addEventListener('keydown', (e) => {
      const el = /** @type {any} */ (e.target);
      if (e.repeat || el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return;
      const acts = inGame(el) ? keyActions(e) : []; // AUDIT PVP-KEY B2: eventActions - a combo's own, never its bare key's
      if (e.code === 'CapsLock') {
        // PVP-FLAG-CAPS: the light is the game's only where its press did something (AUDIT PVP-KEY B6)
        noteCaps(acts.length ? 'game' : null);
      }
      if (here() && acts.includes(PVP_FLAG_ACTION)) toggle();
    });
    // PVP-KEY: a mouse button bound to the flag, on the world alone (AUDIT PVP-KEY B3: a window's button, the chat and this
    // button were pressed through)
    doc.addEventListener('mousedown', (e) => {
      const code = mouseCode(e.button),
        el = /** @type {any} */ (e.target);
      if (
        code &&
        el?.tagName === 'CANVAS' &&
        inGame(el) &&
        here() &&
        keyActions({ code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey }).includes(PVP_FLAG_ACTION)
      )
        toggle();
    });
    // PVP-FLAG-SPOT: the screen's right edge, just over its middle -
    // clear of the Decorate button centred there (ui/decorPanel.js .dfdecor-open).
    button = doc.createElement('button');
    button.type = 'button';
    Object.assign(button.style, {
      position: 'fixed',
      top: `calc(50% - ${PVP_FLAG_SPOT.lift}px)`,
      right: '8px',
      transform: 'none',
      zIndex: '40',
      width: '36px',
      height: '36px',
      backgroundColor: '#2a241c',
      backgroundSize: '24px',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      imageRendering: 'pixelated',
      border: '2px solid',
      cursor: 'pointer',
      display: 'none',
    });
    button.addEventListener('click', () => toggle());
    neverTheFocus(button); // AUDIT PVP-KEY B5 (FB1020h HUD-FOCUS): clicked, it kept the focus and the next Space pressed it again
    doc.body?.appendChild(button);
    if (doc.body && typeof doc.createElementNS === 'function')
      hud = createPvpHud(doc, () => {
        beat();
        paint();
      }); // PVP-HUD: the ring, the banner, the last hits
    paint();
    setInterval(() => {
      beat();
      leave();
      if (button) {
        button.style.display = here() ? 'block' : 'none';
        paint();
      }
    }, 1000); // where the zone's law reaches; the aggro's end
  }
  const api = {
    on: () => on,
    toggle,
    leave,
    heard,
    beat,
    sayLock,
    /** PVP-HUD: the last hits panel's lines, newest first. */
    hits: () => hitLines,
    nameOf,
    /** Wrap the host's `wref` door: the flag's words taken here, every word handed on. */
    wrap: (inner) => (g, room) => {
      if (!heard(g)) inner(g, room);
    },
    /** May I strike a player: my own flag up (theirs never shields them). */
    fair: () => on,
    flagOf: (peerId) => peers.has(peerId),
    skullOf,
    mySkull,
    foeOf,
    /** PVP-SET: the combat lock left on me, ms (0 none) - the PvP set is fixed while it runs. */
    fightLeft: () => pvpAggroLeft(fightAt, now()),
    /** PVP-VILLAIN: my villain meter as the referee last said it, or null. */
    villainy: () => villainy,
    /** PVP-SKULL: wrap the host's name mask - each player's point wears its skull (ui/nameLayer.js draws it). PVP-BAR: and
     *  its bar. A flagged player the mask leaves nameless (the zone's stranger) or veils keeps both, without a name.
     *  PVP-CONE: my party (`social`, net/social.js) and my foe are `near`, shown off the crosshair too (ui/nameCone.js). */
    mask:
      (inner, social = null) =>
      (p) => {
        const q = inner ? inner(p) : p;
        if (!p) return q; // AUDIT FB1029g R4: no board's point rides the names' pass now
        const k = skullOf(p.id),
          party = !!social?.isPartyPeer?.(p.id),
          near = foeOf(p.id) || party;
        const shown = k && (!q || now() - (veiled.get(p.id) ?? -Infinity) < VEIL_FRAME_MS) ? nameless(q ?? p) : q;
        noteName(p.id, shown?.name); // PVP-HUD: the last hits name whom the layer names
        if (!k) return q && near ? { ...q, near } : q;
        const bar = bars.get(p.id);
        return { ...shown, ...(party ? {} : { skull: k }), ...(bar ? { bar } : {}), ...(near ? { near } : {}) }; // PVP-HUD: my party, green with its bar, no skull
      },
    /** PVP-BAR: a concealed peer in a PvP fight (its skull gold) is
     *  drawn faint, never nowhere - `look` is combatVisuals.js peerDraw's answer for its pose's `cv`. */
    look: (id, bits, look) => {
      const k = skullOf(id);
      if (look?.kind === 'plain' || (bits & 7) === 7 || !k) return look; // 7: a staff member inside its event's boss
      veiled.set(id, now()); // PVP-SEEN (the owner: "concealded or incvis still have a health bar"): nameless, its skull and bar kept
      if (k === 'gold' || k === 'red') return { kind: 'conceal', visual: PVP_FIGHT_VEIL };
      return look.kind === 'conceal' ? { kind: 'conceal', visual: { ...look.visual, named: true } } : look;
    },
    /** PVP-SEEN: an invisible flagged player keeps its tag (net/remotePlayers.js sync's `hidden` answers 'bar'). */
    barKept: (id) => now() - (veiled.get(id) ?? -Infinity) < VEIL_FRAME_MS,
  };
  _current = api;
  setPvpFoeSight((id) => ({ h: bars.get(id)?.h ?? null, fighting: foeOf(id) })); // PVP-GEAR: the foe as my bars see it
  return api;
}

let _current = /** @type {any} */ (null);
/** The page's flag, for a door outside the host (scenes/portalStoneHost.js). */
export const pvpFlagOn = () => _current?.on() ?? true; // no host (a headless door): flagged, as an old client is
/** PVP-SKULL: a peer's skull for a door outside the host (scenes/travelViewMarks.js - the Overworld's marks), or null. */
export const pvpSkullOf = (id) => _current?.skullOf(id) ?? null;
/** PVP-CONE: is a peer my foe of the last minute, for a door outside the host. */
export const pvpFoeOf = (id) => !!_current?.foeOf(id);
/** PVP-HUD: the combat lock left on me, ms (0 none, or no host), for a door outside the host (scenes/portalStoneHost.js). */
export const pvpFightLeft = () => _current?.fightLeft() ?? 0;
/** PVP-HUD: a combat timer's line, mid-screen 3 s and in the talk, for a door outside the host. */
export const pvpLockSay = (line) => {
  _current?.sayLock(line);
};
/** PVP-VILLAIN: my villain meter for the character sheet (ui/pvpVillainBar.js), or null - none heard. */
export const pvpVillainy = () => _current?.villainy() ?? null;
