// @ts-check
// RVN-STARS (2026-10-17, the owner: "develop a firmament style tree for revenants. Just like we did for ships and
// characters"; bible/06-Systems/Revenants.md section 44) - A SWORN REVENANT'S STARS, DRAWN: its sky
// (systems/revenant/revenantStars.js) in the one window every sky is drawn in (ui/skyWindow.js - the Firmament's dress, as
// the captain's stars wear it). Opened from the Companions page (ui/companionRoster.js - a sworn one's Stars) over the pause
// window (ui/firmamentOver.js revenantStarsOver - the door the Firmament had before GROWTH3 drew it in the Growth tab),
// and the page put back when it closes.
//
// THE THREE ASPECTS: THE BLADE above, in the Firmament's battle ring's brass; THE GRAVE to the right, in a grave-light
// violet of its own; THE ROAD to the left, in the life ring's verdigris. THE OATH in the middle, drawn as a bond - a ring
// and its three ties to the aspects. Nothing here decides what may be set - the law is revenantStars.js, and the oath's
// keeper (revenantCompanions.js setSwornStars) asks it again, and refuses while it is abroad.

import { t, formatNumber } from '../systems/textManager.js';
import { RVN_STARS, RVN_STAR_EDGES, RVN_STAR_STATS, rvnStarOf, rvnHeldStars, rvnWayTo, rvnTakesBack, rvnStarStats } from '../systems/revenant/revenantStars.js';
import { swornStarsBook } from '../systems/revenant/revenantCompanions.js';
import { artOf, drawArt, taughtArt, ART_NAMES } from '../systems/revenant/revenantArts.js';
import { ERRAND } from '../systems/revenant/revenantErrands.js';
import { mountSkyWindow } from './skyWindow.js';
import { GRIM_TONES } from './grimoireDress.js';

/** The sky's own edge: its keystones, its aspects' names, and the keystones' names beside them (AUDIT RVN-STARS S28: at 760
 *  "Grave Pact" ran off a phone's edge at the fitted zoom). */
export const RVN_SKY_EDGE = 820;

// ─── THE WORDS (pure) ───────────────────────────────────────────────

/** Each star's name. */
const NAMES = Object.freeze({
  oath: () => t('rvn.star.oath', 'The Oath'),
  b_hp1: () => t('rvn.star.bHp1', 'Grave-Cold Flesh'), b_hp2: () => t('rvn.star.bHp2', 'Knitting Bones'),
  b_iron: () => t('rvn.star.bIron', 'Iron Sinew'), b_hp3: () => t('rvn.star.bHp3', 'Hollow Heart'),
  b_deathless: () => t('rvn.star.bDeathless', 'Deathless'),
  b_bl1: () => t('rvn.star.bBl1', 'Old Grudge'), b_bl2: () => t('rvn.star.bBl2', 'Remembered Wounds'),
  b_relent: () => t('rvn.star.bRelent', 'Relentless'), b_bl3: () => t('rvn.star.bBl3', 'Killing Edge'),
  b_rage: () => t('rvn.star.bRage', 'Bloodrage'),
  g_pow1: () => t('rvn.star.gPow1', 'Grave Whisper'), g_pow2: () => t('rvn.star.gPow2', 'Cold Breath'),
  g_focus: () => t('rvn.star.gFocus', 'Dark Focus'), g_pow3: () => t('rvn.star.gPow3', 'Deep Well'),
  g_pact: () => t('rvn.star.gPact', 'Grave Pact'),
  g_hst1: () => t('rvn.star.gHst1', 'Quick Hands'), g_hst2: () => t('rvn.star.gHst2', 'Short Breath'),
  g_rite: () => t('rvn.star.gRite', 'Swift Rite'), g_hst3: () => t('rvn.star.gHst3', 'Ready Word'),
  g_wake: () => t('rvn.star.gWake', 'Awakened Art'),
  r_odd1: () => t('rvn.star.rOdd1', 'Road-Wise'), r_haul1: () => t('rvn.star.rHaul1', 'Deep Pockets'),
  r_far: () => t('rvn.star.rFar', 'Far-Walker'), r_haul2: () => t('rvn.star.rHaul2', 'Keen Eye'),
  r_fortune: () => t('rvn.star.rFortune', 'Fortune\'s Road'),
  r_loy1: () => t('rvn.star.rLoy1', 'Bound Word'), r_rest1: () => t('rvn.star.rRest1', 'Quick to Mend'),
  r_bound: () => t('rvn.star.rBound', 'Oathbound'), r_rest2: () => t('rvn.star.rRest2', 'Tireless'),
  r_vigil: () => t('rvn.star.rVigil', 'Undying Vigil'),
});
/** A star's name - its id where none is written. */
export const rvnStarName = (id) => NAMES[id]?.() ?? id;
/** Each aspect's name. */
const ASPECTS = Object.freeze({
  blade: () => t('rvn.stars.aspect.blade', 'The Blade'), grave: () => t('rvn.stars.aspect.grave', 'The Grave'), road: () => t('rvn.stars.aspect.road', 'The Road'),
});
/** What a star is, as its card says it: "The Grave · notable". */
export function rvnStarKindWords(star) {
  if (!star) return '';
  if (star.kind === 'start') return t('rvn.stars.kind.start', 'Starting star');
  const kind = star.kind === 'keystone' ? t('rvn.stars.kind.keystone', 'keystone') : star.kind === 'notable' ? t('rvn.stars.kind.notable', 'notable') : t('rvn.stars.kind.small', 'star');
  return `${ASPECTS[star.sec]?.() ?? star.sec} · ${kind}`;
}
const pct = (a) => `${Math.round(a * 100)}%`;
/** A stat's line: "Health +5%" - the odds as the odds' own percent (ERRAND.ODDS.PER a point), the road and the losses
 *  and the rests as how much shorter, smaller or quicker. */
