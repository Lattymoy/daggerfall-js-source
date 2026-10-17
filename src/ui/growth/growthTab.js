// @ts-check
// GROWTH1 (2026-10-17, the owner: "instead of having ascend in one place and the firmament trees in another (including
// the new naval tree), I want to give the firmament, level up page, and specializations its own tab within the pause
// menu"; asked: "Growth", the skies "drawn in the tab", the old doors moved, the classic skin let in; bible/10-UI/
// Growth.md) - THE GROWTH TAB of the pause window (ui/enhanced/enhancedMenu.js PAUSE_TABS): one rail for how a character
// grows -
//   Level            the Ascension (ui/enhanced/enhancedLevelUp.js) drawn in the pane: a level owed spent here, else
//                    the view of its stars (ASCEND-ANYTIME's) - was the Stats page's Ascend button and F5's level-up
//   Specialisations  the guide to both families' thirty paths (ui/growth/specGuide.js) - was two cards on Master Skills
//   Firmament        the online sky (ui/firmamentWindow.js) drawn in the pane - was the Stats page's Firmament button;
//                    offline, the page says what it is and why it waits
//   Captain's Stars  the captain's sky (ui/captainTreeWindow.js) drawn in the pane, where there are ships to captain -
//                    was the Holdings Captain page's "Open the stars"
// The rail's journal bones are the Holdings and Family tabs' (PX6). The page this visit stands on, the guide's choices
// and the face on the stage (ui/growth/growthStage.js) are this module's; the window resets them on every mount and
// drops the face when the tab or the window goes.

import { drawSpecGuide, resetSpecGuide, specGuideModel, SPEC_GUIDE_CSS } from './specGuide.js';
import { drawStage, dropStage, stageBack, stageLive, STAGE_CSS } from './growthStage.js';
import { firmamentBook } from '../../net/firmament/firmamentBook.js';
import { t } from '../../systems/textManager.js';
import { usesVirtueLeveling } from '../../systems/oblivionLeveling.js';   // ORL1: which bar the view of the stars reads
import { GROWTH_PAGE_SECTIONS, SPEC_LANDINGS, growthPageAt } from './growthPages.js';   // the leaf the boot doors read

export { GROWTH_PAGE_SECTIONS, growthPageAt };

/** The rail's words in the player's language. */
const LABEL = Object.freeze({
  level: () => t('growth.rail.level', 'Level'),
  specs: () => t('growth.rail.specs', 'Specialisations'),
  firmament: () => t('growth.rail.firmament', 'Firmament'),
  captain: () => t('growth.rail.captain', 'Captain\'s Stars'),
});

let sec = 'level';
/** A new visit (the window mounted): its landing's page, the guide fresh, no face up. */
export function resetGrowthTab(at = null) {
  const fam = Object.hasOwn(SPEC_LANDINGS, at ?? '') ? SPEC_LANDINGS[at] : null;   // GROWTH4: a family's guide by name
  sec = fam ? 'specs' : GROWTH_PAGE_SECTIONS.some(([id]) => id === at) ? at : 'level';
  resetSpecGuide(fam);
  dropStage();
}
/** The tab or the window left: the face goes (its pending stars with it - its own Escape asked first). */
export function releaseGrowthTab() { dropStage(); }
/** The page standing now. */
export const growthSection = () => sec;
/** Go to a page of the rail (another tab's door into it - the Master Skills page's to the guide). */
export function setGrowthSection(id) { if (GROWTH_PAGE_SECTIONS.some(([x]) => x === id)) { if (sec !== id) dropStage(); sec = id; } }
/** The window's Escape, ahead of its own back stack (growthStage.js stageBack): whether the tab took it. */
export function growthBack() { return stageBack(); }

/** The pages drawn for this host: the Captain's Stars where the host hands a captain's sky over (the world host, Come
 *  Sail Away on), every other always - a page with nothing to show says why. */
export function growthSections(ctx) {
  return GROWTH_PAGE_SECTIONS.filter(([id]) => id !== 'captain' || typeof ctx?.captain?.stars === 'function');
}

