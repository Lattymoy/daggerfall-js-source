// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF-RETICLE (2026-10-01, Mac: "move away from the overcomplicated
// minigame visuals and instead use the mechanics on something that
// doesnt cover the screen"; asked, "Around the crosshair"): THE ACT ON
// THE CROSSHAIR - no box, no title, no picture. Each act's mechanic
// drawn on and about the reticle (ui/worldPlaque.js reticleAnchor: its
// middle, and the lens's focal length, so an angle off the look stands
// `focal * tan(angle)` from it, where the world draws it):
//
//   mine   - the face's five points, marked on the rock itself; the one
//            glinting shows the reach a blow counts double in; a blow's
//            flash on the crosshair (gold on the glint);
//   chop   - the notch a ring round the crosshair, the band a Clean Cut
//            stands in, the ring closing on it (a short still bar under
//            reduced motion);
//   hand / steady, Gentle trace - the hold, an arc round the crosshair
//            (a bruise turns it);
//   basket - the glint at its spot about the crosshair, its time left an
//            arc round it, the three finds as pips;
//   trace  - the line laid on the body, the tolerance it is scored in a
//            faint band under it, the first point's reach, the points
//            passed lit, the line drawn behind the knife;
//   fish   - the throw an arc while it winds (its metres beside it), the
//            float under the crosshair while it waits, a ring's flash at
//            the tug, the haul's band and weight a bar beside the
//            crosshair, the net's fill an arc.
//
// Under the crosshair the count's pips and ONE line of hint, which
// fades once it has stood HINT_MS unchanged (a number in it changing
// does not bring it back - the mark shows the number). The rules, the
// timings and what the service is told stay the acts' (systems/
// herbAct.js, mineAct.js, chopAct.js, traceAct.js, fishAct.js). Built
// ONCE an act and moved every frame; every cue a shape AND a sound -
// the sound the gathering's ear's (systems/gatherSounds.js actBeats,
// GATHER-FEEL: the cues it read off the act, `actCues`, moved there).
// ═══════════════════════════════════════════════════════════════════
import { BASKET_SPOTS } from '../../systems/herbAct.js';
import { MINE_POINTS } from '../../systems/mineAct.js';
import { MINE_ACT, CHOP_ACT, TRACE_ACT, FISH_ACT, throwM } from '../../net/professionLaw.js';
import { t } from '../../systems/textManager.js';   // L10N4: the hint under the crosshair in the player's language

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const pc = (v) => `${Math.round(clamp01(v) * 1000) / 10}%`;
const r1 = (v) => Math.round(v * 10) / 10;

/** How long a flash (a blow, a chop, a find, a slip) stands, ms. */
export const BURST_MS = 420;
/** How long the hint stands unchanged before it fades, ms. */
export const HINT_MS = 2500;
/** The lens's focal length in CSS pixels when the host gives none (a 70 degree view over 700 pixels). */
export const FOCAL_FALLBACK = 500;
/** The notch's radius round the crosshair, CSS pixels at HUD scale 1: the ring's widest is CHOP_ACT.ringFrom of it. */
export const NOTCH_PX = 12;
/** The hold's arc round the crosshair, CSS pixels at HUD scale 1. */
export const ARC_PX = 17;
/** The Basket's spots spread about the crosshair, CSS pixels at HUD scale 1 (BASKET_SPOTS' unit square), its middle
 *  lifted `BASKET_SPREAD[2]` so the lowest glint stands clear of the pips under the crosshair. */
export const BASKET_SPREAD = Object.freeze([110, 60, 10]);

/**
 * Where an angle off the look stands from the crosshair, CSS pixels - `[x right, y down]`: a point `p` (`[yaw, pitch]`,
 * degrees, on the node's face) against the crosshair's `aim` on it, through the lens's `focal`. Pure.
 * @param {readonly number[]} p @param {{ yaw: number, pitch: number }|null} aim @param {number} focal
 */
