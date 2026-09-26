// ═══════════════════════════════════════════════════════════════════
// LV2 — THE RISING: the enhanced skin's level-up notification.
//
// Mac, 2026-09-19: "Next up, I want to implement a new element. The
// enhanced level up notification" - and, asked what it should do about
// the window: "Notify, then you choose", over all three events (the
// level, the skill raises under it, and a mastery).
//
// ── WHAT IT REPLACES, AND WHY THAT IS THE POINT ───────────────────
// Until this slice a level-up SLAMMED a full-screen window over the
// game the instant the skill sum crossed a threshold - mid-swing,
// mid-chase, mid-conversation-with-a-guard. That is DFU's own law
// (RaiseSkills' tail posts dfuiOpenCharacterSheetWindow,
// PlayerEntity.cs:1413-1414) and it is the right law for a 1996 window
// that draws in a tenth of a second over a paused game. It is the
// wrong law for a skin whose level-up is a full-screen constellation.
//
// So on the ENHANCED skin the game TELLS you and lets you choose:
//
//   the notice announces, the fanfare plays, and `readyToLevelUp`
//   stays exactly where DFU leaves it - set. The window opens when
//   the player opens the sheet, which is where DFU levels you up
//   anyway (ui/charSheetDoor.js has returned the level-up window for
//   a pending level since LV1).
//
// THAT PARENTHESIS USED TO END "...so every route to the sheet - the
// key, the dial's Stats arm, the pause page - is already this door",
// and two of those three were not. Only the KEY reached
// `createCharSheetWindow`; the dial's Stats arm and the pause page
// both ran `togglePause({ at: 'stats' })`, whose page is built from
// `sheetModel` and has never read `readyToLevelUp`. Since this window
// cannot close itself without spending, every close is something else
// taking the slot - and the dial is exactly where a player reaches
// next. Mac found it the only way it could be found: "when you close
// the levelup screen without adding stat points you cant open it
// again." The hosts' arms ask `levelOwed` now and the sentence above
// says only what was checked.
//
// THE CLASSIC SKIN IS UNTOUCHED, byte for byte: it says its line and
// opens its sheet, as it has since AUDIT 44. This is a departure the
// enhanced skin makes on purpose and it is recorded in Ledger A.
//
// ── TRUTH FROM STATE, NOT FROM A LATCH ────────────────────────────
// The standing half of this element - the quiet line that says a level
// is still owed - reads `entity.readyToLevelUp` on every frame rather
// than remembering that it announced one. A latch would outlive the
// thing it describes the first time a level was spent by any road this
// module does not watch (the classic sheet in a mixed session, a load,
// the font-less escape, a headless spend). The announcement is an
// EVENT and the reminder is a STATE, and they are kept apart here on
// purpose.
//
// ── THE MODEL IS ONE HOME, THE DRAW IS THE ENHANCED SKIN'S ────────
// ui/hudText.js's shape (its own header says why): the queue, the
// clock and the expiry live in the model below, and the paint is a
// DOM strip the enhanced skin alone mounts. The caller owns the clock
// - ui/hud.js's drawHud, the one call all four hosts already make, so
// no host can forget it or run it twice.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { bindings } from './input.js';
import { codeForAction } from '../systems/inputActions.js';   // LV2: the inverse read, one home
import { buttonText } from '../systems/controlsConfig.js';    // GetButtonText - the key as a player sees it
// THE ONE PLAYER, read directly - PX5's law for the pause clock ("no
// host seam is needed and no host can drift"). The standing reminder
// is a question about THE player's state, there is one of them, and a
// seam threaded through ui/hud.js's signature and four hosts would be
// four more places to forget it. The module is a leaf here: it imports
// systems/skills.js and a faction constant, and nothing in ui/.
import { playerEntity } from '../characters/playerEntity.js';
import { openLevelUpWindow } from './levelUpOpener.js';   // LV3: the strip's level row is a button now

