// Character sheet + level-up (UI arc, U3; U8a NATIVE ART). The
// level-up screen retires the headless auto-apply: DFU sets
// readyToLevelUp and the char sheet applies - here the screen shows
// the pending level and hands the 4..6 pool to the SAME verbatim
// stat clamps chargen uses (statUp/statDown: max 100 / pool 0 /
// floor at the pre-level value).
//
// U8a: the sheet is the FIRST native-art window - INFO00I0.IMG on
// the 320x200 panel with DFU's verbatim label geometry
// (DaggerfallCharacterSheetWindow): name (41,4) race (41,14) class
// (46,24) level (45,34) gold (39,44) fatigue (57,54) health (52,64)
// encumbrance (90,74); the 8 stats centered in 28-wide panels at
// (141, 17 + i*24). The window's fourteen Buttons (:134-204) are
// answered by click(): exit (50,179,39,19) closes, the four skill
// rects (11, 106/116/126/136, 115x8) toggle the same pages keys 1-4
// do, and every other DFU button rect is consumed so the click can
// never fall through to the host's pointer-lock request.
// Fatigue displays /64 (FatigueMultiplier);
// encumbrance = carried template weight (+ gold at 0.0025/piece) /
// floor(Str*1.5) (FormulaHelper.MaxEncumbrance). The classic skill
// BUTTON popups ride keys 1-4 as interim text panels (primary/
// major/minor/misc); the portrait slot draws the shared paperdoll
// at DFU's (200,8) origin, refreshed on open like the inventory;
// art-less draws keep the old text page (never trap the motor).
// The level-up screen stays on the text idiom (its retrofit rides
// a later U8 slice).