export function offsetOf(p, aim, focal) {
  const rad = Math.PI / 180;
  const dy = (p[0] - (aim?.yaw ?? 0)) * rad, dp = (p[1] - (aim?.pitch ?? 0)) * rad;
  const lim = 1.4;   // past 80 degrees off the look a mark is off the screen anyway
  return [focal * Math.tan(Math.max(-lim, Math.min(lim, dy))), -focal * Math.tan(Math.max(-lim, Math.min(lim, dp)))];
}
/** An angle's reach on the screen, CSS pixels: a radius of `deg` round the crosshair. */
export const reachPx = (deg, focal) => focal * Math.tan((Math.max(0, Number(deg) || 0) * Math.PI) / 180);
/** The hold's key where the host names none, as a hint says it. */
const useKey = () => t('prof.reticle.useKey', 'the use key');

function kit(doc) {
  const div = (cls, parent = null) => { const n = doc.createElement('div'); n.className = cls; parent?.append(n); return n; };
  /** An SVG element - its class by attribute (an SVG element's className is not a string). */
  const svg = (tag, attrs = {}, parent = null) => {
    const n = typeof doc.createElementNS === 'function' ? doc.createElementNS(NS, tag) : doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    parent?.append(n);
    return n;
  };
  return { div, svg };
}
/** An SVG element's class, set whole. */
const setSvgClass = (n, c) => { if (n.getAttribute?.('class') !== c) n.setAttribute('class', c); };
/** A node's class, set whole only when it changes (a write a frame is a style recalculation a frame). */
const setClass = (n, c) => { if (n.className !== c) n.className = c; };
const show = (n, on) => { const d = on ? '' : 'none'; if (n.style.display !== d) n.style.display = d; };
/** A mark at a screen offset from the crosshair, CSS pixels. */
/** @param {any} n @param {readonly number[]} at */
const place = (n, at) => { const l = `${r1(at[0])}px`, t = `${r1(at[1])}px`; if (n.style.left !== l) n.style.left = l; if (n.style.top !== t) n.style.top = t; };
/** A mark at an offset in HUD-scaled pixels. */
const placeScaled = (n, x, y) => { n.style.left = `calc(${r1(x)}px * var(--hud-scale, 1))`; n.style.top = `calc(${r1(y)}px * var(--hud-scale, 1))`; };

/** The pips of a count under the crosshair: `on` of `n` lit (the strikes, the chops). */
function pips(k, parent, n) {
  const row = k.div('prof-pips', parent);
  const each = Array.from({ length: Math.max(1, n) }, () => k.div('prof-pip', row));
  return (on) => each.forEach((p, i) => setClass(p, i < on ? 'prof-pip on' : 'prof-pip'));
}
/** A flash at a place: restarted by alternating its animation's name, never by a rebuild. */
function burst(k, parent, base) {
  const n = k.div(base, parent);
  let flip = false, until = 0;
  return {
    el: n,
    /** @param {number[]|null} at an offset in CSS pixels, or null where it was placed already */
    fire(at = [0, 0], tone = '') {
      flip = !flip;
      if (at) place(n, at);
      setClass(n, `${base} on ${flip ? 'a' : 'b'}${tone ? ` ${tone}` : ''}`);
      until = Date.now() + BURST_MS;
    },
    frame() { if (until && Date.now() > until) { until = 0; setClass(n, base); } },
  };
}
/** An arc round the crosshair, `r` HUD pixels: `set(share)` fills it from the top, clockwise. */
function arc(k, parent, cls, r = ARC_PX) {
  const box = r + 4;
  const s = k.svg('svg', { class: `prof-arc ${cls}`, viewBox: `${-box} ${-box} ${2 * box} ${2 * box}`, 'aria-hidden': 'true' }, parent);
  s.style.width = `calc(${2 * box}px * var(--hud-scale, 1))`;
  k.svg('circle', { class: 'arc-track', cx: 0, cy: 0, r }, s);
  const fill = k.svg('circle', { class: 'arc-fill', cx: 0, cy: 0, r, pathLength: 100, 'stroke-dasharray': '0 100', transform: 'rotate(-90)' }, s);
  let last = '';
  return {
    el: s,
    set(share) { const d = `${Math.round(clamp01(share) * 1000) / 10} 100`; if (d !== last) { last = d; fill.setAttribute('stroke-dasharray', d); } },
    fill,
  };
}

