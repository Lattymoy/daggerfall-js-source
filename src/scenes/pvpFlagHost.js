// @ts-check
// PVP-FLAG (systems/wild/pvpFlag.js): THE FLAG, ON THIS PAGE - the module the world host wires (src/scenes/fishHost.js is
// the shape). It holds my flag and every peer's as the zone's referee says them (`wref` k 'flag'), notes my last PvP blow
// given or taken (`wref` k 'hp'), toggles on Caps Lock or the HUD button, and answers the two doors the host asks: may I
// strike a player (my flag up), and is a Portal Stone free of the zone's law (I am not flagged - the owner: "with no
// flagg we will allow player to use portal stone anywwere").
import { pvpFlagRefusal, PVP_FLAG, pvpAggroLeft } from '../systems/wild/pvpFlag.js';
import { t } from '../systems/textManager.js';
import { noteCaps } from '../ui/capsFix.js';
import { skullSrc } from '../ui/pvpSkull.js';
import { CONCEAL_MODE } from '../systems/combatVisuals.js';   // PVP-BAR
import { isVillain } from '../systems/wild/villainLaw.js';   // PVP-VILLAIN

/** PVP-BAR: a concealed player in a PvP fight - a faint body that keeps its skull and bar (the name is taken). */
export const PVP_FIGHT_VEIL = Object.freeze({ mode: CONCEAL_MODE.reveal, alpha: 0.3, t: 0, phase: 0, named: true });
/** PVP-BAR: how long a frame's veil stands for the name pass that follows it. */
const VEIL_FRAME_MS = 250;
/** PVP-BAR: a point's whole name taken, its skull and bar kept. */
const nameless = (p) => ({ ...p, name: '', title: null, glyphs: [], lv: null, gt: null, rb: null, house: null, tint: null });

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
  const bars = new Map();   // PVP-BAR: a flagged peer's id -> its bar `{ h, s }`, per cent
  const veiled = new Map();   // PVP-BAR: a concealed peer in a fight -> when a frame last drew it faint
  const foes = new Map();   // PVP-CONE: a peer I struck or was struck by -> when
  const reds = new Set();   // PVP-VILLAIN: the flagged peers the referee says are villains
  let villainy = /** @type {number | null} */ (null);   // my own meter, the referee's word (null: not heard)
  const me = () => online()?.id ?? null;
  /** PVP-SKULL: a skull's kind - none unflagged, red a villain, gold in aggro, white else. */
  const skullOf = (id) => (peers.has(id) ? (reds.has(id) ? 'red' : peers.get(id) > now() ? 'gold' : 'white') : null);
  /** PVP-CONE: a peer I struck or was struck by within PVP_FLAG.lockMs - my foe. */
  const foeOf = (id) => foes.has(id) && now() - foes.get(id) < PVP_FLAG.lockMs;
  const mySkull = () => (on ? (isVillain(villainy) ? 'red' : now() - fightAt < PVP_FLAG.lockMs ? 'gold' : 'white') : null);
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
    const why = pvpFlagRefusal({ on: !on, level: level(), fightAt, now: now(), red: isVillain(villainy) });
    if (why) { say(why); return false; }
    set(!on);
    say(on ? t('pvp.flag.on', 'PvP is on. Flagged players can attack you.') : t('pvp.flag.off', 'PvP is off.'));
    return true;
  };
  /** The referee's word: a flag (mine is its to hold - a drop refused in the lock comes back up), or a blow on me or by me. */
  const heard = (g) => {
    if (g?.k === 'flag') {
      if (g.id !== me() && g.f === 1 && g.v === 1) reds.add(g.id); else reds.delete(g.id);
      if (g.id === me()) { on = g.f === 1; paint(); } else if (g.f === 1) peers.set(g.id, g.a ? now() + g.a : -Infinity); else { peers.delete(g.id); bars.delete(g.id); }
      return true;
    }
    if (g?.k === 'vil') { villainy = g.n; paint(); return true; }   // PVP-VILLAIN: my meter, for the sheet
    if (g?.k === 'bar') { bars.set(g.id, { h: g.h, s: g.s ?? 0 }); return true; }   // PVP-BAR: the referee's word on a flagged fighter's bar
    if (g?.k !== 'hp') return false;
    if (g.by === me() || g.to === me()) { fightAt = now(); foes.set(g.by === me() ? g.to : g.by, fightAt); }
    for (const [id, hp, max] of g.h ?? []) if (max > 0) bars.set(id, { h: hp > 0 ? Math.max(1, Math.min(100, Math.round((100 * hp) / max))) : 0, s: bars.get(id)?.s ?? 0 });   // PVP-BAR: a blow's own count, at once
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
    foeOf,
    /** PVP-SET: the combat lock left on me, ms (0 none) - the PvP set is fixed while it runs. */
    fightLeft: () => pvpAggroLeft(fightAt, now()),
    /** PVP-VILLAIN: my villain meter as the referee last said it, or null. */
    villainy: () => villainy,
    /** PVP-SKULL: wrap the host's name mask - each player's point wears its skull (ui/nameLayer.js draws it). PVP-BAR: and
     *  its bar. A flagged player the mask leaves nameless (the zone's stranger) or veils keeps both, without a name.
     *  PVP-CONE: my party (`social`, net/social.js) and my foe are `near`, shown off the crosshair too (ui/nameCone.js). */
    mask: (inner, social = null) => (p) => {
      const q = inner ? inner(p) : p;
      if (!p || p.kind === 'board') return q;
      const k = skullOf(p.id), near = foeOf(p.id) || !!social?.isPartyPeer?.(p.id);
      if (!k) return q && near ? { ...q, near } : q;
      const bar = bars.get(p.id);
      const shown = !q || now() - (veiled.get(p.id) ?? -Infinity) < VEIL_FRAME_MS ? nameless(q ?? p) : q;
      return { ...shown, skull: k, ...(bar ? { bar } : {}), ...(near ? { near } : {}) };
    },
    /** PVP-BAR (the owner: "They always have some body just fiant"): a concealed peer in a PvP fight (its skull gold) is
     *  drawn faint, never nowhere - `look` is combatVisuals.js peerDraw's answer for its pose's `cv`. */
    look: (id, bits, look) => {
      if (look?.kind === 'plain' || (bits & 7) === 7 || !['gold', 'red'].includes(skullOf(id) ?? '')) return look;   // 7: a staff member inside its event's boss
      veiled.set(id, now());
      return { kind: 'conceal', visual: PVP_FIGHT_VEIL };
    },
  };
  _current = api;
  return api;
}

let _current = /** @type {any} */ (null);
/** The page's flag, for a door outside the host (scenes/portalStoneHost.js). */
export const pvpFlagOn = () => _current?.on() ?? true;   // no host (a headless door): flagged, as an old client is
/** PVP-SKULL: a peer's skull for a door outside the host (scenes/travelViewMarks.js - the Overworld's marks), or null. */
export const pvpSkullOf = (id) => _current?.skullOf(id) ?? null;
/** PVP-CONE: is a peer my foe of the last minute, for a door outside the host. */
export const pvpFoeOf = (id) => !!_current?.foeOf(id);
/** PVP-VILLAIN: my villain meter for the character sheet (ui/pvpVillainBar.js), or null - none heard. */
export const pvpVillainy = () => _current?.villainy() ?? null;