/** The three things this surface announces. */
export const NOTICE_LEVEL = 'level';
export const NOTICE_SKILL = 'skill';
export const NOTICE_MASTERY = 'mastery';

/** How long an announcement holds before it goes (or, for the level,
 *  before it folds down to the standing line). Skyrim's own
 *  notification sits about four seconds; the port's popup column pops
 *  a line a second and this must outlast a flurry of them. */
export const ANNOUNCE_MS = 4500;
/** The most rows this strip will ever carry. A pass that raises six
 *  skills at once is a REST, and six lines under the compass is a
 *  wall; the oldest go first and the level's row is never one of them. */
export const MAX_ROWS = 4;
/** SKILL2: how long a skill or mastery line takes to fade out at the end
 *  of its ANNOUNCE_MS - it fades where it stands, it does not blink off. */
export const FADE_MS = 700;

/** The port's own words. Nothing here is TEXT.RSC: the level line the
 *  hosts used to `say` ("You have gained a level!") is the port's too,
 *  so no game data is read to announce a level - which is the promise
 *  ui/charSheetDoor.js makes for every enhanced surface. */
export const RISEN_TITLE = 'You have risen';
export const AWAITS_TITLE = 'A level awaits';
export const MASTERED_TITLE = 'Mastered';
/** What the row says to do about it, with the key the REGISTRY
 *  answers with - never a literal F5, because a player who rebound the
 *  sheet would be told to press a key that does nothing (FIX-F's bug,
 *  and MAC-C's, one layer down). */
export const sheetKeyText = () => buttonText(codeForAction(bindings(), 'CharacterSheet'), true);

/**
 * THE QUEUE. Pure: no DOM, no clock of its own, no audio - every
 * moment that matters is handed in, so a test can drive a whole
 * evening of levelling in a millisecond.
 */
export class LevelNotices {
  constructor() {
    this.rows = [];
    this._seq = 0;
    /** Which pending level this surface has already announced, so the
     *  window that opens later does not play the same fanfare twice
     *  (see `fanfareOwed`). Null once the level is spent. */
    this.announcedLevel = null;
  }

  /** One row. `key` is stable per subject - a second raise of the same
   *  skill in one pass UPDATES its row rather than stacking a second,
   *  which is what a player reading it wants and what Skyrim does. */
  _push(kind, key, title, sub, now) {
    const at = this.rows.findIndex((r) => r.key === key);
    const row = { key, kind, title, sub, at: now, seq: ++this._seq };
    if (at >= 0) this.rows[at] = row; else this.rows.push(row);
    // THE LEVEL'S ROW IS NEVER THE ONE THAT FALLS OFF. Everything else
    // is chatter beside it: the whole point of the element is that the
    // player is told they may spend, and a rest that raises six skills
    // must not be able to push that off the strip.
    while (this.rows.length > MAX_ROWS) {
      const drop = this.rows.findIndex((r) => r.kind !== NOTICE_LEVEL);
      if (drop < 0) break;
      this.rows.splice(drop, 1);
    }
    return row;
  }

  /** A level was earned. `level` is what the player is rising TO. */
  announceLevel(level, now) {
    this.announcedLevel = level ?? null;
    return this._push(NOTICE_LEVEL, NOTICE_LEVEL, RISEN_TITLE, level != null ? `Level ${level}` : '', now);
  }

  /** A skill rose (PlayerEntity.RaiseSkills' skillImprove moment). */
  announceSkill(id, value, now) {
    return this._push(NOTICE_SKILL, `skill:${id}`, SKILL_NAMES[id] ?? '', String(value ?? ''), now);
  }

  /** A PRIMARY skill landed on exactly 100 (RaiseSkills :1390-1407). */
  announceMastery(id, now) {
    return this._push(NOTICE_MASTERY, `mastery:${id}`, MASTERED_TITLE, SKILL_NAMES[id] ?? '', now);
  }