/** What waits on each page - the rail's mark: a level owed, the paths open, the captain's points unspent. Pure. */
export function growthDue(ctx) {
  const e = ctx?.entity;
  const due = { level: e?.readyToLevelUp ? 1 : 0, specs: 0, firmament: 0, captain: 0 };
  if (e) for (const f of specGuideModel(e).families) due.specs += f.open;
  const s = ctx?.captain?.model?.()?.stars;
  if (s) due.captain = Math.max(0, (s.points ?? 0) - (s.set ?? 0));
  return due;
}

/**
 * THE TAB into `body`. `ctx` the window's: `{ el, divider, skillMeter, askCard, entity, render, hooks, captain,
 * openMaster }` - `hooks.ascendScreen()` the door's level-up screen (ui/charSheetDoor.js levelUpScreenFor), `captain`
 * the Holdings provider's (its `stars()` the captain's sky's deps, `model()` its level and points), `openMaster()` the
 * Stats tab's Master Skills page.
 */
export function drawGrowthTab(body, ctx) {
  ensureGrowthStyle();
  const { el } = ctx;
  const secs = growthSections(ctx);
  if (!secs.some(([id]) => id === sec)) sec = secs[0][0];
  const due = growthDue(ctx);
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const [id] of secs) {
    const b = el('button', `px-qrow${id === sec ? ' on' : ''}`);
    b.append(el('span', 'px-c', '◆'), document.createTextNode(LABEL[id]()));
    if (due[id]) b.append(el('span', 'gr-due', id === 'level' ? '!' : String(due[id])));
    b.onclick = () => { if (sec !== id) dropStage(); sec = id; ctx.render(); };
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', 'px-qdetail px-sys gr-pane');
  ({ level: levelPage, specs: specsPage, firmament: firmamentPage, captain: captainPage })[sec]?.(detail, ctx);
  // GROWTH3: a face on the stage takes the window's body - the rail a strip over it, the window nearly the screen's
  // (enhancedMenu.js pauseWindow's px-win-wide)
  if (stageLive()) wrap.classList.add('gr-faced');
  wrap.append(detail);
  body.append(wrap);
}

/** The stage's words. */
const stageWords = () => ({
  full: t('growth.stage.full', 'Full screen'), leave: t('growth.stage.leave', 'Leave full screen'),
  loading: t('growth.stage.loading', 'Loading...'), failed: t('growth.stage.failed', 'This page could not be loaded. Close the menu and try again.'),
  open: t('growth.stage.open', 'Open'),
});

// ── Level ───────────────────────────────────────────────────────────

function levelPage(detail, ctx) {
  const { el, divider, entity, hooks } = ctx;
  // a level owed is spent through the door's own rollout (ui/charSheetDoor.js levelUpScreenFor); a door that hands none
  // (or nothing owed) draws the view of the stars - the lazy chunk's own (levelUp/levelUpView.js viewOnlyScreen)
  const open = typeof hooks?.ascendScreen === 'function' ? hooks.ascendScreen : null;
  const owed = !!entity?.readyToLevelUp && !!open;
  if (!entity) { dropStage(); detail.append(divider(t('growth.level.title', 'Level')), el('p', 'px-note', t('growth.level.none', 'Your level is kept in the world.'))); return; }
  drawStage(detail, `level:${owed ? 'owed' : 'view'}:${entity.level ?? 0}`, (host) => import('../enhanced/enhancedLevelUp.js').then(({ mountEnhancedLevelUp, viewOnlyScreen }) =>
    mountEnhancedLevelUp(host, { screen: (owed && open()) || viewOnlyScreen(entity, usesVirtueLeveling(entity)), entity, embed: true, onExit: () => { dropStage(); ctx.render(); } })), {
    el, ...stageWords(),
    lead: owed ? t('growth.level.owed', 'A level is waiting: spend its points and press Ascend. Leave and come back as you like - the points stay yours until they are spent.')
      : t('growth.level.view', 'Your stars: your attributes, your skills and how far the next level lies. A new level\'s points are spent here.'),
  });
}

// ── Specialisations ─────────────────────────────────────────────────

