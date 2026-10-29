// @ts-check
// PVP-FLAG (systems/wild/pvpFlag.js): THE FLAG, ON THIS PAGE - the module the world host wires (src/scenes/fishHost.js is
// the shape). It holds my flag and every peer's as the zone's referee says them (`wref` k 'flag'), notes my last PvP blow
// given or taken (`wref` k 'hp'), toggles on Caps Lock or the HUD button, and answers the two doors the host asks: may I
// strike a player (my flag up), and is a Portal Stone free of the zone's law (I am not flagged - the owner: "with no
// flagg we will allow player to use portal stone anywwere").
import { pvpFlagRefusal, PVP_FLAG } from '../systems/wild/pvpFlag.js';
import { t } from '../systems/textManager.js';
import { noteCaps } from '../ui/capsFix.js';
import { skullSrc } from '../ui/pvpSkull.js';

const SKULL_EDGE = Object.freeze({ off: '#4caf50', white: '#8a7246', gold: '#e8b62c', red: '#d42a1e' });

/**
 * The host's own (positional, so the wiring is one line of it): its live link, the player, the mid-screen line and the
 * town talk a line is said on.
 * @param {() => any} online @param {any} player @param {(line: string) => void} midScreen @param {{ say: (line: string) => void }} talk
 * @param {{ doc?: Document | null, now?: () => number }} [o]
 */
export function createPvpFlagHost(online, player, midScreen, talk, { doc = typeof document === 'undefined' ? null : document, now = Date.now } = {}) {
  const level = () => Math.trunc(player?.level || 1);
  const say = (line) => { midScreen(line); talk.say(line); };
  let on = false, fightAt = -Infinity, button = /** @type {HTMLButtonElement | null} */ (null);
  const peers = new Map();   // PVP-SKULL: a flagged peer's id -> when its aggro ends (gold until then)
  const me = () => online()?.id ?? null;
  /** PVP-SKULL: a skull's kind - none unflagged, gold in aggro, white else. */
  const skullOf = (id) => (peers.has(id) ? (peers.get(id) > now() ? 'gold' : 'white') : null);
  const mySkull = () => (on ? (now() - fightAt < PVP_FLAG.lockMs ? 'gold' : 'white') : null);
  const paint = () => {
    if (!button) return;
    const kind = mySkull();
    button.textContent = kind ? '' : '○';
    Object.assign(button.style, { backgroundImage: kind ? `url("${skullSrc(kind)}")` : '', borderColor: SKULL_EDGE[kind ?? 'off'], color: SKULL_EDGE.off,
      boxShadow: kind === 'gold' ? `0 0 0 3px ${SKULL_EDGE.gold}55` : '' });
    button.title = on ? t('pvp.flag.onTitle', 'PvP on (Caps Lock)') : t('pvp.flag.offTitle', 'PvP off (Caps Lock)');
    button.setAttribute('aria-label', button.title);
  };
  const set = (v) => { on = v; online()?.setWildFlag?.(v); paint(); };
  /** Caps Lock or the button: up at once from level 30, down at once outside the lock. */
  const toggle = () => {
    const why = pvpFlagRefusal({ on: !on, level: level(), fightAt, now: now() });
    if (why) { say(why); return false; }
    set(!on);
    say(on ? t('pvp.flag.on', 'PvP is on. Flagged players can attack you.') : t('pvp.flag.off', 'PvP is off.'));
    return true;
  };
  /** The referee's word: a flag (mine is its to hold - a drop refused in the lock comes back up), or a blow on me or by me. */
  const heard = (g) => {
    if (g?.k === 'flag') {
      if (g.id === me()) { on = g.f === 1; paint(); } else if (g.f === 1) peers.set(g.id, g.a ? now() + g.a : -Infinity); else peers.delete(g.id);
      return true;
    }
    if (g?.k === 'hp' && (g.by === me() || g.to === me())) fightAt = now();
    return false;
  };
  if (doc) {
    doc.addEventListener('keydown', (e) => {
      const el = /** @type {any} */ (e.target);
      if (e.code !== 'CapsLock' || e.repeat || el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return;
      noteCaps('game');
      if (online()?.wildOk) toggle();
    });
    button = doc.createElement('button');
    button.type = 'button';
    Object.assign(button.style, { position: 'fixed', top: '8px', right: '8px', zIndex: '40', width: '36px', height: '36px', font: '20px serif', backgroundColor: '#2a241c', backgroundSize: '24px', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', imageRendering: 'pixelated', border: '2px solid', cursor: 'pointer', display: 'none' });
    button.addEventListener('click', () => toggle());
    doc.body?.appendChild(button);
    paint();
    setInterval(() => { if (button) { button.style.display = online()?.wildOk ? 'block' : 'none'; paint(); } }, 1000);   // where the zone's law reaches; the aggro's end
  }
  const api = {
    on: () => on,
    toggle,
    heard,
    /** Wrap the host's `wref` door: the flag's words taken here, every word handed on. */
    wrap: (inner) => (g, room) => { if (!heard(g)) inner(g, room); },
    /** May I strike a player: my own flag up (theirs never shields them). */
    fair: () => on,
    flagOf: (peerId) => peers.has(peerId),
    skullOf,
    mySkull,
    /** PVP-SKULL: wrap the host's name mask - each player's point wears its skull (ui/nameLayer.js draws it). */
    mask: (inner) => (p) => { const q = inner ? inner(p) : p; const k = q && q.kind !== 'board' ? skullOf(q.id) : null; return k ? { ...q, skull: k } : q; },
  };
  _current = api;
  return api;
}

let _current = /** @type {any} */ (null);
/** The page's flag, for a door outside the host (scenes/portalStoneHost.js). */
export const pvpFlagOn = () => _current?.on() ?? true;   // no host (a headless door): flagged, as an old client is
/** PVP-SKULL: a peer's skull for a door outside the host (scenes/travelViewMarks.js - the Overworld's marks), or null. */
export const pvpSkullOf = (id) => _current?.skullOf(id) ?? null;