  /**
   * WHAT TO DRAW, at `now`, for an entity that may or may not still
   * owe a level. Newest first, the way a stack of notifications reads.
   *
   * The level's row has THREE lives, and the third is the reason this
   * element exists: it announces, it folds to a standing line while
   * the level is unspent, and it goes the moment the points are in the
   * player's stats - however they got there.
   */
  frame(now, { owed = false } = {}) {
    const out = [];
    for (const r of this.rows) {
      const age = now - r.at;
      if (r.kind === NOTICE_LEVEL) {
        if (!owed) continue;                         // spent, by any road - the reminder is state, not memory
        const standing = age >= ANNOUNCE_MS;
        // THE STANDING ROW CHANGES ITS WORDS, not just its size. "You
        // have risen" is NEWS and it stops being news; what is left is
        // a reminder, and a reminder that still reads as an
        // announcement is how a player learns to stop reading the
        // strip.
        out.push({ ...r, standing, title: standing ? AWAITS_TITLE : r.title });
        continue;
      }
      if (age >= ANNOUNCE_MS) continue;
      const fadeIn = age - (ANNOUNCE_MS - FADE_MS);   // SKILL2: ms into the fade, negative before it starts
      out.push({ ...r, standing: false, fading: fadeIn >= 0, fadeElapsed: Math.max(0, fadeIn) });
    }
    // A LEVEL THAT IS OWED BUT WAS NEVER ANNOUNCED HERE still shows:
    // a save loaded with the flag already set, or a level earned while
    // this surface was not mounted. The player is owed the reminder
    // either way, and the strip is the only place that says so.
    if (owed && !out.some((r) => r.kind === NOTICE_LEVEL)) {
      out.push({ key: NOTICE_LEVEL, kind: NOTICE_LEVEL, title: AWAITS_TITLE, sub: '', at: -Infinity, seq: -1, standing: true });
    }
    // NEWEST FIRST, and THE LEVEL'S ROW IS ALWAYS LAST - which on a
    // strip pinned by its foot means nearest the vitals, where the eye
    // already is. It is the only row that asks for something, so it
    // must not move: raiseSkills raises the skills and THEN levels the
    // player (PlayerEntity.cs:1371-1414), so a plain newest-first sort
    // would put it on top at a level-up and at the bottom on the next
    // skill raise - the one row a player is looking for, moving.
    return out.sort((a, b) => (Number(a.kind === NOTICE_LEVEL) - Number(b.kind === NOTICE_LEVEL)) || (b.seq - a.seq));
  }

  /** Drop what has expired, so the queue cannot grow across an
   *  evening. The level's row is kept while it is owed; `owed` false
   *  is what finally clears it and the fanfare latch with it. */
  sweep(now, { owed = false } = {}) {
    this.rows = this.rows.filter((r) => (r.kind === NOTICE_LEVEL ? owed : now - r.at < ANNOUNCE_MS));
    if (!owed) this.announcedLevel = null;
    return this.rows.length;
  }

  /** Does the level-up WINDOW still owe the player its fanfare? It
   *  does not when this surface already played it for the same pending
   *  level: one event, one sound. The window asks through
   *  ui/charSheetDoor.js. */
  fanfareOwed(level) {
    return this.announcedLevel == null || this.announcedLevel !== level;
  }
}

/** THE ONE QUEUE. DFU has one player and one HUD; the port's two live
 *  PopupTexts are a host artefact (AUDIT FONT F1) and this surface has
 *  no such split - it is mounted by ui/hud.js, which is one call. */
export const levelNotices = new LevelNotices();

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/**
 * THE DOCUMENT IS AN ARGUMENT, as it is for every draw in this file
 * and for ui/enhancedHudText.js's - `doc = document` is this tree's
 * idiom for "the page, or whatever a caller hands me".
 *
 * It earns its place twice over here. The three seams below fork on
 * the skin AND on there being a page at all (node drives these hosts
 * headless, and a classic-lane host must behave exactly as it did
 * before this slice), and a `typeof document` written inline is a
 * fork no test can take the other side of: the most important mutant
 * this slice has - THE WINDOW OPENS ITSELF AGAIN - SURVIVED the whole
 * suite, because under node every call took the classic arm and the
 * enhanced one was unreachable.
 */
