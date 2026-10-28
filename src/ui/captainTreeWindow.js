// @ts-check
// CAPTAIN-TREE (2026-10-17, the owner: "A firmament styled captain skill tree along with making improvements to the ship
// upgrade system"; bible/03-World/Naval-Refit.md CAPTAIN-TREE) - THE CAPTAIN'S STARS, DRAWN: the Firmament's own sky
// (ui/firmamentWindow.js - its sheet, its two palettes, its stars' sizes) over the whole screen, for the captain's sky of
// systems/naval/captainTree.js. Opened from the Captain page (ui/captainPage.js) through the sea's window door
// (ui/naval/navalPlunderDoor.js createCaptainStarsOverlay), over the world, which stands still under it.
//
// WHAT A CAPTAIN DOES HERE - the Firmament's ways, kept:
//   - HOVERS a star to read it, and sees the shortest way to it from what they hold, lit;
//   - PRESSES it to set that whole way, while the captain's points (a level's one, past the first) pay for it;
//   - RIGHT-PRESSES (or long-presses) a star held to take it back, with every star joined to the Helm only through it;
//   - ACCEPTS: a change is pending until then, free to try; accepted, the ledger keeps it (captainLedger.js setTree) and
//     every ship of theirs sails on it from her next reading. A star is free to take back - no gold, no silver.
//   Drag pans, the wheel (or a pinch) zooms, H finds the Helm.
//
// THE TWO HALVES: THE MASTER, to the left, in the Firmament's life ring's verdigris; THE COMMANDER, to the right, in its
// battle ring's brass. Nothing here decides what may be set - the law is captainTree.js, and the ledger asks it again.
//
// RVN-STARS (2026-10-17): the window itself is ui/skyWindow.js now - taken out of this file whole when the sworn
// revenant's sky came (ui/revenantStarsWindow.js), one home for both; this file is the captain's sky as that window
// draws it (its words, its tones, its wheel).

import { t, formatNumber } from '../systems/textManager.js';
import {
  CAPTAIN_STARS, CAPTAIN_EDGES, CAPTAIN_STATS, starOf, heldStars, wayTo, takesBack, starStats, captainOf,
} from '../systems/naval/captainTree.js';
import { mountSkyWindow } from './skyWindow.js';   // RVN-STARS: the one window every sky is drawn in

/** The sky's own edge: the outer keystones and the halves' names. */
export const CAPTAIN_SKY_EDGE = 720;

// ─── THE WORDS (pure) ───────────────────────────────────────────────