import { statUp, statDown, allStatsMax } from './chargen.js';   // LV1's audit: DaggerfallStats.IsAllMax has ONE home now (and MAX_STAT_VALUE left with the copy that used it - this file's last reader was that copy)
import { actionForCode } from '../systems/inputActions.js';   // MAC-C: the sheet's toggle key is the registry's
import { bindings } from './input.js';
import { carriedWeight } from '../systems/inventory.js';   // AUDIT 17e F30; E4: PlayerEntity.CarriedWeight, one home
import { totalGoldAmount } from '../systems/court.js';   // PlayerEntity.GetGoldAmount - coins plus letters of credit
import { entityMaxEncumbrance, handToHandMinDamage, handToHandMaxDamage } from '../combat/formulas.js';   // U10; AUDIT 63 F34: CalculateHandToHandMin/MaxDamage
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { statDescriptionRows } from '../systems/talkMacros.js';   // ATTRMACRO1: SetTextTokens' macro pass over TEXT.RSC records 0..7
import { SKILLS, SKILL_NAMES, skillValue, getSkillRecentlyIncreased, resetSkillsRecentlyRaised } from '../systems/skills.js';
import { applyLevelUp, bonusPoolFor } from '../systems/advancement.js';
import { usesVirtueLeveling } from '../systems/oblivionLeveling.js';   // ORL1: whose law levels this character
import { ActionTextBox } from './actionText.js';   // the mustDistributeBonusPoints refusal, ClickAnywhereToClose
import { OGHMA_BONUS_POOL } from '../systems/artifactEffects.js';   // AUDIT 39: the sheet's oghmaBonusPool (:44)
import { drawText, measureText } from './text.js';
import { loadImg, nativeMetrics, drawImg, drawRect, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { drawPaperDoll, refreshPaperDoll, PAPERDOLL_ORIGIN } from './paperDoll.js';
import { maxFatigue, liveStat, FATIGUE_MULTIPLIER } from '../systems/statMods.js';   // U52: the /64 display divisor has a name and one home
import { templateByIndex } from '../systems/itemTemplates.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { bankingStatusRows } from '../systems/banking.js';   // AUDIT 64 F28: CreateBankingStatusBox's rows
import { REGION_NAMES } from '../formats/mapsFile.js';       // GetLocalizedRegionName
import { InputMessageBoxWindow } from './inputMessageBox.js';   // CM4: the Name button's DaggerfallInputMessageBox
import { ENTER_NEW_NAME } from './itemMakerWindow.js';          // CM4: Internal_Strings.enterNewName, homed with its first reader
import { healthStatusRows } from '../systems/healthStatus.js';   // CM4: CreateHealthStatusBox's rows
import { activeMemberships, GUILDS, getTitle } from '../systems/guilds.js';   // CM4: ShowAffiliationsDialog's book
import { templeOf, orderOf } from '../systems/guildVariants.js';
import { getReputation } from '../systems/factionRep.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // CM4: the four buttons' DaggerfallShortcut bindings

// U8a: the module-level art cache - hosts preload once at boot; a
// failed load leaves the text fallback in charge.
let _art = null;
// UpDownSpinner's own background (UpDownSpinner.cs:25) - the sheet
// mounts one while levelling and nowhere else, so a failed load costs
// the arrows their frame and nothing else.
let _spinnerArt = null;
export async function preloadCharSheetArt(deps) {
  if (!_spinnerArt) {
    try { _spinnerArt = await loadImg(deps, 'CHAR02I1.IMG'); }
    catch { _spinnerArt = null; }
  }
  if (_art) return;
  try { _art = await loadImg(deps, 'INFO00I0.IMG'); }
  catch { console.warn('[charsheet] INFO00I0.IMG unavailable; the text sheet stands in'); }
}
export const charSheetArtLoaded = () => !!_art;

// AUDIT 17e F30 / ONE DFU MEMBER, ONE EXPORT: this re-implemented
// carried weight from the raw template baseWeight, ignoring the
// MATERIAL weight rule that systems/inventory.js already ports
// verbatim (ItemBuilder.CalculateWeightForMaterial + the Erisceres
// leather formula) - so a daedric warhammer weighed its iron base.
// AUDIT 17f: gold used to be the one term with a second constant
// here (DaggerfallBankManager.goldPieceWeightInKg, 0.0025) because
// the port's gold stack carried no template index. It carried
// Currency.Gold_pieces (276) after that, whose baseWeight IS 0.0025.
// E4 RETIRED THE STACK ALTOGETHER: gold is PlayerEntity.GoldPieces,
// so the coin term comes back as DFU's own hand-written product -
// which is the whole of PlayerEntity.CarriedWeight (:184), and lives
// once, in systems/inventory.js, beside the constant it multiplies.
// U52: RE-EXPORTED. The enhanced sheet shows the same encumbrance the
// classic one draws, and a second reduce over e.items in that module
// would be this comment's own warning happening again one file over.
export { carriedWeight };

export class LevelUpScreen {
  /**
   * LV2: `fanfare` is the third argument and it is a QUESTION ABOUT
   * WHO ALREADY SPOKE. UpdatePlayerValues plays the level-up sound
   * when the rollout mounts (:373) because in DFU the rollout mounts
   * AT the level-up. On the enhanced skin the two moments have come
   * apart: the notice announces and plays it where the player earned
   * it, and this window may not open for another ten minutes. One
   * event, one sound - so the door that knows the notice already spoke
   * passes false, and every other caller keeps DFU's own behaviour by
   * default.
   */
  constructor(entity, rolls = Math.random, { fanfare = true } = {}) {
    if (fanfare) audio.playOneShot(SOUND.LevelUp, 1);   // UpdatePlayerValues (:373) - the level-up fanfare
    this.entity = entity;
    // Roll the pool NOW so the screen can show it; the base stats are
    // the floors (statDown returns points only above them).
    //
    // AUDIT 39: the OGHMA arm (UpdatePlayerValues :374-383) - the
    // Infinium's rollout is a FIXED 30 and DFU draws no BonusPool() on
    // that branch at all. The screen rolled 4..6 unconditionally, so
    // the book's thirty points were unspendable and applyLevelUp's
    // oghma arm - the only place that clears the latched flag - was
    // reached by the next GENUINE level-up, which it then ate (no
    // Level++, no health roll).
    this.oghma = !!entity.oghmaLevelUp;
    // AUDIT LV2, reopened (Mac): the pool is THE LEVEL'S, not this
    // window's. Rolled here it was re-rolled on every open, and since
    // LV2 the player opens this window themselves - so closing it and
    // pressing the key again until it said 6 was free points.
    // `bonusPoolFor` draws once and remembers, on the entity, until
    // the level is spent.
    this.pool = this.oghma ? OGHMA_BONUS_POOL : bonusPoolFor(entity, rolls);
    this._rolledPool = this.pool;
    this.base = { ...entity.stats };
    this.working = { ...entity.stats };
    this.cursor = 0;
    this.done = false;
    this._rolls = rolls;
  }

  /** DaggerfallStats.IsAllMax over the working stats - the same law
   *  the sheet's rollout reads, from the same home. */
  allMax() { return allStatsMax(this.working); }

  input(action) {
    const key = STAT_KEYS_ORDER[this.cursor];
    if (action === 'up') this.cursor = (this.cursor + 7) % 8;
    else if (action === 'down') this.cursor = (this.cursor + 1) % 8;
    else if (action === 'plus') { audio.playOneShot(SOUND.ButtonClick, 1); const r = statUp(this.working[key], this.pool); this.working[key] = r.working; this.pool = r.pool; }   // freeEdit spinner (StatsRollout.cs:255)
    // AUDIT 58 (f3/input): + 'char:-'. This screen carries no
    // isChoiceWindow, so both hosts hand it overlayAction's answer
    // (scenes/townTalk.js's keyed arm and ui/input.js:522-523) - and
    // overlayAction can never answer 'minus', because its typed-
    // character branch (ui/input.js:324) owns the hyphen. The bare
    // 'minus' arm stays: the SPINNER click (:405) and the sheet's own
    // code table (:196) both still produce it. Without this, a
    // level-up point could be spent from the keyboard and never taken
    // back, under a screen that prints '+/- assign' at :143 - and
    // LevelUpScreen has no click of its own to fall back on.
    // StatsRollout.cs:255's down-spinner is the same door.
    else if (action === 'minus' || action === 'char:-') { audio.playOneShot(SOUND.ButtonClick, 1); const r = statDown(this.working[key], this.base[key], this.pool); this.working[key] = r.working; this.pool = r.pool; }
    // LV1's audit: `|| this.allMax()`. CheckIfDoneLeveling's refusal
    // has TWO terms (:437-443) and this screen only ever carried one,
    // so a character at 100 across the board could not leave it: every
    // `statUp` is refused at the ceiling, the pool can never reach
    // zero, and the only exit tested for zero. The sheet's own rollout
    // has had the second term since AUDIT 44 (`_workingAllMax`); this
    // screen - the one the enhanced skin mounted until LV1 - did not.
    // The leftover points are VOIDED, which is what DFU does on the
    // same branch: it writes the working stats home and drops the
    // pool, because there is nowhere left to put it.
    else if (action === 'confirm' && (this.pool === 0 || this.allMax())) {
      // applyLevelUp rolls HP; our pre-rolled pool distributes here -
      // the distribute hook writes the hand-built stats.
      applyLevelUp(this.entity, (stats) => Object.assign(stats, this.working), this._rolls, this._rolledPool);
      this.done = true;
    }
  }

  draw(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1];
    // The oghma arm raises no level, so it has no pendingLevel to show
    // (DFU's sheet prints the level it already has).
    const t = `LEVEL ${this.entity.pendingLevel ?? this.entity.level}!  POOL: ${this.pool}`;
    drawText(renderer, font, t, (W - measureText(font.fnt, t) * s) / 2, 24 * s, s, gold);
    STAT_KEYS_ORDER.forEach((k, i) => drawText(renderer, font,
      `${i === this.cursor ? '> ' : '  '}${k.slice(0, 3).toUpperCase()}  ${this.working[k]}`,
      40 * s, (56 + i * 12) * s, s, i === this.cursor ? hot : white));
    // ...and the foot says which of CheckIfDoneLeveling's two terms is
    // open, because at the ceiling "ENTER when pool 0" is an
    // instruction this screen will never honour (LV1's audit).
    drawText(renderer, font, this.allMax() ? 'every attribute is at its maximum   ENTER to continue'
      : '+/- assign   ENTER when pool 0', 40 * s, (56 + 10 * 12) * s, s, dim);
  }
}

// DaggerfallCharacterSheetWindow.cs:134-204 - the window's clickable
// Button rects, verbatim, in NativePanel virtual pixels.
export const CHARSHEET_RECTS = Object.freeze({
  name: [4, 3, 132, 8],
  level: [4, 33, 132, 8],
  gold: [4, 43, 132, 8],
  health: [4, 63, 128, 8],
  affiliations: [3, 84, 130, 8],
  primarySkills: [11, 106, 115, 8],
  majorSkills: [11, 116, 115, 8],
  minorSkills: [11, 126, 115, 8],
  miscSkills: [11, 136, 115, 8],
  inventory: [3, 151, 65, 12],
  spellbook: [69, 151, 65, 12],
  logbook: [3, 165, 65, 12],
  history: [69, 165, 65, 12],
  exit: [50, 179, 39, 19],
});
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