const DOC = (typeof document === 'undefined' ? null : document);

/**
 * THE HOST SEAM for a level-up, and the fork this slice is about.
 *
 * ENHANCED: announce, play the fanfare HERE - at the moment the player
 * earned it, not minutes later when they get round to the window - and
 * leave `readyToLevelUp` set. `open` is not called.
 *
 * CLASSIC: exactly what the hosts did before this slice - the line,
 * then the sheet. The `open` thunk is the host's own, because only the
 * host knows how to put a window in its slot.
 *
 * Returns whether the notice took it, so a caller can tell the two
 * lanes apart without asking the skin a second time.
 */
export function announceLevelUp(entity, { say = null, open = null, now = nowMs(), doc = DOC } = {}) {
  if (!isEnhanced() || !doc) {
    say?.('You have gained a level!');
    open?.();
    return false;
  }
  const level = entity?.pendingLevel ?? ((entity?.level ?? 0) + 1);
  // AUDIT LV2 F2 - ONCE PER LEVEL, NOT ONCE PER PASS. DFU RE-OFFERS
  // the sheet on every later raise: RaiseSkills' tail sits outside the
  // skill loop (:1413) and `checkForLevelUp` stays TRUE while `level`
  // is behind the calculated one, so a player who earns a level and
  // keeps resting reaches this arm again every pass that clears the
  // 360-minute gate. Re-opening a window the player must answer is
  // that law and the classic arm above keeps it whole. RE-ANNOUNCING
  // is a different act: it replayed the fanfare and turned the
  // standing reminder back into news, so an unspent level SHOUTED
  // once per rest until it was spent - three passes, three fanfares,
  // measured. The surface already knows which pending level it spoke
  // for; if it is this one it has nothing new to say, and the
  // reminder it put up is still up saying it.
  if (!levelNotices.fanfareOwed(level)) return true;
  levelNotices.announceLevel(level, now);
  audio.playOneShot(SOUND.LevelUp, 1);   // UpdatePlayerValues (:373) - moved to the MOMENT, which is what a notification is
  return true;
}

/** A skill rose. The classic lane keeps the popup line it has always
 *  had; the enhanced one takes it out of the column and puts it on the
 *  strip, where it reads as a change to the CHARACTER rather than as
 *  another thing the world said. */
export function announceSkillRaise(id, value, { say = null, now = nowMs(), doc = DOC } = {}) {
  if (!isEnhanced() || !doc) {
    say?.(`Your ${SKILL_NAMES[id]} skill has improved.`);
    return false;
  }
  levelNotices.announceSkill(id, value, now);
  return true;
}

/**
 * A mastery. DFU raises TEXT.RSC 4020 in a click-anywhere box and
 * plays the fanfare (RaiseSkills :1390-1407); the box carries no
 * choice, only news, so on the enhanced skin it is the same
 * interruption the level-up window was and it takes the same answer.
 * THE FANFARE STAYS IN BOTH LANES - it is the reward, not the
 * interruption - and the classic box is untouched.
 */
export function announceMastery(id, { box = null, rows = null, now = nowMs(), doc = DOC } = {}) {
  if (!isEnhanced() || !doc) {
    // AUDIT LV2 F3: `rows` is a THUNK, because an argument is not.
    // The caller's rows are TEXT.RSC 4020 read off disk, and passing
    // them by value meant the enhanced lane read the record on every
    // mastery and threw it away - under a module whose own header
    // promises that no game data is read to announce one. The read is
    // the classic box's, so it happens where the box does.
    const r = typeof rows === 'function' ? rows() : rows;
    if (r?.length) box?.(r);
    return false;
  }
  levelNotices.announceMastery(id, now);
  return true;
}