// ─── THE MARKS ───────────────────────────────────────────────────────

/** The rock's five points where they stand on it; the glinting one's reach; a blow's flash on the crosshair. */
function mineMarks(k, rc, under, act) {
  const face = k.div('prof-face prof-rockface', rc);
  const points = MINE_POINTS.map(() => k.div('prof-point', face));
  const zones = points.map((n) => k.div('prof-zone', n));
  const flash = burst(k, rc, 'prof-burst prof-strike');
  let setPips = pips(k, under, act.state.need), need = act.state.need, seen = 0, zoneFor = -1;
  return {
    update(a, st, ctx) {
      if (st.need !== need) { need = st.need; under.replaceChildren(); setPips = pips(k, under, need); }
      if (ctx.focal !== zoneFor) {
        zoneFor = ctx.focal;
        const d = `${r1(2 * reachPx(MINE_ACT.radiusDeg, ctx.focal))}px`;
        for (const z of zones) { z.style.width = d; z.style.height = d; }
      }
      points.forEach((n, i) => {
        place(n, offsetOf(MINE_POINTS[i], st.aim, ctx.focal));
        setClass(n, i === st.glint ? `prof-glint${ctx.reduced ? ' still' : ''}` : 'prof-point');
      });
      setPips(Math.min(st.points, st.need));
      if (st.strikes > seen) { seen = st.strikes; flash.fire([0, 0], st.last === 'glint' ? 'gold' : ''); }
      flash.frame();
    },
    hint: (st, label) => (st.gentle ? (label || t('prof.reticle.mine.strike', 'click to strike')) : (label || t('prof.reticle.mine.strikeGlint', 'click to strike the glint'))),   // ACT-CLICK: the press named
  };
}

/** The notch round the crosshair, the band a Clean Cut stands in, the ring closing on it (chopAct ringAt, in notch radii). */
function chopMarks(k, rc, under, act) {
  const R = NOTCH_PX, box = Math.ceil(R * CHOP_ACT.ringFrom + 4);
  const art = k.svg('svg', { class: 'prof-ring', viewBox: `${-box} ${-box} ${2 * box} ${2 * box}`, 'aria-hidden': 'true' }, rc);
  art.style.width = `calc(${2 * box}px * var(--hud-scale, 1))`;
  const band = k.svg('circle', { class: 'ring-band', cx: 0, cy: 0, r: R, 'stroke-width': 0 }, art);
  k.svg('circle', { class: 'ring-notch', cx: 0, cy: 0, r: R }, art);
  const ring = k.svg('circle', { class: 'ring-line', cx: 0, cy: 0, r: R * CHOP_ACT.ringFrom }, art);
  // the still form (reduced motion): the ring's marker along a short bar under the crosshair, the band marked
  const bar = k.div('prof-ringbar', rc);
  const bandBar = k.div('prof-ringband', bar);
  const mark = k.div('prof-ringmark', bar);
  const span = CHOP_ACT.ringFrom - CHOP_ACT.ringTo;
  const along = (r) => clamp01((r - CHOP_ACT.ringTo) / span);
  const flash = burst(k, rc, 'prof-burst prof-strike');
  const setPips = pips(k, under, act.state.need);
  let seen = 0;
  return {
    update(a, st, ctx) {
      show(art, !ctx.reduced); show(bar, !!ctx.reduced);
      const r = Math.max(0, a.ring);
      if (ctx.reduced) {
        bandBar.style.left = pc(along(1 - st.band)); bandBar.style.width = pc((2 * st.band) / span);
        mark.style.left = pc(along(r));
      } else {
        band.setAttribute('stroke-width', String(Math.round(Math.max(0, 2 * st.band * R) * 100) / 100));
        ring.setAttribute('r', String(Math.round(r * R * 100) / 100));
      }
      setSvgClass(ring, a.inBand ? 'ring-line in-band' : 'ring-line');
      setClass(bar, a.inBand ? 'prof-ringbar in-band' : 'prof-ringbar');
      setPips(Math.min(st.points, st.need));
      if (st.chops > seen) { seen = st.chops; flash.fire([0, 0], st.last === 'clean' ? 'gold' : ''); }
      flash.frame();
    },
    hint: (st, label) => (st.creaked ? t('prof.reticle.chop.creaks', 'it creaks - keep chopping') : st.gentle ? (label || t('prof.reticle.chop.chop', 'click to chop'))
      : (label || t('prof.reticle.chop.notch', 'click as the ring meets the notch'))),
  };
}

