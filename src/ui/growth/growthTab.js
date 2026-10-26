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

import { drawSpecGuide, resetSpecGuide, SPEC_GUIDE_CSS } from './specGuide.js';
import { pathChoices } from '../../systems/arcanePaths.js';
import { martialChoices } from '../../systems/martialPaths.js';
import { drawStage, dropStage, stageBack, stageAsks, stageLive, STAGE_CSS } from './growthStage.js';
import { firmamentBook } from '../../net/firmament/firmamentBook.js';
import { pointsLeft } from '../../net/firmament/firmamentLaw.js';   // FIRM-STARS: the stars not yet placed, on the rail
import { t } from '../../systems/textManager.js';
import { usesVirtueLeveling } from '../../systems/oblivionLeveling.js';   // ORL1: which bar the view of the stars reads
import { GROWTH_PAGE_SECTIONS, SPEC_LANDINGS, growthPageAt } from './growthPages.js';   // the leaf the boot doors read

export { GROWTH_PAGE_SECTIONS, growthPageAt };

/** The rail's words in the player's language. */
const LABEL = Object.freeze({
  level: () => t('growth.rail.level', 'Level'),
  specs: () => t('growth.rail.specs', 'Specializations'),
  firmament: () => t('growth.rail.firmament', 'Firmament'),
  captain: () => t('growth.rail.captain', 'Captain\'s Stars'),
});
/** GROWTH-BOOK: each page's one line under its name on the rail. */
const SUB = Object.freeze({
  level: () => t('growth.rail.levelSub', 'Attributes and skills'),
  specs: () => t('growth.rail.specsSub', 'Mastery paths'),
  firmament: () => t('growth.rail.firmamentSub', 'Online star tree'),
  captain: () => t('growth.rail.captainSub', 'Ship and crew'),
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
/** GROWTH5: a press that leaves the face (another tab, the sheet's or the QuickDial's key) asks it first (stageAsks). */
export function growthAsks() { return stageAsks(); }

/** The pages drawn for this host: the Captain's Stars where the host hands a captain's sky over (the world host, Come
 *  Sail Away on), every other always - a page with nothing to show says why. */
export function growthSections(ctx) {
  return GROWTH_PAGE_SECTIONS.filter(([id]) => id !== 'captain' || typeof ctx?.captain?.stars === 'function');
}

/** What waits on each page - the rail's mark: a level owed, each family with a path to choose (AUDIT GROWTH LANE1-10: a
 *  choice, as the Master Skills door counted it - three schools mastered open three paths, one choice), the captain's
 *  points unspent. Pure. */
export function growthDue(ctx) {
  const e = ctx?.entity;
  const due = { level: e?.readyToLevelUp ? 1 : 0, specs: 0, firmament: 0, captain: 0 };
  if (e) due.specs = (pathChoices(e).length ? 1 : 0) + (martialChoices(e).length ? 1 : 0);
  // FIRM-STARS: the Firmament's stars not yet placed, as the book last said its purses (the HUD's tile beside the Renown bar
  // says the same number)
  const fb = firmamentBook()?.state;
  if (fb?.open === true) { const left = pointsLeft(fb.sending?.keys ?? fb.tree?.keys ?? [], Number(fb.stars) || 0, Number(fb.craft) || 0); due.firmament = Math.max(0, left.stars | 0) + Math.max(0, left.craft | 0); }
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
  // GROWTH-BOOK (2026-10-20, Dudey: "it looks very messy changing its sizes all the time ... structure it better so it
  // doesnt change the window each time you click an option in the growth tab"): one window size for every page
  // (enhancedMenu.js pauseWindow's px-win-growth), the rail always the journal's left column (the Grimoire's left page),
  // and each page the same bones - its title, its line, then its stage or its text
  const wrap = el('div', 'px-journal gr-book');
  const rail = el('div', 'px-qrail');
  for (const [id] of secs) {
    const b = el('button', `px-qrow${id === sec ? ' on' : ''}`);
    const words = el('span', 'gr-railtext');
    words.append(el('span', 'gr-railname', LABEL[id]()), el('span', 'gr-railsub', SUB[id]()));
    b.append(el('span', 'px-c', '◆'), words);
    if (due[id]) b.append(el('span', 'gr-due', id === 'level' ? '!' : String(due[id])));
    b.onclick = () => { if (sec !== id && stageAsks()) return; if (sec !== id) dropStage(); sec = id; ctx.render(); };   // GROWTH5: unaccepted stars asked about once
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', 'px-qdetail px-sys gr-pane');
  ({ level: levelPage, specs: specsPage, firmament: firmamentPage, captain: captainPage })[sec]?.(detail, ctx);
  // a face on the stage fills the page below its title; a page of text scrolls in it
  detail.className += stageLive() ? ' gr-staged' : ' gr-scrolls';
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

/** AUDIT GROWTH LANE2-8: the Ascension's column is laid out for the whole screen (the figure's row is what gives, and the
 *  Grimoire's book is scaled to the screen), so it is drawn in the pane only where the pane holds it - a Plus window at
 *  least LEVEL_PANE_MIN_H tall (at 1366x768 the figure flattened to 28 px, the stars on top of each other; Ascend fell
 *  off a 1024x600 pane). Elsewhere the page is its line and the phone's door: the face full screen, laid out as it is
 *  over the world. */
const LEVEL_PANE_MIN_H = 1000;
const levelDoor = () => (globalThis.innerHeight ?? 720) < LEVEL_PANE_MIN_H || globalThis.document?.documentElement?.getAttribute?.('data-plus-dress') === 'grimoire';

function levelPage(detail, ctx) {
  const { el, divider, entity, hooks } = ctx;
  // a level owed is spent through the door's own rollout (ui/charSheetDoor.js levelUpScreenFor); a door that hands none
  // (or nothing owed) draws the view of the stars - the lazy chunk's own (levelUp/levelUpView.js viewOnlyScreen)
  const open = typeof hooks?.ascendScreen === 'function' ? hooks.ascendScreen : null;
  const owed = !!entity?.readyToLevelUp && !!open;
  if (!entity) { dropStage(); detail.append(divider(t('growth.level.title', 'Level')), el('p', 'px-note', t('growth.level.none', 'Your level isn\'t available here.'))); return; }
  detail.append(divider(t('growth.level.title', 'Level')));
  drawStage(detail, `level:${owed ? 'owed' : 'view'}:${entity.level ?? 0}`, (host) => import('../enhanced/enhancedLevelUp.js').then(({ mountEnhancedLevelUp, viewOnlyScreen }) =>
    mountEnhancedLevelUp(host, { screen: (owed && open()) || viewOnlyScreen(entity, usesVirtueLeveling(entity)), entity, embed: true, onExit: () => { dropStage(); ctx.render(); } })), {
    el, ...stageWords(),
    door: levelDoor(),
    badge: String(entity.level ?? 1),
    heading: owed ? t('growth.level.owedHead', 'A level up is waiting') : t('growth.level.viewHead', 'Level {n}', { n: entity.level ?? 1 }),
    lead: owed ? t('growth.level.owed', 'You have a level up waiting. Place your points, then press {ascend}. If you leave first, the points stay unspent.', { ascend: t('levelup.ok.ascend', 'Ascend') })   // AUDIT GROWTH LANE5-2: the button's own word, in every language
      : t('growth.level.view', 'Your attributes, skills and progress to the next level. When you level up, you spend your points here.'),
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
    detail.append(divider(t('growth.firm.title', 'Firmament')), el('p', 'gr-lead', t('growth.firm.offline', 'The Firmament is a tree of passive bonuses, online only. Choose a birthsign, then spend the stars you earn from Renown.')));
    return;
  }
  detail.append(divider(t('growth.firm.title', 'Firmament')));
  drawStage(detail, 'firmament', (host) => import('../firmamentWindow.js').then(({ mountFirmamentWindow }) =>
    mountFirmamentWindow(host, { embed: true })), { el, ...stageWords(), lead: t('growth.firm.lead', 'Passive bonuses for online play, bought with the stars you earn. Press {accept} to keep your changes.', { accept: t('firmament.accept', 'Accept') }) });
}

// ── Captain's Stars ─────────────────────────────────────────────────

function captainPage(detail, ctx) {
  const { el, divider, captain } = ctx;
  const deps = captain?.stars?.() ?? null;
  if (!deps?.ledger) { dropStage(); detail.append(divider(t('growth.captain.title', 'Captain\'s Stars')), el('p', 'px-note', t('growth.captain.none', 'Your captain\'s stars aren\'t available here.'))); return; }
  detail.append(divider(t('growth.captain.title', 'Captain\'s Stars')));
  drawStage(detail, 'captain', (host) => import('../captainTreeWindow.js').then(({ mountCaptainTreeWindow }) =>
    mountCaptainTreeWindow(host, { ledger: deps.ledger, changed: deps.changed, embed: true })), {
    el, ...stageWords(),
    lead: t('growth.captain.lead', 'Master stars improve sailing, cargo and trade. Commander stars improve guns and boarding.'),
  });
}

// ── the dress ───────────────────────────────────────────────────────

const GROWTH_STYLE_ID = 'growth-tab-style';
const GROWTH_CSS = `
/* GROWTH-BOOK: the counts on the rail - the pixel font at its own 16px (12px blurred it), no shadow (the row's doubled
   it), a gold plaque in whole pixels */
.px-qrow .gr-due { margin-left: auto; flex: none; box-sizing: border-box; min-width: 26px; height: 22px; padding: 0 6px; font-size: 16px; line-height: 20px;
  letter-spacing: 0; text-align: center; color: #15120a; text-shadow: none; background: #e0c36a; border: 1px solid #10120f;
  box-shadow: inset 0 1px 0 #f6e6a6, inset 0 -2px 0 #a8892f, 0 0 0 1px rgba(224,195,106,0.25); }
.px-qrow.on .gr-due { background: rgb(243,239,44); box-shadow: inset 0 1px 0 #fffbb0, inset 0 -2px 0 #b5a414, 0 0 0 1px rgba(243,239,44,0.3); }
/* GROWTH-BOOK: one window for every page of the tab - the size never changes as the rail is pressed */
.px-win.px-win-growth { width: min(1320px, 96vw); height: min(860px, calc(100dvh - 64px)); }
.px-win-growth > .px-body { padding: 10px 14px 12px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
.px-journal.gr-book { flex: 1 1 auto; min-height: 0; height: auto; }
.gr-book > .px-qrail { flex: 0 0 256px; display: flex; flex-direction: column; gap: 2px; padding: 4px 12px 4px 0; overflow-y: auto; }
.gr-book > .px-qrail .px-qrow { align-items: flex-start; min-height: 54px; padding: 8px 8px; }
.gr-book > .px-qrail .px-qrow .px-c { margin-top: 4px; }
.gr-book .gr-railtext { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.gr-book .gr-railname { line-height: 1.15; }
.gr-book .gr-railsub { font-size: 12px; letter-spacing: 0.04em; text-transform: none; color: #9c937d; text-shadow: none; line-height: 1.2; }
.gr-book > .px-qrail .px-qrow .gr-due { margin-top: 0; }
.gr-book > .px-qdetail.gr-pane { flex: 1 1 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 4px 6px 4px 22px; }
.gr-book > .gr-pane.gr-staged { overflow: hidden; }
.gr-book > .gr-pane.gr-scrolls { overflow-y: auto; overflow-x: hidden; display: block; }
.gr-book > .gr-pane > .px-divider { flex: none; }
.gr-staged > .gr-frame { flex: 1 1 auto; min-height: 220px; }
.gr-staged > .gr-stagebar { flex: none; }
@media (max-width: 480px) {
  .gr-book > .px-qrail { flex: 0 0 auto; max-height: 34%; }
  .gr-book > .px-qrail .px-qrow { min-height: 44px; padding: 4px 8px; }
  .gr-book .gr-railsub { display: none; }
  .gr-book > .px-qdetail.gr-pane { padding: 8px 2px 4px; }
}
/* the Grimoire: the same book - the page list on the left page, the page on the right - in the same window */
:root[data-plus-dress="grimoire"] .px-win.px-win-growth > .px-body { overflow: hidden !important; }
:root[data-plus-dress="grimoire"] .px-journal.gr-book > .px-qrail { width: 25%; min-width: min(230px, 40%); max-width: 32%; flex: 0 0 auto; }
:root[data-plus-dress="grimoire"] .px-journal.gr-book > .px-qdetail.gr-pane { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
:root[data-plus-dress="grimoire"] .px-journal.gr-book > .gr-pane.gr-staged { overflow: hidden; }
:root[data-plus-dress="grimoire"] .px-journal.gr-book > .gr-pane.gr-scrolls { overflow-y: auto; display: block; }
:root[data-plus-dress="grimoire"] .gr-book .gr-railsub { color: rgba(60,36,18,0.72); }
:root[data-plus-dress="grimoire"] .px-qrow .gr-due { color: #f3e2b8; background: #8e1a10; border-color: #3a0904; font-family: inherit;
  box-shadow: inset 0 1px 0 rgba(255,190,150,0.35), inset 0 -2px 0 #5c0f08, 0 1px 0 rgba(0,0,0,0.25); }
:root[data-plus-dress="grimoire"] .px-qrow.on .gr-due { background: #a8231a; box-shadow: inset 0 1px 0 rgba(255,200,160,0.45), inset 0 -2px 0 #6b120a, 0 1px 0 rgba(0,0,0,0.25); }
:root[data-plus-dress="grimoire"] .gr-book .px-qrow.on .gr-railsub { color: rgba(122,30,18,0.8); }
@media (max-width: 480px) { :root[data-plus-dress="grimoire"] .px-journal.gr-book > .px-qrail { width: auto; max-width: none; max-height: 34%; } }
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
