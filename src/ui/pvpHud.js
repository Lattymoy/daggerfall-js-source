// @ts-check
// PVP-HUD (the owner's mockup of the PvP screens, 2026-10-29: "do we show comag timer rong and cooldown flkag rinf?",
// "was in mock up"): THE COMBAT LOCK, SHOWN. A red ring round the flag button empties over the lock and fills again at
// each PvP blow, its seconds under it; a small banner top-centre says "In combat"; a panel bottom right lists my last
// three PvP blows. Each piece reads the flag host's own state (scenes/pvpFlagHost.js) - this file holds no rule. The
// lines a refused door says in the lock live here too. A departure: DFU has no PvP.
import { t } from '../systems/textManager.js';
import { PVP_FLAG } from '../systems/wild/pvpFlag.js';

/** PVP-FLAG-SPOT: the flag button's place - `lift` px over the right edge's middle, clear of the Decorate button - and size. */
export const PVP_FLAG_SPOT = Object.freeze({ lift: 64, size: 36 });
/** The ring's box (px, centred on the 36 px button), its radius and its stroke; the lines the panel keeps. */
export const PVP_RING = Object.freeze({ size: 52, r: 24, stroke: 3, hits: 3 });
const RED = '#d42a1e',
  LIGHT_RED = '#ff9a8a',
  GROUND = '#2a241c',
  EDGE = '#8a7246';

/** Whole seconds left of a lock of `leftMs` (0 none): 24.1 s left reads 25, as the flag's own refusal counts. */
export const pvpLockSecs = (/** @type {number} */ leftMs) => (leftMs > 0 ? Math.ceil(leftMs / 1000) : 0);

/**
 * The ring for my skull `kind` and the lock left `leftMs`: none unflagged or white and out of the lock; in the lock the
 * share of it left; a villain's full outside it. `dash` is the circle's stroke-dasharray.
 * @returns {{ show: boolean, frac: number, dash: string }}
 */
export function pvpRing(/** @type {string | null} */ kind, /** @type {number} */ leftMs, lockMs = PVP_FLAG.lockMs) {
  const c = 2 * Math.PI * PVP_RING.r;
  const frac = !kind ? 0 : leftMs > 0 ? Math.min(1, leftMs / lockMs) : kind === 'red' ? 1 : 0;
  return { show: frac > 0, frac, dash: `${(frac * c).toFixed(2)} ${c.toFixed(2)}` };
}

/** One blow's line (`wref` `hp`: who on whom, what it dealt): `me` my id, `nameOf` the name my name layer shows, or null. */
export function pvpHitLine(
  /** @type {{ by: string, to: string, d: number }} */ g,
  /** @type {string | null} */ me,
  /** @type {(id: string) => string | null} */ nameOf,
) {
  const mine = g.by === me,
    name = nameOf(mine ? g.to : g.by),
    d = g.d;
  if (mine)
    return name
      ? t('pvp.hud.youHit', 'You hit {name}: {d}', { name, d })
      : t('pvp.hud.youHitAnon', 'You hit a player: {d}', { d });
  return name
    ? t('pvp.hud.hitYou', '{name} hit you: {d}', { name, d })
    : t('pvp.hud.hitYouAnon', 'A player hit you: {d}', { d });
}

/** The panel's list after `line`: the newest first, PVP_RING.hits at most. */
export const pvpHitsAdd = (/** @type {string[]} */ list, /** @type {string} */ line) =>
  [line, ...list].slice(0, PVP_RING.hits);

export const pvpCombatLabel = () => t('pvp.hud.combat', 'In combat');
export const pvpSecsText = (/** @type {number} */ s) => t('pvp.hud.secs', '{s} s', { s });
export const pvpHitsTitle = () => t('pvp.hud.hits', 'Last hits');
/** The doors the lock refuses, and its end - said mid-screen PVP_SAY_S each. */
export const PVP_SAY_S = 3;
export const pvpPortalLockText = (/** @type {number} */ s) =>
  t('pvp.lock.portal', 'You are in combat. Wait {s} s to use a Portal Stone.', { s });
export const pvpRestLockText = (/** @type {number} */ s) =>
  t('pvp.lock.rest', 'You cannot rest in combat. {s} s left.', { s });
export const pvpLockOverText = () => t('pvp.lock.over', 'You are out of combat.');
export const pvpSlewText = (/** @type {string | null} */ name) =>
  name ? t('pvp.kill.slew', 'You slew {name}.', { name }) : t('pvp.kill.slewAnon', 'You slew another player.');