/** Each star's name. */
const NAMES = Object.freeze({
  helm: () => t('captain.star.helm', 'The Helm'),
  m_way1: () => t('captain.star.mWay1', 'Trimmed Sheets'), m_way2: () => t('captain.star.mWay2', 'Full and By'),
  m_clean: () => t('captain.star.mClean', 'Clean Bottom'), m_way3: () => t('captain.star.mWay3', 'Studding Sails'),
  m_wind: () => t('captain.star.mWind', 'Master of the Wind'),
  m_oar1: () => t('captain.star.mOar1', 'Stroke Oar'), m_turn1: () => t('captain.star.mTurn1', 'Lee Helm'),
  m_quick: () => t('captain.star.mQuick', 'Quick in Stays'), m_oar2: () => t('captain.star.mOar2', 'Double-Banked Oars'),
  m_hold1: () => t('captain.star.mHold1', 'Tight Stowage'), m_hold2: () => t('captain.star.mHold2', 'Dunnage and Ballast'),
  m_deep: () => t('captain.star.mDeep', 'Deep Hold'), m_trade1: () => t('captain.star.mTrade1', 'Harbor Bargains'),
  m_prince: () => t('captain.star.mPrince', 'Merchant Prince'),
  m_hull1: () => t('captain.star.mHull1', 'Doubled Planking'), m_rep1: () => t('captain.star.mRep1', 'Carpenter\'s Mate'),
  m_oak: () => t('captain.star.mOak', 'Heart of Oak'), m_hull2: () => t('captain.star.mHull2', 'Copper Sheathing'),
  m_iron: () => t('captain.star.mIron', 'Ironsides'),
  c_rel1: () => t('captain.star.cRel1', 'Gun Drill'), c_rel2: () => t('captain.star.cRel2', 'Powder Monkeys'),
  c_drill: () => t('captain.star.cDrill', 'Smart Gun Crews'), c_harm1: () => t('captain.star.cHarm1', 'Double-Shotted'),
  c_line: () => t('captain.star.cLine', 'Ship of the Line'),
  c_aim1: () => t('captain.star.cAim1', 'Gun Captain'), c_aim2: () => t('captain.star.cAim2', 'Quoin and Handspike'),
  c_long: () => t('captain.star.cLong', 'Long Shot'), c_harm2: () => t('captain.star.cHarm2', 'Between Wind and Water'),
  c_shot1: () => t('captain.star.cShot1', 'The Shot Locker'), c_grape: () => t('captain.star.cGrape', 'Canister and Grape'),
  c_chain: () => t('captain.star.cChain', 'Bar and Chain'), c_hot: () => t('captain.star.cHot', 'Hot Shot Furnace'),
  c_board1: () => t('captain.star.cBoard1', 'Boarding Pikes'), c_ram1: () => t('captain.star.cLines', 'Long Lines'),   // BOARD-MAGNET: the ram's star, its id the save's
  c_irons: () => t('captain.star.cIrons', 'Grappling Irons'), c_board2: () => t('captain.star.cBoard2', 'Cutlass Drill'),
  c_creed: () => t('captain.star.cCreed', 'Boarders Away'),
});
/** A star's name - its id where none is written. */
export const starName = (id) => NAMES[id]?.() ?? id;
/** What a star is, as its card says it: "The Master · notable". */
export function starKindWords(star) {
  if (!star) return '';
  if (star.kind === 'start') return t('captain.kind.start', 'Starting star');
  const half = star.sec === 'master' ? t('captain.half.master', 'The Master') : t('captain.half.commander', 'The Commander');
  const kind = star.kind === 'keystone' ? t('captain.kind.keystone', 'keystone') : star.kind === 'notable' ? t('captain.kind.notable', 'notable') : t('captain.kind.small', 'star');
  return `${half} · ${kind}`;
}
/** Each stat's label. */
const LABELS = Object.freeze({
  way: () => t('captain.stat.way', 'Speed under sail'), oars: () => t('captain.stat.oars', 'Speed under oars'),
  turn: () => t('captain.stat.turn', 'Turning speed'), cargo: () => t('captain.stat.cargo', 'Cargo capacity'),
  hull: () => t('captain.stat.hull', 'Hull and sail strength'), repair: () => t('captain.stat.repair', 'Crew repair speed'),
  trade: () => t('captain.stat.trade', 'Better exchange prices'), harm: () => t('captain.stat.harm', 'Gun damage'),
  reload: () => t('captain.stat.reload', 'Gun reload speed'), aim: () => t('captain.stat.aim', 'Gun accuracy'),
  grape: () => t('captain.stat.grape', 'Grapeshot crew damage'), chain: () => t('captain.stat.chain', 'Chain shot sail damage'),
  heated: () => t('captain.stat.heated', 'Heated shot fire chance'), boarders: () => t('captain.stat.boarders', 'Boarding party size'),
  reach: () => t('captain.stat.reach', 'Grapple reach'),
});
/** A stat's line: "Way under sail +6%" - hands a count, the reload quicker (a share off it). */
export function starStatWords(key, v) {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const a = Math.abs(v);
  const n = key === 'boarders' ? `${sign}${Math.round(a)}` : `${sign}${Math.round(a * 100)}%`;
  if (key === 'reload') return v >= 0 ? t('captain.stat.reloadQuick', 'Guns reload {n} faster', { n: `${Math.round(a * 100)}%` }) : t('captain.stat.reloadSlow', 'Guns reload {n} slower', { n: `${Math.round(a * 100)}%` });
  return `${LABELS[key]?.() ?? key} ${n}`;
}
/** A star's lines: its stats in words, a price (a stat under 0) marked. */
export const starLines = (star) => Object.entries(star?.stats ?? {}).map(([k, v]) => ({ text: starStatWords(k, v), neg: v < 0 }));
/** The sky's sums as the side panel says them, in CAPTAIN_STATS' order: `[{ key, text, neg }]`. */
export function skySummary(held) {
  const s = starStats(held);
  return CAPTAIN_STATS.filter((k) => s[k]).map((k) => ({ key: k, text: starStatWords(k, s[k]), neg: s[k] < 0 }));
}
/** Why `id` cannot be set now, in words - null when it can (the law's way to it, the points left). Pure. */
export function starRefusal(held, id, points) {
  if (!starOf(id)) return t('captain.no.unknown', 'Unknown star.');
  const h = heldStars(held);
  if (h.includes(id)) return null;
  const way = wayTo(h, id);
  if (!way?.length) return t('captain.no.way', 'This star isn\'t connected to any of your stars.');
  const left = points - (h.length - 1);
  if (way.length > left) return t('captain.no.points', 'Reaching this star costs {need} {need, plural, one {point} other {points}}. You have {left}. You get one point per captain level after the first.', { need: way.length, left: Math.max(0, left) });
  return null;
}