// ── THE LEVEL-UP ROLLOUT, ON THE SHEET (AUDIT 44 / a11) ─────────────
//
// DFU has NO separate level-up window. UpdatePlayerValues
// (DaggerfallCharacterSheetWindow.cs:369-394) mounts a StatsRollout
// onto the character sheet itself the moment ReadyToLevelUp is set:
// the level and health go up THERE, the eight stat labels stop
// showing live values and start showing the rollout's working ones,
// and the sheet refuses to close until the pool is spent
// (CheckIfDoneLeveling :433-455). The port's LevelUpScreen was a
// second window standing in for that; it stays as the ENHANCED skin's
// door (ui/charSheetDoor.js), and the classic lane levels here.
//
// StatsRollout's character-sheet positioning, verbatim (:88-131):
//   stat value panels  (141, 17 + 24*i), 28x6   - the sheet's own
//   stat select buttons(141,  6 + 24*i), 28x20
//   spinner            (176,  6 + 24*sel), 15x20; up 15x7 at +0,
//                      value label 15x6 at +7, down 15x7 at +13
export const STATS_ROLLOUT_SELECT = Object.freeze({ x: 141, y: 6, w: 28, h: 20, step: 24 });
export const STATS_ROLLOUT_SPINNER = Object.freeze({ x: 176, y: 6, w: 15, h: 20, step: 24 });
/** StatsRollout.modifiedStatTextColor - Color.green, the non-freeEdit
 *  default (:46). The char sheet's rollout is `new StatsRollout(true)`,
 *  freeEdit OFF, so a moved stat draws green here. */
export const STAT_MODIFIED_COLOR = Object.freeze([0, 1, 0, 1]);
/** SelectStat + the spinner's two arrows, in both key vocabularies -
 *  the overlayAction names (ui/input.js:338-339) and the raw e.code a
 *  "native" window is handed. */
const ROLLOUT_ACTIONS = Object.freeze({
  up: 'up', ArrowUp: 'up', down: 'down', ArrowDown: 'down',
  plus: 'plus', Equal: 'plus', NumpadAdd: 'plus',
  minus: 'minus', Minus: 'minus', NumpadSubtract: 'minus',
});

/** AUDIT 58: GetStatDescriptionTextID (TextProvider.cs:582-604) - the
 *  eight attribute buttons' Tags, and they are TEXT.RSC records 0..7
 *  in DFCareer.Stats order, which is STAT_KEYS_ORDER's order exactly
 *  (Strength 0 ... Luck 7). AddAttributePopupButton
 *  (DaggerfallCharacterSheetWindow.cs:269-274) hangs one on each of
 *  the eight `(141, 6 + 24*i, 28, 20)` rects (:209-216). */
export const statDescriptionTextId = (i) => (i >= 0 && i < STAT_KEYS_ORDER.length ? i : -1);

/** Internal_Strings.csv:110 - CheckIfDoneLeveling's refusal (:437-443). */
export const MUST_DISTRIBUTE_BONUS_POINTS = 'You must distribute all bonus points.';
/** DaggerfallUI.DaggerfallHighlightTextColor (DaggerfallUI.cs:54),
 *  Color32(219,130,40,255) - MultiFormatTextLabel's DEFAULT
 *  HighlightColor, what it paints a TextHighlight token with (:363)
 *  when nobody overrides it.
 *
 *  AUDIT 63 F35: the skills dialog is not one of those - see
 *  SKILL_DIALOG_HIGHLIGHT_COLOR below. This constant is the UI-wide
 *  default the dialog replaces, kept because that is the thing the
 *  override is an override OF. */
export const SKILL_HIGHLIGHT_COLOR = Object.freeze([219 / 255, 130 / 255, 40 / 255, 1]);

/** The four buttons that lead somewhere (:134-204). */
export const NAV_BUTTONS = Object.freeze(['inventory', 'spellbook', 'logbook', 'history']);

// ── CM4: the four RESIDUAL buttons - Name, Level, Health, Affiliations ──
//
// U32 wired the four navigation buttons; these four were still consumed
// as no-ops ("pend their popups") until CM4. Each is what its
// DaggerfallCharacterSheetWindow handler does (:769-812): ButtonClick,
// then a pushed DaggerfallInputMessageBox (Name) or a ClickAnywhereToClose
// DaggerfallMessageBox (the other three), owned as the sheet's `child`.

/** TEXT.RSC record 19, "You have no affiliations." (ShowAffiliationsDialog :327-364). */
export const NO_AFFILIATIONS_TEXT_ID = 19;
/** Internal_Strings.levelProgress (LevelButton_OnMouseClick :784). */
export const LEVEL_PROGRESS_PREFIX = 'Progress made to the next level: ';

/** LevelButton_OnMouseClick (:779-786), verbatim arithmetic: the level
 *  the skill sum has earned, its fraction as a whole percent. */
export function levelProgressPercent(entity) {
  const current = ((entity?.currentLevelUpSkillSum ?? 0)
    - (entity?.startingLevelUpSkillSum ?? 0) + 28) / 15;
  return Math.trunc((current % 1) * 100);
}

/** The membership book stores the port's canonical guild-record name;
 *  a temple's or an order's is its variant's (guildVariants.js). */
export function guildForMembership(membership) {
  const name = membership?.guild;
  if (!name) return null;
  for (const guild of Object.values(GUILDS)) if (guild.name === name) return guild;
  if (name.startsWith('Temple:')) return templeOf(name.slice('Temple:'.length));
  if (name.startsWith('Order:')) return orderOf(name.slice('Order:'.length));
  return null;
}

/** ShowAffiliationsDialog (:327-364): the tab-stopped table - a
 *  highlighted "Affiliation / Rank" header, then one row a membership
 *  with the faction's display name, the rank TITLE and the live
 *  reputation - or record 19 when the book is empty. The faction name
 *  is the same cloned FACTION.TXT row guild reputation reads, so no
 *  host hook is needed. `rows` is the TEXT.RSC door the sheet's other
 *  boxes share. */