/** The hold, an arc round the crosshair - the kneel's, the steady hand's (a bruise turns it), Gentle acts' trace. */
function holdMarks(k, rc) {
  const hold = arc(k, rc, 'prof-hold');
  return {
    update(a, st) {
      hold.set(a.progress);
      setSvgClass(hold.el, st.bruised ? 'prof-arc prof-hold bruised' : 'prof-arc prof-hold');
    },
    // STEADY-SAID (AUDIT 2026-10-01 part four): the key the steady hand holds, where it holds one
    hint: (st, label, byUse) => {
      const deg = Math.round(st.window * 10) / 10;
      return st.kind === 'trace'
        ? (byUse ? t('prof.reticle.hold.skinning', 'skinning...') : t('prof.reticle.hold.hold', 'hold {key}', { key: label || useKey() }))
        : st.kind === 'steady'
          ? (st.bruised ? (label ? t('prof.reticle.steady.bruisedKey', 'bruised. Keep {key} held to save what is left', { key: label }) : t('prof.reticle.steady.bruised', 'bruised. Hold on to save what is left'))
            : label ? t('prof.reticle.steady.stillKey', 'hold {key} and keep still ({deg} degrees)', { key: label, deg }) : t('prof.reticle.steady.still', 'keep still ({deg} degrees)', { deg }))
          : (label || t('prof.reticle.hold.kneeling', 'kneeling...'));
    },
  };
}

/** The glint at its spot about the crosshair and the time it has left; the three finds as pips. */
function basketMarks(k, rc, under) {
  const glint = k.div('prof-glint', rc);
  const clock = arc(k, glint, 'prof-glintclock', 9);
  const flash = burst(k, rc, 'prof-burst prof-strike');
  const finds = k.div('prof-pips prof-finds', under);
  const slots = [0, 1, 2].map(() => k.div('prof-slot', finds));
  let seen = 0, lastSpot = 0;   // the spot the last glint stood at - a find's flash is there
  const spot = (i) => { const [x, y] = BASKET_SPOTS[i]; return [(x - 0.5) * BASKET_SPREAD[0], (y - 0.5) * BASKET_SPREAD[1] - BASKET_SPREAD[2]]; };
  return {
    update(a, st, ctx) {
      show(glint, st.spot >= 0);
      if (st.spot >= 0) {
        lastSpot = st.spot;
        const [x, y] = spot(st.spot);
        placeScaled(glint, x, y);
        setClass(glint, `prof-glint${ctx.reduced ? ' still' : ''}`);
        clock.set(1 - clamp01(st.showing / Math.max(0.01, st.glint)));
      }
      slots.forEach((s, i) => setClass(s, i < st.hits.length ? (st.hits[i] ? 'prof-slot found' : 'prof-slot missed') : i === st.hits.length ? 'prof-slot next' : 'prof-slot'));
      if (st.hits.length > seen) {
        seen = st.hits.length;
        if (st.hits[seen - 1]) { const [x, y] = spot(lastSpot); placeScaled(flash.el, x, y); flash.fire(null, 'gold'); }
      }
      flash.frame();
    },
    hint: (st, label) => (st.gentle ? t('prof.reticle.basket.searching', 'searching...') : label || t('prof.reticle.basket.glint', 'click the glint')),   // AUDIT HERB-CURSOR C3: the cursor is free to click it; a gentle search has nothing to press
  };
}