export function rvnStarStatWords(key, v) {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const a = Math.abs(v);
  switch (key) {
    case 'health': return t('rvn.stars.stat.health', 'Health {n}', { n: `${sign}${pct(a)}` });
    case 'blows': return t('rvn.stars.stat.blows', 'Damage {n}', { n: `${sign}${pct(a)}` });
    case 'art': return t('rvn.stars.stat.art', 'Art strength {n}', { n: `${sign}${pct(a)}` });
    case 'haste': return t('rvn.stars.stat.hasteShorter', 'Its art can be used again {n} sooner', { n: pct(a) });   // AUDIT RVN-STARS S26: a share of the time, not of the pace
    case 'awaken': return t('rvn.stars.stat.awaken', 'Learns an art of its kind, if it was born without one');
    case 'bold': return t('rvn.stars.stat.bold', 'Brings back nothing if it returns hurt');
    case 'odds': return t('rvn.stars.stat.odds', 'Mission odds {n}', { n: `${sign}${pct(a * ERRAND.ODDS.PER)}` });
    case 'haul': return t('rvn.stars.stat.haul', 'Mission gold and materials {n}', { n: `${sign}${pct(a)}` });
    case 'road': return v >= 0 ? t('rvn.stars.stat.roadShort', 'Missions {n} shorter', { n: pct(a) }) : t('rvn.stars.stat.roadLong', 'Missions {n} longer', { n: pct(a) });
    case 'loyal': return t('rvn.stars.stat.loyal', 'Loyalty losses {n} smaller', { n: pct(a) });
    case 'rest': return t('rvn.stars.stat.restShorter', 'Rests {n} shorter', { n: pct(a) });   // AUDIT RVN-STARS S26: half the rest is twice as fast, not 50% faster
    default: return `${key} ${sign}${pct(a)}`;
  }
}
/** A star's lines: its stats in words, a price (a stat under 0, the road's longer, a hard road's nothing) marked. */
export const rvnStarLines = (star) => Object.entries(star?.stats ?? {}).map(([k, v]) => ({ text: rvnStarStatWords(k, v), neg: v < 0 || k === 'bold' }));
/** The sky's sums as the side panel says them, in RVN_STAR_STATS' order: `[{ key, text, neg }]` (each sum under its most). */
export function rvnSkySummary(held) {
  const s = rvnStarStats(held);
  return RVN_STAR_STATS.filter((k) => s[k]).map((k) => ({ key: k, text: rvnStarStatWords(k, s[k]), neg: s[k] < 0 || k === 'bold' }));
}
/** Why `id` cannot be set now, in words - null when it can (the law's way to it, the points left). Pure. */
export function rvnStarRefusal(held, id, points) {
  if (!rvnStarOf(id)) return t('rvn.stars.no.unknown', 'Unknown star.');
  const h = rvnHeldStars(held);
  if (h.includes(id)) return null;
  const way = rvnWayTo(h, id);
  if (!way?.length) return t('rvn.stars.no.way', 'This star isn\'t connected to any star it has taken.');
  const left = points - (h.length - 1);
  if (way.length > left) return t('rvn.stars.no.pointsAfter', 'Reaching this star costs {need} {need, plural, one {point} other {points}}. It has {left}. It gets one point per level after the first, and one per rank past the first.', { need: way.length, left: Math.max(0, left) });
  return null;
}
/** Its art in the side panel's words: the one it has (born or awakened), or what Awakened Art would teach it. */
export function rvnArtNote(r) {
  if (!r) return '';
  const born = drawArt(r.id, r.mobileType), now = artOf(r), taught = taughtArt(r.id, r.mobileType);
  if (born) return t('rvn.stars.art.born', 'Its art: {art}. The Grave makes it stronger and quicker.', { art: ART_NAMES[born] });
  if (now) return t('rvn.stars.art.awakened', 'Its art: {art}, awakened by its stars. The Grave makes it stronger and quicker.', { art: ART_NAMES[now] });
  return taught ? t('rvn.stars.art.none', 'It was born without an art. Awakened Art would teach it {art}.', { art: ART_NAMES[taught] }) : '';
}