export function affiliationRows(entity, rows = null) {
  const noAffiliations = () => rows?.(NO_AFFILIATIONS_TEXT_ID) ?? [{ text: 'You have no affiliations.', center: true }];
  const memberships = Object.values(activeMemberships(entity) ?? {}).filter(Boolean);
  if (!memberships.length) return noAffiliations();
  const out = [{
    cells: [{ text: 'Affiliation', x: 0 }, { text: 'Rank', x: 125 }],
    highlight: true,
  }];
  for (const membership of memberships) {
    const guild = guildForMembership(membership);
    if (!guild) continue;   // a hand-built or legacy membership names no guild: not a row, not a blank parchment
    const affiliation = entity?.factionRep?.dict?.get?.(guild.factionId)?.name ?? guild.name;
    const title = getTitle(membership, entity, guild);
    const rep = entity?.factionRep ? getReputation(entity.factionRep, guild.factionId) : 0;
    out.push({ cells: [{ text: affiliation, x: 0 }, { text: `${title} (rep:${rep})`, x: 125 }] });
  }
  return out.length > 1 ? out : noAffiliations();
}

/** The four buttons' DaggerfallShortcut names, in the sheet's setup order. */
const MODAL_HOTKEYS = Object.freeze(['CharacterSheetName', 'CharacterSheetLevel', 'CharacterSheetHealth', 'CharacterSheetAffiliations']);

/** AUDIT 26 F164 - UpdatePlayerValues' stat colours
 *  (DaggerfallCharacterSheetWindow.cs:414-419), verbatim from
 *  DaggerfallUI.cs:65-66. Below the permanent value is DRAINED, above
 *  it is INCREASED, and equal takes the label's default. */
export const STAT_DRAINED_COLOR = Object.freeze([190 / 255, 85 / 255, 24 / 255, 1]);
export const STAT_INCREASED_COLOR = Object.freeze([178 / 255, 207 / 255, 255 / 255, 1]);

/** AUDIT 63 F35: ShowSkillsDialog builds its message box and then
 *  overrides the highlight before showing it -
 *  `messageBox.SetHighlightColor(DaggerfallUI.DaggerfallUnityStatIncreasedTextColor)`
 *  (DaggerfallCharacterSheetWindow.cs:321), which
 *  DaggerfallMessageBox.SetHighlightColor (:455-458) hangs on the
 *  label, and MultiFormatTextLabel paints every TextHighlight token
 *  with it (:363). That constant is Color32(178,207,255,255)
 *  (DaggerfallUI.cs:66) - the SAME blue the drained/increased stat
 *  labels take - so a recently-raised skill row in THIS dialog is
 *  pale blue, not the orange default. */
export const SKILL_DIALOG_HIGHLIGHT_COLOR = STAT_INCREASED_COLOR;

/** What the sheet says when a host cannot open one. NEVER a silent
 *  swallow, and never a word about the port's own gaps - the same rule
 *  the settings screen follows. */
const NO_WINDOW_HERE = Object.freeze({
  inventory: 'Your pack is out of reach here.',
  spellbook: 'Your spellbook is out of reach here.',
  logbook: 'Your logbook is out of reach here.',
  history: 'Your history is out of reach here.',
});

/** The classic read-only sheet (F5). Toggle-closed by the same key
 *  or Escape; keys 1-4 pop the skill groups (interim text panels
 *  over the classic button rects' function). */
export class CharSheet {
  /** U32: the four NAVIGATION buttons finally lead somewhere.
   *
   *  DFU PUSHES those windows onto the UI stack, so the sheet stays
   *  underneath and closing the child returns to it. The port's hosts
   *  each hold ONE activeOverlay slot, so rather than teach four hosts
   *  a stack - and risk them drifting apart, which is exactly what the
   *  FOUR HOSTS rule exists to stop - the sheet OWNS its child and
   *  delegates to it. The host still sees one window; the player gets
   *  DFU's push and pop.
   *
   *  The factories come from the host because only the host knows how
   *  to build each window (a dungeon's inventory can carry a loot
   *  target; a town's cannot). A hook the host does not pass is a
   *  window that host cannot open, and the sheet SAYS SO rather than
   *  eating the click - which is what it did for all four until now. */
  constructor(entity, hooks = {}, rolls = Math.random) {
    this.entity = entity; this.done = false; this.page = 0;
    this.hooks = hooks;
    this.child = null;      // the pushed window, or null
    this.notice = null;     // why a button did nothing, when it could not
    this.isChoiceWindow = true;   // U8a: receive RAW codes through townTalk (digit pages + F5 toggle)
    // The rollout's state, mounted only while levelling.
    this.leveling = false;
    this.oghma = false;
    this.pool = 0;
    this.base = null;       // StatsRollout.StartingStats
    this.working = null;    // StatsRollout.WorkingStats
    this.cursor = 0;        // StatsRollout.selectedStat
    this._rolls = rolls;
    this._mountStatsRollout(rolls);
    refreshPaperDoll(entity);     // compose fresh on open, as the inventory does
  }

  /** UpdatePlayerValues :369-394, verbatim order: the fanfare, the
   *  pool (30 flat on the Oghma branch, BonusPool() otherwise), the
   *  Level++ and the health roll, the rollout's two stat clones, then
   *  BOTH flags cleared.
   *
   *  advancement.applyLevelUp is the port's one home for the middle
   *  three - AUDIT 39 put the Oghma arm there, and the manifest's own
   *  warning is that the sheet must hand it the ALREADY-ROLLED pool so
   *  a second draw never burns a number the screen has shown. The
   *  distribute hook is empty on purpose: DFU's rollout writes
   *  PlayerEntity.Stats at CLOSE (:448), not at mount. */
  _mountStatsRollout(rolls) {
    const e = this.entity;
    if (!e?.readyToLevelUp) return;
    // ORL1: ...and the sheet does NOT level a character who levels by
    // the mod's law. ui/charSheetDoor.js hands that character
    // VirtueLevelUpScreen instead, and this guard is the other half of
    // it: without it, a classic-lane F5 pressed while a virtue level-up
    // is owed would mount DFU's rollout, take the Level++ and the
    // health roll at mount (below), and the mod's window would then
    // find nothing left to award. The Oghma arm is the exception the
    // door makes too - that pool is Daggerfall's own.
    if (!e.oghmaLevelUp && usesVirtueLeveling(e)) return;
    this.leveling = true;
    audio.playOneShot(SOUND.LevelUp, 1);   // levelUpSound (:46, :373)
    this.oghma = !!e.oghmaLevelUp;
    // The same one home. This rollout commits at mount (applyLevelUp
    // below), so it never re-opened on an unspent level - but the draw
    // is the level's wherever it is taken.
    this.pool = this.oghma ? OGHMA_BONUS_POOL : bonusPoolFor(e, rolls);
    this.base = { ...e.stats };
    this.working = { ...e.stats };
    this.cursor = 0;
    applyLevelUp(e, () => {}, rolls, this.pool);
  }