/** The line laid on the body, its tolerance under it, the first point's reach, the points passed lit, the knife's line. */
function traceMarks(k, rc, under, act) {
  const st0 = act.state;
  // AUDIT 32 P11: the line the points are scored against drawn through them, the first marked - and a degree the same
  // across as up, now by the lens itself (one focal length both ways)
  const face = k.div('prof-face prof-traceface', rc);
  const band = k.svg('svg', { class: 'prof-tube', width: 1, height: 1, 'aria-hidden': 'true' }, face);   // unedged: an ink edge on a band this wide is a shadow
  const tube = k.svg('path', { class: 'trace-tube', d: '' }, band);
  const art = k.svg('svg', { class: 'prof-line', width: 1, height: 1, 'aria-hidden': 'true' }, face);
  const guide = k.svg('polyline', { class: 'trace-guide', points: '' }, art);   // the scored line: the face's first polyline
  const drawn = k.svg('polyline', { class: 'trace-drawn', points: '' }, art);
  const pts = st0.points.map((p, i) => k.div(i === 0 ? 'prof-point first' : 'prof-point', face));
  const zone = k.div('prof-zone', pts[0]);
  k.div('prof-aim prof-knife', face);
  const nick = burst(k, rc, 'prof-burst prof-nick');
  const slips = k.div('prof-slips', under);
  let seenSlips = 0, lineFor = -1;
  return {
    update(a, st, ctx) {
      const xy = (p) => offsetOf(p, st.aim, ctx.focal);
      const laid = st.points.map(xy);
      const line = laid.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
      guide.setAttribute('points', line);
      tube.setAttribute('d', `M${line.replace(/ /g, ' L')}`);
      if (ctx.focal !== lineFor) {
        lineFor = ctx.focal;
        tube.setAttribute('stroke-width', String(r1(2 * reachPx(st.tol, ctx.focal))));
        const d = `${r1(2 * reachPx(TRACE_ACT.startDeg, ctx.focal))}px`;
        zone.style.width = d; zone.style.height = d;
      }
      drawn.setAttribute('points', st.tracing ? (st.path ?? []).slice(-160).map((p) => xy(p).map(r1).join(',')).join(' ') : '');
      pts.forEach((n, i) => {
        place(n, laid[i]);
        setClass(n, st.tracing && i <= st.reached ? `prof-glint${ctx.reduced ? ' still' : ''}` : i === 0 ? 'prof-point first' : 'prof-point');
      });
      show(zone, !st.tracing);
      if (st.slips > seenSlips) { seenSlips = st.slips; nick.fire([0, 0]); }
      nick.frame();
      const s = st.slips > 0 ? t('prof.reticle.trace.slips', 'slips {n}', { n: st.slips }) : '';
      if (slips.textContent !== s) slips.textContent = s;
    },
    // AUDIT 32 P10 / TOUCH-HOLD: a slip said; a Use's hold names no key
    hint: (s, label, byUse) => {
      const key = label || useKey();
      return s.tracing ? t('prof.reticle.trace.draw', 'draw the knife along the line') : byUse ? t('prof.reticle.trace.aim', 'aim the knife at the first point')
        : s.slips > 0 ? t('prof.reticle.trace.again', 'let go. Hold {key} on the first point again', { key }) : t('prof.reticle.trace.hold', 'hold {key} on the first point', { key });
    },
  };
}