// ─── THE WINDOW ─────────────────────────────────────────────────────

/** THE HELM: a ship's wheel - eight spokes through its rim, a hub in the middle. */
function drawHelm(ctx, x, y, r, rim, line) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25);
    ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
  }
  ctx.lineWidth = line(3);
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.lineWidth = line(2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();
}

/**
 * Mount the captain's stars over `host`. `ledger` the captain's (systems/naval/captainLedger.js: `captain()`, `tree()`,
 * `setTree(ids)`); `changed` once a sky is accepted (the save's word); `onExit` when it closes. GROWTH3 (bible/10-UI/
 * Growth.md section 6): `embed` draws it in the pause window's Growth tab (skyWindow.js's embedding).
 * @param {HTMLElement} host
 * @param {{ ledger: { captain: () => { xp: number, level: number, points: number, next: number|null }, tree: () => string[], setTree: (ids: string[]) => string[] },
 *   changed?: () => void, onExit?: (reason?: string) => void, doc?: Document, embed?: boolean }} deps
 */
export function mountCaptainTreeWindow(host, { ledger, changed = () => {}, onExit = () => {}, doc = document, embed = false }) {
  const captain = () => ledger.captain?.() ?? captainOf(null);
  /** @type {import('./skyWindow.js').SkyDesc} */
  const sky = {
    label: t('captain.sky.title', 'The Captain\'s Stars'),
    stars: CAPTAIN_STARS, edges: CAPTAIN_EDGES, edge: CAPTAIN_SKY_EDGE, seed: 17101, start: 'helm',
    held: heldStars, wayTo, takesBack,
    points: () => captain().points,
    committed: () => ledger.tree?.() ?? ['helm'],
    commit: (ids) => ledger.setTree(ids),
    name: starName, kindWords: starKindWords, statLines: starLines, summary: skySummary, refusal: starRefusal,
    tone: (s) => (s?.sec === 'master' ? 'life' : 'main'),
    chips(el, pending) {
      const c = captain(), left = c.points - (pending.length - 1);
      const level = el('span', 'fmt-purse');
      level.replaceChildren(el('span', null, t('captain.sky.level', 'Level')), el('b', null, String(c.level)),
        el('span', 'of', c.next == null ? t('captain.sky.top', 'max') : t('captain.sky.xp', '{xp} of {next} XP', { xp: formatNumber(c.xp), next: formatNumber(c.next) })));   // AUDIT RVN-STARS S25: the player's own grouping
      level.title = t('captain.sky.levelTip', 'A captain\'s experience comes from sinking and capturing ships, beating off boarders, claiming prizes, finishing contracts, distance sailed, treasure charts, charting isles and selling goods at the exchange.');
      const pts = el('span', 'fmt-purse life');
      pts.replaceChildren(el('span', null, '★'), el('b', null, String(Math.max(0, left))), el('span', 'of', t('captain.sky.of', 'of {n}', { n: c.points })));
      pts.title = t('captain.sky.pointsTip', 'One point per level after the first.');
      return [level, pts];
    },
    side(el, pending) {
      const c = captain();
      const parts = [el('h3', null, t('captain.sky.sumHead', 'What your stars do'))];
      const ul = el('ul');
      const lines = skySummary(pending);
      if (!lines.length) ul.append(el('li', 'none', t('captain.sky.none', 'No stars taken yet. Start next to the Helm.')));
      for (const l of lines) ul.append(el('li', l.neg ? 'neg' : null, l.text));
      parts.push(ul);
      parts.push(el('h3', null, t('captain.half.master', 'The Master')), el('p', 'fmt-sign', t('captain.sky.masterLore', 'Seamanship: sails, oars, steering, cargo, trade and repairs.')));
      parts.push(el('h3', null, t('captain.half.commander', 'The Commander')), el('p', 'fmt-sign', t('captain.sky.commanderLore', 'Combat: gun reload and accuracy, grapeshot, chain shot and heated shot, and boarding.')));
      parts.push(el('p', 'fmt-note', t('captain.sky.note', 'Stars apply to all of your ships. Removing or changing stars is free.')));
      if (c.level < 3) parts.push(el('p', 'fmt-note', t('captain.sky.oreNote', 'From level 3, shipwrights can refit a ship past grade III with Steel. Each later metal, up to Daedric, needs a higher level.')));
      return parts;
    },
    figures: [{ text: () => t('captain.half.masterCaps', 'THE MASTER'), x: -440, y: -660 }, { text: () => t('captain.half.commanderCaps', 'THE COMMANDER'), x: 440, y: -660 }],
    drawStart: drawHelm,
    words: {
      forget: t('captain.sky.forget', 'Discard changes'), forgot: t('captain.sky.forgot', 'Changes discarded.'),
      accept: t('captain.sky.accept', 'Accept'), acceptN: (n) => t('captain.sky.acceptN', 'Accept ({n})', { n }),
      summary: t('captain.sky.summary', 'Summary'), home: t('captain.sky.helmBtn', 'Helm'), homeAria: t('captain.sky.helmAria', 'Center on the Helm'),
      close: t('captain.sky.close', 'Close'),
      hint: t('captain.sky.hint', 'Click a star to take it and the stars on the way to it · Right-click to remove · Drag to pan · Scroll to zoom · H: back to the Helm'),
      hintTouch: t('captain.sky.hintTouch', 'Tap a star to see it, tap again to take it · Hold a star to remove it · Drag to pan · Pinch to zoom'),
      unaccepted: t('captain.sky.unaccepted', 'You have unaccepted changes. Press {accept} to keep them, or close again to discard them.', { accept: t('captain.sky.accept', 'Accept') }),
      unacceptedEsc: t('captain.sky.unacceptedLeave', 'You have unaccepted changes. Press {accept} to keep them, or leave again to discard them.', { accept: t('captain.sky.accept', 'Accept') }),   // GROWTH3: in the tab (any press that leaves)
      set: t('captain.sky.set', 'Stars saved. They apply to all of your ships.'),
      startTip: t('captain.tip.helm', 'Everyone starts with the Helm. Take a star next to it.'),
      backMany: (n) => t('captain.tip.backAfter', 'Right-click to remove it and {n, plural, one {the star} other {the # stars}} after it.', { n }),   // AUDIT RVN-STARS S24: never "the 1 stars"
      back: t('captain.tip.back', 'Right-click to remove.'),
      take: (n) => t('captain.tip.take', 'Click to take: {n} {n, plural, one {point} other {points}}.', { n }),
      noPoints: t('captain.sky.noPoints', 'You gain one point for each captain level after the first. Earn experience at sea: sink or capture a ship, finish a contract, or simply sail.'),
    },
  };
  return mountSkyWindow(host, sky, { changed, onExit, doc, embed });
}