  /** DaggerfallStats.IsAllMax (:85-97) over the working stats - the
   *  shared law (ui/chargen.js), not a second copy of it. */
  _workingAllMax() {
    return allStatsMax(this.working);
  }

  /** CheckIfDoneLeveling (:433-455). Levelling: an unspent pool
   *  refuses the close with the mustDistributeBonusPoints box, and a
   *  spent one writes the working stats home. NOT levelling: closing
   *  the sheet is what CLEARS the recently-raised highlights - which
   *  is why a level-up close leaves them standing for the next visit.
   *  Answers whether the window may close. */
  _checkIfDoneLeveling() {
    if (this.leveling) {
      if (this.pool > 0 && !this._workingAllMax()) {
        this.child = new ActionTextBox([MUST_DISTRIBUTE_BONUS_POINTS]);
        return false;
      }
      this.leveling = false;
      Object.assign(this.entity.stats, this.working);   // PlayerEntity.Stats = statsRollout.WorkingStats (:448)
      return true;
    }
    if (this.entity) resetSkillsRecentlyRaised(this.entity);
    return true;
  }

  /** The pushed window's lifetime: a finished child pops, revealing
   *  the sheet again. Returns true while one is still up. */
  _stepChild() {
    if (this.child?.done) this.child = null;
    return !!this.child;
  }

  /** PushWindow. A missing or refused hook is REPORTED, never
   *  swallowed. */
  _open(which) {
    this.notice = null;
    const w = this.hooks[which]?.();
    if (!w) { this.notice = NO_WINDOW_HERE[which]; return false; }
    this.child = w;
    return true;
  }

  // ── CM4: the four residual buttons' handlers ──