// ── THE STRIP ────────────────────────────────────────────────────
// A DOM element, mounted by the first frame that has something to say
// and taken down when there is nothing. It rides ui/hud.js's drawHud
// with the same `hidden` gate the enhanced HUD takes (AUDIT 64 F37: a
// persistent DOM overlay stays painted unless told otherwise, so the
// hidden frame must REACH this rather than skip the call).

export const LEVEL_NOTICE_ID = 'enhanced-levelnotice';

let host = null;
let last = '';

/**
 * WHERE IT HANGS - AUDIT LV2 F4, and QS3's rule read the right way
 * round (ui/enhancedHud.js:573-576): `.hud-bottom` is a CENTRED column
 * anchored to the foot of the screen, so a centred thing that belongs
 * above the vitals goes IN it and rides it; only a CORNER block is
 * anchored to the HUD root and does the arithmetic itself, "because a
 * corner block inside a centred flex column moves whenever a bar
 * beside it changes width".
 *
 * This strip shipped body-level at a flat `bottom: 150px`, which is
 * the arithmetic without the corner - and the arithmetic was wrong in
 * two directions at once. `.hud-bottom` grows UPWARD with its CONTENT
 * (the breath bar, the effect chips, the needs strip - none of which
 * the lab mounts, which is why the probe's own clearance check passed
 * over an empty block) and again with `--hud-scale`, which runs 0.5 to
 * 2 and which a body-level sibling never inherits anyway (AUDIT FONT
 * F2). Measured against a live block: the strip sat 19px INTO the
 * vitals at scale 1 on a phone and 154px into them at scale 2 - the
 * one thing this element's own comment says it must never do.
 *
 * Inside the column there is no number to get wrong: the flex box
 * places it above every row the HUD has, at every scale, whatever the
 * block is carrying. `doc.body` is the fallback for the frame before
 * the HUD mounts - drawHud builds it on the call AFTER this one - and
 * for the tests, whose fake document has no HUD at all.
 */
function rehome(doc, node) {
  const home = doc.querySelector?.('.hud-bottom') ?? doc.body;
  if (!home || node.parentNode === home) return;
  if (home === doc.body) home.append(node); else home.prepend(node);
}

function rowNode(doc, r) {
  // LV3 (Dudey, 2026-09-19: "a button to open the levelup screen again once closed"): THE LEVEL'S ROW IS A BUTTON
  // when there is a key to press - the same key the row already names, sent through ui/levelUpOpener.js, so it
  // opens the window exactly as the sheet key does in every host. Without a binding it stays a plain line: a
  // button that presses nothing is a drawn door. It takes clicks only where the game hands the player a cursor
  // (touch, or the freed cursor); the pause window's Stats page carries the same door for everyone else.
  const clickable = r.kind === NOTICE_LEVEL && codeForAction(bindings(), 'CharacterSheet') != null;
  const n = doc.createElement(clickable ? 'button' : 'div');
  n.className = `lv-note lv-note-${r.kind}${r.standing ? ' lv-standing' : ''}${clickable ? ' lv-clickable' : ''}${r.fading ? ' lv-fading' : ''}`;
  // SKILL2: the strip is rebuilt whenever a row comes or goes, so a row
  // already fading resumes its fade where it was instead of restarting it.
  if (r.fading && n.style) n.style.animationDelay = `-${Math.round(r.fadeElapsed ?? 0)}ms`;
  if (clickable) {
    n.type = 'button';
    n.title = 'Open the level-up window';
    n.onclick = (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); openLevelUpWindow(); };
  }
  const gem = doc.createElement('span');
  gem.className = 'lv-note-gem';
  gem.textContent = r.kind === NOTICE_SKILL ? '▲' : '✦';
  const body = doc.createElement('span');
  body.className = 'lv-note-body';
  const t = doc.createElement('span');
  t.className = 'lv-note-title';
  t.textContent = r.title;
  body.append(t);
  if (r.sub) {
    const s = doc.createElement('span');
    s.className = 'lv-note-sub';
    s.textContent = r.sub;
    body.append(s);
  }
  n.append(gem, body);
  // THE LEVEL'S ROW NAMES THE WAY IN, and only the level's: a skill
  // line with a key on it would read as an instruction.
  // AUDIT LV2 F5: ...and only when there IS one. `buttonText(null)` is
  // KeyCode.None's own string, "NONE" (systems/controlsConfig.js:359),
  // so a player who cleared the sheet binding was shown a plate reading
  // A LEVEL AWAITS / NONE - an instruction to press a key called None.
  // The row still says a level is waiting; it just stops naming a way
  // in it does not have.
  if (r.kind === NOTICE_LEVEL && codeForAction(bindings(), 'CharacterSheet') != null) {
    const k = doc.createElement('span');
    k.className = 'lv-note-key';
    k.textContent = sheetKeyText();
    n.append(k);
  }
  return n;
}