/**
 * The HUD's three pieces on `doc`, beside the flag `button`. `draw(state)` paints them: `kind` my skull, `left` the lock
 * left (ms), `shown` the flag's HUD is up (in the zone), `hits` the panel's lines. While the lock runs `tick` is asked
 * again each frame (`raf`), so the ring moves smoothly; out of it nothing runs.
 * @param {Document} doc @param {() => void} tick
 * @param {{ raf?: ((fn: () => void) => any) | null }} [o]
 */
export function createPvpHud(
  doc,
  tick,
  { raf = typeof requestAnimationFrame === 'undefined' ? null : requestAnimationFrame } = {},
) {
  const NS = 'http://www.w3.org/2000/svg',
    half = PVP_RING.size / 2;
  const fixed = { position: 'fixed', pointerEvents: 'none', display: 'none' };
  const ring = doc.createElementNS(NS, 'svg');
  ring.setAttribute('width', String(PVP_RING.size));
  ring.setAttribute('height', String(PVP_RING.size));
  const ringTop = PVP_FLAG_SPOT.lift + half - PVP_FLAG_SPOT.size / 2; // PVP-FLAG-SPOT: centred on the button where it stands
  Object.assign(ring.style, fixed, { top: `calc(50% - ${ringTop}px)`, right: `${8 + 18 - half}px`, zIndex: '41' }); // over the button's corners, clicks pass through
  const arc = doc.createElementNS(NS, 'circle');
  for (const [k, v] of /** @type {[string, string | number][]} */ ([
    ['cx', half],
    ['cy', half],
    ['r', PVP_RING.r],
    ['fill', 'none'],
    ['stroke', RED],
    ['stroke-width', PVP_RING.stroke],
    ['transform', `rotate(-90 ${half} ${half})`],
  ]))
    arc.setAttribute(k, String(v));
  ring.appendChild(arc);
  const secs = doc.createElement('div');
  Object.assign(secs.style, fixed, {
    top: `calc(50% - ${ringTop + 18}px)`,
    right: '8px',
    width: '36px',
    textAlign: 'center',
    zIndex: '40',
    font: 'bold 12px Georgia, serif',
    color: LIGHT_RED,
    textShadow: '0 1px 2px #000',
  });
  const panel = { background: GROUND, border: `2px solid ${EDGE}`, boxShadow: '0 2px 6px #0008', zIndex: '40' };
  const banner = doc.createElement('div');
  Object.assign(banner.style, fixed, panel, {
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '3px 12px',
    font: '14px Cinzel, "Trajan Pro", Georgia, serif',
    color: LIGHT_RED,
    whiteSpace: 'nowrap',
  });
  const label = doc.createElement('span'),
    count = doc.createElement('b');
  count.style.marginLeft = '0.8em';
  banner.append(label, count);
  const hits = doc.createElement('div');
  Object.assign(hits.style, fixed, panel, {
    right: '8px',
    bottom: '160px',
    width: '230px',
    padding: '6px 10px',
    font: '13px Georgia, serif',
    color: '#e8dcc0',
  });
  doc.body.append(ring, secs, banner, hits);
  let running = false,
    listed = '';
  const show = (el, on) => {
    el.style.display = on ? 'block' : 'none';
  };
  /** @param {{ kind: string | null, left: number, shown: boolean, hits: string[] }} s */
  const draw = (s) => {
    const r = pvpRing(s.kind, s.left),
      lock = s.shown && s.left > 0,
      n = pvpLockSecs(s.left);
    show(ring, s.shown && r.show);
    arc.setAttribute('stroke-dasharray', r.dash);
    show(secs, lock);
    show(banner, lock);
    if (lock) {
      secs.textContent = pvpSecsText(n);
      label.textContent = pvpCombatLabel();
      count.textContent = pvpSecsText(n);
    }
    show(hits, lock && !!s.kind && s.hits.length > 0);
    const key = lock && s.kind ? s.hits.join('\n') : '';
    if (key && key !== listed) {
      const head = doc.createElement('div');
      head.textContent = pvpHitsTitle();
      head.style.cssText = `font: 13px Cinzel, Georgia, serif; color: ${LIGHT_RED}; margin-bottom: 3px`;
      hits.replaceChildren(head, ...s.hits.map((l) => Object.assign(doc.createElement('div'), { textContent: l })));
    }
    listed = key;
    if (lock && raf && !running) {
      running = true;
      raf(() => {
        running = false;
        tick();
      });
    }
  };
  return { draw, ring, arc, secs, banner, hits };
}