  /** NameButton_OnMouseClick (:769-777): the input box seeded with the
   *  current name; EnterName_OnGotUserInput (:794-799) writes a
   *  non-empty answer only. */
  _showName() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.child = new InputMessageBoxWindow({
      label: ENTER_NEW_NAME,
      value: this.entity?.name ?? '',
      onSubmit: (input) => { if (input.length > 0 && this.entity) this.entity.name = input; },
    });
  }

  /** LevelButton_OnMouseClick (:779-786). */
  _showLevel() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.child = new ActionTextBox([`${LEVEL_PROGRESS_PREFIX}${levelProgressPercent(this.entity)}%`]);
  }

  /** HealthButton_OnMouseClick (:801-806) -> CreateHealthStatusBox. */
  _showHealth() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const rows = this.hooks.rows ? healthStatusRows(this.entity, this.hooks.rows) : [{ text: 'You are healthy.', center: true }];
    this.child = new ActionTextBox(rows);
  }

  /** AffiliationsButton_OnMouseClick (:808-812) -> ShowAffiliationsDialog. */
  _showAffiliations() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.child = new ActionTextBox(affiliationRows(this.entity, this.hooks.rows));
  }

  tick(dt) { if (this.child) { this.child.tick?.(dt); this._stepChild(); } }
  wheel(dir) { if (this.child) { this.child.wheel?.(dir); this._stepChild(); return true; } return false; }

  /** U42: the sheet forwarded tick, wheel, input and click to a
   *  pushed window and NOT hover, so every hover-driven behaviour a
   *  child owns was dead on the sheet's route into it - which is the
   *  route THREE of the four hosts take, through charSheetHooks'
   *  `spellbook` button. The host seams test for the method on the
   *  OVERLAY (the sheet), find it missing, and never reach the child
   *  (townTalk.js's `if (!overlay?.hover) return false`). It cost the
   *  spellbook its list highlight and all three of its icon tooltips,
   *  and only on that route, because Backspace makes the window the
   *  overlay itself. The sheet has nothing of its own to hover, so
   *  this is pure forwarding; `true` is what the seams read as
   *  "consumed". */
  hover(vx, vy, e = null) {
    if (!this.child) return false;
    this.child.hover?.(vx, vy, e);
    this._stepChild();
    return true;
  }

  input(action, e = null) {
    // A pushed window owns the keyboard until it closes.
    if (this.child) { this.child.input?.(action, e); this._stepChild(); return; }
    this.notice = null;
    // CM4: the four residual buttons' DaggerfallShortcut bindings
    // (CharacterSheetName N, CharacterSheetLevel V, CharacterSheetHealth,
    // CharacterSheetAffiliations), ahead of the page digits and the
    // toggle, as DFU's Hotkey assignments sit on the buttons themselves.
    const modal = firstHotkey(MODAL_HOTKEYS, action, e);
    if (modal === 'CharacterSheetName') { this._showName(); return; }
    if (modal === 'CharacterSheetLevel') { this._showLevel(); return; }
    if (modal === 'CharacterSheetHealth') { this._showHealth(); return; }
    if (modal === 'CharacterSheetAffiliations') { this._showAffiliations(); return; }
    // Both vocabularies: input.js actions (dungeon routing) and raw
    // codes (the exterior hosts' overlay seam).
    // The mounted rollout owns the spinner keys. StatButton_OnMouseClick
    // (:925-939) hands the stat buttons to the rollout while levelling
    // and pops the attribute description otherwise; up/down is the
    // port's keyboard for SelectStat, plus/minus for the spinner.
    if (this.leveling) {
      // BOTH vocabularies, the same reason the page map below carries
      // both: townTalk hands a "native" window the raw e.code and the
      // dungeon's routeKey hands it an overlayAction name.
      const spin = ROLLOUT_ACTIONS[action];
      const key = STAT_KEYS_ORDER[this.cursor];
      if (spin === 'up') { this.cursor = (this.cursor + 7) % 8; return; }
      if (spin === 'down') { this.cursor = (this.cursor + 1) % 8; return; }
      if (spin === 'plus') { const r = statUp(this.working[key], this.pool); this.working[key] = r.working; this.pool = r.pool; return; }
      if (spin === 'minus') { const r = statDown(this.working[key], this.base[key], this.pool); this.working[key] = r.working; this.pool = r.pool; return; }
    }
    const pages = { 1: 1, 2: 2, 3: 3, 4: 4, Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
    const p = pages[action];
    if (p) { this.page = this.page === p ? 0 : p; return; }
    if (this.page && (action === 'back' || action === 'Escape')) { this.page = 0; return; }
    // MAC-C: the toggle key is the REGISTRY's, not the literal 'F5'.
    // This window takes RAW codes (isChoiceWindow), so the code is
    // resolved here the way every host ladder resolves one - a player
    // who rebinds CharacterSheet gets a sheet that closes on their key
    // rather than on Bethesda's.
    const bound = actionForCode(bindings(), action);
    // ...and the PACK key crosses over rather than doing nothing, which
    // is the same law the enhanced sheet takes (ui/charSheetDoor.js).
    // The hook is the sheet's own Items button; no hook, no key.
    if (bound === 'Inventory' && this.hooks?.inventory) {
      if (!this._checkIfDoneLeveling()) return;   // the same gate the exit takes: no leaving with points owed
      this.done = true;
      this.hooks.inventory();
      return;
    }
    if (action === 'confirm' || action === 'back' || action === 'sheet'
      || action === 'Enter' || action === 'Escape' || bound === 'CharacterSheet' || action === 'KeyE') {
      // CancelWindow / the toggle key / the exit button all run the
      // same gate (:241, :259, :944) - the sheet does not close while
      // bonus points are owed.
      if (this._checkIfDoneLeveling()) this.done = true;
    }
  }

  /** AUDIT 18: the sheet had no click() at all, so its drawn EXIT
   *  button was inert and the pointerdown fell through to the host's
   *  requestLook. Every DFU button rect is answered or consumed. */
  click(vx, vy) {
    if (this.child) {
      if (this.child.clickNative) this.child.clickNative(vx, vy);
      else this.child.click?.(vx, vy);
      this._stepChild();
      return true;
    }
    // AUDIT 63 F35 (review): THE SKILLS DIALOG EATS THE CLICK.
    // ShowSkillsDialog's box is `messageBox.ClickAnywhereToClose = true`
    // (DaggerfallCharacterSheetWindow.cs:323), and DaggerfallMessageBox's
    // ParentPanel_OnMouseClick (:645-663) CloseWindow()s on any click
    // while the box is uiManager.TopWindow - the sheet underneath is not
    // the top window and receives nothing. The port draws the page as a
    // plate on the sheet rather than as a pushed window, so without this
    // line the click fell straight through to whatever rect lay beneath:
    // with F35's centred two-column plate (37,34,246,131) that is the
    // eight STATS_ROLLOUT_SELECT rects (x 141..169), so reading the
    // Miscellaneous skills and clicking to dismiss them popped the AUDIT
    // 58 attribute-description box on top of the dialog instead. It also
    // reached the four skill buttons and the nav row under the old
    // sheet-anchored plate. One click, and the dialog is gone.
    if (this.page) { this.page = 0; return true; }
    const R = CHARSHEET_RECTS;
    // The rollout's own hit rects, while it is mounted: the eight stat
    // select buttons (StatsRollout.cs:110-131) and the spinner's two
    // halves (UpDownSpinner.cs:100-111).
    if (this.leveling) {
      const sp = STATS_ROLLOUT_SPINNER, se = STATS_ROLLOUT_SELECT;
      const spY = sp.y + sp.step * this.cursor;
      if (inRect([sp.x, spY, sp.w, 7], vx, vy)) { this.input('plus'); return true; }
      if (inRect([sp.x, spY + 13, sp.w, 7], vx, vy)) { this.input('minus'); return true; }
      for (let i = 0; i < STAT_KEYS_ORDER.length; i++) {
        if (inRect([se.x, se.y + se.step * i, se.w, se.h], vx, vy)) { this.cursor = i; return true; }
      }
    }
    // AUDIT 58: THE EIGHT ATTRIBUTE POPUP BUTTONS' OTHER ARM.
    // StatButton_OnMouseClick (:925-941) is a two-armed handler: while
    // levelling the rollout above claims these rects, and OTHERWISE it
    // plays ButtonClick and pops the stat's own TEXT.RSC description as
    // a ClickAnywhereToClose box (SetTextTokens((int)sender.Tag,
    // playerEntity.Stats)). The port had only the levelling arm, so
    // clicking any of the eight attribute values on a normal sheet did
    // nothing at all - not even a click - and this method's own "every
    // DFU button rect is answered or consumed" was false for them.
    // DFU's macro source for the box is playerEntity.Stats; the port's
    // `rows` door is the same TEXT.RSC read the rest of the window's
    // siblings make.
    {
      const se = STATS_ROLLOUT_SELECT;
      for (let i = 0; i < STAT_KEYS_ORDER.length; i++) {
        if (!inRect([se.x, se.y + se.step * i, se.w, se.h], vx, vy)) continue;
        audio.playOneShot(SOUND.ButtonClick, 1);
        // ATTRMACRO1 (2026-09-18, Mac: "none of the attribute explanations show actual values"): DFU's line here
        // is `SetTextTokens((int)sender.Tag, playerEntity.Stats)` - the record AND a macro source - and the comment
        // above has said so since AUDIT 58 while the code handed the rows straight to the box. So every one of the
        // eight showed `%str`, `%ark`, `%dam`, `%enc` and their siblings as literal tokens. The source is the
        // player's stats (systems/quest/questMacros.js statsMacroSource) and the pass is the one every other
        // TEXT.RSC surface makes; it is applied HERE and not inside the `rows` hook, which the journal, the item
        // text, the health box and the skills dialog all share.
        const rows = statDescriptionRows(this.hooks.rows?.(statDescriptionTextId(i)) ?? [], this.entity);
        if (rows.length) this.child = new ActionTextBox(rows);
        return true;
      }
    }
    // AUDIT 64 F28: THE GOLD BUTTON. GoldButton_OnMouseClick
    // (DaggerfallCharacterSheetWindow.cs:787-792) plays ButtonClick and
    // Shows DaggerfallBankingWindow.CreateBankingStatusBox(this) - a
    // public static member with this one caller, and the only surface
    // in the game that shows EVERY region's account, loan and due date
    // at once (the bank window itself reads one region, :247). The
    // sheet already holds the entity the accounts ride on, so this
    // needs no host hook and works on every host that opens a sheet.
    // ClickAnywhereToClose (:548) is the ActionTextBox's own contract,
    // and `previous = this` is what mounting it as a CHILD means:
    // dismissing it returns to the sheet.
    if (inRect(R.gold, vx, vy)) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      this.child = new ActionTextBox(
        bankingStatusRows(this.entity?.bankAccounts, { regionName: (i) => REGION_NAMES[i] ?? '' }),
        // SetHighlightColor(DaggerfallUnityStatDrainedTextColor) (:523)
        { highlightColor: STAT_DRAINED_COLOR },
      );
      return true;
    }
    if (inRect(R.exit, vx, vy)) {
      audio.playOneShot(SOUND.ButtonClick, 1);   // ExitButton_OnMouseClick :943
      if (this._checkIfDoneLeveling()) this.done = true;
      return true;
    }
    const skills = [R.primarySkills, R.majorSkills, R.minorSkills, R.miscSkills];
    for (let i = 0; i < skills.length; i++) {
      if (inRect(skills[i], vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.input(i + 1); return true; }
    }
    // U32: THE FOUR NAVIGATION BUTTONS. These were hit-tested,
    // consumed, and did NOTHING - the reported bug. Each one pushes its
    // window now, and two of them (inventory, spellbook) were built and
    // working the whole time with no caller.
    for (const which of NAV_BUTTONS) {
      if (inRect(R[which], vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._open(which); return true; }
    }
    // CM4: the four residual buttons (:772-855). U32 left these
    // consumed as no-ops; each pushes its DFU popup now.
    if (inRect(R.name, vx, vy)) { this._showName(); return true; }
    if (inRect(R.level, vx, vy)) { this._showLevel(); return true; }
    if (inRect(R.health, vx, vy)) { this._showHealth(); return true; }
    if (inRect(R.affiliations, vx, vy)) { this._showAffiliations(); return true; }
    // Any other drawn rect still CLICKS and is consumed, so a press on
    // the sheet never escapes to the host - every
    // DaggerfallCharacterSheetWindow button assigns ButtonClick
    // (:772-952).
    if (Object.values(R).some((r) => inRect(r, vx, vy))) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      return true;
    }
    return false;
  }

  draw(renderer, canvas, font, s) {
    // A pushed window draws INSTEAD of the sheet - DFU's stack puts it
    // on top, and the sheet's own art would show through a window that
    // does not cover the whole panel otherwise.
    if (this.child) return this.child.draw(renderer, canvas, font, s);
    if (!_art) return this._drawFallback(renderer, canvas, font, s);
    const e = this.entity;
    const m = nativeMetrics(canvas);
    // AUDIT 19 F2: OPAQUE BLACK, not a dim. DaggerfallBaseWindow's
    // constructor sets `parentPanel.BackgroundColor = Color.black`
    // (DaggerfallBaseWindow.cs:40) - ScreenDimColor is used only by the
    // handful of windows that explicitly override it, and this is not one.
    // Drawing a 50% dim here left the letterbox showing the world at half
    // brightness around the panel, which is the SAME defect U21 fixed for
    // the menu, U21b for chargen and U22 for the splash. Fourth, fifth and
    // sixth instance; one shared helper now.
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallCharacterSheetWindow.cs:105),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);
    // The verbatim label geometry (DaggerfallCharacterSheetWindow)
    const label = (text, x, y, opts) => shadowText(renderer, font, String(text), m, x, y, opts);
    // U32: why a button did nothing, when it could not. Drawn over the
    // sheet's own art, cleared by the next key or click.
    if (this.notice) label(this.notice, 8, 190, { color: [1, 0.5, 0.4, 1] });
    label(e.name ?? '', 41, 4);
    label(e.race ?? 'Breton', 41, 14);
    label(e.career?.name ?? '', 46, 24);
    label(e.level ?? 1, 45, 34);
    // DaggerfallCharacterSheetWindow.cs:401 is
    // `goldLabel.Text = PlayerEntity.GetGoldAmount().ToString()`, and
    // GetGoldAmount (PlayerEntity.cs:1313-1316) is goldPieces PLUS
    // every letter of credit in the pack - the coin stack alone
    // under-reports a banked player by the whole letter.
    label(totalGoldAmount(e), 39, 44);
    label(`${Math.trunc((e.fatigue ?? maxFatigue(e)) / FATIGUE_MULTIPLIER)}/${Math.trunc(maxFatigue(e) / FATIGUE_MULTIPLIER)}`, 57, 54);
    label(`${e.health}/${e.maxHealth}`, 52, 64);
    label(`${Math.trunc(carriedWeight(e))}/${entityMaxEncumbrance(e)}`, 90, 74);   // DaggerfallCharacterSheetWindow.cs:404 reads PlayerEntity.MaxEncumbrance
    // AUDIT 26 F164: UpdatePlayerValues colours each stat label by the
    // live value against the PERMANENT one (:414-419) - drained below,
    // increased above, default when they agree. The port drew all
    // eight at the shadow-text default, so the at-a-glance warning DFU
    // gives after a disease or a drain spell was absent. `stats` IS
    // the permanent map here (statMods.js:31 clamps permanent + mods).
    STAT_KEYS_ORDER.forEach((k, i) => {
      // While levelling the sheet's own stat labels go EMPTY (:412)
      // and the mounted rollout fills the same panels with its working
      // values, green where they have moved (StatsRollout.UpdateStatLabels
      // :198-208).
      if (this.leveling) {
        label(this.working[k], 141, 17 + i * 24, { align: 'center', w: 28, color: this.working[k] !== this.base[k] ? STAT_MODIFIED_COLOR : undefined });
        return;
      }
      const live = liveStat(e, k);
      const permanent = e.stats?.[k] ?? 0;
      const color = live < permanent ? STAT_DRAINED_COLOR
        : live > permanent ? STAT_INCREASED_COLOR : undefined;
      label(live, 141, 17 + i * 24, { align: 'center', w: 28, color });
    });
    if (this.leveling) this._drawSpinner(renderer, font, m);
    drawPaperDoll(renderer, m, e, PAPERDOLL_ORIGIN[0], PAPERDOLL_ORIGIN[1]);
    if (this.page) this._drawSkillPage(renderer, font, m);
    return undefined;
  }

  /** UpDownSpinner (:95-119) beside the selected stat: CHAR02I1.IMG
   *  behind, the bonus pool centred in the 15x6 label between the two
   *  7px arrow halves. Art-less, the frame is a plain plate - the
   *  NUMBER is the load-bearing part. */
  _drawSpinner(renderer, font, m) {
    const sp = STATS_ROLLOUT_SPINNER;
    const y = sp.y + sp.step * this.cursor;
    if (_spinnerArt) drawImg(renderer, _spinnerArt, m, sp.x, y);
    else drawRect(renderer, m, sp.x, y, sp.w, sp.h, [0.12, 0.10, 0.07, 0.9]);
    shadowText(renderer, font, String(this.pool), m, sp.x, y + 7, { align: 'center', w: sp.w });
  }

  /** ShowSkillsDialog (:276-325).
   *
   *  AUDIT 63 F35: the list is the WHOLE group. DFU's loop is
   *  `for (int i = 0; i < skills.Count; i++)` with no cap, and its
   *  tokens go into a DaggerfallMessageBox that AUTO-SIZES to them
   *  (:320-324), so all 23 Miscellaneous skills are on screen. The
   *  port sliced to nine and hid fourteen of them - a truncation the
   *  UI arc had written down as the classic sheet's own answer.
   *
   *  TWO COLUMNS, on page 4 only. MiscSkillsButton_OnMouseClick is the
   *  one caller that passes `twoColumn: true` (:835); the three career
   *  buttons (:817, :823, :829) do not. The fill is ROW-MAJOR, not
   *  column-major: the EVEN entry goes at token x=0 and the ODD one at
   *  x=136 on the same line, with the newline emitted after the right
   *  entry (:294-305) - so consecutive skills are neighbours across,
   *  not down.
   *
   *  Because that dialog is a message box rather than a panel pinned
   *  to the sheet, the two-column page sizes and centres itself the
   *  way DaggerfallMessageBox does instead of reusing the sheet-
   *  anchored rect the single-column pages keep. 246 is DFU's own 136
   *  column pitch plus a column's width of text.
   *
   *  AUDIT 63 F34: and the HAND-TO-HAND DAMAGE LINE (:283-284,
   *  :309-318), which neither skin drew. Whenever the GROUP being
   *  listed contains HandToHand the dialog appends one more line after
   *  a NewLineToken: `hthDamageFormatString` (Internal_Strings.csv:1553,
   *  `{0} dmg: {1}-{2}`) over the skill's name and
   *  CalculateHandToHandMin/MaxDamage of the LIVE skill value
   *  (GetLiveSkillValue, :313-314 - so a lycanthrope's +30 and an
   *  EnhancesSkill enchantment both move the printed damage). The
   *  detection walks the whole group, not the drawn rows. Its token
   *  formatting is plain Text (:316), so it never takes the highlight
   *  colour. */
  _drawSkillPage(renderer, font, m) {
    const e = this.entity;
    const names = ['Primary', 'Major', 'Minor', 'Miscellaneous'];
    const career = [e.career?.primarySkills ?? [], e.career?.majorSkills ?? [], e.career?.minorSkills ?? []];
    const inCareer = new Set(career.flat());
    const ids = this.page <= 3 ? career[this.page - 1]
      : Object.keys(SKILL_NAMES).map(Number).filter((id) => !inCareer.has(id));
    const twoColumn = this.page === 4;   // :835 is the only caller that passes true
    const showHth = ids.includes(SKILLS.HandToHand);
    const lines = (twoColumn ? Math.ceil(ids.length / 2) : ids.length) + (showHth ? 1 : 0);
    const h = lines * 9 + 14;
    const w = twoColumn ? 246 : 130;
    const x = twoColumn ? Math.floor((320 - w) / 2) : 8;
    const y = twoColumn ? Math.floor((200 - h) / 2) : 100;
    drawRect(renderer, m, x, y, w, h, [0.05, 0.05, 0.09, 0.95]);
    shadowText(renderer, font, `${names[this.page - 1]} skills`, m, x + 4, y + 3);
    // TextProvider.GetSkillSummary (:490-496): a skill raised since
    // the sheet was last closed formats its WHOLE row as
    // TextHighlight, which MultiFormatTextLabel draws in the label's
    // HighlightColor (:363). AUDIT 63 F35: for THIS dialog that colour
    // is not the UI default - ShowSkillsDialog overrides it with
    // `SetHighlightColor(DaggerfallUI.DaggerfallUnityStatIncreasedTextColor)`
    // (:321), Color32(178,207,255,255) (DaggerfallUI.cs:66), so a
    // recently-raised row is pale BLUE here rather than the orange
    // DaggerfallHighlightTextColor (:54) this used to draw.
    ids.forEach((id, i) =>
      shadowText(renderer, font, `${SKILL_NAMES[id]} ${skillValue(e, id)}%`,   // AUDIT 65 CV-1: GetSkillSummary's value token is GetLiveSkillValue (TextProvider.cs:503), not the permanent array
        m, x + 4 + (twoColumn && i % 2 ? 136 : 0), y + 13 + (twoColumn ? Math.floor(i / 2) : i) * 9,
        { color: getSkillRecentlyIncreased(e, id) ? SKILL_DIALOG_HIGHLIGHT_COLOR : [0.9, 0.9, 0.85, 1] }));
    if (showHth) {
      const v = skillValue(e, SKILLS.HandToHand);
      shadowText(renderer, font,
        `${SKILL_NAMES[SKILLS.HandToHand]} dmg: ${handToHandMinDamage(v)}-${handToHandMaxDamage(v)}`,
        m, x + 4, y + 13 + (lines - 1) * 9, { color: [0.9, 0.9, 0.85, 1] });
    }
  }

  _drawFallback(renderer, canvas, font, s) {
    const e = this.entity, W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], dim = [0.6, 0.6, 0.55, 1];
    drawText(renderer, font, `${e.name ?? '?'}  ${e.career?.name ?? ''}  LVL ${e.level}`, 20 * s, 16 * s, s, gold);
    drawText(renderer, font, `HP ${e.health}/${e.maxHealth}   MP ${e.magicka}/${e.maxMagicka}`, 20 * s, 30 * s, s, white);
    // The art-less sheet still LEVELS - it has to, because the close
    // gate refuses while points are owed and a player who cannot see
    // the pool cannot spend it.
    if (this.leveling) {
      drawText(renderer, font, `POOL: ${this.pool}   +/- assign`, 20 * s, 40 * s, s, gold);
      STAT_KEYS_ORDER.forEach((k, i) => drawText(renderer, font,
        `${i === this.cursor ? '>' : ' '} ${k.slice(0, 3).toUpperCase()} ${this.working[k]}`,
        20 * s, (48 + i * 10) * s, s, this.working[k] !== this.base[k] ? STAT_MODIFIED_COLOR : white));
    } else {
      STAT_KEYS_ORDER.forEach((k, i) => drawText(renderer, font,
        `${k.slice(0, 3).toUpperCase()} ${e.stats[k]}`, 20 * s, (48 + i * 10) * s, s, white));
    }
    const groups = [['P', e.career?.primarySkills ?? []], ['M', e.career?.majorSkills ?? []], ['m', e.career?.minorSkills ?? []]];
    let row = 0;
    for (const [tag, ids] of groups) {
      for (const id of ids) {
        drawText(renderer, font, `${tag} ${SKILL_NAMES[id]} ${e.skills?.[id] ?? ''}`, 100 * s, (48 + row * 10) * s, s, dim);
        row++;
      }
    }
  }
}