// ─── THE WINDOW ─────────────────────────────────────────────────────

const G = GRIM_TONES;
/** THE GRAVE's own tone, past the Firmament's two: a grave-light violet (Plus), a mulberry ink (Grimoire). */
const GRAVE_TONE = Object.freeze({
  // a way's fill the lit red its lines are drawn in, as the battle ring's (AUDIT RVN-STARS S28: a violet fill on red lines)
  plus: Object.freeze({ edge: 'rgba(132,104,176,0.45)', edgeLit: '#d8432f', path: 'rgba(216,67,47,0.5)', rim: '#7a62a8', lit: '#d4bcff', litRim: '#6b4fa0', glow: 'rgba(190,150,255,0.75)' }),
  grim: Object.freeze({ edge: 'rgba(78,42,110,0.5)', edgeLit: G.red, path: 'rgba(181,36,24,0.45)', rim: '#4e2a6e', lit: '#6b3f8f', litRim: G.goldLeaf, glow: 'rgba(78,42,110,0.3)' }),
});
/** THE OATH: a bond - its ring, an inner ring, and three ties out to the aspects (up, and down to either side). */
function drawOath(ctx, x, y, r, rim, line) {
  ctx.beginPath();
  for (const deg of [0, 120, 240]) {
    const a = ((deg - 90) * Math.PI) / 180;
    ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    ctx.lineTo(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10));
  }
  ctx.lineWidth = line(3);
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.lineWidth = line(2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();
}

/**
 * Mount sworn revenant `id`'s stars over `host`. `book` its keeper (revenantCompanions.js swornStarsBook - tests hand
 * their own); `changed` once a sky is accepted; `onExit` when it closes.
 * @param {HTMLElement} host
 * @param {{ id: string, book?: ReturnType<typeof swornStarsBook>, changed?: () => void, onExit?: (reason?: string) => void, doc?: Document }} deps
 */