/** The throw an arc while it winds, the float while it waits, the tug's flash, the haul's band and weight, the net's fill. */
function fishMarks(k, rc) {
  const wind = arc(k, rc, 'prof-wind');
  const metres = k.div('prof-rlabel', rc);
  const float = k.div('prof-float', rc);
  const flashRing = k.div('prof-tugring', rc);
  const haul = k.div('prof-haulbar', rc);
  const band = k.div('prof-haulband', haul);
  const weight = k.div('prof-haulweight', haul);
  const fill = arc(k, rc, 'prof-netfill');
  const span = FISH_ACT.throwMaxM - FISH_ACT.throwMinM;
  return {
    update(a, st) {
      const phase = st.phase;
      show(wind.el, phase === 'wind');
      show(metres, phase === 'wind');
      if (phase === 'wind') {
        const m = throwM(st.windS);
        wind.set((m - FISH_ACT.throwMinM) / span);
        const said = t('prof.reticle.fish.metres', '{m} m', { m: Math.round(m) });
        if (metres.textContent !== said) metres.textContent = said;
      }
      const afloat = phase === 'wait' || phase === 'tug';
      show(float, afloat);
      setClass(float, `prof-float${phase === 'tug' ? ' dip' : ''}${st.school !== null ? ' school' : ''}`);
      show(flashRing, phase === 'tug');
      show(haul, phase === 'haul');
      show(fill.el, phase === 'haul');
      if (phase === 'haul') {
        band.style.bottom = pc(st.bandAt); band.style.height = pc(st.bandW);
        weight.style.bottom = pc(st.weight);
        const inside = st.weight >= st.bandAt && st.weight <= st.bandAt + st.bandW;
        setClass(haul, inside ? 'prof-haulbar' : 'prof-haulbar slipping');
        fill.set(st.fill);
      }
    },
    hint: (st, label) => {
      const key = label || 'E';   // a key's own name, as the keyboard prints it
      if (st.phase === 'haul') {
        return st.slip > 0 ? t('prof.reticle.fish.haulSlipping', 'hold {key} to raise the band and let go to lower it. Keep the weight inside (slipping, {pct}%)', { key, pct: Math.round(st.slip * 100) })
          : t('prof.reticle.fish.haul', 'hold {key} to raise the band and let go to lower it. Keep the weight inside', { key });
      }
      return st.phase === 'wind' ? t('prof.reticle.fish.wind', 'hold {key} to wind the net, let go to throw it ({m} m)', { key, m: Math.round(throwM(st.windS)) })
        : st.phase === 'fly' ? t('prof.reticle.fish.fly', 'the net flies...')
          : st.phase === 'wait' ? (st.school !== null ? t('prof.reticle.fish.waitSchool', 'waiting for a bite, over a school...') : t('prof.reticle.fish.wait', 'waiting for a bite...'))
            : t('prof.reticle.fish.tug', 'a tug! press {key} now', { key });
    },
  };
}

// ─── THE RETICLE ─────────────────────────────────────────────────────

/** Which marks an act wears - a trace's Gentle acts, the kneel and the steady hand wear the hold's arc. */
export const marksOf = (act) => {
  const st = act?.state;
  if (!st) return null;
  if (st.kind === 'trace' && st.gentle) return 'hold';
  if (st.kind === 'hand' || st.kind === 'steady') return 'hold';
  return st.kind;
};
const MARKS = { mine: mineMarks, chop: chopMarks, hold: holdMarks, basket: basketMarks, trace: traceMarks, fish: fishMarks };

/**
 * Build an act's marks into `root` (emptied first): the marks about the crosshair's middle, the count and the hint
 * under it. Answers `update(act, { label, byUse, reduced, focal, now })` for every frame of it - the marks moved, the
 * hint said, and faded once it has stood HINT_MS unchanged.
 * @param {Document} doc @param {HTMLElement} root @param {any} act
 */
export function buildActReticle(doc, root, act) {
  const k = kit(doc);
  root.replaceChildren();
  const rc = k.div('prof-rc', root);
  const under = k.div('prof-under', rc);
  const hint = k.div('prof-hint', rc);
  const which = marksOf(act);
  const m = MARKS[which](k, rc, under, act);
  let said = null, saidAt = 0;
  return {
    which,
    update(a, { label = '', byUse = false, reduced = false, focal = FOCAL_FALLBACK, now = Date.now() } = {}) {
      m.update(a, a.state, { reduced, focal: Number(focal) > 0 ? focal : FOCAL_FALLBACK });
      const h = m.hint(a.state, label, byUse);
      if (hint.textContent !== h) hint.textContent = h;
      const key = h.replace(/[\d.]+/g, '#');   // a number moving in the line is the mark's to show, not a new line
      if (key !== said) { said = key; saidAt = now; }
      setClass(hint, now - saidAt > HINT_MS ? 'prof-hint faded' : 'prof-hint');
    },
  };
}