/**
 * Paint the strip. `owed` defaults to the LIVE flag off the one player
 * entity - truth from state, so a level spent by ANY road takes the
 * reminder with it - and `hidden` is the HUD's own gate.
 *
 * UPDATED, NOT REBUILT (ui/enhancedHudText.js's law): the frame is
 * reduced to a signature first, so a still second costs one string
 * compare rather than a fresh DOM sixty times over.
 */
export const levelOwed = (e = playerEntity) => !!e?.readyToLevelUp;

export function drawLevelNotices({ owed = levelOwed(), hidden = false, now = nowMs(), doc = (typeof document === 'undefined' ? null : document) } = {}) {
  if (!doc || !isEnhanced()) return null;
  const rows = hidden ? [] : levelNotices.frame(now, { owed });
  levelNotices.sweep(now, { owed });
  // Checked on every frame the strip is up rather than only when the
  // paint changes: the HUD host is built by the call that runs right
  // after this one, so a strip raised on the first frame of a session
  // lands on the body and has to be moved home on the next.
  if (host) rehome(doc, host);
  const sig = rows.map((r) => `${r.key}|${r.title}|${r.sub}|${r.standing ? 1 : 0}|${r.fading ? 1 : 0}`).join('\n');
  if (sig === last && (host || !rows.length)) return host;
  last = sig;
  if (!rows.length) { host?.remove(); host = null; return null; }
  if (!host) {
    host = doc.createElement('div');
    host.id = LEVEL_NOTICE_ID;
    // A LIVE REGION, because this element's whole job is to tell a
    // player something the game decided while they were busy - and
    // INTRO-FIELD's law with it: it is announced, so it is never
    // display:none and nothing a player must SEE is routed anywhere
    // else.
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    rehome(doc, host);
  }
  host.textContent = '';
  for (const r of rows) host.append(rowNode(doc, r));
  return host;
}

/** Every surface this module owns, gone, and the queue with it.
 *
 *  AUDIT LV2 F1: this used to name "ui/hud.js's own destroy path" -
 *  and ui/hud.js has no destroy path. It is the same false caller
 *  AUDIT FONT F12 struck from ui/enhancedHudText.js's twin one file
 *  over, written again: NOTHING in src/ calls this. The enhanced
 *  skin's elements live as long as the page does, because every skin
 *  and scene change in this port ends in location.replace, and this
 *  strip needs no per-owner release either - it is rebuilt from
 *  `frame()` on the next frame and its standing row is read LIVE off
 *  the player, so a stale one cannot outlive what it describes. So
 *  this door's callers are the TESTS, which drive the module over a
 *  fake document per case. If a page-level teardown is ever wired,
 *  this is the half of it that belongs here. */
export function destroyLevelNotices() {
  host?.remove();
  host = null;
  last = '';
  levelNotices.rows = [];
  levelNotices.announcedLevel = null;
}