export function mountRevenantStarsWindow(host, { id, book = swornStarsBook(id), changed = () => {}, onExit = () => {}, doc = document }) {
  const reading = () => book.stars();
  /** AUDIT RVN-STARS S20: a record no longer sworn has no points to set (the window opened on a lazy chunk's race). */
  const purse = () => (book.record()?.sworn ? reading().points : 0);
  const name = book.record()?.name ?? '';
  /** @type {import('./skyWindow.js').SkyDesc} */
  const sky = {
    label: t('rvn.stars.title', '{name}\'s Stars', { name }),
    stars: RVN_STARS, edges: RVN_STAR_EDGES, edge: RVN_SKY_EDGE, seed: 31337, start: 'oath',
    held: rvnHeldStars, wayTo: rvnWayTo, takesBack: rvnTakesBack,
    points: purse,
    committed: () => book.tree(),
    commit: (ids) => book.setTree(ids),
    name: rvnStarName, kindWords: rvnStarKindWords, statLines: rvnStarLines, summary: rvnSkySummary, refusal: rvnStarRefusal,
    tone: (s) => (s?.sec === 'grave' ? 'grave' : s?.sec === 'road' ? 'life' : 'main'),
    tones: { grave: GRAVE_TONE },
    chips(el, pending) {
      const c = reading(), points = purse(), left = points - (pending.length - 1);
      const level = el('span', 'fmt-purse');
      level.replaceChildren(el('span', null, t('rvn.stars.level', 'Level')), el('b', null, String(c.level)),
        el('span', 'of', c.next == null ? t('rvn.stars.top', 'max') : t('rvn.stars.xp', '{xp} of {next} XP', { xp: formatNumber(c.xp), next: formatNumber(c.next) })));   // AUDIT RVN-STARS S25: the player's own grouping
      level.title = t('rvn.stars.levelTip', 'It earns experience from fights won at your side (more for stronger enemies) and from missions it returns from.');
      const pts = el('span', 'fmt-purse life');
      pts.replaceChildren(el('span', null, '★'), el('b', null, String(Math.max(0, left))), el('span', 'of', t('rvn.stars.of', 'of {n}', { n: points })));
      pts.title = t('rvn.stars.pointsTip', 'One point per level after the first, and one per rank past the first.');
      return [level, pts];
    },
    side(el, pending) {
      const r = book.record();
      const parts = [el('h3', null, t('rvn.stars.sumHead', 'What its stars do'))];
      const ul = el('ul');
      const lines = rvnSkySummary(pending);
      if (!lines.length) ul.append(el('li', 'none', t('rvn.stars.none', 'No stars taken yet. Start next to the Oath.')));
      for (const l of lines) ul.append(el('li', l.neg ? 'neg' : null, l.text));
      parts.push(ul);
      parts.push(el('h3', null, ASPECTS.blade()), el('p', 'fmt-sign', t('rvn.stars.bladeLore', 'Its body: health and damage.')));
      parts.push(el('h3', null, ASPECTS.grave()), el('p', 'fmt-sign', t('rvn.stars.graveLore', 'Its art: how strong it is, how often it can use it, and an art for a revenant born without one.')));
      const art = rvnArtNote(r);
      if (art) parts.push(el('p', 'fmt-note', art));
      parts.push(el('h3', null, ASPECTS.road()), el('p', 'fmt-sign', t('rvn.stars.roadLore', 'Missions and loyalty: mission odds, loot, travel time, loyalty and rest.')));
      parts.push(el('p', 'fmt-note', t('rvn.stars.note', 'Changing its stars is free, but not while it\'s away. Its health and damage change at once.')));
      const why = book.refusal();
      if (why) parts.push(el('p', 'fmt-note', why));
      return parts;
    },
    figures: [
      { text: () => t('rvn.stars.aspect.bladeCaps', 'THE BLADE'), x: 0, y: -700 },
      { text: () => t('rvn.stars.aspect.graveCaps', 'THE GRAVE'), x: 606, y: 350 },
      { text: () => t('rvn.stars.aspect.roadCaps', 'THE ROAD'), x: -606, y: 350 },
    ],
    drawStart: drawOath,
    words: {
      forget: t('rvn.stars.forget', 'Discard changes'), forgot: t('rvn.stars.forgot', 'Changes discarded.'),
      accept: t('rvn.stars.accept', 'Accept'), acceptN: (n) => t('rvn.stars.acceptN', 'Accept ({n})', { n }),
      summary: t('rvn.stars.summary', 'Summary'), home: t('rvn.stars.oathBtn', 'Oath'), homeAria: t('rvn.stars.oathAria', 'Center on the Oath'),
      close: t('rvn.stars.close', 'Close'),
      hint: t('rvn.stars.hint', 'Click a star to take it and the stars on the way to it · Right-click to remove · Drag to pan · Scroll to zoom · H: back to the Oath'),
      hintTouch: t('rvn.stars.hintTouch', 'Tap a star to see it, tap again to take it · Hold a star to remove it · Drag to pan · Pinch to zoom'),
      unaccepted: t('rvn.stars.unaccepted', 'You have unaccepted changes. Press {accept} to keep them, or close again to discard them.', { accept: t('rvn.stars.accept', 'Accept') }),
      unacceptedEsc: t('rvn.stars.unacceptedLeave', 'You have unaccepted changes. Press {accept} to keep them, or leave again to discard them.', { accept: t('rvn.stars.accept', 'Accept') }),   // AUDIT GROWTH LANE4-1: the sheet's key, not Close
      set: t('rvn.stars.set', 'Stars saved.'),
      startTip: t('rvn.stars.tip.oath', 'Every sworn revenant starts with the Oath. Take a star next to it.'),
      backMany: (n) => t('rvn.stars.tip.backAfter', 'Right-click to remove it and {n, plural, one {the star} other {the # stars}} after it.', { n }),   // AUDIT RVN-STARS S24: never "the 1 stars"
      back: t('rvn.stars.tip.back', 'Right-click to remove.'),
      take: (n) => t('rvn.stars.tip.take', 'Click to take: {n} {n, plural, one {point} other {points}}.', { n }),
      noPoints: t('rvn.stars.noPointsAfter', 'It gains one point for each level after the first. It earns experience from fights won at your side and from missions.'),
    },
  };
  return mountSkyWindow(host, sky, { changed, onExit, doc });
}