function specsPage(detail, ctx) {
  dropStage();
  drawSpecGuide(detail, ctx.render, { el: ctx.el, divider: ctx.divider, skillMeter: ctx.skillMeter, askCard: ctx.askCard, entity: ctx.entity, openMaster: ctx.openMaster });
}

// ── Firmament ───────────────────────────────────────────────────────

function firmamentPage(detail, ctx) {
  const { el, divider } = ctx;
  if (!firmamentBook()) {
    dropStage();
    detail.append(divider(t('growth.firm.title', 'Firmament')), el('p', 'gr-lead', t('growth.firm.offline', 'The Firmament is the sky of passive powers you grow online: choose a birthsign among the seven great stars, then spend the stars your Renown earns on the paths out from it, in combat and in life. It opens only when you play online.')));
    return;
  }
  drawStage(detail, 'firmament', (host) => import('../firmamentWindow.js').then(({ mountFirmamentWindow }) =>
    mountFirmamentWindow(host, { embed: true })), { el, ...stageWords(), lead: t('growth.firm.lead', 'The sky of passive powers your Renown buys. Press Accept to keep your changes.') });
}

// ── Captain's Stars ─────────────────────────────────────────────────

function captainPage(detail, ctx) {
  const { el, divider, captain } = ctx;
  const deps = captain?.stars?.() ?? null;
  if (!deps?.ledger) { dropStage(); detail.append(divider(t('growth.captain.title', 'Captain\'s Stars')), el('p', 'px-note', t('growth.captain.none', 'Your captain\'s stars are kept in the world.'))); return; }
  drawStage(detail, 'captain', (host) => import('../captainTreeWindow.js').then(({ mountCaptainTreeWindow }) =>
    mountCaptainTreeWindow(host, { ledger: deps.ledger, changed: deps.changed, embed: true })), {
    el, ...stageWords(),
    lead: t('growth.captain.lead', 'Master stars make your ships faster, steadier and richer in trade; Commander stars make their guns, shot, boarding and ramming hit harder.'),
  });
}

// ── the dress ───────────────────────────────────────────────────────

const GROWTH_STYLE_ID = 'growth-tab-style';
const GROWTH_CSS = `
.px-qrow .gr-due { margin-left: auto; min-width: 18px; padding: 0 5px; line-height: 18px; font-size: 12px; text-align: center; color: #10120f; background: #e0c36a; }
/* GROWTH3: a face on the stage - the window nearly the screen's, the rail a strip over the face, the face the rest */
.px-win.px-win-wide { width: min(1440px, 98vw); height: min(940px, calc(100dvh - 56px)); }
.px-win-wide .px-body { padding: 8px 12px 10px; overflow: hidden; display: flex; flex-direction: column; }
.px-journal.gr-faced { flex-direction: column; flex: 1; min-height: 0; }
.gr-faced > .px-qrail { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 0 4px; border-right: 0; border-bottom: 2px solid rgba(125,116,96,0.45); padding: 0 0 4px; max-height: none; overflow: visible; }
.gr-faced > .px-qrail .px-qrow { width: auto; min-height: 38px; padding: 4px 10px; font-size: 15px; }
.gr-faced > .px-qdetail { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 6px 0 0; }
.gr-faced > .px-qdetail .gr-stage { flex: 1; height: auto; min-height: 240px; }
@media (max-width: 480px) { .gr-faced > .px-qrail .px-qrow { font-size: 13px; padding: 4px 8px; min-height: 36px; } }   /* wrapped, never scrolled: the lit page stays in sight */
${SPEC_GUIDE_CSS}
${STAGE_CSS}
`;
/** The tab's own dress, once a document. */
export function ensureGrowthStyle(doc = typeof document === 'undefined' ? null : document) {
  if (!doc?.getElementById || doc.getElementById(GROWTH_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = GROWTH_STYLE_ID;
  st.textContent = GROWTH_CSS;
  (doc.head ?? doc.body)?.append(st);
}
/** Is a face up full screen (the window's Escape asks the tab first)? */
export const growthFull = () => !!stageLive()?.full;
