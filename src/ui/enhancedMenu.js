// ═══════════════════════════════════════════════════════════════════
// ENHANCED — THE MAIN MENU
//
// The game's front door when the skin is enhanced, and ENHANCED IS THE
// DEFAULT (systems/uiSkin.js). One screen: continue, new game, load,
// settings, mods, about.
//
// ONE IMPLEMENTATION, THREE HOSTS. This module is mounted by the game
// at boot (src/main.js), by the prototype page (/menu.html, via
// src/tools/enhancedMenu.js), and by the PAUSE DOOR once the game is
// running (ui/pauseDoor.js) - and there is no second copy of any of
// it. The prototype exists to be argued with and must therefore be the
// same screen that ships, or the argument is with something else.
//
// ── TWO MODES, ONE SCREEN (U51) ──────────────────────────────────
//
// `mode: 'boot'` is the front door. `mode: 'pause'` is the same screen
// mounted over a running game by Escape, and the difference is the
// RAIL and nothing else: Continue and New Game are boot questions and
// go, Resume / Save Game / Exit are in-game ones and arrive. Settings,
// Mods and About are identical in both, which is the entire point -
// the reason this door exists is that settings were reachable only at
// boot, and a pause screen carrying its OWN settings view would have
// recreated the divergence it was built to close.
//
// A SECOND ENHANCED SCREEN WAS THE OBVIOUS BUILD AND IS THE WRONG ONE.
// The classic pause window is a separate window because classic has no
// choice - OPTN00I0 is a different .IMG from PICK03I0. Here the two
// are one module with a rail that changes, so a setting added to the
// front door is in the pause screen the same afternoon.
//
// ── WHAT IT REPLACES ─────────────────────────────────────────────
//
// The port's front door WAS four screens in a row, and the player met
// all four before touching the game:
//
//     ui/titleScreen.js      the logo, dismissed by any key
//     scenes/launcherScene.js + ui/settingsWindow.js   settings, 584 lines
//     ANIM0001.VID           the splash
//     ui/startWindow.js      PICK03I0 - Load / New Game / Exit
//
// Three of those were separate hosts with their own event wiring, and
// the settings screen was only reachable at boot: once the game was
// running there was no door back to it that did not go through a
// reload. Classic works that way because classic is a DOS program with
// a fixed 320x200 screen. Neither reason survives here.
//
// This is ONE screen, under BOTH skins (main.js:131-256, FD1: the
// launcher and its settings window are deleted; the classic rail is
// Begin, which leads into the splash and PICK03I0 exactly as before).
// Every destination is a press away from every other, settings
// included, mods included.
//
// ── WHY THE LABELS ARE TYPE ──────────────────────────────────────
//
// PICK03I0.IMG has "Load Game", "Start New Game" and "Exit" PAINTED
// INTO the bitmap, and DFU lays invisible click rects over the words
// (startWindow.js's own header says so, and the port had to land those
// rects to the pixel or the hit boxes drifted off the labels). Art
// that carries text cannot reflow, cannot scale, cannot be localised
// and cannot be read on a phone. Every word here is text in a real
// font, which is the single biggest thing this overhaul buys.
//
// ── THE LAW IS BORROWED, NOT REWRITTEN ───────────────────────────
//
// The settings pane renders through the SAME modules the shipped
// settings screen uses - systems/settings.js, ui/settingsMap.js,
// ui/settingsLaw.js, ui/settingsCopy.js. About 850 lines of law, all
// of it cited to DFU, and none of it is retyped here. Only the ~650
// lines of WebGL drawing get replaced. That split already existed;
// this is the first thing to test whether it was real.
//
// So the toggles on this page WRITE. Flip MusicVolume here and the
// game reads it, because there is one store and this is a second view
// of it rather than a second copy.
//
// ── AND IT COSTS NO GAME DATA ────────────────────────────────────
//
// Nothing on this screen needs ARENA2, and main.js now acts on that:
// the enhanced door mounts BEFORE ensureArena2 and the folder pick
// happens when a game actually starts. The classic menu cannot do
// that - it needs PICK03I0, a palette and FONT0003 before it can draw
// a single word - which is why the port's boot has always had to gate
// the pick ahead of the menu.
//
// So a player who opens the page to change a setting, read what is in
// the build, or find out whether their save is still there is never
// asked for a folder. That is not a cosmetic difference: on a phone
// the pick is a zip upload.
// ═══════════════════════════════════════════════════════════════════

import { fpArm, hasDaggerfallArrows } from '../combat/fpArm.js';
import { dressStanding } from '../systems/clothingStanding.js';   // DRESS1 (2026-09-30, Discord): the Standing page's Dress line
import { questRail, journalLines, questTitleOf, QUEST_URGENT_SECONDS, remainWords } from './questRail.js';
import { entryTarget, targetWords, WHERE_TEXT } from './questLens.js';   // GUIDE2: where a quest points, and the way there   // MAC-K2: the ONE quest walk, shared with the chronicle
import { questTracker, followOn, trackButton } from './questTracker.js';   // GUIDE4: the HUD's card - the Track toggle, and the quest the journal opens on
import { closeOnOutsideTap } from './enhancedOverlays.js';   // OT1: a tap on the scrim resumes
import { TEST_PRESETS, TEST_RIDE, TEST_SEA, TEST_LOOT } from '../systems/testRoom.js';   // TR3: the one home the pane shows; TSR4: the ride; LR3: the loot ladder
import { mwRaceId } from '../formats/mwNpc.js';
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';
import { dfWornEquipment } from '../formats/mwItemMap.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { morrowindDataCount, morrowindDataCounted, countMorrowindArchives, assetPickerOpen } from '../scenes/dataSource.js';   // MAC1: the boot door counts the store itself; AUDIT 65 XL-6: by NAME - it never reads a stored file   // MW-IMPORT: the attach door; MWFIX: and the modal it opens owns the keyboard
import { CATEGORIES, keysOf } from '../ui/settingsMap.js';
import { widgetFor, blockedReason, formatValue, stepValue, COLOUR_KEYS, ENUM_LAW } from '../ui/settingsLaw.js';   // FT14: the enum's own values are the bar's segments
import { labelOf, helpOf, INSTEAD, TIER_TEXT } from '../ui/settingsCopy.js';
import {
  effectiveSettings, setValue, saveSettings, resetToDefaults, tierOf, DEFAULTS,
} from '../systems/settings.js';
import { mostRecentRestorable, restorableSaves, firstRestorable, deleteSave, QUICK_SAVE_NAME, loadSlot, saveSlot } from '../systems/saveSlots.js';
import { offlineCopyOf, onlineCopyOf } from '../systems/offlineCopy.js';   // AUDIT LIVED1 E/G: the doors between the lanes
import { sharedClassicMinutes } from '../net/wire.js';   // AUDIT LIVED1 G: the shared clock's minute a character joins at
import { SKY_SEGMENTS, skyClassicMinutes, wallMsForSkyMinutes } from '../net/skyLaw.js';   // TIME4: the sky's day, said at the door
import {
  realmIo, realmList, realmCustoms, realmPut, realmDelete, realmUndo, realmFetch, realmRowAsSave, realmSummaryOf, realmRefusalText, takeRealmNotice,
  sweepUnsent,
} from '../systems/realmSaves.js';   // REALM P1.3: the Online door lists the realm's characters, the service's
import { applyCustoms, customsLines, crossLeveling, LEVELING_CROSS_LINE } from '../systems/realmCustoms.js';   // REALM P1.5: an offline character comes in once, through customs
import { mintCharacterId } from '../systems/characterId.js';   // REALM P1.4: a copy to offline is a new offline character
import { exportSavesZip, collectSlots, importSlots, entriesFromFiles, slotPathOf, TRANSFER_ZIP_NAME } from '../systems/saveTransfer.js';   // SP1: saves move between the website and the app
import { appStorage } from '../systems/appStorage.js';   // SP1: the store under this build - the browser's on the site, the file store in the app   // SAV4: the slot store; SLOTS1: every slot
import { uiSkin, SKIN_NAMES, isEnhanced } from '../systems/uiSkin.js';   // FD1: which boot rail
import { getPref, setPref, isOpen, setOpen } from '../systems/uiPrefs.js';
import { TOUCH_BUTTON_SLOTS, touchButtonSlots, nextTouchButton, touchButtonChoices } from './touchButtons.js';   // TOUCH-BUTTONS: the corner's three slots
import { DEFAULT_SERVER } from '../net/online.js';   // ONLINE1: the relay this port hosts, the field's placeholder   // R7: the port's own switches; SO1: the folded tiers' memory
import { replacementCount } from '../systems/musicReplacement.js';   // M-EXT: the packs card reports what the pick covers
import { brandMark } from './brandMark.js';   // INTRO2: Mac's supplied logo, shared with the final splash
import { soundReplacementCount } from '../systems/soundReplacer.js';   // SNDREP1: the sound pack's count
import { textureReplacementCount, bundleTextureCount } from '../systems/textureReplacement.js';   // M-TEX: and the texture half; DFMOD1: and the bundles'
import { attachedDfmods, DFMOD_DETAIL, dfmodMaxSize } from '../systems/dfmodTextures.js';
import { isIilMod } from '../systems/improvedInteriorLighting.js';   // IIL3: the lighting mod's own section   // DFMOD1: the attached texture mods, one row each; DFMOD2: the detail choice
import { isTouchDevice } from './touch.js';   // TI2: the Touch card mounts only where a finger can reach it
import { dateFromClassicMinutes, dateString, dateTimeString } from '../systems/gameDate.js';
// PX5: the pause clock reads THE ONE CLOCK directly (AUDIT 23 C2's
// law - every host already reads this same module), so no host seam
// is needed and no host can drift.
import { worldMinutes, skyMinutes, trustedWorldMinutes } from '../systems/worldTick.js';
import { BUILD_TAG } from '../buildTag.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from './domRepaint.js';
import { drawPixelGround } from './pixelGround.js';
// PX3: the pause window's Stats tab reads the shared player entity
// through the char sheet's own model - one law, not a restatement.
// Both are plain modules with no game data; the boot door never
// renders the tab, so the front door still reads no game state.
import { sheetModel } from './enhancedCharSheet.js';
import { profPagesShown, PROF_PAGE_SECTIONS, drawProfessionsPage, drawStoresPage, resetProfPages, profActUnderWay, setDownProfAct } from './profPages.js';   // PROF1: the Professions and Stores pages, online
import { REVENANT_PAGE_SECTIONS, revenantPageShown, drawRevenantsPage } from './revenantPage.js';
import { COMPANION_PAGE_SECTIONS, companionPageShown, drawCompanionsPage, resetCompanionRoster } from './companionRoster.js';   // COMPANION-ROSTER: the sworn and the slots
import { swornBodyOf } from '../systems/revenantCompanions.js';   // COMPANION-ROSTER: a sworn one's live health
import { enemyDisplayName } from '../characters/enemyBasics.js';   // REVENANT-PAGE: a revenant's kind   // REVENANT-PAGE: the foes that have earned your name
import { affiliations } from '../systems/affiliations.js';
import { legalRepOf } from '../systems/court.js';   // REP5: the law, region by region
import { banishmentLeft, KNOWN_CRIMINAL_BELOW, pardonPrice, challengeFine } from '../systems/standing.js';
import { legalStandingWord } from '../systems/legalBands.js';
import { REGION_NAMES } from '../formats/mapsTables.js';   // GUILD-REP: the sheet's Affiliations box, on the Standing page
import { hudLocked, setHudLocked, resetHudLayout, hudBarsSplit, setHudBarsSplit } from './hudLayout.js';   // HUD-MOVE: Lock UI and Reset UI
import { enhancedHudScale as hudScaleNow, HUD_SCALE_MIN, HUD_SCALE_MAX } from './enhancedHud.js';   // PX30c
import { playerEntity } from '../characters/playerEntity.js';
// PX6: the Stats page's skill labels - the one home (systems/skills.js).
import { SKILLS, SKILL_NAMES } from '../systems/skills.js';
import { overlayAction, bindings, eventMeans } from './input.js';   // U51: Escape, through the shared table; UXB1-F: the live keys a tile names; DISC28-A: the pause action's own key
import { bindings as liveBindings } from './input.js';   // PADPLUS1: the store the layout reset writes
import { resetPlusPadLayout } from './plusPad.js';   // PADPLUS1
import { hdGlyphSvg, hdGlyphName } from './padGlyphsHD.js';   // PADPLUS1: the layout card's glyphs
import { padFamily as livePadFamily } from './padGlyphs.js';   // PADPLUS1
import { openPlusPadBinds, plusPadLegend } from './plusPadBinds.js';   // PADPLUS10: the controller bindings window
import { plusBindsOpen, resetPlusDpad } from './plusPad.js';
import { peerBindBusy } from './peerMenuBindCard.js';   // PEERMENU1   // PADPLUS10: the window over this one answers its own keys
import { modKeyRows } from '../systems/controlsConfig.js';   // UXB1-F: a mod's keys, read-only on its tile
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, isIntKey, isFloatKey, isChoiceKey, isTextKey, isTupleKey } from '../systems/modSettings.js';   // REALM P0.2: onlineModSetting, the room's value for a key it owns (whole mods included)
import { keyCodeForDomCode, KEYCODE_NONE } from '../systems/keyCodes.js';   // HT1: a TextKey's capture spells the key as Unity would
import { isOnlinePage, onlineForcedPref, onlineForcedModSetting, onlineForcedSetting, onlineWholeModKey, ONLINE_ROOM_MOD_KEYS } from '../systems/onlineLane.js';   // OL1: online is the enhanced lane, whole - a forced switch is shown locked   // ROADS 24; DS1: the integer keys; UL1: the choice keys
import { onlineSyncPlan, applyOnlineSync, lastOnlineSync, undoOnlineSync } from '../systems/onlineSync.js';   // UXB1-E: the room's rules, copied home
import { CREDITS } from './credits.js';   // CR1: who made what the port carries
// FIX-F (Mac: "changing keybinds in classic/enhanced do not work"): the
// rebinding pane. The enhanced skin is the DEFAULT and had no door to
// the key bindings at all - the only one in the port opens off the
// CLASSIC pause window. The pane is its own module because it owns a
// document-level capture listener and a staged copy of both binding
// dicts, neither of which belongs in a screen that repaints itself.
import { paneControls, discardControlsStaging, captureArmed, controlsPromptOpen, dismissControlsPrompt } from './enhancedControls.js';
// FT0: the features home - one list over the three stores, filtered by kind
import { OVERHAUL_PANELS, currentOption } from '../systems/overhauls.js';
import { PLUS_THEMES } from './enhancedFrame.js';   // PLUS2: Enhanced Plus's colours
import { plusTheme, setPlusTheme } from './enhancedPlusStyle.js';  import { plusCursorOn, setPlusCursor } from './plusCursor.js';   // OVH1: the three looks
import { UI_PACKS, packUrl } from '../systems/uiPack.js';   // OVH2: a pack's own picture on its card
import { FEATURES, KINDS, KIND_ORDER, GROUPS, GROUP_ORDER, filterFeatures, featureCounts, featureForControl, resolveControl, modModules, modDials, matchesFeatureQuery } from '../systems/features.js';   // FT14: the groups and each mod's curated keys
import '../world/landView.js';   // RF4: the land-view lane registers itself with the registry
import '../world/outdoors.js';   // RF4: the outdoors lane too
import '../systems/featureLanes.js';   // FT18: the wind, the quick slots and the blood
// ACC1e: the account card at the head of the Online pane - the flow
// thinks (ui/accountFlow.js, node-drivable), this draws it
import { AccountFlow } from './accountFlow.js';
import { accountCard } from './enhancedAccount.js';
import { skinCard } from './skinCard.js';   // DISC23-B2: the skin, on the profile
import { saveTile, cloudStateOf, saveFromCard, newerBackup } from './saveTile.js';   // TILE1 (Mac: "a detailed tile based design for your saves... showing your portrait and character information"), and ACC2c's card-shaped save
import { loadFace } from './facePortrait.js';
import { timersMark, timersWindow, anchorBeside } from './enhancedTimers.js';   // TIMERS1: the hourglass beside the profile mark, and its window
import { profileBadge, portraitSave, liveCharacter } from './profileBadge.js';   // PROFILE1: the mark is the last character's portrait   // TILE1: the character's face, the one home chargen also reads
import { cloudIo, cloudList, pushSlot, pullSlot, removeCloudSlot, cloudOnly, slotKeyOf, cloudRefusalText } from '../systems/cloudSaves.js';   // ACC2: the backup a tile can offer, AUDIT-312 F1's delete, and ACC2c's download of a save that is only up there
import { serviceBase, storedSession } from '../net/accountClient.js';
import { isBountyQuestId, abandonBountyQuest, shareBountyQuest, bountyQuestShareable } from '../systems/bountyJournal.js';   // BOUNTY1: a bounty in the journal - its Abandon and its Share
import { liveBundles, canEndBundle, endBundle } from '../systems/mysticism.js';   // BUFF-END: the Stats page's Effects - the ONE bundle walk, and which the player may end
import { maxRoundsRemaining } from './hudActiveSpells.js';   // BUFF-END: a bundle's rounds, as the HUD reads them

// ── THE RAIL ─────────────────────────────────────────────────────
// Six destinations. Mac's call: the menus get set up now even where
// the thing behind them is not built, so a section that has no engine
// yet still has a home and says what it is waiting on. A rail with a
// hole in it teaches the player the hole is permanent.
// R7 (Mac): ENHANCED was a section of its own on the BOOT rail; SO1
// (2026-09-11) made it a category of Settings - same rows, one screen. The port's own switches were scattered - the skin under the
// brand, and the port's own additions in no interface at all - and a
// switch a player cannot find is not shipped. It is absent from SECTIONS_PAUSE deliberately: these
// answer "what kind of game am I about to play", which is settled by
// the time a pause menu opens, and two of them cannot take effect
// without a reload anyway.
// TR3 (Mac): TEST ROOM on the boot rail - a prebuilt character and a
// packed armory, for trying gear on the rigs without playing there.
// Boot-only for the same reason Continue and New Game are: it answers
// "which game", which is settled once one is running.
// FT0 (Mac, 2026-09-13): FEATURES on every rail - ONE home for every
// enhanceable feature, a list where each row wears its kind (Enhanced,
// Mod Authored, DFU Classic) as a coloured label and a chip row filters
// by it. Empty at FT0; the Enhanced category of Settings and the Mods
// section keep their rows until each one's slice moves it here
// (bible/10-UI/Features-Arc.md).
const SECTIONS_BOOT = ['Continue', 'New Game', 'Load Game', 'Online', 'Test Room', 'Settings', 'Features', 'Overhauls', 'About'];   // OVH1: the three looks   // FT16: Controls is a Settings CATEGORY, not a rail door   // FT14: Mods is gone - every mod is a tile on Features, and what the pane carried besides stands under them   // ONLINE1: the shared world's door
// FD1 (Mac, 2026-09-11): the CLASSIC skin opens on this same door. Its
// three game doors collapse into BEGIN, which leads into the classic
// start sequence - the title, the film, Daggerfall's own start window -
// so the classic player keeps every screen Daggerfall had and gains
// the one it never did: settings before the game, without a wizard.
// SO1: ENHANCED left the rail for a category of Settings (settingsMap).
// ONLINE1: ONLINE joins it - Mac: "if using classic, you'd see the
// other user's paperdoll" - the same pane, the same save brought in.
const SECTIONS_CLASSIC = ['Begin', 'Online', 'Settings', 'Features', 'Overhauls', 'About'];   // OVH1   // FT14; FT16: Controls is a Settings category

// U51: the same rail with the boot-only questions swapped for the
// in-game ones. Continue and New Game answer "which game", which is
// settled by the time this mounts over a running one; Resume, Save and
// Exit answer "what now", which is the only thing left to ask.
//
// SAVE AND LOAD STAY ON THE RAIL EVEN WHERE THE HOST REFUSES THEM.
// One host still hands `savingPrevented: () => true` and no save hook
// at all (exterior.js, the block-viewer probe; IS1 wired the interior
// mode's doors), and the pane says so in words. A rail that drops the
// row instead teaches the player the door was never there - the same
// argument the Mods section is built on.
const SECTIONS_PAUSE = ['Resume', 'Save Game', 'Load Game', 'Settings', 'Features', 'Overhauls', 'About', 'Exit'];   // OVH1   // FT14; FT16: Controls is a Settings category

const idOf = (label) => label.toLowerCase().split(' ')[0];

/** Rail entries that ACT rather than navigate. Resume has no pane to
 *  show - a screen whose only content is a button repeating the word
 *  you just pressed is a screen that wasted a press. */
const RAIL_ACTS = Object.freeze({ resume: 'resume' });

// PER-MOUNT STATE. It was module-scope while this was a page that
// could only be opened once; the game mounts and unmounts it, so a
// second visit must not inherit the first one's open sheet.
let section = 'continue';
let featureKind = null;   // FT0: the chip - null is All, else a KINDS id; per mount like the rest
let featureQuery = '';   // FT18: the Features search - what the player typed, per mount
let category = CATEGORIES[0].id;
let pickedKey = null;
let sheetOpen = false;   // the help pane is a sheet on a phone
let app = null;
let onAction = () => {};
// U51: 'boot' (the front door) or 'pause' (Escape, over a running
// game). `hooks` is the host's own save/load/exit trio, handed down by
// ui/pauseDoor.js and empty at boot.
let mode = 'boot';
let sections = SECTIONS_BOOT;
let hooks = {};
let keyHandler = null;
// ACC1f (Mac: "The online details itself will live as a popup on main
// menu startup and a new profile icon"): whether the account window is
// open, and whether startup has already offered it once.
let accountOpen = false;
/** TIMERS1: the timers window over the pause face, and its live view (the tick it must stop). */
let timersOpen = false;
let timersView = null;
let timersAnchor = null;      // AUDIT TIMERS1 UI-3: the hourglass's re-placing, disconnected with the face it stands in
let timersFocusBack = false;  // AUDIT TIMERS1 UI-5: a closed window hands the focus back to the hourglass
const stopTimers = () => { timersView?.stop(); timersView = null; timersAnchor?.(); timersAnchor = null; };
let accountOffered = false;
// ═══ TILE2/ACC2: WHAT THE CLOUD HOLDS, ASKED ONCE PER VISIT ═══════
//
// A pane repaints on every press, every skin switch and every Escape.
// A listing per repaint would be a request per keystroke, so the ask
// LATCHES the way the account offer does and the answer repaints once.
// `null` means unasked or unanswerable - a tile then draws no cloud
// line at all, which is also what a player with no account sees.
let cloudCards = null;
let cloudAsked = false;
let cloudBusy = null;    // the slot being pushed or removed, as slotKeyOf writes it
let cloudWhy = null;     // { slot, key, error, act } - the last refusal WORD, under the slot it was about, and the ACT it refused (the pre-merge audit 0927b B1) - a restore's under its one local copy
let cloudArm = null;     // the slot whose Delete is armed - a destructive act asks twice (AUDIT-312 F1); FIELD 2026-09-27: or `restore|key` / `push|key`, a newer backup's two acts - by the LOCAL key, since each replaces one local copy (0927b B5)
let lockHandler = null;
let resizeHandler = null;   // PX1: the home ground's redraw-on-resize
let textKeyCapture = null;   // DISC28-A: a mod TextKey row waiting for its key (HT1) - the back stack stands down; cleared by the capture and by unmount
let groundTimer = null;     // PX1b: the home sky's 8fps clock - cleared by every rebuild and by unmount
let questTimer = null;      // QT-LIVE1: the journal's once-a-second timer redraw - the same two owners
let pauseTab = 'system';    // PX3: which tab the pause window shows - System lands on Resume/Save
let questSel = null;        // PX4: the journal's selected row - 'a:<uid>' | 'f:<index>' | null = first active
let bountyAbandonArmed = null;   // BOUNTY1: the bounty whose Abandon was pressed once - the second press gives it up
let journalCleanArmed = null;   // JOURNAL-CLEAN: 'f:<index>' (Remove) | 'clear' (Clear archive) pressed once - the second press acts
let questShowHidden = false;    // JOURNAL-CLEAN: the rail's "Show hidden" - whether the hidden quests are drawn, in their own section
let statsSec = 'character'; // PX6: the Stats page's rail - character | attributes | skills | standing
let statsAllSkills = false; // PX6: the Miscellaneous disclosure, the sheet's own gesture
let sysSec = 'save';        // PX7: the System page's rail - which pane fills the detail

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// ── THE SAVE, READ FOR REAL ──────────────────────────────────────
// mostRecentRestorable is the slot store's own reader AND version
// test, so a card is drawn only for an envelope this build can
// actually restore. Reading raw was AUDIT F2: an older save drew a
// full Continue card and pressing it came up on the chargen wizard.
// SAV4: the store holds NAMED SLOTS now; these panes draw the most
// recent one (the boot Load arm loads exactly that), and the full
// slot list is the classic save window's - an enhanced-skin slot
// list is the PX lane's own card to design.
// SLOTS1: THE PICK RIDES A SEAM, not the verb. Every onAction call
// site names a game verb the census pins (load, online, save); the
// slot a pane pressed is taken once, by the door that acts on it -
// main.js's enhanced branch (the key -> ?loadkey), the pause door
// (the key -> the host's loadKey, the name -> its saveAs).
let _pickedSaveKey = null;
let _pickedSaveName = null;
let _saveNameDraft = '';
/** TIME4 (bible/06-Systems/Online-Time-Arc.md section 7): THE SKY'S DAY, SAID AT THE DOOR - what is true when the
 *  pane opens. From the sky's switch on (net/skyLaw.js SKY_SEGMENTS) a day is an hour (SKY-SLOW); its midnights and its
 *  dusks (18:00, forty-five real minutes after a midnight) are said in this machine's own minutes - on the hour for most
 *  of the world, at the half hour or a quarter past where a clock is set off the hour.
 *  Before the switch the sky is still the event clock's, a day every two hours, and the sentence says when it turns.
 *  test/time4_words.test.js holds the numbers to the law. */
export function skyDayWords(nowMs = Date.now(), localTime = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
  localMinute = (ms) => { const d = new Date(ms); return d.getMinutes() + d.getSeconds() / 60; }) {
  const turn = SKY_SEGMENTS[SKY_SEGMENTS.length - 1].fromMs;
  const midnight = wallMsForSkyMinutes(Math.ceil(skyClassicMinutes(turn) / 1440) * 1440);
  const m0 = ((localMinute(midnight) % 60) + 60) % 60;
  const at = (m) => { const v = ((m % 60) + 60) % 60; return `:${String(Math.floor(v)).padStart(2, '0')}${v % 1 ? ':30' : ''}`; };
  const day = `${m0 === 0 ? 'midnight falls on the hour' : `midnight falls at ${at(m0)}`}, and dusk at ${at(m0 + 45)}`;
  return nowMs >= turn
    ? `A day in the world is an hour of real time: ${day}.`
    : `A day in the world is two hours of real time until ${localTime(turn)}; from then on it is an hour: ${day}.`;
}

export function takePickedSaveKey() { const k = _pickedSaveKey; _pickedSaveKey = null; return k; }
/** REALM P1.3: the realm character the Online door's Play pressed - its id rides the boot (main.js ?realm). */
let _pickedRealmId = null;
export function takePickedRealmId() { const id = _pickedRealmId; _pickedRealmId = null; return id; }
/** REALM P1.3: the realm's characters as the service listed them this visit (null: not asked yet), its bound, what the
 *  last act said (a refusal, customs' report, a copy's word) and whether an act is running. Per VISIT, as the cloud's. */
let realmRows = null;
let realmAsked = false;
let realmMax = 0;
let realmWords = [];
let realmBusy = false;
export function takePickedSaveName() { const n = _pickedSaveName; _pickedSaveName = null; return n; }

/** One slot as the cards draw it: the character's line and numbers, and the slot's own name. */
function saveOf(entry) {
  const snap = entry.snap;
  const date = Number.isFinite(snap.classicMinutes) ? dateFromClassicMinutes(snap.classicMinutes) : null;   // AUDIT LIVED1 E (S5/U4's card; AUDIT LIVED1b T13 corrected the cite): a card is a LOCAL slot's, and a local slot plays offline on its one clock - the date it loads at, as the classic window and the cloud cards say
  return {
    key: entry.key,
    saveName: entry.info?.saveName ?? QUICK_SAVE_NAME,
    characterName: entry.info?.characterName ?? snap.name ?? '',
    characterId: entry.info?.characterId ?? null,   // CHARID1
    dateAndTime: entry.info?.dateAndTime ?? null,   // FIELD 2026-09-27: when this device saved the slot - a later save in the backup is told from it
    name: snap.name || 'Unnamed',
    // TILE1: the identity the PORTRAIT needs, and it was already in the
    // envelope - S3c/U9 put `race`, `gender` and `faceIndex` on the
    // save when the identity started riding it. Nothing new is stored;
    // this row simply stopped throwing three fields away.
    race: typeof snap.race === 'string' ? snap.race : null,
    gender: snap.gender === 'female' ? 'female' : 'male',
    faceIndex: Number.isInteger(snap.faceIndex) ? snap.faceIndex : 0,
    career: snap.career?.name ?? null,
    level: snap.level ?? null,
    health: snap.health, maxHealth: snap.maxHealth,
    gold: snap.goldPieces ?? null,
    when: date ? dateString(date) : null,
    hour: date ? `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}` : null,
    chargenDone: snap.chargenDone !== false,
    testRoom: snap.testRoom === true,   // AUDIT SET D4: a Test Room character, which plays offline
  };
}

/** SLOTS1: every restorable slot, most recent first (systems/saveSlots.js restorableSaves). */
function savedGames() {
  try { return restorableSaves().map(saveOf); } catch { return []; }
}

/** AUDIT SLOTS2 S1: THE DOOR'S PORTRAIT, read only as far as its answer -
 *  portraitSave's own law, asked of the saves newest first
 *  (firstRestorable). `portraitSave(savedGames())` read and parsed EVERY
 *  slot's envelope, on every render of the door, to draw one face. The
 *  same save as before. */
export function newestPortraitSave(storage) {
  try {
    const hit = firstRestorable((entry) => portraitSave([saveOf(entry)]) !== null, storage);
    return hit ? saveOf(hit) : null;
  } catch { return null; }
}

// ═══ TILE1/TILE2: THE TILES ══════════════════════════════════════
//
// Mac: the Online pane is "reserved for a detailed tile based design
// for your saves which will translate to the load character pane
// also". The tile itself is ui/saveTile.js and knows nothing about a
// pane; these three functions are what a pane hands it.

/** The slot's key on the SERVICE, which is (character, save name) and
 *  never the local number - the local integer is a fact about one
 *  store (bible ACC2 D2). `systems/cloudSaves.js` writes it, because
 *  this file's own copy had dropped the character half (AUDIT-312 F3).
 */
const cloudKeyOf = (save) => slotKeyOf(save);

/** Ask the service what it holds, ONCE per visit to this menu. Nothing
 *  waits on it: the tiles are drawn with no cloud line and gain one
 *  when the answer lands. A signed-out or guest device never asks. */
function ensureCloud() {
  if (cloudAsked) return;
  cloudAsked = true;
  const io = cloudIo({ fetch: (...a) => globalThis.fetch(...a), storage: appStorage() });
  if (!io) return;
  cloudList(io).then((r) => {
    if (!r.ok) return;
    cloudCards = r.saves;
    if (cloudWhy?.error === 'stale') cloudWhy = null;   // 0927b: the list it said had changed is here - the line reads it
    render();
  }).catch(() => {});
}

/** The cloud line for one slot, or the state that draws none.
 *
 *  THE DECISION IS `ui/saveTile.js`'s `cloudStateOf` and not this
 *  function's: AUDIT-312 F3 found three mutants of the arithmetic that
 *  once lived here surviving the whole suite, because a module that is
 *  DOM and a boot is a module no node pin can drive. What is left here
 *  is what only a menu can do - the handlers.
 *
 *  `restore`: FIELD 2026-09-27 - this tile's pane is the one that gets a
 *  game BACK (Load), so a newer backup can be restored from it - ACC2c's
 *  own law for where a download lives (see `cloudOnlyGrid`). */
function cloudFor(save, { restore = false } = {}) {
  const slot = cloudKeyOf(save);
  const card = (cloudCards ?? []).find((c) => slotKeyOf(c) === slot) ?? null;
  const state = cloudStateOf({
    // NO ACCOUNT, NO LINE. ACC0's wall is at cloud saves, and a player
    // who has not asked for one is not told about it on every tile.
    signedIn: !!cloudIo({ fetch: () => {}, storage: appStorage() }),
    characterId: save.characterId,
    card,
    busy: cloudBusy === slot,
    // a RESTORE's refusal is about the one local copy it would have replaced (0927b, the re-run's twin): its twin under
    // the same slot keeps its own line rather than a one-press Try again that restores over it
    error: cloudWhy?.slot === slot && (cloudWhy.act !== 'restore' || cloudWhy.key === save.key) ? cloudWhy.error : null,
    nowS: Math.floor(Date.now() / 1000),
    localTime: save.dateAndTime,   // FIELD 2026-09-27: a later save of this slot in the backup is `newer`
  });
  const why = state.error ? cloudRefusalText(state.error) : null;
  const line = { state: state.state, when: state.when, why, actions: [] };
  switch (state.state) {
    // A WAIT HAS NO BUTTON. The act it needs is loading the save, which
    // is the tile's own Load and is already there.
    case 'off': case 'busy': case 'wait': break;
    case 'bad': {
      // THE PRE-MERGE AUDIT (0927b B1): TRY AGAIN IS THE ACT THAT FAILED. It was always a push - so a restore that failed
      // (a dropped connection, a full store) left one press that put the older save over the newer backup, the very
      // loss the restore exists to prevent. A push over a newer backup asks twice here too, as it does on the line.
      const act = cloudWhy?.slot === slot ? cloudWhy.act : 'push';
      if (act === 'restore') {
        if (restore && newerBackup(card, save.dateAndTime)) line.actions.push({ label: 'Try again', onClick: () => restoreBackup(save, card) });
      } else if (act === 'delete') line.actions.push({ label: 'Try again', onClick: () => removeBackup(save) });
      else if (newerBackup(card, save.dateAndTime)) line.actions.push(guardedPush(save, 'Try again'));
      else line.actions.push({ label: 'Try again', onClick: () => backUp(save) });
      break;
    }
    case 'saved':
      line.actions.push({ label: 'Back up again', onClick: () => backUp(save) });
      // ═══ AUDIT-312 F1: THE DELETE HAD NO DOOR ═══════════════════
      //
      // The route existed (DELETE /v1/saves/…), `removeCloudSlot`
      // existed, and NOTHING CALLED EITHER - while the refusal table
      // already told a player at the bound to "delete a save there to
      // make room". An account at SAVES_MAX could never back up again
      // and the only sentence it was given named an act the game did
      // not offer.
      //
      // IT SAYS `backup`, because the tile ALREADY has a Delete - the
      // pane's own, which removes the save from this device. Two
      // buttons reading `Delete` one row apart, one destroying the game
      // and one destroying the copy of it, is the worst label in this
      // menu. Measured on the sheet rather than argued about.
      //
      // AND IT ASKS TWICE, because this is the one button here that
      // destroys anything. The armed slot is cleared by the press, by
      // arming a different tile, and by the next visit to the menu.
      line.actions.push(cloudArm === slot
        ? { label: 'Delete backup?', primary: true, onClick: () => removeBackup(save) }
        : { label: 'Delete backup', onClick: () => { cloudArm = slot; render(); } });
      break;
    case 'newer':
      // ═══ FIELD 2026-09-27 (Masta_Fu): A NEWER BACKUP CAN COME BACK ═══
      //
      // His Mac backed up a later save of the slot his PC holds. This
      // tile read "Backed up" and its one upload button pushed the PC's
      // OLDER save over the Mac's newer one; nothing could bring the
      // newer one down, because a download was offered only for a save
      // with no local slot at all.
      //
      // RESTORE REPLACES THIS DEVICE'S COPY, so it asks twice, as Delete
      // backup does - and `pullSlot` removes the older copy only once the
      // backup is in the store. BACK UP AGAIN asks twice here too: it
      // would put the older save over the newer. The restore is a
      // download, so it lives where ACC2c put downloads - the Load pane;
      // the others still name the newer backup and guard the upload.
      if (restore) {
        line.actions.push(cloudArm === `restore|${save.key}`
          ? { label: 'Replace with backup?', primary: true, onClick: () => restoreBackup(save, card) }
          : { label: 'Restore backup', primary: true, onClick: () => { cloudArm = `restore|${save.key}`; render(); } });
      }
      line.actions.push(guardedPush(save, 'Back up again'));
      break;
    default:   // 'none'
      line.actions.push({ label: 'Back up', onClick: () => backUp(save) });
  }
  return line;
}

/** FIELD 2026-09-27: the upload over a NEWER backup, asked twice - it is the one press that loses the newer game.
 *  Armed by this LOCAL copy's key (the pre-merge audit 0927b B5): two local copies of one slot are two presses. */
function guardedPush(save, label) {
  return cloudArm === `push|${save.key}`
    ? { label: 'Replace newer backup?', onClick: () => { cloudArm = null; backUp(save); } }
    : { label, onClick: () => { cloudArm = `push|${save.key}`; render(); } };
}

/** THE PLAYER'S OWN ACT. Nothing uploads by itself (bible ACC2 D6): an
 *  upload inside the save path would put a network call in the one
 *  operation this game must never fail, and a backup that happens
 *  invisibly is a backup whose failure is also invisible. This is the
 *  surface that can show it failing. */
function backUp(save) {
  runCloud(save, (io) => pushSlot(io, appStorage(), save.key), 'push');
}

/** ...AND THE PLAYER'S OWN DELETE (AUDIT-312 F1). It removes the COPY
 *  and never the save: `removeCloudSlot` does not touch this device's
 *  store, because the cloud is a backup and deleting a backup is not
 *  deleting a game. It is the one act here that destroys anything, so
 *  `cloudFor` arms it on a first press and only the second one calls
 *  this. */
function removeBackup(save) {
  cloudArm = null;
  runCloud(save, (io) => removeCloudSlot(io, { characterId: save.characterId, saveName: save.saveName }), 'delete');
}

/** FIELD 2026-09-27 — THE PLAYER'S RESTORE of a newer backup over this
 *  device's older copy, on the second press. The backup arrives by SP1's
 *  law as its own slot and `pullSlot` then removes the copy it replaces
 *  (`replaces`), so a download that fails leaves this save untouched. */
function restoreBackup(save, card) {
  cloudArm = null;
  // the slot AS DRAWN (the pre-merge audit 0927b B3): a copy saved again since - another tab, a quicksave - is kept
  const replaces = { key: save.key, gameTime: save.dateAndTime?.gameTime, realTime: save.dateAndTime?.realTime };
  runCloud(save, (io) => pullSlot(io, appStorage(), card, { replaces }), 'restore');
}

/** ═══ ACC2c — THE DOWNLOAD, AND THE ONLY DOOR BACK ═════════════════
 *
 *  ACC2 built the backup and nothing could read one back. `pullSlot`
 *  was written and pinned end to end against the real service and had
 *  ZERO CALLERS, because a cloud card only ever reached a player as the
 *  cloud LINE on a local tile - and a card with no local tile has no
 *  line to appear on. A cleared browser or a second device showed an
 *  empty save list with the player's games three feet away in R2.
 *
 *  It goes through `runCloud` like the other two, so a download is busy
 *  under its own slot and a refusal is the service's own word under it.
 *  `pullSlot` answers `{ ok: true, skipped: true }` for a save the
 *  store already holds, which is SP1's law and not a failure - the
 *  listing is re-asked either way and the tile leaves this grid for the
 *  one above it. */
function download(card) {
  runCloud(card, (io) => pullSlot(io, appStorage(), card), 'download');
}

/** The cloud line for a card with NO save under it. Its own function
 *  rather than an argument to `cloudFor`, because every rung of that
 *  ladder is a question about a local slot and none of them can be
 *  asked here; the decision is still `cloudStateOf`'s, which takes
 *  `local: false` and keeps the two acts a download can be in. */
function cloudForCard(card) {
  const slot = slotKeyOf(card);
  const state = cloudStateOf({
    signedIn: true,   // a card only reaches this surface through a listing, which needs a session
    card,
    local: false,
    busy: cloudBusy === slot,
    error: cloudWhy?.slot === slot ? cloudWhy.error : null,
    nowS: Math.floor(Date.now() / 1000),
  });
  const line = { state: state.state, when: state.when, why: state.error ? cloudRefusalText(state.error) : null, actions: [] };
  // THE DELETE BELONGS HERE TOO, and this is the rest of AUDIT-312 F1
  // rather than a new idea: F1 gave a player the way to act on "delete
  // a save there to make room" and gave it to them on LOCAL tiles only,
  // so a cloud-only slot went on holding its share of SAVES_MAX with no
  // surface that could ever free it. Same word, same two presses.
  if (state.state === 'only') {
    line.actions.push(cloudArm === slot
      ? { label: 'Delete backup?', primary: true, onClick: () => removeBackup(card) }
      : { label: 'Delete backup', onClick: () => { cloudArm = slot; render(); } });
  }
  return line;
}

/** ONE LADDER FOR BOTH ACTS, because a push and a delete differ only in
 *  the call: busy under this slot, the service's own word under this
 *  slot when it refuses, and THE LISTING ASKED AGAIN rather than
 *  patched when it does not - one answer about what the cloud holds,
 *  and it comes from the cloud. */
function runCloud(save, call, act = 'push') {
  const io = cloudIo({ fetch: (...a) => globalThis.fetch(...a), storage: appStorage() });
  if (!io) return;
  const slot = cloudKeyOf(save);
  cloudBusy = slot;
  cloudWhy = null;
  render();
  call(io).then((r) => {
    cloudBusy = null;
    // THE WORD, NOT THE SENTENCE. `cloudFor` asks accountClient.js for
    // the sentence at paint time, so a refusal held over a repaint
    // cannot drift out of step with the one table that owns it.
    // a STALE refusal (0927b B2) is the listing's fault, so it is asked again too
    if (r.ok || r.error === 'stale') { cloudAsked = false; ensureCloud(); }
    if (!r.ok) cloudWhy = { slot, key: save?.key, error: r.error, act };
    render();
  }).catch(() => { cloudBusy = null; render(); });
}

/** One save, as a tile - the face asked for lazily, the cloud line
 *  where there is an account, and the pane's own actions. */
function tileOf(save, { actions, current = false, restore = false }) {
  return saveTile(document, save, {
    actions,
    cloud: cloudFor(save, { restore }),
    // The face is a PROMISE and the tile draws without it: a list that
    // waited on ten CIF reads is a menu that opens late.
    face: loadFace(save, { scale: 2, copy: true }),
    current,
  });
}

/** Every slot as tiles, in one grid. */
function tileGrid(saves, forSave) {
  ensureCloud();
  const grid = el('div', 'svgrid');
  for (const save of saves) grid.append(tileOf(save, forSave(save)));
  return grid;
}

/** ACC2c — the saves that are ONLY in the cloud, as tiles of their own,
 *  or null where there are none.
 *
 *  A SEPARATE GRID UNDER A HEADING, not mixed into the one above. These
 *  are not slots on this device: nothing can load one, nothing can
 *  overwrite one, and the Save pane's `current` edge means nothing
 *  about one. Sorting them into the same grid would put four tiles in a
 *  row of which two answer a different set of buttons, and a player
 *  would learn the difference by pressing.
 *
 *  THE SET DIFFERENCE IS `cloudOnly`'s, in systems/cloudSaves.js, for
 *  AUDIT-312 F3's reason: this file is DOM and a boot, and arithmetic
 *  about what a player's own backup holds is arithmetic a pin must be
 *  able to drive. */
function cloudOnlyGrid(saves) {
  const cards = cloudOnly(cloudCards, saves);
  if (!cards.length) return null;
  const box = el('div', 'svcloudonly');
  box.append(el('h4', null, cards.length === 1 ? 'One save is only in your backup' : `${cards.length} saves are only in your backup`));
  // THE ONE LINE OF PROSE THIS GRID GETS, because without it the
  // heading is a statement and not an instruction: a player looking at
  // a character they cannot press Load on needs to be told what the
  // button does before they press it.
  box.append(el('p', 'meta', 'Download one to bring it back to this device.'));
  const grid = el('div', 'svgrid');
  for (const card of cards) {
    grid.append(saveTile(document, saveFromCard(card, dateFromClassicMinutes, dateString), {
      cloud: cloudForCard(card),
      // NO FACE, AND NOT A BUG. Nothing about a portrait was ever
      // uploaded (server-account/src/saves.js keeps eleven columns and
      // none of them is a look), so the well draws the character's
      // initial - TILE1's own no-face arm, reached honestly.
      actions: [{
        label: 'Download',
        primary: true,
        disabled: cloudBusy === slotKeyOf(card),
        onClick: () => download(card),
      }],
    }));
  }
  box.append(grid);
  return box;
}

function savedGame() {
  let entry = null;
  try { entry = mostRecentRestorable(); } catch { entry = null; }
  if (!entry) return null;
  const snap = entry.snap;
  const date = Number.isFinite(snap.classicMinutes) ? dateFromClassicMinutes(snap.classicMinutes) : null;   // AUDIT LIVED1 E (S5/U4's card; AUDIT LIVED1b T13 corrected the cite): a card is a LOCAL slot's, and a local slot plays offline on its one clock - the date it loads at, as the classic window and the cloud cards say
  return {
    key: entry.key,
    name: snap.name || 'Unnamed',
    career: snap.career?.name ?? null,
    level: snap.level ?? null,
    health: snap.health, maxHealth: snap.maxHealth,
    // AUDIT 58: THE PURSE IS A COUNTER, NOT AN ITEM. E4 moved gold onto
    // GoldPieces (`data.playerEntity.goldPieces = entity.GoldPieces`,
    // SerializablePlayer.cs:133 - systems/save.js's snapshotPlayer
    // writes snap.goldPieces beside the collections), and restorePlayer
    // SPLICES every Currency row out of a pre-E4 envelope's item list.
    // Scanning snap.items for a gold-named row therefore never
    // matched on any post-E4 save, save.gold was always null, and
    // stats() drops a null outright - so the Continue and Save cards
    // silently lost their whole Gold row. Every other reader in the
    // tree asks the counter (ui/enhancedInventory.js's goldPiecesOf).
    // Null is kept for a pre-E4 envelope that has no field, which draws
    // the card without a bogus 0.
    gold: snap.goldPieces ?? null,
    when: date ? dateString(date) : null,
    hour: date ? `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}` : null,
    chargenDone: snap.chargenDone !== false,
  };
}

// THE SAVED GAME'S OWN LINE AND ITS NUMBERS, written once. FOUR
// panes now draw the same single slot - Continue, Load, Save and Exit
// - and four hand-rolled copies of "career, level, date, time" is how
// they come to disagree about which of those a player is shown. Both
// helpers are lifted verbatim out of paneContinue, so that pane draws
// exactly what it drew before.
const saveLine = (save) => [save.career, save.level ? `level ${save.level}` : null,
  save.when, save.hour].filter(Boolean).join(' · ');

const saveStats = (save) => [
  ['Health', save.maxHealth ? `${save.health} / ${save.maxHealth}` : save.health],
  ['Gold', save.gold != null ? save.gold.toLocaleString() : null],
];

function stats(pairs) {
  const dl = el('dl', 'stats');
  for (const [k, v] of pairs) {
    if (v == null) continue;
    dl.append(el('dt', null, k), el('dd', null, String(v)));
  }
  return dl;
}

function acts(list) {
  const wrap = el('div', 'acts');
  for (const a of list) {
    const b = el('button', a.primary ? 'act primary' : 'act', a.label);
    if (a.disabled) b.disabled = true;
    if (a.onClick) b.onclick = a.onClick;
    wrap.append(b);
  }
  return wrap;
}

/** A section that is set up but not yet backed. Shown, never hidden. */
function empty(title, line) {
  const e = el('div', 'empty');
  e.append(el('h3', null, title));
  e.append(el('p', null, line));
  return e;
}

// ── THE CONFIRM ──────────────────────────────────────────────────
// AUDIT F3/F4. Two destructive actions shipped without one: Reset
// wiped every override on a single press (the CLASSIC screen has
// always confirmed - settingsWindow's 'r' arm) and Delete did nothing
// at all, drawn undimmed and operable-looking, because onAction caught
// it and returned. A button that looks operable and is not is the
// thing the anti-lie law forbids; a destructive one that does not ask
// is worse.
let confirming = null;   // { title, body, label, onYes }

function confirmCard() {
  const c = el('div', 'card');
  c.append(el('h3', null, confirming.title));
  c.append(el('p', 'meta', confirming.body));
  c.append(acts([
    { label: confirming.label, primary: true, onClick: () => { const f = confirming.onYes; confirming = null; f(); render(); } },
    { label: 'Cancel', onClick: () => { confirming = null; render(); } },
  ]));
  return c;
}

const ask = (title, body, label, onYes) => { confirming = { title, body, label, onYes }; render(); };

/** ONE LINE. It carried a kicker, a title and a blurb - the rail's own
 *  word said three times before the player reaches anything pressable. */
const head = (title) => {
  const h = el('div', 'head');
  h.append(el('h2', null, title));
  return h;
};

// ── CONTINUE ─────────────────────────────────────────────────────
// The first entry, and the one classic does not have at all: classic
// opens on Load Game, which is a filing cabinet, when what a returning
// player wants is the ONE save they were just in. Skyrim's Continue is
// the whole reason its menu feels shorter than Daggerfall's, and it
// costs nothing here - the slot is already the only slot.
function paneContinue(body) {
  const save = savedGame();
  if (!save) {
    body.append(empty('No game in progress', 'Quicksave with F9 and it appears here.'));
    body.append(acts([{ label: 'Start a new game', primary: true, onClick: () => go('new') }]));
    return;
  }
  const c = el('div', 'card');
  c.append(el('h3', null, save.name));
  c.append(el('p', 'meta', saveLine(save)));
  c.append(stats(saveStats(save)));
  c.append(acts([{ label: 'Continue', primary: true, onClick: () => onAction('continue') }]));
  body.append(c);
}

// ── NEW GAME ─────────────────────────────────────────────────────
// The three Startup keys are REAL and live here rather than buried in
// settings, because they are questions about the game you are about to
// start and nowhere else. StartInDungeon in particular is the answer
// to "do I begin in Privateer's Hold" - a new-game question wearing a
// settings key's clothes (systems/settings.js:94-99).
function paneNew(body) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'A new character'));
  c.append(el('p', 'meta', 'Race, class, biography, face, skills.'));
  c.append(acts([{ label: 'Begin', primary: true, onClick: () => onAction('new') }]));
  body.append(c);

  const opts = el('div', 'card');
  opts.append(el('h3', null, 'Where you wake up'));
  for (const key of ['Startup/StartInDungeon', 'Startup/StartCellX', 'Startup/StartCellY']) {
    put(opts, settingRow(key, { compact: true }));
  }
  body.append(opts);
}

// ── BEGIN (classic skin) ─────────────────────────────────────────
// FD1: the one game door the classic rail has. It resolves 'begin' and
// main.js runs the classic start sequence behind it - the data gate,
// the splash, the title, Daggerfall's start window with its own Load
// Game / Start New Game / Exit - so nothing classic is lost and no
// enhanced screen stands between the player and it.
function paneBegin(body) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Daggerfall'));
  c.append(el('p', 'meta', 'The classic start: the title, the intro and Daggerfall\u2019s original menu (Load Game, Start New Game, Exit).'));
  c.append(acts([{ label: 'Begin', primary: true, onClick: () => onAction('begin') }]));
  body.append(c);
}

// ── TEST ROOM ────────────────────────────────────────────────────
// TR3: pick a prebuilt character, walk into the ordinary world with
// the whole armory in your pack. The presets live in systems/
// testRoom.js - ONE home the route (main.js) and the boot (world.js)
// also read; this pane only shows them. Each card is a door: pressing
// it IS the boot, the same shape Continue's card takes.
function paneTest(body) {
  const intro = el('div', 'card');
  intro.append(el('h3', null, 'The test room'));
  intro.append(el('p', 'meta',
    'A prebuilt character in the ordinary world, with one of every weapon, a full suit of '
    + 'armor across materials, all four shields and a change of clothes already in the pack. '
    + 'Equip through the inventory as usual; the paperdoll, the sprite weapons and - with '
    + 'Morrowind data attached - the first- and third-person body all follow the equip table '
    + 'live. Scroll to switch views. Nothing here is saved over your real game.'));
  body.append(intro);
  for (const p of TEST_PRESETS) {
    const c = el('div', 'card');
    c.append(el('h3', null, p.label));
    c.append(el('p', 'meta', p.blurb));
    c.append(acts([{ label: `Enter as the ${p.label}`, primary: true, onClick: () => onAction(`test:${p.id}`) }]));
    body.append(c);
  }
  // TSR4: the ride - one more door through the SAME `test:<id>` choice,
  // the entry resolved by testRoom's testEntryById at the boot.
  const ride = el('div', 'card');
  ride.append(el('h3', null, TEST_RIDE.label));
  ride.append(el('p', 'meta', TEST_RIDE.blurb));
  ride.append(acts([{ label: 'Ride out', primary: true, onClick: () => onAction(`test:${TEST_RIDE.id}`) }]));
  body.append(ride);
  // FIELD BUGS 2026-09-29 (the sea) #5 (Mac: "Add a ship combat test menu option"): the sea battle - the same
  // `test:<id>` door, a helm on the open Bay and a pirate standing in (systems/testRoom.js TEST_SEA)
  const sea = el('div', 'card');
  sea.append(el('h3', null, TEST_SEA.label));
  sea.append(el('p', 'meta', TEST_SEA.blurb));
  sea.append(acts([{ label: 'Set sail', primary: true, onClick: () => onAction(`test:${TEST_SEA.id}`) }]));
  body.append(sea);
  // LR3: the loot ladder - one of everything Loot rarity can mint, in
  // the pack, through the same `test:<id>` door.
  const loot = el('div', 'card');
  loot.append(el('h3', null, TEST_LOOT.label));
  loot.append(el('p', 'meta', TEST_LOOT.blurb));
  loot.append(acts([{ label: 'Enter with the ladder', primary: true, onClick: () => onAction(`test:${TEST_LOOT.id}`) }]));
  body.append(loot);
  // FT12 (Mac, 2026-09-14: "move the test the outdoors to the test room
  // tab"): the outdoors test door lives with the other test doors. It
  // was the last row of the Enhanced category of Settings, which is off
  // the rail now - every switch it held is the Features home's.
  const outdoors = el('div', 'card');
  outdoors.append(el('h3', null, 'The outdoors'));
  outdoors.append(outdoorsTestRow());
  body.append(outdoors);
}

// ── LOAD GAME ────────────────────────────────────────────────────
// ═══ ACC1f: THE ACCOUNT LIVES ON THE FRONT DOOR ═══════════════════
//
// Mac: "I want [the Online pane] reserved for a detailed tile based
// design for your saves... The online details itself will live as a
// popup on main menu startup and a new profile icon."
//
// ACC1e put the card at the head of the Online pane. That pane is
// being reserved for the character tiles, so the card moves to the
// door: a window over the pixel home, offered ONCE at startup when
// nobody is signed in, and reachable any time from the profile mark.
//
// THE OFFER IS NOT A GATE. It is shown only to a device with no
// session, it closes on a tap outside exactly as the pause window
// does, and nothing behind it is blocked - ACC0's wall is at cloud
// saves and every door on this screen works without an account.
//
// ONCE PER VISIT, not once per render. `renderHome` runs again on
// every skin switch, every Escape and every repaint, and a window
// that reopened each time would be a window a player cannot get past.
// `accountOffered` latches on the first offer.
function accountBody() {
  const host = el('div', 'acctmount');
  let card = null;
  const flow = AccountFlow({
    io: { fetch: (...a) => globalThis.fetch(...a), base: serviceBase(appStorage()) },
    storage: appStorage(),
    onChange: () => card?.paint(),
  });
  card = accountCard(document, flow, { onClose: () => { accountOpen = false; render(); } });
  host.append(card.root);
  // Not awaited: the door must be on screen before the service is
  // asked anything, and `start` catches its own refusals. The guard is
  // the belt for a bug in it - a throw here would take the door with it.
  Promise.resolve(flow.start()).catch(() => {});
  return host;
}

/** Is there a session on this device? A storage read, no network - so
 *  the door can decide whether to offer the window without waiting on
 *  anything, which is what makes opening the menu on a train work. */
const signedIn = () => !!storedSession(appStorage());

/** The profile mark, top-right of the door - the corner About does not
 *  use. It says who you are when it knows, and offers the way in when
 *  it does not. PROFILE1 (Mac: "more like a profile icon less like a
 *  button"): a PORTRAIT - the last character's face (ui/profileBadge.js),
 *  asked for as a promise so the door never waits on a CIF read. */
function profileMark() {
  const who = storedSession(appStorage());
  // PROFILE2: paused, the portrait is the character being PLAYED (the newest save may be another's)
  const save = mode === 'pause' ? liveCharacter(playerEntity) : newestPortraitSave();
  return profileBadge(document, {
    session: who,
    save,
    face: save ? loadFace(save, { scale: 2, copy: true }) : null,   // a COPY: the Continue pane's tile may draw this very face
    onOpen: () => { accountOpen = true; render(); },
  });
}

/** The window itself, wearing the pause window's own frame. */
function accountWindow() {
  const win = el('div', 'px-win px-acctwin');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
  const body = el('div', 'px-body');
  body.append(accountBody());
  body.append(skinCard(document).root);   // DISC23-B2 (Mac: "a choosable skin system in the menu player profile system itself"): who you are drawn as, beside who you are
  win.append(body);
  return win;
}

// ONLINE1 (2026-09-12, Mac: "add an option to the menu labeled online
// which allows you to bring your own developed character into a
// massive server"): THE ONLINE DOOR. The most recent save is the
// character brought in (the same card Load shows); a name for over the
// head and the relay to join ride the prefs shelf. The action boots
// the world host with ?online beside ?load (main.js).
function paneOnline(body) {
  // ═══ ACC1h: THE PANE IS THE TILES ══════════════════════════════════
  //
  // Mac: "So the online pane should just be the new save panels,
  // correct?" - and he had said it once already, when ACC1f moved the
  // account card off this pane: "I want [the Online pane] reserved for
  // a detailed tile based design for your saves."
  //
  // It was not. It carried a heading, a paragraph of prose about what a
  // shared world shares, a text field for a name, a Relay field and a
  // line telling the player to pick a character. ACC1g took the name
  // field; this takes the rest, and what is left is the thing the pane
  // was reserved for.
  //
  // WHERE EACH PIECE WENT, because none of it was deleted for tidiness:
  //
  //   the shared-world prose  -> 11-Multiplayer/Multiplayer.md, which
  //       is where the law it describes is written down. A wall of text
  //       above a row of tiles is read once and skipped for ever; the
  //       promises in it are the RELAY's and are pinned there.
  //   the Relay field         -> BELOW the tiles, quiet. It is an
  //       override for pointing at a test relay and it is not a thing
  //       to meet on the way in - but it is the only way to set the
  //       pref `scenes/world.js` still reads, so deleting it would
  //       leave a read nothing can answer. Settings is where it
  //       belongs; `ui/settingsMap.js` has no free-text row kind yet,
  //       and inventing one inside this change is how a diff stops
  //       being reviewable.
  //   the name field          -> gone with ACC1g. The account issues it.
  //
  // WHAT A TILE CANNOT SAY FOR ITSELF STAYS, and it is one line: why
  // the buttons are dead when nobody is signed in, and the way in. A
  // player looking at their own characters with every button greyed out
  // and no reason on screen is the fault this pane would otherwise have.
  const saves = savedGames();
  const who = storedSession(appStorage());
  if (!who) {
    const c = el('div', 'card');
    c.append(el('p', 'meta bad', 'Online needs an account, so no one else can use your name. Playing as a guest takes one click and no email.'));
    const go = el('button', 'act primary');
    go.type = 'button';
    go.textContent = 'Sign in or continue as guest';
    // THE WINDOW LIVES AT THE DOOR (ACC1f) and this sends the player
    // there rather than growing a second home for it here.
    go.onclick = () => { section = 'home'; accountOpen = true; render(); };
    c.append(go);
    body.append(c);
  }
  // REALM P1.3 (Mac: "A true separation while allowing people to still play offline"; bible/06-Systems/Realm-Arc.md):
  // THE REALM'S CHARACTERS COME FIRST. An online character's save is the service's, so this list is the service's -
  // asked once a visit - and a character is played from here and nowhere else.
  body.append(realmCard(who));
  if (!saves.length) {
    body.append(empty('No saved games', 'An offline character the realm knew before it opened can be brought in from here, once.'));
    body.append(onlineSyncCard());   // UXB1-E: the rules can come home before a character goes out
    return;
  }
  // REALM P1.5 (decision 3, "Migrate once via customs"): AN OFFLINE CHARACTER COMES IN ONCE. TILE2's tiles, with the
  // character's own face on them - and the press is customs, not a boot: the realm settles its loans and caps what it
  // carries (systems/realmCustoms.js) on a copy, the service makes the realm character, and it appears above to play.
  // The offline character stays exactly what it was.
  body.append(el('h4', null, 'Bring an offline character in (once)'));
  body.append(tileGrid(saves, (save) => ({
    current: false,
    actions: [{
      // AUDIT SET D4: a Test Room character's button says why it is dead (the boot refuses it whatever door it comes by)
      label: save.testRoom ? 'Test Room: offline only' : 'Bring online',
      // ACC1g: signed out is a DEAD button with the reason one card up,
      // not a live one that fails at the service.
      disabled: !who || save.testRoom,
      onClick: () => { if (!realmBusy) bringOnline(save); },
    }],
  })));
  const field = (label, key, placeholder, maxLength) => {
    const wrap = el('label', 'field');
    wrap.append(el('span', 'fieldlabel', label));
    const input = el('input');
    input.type = 'text'; input.maxLength = maxLength; input.placeholder = placeholder; input.value = getPref(key) || '';
    input.oninput = () => setPref(key, input.value.trim());
    wrap.append(input);
    return wrap;
  };
  // AUDIT WORLD34 D5: AND THE PROMISE STAYS ON THE PAGE. What a player
  // is told here is the law, and the pins that hold this sentence
  // against the relay's own behaviour are the reason it says true
  // things - it once said "Nothing else is shared yet", which WORLD1
  // had already made false. So it moves BELOW the tiles rather than
  // going: the pane opens as the characters, and the rules a player is
  // agreeing to are still on the surface they enter through, where a
  // page in the bible cannot reach them.
  const foot = el('div', 'card svonlinefoot');
  foot.append(el('p', 'meta', 'Everyone plays their own save, and you can see and talk to each other anywhere. Dungeons and buildings are shared: enemies, doors, levers and every chest, shelf or cupboard someone has opened are the same for everyone, and stay that way. In towns and the wilds you share who is around: what one player meets, everyone nearby sees and can fight, and those monsters can hurt you too. ' + skyDayWords() + ' The world\u2019s clock and sky run on real time: resting, travelling, jail time or training don\u2019t move them, so a quest that waits for a time of day waits for the world\u2019s, and a full moon holds a lycanthrope for its night alone. Your character also keeps their own time: it runs while you play, resting, travelling, jail time and training use it, and it stops while you are logged off. Your wounds, spells, hunger, diseases, curses, guild ranks, rented rooms, loans and repairs run on it. Quest timers run on the world\u2019s clock while you play: resting, waiting and travelling don\u2019t spend a quest\u2019s days, and time logged off never counts. A quest that only makes you wait - a letter, a meeting, \u201ccome back in a few days\u201d - moves on after a couple of minutes of play. You rest at a fire, a tent or a bed: a night passes at once, at most once every ten minutes of play, and your party within 15 metres sleeps it with you. Every enhancement is on for everyone in the shared world, but your UI is your own, with chat, friends, the party and trading in their own panels. Most mods stay your choice online. A few are the room\u2019s: the ones that change the ground, the ones that change monsters and loot, and the rules everyone plays by. The Mods page marks each one.'));   // AUDIT WORLD5 C12: the shared clock, said at the door; OL1: the lane, said at the door; QCLOCK-WORLD: the quests' clock; REST8: the short wait; REST9: the rest act and the party's night
  foot.append(field('Relay', 'onlineServer', DEFAULT_SERVER, 200));
  body.append(foot);
  body.append(onlineSyncCard());   // UXB1-E: under the rules it copies
}

/** REALM P1.3: THE REALM CARD - the account's online characters as tiles (the service's list, asked once a visit), each
 *  played, copied to offline or deleted from here; a new one born online; and what the last act said. */
function realmCard(who) {
  const box = el('div', 'svrealm');
  box.append(el('h4', null, 'Your online characters'));
  for (const w of realmWords) box.append(el('p', 'meta', w));
  if (!who) return box;
  if (!realmAsked) {
    realmAsked = true;
    realmList(realmIo({ fetch: (...a) => globalThis.fetch(...a), storage: appStorage() })).then((r) => {
      realmRows = r.ok ? r.characters : [];
      if (r.ok) sweepUnsent(appStorage(), r.characters, storedSession(appStorage())?.id ?? null);   // AUDIT RESCUE-SAVE A7 + 2 B5: a copy no join can play goes
      realmMax = r.ok ? r.max : 0;
      if (!r.ok) realmWords = [...realmWords, realmRefusalText(r.error)];
      render();
    }).catch(() => {});
  }
  if (realmRows == null) { box.append(el('p', 'meta', 'Asking the realm...')); return box; }
  if (realmRows.length) {
    const grid = el('div', 'svgrid');
    for (const row of realmRows) {
      const save = realmRowAsSave(row, { dateText: (sec) => new Date(sec * 1000).toLocaleDateString() });
      grid.append(saveTile(document, save, {
        face: loadFace(save, { scale: 2, copy: true }),
        actions: [
          { label: save.unfinished ? 'Never saved' : 'Play', primary: true, disabled: realmBusy || save.unfinished, onClick: () => { _pickedRealmId = row.id; onAction('online'); } },
          { label: 'Copy to offline', disabled: realmBusy || save.unfinished, onClick: () => copyToOffline(row) },
          // HOUSE-LOSS (2026-09-29, Mac: "GarySoup lost his house and furniture"): a character brought in whose first save
          // never landed is UNDONE, never deleted - its delete took the home customs had carried, and it could never come
          // in again. The undo gives back its home, its guild place and its customs (realm.js undoRealm).
          row.customs && save.unfinished ? { label: 'Undo bringing in', disabled: realmBusy, onClick: () => ask(`Undo bringing ${row.name} in?`, `${row.name} never finished coming into the realm - its first save never landed. Undoing takes it out and gives everything back: its home, its guild place and its one customs, so the offline character can be brought online again. To finish instead, press Bring online on it below.`, 'Undo', () => realmAct(() => realmUndo(realmIoNow(), row.id), [`${row.name} is out of the realm and customs is undone: its home and guild place are back with the offline character. Bring it online again when you are ready.`])) }
            : { label: 'Delete character', disabled: realmBusy, onClick: () => ask(`Delete ${row.name}?`, 'An online character deleted is gone from the realm for good - its Renown, its professions and their Stores, its home and its guild place with it. A copy you made offline stays.', 'Delete', () => realmAct(() => realmDelete(realmIoNow(), row.id), [`${row.name} is gone from the realm.`])) },
        ],
      }));
    }
    box.append(grid);
  } else box.append(el('p', 'meta', 'No online characters yet. Make one, or bring one of yours in below.'));
  box.append(acts([{ label: 'New online character', primary: !realmRows.length, disabled: realmBusy || realmRows.length >= realmMax, onClick: () => onAction('online-new') }]));
  return box;
}
const realmIoNow = () => realmIo({ fetch: (...a) => globalThis.fetch(...a), storage: appStorage() });
/** One realm act at a time: busy while it runs, its words (or its refusal) shown after, and the list asked again. */
function realmAct(run, words) {
  realmBusy = true; render();
  return Promise.resolve().then(run).then((r) => {
    realmWords = r?.ok === false ? [realmRefusalText(r.error)] : (typeof words === 'function' ? words(r) : words);
  }).catch(() => { realmWords = [realmRefusalText('server')]; }).finally(() => { realmBusy = false; realmAsked = false; realmRows = null; render(); });
}
/** REALM P1.5: CUSTOMS, ASKED FIRST (FIELD 2026-09-29, Dracula/Valentin: "HOW TF WAS I SUPPOSED TO KNOW YALL WOULD FORCE
 *  THE LOANS TO BE PAID"). Customs is once, so the press says what it will do - customs run on a copy of the save,
 *  nothing sent (systems/realmCustoms.js customsLines, `before`) - and runs it on the answer. A press customs would
 *  refuse before the service (signed out, no save, no id, a Test Room character) goes straight on and says so. */
function bringOnline(save) {
  const snap = realmIoNow() ? loadSlot(save.key) : null;
  if (!snap || typeof snap.characterId !== 'string' || !snap.characterId || snap.testRoom === true) return customsNow(save);
  const trial = JSON.parse(JSON.stringify(snap));
  const leveling = crossLeveling(trial);   // LEVEL-ONLINE: a Daggerfall-levelling character comes in on Oblivion's bar - said first
  const preview = [...(leveling ? [LEVELING_CROSS_LINE.before] : []), ...customsLines(applyCustoms(trial), { before: true })];
  return ask(`Bring ${save.name} online?`, preview.join(' '), 'Bring online', () => { customsNow(save); });
}
/** REALM P1.5: CUSTOMS - the local save read, customs applied to a COPY (the offline character is untouched), the realm
 *  character made from it once (the service refuses one never online, and a second try), its first save the copy. */
function customsNow(save) {
  return realmAct(async () => {
    const io = realmIoNow();
    if (!io) return { ok: false, error: 'signed-out' };
    const snap = loadSlot(save.key);
    if (!snap) return { ok: false, error: 'no-data' };
    if (typeof snap.characterId !== 'string' || !snap.characterId) return { ok: false, error: 'customs-load-once' };
    if (snap.testRoom === true) return { ok: false, error: 'test-room' };   // AUDIT SET D4's law: the room's characters play offline
    const copy = onlineCopyOf(snap, sharedClassicMinutes(Date.now()));   // AUDIT LIVED1 G: the world's stamps onto the shared clock, and the world's minute it joins at
    const leveling = crossLeveling(copy);   // LEVEL-ONLINE: a new online character levels the Oblivion way (the offline one keeps its own)
    const report = applyCustoms(copy);
    const made = await realmCustoms(io, snap.characterId, copy.name || save.name, realmSummaryOf(copy));
    if (!made.ok) return made;
    copy.characterId = made.data.id;
    const put = await realmPut(io, made.data.id, { lease: made.data.lease, seq: 1, summary: realmSummaryOf(copy) }, JSON.stringify(copy), { gzip: made.data.gzip === true });   // REALM-GZIP: a long offline life comes in packed
    return put.ok ? { ok: true, lines: [...(leveling ? [LEVELING_CROSS_LINE.after] : []), ...customsLines(report)] } : put;
  }, (r) => [...r.lines, `${save.name} is in the realm now. Play them from above.`]);
}
/** REALM P1.4: COPY TO OFFLINE - the realm's save read and written as a NEW offline character (a new id), a slot like
 *  any other. Nothing played on the copy ever goes back: the Online door loads only from the service. */
function copyToOffline(row) {
  return realmAct(async () => {
    const got = await realmFetch(realmIoNow(), row.id);
    if (!got.ok) return got;
    let snap = null;
    try { snap = JSON.parse(got.text); } catch { snap = null; }
    if (!snap || typeof snap !== 'object') return { ok: false, error: 'no-data' };
    snap = offlineCopyOf(snap);   // AUDIT LIVED1 E: the world's stamps rebased onto the character's clock, the one clock offline
    snap.characterId = mintCharacterId();
    const r = saveSlot(snap.name || row.name, 'Copied from the realm', snap, { storage: appStorage() });
    return r.ok ? { ok: true } : { ok: false, error: 'no-room' };
  }, [`${row.name} is copied to offline - a new offline character. Nothing played on it comes back to the realm.`]);
}

// UXB1-E (2026-09-25, the UX backlog: "Add a 'sync from server' option so players can ensure their offline play
// matches the host they prefer to play on if they want."): THE ROOM'S RULES, OFFLINE. The copy and its undo are
// systems/onlineSync.js's; this is the card - what differs, the one press, and the way back. Every relay plays by
// the same rules (they are this build's, not the server's), so there is no host to pick: the card says so.
export const ONLINE_SYNC_TITLE = 'Sync from server';
export const ONLINE_SYNC_NOTE = 'Play offline by the same rules as online. Some settings are fixed online; this sets yours to match. They are the same on every server, and everything else stays your choice.';
export const ONLINE_SYNC_SAME = 'Your offline game already plays by the online rules.';
const syncWord = (v) => (v === true || /^true$/i.test(String(v)) ? 'On' : v === false || /^false$/i.test(String(v)) ? 'Off' : String(v));
export function onlineSyncCard() {
  const card = el('div', 'card svsync');
  card.append(el('h3', null, ONLINE_SYNC_TITLE));
  card.append(el('p', 'meta', ONLINE_SYNC_NOTE));
  const plan = onlineSyncPlan() ?? [];
  const differ = plan.filter((r) => !r.same);
  const acts = el('div', 'acts');
  if (differ.length) {
    const list = el('ul', 'svsync-list');
    for (const r of differ) {
      const li = el('li', 'svsync-row');
      li.append(el('span', 'svsync-name', r.label), el('span', 'svsync-was', syncWord(r.offline)),
        el('span', 'svsync-arrow', '\u2192'), el('span', 'svsync-to', syncWord(r.online)));
      list.append(li);
    }
    card.append(list);
    const go = el('button', 'act primary svsync-go', `Sync ${differ.length} setting${differ.length === 1 ? '' : 's'}`);
    go.type = 'button';
    go.onclick = () => { applyOnlineSync(plan); render(); };
    acts.append(go);
  } else {
    card.append(el('p', 'meta svsync-same', ONLINE_SYNC_SAME));
  }
  const last = lastOnlineSync();
  if (last?.rows?.length) {
    const undo = el('button', 'act svsync-undo', 'Undo sync');
    undo.type = 'button';
    undo.title = `Puts back the ${last.rows.length} setting${last.rows.length === 1 ? '' : 's'} the last sync changed`;
    undo.onclick = () => { undoOnlineSync(); render(); };
    acts.append(undo);
  }
  if (acts.children.length) card.append(acts);
  return card;
}

function paneLoad(body) {
  // ONLINE-LOAD1: the same shape paneSave already uses for
  // savingPrevented - checked BEFORE canLoad below, so the "no load
  // door here" message never shows in place of the real reason during
  // a live online session.
  const locked = hooks.loadingPrevented?.();
  if (locked) {
    body.append(empty('Loading is disabled during online play.',
      'Leave the shared world to load a save; other players are relying on this session staying put.'));
    return;
  }
  // SLOTS1: EVERY restorable slot, most recent first - the classic
  // save window's list, as cards. The one pressed is the one loaded
  // (its key rides the boot from the front door, and the host's
  // loadKey seam from the pause door); Delete removes that slot alone.
  const saves = savedGames();
  // U51: in pause mode the LOAD arm is the HOST's, and two of the
  // four hand no quickLoad at all. No hook, no button - and the line
  // below says which it is rather than dimming a control with no
  // explanation attached to it.
  const canLoad = mode !== 'pause' || typeof hooks.quickLoad === 'function';
  // TILE2 (Mac: the tile design "will translate to the load character
  // pane also"): the same tiles the Online pane draws, with this
  // pane's own actions on them.
  body.append(tileGrid(saves, (save) => ({
    current: save.key === saves[0]?.key,
    restore: true,   // FIELD 2026-09-27: the pane that gets a game back is where a newer backup comes back
    actions: [
      // NO CONFIRM ON LOAD, in either mode. It discards unsaved play,
      // which is the shape AUDIT F3/F4 made confirm - but classic's
      // own pause window loads on one press (pauseWindow.js:346-348)
      // and so does F11, and inventing a prompt on exactly one of the
      // port's three load doors is a divergence, not a safety net.
      { label: 'Load', primary: true, disabled: !canLoad, onClick: () => { _pickedSaveKey = save.key; onAction('load'); } },
      // ...and the destructive one still asks, and takes THIS slot
      // alone.
      { label: 'Delete', onClick: () => ask(
        'Delete this save',
        `Deleting ${save.name}'s "${save.saveName}" cannot be undone.`,
        'Delete',
        () => { try { deleteSave(save.key); } catch { /* storage disabled */ } render(); },
      ) },
    ],
  })));
  // ACC2c: ...and under them, the saves that are only in the backup.
  // THIS PANE AND NO OTHER. Online brings a character in to play NOW
  // and a save that is not here cannot be brought in until it is
  // downloaded, so offering it there is a two-step act at a one-step
  // door; Save writes rather than reads, and a cloud-only slot in that
  // grid would be an Overwrite target for a game this device does not
  // have. Load's whole job is getting a game back, so it is the door.
  const onlyCloud = cloudOnlyGrid(saves);
  if (onlyCloud) body.append(onlyCloud);
  // AND "NO SAVED GAMES" IS FALSE WHEN THE ACCOUNT HAS SOME. The old
  // line ends "Save a game and every slot of it appears here", which
  // told a player with a shelf full of backups that they had none -
  // which is the very sentence this slice exists to stop being shown.
  if (!saves.length && !onlyCloud) body.append(empty('No saved games', 'Save a game and every slot of it appears here.'));
  if (mode === 'pause' && typeof hooks.quickLoad !== 'function') {
    body.append(empty('Not from here',
      'This part of the game has no load door. Reach a saved game from the main menu instead.'));
  }
  body.append(transferCard(saves.length));
}

// SP1 (2026-09-21, a player: "my saves its all gone"; Mac: "we need
// parity between browser and the install"): THE SAVES MOVE. The website
// keeps a save in the browser's storage for its origin and the app keeps
// the same save as files under its own folder, and nothing carried one
// to the other - a player who installed the app after playing on the
// site opened it to empty slots. Export writes every slot as one zip in
// the app's own on-disk layout; Import takes that zip, or a picked
// Saves folder, into whatever store is under this build. Neither
// overwrites a slot the store already holds (systems/saveTransfer.js).
let _transferNote = null;
function transferCard(count) {
  const c = el('div', 'card');
  c.append(el('span', 'tag grey', 'Move saves'));
  c.append(el('h3', null, 'Between the website and the app'));
  const shell = globalThis.daggerShell;
  c.append(el('p', 'meta', shell?.savesPath
    ? `This app keeps your saves as files in ${shell.savesPath}. Export them as one zip to carry to the website, or import a zip the website exported.`
    : 'The website keeps your saves in this browser. Export them as one zip to carry to the desktop app or another browser, or import a zip the app or another browser exported.'));
  if (_transferNote) { c.append(el('p', 'meta', _transferNote)); _transferNote = null; }
  const zipIn = el('input'); zipIn.type = 'file'; zipIn.accept = '.zip,application/zip'; zipIn.style.display = 'none';
  const dirIn = el('input'); dirIn.type = 'file'; dirIn.setAttribute('webkitdirectory', ''); dirIn.multiple = true; dirIn.style.display = 'none';
  const done = (slots, r) => {
    const n = r.imported.length;
    _transferNote = !slots.length ? 'No saves in that selection. Pick the zip an Export made, or a Saves folder holding SAVE0, SAVE1, ...'
      : `Imported ${n} save${n === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} already here` : ''}${r.failed ? `, ${r.failed} could not be written` : ''}.`;
    render();
  };
  zipIn.onchange = async () => {
    const f = zipIn.files?.[0]; if (!f) return;
    try {
      const { readZipEntries } = await import('../scenes/dataSource.js');   // the port's own reader, methods 0 and 8
      const slots = collectSlots(await readZipEntries(f, { pick: (names) => names.filter((n) => slotPathOf(n)) }));
      done(slots, importSlots(slots, appStorage()));
    } catch (err) { _transferNote = `Could not read ${f.name}: ${err?.message ?? err}`; render(); }
  };
  dirIn.onchange = async () => {
    const slots = collectSlots(await entriesFromFiles([...(dirIn.files ?? [])]));
    done(slots, importSlots(slots, appStorage()));
  };
  c.append(zipIn, dirIn);
  c.append(acts([
    { label: 'Export all saves', primary: true, disabled: !count, onClick: () => {
      const zip = exportSavesZip(appStorage());
      if (!zip) { _transferNote = 'Nothing to export.'; render(); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      a.download = TRANSFER_ZIP_NAME;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } },
    { label: 'Import a zip', onClick: () => zipIn.click() },
    { label: 'Import a Saves folder', onClick: () => dirIn.click() },
  ]));
  return c;
}

// ── SAVE GAME (pause only) ───────────────────────────────────────
// U51. Classic's SAVE button closes the window and then writes
// (pauseWindow.js:319-321, `this._closeWith(); ... this.hooks.quickSave?.()`),
// and this does the same for a reason that is not only parity: the
// port answers a write with a HUD LINE, and this screen is a fixed
// opaque div over the whole canvas, so a save that left the door open
// would put its own confirmation underneath itself.
//
// THE CARD SHOWS WHAT IS ABOUT TO BE OVERWRITTEN. There is ONE slot
// (systems/save.js, `dagger.quicksave`), so every save is an
// overwrite. Classic does not confirm one and neither does F9, so
// neither does this - but a player who can read the name and the date
// they are writing over has been told, which is the part classic
// never does.
function paneSave(body) {
  // IsSavingPrevented, the classic gate, verbatim - and the same
  // recovered string, because it is the game's own answer and not a
  // thing this screen gets to reword.
  const prevented = hooks.savingPrevented?.() || typeof hooks.quickSave !== 'function';
  if (prevented) {
    body.append(empty('You cannot save now.',
      'This part of the game holds no save door. Step back outside and the quicksave returns.'));
    return;
  }
  // SLOTS1 (Mac: "multiple save slots"): a save is (character, slot
  // name) - SaveLoadManager's own identity (systems/saveSlots.js
  // saveSlot). The name field says which slot; a name the character
  // already has OVERWRITES it and the card says so, a new name is a
  // new slot. The pressed name rides the pause door's quickSave
  // through takePickedSaveName, onto the host's saveAs seam.
  const me = hooks.playerName?.() ?? savedGame()?.name ?? '';
  const myId = hooks.playerId?.() ?? null;   // CHARID1: the slots the press can overwrite are THIS character's, by id - a namesake's are not
  const mine = savedGames().filter((s) => (myId ? s.characterId === myId : s.characterName === me));
  const c = el('div', 'card');
  c.append(el('span', 'tag', 'Save as'));
  c.append(el('h3', null, me || 'Your character'));
  const wrap = el('label', 'field');
  wrap.append(el('span', 'fieldlabel', 'Slot name'));
  const input = el('input');
  input.type = 'text'; input.maxLength = 32; input.placeholder = QUICK_SAVE_NAME; input.value = _saveNameDraft || QUICK_SAVE_NAME;
  wrap.append(input);
  c.append(wrap);
  // THE LINE SAYS WHAT THE PRESS DOES: the slot it overwrites, drawn
  // with the shared line and numbers, or that it is new
  const line = el('p', 'meta', '');
  const numbers = el('div');
  const describe = () => {
    const name = input.value.trim() || QUICK_SAVE_NAME;
    const save = mine.find((s) => s.saveName.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0) ?? null;
    line.textContent = save ? `Overwrites "${save.saveName}" - ${saveLine(save)}` : `A new slot, "${name}".`;
    numbers.replaceChildren(); if (save) numbers.append(stats(saveStats(save)));
  };
  input.oninput = () => { _saveNameDraft = input.value; describe(); };
  describe();
  c.append(line, numbers);
  c.append(acts([{ label: 'Save', primary: true, onClick: () => { _pickedSaveName = input.value.trim() || QUICK_SAVE_NAME; onAction('save'); } }]));
  body.append(c);
  // TILE2: the same tiles the other two panes draw. Mac named Online
  // and Load; this pane lists the SAME slots, and leaving one of the
  // three on the old card is exactly the drift one tile was made to
  // end - three hand-rolled copies of "career, level, date, time" is
  // how three panes come to disagree about what a save is.
  //
  // `current` marks the slot the name field would OVERWRITE, so the
  // brass edge moves as the player types rather than naming a slot
  // nobody is about to touch.
  const grid = tileGrid(mine, (save) => ({
    current: save.saveName.localeCompare(input.value.trim() || QUICK_SAVE_NAME, undefined, { sensitivity: 'accent' }) === 0,
    actions: [{ label: 'Overwrite', primary: true, onClick: () => { _pickedSaveName = save.saveName; onAction('save'); } }],
  }));
  body.append(grid);
}

// ── EXIT (pause only) ────────────────────────────────────────────
// U51. Classic confirms on TEXT.RSC 1069 and then posts dfuiExitGame
// (pauseWindow.js:223-226); in a browser Application.Quit means nothing,
// so the port's door out has always been the front door - the same
// unwind chargen's cancel and the death sequence use (Ledger A).
//
// THE WORDS ARE THIS SCREEN'S OWN, not record 1069. That is the whole
// premise of the enhanced skin - it opens before the ARENA2 pick and
// cannot read TEXT.RSC to ask a question - and it is recorded here
// rather than left to look like an oversight.
// THE HEADING SAYS WHERE YOU GO; THE BUTTON SAYS WHAT YOU DO; THE
// CONFIRM ECHOES THE BUTTON. The first draft titled the card AND the
// confirm "Leave this game", so the one press between them appeared to
// change nothing - a confirm that repeats the card it replaced reads
// as a screen that did not respond.
function paneExit(body) {
  const save = savedGame();
  const c = el('div', 'card');
  c.append(el('h3', null, 'Back to the main menu'));
  c.append(el('p', 'meta', "A browser tab cannot close itself, so the port's door out is the "
    + 'front door - the same unwind the death sequence uses.'));
  c.append(stats([['Last save', save ? saveLine(save) : 'none']]));
  c.append(acts([{
    label: 'Leave this game',
    primary: true,
    onClick: () => ask(
      'Leave this game',
      save
        ? `Anything since ${save.when ?? 'the last save'} is lost. The quicksave itself is untouched.`
        : 'Nothing has been saved in this game, so all of it is lost.',
      'Exit',
      () => onAction('exit'),
    ),
  }]));
  body.append(c);
}

// ── SETTINGS ─────────────────────────────────────────────────────
// The whole shipped screen, rendered from the same law. Three panes:
// categories, rows, help. Nothing is filtered out by tier - a hidden
// setting is a setting the player cannot find out about, which is the
// rule U30 landed after the launcher hid them behind a filter.
function paneSettings(pane) {
  const panes = el('div', 'panes');

  const rail = el('div', 'subrail');
  for (const cat of CATEGORIES) {
    const on = cat.id === category;
    const b = el('button', `subbtn${on ? ' on' : ''}`, cat.title);
    b.append(el('span', 'count', String(liveCount(cat.id))));   // SO1: what works here, not the file's row count
    // AUDIT F8, found by the live check rather than by reading: on a
    // PHONE the detail pane is a sheet that only rises when a ROW is
    // tapped, so the category card - and the Reset button living in it
    // - could never be seen at all. Playwright spent thirty seconds
    // trying to click a button translated 101% off the bottom of the
    // screen, which is exactly the AUDIT 24 shape: a control that
    // exists, is drawn, and cannot be reached on the device that needs
    // it most.
    //
    // A SECOND TAP ON THE SELECTED CATEGORY OPENS ITS CARD. That is
    // not invented: settingsWindow's click arm already makes a second
    // tap on an already-selected row act on it ("one finger, no
    // modifier, the phone equivalent of Right"), so this is the
    // port's own gesture applied one level up. The dot on the active
    // tab is the affordance, because a gesture nobody can see is a
    // gesture nobody uses.
    b.onclick = () => {
      // FT16: a category change is a walk away from the bindings, and
      // their copy says a walk away drops them.
      if (on) { pickedKey = null; sheetOpen = true; } else { discardControlsStaging(); category = cat.id; pickedKey = null; }
      render();
    };
    if (on) b.append(el('span', 'more-dot'));
    rail.append(b);
  }

  const list = el('div', 'list');
  // SO1: the port's own rows first (the skin under INTERFACE, which is
  // what it is - see systems/uiSkin.js), the live store keys flat, and
  // the two folded tiers with their counts (categoryRows).
  const rows = categoryRows(category);
  if (!rows.length && category !== 'controls') list.append(empty('Nothing here yet', 'This category has no keys.'));
  for (const r of rows) list.append(r);
  // FT16 (Mac: "the control menu option needs to be within settings"):
  // THE KEY BINDINGS ARE THE CONTROLS CATEGORY. They were a rail door
  // beside Settings (FIX-F) while Settings already carried a Controls
  // category holding DFU's Controls/* keys - two doors for one subject,
  // and a player looking for "how do I rebind jump" had to guess which.
  // The store keys come first because they are few and the ones a hand
  // reaches for mid-session; the grid follows under its own head.
  if (category === 'controls') {
    list.append(pxDivider('Key bindings'));
    paneControls(list, { render });
  }

  const detail = el('div', 'detail');
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => { sheetOpen = false; confirming = null; render(); };
  detail.append(close);
  detail.append(confirming ? confirmCard() : (pickedKey ? helpCard(pickedKey) : categoryCard()));
  if (sheetOpen) detail.classList.add('open');

  panes.append(rail, list, detail);
  pane.append(panes);
}

/** PX10: THE CONDENSED SETTINGS (pause only). Every key whose tier is
 *  LIVE - derived from the tier map itself, so a setting that gains a
 *  consumer joins this pane the same day - rendered through the SAME
 *  settingRow every screen uses, with the same rising sheet for help.
 *  The full catalog stays on the main menu's Settings (Mac's call:
 *  'the pause menu should have a more condensed settings menu while
 *  the main menu holds most settings'), and the closing line says so
 *  rather than letting the short list read as the whole store - the
 *  U30 nothing-hidden law kept by TELLING, not by showing all 171. */
function paneQuickSettings(pane) {
  const panes = el('div', 'panes');
  const list = el('div', 'list');
  let any = false;
  // One scroll, grouped under the categories' own titles - 48 live
  // rows flat read as a wall; the dividers give the scroll a spine
  // without bringing back the chip strip this pane exists to shed.
  for (const cat of CATEGORIES) {
    const liveKeys = paneKeys(cat.id).filter((key) => tierOf(key) === 'live');   // FT13: the moved keys are not here
    if (!liveKeys.length) continue;
    any = true;
    list.append(pxDivider(cat.title));
    for (const key of liveKeys) put(list, settingRow(key));
  }
  // SO1: and the port's own rows that take effect without a reload,
  // under the categories they live in on the main menu
  for (const cat of CATEGORIES) {
    const port = portRows(cat.id, { pause: true });
    if (!port.length) continue;
    any = true;
    list.append(pxDivider(cat.title));
    for (const r of port) list.append(r);
  }
  if (!any) list.append(empty('Nothing live here yet', 'No setting has an in-game consumer in this build.'));
  // FT16: the condensed pause settings has no category rail, so the
  // bindings ride the end of the one scroll. Dropping them here would
  // be FIX-F's bug again - "the row whose absence was the bug" - just
  // one level down.
  list.append(pxDivider('Key bindings'));
  paneControls(list, { render });
  list.append(el('p', 'px-note', 'Every setting lives on the main menu\u2019s Settings.'));
  panes.append(list);

  const detail = el('div', 'detail');
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => { sheetOpen = false; confirming = null; render(); };
  detail.append(close);
  detail.append(confirming ? confirmCard() : (pickedKey ? helpCard(pickedKey) : el('div')));
  if (sheetOpen) detail.classList.add('open');
  panes.append(detail);
  pane.append(panes);
}

/* MENU-TOGGLE (2026-09-26, Mac: "We really need to remove the enhanced/classic menu toggle and ensure all the UI is
 * linked up properly"): THE MENU'S SKIN TOGGLE IS RETIRED - the pair under the brand and on the home's foot, the
 * Settings row "Interface Style" and its help. Plain Enhanced went with PLUS-ONLY; the interface is chosen on the
 * Overhauls page's UI Overhaul card alone (Classic, Enhanced Plus, GrimoireUI - systems/overhauls.js uiChoiceUrl, the
 * SKIN-CARRY law's one home now), which both skins' boot rails and the pause menu carry. */
function categoryCard() {
  const cat = CATEGORIES.find((c) => c.id === category);
  const d = el('div', 'dcard');
  d.append(el('h3', null, cat.title));
  d.append(el('p', null, cat.blurb));
  const b = el('button', 'act', 'Reset everything to defaults');
  b.onclick = () => ask(
    'Reset Everything',
    'Put every setting back the way Daggerfall Unity ships it. '
    + 'Your UI Overhaul and text size are not settings and are left alone.',
    'Reset',
    () => { resetToDefaults(); _eff = null; },
  );
  d.append(b);
  return d;
}

/** THE HELP PANEL. DFU's own words for the setting (settingsCopy pulls
 *  them from GameSettings.txt), then the tier line, then the raw
 *  `[Section] Key` - which appears in exactly ONE place in the whole
 *  interface, for the player who wants it. */
function helpCard(key) {
  const tier = tierOf(key);
  const d = el('div', 'dcard');
  d.append(el('h3', null, labelOf(key)));
  const help = helpOf(key);
  if (help) d.append(el('p', null, help));
  d.append(el('p', 'status', TIER_TEXT[tier]));
  if (tier === 'unavailable') {
    d.append(el('p', null, blockedReason(key)));
    if (INSTEAD[key]) d.append(el('p', null, INSTEAD[key]));
  }
  const [sec, k] = key.split('/');
  d.append(el('code', null, `[${sec}] ${k}`));
  return d;
}

/**
 * One setting, as a row. The control is chosen by widgetFor, which is
 * total over all 171 keys and takes no judgement from this file:
 * switch | enum | number | colour | text | blocked.
 *
 * A blocked row is DRAWN, greyed, with its reason one press away. That
 * is deliberate and it is the port's own standing rule: DFU ships
 * EnhancedCombatAI True and we run the classic path, so a working
 * toggle there would be a lying toggle.
 */
// AUDIT F7: this read effectiveSettings() - a full merge of all 171
// keys over the defaults - ONCE PER ROW, so the Game category rebuilt
// the whole store twenty-one times per render and Video sixty-six.
//
// The cache lives as long as the mount and is dropped by every path
// that can change the store: write(), the reset, and the mount itself.
// Nothing else in the running page writes settings while this screen
// is up - it is the only screen up - so a longer-lived cache would
// still be correct, but tying it to the writers is what makes that
// true by construction rather than by circumstance.
let _eff = null;
const effective = () => (_eff ??= effectiveSettings());

function settingRow(key, { compact = false, home = false } = {}) {
  // FT1: a key whose switch lives on the FEATURES home is never drawn
  // here as a second switch - one home per idea. FT13 (Mac, 2026-09-14:
  // "Remove the now moved settings options that are now in our new
  // Features pane"): nor as a pointer - the row is NOT drawn at all
  // (movedRow answers null, and every list filters the key out before
  // it counts). The category map stays total (settingsMap's law); what
  // the pane SHOWS of it is the keys that still live here.
  if (!home) {
    const moved = featureForControl('settings', key);
    if (moved) return movedRow(moved);
  }
  const widget = widgetFor(key);
  const [_sec, _k] = key.split('/');
  const raw = effective()[_sec]?.[_k];
  const tier = tierOf(key);
  const blocked = widget === 'blocked';

  const row = el('div', `row${key === pickedKey ? ' on' : ''}${blocked ? ' blocked' : ''}`);

  // The raw `Section/Key` used to sit under every label. It appears in
  // exactly ONE place now - the help panel - which is where it was
  // always meant to be and where the player who wants it will look.
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', labelOf(key)));
  main.onclick = () => { pickedKey = key; sheetOpen = true; render(); };
  row.append(main);

  const ctl = el('div', 'ctl');
  const val = el('span', 'val', formatValue(key, raw));

  if (blocked || widget === 'text') {
    ctl.append(val);
  } else if (widget === 'colour') {
    // AUDIT F5: these rows drew a value with no control and no reason,
    // which reads as broken rather than as unbuilt. A native colour
    // input IS the editor - it is the one widget a browser gives us
    // that beats anything the classic screen could draw - and it
    // writes through the same setValue every other row uses.
    const sw = el('input', 'swatch');
    sw.type = 'color';
    sw.value = `#${String(raw ?? '').slice(0, 6)}`;
    sw.setAttribute('aria-label', labelOf(key));
    // DFU's colour keys are RGBA8; the picker owns RGB, so the stored
    // ALPHA byte is carried through untouched rather than silently
    // reset to FF (ToolTipBackgroundColor ships D2 and means it).
    sw.oninput = () => write(key, (sw.value.slice(1) + String(raw ?? '').slice(6)).toUpperCase());
    ctl.append(sw, val);
  } else if (widget === 'switch') {
    // A switch has one direction, so it gets one control rather than a
    // pair of arrows pointing at the same place.
    const b = el('button', 'act', formatValue(key, raw));
    b.classList.add('rowact');   // AUDIT UI: sized by the sheet, not inline
    if (raw === 'True') b.classList.add('primary');
    b.onclick = () => write(key, stepValue(key, raw, 1));
    if (onlineForcedSetting(_sec, _k) !== undefined) lockOnline(b, null, { note: ONLINE_SETTING_NOTE, value: raw === 'True' });   // DISC22-A: the room's rule, shown locked
    ctl.append(b);
  } else {
    ctl.append(val);
    for (const [dir, glyph] of [[-1, '\u2039'], [1, '\u203a']]) {
      const b = el('button', 'step', glyph);
      b.setAttribute('aria-label', `${dir < 0 ? 'less' : 'more'} ${labelOf(key)}`);
      // shift is the COARSE step settingsLaw already defines - a
      // volume slider that moves in 5% steps is 20 presses of patience
      // without it.
      b.onclick = (e) => write(key, stepValue(key, raw, dir, e.shiftKey));
      ctl.append(b);
    }
  }

  if (!compact) ctl.append(el('span', `tier ${tier}`));
  row.append(ctl);
  return row;
}

/** FT1: the settings row of a key that lives on the Features home -
 *  its labels, its name, and a walk to the home from either the face
 *  or the control. */
/** FT13: a key whose switch lives on the Features home draws NOTHING on
 *  the settings pane, the Mods page or the pause door - not a pointer
 *  (FT1's pointer row is gone: Mac, 2026-09-14, "Remove
 *  the now moved settings options that are now in our new Features
 *  pane"). Every seam that draws a row asks the registry and answers
 *  null through here; every caller appends only what it is handed. */
function movedRow(_f) { return null; }
/** FT13: the keys of a category that still LIVE on the settings pane -
 *  the moved ones are the home's and are neither drawn nor counted. */
const paneKeys = (catId) => keysOf(catId).filter((key) => !featureForControl('settings', key));
/** Append what a row builder handed back, or nothing (FT13). */
const put = (parent, row) => { if (row) parent.append(row); };


/** Write through the real store and persist, exactly as the shipped
 *  screen does. setValue drops an override that equals the default
 *  rather than pinning today's value, which is settings.js's law. */
function write(key, next) {
  if (next == null) return;
  const [sec, k] = key.split('/');
  setValue(sec, k, next);
  saveSettings();
  _eff = null;   // the store changed - drop the cache, then redraw from it
  render();
}

// ── MODS ─────────────────────────────────────────────────────────
// There is NO mod system (Ledger C, Not planned - and settings.js:170
// blocks four keys on exactly that ground). The section still exists,
// because Mac's call was to set the menus up now, and because a rail
// that quietly omits mods teaches the player they are impossible.
// ── ENHANCED ─────────────────────────────────────────────────────
//
// Every switch that is OURS rather than Daggerfall's. DFU's own 171
// keys stay in Settings, which is a different question - that screen
// answers "how should the game behave", this one answers "how much of
// this is still Daggerfall".
//
// NOTHING IS HIDDEN FOR NOT BEING BUILT. The rail's own law (see
// SECTIONS_BOOT) is that a section with no engine still has a home and
// says what it waits on, because a list with a hole in it teaches the
// player the hole is permanent. So an enhancement that does not exist
// yet is listed, greyed, with the reason - and one that exists but
// cannot run here says what it needs instead of failing silently.

/** OL1: the lock a forced switch wears online - the button says so and
 *  answers nothing, so a player who presses it learns why rather than
 *  watching a press change nothing. */
const ONLINE_LOCK_NOTE = 'Always on online: the shared world uses every enhancement. Your own choice comes back offline.';
/** MODS-ONLINE-2: a mod switch wears a lock for a DIFFERENT reason - not
 *  the lane, the floor - and a lock that gives the wrong reason is a
 *  refusal nobody can read. The two road switches say which. */
/** MODS-ONLINE-2: the Mods pane's own line. The lane's note (above)
 *  is about the PORT's switches and was wrong over the tiles the
 *  moment a mod stopped being forced. */
const ONLINE_MODS_NOTE = 'Most mods are your choice online. A few are set for everyone in the room so everyone plays on the same ground by the same rules: the ones that change the ground (Basic Roads, World of Daggerfall, Detailed Ships, Iliac Puddle No More\u2019s sea and depth, and There\u2019s a Hole in the Bottom of the Ocean), and every setting of Meaner Monsters, the Combat and Armor Overhaul, Unleveled Loot, Roleplay & Realism, Roleplay & Realism: Items and Oblivion leveling (who stands behind a counter and which leveling your character uses stay yours).';
const ONLINE_GROUND_NOTE = 'Set for everyone online: it changes the ground itself (roads, camp sites, the shared ship deck, the seafloor and its pits), and everyone in a room has to stand on the same ground. Your own choice comes back offline.';
/** WOD1: the vendors whose room-owned switch is the GROUND's - the two
 *  that write terrain heights (roads' beds, World of Daggerfall's sites). */
const ONLINE_GROUND_VENDORS = Object.freeze(['roads-hazelnut', 'world-of-daggerfall', 'detailed-ships', 'ocean-holes']);   // DS1: the ships' shared deck   // OH-A: the pits cut into the seafloor
/** DW-D: a vendor whose room-owned switches are the ground's AND other reasons names its ground keys - the carved
 *  sea's switch and its depth. */
const ONLINE_GROUND_KEYS = Object.freeze({ 'iliac-puddle-no-more': Object.freeze(['Enabled', 'General.WaterDepth']) });
/** MODS-ONLINE-4: the other three, and their reason is not the ground -
 *  it is that this switch would be spending somebody else's evening. */
const ONLINE_SHARED_NOTE = 'On for everyone online: a dungeon\u2019s monsters belong to whoever hosts it and loot passes between players, so the room has to agree. Your own choice comes back offline.';
/** MODS-ONLINE-5: one ruleset per room - the reason PCAAO is forced whole, and RR's six combat overrides and its
 *  intensive training with it. Not the ground's reason and not the host's foes', so its own words. */
const ONLINE_RULESET_NOTE = 'Set for everyone online: a room plays by one set of combat, training and swimming rules. Your own choice comes back offline.';
const ONLINE_RULESET_KEYS = Object.freeze({
  'roleplay-realism': Object.freeze(['advancedArchery', 'weaponSpeed', 'weaponMaterials', 'classicStrengthDamageBonus', 'equipDamage', 'encumbranceEffects', 'RefinedTraining.intensiveTraining']),
  'iliac-puddle-no-more': Object.freeze(['General.SwimSpeedMultiplier', 'General.EnableSwimStroke', 'General.ArgonianInfiniteBreath']),   // DW-D: the swim and the breath
});
/** REALM P0.2: a dial of a balance mod the room owns whole (onlineLane.js ONLINE_WHOLE_MODS) - its own reason. */
const ONLINE_BALANCE_NOTE = 'Set for everyone online, so no one\u2019s character ends up stronger or richer than the rest from a setting. Your own choice comes back offline.';
/** DISC22-A: a DFU setting the room plays by (onlineLane.js ONLINE_FORCED_SETTINGS) - its own reason. */
const ONLINE_SETTING_NOTE = 'Set for everyone online: everyone uses the same smiths, so enchanted items are mended by one rule. Your own choice comes back offline.';
/** RAID2: a world event the room shares - its own reason, not the ground's, the ruleset's or a host's foes'. */
const ONLINE_WORLD_EVENT_VENDORS = Object.freeze(['world-events-raiding-parties']);
const ONLINE_WORLD_EVENT_NOTE = 'On for everyone online: a raid is shared, so everyone in the town fights the same raiders and every kill counts for all. Your own choice comes back offline.';
const onlineLockNote = (vendor, key) => (ONLINE_GROUND_VENDORS.includes(vendor) || ONLINE_GROUND_KEYS[vendor]?.includes(key) ? ONLINE_GROUND_NOTE : ONLINE_RULESET_KEYS[vendor]?.includes(key) ? ONLINE_RULESET_NOTE : ONLINE_WORLD_EVENT_VENDORS.includes(vendor) ? ONLINE_WORLD_EVENT_NOTE : ONLINE_SHARED_NOTE);
/** REALM P0.2: a key the room owns only because its mod is owned whole wears the balance note; a key the room table names keeps its own. */
const modLockNote = (vendor, key) => (!Object.hasOwn(ONLINE_ROOM_MOD_KEYS[vendor] ?? {}, key) && onlineWholeModKey(vendor, key, undefined, { offline: true }) ? ONLINE_BALANCE_NOTE : onlineLockNote(vendor, key));
/** REALM P0.2: a DIAL the room owns online - its steppers and buttons answer nothing, and say why. */
function lockDial(ctl, note) {
  for (const b of ctl.querySelectorAll('button')) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); b.title = note; }
  ctl.title = note;
}
function lockOnline(b, main, { note = ONLINE_LOCK_NOTE, value = true } = {}) {
  b.textContent = value ? 'On (online)' : 'Off (online)';
  b.classList.toggle('primary', !!value);
  b.disabled = true;
  b.title = note;
  b.setAttribute('aria-disabled', 'true');
  if (main) main.onclick = null;
}

/** One toggle over a uiPrefs key. */
function prefRow(key, name, note, { onChange = null, home = false } = {}) {
  if (!home) { const moved = featureForControl('prefs', key); if (moved) return movedRow(moved); }   // FT2: one home per idea, every store
  const row = el('div', 'row');
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', name));
  if (note) main.append(el('div', 'row-note', note));
  const on = !!getPref(key);
  main.onclick = () => { setPref(key, !on); onChange?.(!on); render(); };
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', `act${on ? ' primary' : ''}`, on ? 'On' : 'Off');
  b.classList.add('rowact');   // AUDIT UI: sized by the sheet, so the coarse-pointer rule can reach it
  b.setAttribute('aria-pressed', String(on));
  b.onclick = () => { setPref(key, !on); onChange?.(!on); render(); };
  if (onlineForcedPref(key) !== undefined) lockOnline(b, main);   // OL1
  ctl.append(b, el('span', 'tier live'));
  row.append(ctl);
  return row;
}


// ── SO1: THE PORT'S OWN ROWS, IN THE CATEGORIES A PLAYER LOOKS IN ──
// (2026-09-11, Mac: "a comprehensive organization of all the settings
// options, and settings audit ensuring proper organization and bloat
// reduction"). The Enhanced PANE - a rail entry of its own holding
// every switch the port invented, in five cards - is gone. Its rows
// live where a player would look for them: the port's departures from
// Daggerfall (the AI, the outdoors, the water, the combat draw) under
// the ENHANCED category of Settings; the touch knobs under CONTROLS
// beside the mouse and the pad; the interface style, the HUD size and
// the FPS counter under INTERFACE; the Morrowind assets and the
// replacement packs on the MODS page, which is what they are. Every
// row is the same row it was (prefRow, choiceRow, stepRow over the
// uiPrefs shelf), so every law those rows carried is untouched. The
// "Not switchable here" card - a row about a feature that was REMOVED -
// went with the pane: a list of things that do not exist is bloat, not
// honesty, once the thing has a record elsewhere (About, the Ledger).

/** A choice row: the button names the CURRENT tier and a click steps
 *  to the next, wrapping (PERF1). */
function choiceRow(key, name, note, tiers, { home = false, read = null, write = null } = {}) {
  if (!home) { const moved = featureForControl('prefs', key); if (moved) return movedRow(moved); }   // FT2
  // FT2: a condensed row reads the lane's live value and writes both stores
  const cur = String(read ? read() : getPref(key));
  const found = tiers.findIndex(([v]) => String(v) === cur);
  const at = found >= 0 ? found : Math.max(0, tiers.findIndex(([v]) => String(v) === String(featureForControl('prefs', key)?.control?.default ?? featureForControl('prefs', key)?.control?.initial)));   // BLOOD AUDIT 5: the row's default, not the first tier, for a value that is no tier
  const row = el('div', 'row');
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', name));
  main.append(el('div', 'row-note', note));
  const step = () => { (write ?? ((v) => setPref(key, v)))(tiers[(at + 1) % tiers.length][0]); render(); };
  main.onclick = step;
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act rowact', tiers[at][1]);
  b.onclick = step;
  if (onlineForcedPref(key) !== undefined) { lockOnline(b, main); b.textContent = `${tiers[at][1]} (online)`; }   // OL1: the outdoors row reads the lane's forced answer and names its tier under the lock
  ctl.append(b, el('span', 'tier live'));
  row.append(ctl);
  return row;
}

/** A stepped number row over a uiPrefs key (TI2's shape). */
function stepRow(key, name, note, { min, max, step: inc, fmt }) {
  const row = el('div', 'row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', name));
  if (note) main.append(el('div', 'row-note', note));
  row.append(main);
  const ctl = el('div', 'ctl');
  const cur = () => Number(getPref(key)) || 1;
  const val = el('span', 'val', fmt(cur()));
  const step = (delta, label) => {
    const b = el('button', 'step', label);
    b.onclick = () => {
      const next = Math.round(Math.max(min, Math.min(max, cur() + delta)) * 100) / 100;
      setPref(key, next);
      val.textContent = fmt(next);
    };
    return b;
  };
  ctl.append(step(-inc, '\u2039'), val, step(inc, '\u203a'));
  row.append(ctl);
  return row;
}

/** TOUCH-BUTTONS: a choice among named values, walked with the same two steppers as stepRow (wrapping - a list, not
 *  a range). `choices` is [id, label] in order; the store holds the id. */
function slotChoiceRow(key, name, note, choices, current) {
  const row = el('div', 'row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', name));
  if (note) main.append(el('div', 'row-note', note));
  row.append(main);
  const ctl = el('div', 'ctl');
  const labelOf = (id) => choices.find(([c]) => c === id)?.[1] ?? id;
  let cur = current();
  const val = el('span', 'val', labelOf(cur));
  const step = (dir, label) => {
    const b = el('button', 'step', label);
    b.onclick = () => { cur = nextTouchButton(cur, dir); setPref(key, cur); val.textContent = labelOf(cur); };
    return b;
  };
  ctl.append(step(-1, '\u2039'), val, step(1, '\u203a'));
  row.append(ctl);
  return row;
}

/** PX30c: the enhanced HUD's scale, on the prefs shelf (see the note
 *  at uiPrefs.hudScale). Takes effect at once. */
function hudScaleRow() {
  const row = el('div', 'row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', 'Gameplay HUD scale'), el('div', 'row-note', 'The size of the compass, health bars and effect icons. Takes effect at once.'));
  row.append(main);
  const ctl = el('div', 'ctl');
  const val = el('span', 'val', `${hudScaleNow().toFixed(2)}\u00d7`);
  const step = (delta, label) => {
    const b = el('button', 'step', label);
    b.onclick = () => {
      const next = Math.round(Math.max(HUD_SCALE_MIN, Math.min(HUD_SCALE_MAX, hudScaleNow() + delta)) * 20) / 20;
      setPref('hudScale', next);
      val.textContent = `${next.toFixed(2)}\u00d7`;
    };
    return b;
  };
  ctl.append(step(-0.05, '\u2039'), val, step(0.05, '\u203a'));
  row.append(ctl);
  return row;
}

/** HUD-MOVE: LOCK UI and RESET UI. Locked (the default) the HUD stands still and takes no pointer; unlocked, every
 *  piece - the vitals, the hotbar, the chat, the compass, the Overworld's panel and the rest - is outlined in play and
 *  moves with a drag of the freed mouse. Reset puts every piece back where the game stands it. */
function hudLayoutRows() {
  const lockRow = el('div', 'row');
  const main = el('button', 'row-main');
  const locked = hudLocked();
  main.append(el('div', 'row-name', 'Lock UI'), el('div', 'row-note', locked
    ? 'On: the HUD stays where it is. Turn it off (or press Alt+U in game) to move the health bars, hotbar, chat, compass, Overworld panel and the rest.'
    : 'Off: in play, free the mouse and drag any outlined piece. Double-click a piece to put it back. Lock it again (or press Alt+U) when you are done.'));
  const flip = () => { setHudLocked(!hudLocked()); render(); };
  main.onclick = flip;
  lockRow.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', `act rowact${locked ? ' primary' : ''}`, locked ? 'On' : 'Off');
  b.setAttribute('aria-pressed', String(locked));
  b.onclick = flip;
  ctl.append(b, el('span', 'tier live'));
  lockRow.append(ctl);

  // the three bars: moved as one piece, or each on its own
  const barsRow = el('div', 'row');
  const bmain = el('button', 'row-main');
  const split = hudBarsSplit();
  bmain.append(el('div', 'row-name', 'Move bars separately'), el('div', 'row-note', split
    ? 'On: the health, magicka and fatigue bars each move on their own while the UI is unlocked.'
    : 'Off: the health, magicka and fatigue bars move together as one piece.'));
  const bflip = () => { setHudBarsSplit(!hudBarsSplit()); render(); };
  bmain.onclick = bflip;
  barsRow.append(bmain);
  const bctl = el('div', 'ctl');
  const bb = el('button', `act rowact${split ? ' primary' : ''}`, split ? 'On' : 'Off');
  bb.setAttribute('aria-pressed', String(split));
  bb.onclick = bflip;
  bctl.append(bb, el('span', 'tier live'));
  barsRow.append(bctl);

  const resetRow = el('div', 'row');
  const rmain = el('div', 'row-main');
  rmain.append(el('div', 'row-name', 'Reset UI'), el('div', 'row-note', 'Puts every HUD piece you moved back in its usual place.'));
  resetRow.append(rmain);
  const rctl = el('div', 'ctl');
  const rb = el('button', 'act rowact', 'Reset');
  rb.onclick = () => { resetHudLayout(); rb.textContent = 'Done'; setTimeout(() => { rb.textContent = 'Reset'; }, 1200); };
  rctl.append(rb, el('span', 'tier live'));
  resetRow.append(rctl);
  return [lockRow, barsRow, resetRow];
}

/** EE13: the outdoors test door - a season, a weather, a random town.
 *  A TEST door, not a setting: it navigates and stores nothing. */
function outdoorsTestRow() {
  const test = el('div', 'row');
  const testMain = el('div', 'row-main');
  testMain.append(el('div', 'row-name', 'Test the outdoors'));
  testMain.append(el('div', 'row-note', 'Pick a season and a weather, and drop into a random town. A test door: it stores nothing, and it names the town in the console.'));
  const testCtl = el('div', 'ctl');
  const seasonSel = el('select', 'act');
  // Daggerfall has three ARCHIVE seasons (winter, rain, summer),
  // and the field has a CALENDAR. A season here is both: the archive
  // the world dresses in; the day is sent for any test that wants it.
  const SEASONS = [['winter', 'winter', 0], ['spring', 'rain', 90], ['summer', 'summer', 180], ['fall', 'summer', 300]];
  for (const [label, , day] of SEASONS) { const o = el('option', '', label); o.value = String(day); seasonSel.append(o); }
  const weatherSel = el('select', 'act');
  for (const wn of ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow']) { const o = el('option', '', wn); o.value = wn; weatherSel.append(o); }
  const go = el('button', 'act primary', 'Spawn');
  go.type = 'button';
  go.addEventListener('click', () => {
    // the menu already lives at /play/: same page, the world's doors set
    const url = new URL(location.href);
    url.search = '';
    const day = Number(seasonSel.value);
    const archive = SEASONS.find((x) => x[2] === day)?.[1] ?? 'summer';
    for (const [k, v] of [['world', ''], ['spawn', 'random'], ['season', archive], ['day', String(day)], ['weather', weatherSel.value], ['class', '1'], ['novideo', '']]) url.searchParams.set(k, v);
    location.href = url.toString().replace(/=(&|$)/g, '$1');
  });
  testCtl.append(seasonSel, weatherSel, go);
  test.append(testMain, testCtl);
  return test;
}


/** The CONTROLS category's port rows: the touch layer's knobs, only
 *  where the device reports touch (TI2). */
function portRowsControls() {
  const out = [];
  if (!isTouchDevice()) return out;
  const times = (v) => `${v.toFixed(2)}\u00d7`;
  out.push(stepRow('touchLookSensitivity', 'Look sensitivity',
    'How far a thumb\u2019s drag turns the camera, on top of the mouse sensitivity in Controls. '
    + 'A drag is measured against the screen\u2019s height, so the same sweep turns the same on any phone.',
    { min: 0.25, max: 4, step: 0.25, fmt: times }));
  out.push(prefRow('touchAnalogStick', 'Analog stick',
    'The stick\u2019s throw is your speed: a little is a walk, most of the way is a run. '
    + 'Off is the eight-way stick - any push is a full step.'));
  // the anchor is a two-way choice, not a switch: a row whose button names the OTHER option
  {
    const fixed = getPref('touchStickAnchor') === 'fixed';
    const row = el('div', 'row');
    const main = el('button', 'row-main');
    main.append(el('div', 'row-name', 'Stick position'));
    main.append(el('div', 'row-note', fixed
      ? 'Fixed: the stick sits bottom-left and waits for your thumb.'
      : 'Floating: the stick appears wherever your thumb lands on the left half.'));
    const flip = () => { setPref('touchStickAnchor', fixed ? 'float' : 'fixed'); render(); };
    main.onclick = flip;
    row.append(main);
    const ctl = el('div', 'ctl');
    const b = el('button', 'act rowact', fixed ? 'Fixed' : 'Floating');
    b.onclick = flip;
    ctl.append(b, el('span', 'tier live'));
    row.append(ctl);
    out.push(row);
  }
  out.push(prefRow('touchGyroLook', 'Gyro aim',
    'Turn the phone to turn the camera, a degree for a degree, on top of the drag - fine aim without lifting a thumb. '
    + 'iPhones ask permission for motion the first time.', {
    // iOS grants motion only from a user gesture - this click is one.
    onChange: (on) => { if (on) { try { globalThis.DeviceMotionEvent?.requestPermission?.()?.catch?.(() => {}); } catch { /* not iOS */ } } },
  }));
  out.push(stepRow('touchGyroSensitivity', 'Gyro sensitivity',
    'Degrees of camera per degree of phone.',
    { min: 0.25, max: 4, step: 0.25, fmt: times }));
  out.push(prefRow('touchHaptics', 'Haptics',
    'A short pulse on a button, when a held finger arms a swing, and when a lock lands. Phones that can.'));
  // TOUCH-BUTTONS (2026-09-27, Discord: "I haven't been able to remap the android "buttons" on the bottom right of the
  // screen. I would much rather use a button to attack"): the corner's three slots, right to left. Changed here while
  // playing, the corner is re-laid as soon as no finger holds one of its buttons.
  {
    const choices = touchButtonChoices();
    const slotNames = ['Corner button', 'Second button', 'Third button'];
    TOUCH_BUTTON_SLOTS.forEach((slot, i) => {
      out.push(slotChoiceRow(slot, slotNames[i],
        i === 0 ? 'The bottom-right buttons, from the corner in. Attack swings (or casts a readied spell) with one press - the swipe still works too.' : null,
        choices, () => touchButtonSlots(getPref)[i].id));
    });
  }
  out.push(prefRow('touchFullscreen', 'Fullscreen on touch',
    'The first touch asks the browser for fullscreen and a landscape lock. Where the browser will not '
    + '(Safari on iPhone), add the game to the home screen instead - it opens fullscreen from there.'));
  return out.filter(Boolean);   // FT13: a pref that lives on the home draws nothing
}

/** The INTERFACE category's port rows: the HUD's size, the FPS counter
 *  and the rest. The interface itself is chosen on the Overhauls page
 *  (MENU-TOGGLE: the Interface Style row is retired). */
function portRowsInterface({ pause = false } = {}) {
  const out = [];
  out.push(hudScaleRow());
  if (isEnhanced()) out.push(...hudLayoutRows());   // HUD-MOVE: the Enhanced Plus HUD's own - Classic draws none of it
  // FOEBAR1: the target bar's face is a two-way choice, not a switch - the
  // stick-position row's shape: a row whose button names the OTHER option.
  {
    const blade = getPref('foeBarStyle') === 'blade';
    const row = el('div', 'row');
    const main = el('button', 'row-main');
    main.append(el('div', 'row-name', 'Target bar'));
    main.append(el('div', 'row-note', blade
      ? 'Blade: the twin blades under the compass recede toward their hub as the foe\u2019s health falls.'
      : 'Bar: the plain track under the compass. Takes effect at once.'));
    const flip = () => { setPref('foeBarStyle', blade ? 'bar' : 'blade'); render(); };
    main.onclick = flip;
    row.append(main);
    const ctl = el('div', 'ctl');
    const b = el('button', 'act rowact', blade ? 'Blade' : 'Bar');
    b.onclick = flip;
    ctl.append(b, el('span', 'tier live'));
    row.append(ctl);
    out.push(row);
  }
  out.push(prefRow('showFps', 'FPS counter',
    'Frames a second in the top-right corner, with the frame\u2019s milliseconds and the slowest frame of the '
    + 'last second. Takes effect at once. ?fps in the address bar forces it on for a probe.'));
  if (!pause) out.push(prefRow('skipStartVideo', SKIP_START_VIDEO_NAME, SKIP_START_VIDEO_NOTE));   // UXB1-A: read at launch, so the front door's alone - as the skin's
  return out.filter(Boolean);   // FT13
}

/** UXB1-A (2026-09-25, the UX backlog: '"Skip Start Video" in the options ... Disabled by default, of course.'):
 *  the row's words. The switch is uiPrefs' skipStartVideo, read by main.js at the front door. */
export const SKIP_START_VIDEO_NAME = 'Skip start video';
export const SKIP_START_VIDEO_NOTE = 'Open straight onto the main menu, without the opening film (on the classic skin, '
  + 'without the splash video before the title too). The menu\u2019s music still plays. Takes effect the next time '
  + 'the game starts.';

/** QREPAIR (2026-09-24, Mac: "Add a quest refresh option to settings" - "Repair active quests"): THE GAME CATEGORY'S
 *  PORT ROW. The repair runs over a game in play, so its door is the PAUSE's settings (the host hands
 *  `hooks.repairQuests`, scenes/questBridge.js repair); on the front door the row is drawn, greyed, and says where it
 *  lives - nothing hidden. The confirm is the one sheet every destructive-looking press here takes (`ask`), and the
 *  repair's own line replaces the row's note until the menu is mounted again. */
let questRepairSaid = null;
export const QUEST_REPAIR_NOTE = 'Puts back the people, items, foes and map marks your active quests are missing. Your progress is kept.';
export const QUEST_REPAIR_AWAY = 'In a game: open Settings from the pause menu.';
export const QUEST_REPAIR_ASK = 'Puts back the people, items, foes and map marks your active quests are missing. '
  + 'Nothing a quest did on purpose is undone, and your progress is kept.';
function portRowsGame({ pause = false } = {}) {
  const can = pause && typeof hooks?.repairQuests === 'function';
  const row = el('div', 'row');
  if (!can) row.dataset.live = '0';
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', 'Repair active quests'));
  main.append(el('div', 'row-note', can ? (questRepairSaid ?? QUEST_REPAIR_NOTE) : QUEST_REPAIR_AWAY));
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act rowact', 'Repair');
  if (!can) b.disabled = true;
  b.onclick = () => {
    if (!can) return;
    ask('Repair Active Quests', QUEST_REPAIR_ASK, 'Repair', () => {
      let r = null;
      try { r = hooks.repairQuests(); } catch { r = null; }
      questRepairSaid = r?.text ?? 'The repair could not run here.';
    });
  };
  ctl.append(b, el('span', `tier ${can ? 'live' : 'unavailable'}`));
  row.append(ctl);
  return [row];
}

/** Every port-own row of a category, or none. */
function portRows(catId, opts = {}) {
  if (catId === 'game') return portRowsGame(opts);   // QREPAIR
  if (catId === 'controls') return portRowsControls(opts);   // FT12: the Enhanced category is gone - its switches are the Features home's, its test door the Test Room's
  if (catId === 'interface') return portRowsInterface(opts);
  return [];
}

/** The tiers a category folds: SAVED FOR LATER (stored, unread) and
 *  NOT AVAILABLE HERE (fixed by the browser or a port choice). Each is
 *  a collapsible group with a live count in its heading - nothing is
 *  ever hidden, the beginner sees a short list, the veteran opens the
 *  rest with one press. The fold is remembered per category on the
 *  prefs shelf (uiPrefs isOpen/setOpen), which is what the shelf's
 *  `open` map was made for. */
const TIER_GROUPS = Object.freeze([
  ['stored', 'Saved for later', 'Kept in the file and written back exactly as DFU would; nothing in this build reads it yet.'],
  ['unavailable', 'Not available here', 'Fixed by the browser or by a choice the port made. Each row says what you get instead.'],
]);

function tierGroup(catId, tier, title, blurb, keys) {
  const open = isOpen(catId, tier);
  const g = el('section', `group${open ? ' open' : ''}`);
  const headBtn = el('button', 'group-head');
  headBtn.setAttribute('aria-expanded', String(open));
  headBtn.append(el('span', 'group-title', title), el('span', 'count', String(keys.length)), el('span', 'group-chev', open ? '\u2212' : '+'));
  headBtn.onclick = () => { setOpen(catId, tier, !open); render(); };
  g.append(headBtn);
  if (open) {
    const body = el('div', 'group-body');
    body.append(el('p', 'note', blurb));
    for (const key of keys) put(body, settingRow(key));
    g.append(body);
  }
  return g;
}

/** A category's rows, in order: the port's own, the store keys that do
 *  something here flat (drawsFlat), then the two folded tiers. */
function categoryRows(catId) {
  const keys = paneKeys(catId);   // FT13: the moved keys are the home's
  const out = [...portRows(catId)];
  for (const key of keys) if (drawsFlat(key)) { const r = settingRow(key); if (r) out.push(r); }
  for (const [tier, title, blurb] of TIER_GROUPS) {
    const ks = keys.filter((k) => tierOf(k) === tier);
    if (ks.length) out.push(tierGroup(catId, tier, title, blurb, ks));
  }
  return out;
}

/** FPS-VSYNC: a key the desktop shell reads at its next launch does something here too - drawn flat with the live
 *  ones (never in Quick Settings, whose rows take effect at once). */
function drawsFlat(key) { const t = tierOf(key); return t === 'live' || t === 'restart'; }

/** What the sub-rail counts: the rows that DO something here. */
const liveCount = (catId) => portRows(catId).filter((r) => r.dataset?.live !== '0').length + paneKeys(catId).filter(drawsFlat).length;   // FT13: what is drawn; QREPAIR: a row greyed here does nothing here

/** MWA4: what the Morrowind files do, in the card's one line. */
export const MW_CARD_LINE = 'Your own Morrowind files (Morrowind.bsa and Morrowind.esm, with Tribunal and Bloodmoon if you have them) '
  + 'draw your character in 3D. They stay in this browser.';
/** MWA4: the arms' state in words - the one row the card keeps beside the data count. */
export function morrowindArmsLine(armState) {
  if (armState?.active) return 'On';
  const reason = armState?.reason ?? 'not built';
  return reason === 'not built' || reason === 'unloaded' ? 'Builds when you play' : reason;   // a refusal says why (MWDIAG)
}
/** MWA4: what did not work, in words - and nothing when everything did. */
export function morrowindTroubleLines(armState) {
  const out = [];
  if (armState?.notes?.length) out.push(`Not in the arms: ${armState.notes.join('; ')}`);
  if (armState?.third && !armState.third.ok) out.push(`Third person refused - ${armState.third.stage}: ${armState.third.error}`);
  const e = armState?.esm;
  if (e && !e.raceIsThere) out.push(`Your files carry no "${e.raceWanted}" body (they have: ${e.racesFound.join(', ') || 'none'}).`);
  return out;
}
/** The Morrowind assets card, at the head of the features list (MW-IMPORT, MW-D8, MWA1, MWA4). `count` and
 *  `armState` are the live reads; a test hands its own. */
export function morrowindCard({ count = morrowindDataCount(), armState = fpArm.status() } = {}) {
  // MW-IMPORT: the attach door, ON THIS SURFACE - the launcher window has its M key, but the enhanced skin never
  // routes through it.
  //
  // MWA4 (2026-09-25, before the merge: "reorganize the marrowind attachment selector, remove the on and off button
  // (defunct) and only keep attach and remove data buttons. Only reduce the amount of over explaining text and put it
  // at the top of the feature list"): ATTACHED IS ON. MWA2's On/Off row switched `mwArms`, a pref the online lane forced on at every
  // boot - so online it never stuck, and offline a player who attached the files and never found the row played
  // without them. The files are the switch now: every consumer asks whether they are attached (weaponRig.js
  // autoBuildArms, the peer bodies in world.js), Attach builds the body for a character in play, and Remove data is
  // the off. The card is one line of what the files do, the two readings that matter, and the two buttons; the
  // look-lag switch, the viewer and inspector doors (the pages stand at their addresses) and the per-piece readout
  // left it, and Weapon Sheathing's switch is its own tile's. What did not work still says why (MWDIAG: the reason
  // belongs on the card, next to the button that produced it) - and only then.
  const mw = el('div', 'card');
  mw.append(el('h3', null, 'Morrowind assets'));
  mw.append(el('p', 'meta', MW_CARD_LINE));
  mw.append(stats([
    ['Data', count ? `${count} archive${count === 1 ? '' : 's'} attached` : 'none attached'],
    ...(count ? [['Arms', morrowindArmsLine(armState)]] : []),
  ]));
  const attach = async () => {
    const ds = await import('../scenes/dataSource.js');
    const n = await ds.pickMorrowindFiles();
    // A character in play gets the body now (seconds, once); otherwise the next one made or loaded builds it at its
    // door (autoBuildArms). TR2: the opts come from weaponRig's one home.
    if (n > 0 && playerEntity?.chargenDone) {
      const { buildArmsFor } = await import('../combat/weaponRig.js');
      await buildArmsFor(playerEntity);
    }
    render();
  };
  const actions = [{ label: 'Attach data', primary: !count, onClick: attach }];
  // MWA2 (2026-09-16): the door that removes the data itself - the one off there is now. Routed through the same
  // confirm-before-destroy pattern as Delete Save.
  if (count) {
    actions.push({ label: 'Remove data', onClick: () => ask(
      'Remove Morrowind data',
      'This clears the Morrowind files from this browser and unloads the arms. You can attach them again later.',
      'Remove',
      async () => {
        fpArm.unload();
        const ds = await import('../scenes/dataSource.js');
        await ds.clearStoredMorrowind();
        render();
      },
    ) });
  }
  mw.append(acts(actions));
  for (const line of morrowindTroubleLines(armState)) mw.append(el('p', 'meta', line));
  return mw;
}

/** 2026-09-17 (per-request): a toggle for how OTHER PLAYERS look when you have no Morrowind body of your own to put
 *  them in - the animated class-enemy sprite (Warrior, Mage, Knight, ... - whatever their character's class maps
 *  onto, net/remotePlayers.js classMobileType) by default, or the flat paperdoll every peer used to be drawn as,
 *  unconditionally, before this. A Morrowind body (the Morrowind assets card) still takes priority over either when it
 *  applies - this only decides between the two for a peer standing in neither. */
function peerSpritesCard() {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Other players'));
  c.append(el('p', 'meta',
    'Players without a Morrowind body are drawn as the Eye of the Beholder sprite they picked, or, without one, '
    + 'as their class (a Warrior looks like a Warrior, a Mage like a Mage), moving as they move.'));   // DISC23-B: the chosen set first, the class only for a player without one
  c.append(prefRow('peerClassSprites', 'Animated sprite', 'On: the sprite above. Off: the paperdoll.', { home: true }));
  c.append(prefRow('peerAttackSounds', 'Attack sounds', 'On: hear other players\u2019 weapon swings. Off: silent, no matter how close.', { home: true }));   // PEER-FS1: the two peer-sound switches, beside the sprite one
  c.append(prefRow('peerFootsteps', 'Footstep sounds', 'On: hear other players\u2019 footsteps as they walk. Off: silent, no matter how close.', { home: true }));
  // SPELL-GIFT (2026-09-27, Tabitha: "Allow casting of buffs on players outside party"): the receiver's say
  c.append(prefRow('acceptStrangerSpells', 'Spells from strangers',
    'On: players outside your party can cast healing and protective spells on you - Heal, Regenerate, Cure, Fortify, '
    + 'Shield, Spell Absorption, the resistances, Jumping and Water Breathing, nothing else. Off: only your party can.', { home: true }));
  // REST-OPT (2026-09-27, Tabitha: "Allow party members to choose not to rest with their party")
  c.append(prefRow('restWithParty', 'Rest with my party',
    'On: when a party member within 15 m sleeps a night at a fire, a tent or a bed, you sleep it too, with your own '
    + 'healing. Off: you rest on your own, and the party rests without you.', { home: true }));   // AUDIT REST: REST5's night, no vote
  // TV3 (2026-09-28, bible/06-Systems/Travel-View.md): being SEEN - the region's travellers see where you are
  c.append(prefRow('showToTravellers', 'Show me to travellers in my region',
    'On: when you are outdoors, players in your region see you on the overworld and the map, and you see them. '
    + 'Off: only your party and players nearby know where you are, and you still see those who show themselves. '
    + 'Nothing is shared from indoors except with your party. Kept on this device.', { home: true }));   // AUDIT DEEP2 C5: the party pose rides from indoors too
  return c;
}

/** M-EXT: the replacement packs - music and textures - attach here.
 *  The launcher's row was the only door; FD1 removed the launcher.
 *  DFMOD1: and every pack comes OFF here too - each has a Remove beside its Attach once something is attached,
 *  behind the same confirm Delete Save uses - and Daggerfall Unity .dfmod texture mods (DREAM and its kin) attach
 *  as files, each listed with its own Remove. */
function packsCard() {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Replacement packs'));
  c.append(el('p', 'meta', 'Your own music (a folder of tracks named as DFU\u2019s replacement music expects), sounds, texture packs and Daggerfall Unity texture mods (.dfmod), stored in this browser like ARENA2. Nothing uploads.'));
  let mods = attachedDfmods();
  c.append(el('p', 'meta', `Music files supplied: ${replacementCount()} \u00b7 Texture files supplied: ${textureReplacementCount()} \u00b7 Sound files supplied: ${soundReplacementCount()}`));   // the row reports what the pick covers
  c.append(stats([
    ['Texture mods', mods.length ? `${mods.length} attached \u00b7 ${bundleTextureCount()} textures in use` : 'none'],
  ]));
  /** A removal behind the confirm; a storage failure is logged and costs nothing else. */
  const remove = (label, title, body, run) => ({ label, onClick: () => ask(title, body, 'Remove', async () => {
    try { await run(await import('../scenes/dataSource.js')); } catch (err) { console.warn(`[packs] ${title.toLowerCase()} failed: ${err?.message ?? err}`); }
    render();
  }) });
  const later = ' It takes full effect the next time an area loads.';
  c.append(acts([
    { label: 'Attach music pack', onClick: async () => { const ds = await import('../scenes/dataSource.js'); await ds.pickMusicFolder(); render(); } },
    ...(replacementCount() > 0 ? [remove('Remove music pack', 'Remove music pack', 'This clears your music files from this browser; Daggerfall\u2019s own songs play again. A sound pack stays.', (d) => d.clearStoredMusic())] : []),
    { label: 'Attach sound pack', onClick: async () => { const ds = await import('../scenes/dataSource.js'); await ds.pickSoundFolder(); render(); } },   // SNDREP1
    ...(soundReplacementCount() > 0 ? [remove('Remove sound pack', 'Remove sound pack', 'This clears your sound files from this browser; Daggerfall\u2019s own sounds play again. A music pack stays.', (d) => d.clearStoredSounds())] : []),
    { label: 'Attach texture pack', onClick: async () => { const ds = await import('../scenes/dataSource.js'); await ds.pickTextureFolder(); render(); } },
    ...(textureReplacementCount() > 0 ? [remove('Remove texture pack', 'Remove texture pack', `This clears the loose texture files (a folder pick) from this browser. Attached .dfmod texture mods stay.${later}`, (d) => d.clearStoredTexturePack())] : []),
  ]));
  // IIL3 (Mac: "add a button for attach lighting mod, so players arent confused"): THE LIGHTING MOD HAS ITS OWN
  // SECTION. It is a .dfmod like the texture mods and rides the same store, but it carries no picture - listed among
  // them it read as a texture pack that did nothing. Here it says what it is, whether it is attached, and where it
  // is switched (the Modded lighting row in Features).
  const lighting = mods.filter(isIilMod);
  mods = mods.filter((m) => !isIilMod(m));
  c.append(el('h3', null, 'Lighting mod'));
  c.append(el('p', 'meta', 'Improved Interior Lighting (ShortBeard, or BlazeBlue32\u2019s fixed version): warm, flickering lights in buildings and dungeons, fireplace lights and a warm torch - with shadows if you choose. Pick its .dfmod file (inside the download\u2019s Mods folder). Switch it in Features \u2192 Sight \u2192 Modded lighting.'));
  for (const m of lighting) {
    const row = el('div', 'card');
    row.append(el('p', null, `${m.title}${m.version ? ` ${m.version}` : ''}${m.author ? ` \u00b7 ${m.author}` : ''}`));
    row.append(el('p', 'meta', m.error ? `Not working: ${m.error}.` : 'Attached.'));
    row.append(acts([remove('Remove', `Remove ${m.title}`, `This clears ${m.title} from this browser; the lighting goes back to what it was.`, (d) => d.removeStoredDfmod(m.key))]));
    c.append(row);
  }
  if (!lighting.length) c.append(acts([{ label: 'Attach lighting mod', primary: true, onClick: async () => { const ds = await import('../scenes/dataSource.js'); await ds.pickLightingModFiles(); render(); } }]));
  // DFMOD1: the texture mods, one row each
  c.append(el('h3', null, 'Texture mods (.dfmod)'));
  // DFMOD2: two mods that dress the same things (DREAM and DREAM 90s side by side) cost memory twice for one picture
  const sameTitle = (t) => String(t ?? '').replace(/\b90s\b/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const seen = new Map();
  for (const m of mods) { const k = sameTitle(m.title); seen.set(k, (seen.get(k) ?? 0) + 1); }
  if ([...seen.values()].some((n) => n > 1)) c.append(el('p', 'meta', 'Two versions of the same mod are attached (for example DREAM and DREAM 90s). Only one of them shows for each texture and both use memory - remove one.'));
  c.append(el('p', 'meta', 'Daggerfall Unity texture mods - DREAM\u2019s sprites, NPCs, mobs, paperdoll, portraits, backgrounds and world textures, and mods like them. Pick the .dfmod files themselves; you can pick several at once. Mod scripts do not run.'));
  for (const m of mods) {
    const row = el('div', 'card');
    row.append(el('p', null, `${m.title}${m.version ? ` ${m.version}` : ''}${m.author ? ` \u00b7 ${m.author}` : ''}`));
    row.append(el('p', 'meta', `${m.textures} textures in the bundle`));
    if (m.error) row.append(el('p', 'meta', `Not working: ${m.error}.`));   // DFMOD2: said where the Remove is
    row.append(acts([remove('Remove', `Remove ${m.title}`, `This clears ${m.title} from this browser.${later}`, (d) => d.removeStoredDfmod(m.key))]));
    c.append(row);
  }
  // DFMOD2: TEXTURE DETAIL - the longest side a mod's picture is decoded at (a smaller mip past it). Full-resolution
  // packs (DREAM's HD set) are gigabytes of pixels; 512 keeps them several times Daggerfall's own and inside memory
  const cap = dfmodMaxSize();
  const detailLabel = Number.isFinite(cap) ? `${cap} px` : 'full';
  const nextDetail = () => { const i = DFMOD_DETAIL.indexOf(Number.isFinite(cap) ? cap : 0); return DFMOD_DETAIL[(i + 1) % DFMOD_DETAIL.length]; };
  c.append(el('p', 'meta', `Texture detail: ${detailLabel}. Higher looks sharper and takes more memory and loading time; \u201cfull\u201d can run out of memory with HD packs. A change applies to areas loaded after it.`));
  c.append(acts([
    { label: `Texture detail: ${detailLabel}`, onClick: () => { setPref('dfmodTextureDetail', nextDetail()); render(); } },
    { label: 'Add texture mods', primary: !mods.length, onClick: async () => { const ds = await import('../scenes/dataSource.js'); await ds.pickDfmodFiles(); render(); } },
    ...(mods.length > 1 ? [remove('Remove all texture mods', 'Remove all texture mods', `This clears every attached .dfmod texture mod from this browser.${later}`, (d) => d.clearStoredDfmods())] : []),
  ]));
  return c;
}

/** SNDREP1: the two night sounds a player may want gone - on by default, as Daggerfall has them. Off silences the
 *  sound whether it is the classic one or a sound pack's replacement. */
function nightSoundsCard() {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Night sounds'));
  c.append(prefRow('nightCrickets', 'Crickets', 'On: the crickets chirp outdoors on clear nights. Off: silent.', { home: true }));
  c.append(prefRow('distantHowl', 'Distant howl', 'On: the far-off howl near graveyards. Off: silent.', { home: true }));
  return c;
}

// FT14 (2026-09-15): THE MODS PANE IS GONE. Every vendored mod's
// switch was already a tile on the features home (FT9), and its
// modules and curated dials open inside that tile now, so the pane's
// own reason - "the mod's other knobs live somewhere" - is spent.
//
// Three things it also carried were never mod settings and needed a
// home rather than a deletion: the Morrowind assets card, the texture
// packs' door, and DFU's four switches for ITS mod system. They stand
// under the tiles on the same screen, where a player who came looking
// for "mods" now arrives - the assets card at the head of the list
// since MWA4.
//
// What is NOT drawn any more is the full key list per vendor - that is
// the 360-key scroll the tiles replace, and features.js MOD_CURATED
// carries the reasoning and the door back for a key that earns one.
function modsFooter(body) {
  if (isOnlinePage()) body.append(el('p', 'meta', ONLINE_MODS_NOTE));   // MODS-ONLINE-2: said once, under the tiles - and it says what is actually true of the MODS pane
  body.append(peerSpritesCard()); // 2026-09-17: other players' look, without a Morrowind body of their own
  body.append(packsCard());       // SO1/M-EXT: the packs' door, off the launcher
  body.append(nightSoundsCard()); // SNDREP1: crickets and howl, on or off
  const c = el('div', 'card');
  c.append(el('h3', null, "Daggerfall Unity\u2019s own mod system"));
  for (const key of ['Enhancements/LypyL_ModSystem', 'Enhancements/AssetInjection',
    'Enhancements/CompressModdedTextures', 'Experimental/CustomBooksImport']) {
    put(c, settingRow(key));
  }
  body.append(c);
}

/** One row over a vendored mod's own switch (ROADS 24), writing through
 *  modSettings.js. FT0 lifted it out of paneMods so the features home
 *  draws the same row; `name`/`note` override the mod's own key name and
 *  description when the registry has better words. */
function modRow(vendor, key, def, { name = null, note = null, home = false } = {}) {
  if (!home) { const moved = featureForControl('mods', key, vendor); if (moved) return movedRow(moved); }   // FT2
  const row = el('div', 'row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', name ?? key.replace(/([a-z])([A-Z])/g, '$1 $2')));
  main.append(el('div', 'meta', note ?? def.description));
  row.append(main);
  const ctl = el('div', 'ctl');
  if (isChoiceKey(def)) {
    // UL1: a MultipleChoiceKey (Unleveled Loot's ten materials) -
    // the same stepper, over the option NAMES, wrapping at the ends
    // as a dropdown would.
    const val = el('span', 'val', def.options[modSetting(vendor, key)]);
    const step = (delta, label) => {
      const b = el('button', 'step', label);
      b.onclick = () => { const n = def.options.length; val.textContent = def.options[setModSetting(vendor, key, (modSetting(vendor, key) + delta + n) % n)]; };
      return b;
    };
    ctl.append(step(-1, '\u2039'), val, step(1, '\u203a'));
  } else if (isTextKey(def)) {
    // HT1: a TextKey (Handheld Torches' three bindings) - the value is
    // a Unity KeyCode NAME; the button captures the next key and
    // stores its name, refusing a key Unity has no member for. Escape
    // cancels the capture.
    const b = el('button', 'act rowact', modSetting(vendor, key));
    b.onclick = () => {
      b.textContent = 'press a key';
      if (textKeyCapture) removeEventListener('keydown', textKeyCapture, true);   // DISC28-A: one armed capture at a time
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        removeEventListener('keydown', onKey, true);
        textKeyCapture = null;
        const name = e.code === 'Escape' ? null : keyCodeForDomCode(e.code);
        b.textContent = name ? setModSetting(vendor, key, name) : modSetting(vendor, key);
      };
      textKeyCapture = onKey;
      addEventListener('keydown', onKey, true);
    };
    // AUDIT HCC K4: the clear - every TextKey's reader takes `None` as "no key" (systems/keyCodes.js KEYCODE_NONE),
    // and the capture alone could never write it (Escape cancels). The controls pane's own clear, its own class.
    const clear = el('button', 'act ctl-clear', '\u2715');
    clear.setAttribute('type', 'button');
    clear.title = 'Clear this key';
    clear.onclick = () => { b.textContent = setModSetting(vendor, key, KEYCODE_NONE); };
    ctl.append(b, clear);
  } else if (isTupleKey(def)) {
    // HT1: a TupleIntKey / TupleFloatKey - two steppers, one a half
    const pair = () => modSetting(vendor, key);
    const stepOf = def.tuple === 'int' ? 1 : (def.step ?? 0.1);
    for (const i of [0, 1]) {
      const val = el('span', 'val', String(pair()[i]));
      const step = (delta, label) => {
        const b = el('button', 'step', label);
        b.onclick = () => { const cur = [...pair()]; cur[i] += delta * stepOf; val.textContent = String(setModSetting(vendor, key, cur)[i]); };
        return b;
      };
      ctl.append(step(-1, '\u2039'), val, step(1, '\u203a'));
    }
  } else if (isFloatKey(def)) {
    // WW1: a SliderFloatKey - the same stepper over the key's own step
    const val = el('span', 'val', String(modSetting(vendor, key)));
    const step = (delta, label) => {
      const b = el('button', 'step', label);
      b.onclick = () => { val.textContent = String(setModSetting(vendor, key, modSetting(vendor, key) + delta * (def.step ?? 0.1))); };
      return b;
    };
    ctl.append(step(-1, '\u2039'), val, step(1, '\u203a'));
  } else if (isIntKey(def)) {
    // DS1: a SliderIntKey (Dynamic Skies' fog density and snow
    // sizes) - the HUD-scale stepper's shape, over the key's own
    // range, the value beside it.
    const val = el('span', 'val', String(modSetting(vendor, key)));
    const step = (delta, label) => {
      const b = el('button', 'step', label);
      b.onclick = () => { val.textContent = String(setModSetting(vendor, key, modSetting(vendor, key) + delta)); };
      return b;
    };
    ctl.append(step(-1, '\u2039'), val, step(1, '\u203a'));
  } else {
    const on = modSetting(vendor, key);
    const b = el('button', 'act rowact', on ? 'On' : 'Off');
    if (on) b.classList.add('primary');
    b.onclick = () => { setModSetting(vendor, key, !modSetting(vendor, key)); render(); };
    const ground = onlineModSetting(vendor, key);   // MODS-ONLINE-2: the road switches the room's ground depends on; REALM P0.2: and every key of a balance mod the room owns whole
    if (ground !== undefined) lockOnline(b, null, { note: modLockNote(vendor, key), value: ground });   // MODS-ONLINE-5: the ground's, the ruleset's or the shared reason - a lock that gives the wrong reason is a refusal nobody can read
    ctl.append(b);
  }
  // REALM P0.2: a DIAL the room owns online (a balance mod owned whole: Unleveled Loot's materials, Oblivion leveling's
  // points) wears the lock too - the switch above locks itself
  if ((isChoiceKey(def) || isTextKey(def) || isTupleKey(def) || isFloatKey(def) || isIntKey(def)) && onlineModSetting(vendor, key) !== undefined) lockDial(ctl, modLockNote(vendor, key));
  row.append(ctl);
  return row;
}

// ── FT0: FEATURES ───────────────────────────────────────────────
// ONE LIST over the three stores. A row is drawn by the builder its
// store already has - prefRow/choiceRow over uiPrefs, settingRow over
// DFU's keys, modRow over a mod's - so every law those rows carry
// (write-through, the default-drop, the coarse step) is untouched; the
// home adds the kind labels, the registry's words, and the chip row.
// The registry (systems/features.js) is empty at FT0 and fills one
// audited slice at a time; an empty list says so rather than hiding
// the section (the rail-hole law, SECTIONS_BOOT).
// ── FT14: ONE ROOF (2026-09-15, Mac: "get rid of the mod panel and
// integrate certain feature/mod adjustments into the toggle themselves
// and move away from the scrolling list format") ──────────────────
//
// THE THESIS: there are no switches. Every control is a BAR, and Off
// is simply its first segment. A two-state row and a four-state row
// are then the same object at two widths, so the eye learns one
// control and the panel stops alternating between a toggle and a
// stepper depending on which store a row happens to sit in.
//
// What that buys is the tile. A row had to be a row because the switch
// sat at the right margin and the words ran to meet it; a bar sits
// UNDER its name, so the whole thing fits a card, and cards tile.
// Twenty-eight of them stand in a grid on one screen where the list
// scrolled, and the note that made each row tall moves to the reading
// rail, which shows the one tile you are pointed at.
//
// And the Mods pane is gone. A mod's modules and its curated dials
// (systems/features.js MOD_CURATED) open INSIDE its tile, drawn by the
// same `modRow` the pane used - no second copy of anything, and the
// player never leaves this screen.

/** FT14: the STATES of a row, whatever store it lives in - the one
 *  adapter the bar reads. `labels` are the segments in order, `at` is
 *  the live one, `set(i)` writes through that store's own door, and
 *  `locked` is OL1's forced answer (the lane decides, the bar shows it
 *  and refuses the press). A store that cannot answer in segments -
 *  a colour, a free number - is not given a bar; `null` sends the row
 *  back to its own builder, which is how the panel stays honest about
 *  the controls it has not learned yet. */
export function tileStates(f) {   // FT18: exported for the All off pins, which read and press the bars through it
  const c = resolveControl(f);
  if (c.store === 'prefs') {
    const locked = onlineForcedPref(c.key) !== undefined;
    if (c.tiers) {
      const cur = String(c.read ? c.read() : getPref(c.key));
      // BLOOD AUDIT 5: a stored value that is no tier reads as the row's
      // DEFAULT, which is what the game runs - not the first segment
      const fallback = Math.max(0, c.tiers.findIndex(([v]) => String(v) === String(c.default ?? c.initial)));
      const found = c.tiers.findIndex(([v]) => String(v) === cur);
      const at = found >= 0 ? found : fallback;
      return { labels: c.tiers.map(([, l]) => l), at, locked,
        set: (i) => (c.write ?? ((v) => setPref(c.key, v)))(c.tiers[i][0]) };
    }
    return { labels: ['Off', 'On'], at: getPref(c.key) ? 1 : 0, locked,
      set: (i) => { setPref(c.key, i === 1); TILE_AFTER[c.key]?.(); } };
  }
  if (c.store === 'settings') {
    const [sec, k] = c.key.split('/');
    const raw = effective()[sec]?.[k];
    const w = widgetFor(c.key);
    if (w === 'switch') {
      return { labels: ['Off', 'On'], at: raw === 'True' ? 1 : 0, locked: false,
        set: (i) => write(c.key, i === 1 ? 'True' : 'False') };
    }
    if (w === 'enum' && ENUM_LAW[c.key]?.encode === 'index') {
      const vals = ENUM_LAW[c.key].values;
      const i = parseInt(raw, 10);
      return { labels: vals, at: Number.isInteger(i) && i >= 0 && i < vals.length ? i : 0, locked: false,
        set: (n) => write(c.key, String(n)) };
    }
    return null;
  }
  // a vendored mod's Enabled - the player's online too (MODS-ONLINE-2), but for the road switches the room's ground depends on
  const on = modSetting(c.vendor, c.key) === true || modSetting(c.vendor, c.key) === 'True';
  return { labels: ['Off', 'On'], at: on ? 1 : 0,
    locked: onlineForcedModSetting(c.vendor, c.key) !== undefined,
    set: (i) => setModSetting(c.vendor, c.key, i === 1) };
}

/** DISC23-C: the segment that turns a feature off is the one that SAYS so. */
export const OFF_LABEL = 'Off';

/** FT18: the segment All off presses on a tile - the row's declared `classic` (Daggerfall's own, on a row with no
 *  Off: the land's radius, the dungeon walls' Classic), else the segment that says Off; -1 for a CHOICE with neither,
 *  which All off leaves as it is (a grass style is not on or off). */
export function classicSegment(f, st) {
  const c = resolveControl(f);
  if (c?.classic !== undefined) {
    const i = c.store === 'settings' ? c.classic : (c.tiers ?? []).findIndex(([v]) => String(v) === String(c.classic));
    return i >= 0 && i < st.labels.length ? i : -1;
  }
  return st.labels.indexOf(OFF_LABEL);
}

/** FT18: what a prefs switch does besides writing itself, when a tile moves it. WS1's holster is rebuilt into the
 *  standing body: the Morrowind card's own row that did it stopped drawing at FT13 (the key moved here, and
 *  `prefRow` answers nothing for a moved key), so since then the tile wrote the pref and the body kept the old
 *  holster until the next build - while the row's effect line promised it at once. */
const TILE_AFTER = Object.freeze({
  mwSheathing: async () => {
    if (!morrowindDataCount() || !playerEntity?.chargenDone) return;   // MWA4: attached is on - a character in play wears it
    const { buildArmsFor } = await import('../combat/weaponRig.js');
    await buildArmsFor(playerEntity);
    render();
  },
});

/**
 * DISC23-C (Skeptikali on Discord: "if a feature would be enabled, the ON button would turn Green, and if a feature
 * would be disabled, the OFF button would turn Red"): what a bar says about its feature. A bar with an Off segment
 * is a SWITCH - on whenever any other segment is pressed; a bar with none (Pixel / Smooth, a DFU filter mode) is a
 * CHOICE, and its feature is never off.
 *
 * FT14 read "off" by POSITION - the first segment - and that was wrong wherever the Off is not first: Grass Density
 * runs Full, Half, Quarter, Off, so at Full its tile read off and at Off it read on. The label is what the player
 * reads, the same across all three stores (a pref's tiers, a DFU enum's values, a boolean's Off / On).
 * @param {{labels: string[], at: number}} st
 * @returns {{off: number, switch: boolean, on: boolean}}
 */
export function barReading(st) {
  const off = st.labels.indexOf(OFF_LABEL);
  return { off, switch: off >= 0, on: off < 0 || st.at !== off };
}

/** FT14: the bar. One object for two states or five. */
function segBar(st, label) {
  const r = barReading(st);
  const seg = el('div', `ft-seg${r.switch ? ' ft-seg-switch' : ''}${st.locked ? ' locked' : ''}`);
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', label);
  st.labels.forEach((L, i) => {
    const b = el('button', `ft-segb${i === r.off ? ' off' : ''}`, L);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(i === st.at));
    if (st.locked) {
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
      b.title = ONLINE_LOCK_NOTE;
    } else {
      b.onclick = (e) => { e.stopPropagation(); st.set(i); render(); };
    }
    seg.append(b);
  });
  return seg;
}

/** FT14: which tile the reading rail is showing, and which tile has its
 *  drawer open. Both survive a `render()`, so pressing a segment does
 *  not close the drawer you pressed it in. */
let featureSel = null;
let featureOpen = null;

/** FT14: one feature, as a tile. (Exported for DISC23-C's pins, which press its bar against a fake document.) */
export function featureTile(f) {
  const c = resolveControl(f);
  const st = tileStates(f);
  const t = el('div', `ft-tile${featureSel === f.id ? ' sel' : ''}`);
  t.dataset.fid = f.id;   // FT18: the search hides tiles by it
  t.dataset.on = st && barReading(st).on ? '1' : '0';
  if (st?.locked) t.dataset.locked = '1';
  t.tabIndex = 0;
  const show = () => { featureSel = f.id; paintRail(); for (const n of document.querySelectorAll('.ft-tile')) n.classList.toggle('sel', n === t); };
  t.onmouseenter = show;
  t.onfocus = show;
  t.onclick = show;

  t.append(el('div', 'ft-tile-name', f.title));
  const meta = el('div', 'ft-tile-meta');
  for (const k of KIND_ORDER) if (f.kinds.includes(k)) meta.append(el('span', `kind ${k}`, KINDS[k].label));
  if (st?.locked) meta.append(el('span', 'ft-tile-lock', 'online'));
  t.append(meta);

  // the control, or the row's own builder when it is not a bar
  if (st) t.append(segBar(st, f.title));
  else t.append(featureRow(f));

  // the drawer's door: a mod's modules and dials.
  //
  // AUDIT FT14: the vendor is the row's OWN when it has one, and
  // otherwise the one it COVERS. A condensed row (FT2's `also`) drives
  // a mod's switch without living in the mods store - Enhanced
  // environments is Dynamic Skies' Enabled, through its three-way -
  // and reading `c.vendor` alone left that mod's five particle keys
  // with no tile to open once the Mods pane was gone. `also` already
  // declared the cover; the drawer follows it.
  const vendor = c.store === 'mods' ? c.vendor
    : (Array.isArray(c.also) ? c.also.find((a) => a.store === 'mods')?.vendor : null) ?? null;
  if (vendor) {
    const mods = modModules(vendor);
    const dials = modDials(vendor);
    const keys = modKeyRows(vendor, bindings());   // UXB1-F
    if (mods.length || dials.length || keys.length) {
      const open = featureOpen === f.id;
      const b = el('button', 'ft-tile-more');
      b.type = 'button';
      b.setAttribute('aria-expanded', String(open));
      b.append(el('span', `ft-tile-car${open ? ' open' : ''}`, '\u203a'), document.createTextNode(' '
        + [mods.length ? `${mods.length} modules` : '', dials.length ? `${dials.length} dials` : '',
          keys.length ? `${keys.length} keys` : '']
          .filter(Boolean).join(' \u00b7 ')));
      b.onclick = (e) => { e.stopPropagation(); featureOpen = open ? null : f.id; render(); };
      t.append(b);
      if (open) t.append(featureDrawer(vendor, mods, dials, keys));
    }
  }
  // FT18: a condensed row's PARTS - the switches and the choice it folded in (the blood's three, the wind's two, the
  // grass's style), each its own in the drawer, so nothing a tile used to offer was lost when the tiles merged.
  const parts = c.store === 'prefs' && Array.isArray(c.parts) ? c.parts : [];
  if (parts.length) {
    const open = featureOpen === f.id;
    const b = el('button', 'ft-tile-more');
    b.type = 'button';
    b.setAttribute('aria-expanded', String(open));
    b.append(el('span', `ft-tile-car${open ? ' open' : ''}`, '\u203a'), document.createTextNode(` ${parts.map((pt) => pt.label).join(' \u00b7 ')}`));
    b.onclick = (e) => { e.stopPropagation(); featureOpen = open ? null : f.id; render(); };
    t.append(b);
    if (open) t.append(featurePartsDrawer(parts));
  }
  return t;
}

/** UXB1-F (2026-09-25, the UX backlog: "Show keybinds for game features, even if they cannot be changed there (Drop
 *  torch/summon horse/summon cart)"): the tile's door to where its keys ARE changed - Settings, Controls. */
export const FEATURE_KEYS_NOTE = 'Keys are changed in Settings \u203a Controls.';
function openControls() {
  category = 'controls';
  go('settings');
}

/** FT18: what a condensed row's tile opens - its switch parts as chips (the modules' shape), its choice parts as
 *  bars (the tile's own shape). Each writes its own pref, as the row it came from did. */
function featurePartsDrawer(parts) {
  const d = el('div', 'ft-tile-drawer');
  d.onclick = (e) => e.stopPropagation();
  const chips = parts.filter((pt) => !pt.tiers);
  if (chips.length) {
    const box = el('div', 'ft-chipset');
    for (const pt of chips) {
      const on = getPref(pt.key) !== false;
      const b = el('button', 'ft-mchip', pt.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      if (onlineForcedPref(pt.key) !== undefined) { b.disabled = true; b.title = ONLINE_LOCK_NOTE; }
      else b.onclick = () => { setPref(pt.key, !on); render(); };
      box.append(b);
    }
    d.append(box);
  }
  for (const pt of parts.filter((x) => x.tiers)) {
    d.append(el('div', 'ft-drawer-label', pt.label));
    const cur = String(getPref(pt.key));
    d.append(segBar({ labels: pt.tiers.map(([, l]) => l), at: Math.max(0, pt.tiers.findIndex(([v]) => String(v) === cur)),
      locked: onlineForcedPref(pt.key) !== undefined, set: (i) => setPref(pt.key, pt.tiers[i][0]) }, pt.label));
  }
  return d;
}

// ── FT18: ALL OFF, AND BACK (Mac: "Add option to set all mods/enhancements off") ──
// One press sets every tile to Off - or, on a row with no Off, to the value that is Daggerfall's own - and keeps
// what each tile it moved had been, so Restore puts it back. The keep is a PREF, not this screen's memory: a player
// who turns everything off, plays, and quits comes back to a Restore that still knows. A tile the online room
// decides is not touched (its bar refuses the press too), and a CHOICE with neither Off nor a classic value stays.
export const FEATURES_RESTORE_PREF = 'featuresRestore';
export const ALL_OFF_ASK = 'Every mod and enhancement goes to Off, or to Daggerfall\u2019s own where a row has no Off. '
  + 'Restore puts back what you had. Choices that are never off, like the grass\u2019s style, stay as they are, and '
  + 'online the rows the room decides stay on.';
/** The moves All off makes: every tile not already at its classic segment and not locked. */
export function allOffPlan(list = FEATURES) {
  const plan = [];
  for (const f of list) {
    const st = tileStates(f);
    if (!st || st.locked) continue;
    const to = classicSegment(f, st);
    if (to >= 0 && to !== st.at) plan.push({ f, st, to });
  }
  return plan;
}
/** All off. A second press keeps the FIRST press's values, so Restore always goes back to before the first. */
export function featuresAllOff(list = FEATURES) {
  const plan = allOffPlan(list);
  const saved = getPref(FEATURES_RESTORE_PREF);
  const keep = saved && typeof saved === 'object' ? { ...saved } : {};
  for (const { f, st } of plan) if (!Object.hasOwn(keep, f.id)) keep[f.id] = st.labels[st.at];
  for (const { st, to } of plan) st.set(to);
  if (Object.keys(keep).length) setPref(FEATURES_RESTORE_PREF, keep);
  return plan.length;
}
/** Restore: every kept tile back to the segment it had, by its label; the keep is spent. */
export function featuresRestore(list = FEATURES) {
  const keep = getPref(FEATURES_RESTORE_PREF);
  let n = 0;
  if (keep && typeof keep === 'object') {
    for (const f of list) {
      if (!Object.hasOwn(keep, f.id)) continue;
      const st = tileStates(f);
      if (!st || st.locked) continue;
      const i = st.labels.indexOf(keep[f.id]);
      if (i >= 0 && i !== st.at) { st.set(i); n++; }
    }
  }
  setPref(FEATURES_RESTORE_PREF, null);
  return n;
}

/** FT14: what a mod's tile opens - its modules as chips, its curated
 *  dials as the same `modRow` the Mods pane drew. The keys NOT here
 *  keep the values the mod ships (features.js MOD_CURATED says why). */
function featureDrawer(vendor, mods, dials, keys = []) {
  const d = el('div', 'ft-tile-drawer');
  d.onclick = (e) => e.stopPropagation();
  // UXB1-F: a mod's keys, first - read-only here (KB1 bound them in Controls, where a clash can be seen), in the live
  // bindings, with the one press that goes to where they change.
  if (keys.length) {
    d.append(el('div', 'ft-drawer-label', 'Keys'));
    for (const k of keys) {
      const row = el('div', 'row ft-keyrow');
      const main = el('div', 'row-main');
      main.append(el('div', 'row-name', k.label));
      row.append(main);
      const ctl = el('div', 'ctl');
      ctl.append(el('span', 'val ft-key', k.key));
      row.append(ctl);
      d.append(row);
    }
    const to = el('button', 'act ft-keys-to', 'Change in Controls');
    to.type = 'button';
    to.title = FEATURE_KEYS_NOTE;
    to.onclick = () => openControls();
    d.append(to);
  }
  if (mods.length) {
    d.append(el('div', 'ft-drawer-label', 'Modules'));
    const box = el('div', 'ft-chipset');
    for (const key of mods) {
      const on = modSetting(vendor, key) === true;
      const b = el('button', 'ft-mchip', key.slice('Modules.'.length).replace(/([a-z])([A-Z])/g, '$1 $2'));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      b.onclick = () => { setModSetting(vendor, key, !on); render(); };
      box.append(b);
    }
    d.append(box);
  }
  if (dials.length) {
    d.append(el('div', 'ft-drawer-label', 'Dials'));
    for (const key of dials) d.append(modRow(vendor, key, MOD_SETTINGS[vendor].keys[key], { home: true }));
  }
  return d;
}

/** FT14: the reading rail - the note and the effect line the tiles no
 *  longer carry, for whichever tile is pointed at. */
function paintRail(rail = document.getElementById('ft-rail')) {
  // the pane is still DETACHED while paneFeatures builds it, so the
  // first paint is handed its rail rather than looking one up - by id
  // it found nothing and the rail stood empty until the first hover.
  if (!rail) return;
  const f = FEATURES.find((x) => x.id === featureSel) ?? null;
  rail.textContent = '';
  if (!f) { rail.append(el('p', 'meta', 'Point at a tile to read what it does.')); return; }
  const c = resolveControl(f);
  rail.append(el('div', 'ft-rail-k', 'Selected'));
  rail.append(el('h3', null, f.title));
  if (f.note) rail.append(el('p', 'ft-rail-note', f.note));
  if (f.effect) rail.append(el('p', 'ft-rail-effect', f.effect));
  const kv = el('dl', 'ft-rail-kv');
  const pair = (k, v) => { kv.append(el('dt', null, k), el('dd', null, v)); };
  pair('Stored', c.store === 'prefs' ? 'Port preferences'
    : c.store === 'mods' ? `${MOD_SETTINGS[c.vendor].title}\u2019s own modsettings`
      : 'Daggerfall Unity settings.ini');
  const rv = c.store === 'mods' ? c.vendor
    : (Array.isArray(c.also) ? c.also.find((a) => a.store === 'mods')?.vendor : null) ?? null;
  if (rv) {
    const n = Object.keys(MOD_SETTINGS[rv].keys).length;
    const shown = 1 + modModules(rv).length + modDials(rv).length;
    pair('Settings', `${shown} of ${n} shown \u2013 the rest keep the mod\u2019s own values`);
    // UXB1-F: and its keys, where a player reading about the mod is already looking
    const keys = modKeyRows(rv, bindings());
    if (keys.length) pair('Keys', `${keys.map((k) => `${k.label}: ${k.key}`).join(' \u00b7 ')} \u2013 ${FEATURE_KEYS_NOTE}`);
  }
  rail.append(kv);
}

function paneFeatures(body) {
  const counts = featureCounts(FEATURES);
  const chips = el('div', 'chips');
  const chip = (kind, label, n) => {
    const b = el('button', `chip${kind ? ` ${kind}` : ''}${featureKind === kind ? ' on' : ''}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(featureKind === kind));
    b.append(document.createTextNode(label), el('span', 'n', String(n)));
    b.onclick = () => { featureKind = kind; render(); };
    return b;
  };
  chips.append(chip(null, 'All', counts.all));
  for (const k of KIND_ORDER) chips.append(chip(k, KINDS[k].label, counts[k]));
  body.append(chips);
  // FT18: the search (Mac: "Add search bar to mods/enhancements in the ingame pause menu") and All off beside it.
  // The search hides tiles in place rather than repainting, so the field keeps the keys it is typed into; the menu's
  // own key handler stands down for a text field, and the hosts' KB1 gate keeps its keys from the game.
  const tools = el('div', 'ft-tools');
  const search = el('input', 'ft-search');
  search.type = 'search';
  search.placeholder = 'Search features';
  search.setAttribute('aria-label', 'Search features');
  search.value = featureQuery;
  tools.append(search);
  const kept = getPref(FEATURES_RESTORE_PREF);
  tools.append(acts([
    { label: 'All off', onClick: () => ask('Turn Everything Off', ALL_OFF_ASK, 'All off', () => { featuresAllOff(); }) },
    ...(kept && typeof kept === 'object' ? [{ label: 'Restore', onClick: () => { featuresRestore(); render(); } }] : []),
  ]));
  body.append(tools);
  if (!FEATURES.length) {
    body.append(empty('Nothing here yet',
      'Every enhanceable feature is moving here, one at a time, each audited before it moves. '
      + 'Until then the port\u2019s own switches are under Settings \u203a Enhanced and the mods\u2019 under Mods.'));
    return;
  }
  const rows = filterFeatures(FEATURES, featureKind);
  if (!rows.length) {
    body.append(empty(`No ${KINDS[featureKind].label} rows yet`, KINDS[featureKind].blurb));
    return;
  }
  // FT14: two panes - the tiles, grouped by what they change, and the
  // rail that reads out whichever one is pointed at. The kind is a
  // FILTER (the chips above) and no longer a heading, because "who
  // wrote it" does not group anything a player is looking for.
  if (featureSel && !rows.some((f) => f.id === featureSel)) featureSel = null;   // the filter took the selected tile away
  body.classList.add('wide');   // FT14: .body is capped at 720px for READING; a tile grid is scanned, not read
  const panes = el('div', 'ft-panes');
  const main = el('div', 'ft-main');
  const shownGroups = [];   // FT18: what the search walks
  for (const g of GROUP_ORDER) {
    const items = rows.filter((f) => f.group === g);
    if (!items.length) continue;
    const head = el('div', 'ft-grouphead');
    const gn = el('span', 'ft-gn', String(items.length));
    head.append(el('h2', null, GROUPS[g].label), gn, el('span', 'ft-gline'));
    main.append(head);
    const grid = el('div', 'ft-grid');
    const tiles = items.map((f) => [f, featureTile(f)]);
    for (const [, t] of tiles) grid.append(t);
    main.append(grid);
    shownGroups.push({ head, grid, gn, tiles });
  }
  const none = el('p', 'meta ft-none', 'Nothing here matches that. Try a shorter word, or the mod\u2019s author.');
  main.append(none);
  /** FT18: hide what the query does not find - a tile, and a group left with none; the group's count is what shows. */
  const applyQuery = () => {
    let shown = 0;
    for (const g of shownGroups) {
      let n = 0;
      for (const [f, t] of g.tiles) { const hit = matchesFeatureQuery(f, featureQuery); t.hidden = !hit; if (hit) n++; }
      g.head.hidden = !n;
      g.grid.hidden = !n;
      g.gn.textContent = String(n);
      shown += n;
    }
    none.hidden = shown > 0;
  };
  search.oninput = () => { featureQuery = search.value; applyQuery(); };
  applyQuery();
  const rail = el('aside', 'ft-rail');
  rail.id = 'ft-rail';
  rail.setAttribute('aria-live', 'polite');
  panes.append(main, rail);
  if (featureKind == null || featureKind === 'mod') body.append(morrowindCard());   // MWA4: the assets card heads the list
  body.append(panes);
  if (!featureSel) featureSel = rows[0].id;
  paintRail(rail);
  if (featureKind == null || featureKind === 'mod') modsFooter(body);   // FT14: what the Mods pane carried that was never a mod setting
}

// ── OVH1 (2026-09-24, Mac: "A new option on the main menu that opens to show 3 large panels. These panels will
// have directional arrows allowing you to switch being different feature sets") - THE OVERHAULS PANE. Three cards,
// one look each (systems/overhauls.js is the registry and the only writer): the arrows BROWSE, the button WEARS, so a
// look that reloads the game is never worn by a stray arrow press. The card a player is browsing survives a render.
const ovhAt = {};   // panel id -> the option index being shown
/** The picture a look carries: a UI pack's own art, else its emblem. */
function overhaulPicture(p, o, inUse) {
  const pic = el('div', 'look-pic');
  pic.dataset.look = o.id;
  const pack = p.id === 'ui' ? UI_PACKS[o.pack] : null;
  if (pack) {
    const img = el('img');
    img.alt = `${o.name}: the inventory`;
    img.loading = 'lazy';
    img.src = packUrl(pack, 'Img/INVE00I0.IMG.png');
    pic.append(img);
  } else {
    const em = el('div', 'look-emblem', o.name);
    em.append(el('small', null, p.title.replace(/ Overhaul$/, '')));
    pic.append(em);
  }
  if (inUse) pic.append(el('span', 'look-badge', 'In use'));
  return pic;
}
function overhaulPanel(p) {
  if (!p.options.length) {   // OVH1b: a panel with nothing in it yet - its title, an empty picture, one line
    const card = el('section', 'look-panel look-empty');
    card.dataset.panel = p.id;
    card.dataset.state = 'empty';
    card.setAttribute('aria-label', p.title);
    const pic = el('div', 'look-pic');
    pic.append(el('div', 'look-emptyline', p.empty));
    card.append(el('h2', 'look-title', p.title), pic);
    return card;
  }
  const cur = currentOption(p);
  const n = p.options.length;
  const at = ((ovhAt[p.id] ?? Math.max(0, p.options.indexOf(cur))) % n + n) % n;
  const o = p.options[at];
  const card = el('section', 'look-panel');
  card.dataset.panel = p.id;
  card.dataset.state = !cur ? 'custom' : o === cur ? 'on' : 'browse';
  card.setAttribute('aria-label', p.title);
  card.tabIndex = 0;
  const go = (d) => { ovhAt[p.id] = (at + d + n) % n; render(); document.querySelector(`.look-panel[data-panel="${p.id}"]`)?.focus(); };
  card.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  };
  card.append(el('h2', 'look-title', p.title), overhaulPicture(p, o, o === cur));
  const nav = el('div', 'look-nav');
  const arrow = (d, glyph, word) => {
    const b = el('button', 'look-arrow', glyph);
    b.type = 'button';
    b.setAttribute('aria-label', `${word} ${p.title.toLowerCase()} look`);
    b.disabled = n < 2;
    b.onclick = (e) => { e.stopPropagation(); go(d); };
    return b;
  };
  const mid = el('div');
  mid.setAttribute('aria-live', 'polite');
  mid.append(el('div', 'look-name', o.name), el('div', 'look-by', o.by));
  const dots = el('div', 'look-dots');
  p.options.forEach((x, i) => dots.append(el('span', `look-dot${i === at ? ' at' : ''}${x === cur ? ' on' : ''}`)));
  mid.append(dots);
  nav.append(arrow(-1, '‹', 'Previous'), mid, arrow(1, '›', 'Next'));
  card.append(nav, el('p', 'look-blurb', o.blurb));
  // PLUS2: ENHANCED PLUS'S COLOURS - offered on its own card while it is the look in use (they are its surfaces, and
  // they change at once, no reload). One swatch per stone; the chosen one is pressed.
  if (p.id === 'ui' && o.id === 'enhanced-plus' && o === cur) {
    const row = el('div', 'look-colours');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Enhanced Plus colour');
    row.append(el('span', 'look-colours-label', 'UI colour'));   // Mac, 2026-09-29
    const now = plusTheme();
    for (const [id, th] of Object.entries(PLUS_THEMES)) {
      const b = el('button', 'look-colour');
      b.type = 'button';
      b.title = th.name;
      b.setAttribute('aria-pressed', String(id === now));
      const chip = el('i', 'look-colour-chip');
      chip.style.background = th.swatch;
      b.append(chip, el('span', null, th.name));
      b.onclick = (e) => { e.stopPropagation(); setPlusTheme(id); render(); };
      row.append(b);
    }
    card.append(row);
    // PLUS6: the gauntlet cursor, on or off - worn at once
    const crow = el('div', 'look-colours');
    crow.setAttribute('role', 'group');
    crow.setAttribute('aria-label', 'Enhanced Plus cursor');
    crow.append(el('span', 'look-colours-label', 'Cursor'));
    for (const [on, label] of [[true, 'Gauntlet'], [false, 'System']]) {
      const b = el('button', 'look-colour', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(plusCursorOn() === on));
      b.onclick = (e) => { e.stopPropagation(); setPlusCursor(on); render(); };
      crow.append(b);
    }
    card.append(crow);
    // PLUS7: the inventory's hover card, on or off (the right-click menu stays either way)
    const hrow = el('div', 'look-colours');
    hrow.setAttribute('role', 'group');
    hrow.setAttribute('aria-label', 'Item info on hover');
    hrow.append(el('span', 'look-colours-label', 'Item info on hover'));
    for (const [on, label] of [[true, 'On'], [false, 'Off']]) {
      const b = el('button', 'look-colour', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String((getPref('plusItemHover') !== false) === on));
      b.onclick = (e) => { e.stopPropagation(); setPref('plusItemHover', on); render(); };
      hrow.append(b);
    }
    card.append(hrow);
    card.append(plusControllerRows());   // PADPLUS1
  }
  const use = el('button', 'act primary look-use', o === cur ? 'In use' : `Use ${o.name}`);
  use.type = 'button';
  use.disabled = o === cur;
  use.onclick = () => {
    const r = o.apply();
    if (r?.reload) { location.replace(r.url); return; }
    render();
  };
  card.append(use);
  if (!cur) card.append(el('p', 'look-note', 'Custom: your own mix from Features. Using a look sets every switch it covers.'));
  const forced = isOnlinePage() && p.online ? p.online : null;
  card.append(el('p', 'look-note', forced ? `${p.effect} ${forced}` : p.effect));
  return card;
}
/** PADPLUS1: THE CONTROLLER ON THE PLUS CARD - the crossbar switch, run as a toggle or a hold, the layout at a glance
 *  in the pad's own glyphs, and the button that puts every row of it back. PADPLUS10: the legend reads the LIVE
 *  bindings and d-pad (the player sets them in the Controller bindings window, opened here). */
function plusControllerRows() {
  const wrap = el('div', 'look-padplus');
  const row = (label, opts, now, set) => {
    const r = el('div', 'look-colours');
    r.setAttribute('role', 'group');
    r.setAttribute('aria-label', label);
    r.append(el('span', 'look-colours-label', label));
    for (const [v, word] of opts) {
      const b = el('button', 'look-colour', word);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(now === v));
      b.onclick = (e) => { e.stopPropagation(); set(v); render(); };
      r.append(b);
    }
    return r;
  };
  const xb = ['on', 'off'].includes(getPref('plusCrossbar')) ? getPref('plusCrossbar') : 'auto';
  wrap.append(row('Controller crossbar', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], xb, (v) => setPref('plusCrossbar', v)));
  wrap.append(row('Left stick run', [[true, 'Toggle'], [false, 'Hold']], getPref('plusToggleRun') !== false, (v) => setPref('plusToggleRun', v)));
  const fam = livePadFamily() ?? 'xbox';
  const legend = el('div', 'look-padlegend');
  legend.setAttribute('aria-label', 'Controller layout');
  for (const [codes, word] of plusPadLegend(liveBindings())) {
    const it = el('div', 'look-paditem');
    for (const c of codes) { const im = el('img'); im.src = hdGlyphSvg(fam, c, { size: 40 }) ?? ''; im.alt = hdGlyphName(fam, c); it.append(im); }
    it.append(el('span', null, word));
    legend.append(it);
  }
  wrap.append(legend);
  // PADPLUS10: the separate window - buttons, the d-pad's tap and hold, the sticks' sensitivity
  const binds = el('button', 'act primary look-padbinds', 'Controller bindings\u2026');
  binds.type = 'button';
  binds.onclick = (e) => {
    e.stopPropagation();
    openPlusPadBinds();
    globalThis.addEventListener?.('plus-padbinds-closed', () => render(), { once: true });   // the legend shows what was set
  };
  wrap.append(binds);
  const reset = el('button', 'act look-padreset', 'Reset controller layout');
  reset.type = 'button';
  reset.onclick = (e) => { e.stopPropagation(); resetPlusPadLayout(liveBindings()); resetPlusDpad(); render(); };   // PADPLUS10: and the d-pad's tap/hold
  wrap.append(reset);
  if (!document.getElementById('look-padplus-style')) {
    const st = document.createElement('style');
    st.id = 'look-padplus-style';
    st.textContent = `.look-padlegend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; margin: 8px 0; font-size: 12px; }
.look-paditem { display: flex; align-items: center; gap: 6px; min-width: 0; }
.look-paditem img { width: 20px; height: 20px; flex: 0 0 auto; }
.look-paditem span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.look-padreset { margin: 2px 0 6px; }
.look-padbinds { margin: 2px 8px 6px 0; }`;
    document.head.append(st);
  }
  return wrap;
}

function paneOverhauls(body) {
  body.classList.add('wide');
  const grid = el('div', 'look-grid');
  for (const p of OVERHAUL_PANELS) grid.append(overhaulPanel(p));
  body.append(grid);
}

/** The kind labels a row wears, in KIND_ORDER whatever order the row lists them. */
function kindTags(kinds) {
  const w = el('div', 'kinds');
  for (const k of KIND_ORDER) if (kinds.includes(k)) w.append(el('span', `kind ${k}`, KINDS[k].label));
  return w;
}

/** One registry row, drawn by its store's own builder and dressed. */
function featureRow(f) {
  const c = resolveControl(f);   // RF4: the lane's tiers/read/write folded in
  let row;
  if (c.store === 'prefs') {
    row = c.tiers ? choiceRow(c.key, f.title, f.note, c.tiers, { home: true, read: c.read, write: c.write }) : prefRow(c.key, f.title, f.note, { home: true });
  } else if (c.store === 'settings') {
    row = settingRow(c.key, { compact: true, home: true });
    const main = row.querySelector('.row-main');
    main.querySelector('.row-name').textContent = f.title;
    if (f.note) main.append(el('div', 'row-note', f.note));
    // FT1: the home draws no help sheet, so the face of a switch row
    // toggles it - the same door prefRow's face is.
    if (widgetFor(c.key) === 'switch') {
      const [sec, k] = c.key.split('/');
      main.onclick = () => write(c.key, stepValue(c.key, effective()[sec]?.[k], 1));
    }
  } else {
    row = modRow(c.vendor, c.key, MOD_SETTINGS[c.vendor].keys[c.key], { name: f.title, note: f.note, home: true });
  }
  row.classList.add('feature');
  const main = row.querySelector('.row-main');
  main.prepend(kindTags(f.kinds));
  if (f.effect) main.append(el('div', 'row-sub', f.effect));
  return row;
}

// ── ABOUT ────────────────────────────────────────────────────────
function paneAbout(body) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'Daggerfall Online'));   // the public name (BR1, BR4); project-dagger is the repo
  c.append(el('p', 'meta', 'An open-source reimplementation of The Elder Scrolls II: Daggerfall.'));
  c.append(stats([
    ['Build', BUILD_TAG],
    ['Interface', currentOption(OVERHAUL_PANELS.find((p) => p.id === 'ui'))?.name ?? SKIN_NAMES[uiSkin()]],   // PLUS1; MENU-TOGGLE: the UI Overhaul worn, by its card's name (GrimoireUI is the classic skin with a pack)
    ['Settings', `${Object.values(DEFAULTS).reduce((n, s2) => n + Object.keys(s2).length, 0)} keys`],
  ]));
  body.append(c);
  body.append(creditsCard());
  body.append(empty('Exit', 'A browser tab cannot close itself. Close it yourself; the quicksave survives.'));
}

// CR1: THE CREDITS (Mac, 2026-08-30). Rendered from ui/credits.js, the
// one table every vendored work has a row in; this function knows the
// shape and nothing about the works. Mods are the point - a modder's
// name on the screen the player sees, not only in a README - so they
// take their own heading, with the terms the work is carried under.
function creditsCard() {
  const c = el('div', 'card credits');
  c.append(el('h3', null, 'Credits'));
  c.append(el('p', 'meta', 'What this port is built on, and the mods carried in it with their authors\' permission.'));
  const group = (heading, rows) => {
    c.append(el('h4', 'credits-head', heading));
    for (const r of rows) {
      const row = el('div', 'credit');
      const title = el('div', 'credit-title');
      title.append(el('span', 'credit-name', r.version ? `${r.title} ${r.version}` : r.title));
      title.append(el('span', 'credit-by', `by ${r.author}`));
      row.append(title);
      row.append(el('p', 'credit-what', r.what));
      const foot = [];
      if (r.terms) foot.push(r.terms);
      if (r.contact) foot.push(`Contact: ${r.contact}.`);
      if (foot.length) row.append(el('p', 'credit-terms', foot.join(' ')));
      if (r.link) {
        const a = el('a', 'credit-link', r.link.replace(/^https?:\/\//, ''));
        a.href = r.link; a.target = '_blank'; a.rel = 'noopener';
        row.append(a);
      }
      c.append(row);
    }
  };
  group('Built on', CREDITS.builtOn);
  group('Mods', CREDITS.mods);
  return c;
}

// ── SHELL ────────────────────────────────────────────────────────
function go(id) {
  // FIX-F: the staged dicts do not survive the walk away. FT16: every
  // section change is now a walk away from the bindings - they live in
  // a Settings CATEGORY, and arriving at Settings arrives at whichever
  // category was last open, which must not inherit a stale staging.
  // AUDIT FT16 F10: a WALK AWAY, not any click. FIX-F's guard was
  // `id !== 'controls'`, which FT16 dropped along with the section; the
  // unconditional discard then threw away staged binds when the rail row
  // you clicked was the section you were already standing in - Settings,
  // while rebinding, with the Settings row right there. The category
  // switch does its own discard (see the CATEGORIES tabs), so this
  // fires only where it means to: the section actually changing.
  if (id !== section) discardControlsStaging();
  section = id; pickedKey = null; sheetOpen = false; confirming = null; cloudArm = null; render();   // 0927b B5: an armed press never outlives its pane
}

// ── PX1: THE PIXEL HOME (Mac, 2026-08-27) ────────────────────────
// The boot door's FACE. The prototype of record is menu-pixel.html;
// what shipped is its structure over the REAL sections: every row
// navigates to the pane that already carries that section's laws
// (Continue's restorable card, the Mods waiting-room, the rail-hole
// rule), rather than acting directly - a home that re-decided what
// Continue does would be a second implementation of the Continue pane.
// Escape from any section returns here (see onKey); the interface is
// chosen on the Overhauls page (MENU-TOGGLE retired the menu's toggle).
function renderHome() {
  // PX2: the pause door wears the same face over the LIVE FRAME - no
  // sky (there is a world behind), no wordmark (a masthead on every
  // Escape is a billboard), a scrim instead of the opaque night.
  const paused = mode === 'pause';
  const home = el('div', `px-home${paused ? ' px-over' : ''}`);
  if (!paused) {
    const ground = document.createElement('canvas');
    ground.className = 'px-ground';
    const vw = () => globalThis.innerWidth ?? 1280;
    const vh = () => globalThis.innerHeight ?? 720;
    drawPixelGround(ground, vw(), vh(), 0);
    // PX1b: THE SKY LIVES - fog orbits and stars twinkle at 8fps, the
    // cadence pixel art animates at; a 60fps dither shimmer reads as
    // noise. The module draws, this mount owns the clock: one interval,
    // cleared by every rebuild (renderInto) and by unmount, skipped
    // entirely under prefers-reduced-motion - the same opt-out the CSS
    // drift honours.
    const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) {
      const t0 = Date.now();
      groundTimer = setInterval(() => drawPixelGround(ground, vw(), vh(), (Date.now() - t0) / 1000), 125);
    }
    home.append(ground);
  }
  home.append(el('div', 'px-vignette'));

  // PX3: PAUSE IS A WINDOW, NOT A SECOND MAIN MENU (Mac's reference:
  // Skyrim's journal - a framed panel with tabs over the paused game).
  // Three tabs: Quests, Stats, System. The window replaces the
  // fullscreen list; the foot and the About plaque stay on the scrim.
  if (paused) {
    const stage = el('div', 'px-stage');
    stage.append(pauseWindow());
    home.append(stage);
    // PROFILE2 (Mac, 2026-09-25: "make the profile icon visible somehow on the pause menu and allow changes"): THE
    // PROFILE MARK OVER THE GAME TOO. The same portrait the door wears, top-right - the character being played - and
    // the same window it opens: the account and the Skin card. A skin worn here is worn at once (the body re-reads the
    // mod's store) and told to the room (scenes/world.js hands the new look to net/online.js setLook). The window is
    // innermost: a tap outside it, or Escape, closes IT and leaves the pause window standing - never the game resumed
    // from under a half-made choice.
    home.append(profileMark());
    // TIMERS1 (Mac: "an enhanced plus button on the pause menu next to the profile icon"): THE HOURGLASS - online only,
    // where the host hands the clock and what it holds (hooks.timers); its window counts every shared moment down
    let mark = null;
    if (hooks.timers?.()) {
      mark = timersMark(document, { open: timersOpen, onOpen: () => { timersOpen = true; render(); } });
      home.append(mark);
      timersAnchor = anchorBeside(mark, home.querySelector?.('.px-profile'), home);   // AUDIT TIMERS1 UI-3: placed again on every resize
      if (timersFocusBack && !timersOpen) { timersFocusBack = false; globalThis.requestAnimationFrame?.(() => mark.focus?.()); }   // UI-5: back where the press was
    }
    if (accountOpen) {
      const acct = el('div', 'px-stage px-acctstage');
      acct.append(accountWindow());
      home.append(acct);
      closeOnOutsideTap(home, '.px-acctwin', () => { accountOpen = false; render(); });
    }
    else if (timersOpen && hooks.timers?.()) {
      const tstage = el('div', 'px-stage px-timersstage');
      // AUDIT TIMERS1 UI-9: the window's read is the one that asks the service (the seats list); the hourglass's test does not
      timersView = timersWindow(document, { read: () => hooks.timers?.({ ask: true }) ?? null, onClose: () => { timersOpen = false; timersFocusBack = true; render(); } });
      tstage.append(timersView.root);
      home.append(tstage);
      closeOnOutsideTap(home, '.px-timerswin', () => { timersOpen = false; timersFocusBack = true; render(); });
      // AUDIT TIMERS1 UI-5/UI-7: the pause face under the window is out of reach - no Tab into it, no Enter on its
      // Resume, no bumper turning its tabs (plusPad's tab strips skip what is not visible to it), no profile window
      for (const n of [stage, home.querySelector?.('.px-profile'), mark]) n?.setAttribute?.('inert', '');
    }
    // OT1 (Mac: "tapping outside of any UI closes the UI"): a tap on the
    // scrim - outside the window, the clock and the foot - resumes,
    // the way Escape does; the front door has no scrim and no resume.
    // PROFILE2: the mark is inside too (a press on it opens the window), and with the window open the tap is its.
    else closeOnOutsideTap(home, '.px-win, .px-clock, .px-foot, .px-profile, .px-timersmark', () => onAction('resume'));
    // PX4 (Mac): NO FOOT AT PAUSE - no skin toggle, no About plaque;
    // About is a System-tab row instead, and the skin switch stays on
    // the boot face and the settings shell.
    // PX5: the world's date and time, bottom-right like the reference,
    // through DFU's own header formatter over THE ONE CLOCK - a paused
    // clock, so one read at render is the truth for the whole visit.
    const d = dateFromClassicMinutes(Math.floor(skyMinutes()));   // TIME1: the date and time the world shows are the sky's
    const clock = el('div', 'px-clock');
    clock.append(el('span', null, dateString(d)), el('span', 'px-clocktime', dateTimeString(d).split(' on ')[0]));
    home.append(clock);
    app.append(home);
    return;
  }

  const stage = el('div', 'px-stage');
  const mark = el('h1', 'px-wordmark');
  mark.append(brandMark());
  stage.append(mark);
  const rule = el('div', 'px-rule');
  rule.append(el('span', 'px-gem'));
  stage.append(rule);

  const menu = el('nav', 'px-menu');
  menu.setAttribute('aria-label', 'Main menu');
  // PX1b: About leaves the center list for the corner box below - the
  // list is what a player DOES, the box is who made it. The SECTION
  // still exists on the shell rail untouched, so the rail-hole pin and
  // the shared-sections law hold.
  for (const label of sections) {
    if (label === 'About') continue;
    const id = idOf(label);
    // PX31: THE DOOR'S BUTTONS CARRY THEIR OWN NAME. Until now they
    // were classless, and nine probes still reached for `.railbtn` -
    // the SHELL rail's class, which this door has never had since PX1
    // replaced it. Every one of them timed out at its front door and
    // no gate noticed, because a probe is not a gate (AUDIT 17f F4).
    // Selecting on PROSE would be the same bug waiting on a relabel,
    // so the hook is structural: doorbtn plus the section id, which
    // is what a probe actually means when it says New Game.
    const b = el('button', `doorbtn door-${id}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label), el('span', 'px-c', '\u25c6'));
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id]) : () => go(id);
    menu.append(b);
  }
  stage.append(menu);
  home.append(stage);

  // ACC1f: the profile mark, top-right - the corner the foot's About
  // box does not use.
  home.append(profileMark());

  // ...and the window, offered ONCE per visit to a device with nobody
  // signed in. `accountOffered` latches here rather than in the
  // opener, so the mark can reopen it as often as a player likes.
  if (!accountOpen && !accountOffered && !signedIn()) { accountOffered = true; accountOpen = true; }
  if (accountOpen) {
    const acct = el('div', 'px-stage px-acctstage');
    acct.append(accountWindow());
    home.append(acct);
    // OT1, the same law the pause window lives under: a tap outside
    // closes it. The account is never a thing a player is stuck in.
    closeOnOutsideTap(home, '.px-win', () => { accountOpen = false; render(); });
  }

  appendPxFoot(home);
  app.append(home);
}

/** PX1b: three-zone foot - build left and About as the bottom-right
 *  box, the centre left open (MENU-TOGGLE retired the skin toggle that
 *  stood there). One builder for both faces (PX3 gave pause its own
 *  stage). */
function appendPxFoot(home) {
  const foot = el('div', 'px-foot');
  const build = el('span', 'px-build');
  build.append(document.createTextNode('build '), el('span', null, BUILD_TAG));
  const about = el('button', 'px-about', 'About');
  about.onclick = () => go('about');
  foot.append(build, about);   // MENU-TOGGLE: the skin pair that stood between them is retired
  home.append(foot);
}

// ── PX3: THE PAUSE WINDOW ────────────────────────────────────────
const PAUSE_TABS = Object.freeze([['quests', 'Quests'], ['stats', 'Stats'], ['system', 'System']]);
// The token formattings that carry a journal line - questJournal's own
// counted set (DaggerfallQuestJournalWindow.cs:658-662 via its :322).

function pauseWindow() {
  const win = el('div', 'px-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const tabs = el('div', 'px-tabs');
  for (const [id, label] of PAUSE_TABS) {
    const b = el('button', id === pauseTab ? 'on' : null);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label), el('span', 'px-c', '\u25c6'));
    b.onclick = () => { if (id !== 'system') discardControlsStaging(); pauseTab = id; render(); };
    tabs.append(b);
  }
  win.append(tabs);

  const body = el('div', 'px-body');
  ({ quests: pauseQuests, stats: pauseStats, system: pauseSystem })[pauseTab](body);
  win.append(body);
  return win;
}

// ── PX7: THE SYSTEM PAGE ─────────────────────────────────────────
// The journal's bones a third time - and NOT a third implementation
// of anything: the detail renders the SAME pane functions the shell
// has always run (paneSave's overwrite card, paneLoad's no-confirm
// law and delete-behind-ask, paneMods' honest waiting room,
// paneAbout, paneExit's confirm), so every audited law keeps its one
// home and only the paint changes (.px-win repaints .card/.act/.empty
// in the pixel idiom). Resume ACTS from the rail - a pane whose only
// content repeats the word just pressed is a pane that wasted a press
// (the shell's own RAIL_ACTS reasoning). PX9 (Mac: "why isn't this in
// the pause menu"): SETTINGS LIVES HERE TOO - the same paneSettings
// function, its category/pickedKey/sheetOpen machine and every F7/F8
// law intact, REFLOWED by CSS into the window's shape: the category
// rail becomes a chip strip across the top, the rows scroll beneath,
// and the help/reset card rises as the SHEET the phone layout already
// proved. Boot keeps the fullscreen shell, where there is room.
// FIX-F: CONTROLS sits beside Settings on BOTH rails, exactly as Mods
// and About do - the same pane function, registered the same way, so
// the front door and the pause door reach one implementation. It is
// the row whose absence was the bug.
export const SYSTEM_PANES = Object.freeze([
  ['resume', 'Resume'], ['save', 'Save Game'], ['load', 'Load Game'],
  ['settings', 'Settings'],   // FT16: Controls is a category INSIDE it
  ['features', 'Features'],   // FT0
  ['overhauls', 'Overhauls'],   // OVH1
  ['about', 'About'], ['exit', 'Exit'],   // FT14: no Mods pane
]);

function pauseSystem(body) {
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const [id, label] of SYSTEM_PANES) {
    const b = el('button', `px-qrow${id === sysSec && !RAIL_ACTS[id] ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label));
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id])
      : () => {
        // FIX-F: leaving the Controls pane without CONTINUE DISCARDS -
        // that is what a staged copy is for. FT16: the bindings sit
        // inside Settings now, so every OTHER system pane is a walk away.
        if (id !== 'settings') discardControlsStaging();
        sysSec = id; confirming = null; sheetOpen = false; pickedKey = null; cloudArm = null; render();   // 0927b B5
      };
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', `px-qdetail px-sys${sysSec === 'settings' ? ' px-setwrap' : ''}`);
  if (sysSec === 'settings') {
    // PX10 (Mac): CONDENSED at pause - the keys with LIVE consumers,
    // the ones a hand mid-game actually reaches for; the full catalog
    // stays on the main menu, and the pane says so. The pane owns its
    // own confirm/help placement (the sheet).
    paneQuickSettings(detail);
  } else if (confirming) {
    detail.append(confirmCard());
  } else {
    ({
      save: paneSave, load: paneLoad,
      features: paneFeatures,   // FT0
      overhauls: paneOverhauls,   // OVH1
      about: paneAbout, exit: paneExit,
    })[sysSec](detail);
  }
  wrap.append(detail);
  body.append(wrap);
}

// ── PX6: THE STATS PAGE ──────────────────────────────────────────
// The journal's own bones - a rail of pages, the chosen one on the
// right - because one structure learned once is the whole window's.
// Everything drawn is something the entity actually carries: the char
// sheet's model (vitals, attributes, the career skill groups), and
// the three reputation stores the talk and court systems read.
const STATS_SECTIONS = Object.freeze([
  ['character', 'Character'], ['attributes', 'Attributes'],
  ['skills', 'Skills'], ['specials', 'Advantages'], ['standing', 'Standing'],
  ['effects', 'Effects'],   // BUFF-END: the spells on you, and an End on the ones that are yours to end
]);
// The five NAMED social groups getReactionToPlayer reads
// (formats/factionFile.js:23-27; talk.js seeds the array) - the enum
// slots past Underworld are DFU's own placeholders and stay unlisted.
const SOCIAL_GROUP_NAMES = Object.freeze(['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld']);

/** A whole-pixel meter: 2px frame, flat fill, no easing. */
function pxMeter(now, max, tone) {
  const wrap = el('div', 'px-meter');
  const fill = el('div', `px-fill${tone ? ` ${tone}` : ''}`);
  const pct = max > 0 ? Math.max(0, Math.min(100, (now / max) * 100)) : 0;
  fill.style.width = `${pct}%`;
  wrap.append(fill);
  return wrap;
}

/** SOFTCAP1: a skill's meter - the classic 0..100 bar, and under it (only once
 *  the skill has passed 100) a gold bar for the 100..200 climb, ticked at the
 *  125/150/175 milestones. */
function skillMeter(v, mastered = false) {
  const wrap = pxMeter(Math.min(v, 100), 100, 'thin');
  if (!mastered) return wrap;   // SOFTCAP7: the gold bar is a MASTERY's - a curse's or a Fortify's +30 never draws it
  const box = el('div', 'px-skillmeter');
  const over = el('div', 'px-meter px-over');
  const fill = el('div', 'px-fill px-overfill');
  fill.style.width = `${Math.max(0, Math.min(100, v - 100))}%`;
  over.append(fill);
  for (const at of [25, 50, 75]) { const t = el('div', 'px-tick'); t.style.left = `${at}%`; over.append(t); }
  box.append(wrap, over);
  return box;
}

function meterRow(label, now, max, tone) {
  const r = el('div', 'px-mrow');
  const top = el('div', 'px-mtop');
  top.append(el('span', 'k', label), el('span', 'v', `${now} / ${max}`));
  r.append(top, pxMeter(now, max, tone));
  return r;
}

/** PROF1: the rail's pages - the sheet's six, and online, while the professions are this account's, the Professions
 *  and Stores pages (ui/profPages.js). */
const statsSections = () => [...STATS_SECTIONS, ...(revenantPageShown(playerEntity) ? REVENANT_PAGE_SECTIONS : []), ...(companionPageShown() ? COMPANION_PAGE_SECTIONS : []), ...(profPagesShown() ? PROF_PAGE_SECTIONS : [])];   // REVENANT-PAGE: after the sheet's own, before the professions'

function pauseStats(body) {
  const m = sheetModel(playerEntity);
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  // a page gone (the switch, offline) is never drawn. MASTER-DOOR: the Master Skills page is the one page OFF the rail
  // (its door is the button beside Ascend) - this guard took it for a page gone and turned every press of that button
  // into the Character page; it stands while the sheet has a Master Skills model to draw it from
  const offRail = statsSec === 'master' && !!m.master;
  if (!offRail && !statsSections().some(([id]) => id === statsSec)) statsSec = 'character';
  for (const [id, label] of statsSections()) {
    const b = el('button', `px-qrow${id === statsSec ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label));
    b.onclick = () => { statsSec = id; render(); };
    rail.append(b);
  }
  wrap.append(rail);
  // PLUS4: the ONE other detail pane on this rail with buttons on it (Pack/Spellbook/Chronicle/
  // Ascend, below) - and the one that never picked up the px-sys class its System-tab twin (below,
  // pauseSystem) carries. The kit's button role (enhancedFrame.js FRAME_ROLES) reads `.px-sys .act`,
  // so without it these four fell through to the bare, unpainted base .act under Plus.
  const detail = el('div', 'px-qdetail px-sys');   // DROPS-AUDIT F3: the system-page dress (Plus's; PLUS-DEAD: the only one)
  const profKit = { el, divider: pxDivider, meter: pxMeter };
  ({
    character: statsCharacter, attributes: statsAttributes, skills: statsSkills, specials: statsSpecials, standing: statsStanding, effects: statsEffects, master: statsMaster,   // SOFTCAP4: `master` - the Master Skills door's page
    professions: (d) => drawProfessionsPage(d, render, profKit), stores: (d) => drawStoresPage(d, render, profKit),
    revenants: (d) => drawRevenantsPage(d, render, { ...profKit, player: playerEntity, kindName: enemyDisplayName }),   // REVENANT-PAGE
    companions: (d) => drawCompanionsPage(d, render, { ...profKit, kindName: enemyDisplayName, here: swornBodyOf }),   // COMPANION-ROSTER
  })[statsSec](detail, m);
  // PX25: THE DOORS THE F5 SHEET CARRIED. The classic character sheet
  // has four buttons down its side - Inventory, Spellbook, Logbook,
  // History - and the enhanced F5 overlay copied them. This page shows
  // the same model from the same sheetModel, so it is the same sheet;
  // it was simply the only one of the two with no way out. Each door
  // appears ONLY when the host handed one over, because a button that
  // opens nothing is PX14's drawn door.
  const doors = statsSec === 'master' ? [] : [   // SOFTCAP6: the Master Skills page carries none of the sheet's doors
    ['Pack', hooks.openPack], ['Spellbook', hooks.openSpellbook], ['Chronicle', hooks.openChronicle],
  ].filter(([, fn]) => typeof fn === 'function');
  if (doors.length) {
    const row = el('div', 'px-sheetdoors');
    for (const [label, fn] of doors) {
      const b = el('button', 'act', label);
      // The pause window goes down first: two overlays at once is the
      // stacking bug U55 found the other way round on this very seam.
      // ESC-BOOK: as a HANDOFF, not a resume - the door's window takes
      // the slot, so nothing relocks under it (ui/pauseDoor.js).
      // AUDIT 27h A4: ...unless the door says it opened nothing (a
      // refused pack, a journal whose art has not landed): then it IS
      // a resume, inside this same click - no page and no window up,
      // and the pointer left free under a running game, was the hole.
      b.onclick = () => { onAction('handoff'); if (fn() === false) onAction('resume'); };
      row.append(b);
    }
    detail.append(row);
  }
  // ASCEND-ANYTIME: ...AND THE ONE DOOR THAT OPENS THIS SAME CHARACTER.
  // The other three lead somewhere else, so they resume the game first;
  // this one swaps a screen in OVER the window it is pressed from and
  // puts that window back when it closes, so it must NOT resume - a
  // resume here would hand the keys back to a player who is about to be
  // looking at a full-screen sky.
  //
  // Drawn only when a door handed the hook over, exactly as the three
  // above are: ui/charSheetDoor.js's page always could (it owns the
  // entity), and ui/pauseDoor.js's could not until it was taught to.
  // SOFTCAP4: THE MASTER SKILLS DOOR, beside Ascend (Mac, in game: "add a button to it like ASCEND and there it should
  // be described and chosen"). Unlike Ascend it opens a page of THIS window (statsSec 'master'), so it neither
  // resumes nor hands off; the page's own button comes back to Skills. A count on the button when a choice is waiting.
  const masterDoor = m.master ? (() => {
    const n = m.master.candidates?.length ?? 0;
    const b = el('button', n ? 'act primary' : 'act', n ? `Master Skills (${n})` : 'Master Skills');
    b.onclick = () => { statsSec = 'master'; _masterNote = null; render(); };
    return b;
  })() : null;
  if (statsSec !== 'master' && (typeof hooks.openAscend === 'function' || masterDoor)) {
    const row = el('div', 'px-sheetdoors');
    if (typeof hooks.openAscend === 'function') {
      const b = el('button', 'act', 'Ascend');
      b.onclick = () => hooks.openAscend();
      row.append(b);
    }
    if (masterDoor) row.append(masterDoor);
    detail.append(row);
  }
  wrap.append(detail);
  body.append(wrap);
}

/** CHARACTER: who you are, and the three bars a glance wants - health
 *  in the skin's blood, fatigue in bone, magicka in verdigris. */
function statsCharacter(detail, m) {
  const head2 = el('div', 'px-qname');
  head2.append(el('span', 'px-qwing'), el('h3', null, m.name || 'Adventurer'), el('span', 'px-qwing px-flip'));
  detail.append(head2);
  const meta = el('div', 'px-qmeta');
  meta.append(el('span', 'px-qkind', `${m.race}${m.career ? ` ${m.career}` : ''} \u00b7 Level ${m.level}`));
  detail.append(meta);
  detail.append(meterRow('Health', m.health.now, m.health.max, 'blood'));
  detail.append(meterRow('Fatigue', m.fatigue.now, m.fatigue.max, ''));
  detail.append(meterRow('Magicka', m.magicka.now, m.magicka.max, 'verdigris'));
  detail.append(pxDivider('Burden'));
  const g = el('div', 'px-statgrid');
  for (const [label, v] of [['Gold', String(m.gold)], ['Encumbrance', `${m.encumbrance.now} / ${m.encumbrance.max}`]]) {
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', label), el('span', 'v', v));
    g.append(r);
  }
  detail.append(g);
}

/** BUFF-END (Leafen on Discord: "Could there be a way to dispel magic for non-magic users?"): EFFECTS - every spell on
 *  you, with its rounds, and an End on each the player may end (systems/mysticism.js canEndBundle: a spell of the
 *  kinds that only help - never a held item's, a duel's or anything harmful). The door that needs no freed mouse: a
 *  pad, a finger, a player who never presses Enter. The HUD's right-click is its twin (ui/enhancedHud.js). */
function statsEffects(detail) {
  detail.append(pxDivider('Active spells'));
  const bundles = liveBundles(playerEntity).filter((b) => b.showIcon);
  if (!bundles.length) {
    detail.append(el('p', 'px-note', 'No spells are on you.'));
    return;
  }
  for (const b of bundles) {
    const r = el('div', 'px-stat px-effect');
    const held = b.bundleType === 'HeldMagicItem';
    const rounds = maxRoundsRemaining(b);
    r.append(el('span', 'k', String(b.name ?? '').replace(/^!+/, '') || 'A spell'),
      el('span', 'v px-src', held ? 'While held' : `${rounds} round${rounds === 1 ? '' : 's'}`));
    if (canEndBundle(b)) {
      const end = el('button', 'act', 'End');
      end.type = 'button';
      end.title = 'End this spell now';
      end.onclick = () => { endBundle(playerEntity, b.bundleId); render(); };
      r.append(end);
    }
    detail.append(r);
  }
}

/** ATTRIBUTES: the eight, each with a meter on the classic 100. */
function statsAttributes(detail, m) {
  detail.append(pxDivider('Attributes'));
  for (const a of m.attributes) {
    detail.append(meterRow(a.key[0].toUpperCase() + a.key.slice(1), a.value, 100, ''));
  }
}

/** SKILLS: the three career groups open - the character's chosen
 *  shape - and Miscellaneous behind the sheet's own disclosure. */
let _masterNote = null;   // SOFTCAP3: the switch's last answer, said under it until the page is left

/** SOFTCAP3: THE MASTER SKILLS PANE - the state and the rules in words, always. ONLINE it is always on, so the pane
 *  only explains. OFFLINE it carries the switch: a refusal (inside a dungeon) is said, never a greyed button (the kit's
 *  rule: a control that cannot act says why); turning it ON asks first in the skin's Yes/No card, because it changes
 *  how the world answers; turning it off does not. */
function statsMaster(detail, m) {
  const ms = m.master;
  if (!ms) return;
  // SOFTCAP6 (Mac, in game: the page must SHOW the skills you want to advance - polished, no walls of text, and none
  // of the sheet's doors on it). One short line of what it is; then the three career groups, each with its slots as
  // pips and every one of its skills as a row: mastered (gold, its climb on the gold bar), ready (a Master button that
  // asks first), or not yet (why, in a word). Offline the switch stands at the foot.
  const back = acts([{ label: '\u2039 Skills', onClick: () => { statsSec = 'skills'; _masterNote = null; render(); } }]);
  back.classList.add('px-master-back');
  detail.append(back, pxDivider('Master Skills'));
  const lead = !ms.on
    ? (ms.switchable ? 'Off \u2013 your skills stop at 100, as in Daggerfall.' : 'Off.')
    : 'Choose the skills that may climb past 100, up to 200. A choice is permanent.';
  detail.append(el('div', 'px-master-lead', lead));
  if (_masterNote) detail.append(el('div', 'px-master-note', _masterNote));
  for (const g of ms.groups) {
    const card = el('section', 'px-mgroup');
    const head = el('div', 'px-mhead');
    const pips = el('span', 'px-pips');
    for (let k = 0; k < g.max; k++) pips.append(el('span', k < g.used ? 'px-pip on' : 'px-pip', k < g.used ? '\u25c6' : '\u25c7'));
    head.append(el('span', 'px-mname', g.label), pips, el('span', 'px-mcount', `${g.used} of ${g.max} chosen`));
    card.append(head);
    for (const sk of g.skills) {
      const row = el('div', sk.mastered ? 'px-mrow2 is-mastered' : sk.candidate ? 'px-mrow2 is-ready' : 'px-mrow2');
      const top = el('div', 'px-mtop');
      top.append(el('span', 'k', `${sk.mastered ? '\u25c6 ' : ''}${sk.name}`), el('span', 'v', String(sk.value)));
      const side = el('div', 'px-mside');
      if (sk.mastered) side.append(el('span', 'px-mtag gold', sk.value >= 200 ? 'Mastered \u00b7 200' : 'Mastered'));
      else if (sk.candidate) {
        const b = el('button', 'act primary px-mbtn', 'Master');
        b.onclick = () => askCard(sk.rows, () => { _masterNote = ms.master(sk.id).text; render(); });
        side.append(b);
      } else side.append(el('span', 'px-mtag', sk.why));
      const body = el('div', 'px-mbody');
      body.append(top, skillMeter(sk.value, sk.mastered));
      row.append(body, side);
      card.append(row);
    }
    detail.append(card);
  }
  if (ms.switchable) {   // offline only - online it is always on
    const flip = () => { _masterNote = ms.toggle().text; render(); };
    const foot = acts([{
      label: ms.on ? 'Turn off Master Skills' : 'Activate Master Skills', primary: !ms.on,
      onClick: () => {
        if (ms.blocked) { _masterNote = ms.blocked; render(); return; }
        if (ms.on) { flip(); return; }
        askCard(['Activate Master Skills?', '', 'Dangerous dungeons will send stronger enemies,', 'and points past 100 are slow to earn.', 'You can turn it off here at any time.'], flip);
      },
    }]);
    foot.classList.add('px-master-foot');
    detail.append(foot);
  }
}

/** SOFTCAP3: the enhanced face's own Yes/No card over the pause page (the same card class the skin's YesNo box wears). */
function askCard(lines, onYes) {
  const back = el('div', 'px-master-ask');
  const card = el('div', 'inputbox yesnobox');
  card.setAttribute('role', 'alertdialog');
  const rows = el('div', 'inputbox-rows');
  for (const t of lines) rows.append(el('div', 'notice-row center', t));
  // DFU's keys, as the skin's YesNo box keeps them: Y yes, N or Return no (the default) - and Escape no here too, on
  // CAPTURE and stopped, so it answers the card instead of closing the pause page under it
  const onKey = (e) => {
    const k = e.code;
    if (k !== 'KeyY' && k !== 'KeyN' && k !== 'Enter' && k !== 'NumpadEnter' && k !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    close();
    if (k === 'KeyY') onYes();
  };
  const close = () => { removeEventListener('keydown', onKey, true); back.remove(); };
  addEventListener('keydown', onKey, true);
  const bar = acts([
    { label: 'Yes', onClick: () => { close(); onYes(); } },
    { label: 'No', primary: true, onClick: close },
  ]);
  bar.classList.add('yesnobox-acts');
  const hint = el('div', 'notice-hint', 'Y yes · N or Enter no');
  card.append(rows, bar, hint);
  back.append(card);
  document.body.append(back);
}

function statsSkills(detail, m) {
  if (m.mentor) detail.append(el('div', 'px-qrow', m.mentor));   // SOFTCAP1: mentor mode says so where the lowered numbers are
  for (const group of m.groups) {
    if (!group.career && !statsAllSkills) continue;
    if (!group.ids.length) continue;
    detail.append(pxDivider(group.name));
    const grid = el('div', 'px-skillgrid');
    for (const id of group.ids) {
      const r = el('div', 'px-skill');
      const top = el('div', 'px-mtop');
      const mastered = !!m.master?.isMastered?.(id);   // SOFTCAP4: a mastered skill wears the diamond, in gold
      top.append(el('span', mastered ? 'k px-mastered' : 'k', `${mastered ? '\u25c6 ' : ''}${SKILL_NAMES[id] ?? `Skill ${id}`}`), el('span', 'v', m.skillText ? m.skillText(id) : String(m.skill(id))));
      // SOFTCAP1/6: 0..100 as ever, and under a MASTERED skill the gold 100..200 bar (its track shows from the moment
      // of mastery, empty at 100) - the one mark this pane carries of it
      r.append(top, skillMeter(m.skillBase ? m.skillBase(id) : m.skill(id), mastered));   // SOFTCAP7: the bars climb the TRAINED value
      grid.append(r);
    }
    detail.append(grid);
    // AUDIT 63 F34: ShowSkillsDialog appends the hand-to-hand damage
    // line to whichever GROUP contains HandToHand
    // (DaggerfallCharacterSheetWindow.cs:283-284, :309-318), so the
    // gate here is per group, as it is there.
    if (group.ids.includes(SKILLS.HandToHand)) {
      const hth = el('div', 'px-qrow');
      hth.append(document.createTextNode(
        `${SKILL_NAMES[SKILLS.HandToHand]} dmg: ${m.handToHandDamage.min}-${m.handToHandDamage.max}`));
      detail.append(hth);
    }
  }
  const more = el('button', 'px-qrow px-disclose');
  const miscCount = m.groups[3]?.ids.length ?? 0;
  more.append(el('span', 'px-c', '\u25c6'),
    document.createTextNode(statsAllSkills ? 'Hide miscellaneous' : `Show ${miscCount} miscellaneous skills`));
  more.onclick = () => { statsAllSkills = !statsAllSkills; render(); };
  detail.append(more);
}

/** ADVANTAGES: GetClassSpecials, which the port had never drawn.
 *
 *  MAC-G (Mac: "the enhanced stat page on the pause menu doesn't have
 *  any listing for character advantages/disadvantages"). DFU prints
 *  ONE undifferentiated list in a message box behind the classic
 *  sheet's History button; this page has room for the division the
 *  player actually made at chargen, so the model tags each row with
 *  which of the two lists its primary belongs to and the page prints
 *  them under their own dividers.
 *
 *  The SOURCE tag is the other half of the answer: Resistance To Magic
 *  on a Breton mage can come from the class or from the blood, and a
 *  list that does not say which leaves the player guessing at what a
 *  re-rolled class would keep. */
function statsSpecials(detail, m) {
  const rows = m.specials ?? [];
  if (!rows.length) {
    detail.append(pxDivider('Advantages'));
    detail.append(el('p', 'px-note', 'No special advantages or disadvantages.'));
    return;
  }
  for (const [kind, title] of [['advantage', 'Advantages'], ['disadvantage', 'Disadvantages']]) {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) continue;
    detail.append(pxDivider(title));
    for (const r of list) {
      const row = el('div', 'px-stat');
      row.append(el('span', 'k', r.label));
      row.append(el('span', 'v px-src', r.source === 'race' ? (m.race || 'Race') : (m.career || 'Class')));
      detail.append(row);
    }
  }
}

/** STANDING: the reputation stores the game actually reads - the five named social groups (getReactionToPlayer's own
 *  inputs), the law of every region that knows the player's name, and the guilds. REP5 (the reputation overhaul): the
 *  law was left out because "the window does not know where you stand" - so every row names its own region, which is
 *  never a lying row: its band's word, its number, and what it costs (a banishment's days left, the watch knowing the
 *  face). A region the law has never heard of is not listed. */
const signedRep = (v) => el('span', `v${v > 0 ? ' won' : v < 0 ? ' bad' : ''}`, v > 0 ? `+${v}` : String(v));

function statsStanding(detail) {
  detail.append(pxDivider('Reputation'));
  const reps = playerEntity.sGroupReputations ?? [];
  for (let i = 0; i < SOCIAL_GROUP_NAMES.length; i++) {
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', SOCIAL_GROUP_NAMES[i]), signedRep(reps[i] ?? 0));
    detail.append(r);
  }
  statsDress(detail, playerEntity);
  statsLaw(detail, playerEntity);
  statsGuilds(detail, playerEntity);
}

/** DRESS1 (2026-09-30, Discord: "Add positive and negative reputation buffs for clothing items"): what the worn clothes
 *  are doing right now - one light line under the groups, only when the dress moves anybody. Read live off the equip
 *  table (dressStanding is pure), so it is right before the next magic round folds it into reactionMods. */
export function dressLine(entity) {
  const d = dressStanding(entity);
  const parts = [];
  for (let i = 0; i < SOCIAL_GROUP_NAMES.length; i++) if (d.groups[i]) parts.push(`${SOCIAL_GROUP_NAMES[i]} ${d.groups[i] > 0 ? '+' : ''}${d.groups[i]}`);
  if (d.temple) parts.push(`Temples ${d.temple > 0 ? '+' : ''}${d.temple}`);
  return parts.join(', ');
}
export function statsDress(detail, entity) {
  const line = dressLine(entity);
  if (!line) return;
  const r = el('div', 'px-stat px-dress');
  r.append(el('span', 'k', 'Dress'), el('span', 'v', line));
  detail.append(r);
}

/** REP5: THE LAW, REGION BY REGION - every region with a standing other than a common citizen's, or a banishment. */
export function statsLaw(detail, entity, { worldNow = trustedWorldMinutes() } = {}) {   // AUDIT REP F2
  const rows = lawRows(entity, worldNow);
  if (!rows.length) return;
  detail.append(pxDivider('The law'));
  for (const w of rows) {
    const r = el('div', 'px-stat px-law');
    r.append(el('span', 'k', w.region), el('span', 'v px-rank', w.note ? `${w.word} - ${w.note}` : w.word), signedRep(w.rep));
    detail.append(r);
  }
}
/** The law's rows, worst first: { region, rep, word, note }. */
export function lawRows(entity, worldNow) {
  const out = [];
  const regions = new Set([...Object.keys(entity?.legalRep ?? {}).map(Number),
    ...(entity?.regionConditions ?? []).map((r, i) => ((r?.severePunishmentFlags ?? 0) & 1 ? i : -1)).filter((i) => i >= 0)]);
  for (const i of regions) {
    if (!Number.isInteger(i) || i < 0) continue;
    const rep = legalRepOf(entity, i);
    // AUDIT REP F2: NaN is a banishment whose term is not known yet (online, the relay's clock unheard) - still a row
    const left = banishmentLeft(entity, i, worldNow);
    if (rep === 0 && left === 0) continue;
    const days = Math.ceil(left / 1440);
    const term = Number.isFinite(left) ? `, ${days} day${days === 1 ? '' : 's'} left` : '';
    // the price of each: a pardon at the region's temple, a stop's fine on the street
    const note = left !== 0 ? `banished${term} (a pardon: ${pardonPrice(entity, i)} gold)`
      : rep < KNOWN_CRIMINAL_BELOW ? `known to the watch (a stop: ${challengeFine(entity, i, { worldNow })} gold)` : '';
    out.push({ region: REGION_NAMES[i] ?? `Region ${i}`, rep, word: legalStandingWord(rep), note });
  }
  return out.sort((a, b) => a.rep - b.rep);
}

/** GUILD-REP (Mac: "we need to add guild reputation to our enhanced
 *  pause menu, its missing"): the sheet's AFFILIATIONS box, on the
 *  page. ShowAffiliationsDialog's own three facts per membership - the
 *  affiliation, the rank title and the live reputation - off the one
 *  model the classic box draws (systems/affiliations.js), so the two
 *  skins cannot disagree about a guild. An empty book says what record
 *  19 says rather than drawing an empty section. */
export function statsGuilds(detail, entity) {
  detail.append(pxDivider('Guilds'));
  const book = affiliations(entity);
  if (!book.length) {
    detail.append(el('p', 'px-note', 'You have no affiliations.'));
    return;
  }
  for (const a of book) {
    const r = el('div', 'px-stat px-guild');
    r.append(el('span', 'k', a.affiliation), el('span', 'v px-rank', a.probation ? `${a.title} - on probation` : a.title), signedRep(a.rep));   // REP6
    detail.append(r);
  }
}

/** PX5: THE MAIN QUEST, by the pack's own naming - DFU ships the
 *  story quests as S0000*.txt (34 files in vendor/dfu-quests/Quests)
 *  and _BRISIEN is the main quest's opener (StartGameBehaviour.cs:
 *  445-447 via questBridge.GAME_START_QUESTS). Everything else on the
 *  log is a side quest. */

/** PX28 (Mac: remove the titles - Main Quest, Side Quest - from the
 *  quest NAMES in the enhanced journal; they already have sections).
 *
 *  THE RAIL ALREADY SAYS WHICH KIND A QUEST IS, by the section it sits
 *  in, so a name that repeats it says the same fact twice - the cut
 *  PX22 already made to the detail pane's kind tag, finished here on
 *  the names themselves. A quest pack is free to title its quests
 *  however it likes and the port does not edit its data: this strips
 *  the label at the DISPLAY seam only, and only when it is a real
 *  label - a kind phrase at the FRONT, followed by a separator.
 *
 *  What is deliberately NOT stripped:
 *   - "Clavicus Vile's Quest", "Main Quest Backbone" - the word sits
 *     at the end, or the phrase runs on into the title with no
 *     separator, so it IS the name.
 *   - anything that would leave nothing behind: a quest actually
 *     called "Main Quest" keeps its name rather than becoming blank.
 */
// AUDIT 38 F1: the SEPARATOR between the kind word and the noun is
// optional too. A pack is as free to write "Sidequest:" or
// "Main-Quest -" as "Side Quest:", and the first cut required a
// space, so the joined spellings sailed through with the label still
// on. The kind and the noun may be joined, spaced or hyphenated; the
// LABEL still needs its own trailing separator, which is what keeps
// "Main Quest Backbone" a name.

/** QT-LIVE1 (Mac, 2026-09-21: "The time doesn't print out live?"):
 *  the timer line for the selected quest off a FRESH quest log, or
 *  null when that quest no longer has a running clock. The words are
 *  the same the render writes; this is what the interval writes. */
export function questTimerWords(log, key) {
  const r = questRail(log ?? { active: [], finished: [] });
  const q = [...r.active, ...r.hidden].find((row) => row.key === key);   // JOURNAL-CLEAN: a hidden quest shown is still timed
  if (!q || q.clockSeconds == null) return null;
  return { text: `Time remains: ${remainWords(q.clockSeconds)}`, urgent: q.clockSeconds < QUEST_URGENT_SECONDS };
}

/** The journal rendered once when it opened and again on a click, so
 *  the line read whatever the clock was at that moment. Offline the
 *  world stops under the menu and that is harmless; online it runs on
 *  at twelve to one, and a minute fell off every five real seconds
 *  with the line not moving. Once a second, re-read the host's log
 *  (the bridge answers the remainder AS OF NOW, so nothing is ticked
 *  under the pause gate) and rewrite the span in place - the panel is
 *  not rebuilt, so the selection and the scroll stand. A clock that
 *  fired or a quest that ended under the menu is a stale PANEL, and
 *  that repaints. One owner: cleared by every rebuild and by unmount,
 *  the ground clock's own law. */
function armQuestTimer(span, key) {
  if (questTimer) { clearInterval(questTimer); questTimer = null; }
  questTimer = setInterval(() => {
    const w = questTimerWords(hooks.questLog?.(), key);
    if (!w) { render(); return; }
    span.textContent = w.text;
    span.className = `px-qtimer${w.urgent ? ' urgent' : ''}`;
  }, 1000);
}

/** The finished-quest header the notebook files:
 *  '<name> completed|ended at <date>:' (notebook.js:190-224). The name
 *  and the verdict come back out of it; a headerless overflow entry
 *  (the notebook's own kept quirk) reads as a continuation. */

/** A titled ornamental divider - line, gem, WORD, gem, line - the
 *  reference's OBJECTIVES rule in whole pixels. */
function pxDivider(word) {
  const d = el('div', 'px-divider');
  d.append(el('span', 'px-gem'), el('span', 'px-divword', word), el('span', 'px-gem'));
  return d;
}

/** GUIDE2: THE WHERE LINE - an entry's target as the journal draws it: the place in the find-place box's own words
 *  (ui/questLens.js targetWords - only the names the entry says, or DFU's box would), the way there where this host
 *  hands a door over, and the note when the player's map is KNOWN not to have it. The door is HandleQuestClicks' Yes
 *  in this window's law: the page goes down as a HANDOFF and the map is asked for with the place; a map the host
 *  refuses (an enemy near, the sun) says why in DFU's words and the page resumes - AUDIT 27h A4's rule for every door
 *  here. `wayOnly` draws nothing unless there is a way to take; `skip` is a place already offered above. Null when the
 *  entry points nowhere. */
function questWhere(message, cls, { wayOnly = false, skip = null } = {}) {
  if (!isEnhanced()) return null;   // AUDIT GUIDE W3: THE LAWS 4 - the classic Controls door (DISC22-B) opens this tab on DFU's skin
  const said = targetWords(entryTarget(message, { canFindPlace: hooks.canFindPlace, currentLocationName: hooks.currentLocationName }));
  const door = typeof hooks.showQuestPlace === 'function' ? hooks.showQuestPlace : null;
  // AUDIT GUIDE W5: a place offered above is skipped by its region AND its name - two towns may share a name
  if (!said || (wayOnly && !(said.find && door)) || (skip && said.find?.locationName === skip.locationName && said.find?.regionName === skip.regionName)) return null;
  const box = el('div', cls);
  box.append(el('span', `${cls}-place`, said.where));
  if (said.find && door) {
    const go = el('button', 'act', WHERE_TEXT.show);
    go.type = 'button';
    go.title = WHERE_TEXT.showLabel(said.where);
    go.setAttribute('aria-label', WHERE_TEXT.showLabel(said.where));
    const find = said.find;
    go.onclick = () => { onAction('handoff'); if (door(find) === false) onAction('resume'); };
    box.append(go);
  }
  if (said.note) box.append(el('span', `${cls}-note`, said.note));
  return box;
}
/** GUIDE2: the place the quest's latest entry offers a way to (its find payload: region and name), or null. */
function latestPlace(sel) {
  const t = entryTarget(sel.written?.at(-1)?.message, { canFindPlace: hooks.canFindPlace, currentLocationName: hooks.currentLocationName });
  return t?.find ?? null;
}

/** PX4 - THE JOURNAL (Mac's reference: Skyrim's quest page). A rail of
 *  quest names on the left - active first, THE ARCHIVE beneath them -
 *  and the selected quest on the right: name under its ornament, the
 *  latest entry as the description, and every step of the trail as a
 *  diamond-bulleted entry, newest first, exactly the shape the
 *  machine's log walk gives (a Daggerfall quest speaks in journal
 *  entries, not objective flags - the entries ARE the tasks). Data
 *  arrives raw through hooks.questLog (world.js wires it beside the
 *  F5 logbook's flat seam); a host without the hook says so. */
function pauseQuests(body) {
  if (!hooks.questLog) {
    body.append(el('p', 'px-note', 'The journal is not wired into this place yet.'));
    return;
  }
  // MAC-K2: THE WALK IS ui/questRail.js's now, because the chronicle
  // needs the same one - the L key's window had no quests in it at all
  // and a second copy of this here is how the two would drift.
  const { active, finished, hidden } = questRail(hooks.questLog() ?? { active: [], finished: [] });
  // JOURNAL-CLEAN (2026-09-30, Discord: "Should there be a way to clean both finished and unfinished quests from your
  // journal for a cleaner look?"): the host's tidy-ups (scenes/questBridge.js journalClean - remove / clear the
  // archive, hide / unhide an active quest). A host that hands none draws no buttons rather than buttons that do
  // nothing.
  const clean = hooks.journalClean?.() ?? null;
  if (!active.length && !finished.length && !hidden.length) {
    body.append(el('p', 'px-note', 'No active quests.'));
    return;
  }
  const shown = questShowHidden ? hidden : [];
  const rows = [...active, ...shown, ...finished];
  // GUIDE4: THE JOURNAL OPENS ON THE QUEST THE HUD SHOWS - the tracker's (the one tracked, else the one the journal
  // last changed) - and only then on the first row.
  if (!rows.some((r) => r.key === questSel)) {
    const onHud = followOn() ? questTracker.tracked()?.id : null;   // AUDIT GUIDE T2: the card's or the marks' quest
    questSel = (onHud != null ? rows.find((r) => r.id === onHud)?.key : null) ?? rows[0]?.key ?? null;   // JOURNAL-CLEAN: every quest hidden is no row
  }
  const sel = rows.find((r) => r.key === questSel);

  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  const railList = (items, cls) => {
    for (const q of items) {
      const b = el('button', `px-qrow${cls}${q.key === questSel ? ' on' : ''}`);
      b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(questTitleOf(q.name)));   // PX28
      if (q.clockSeconds != null) b.append(el('span', 'px-qtimed', '\u25c6'));
      b.onclick = () => { questSel = q.key; render(); };
      rail.append(b);
    }
  };
  // PX22 (Mac: "quests aren't supposed to be titled as main quest...
  // what we developed had 3 sections for main, side and archived"):
  // THE RAIL IS THREE SECTIONS, ALWAYS. PX5 made the two active
  // headings CONDITIONAL - "a rail of one group under a header is a
  // header explaining nothing" - and that reasoning is fine for a
  // heading that only labels; it is wrong for one that is the
  // journal's SHAPE. A player who opens the journal on their first
  // side quest should learn that a main-quest section exists and is
  // empty, not meet a different window later. So all three stand, in
  // order, and an empty one says so in the dim - the same anti-lie
  // idiom as the worn map's empty families and the site's not-yet box.
  //
  // The ARCHIVE is not split by kind, and that is not an oversight:
  // the notebook's filed header keeps only the display name, so the
  // questName main/side is gone by the time a quest is filed
  // (notebook.js:190-224). Three sections is the shape the DATA has.
  const mains = active.filter((q) => q.main);
  const sides = active.filter((q) => !q.main);
  const section = (label, items, cls, first = false) => {
    rail.append(el('div', `px-qarch${first ? ' px-qfirst' : ''}`, label));
    if (items.length) railList(items, cls);
    else rail.append(el('div', 'px-qnone', '\u2014'));
  };
  section('Main Quests', mains, '', true);
  section('Side Quests', sides, '');
  // JOURNAL-CLEAN: the hidden quests, drawn only when asked for, under their own heading - and the toggle that asks,
  // which names how many are hidden so a tidied journal never looks like quests were lost.
  if (questShowHidden && hidden.length) section('Hidden', hidden, ' done');
  section('Archived', finished, ' done');
  const railAct = (label, onclick) => {
    const b = el('button', 'px-qrow done', label);
    b.style.cssText = 'font-size:12px;margin-top:6px';
    b.onclick = onclick;
    rail.append(b);
  };
  if (clean && finished.length) {
    const armed = journalCleanArmed === 'clear';
    railAct(armed ? 'Click again to clear archive' : `Clear archive (${finished.length})`, () => {
      if (journalCleanArmed !== 'clear') { journalCleanArmed = 'clear'; render(); return; }
      journalCleanArmed = null;
      clean.clearFinished?.();
      if (String(questSel).startsWith('f:')) questSel = null;
      render();
    });
  }
  if (hidden.length) {
    railAct(questShowHidden ? `Hide hidden (${hidden.length})` : `Show hidden (${hidden.length})`, () => {
      questShowHidden = !questShowHidden;
      if (!questShowHidden && hidden.some((q) => q.key === questSel)) questSel = null;
      render();
    });
  }
  wrap.append(rail);

  const detail = el('div', 'px-qdetail');
  if (sel) {
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.name)), el('span', 'px-qwing px-flip'));   // PX28
    detail.append(head2);
    if (sel.entries) {
      // PX22: NO KIND TAG. PX5 put "Main Quest" / "Side Quest" beside
      // the timer; with the rail always showing three named sections
      // that is the same fact twice, and a quest is not TITLED by its
      // kind - it is filed under it. (The same cut PX20c made to the
      // pack's slots-filled count.) The meta line is the timer's now,
      // and exists only when there is a timer.
      const meta = el('div', 'px-qmeta');
      if (sel.clockSeconds != null) {
        // Under a game day the words go URGENT gold.
        const urgent = sel.clockSeconds < QUEST_URGENT_SECONDS;
        const timer = el('span', `px-qtimer${urgent ? ' urgent' : ''}`, `Time remains: ${remainWords(sel.clockSeconds)}`);
        meta.append(timer);
        armQuestTimer(timer, sel.key);
      }
      // GUIDE4: TRACK THIS QUEST on the HUD's card (ui/questTracker.js), beside its clock - the card follows the quest
      // the journal last changed until the player chooses one here (or in the chronicle: the same toggle, one home).
      if (followOn() && sel.id != null) meta.append(trackButton(document, sel.id, questTitleOf(sel.name)));   // AUDIT GUIDE T2; T5: changed in place, the tab not rebuilt
      if (meta.childNodes.length) detail.append(meta);   // PX22: an empty meta line is a gap the eye reads as a mistake
      // GUIDE2: WHERE THE QUEST POINTS NOW, and the way there - DFU's own logbook click (HandleQuestClicks), which
      // this journal never had: the latest entry's target through the quest lens, in the find-place box's words.
      const where = questWhere(sel.written?.at(-1)?.message, 'px-qwhere');
      if (where) detail.append(where);
    }
    // BOUNTY1 (Mac: "i also dont see the bounty in my questlog means i cant abandon it?"): a bounty's two presses - Abandon
    // (twice: the first arms it, so a stray click gives nothing up) and, in a party, Share
    if (sel.entries && isBountyQuestId(sel.id)) {
      const acts = el('div', 'px-qacts');
      acts.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px';
      if (bountyQuestShareable(sel.id)) {
        const sh = el('button', 'act', 'Share with party');
        sh.onclick = () => { shareBountyQuest(sel.id); render(); };
        acts.append(sh);
      }
      const armed = bountyAbandonArmed === sel.id;
      const ab = el('button', 'act', armed ? 'Click again to abandon' : 'Abandon bounty');
      ab.onclick = () => {
        if (bountyAbandonArmed !== sel.id) { bountyAbandonArmed = sel.id; render(); return; }
        bountyAbandonArmed = null;
        abandonBountyQuest(sel.id);
        questSel = null;
        render();
      };
      acts.append(ab);
      detail.append(acts);
    }
    // JOURNAL-CLEAN: an active quest HIDES from the journal (it keeps running - its clock, its HUD marks - and ends
    // into the archive like any other), and a hidden one unhides; one press each, since either is undone by the other.
    // An archived entry REMOVES - twice, BOUNTY1's arming, because a removed record does not come back.
    if (clean) {
      const acts = el('div', 'px-qacts');
      acts.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px';
      if (sel.entries && sel.id != null) {
        const isHidden = hidden.some((q) => q.key === sel.key);
        const hb = el('button', 'act', isHidden ? 'Unhide' : 'Hide from journal');
        hb.onclick = () => {
          if (isHidden) clean.unhide?.(sel.id);
          else { clean.hide?.(sel.id); questSel = null; }
          render();
        };
        acts.append(hb);
      } else if (!sel.entries) {
        const index = Number(String(sel.key).slice(2));
        const armed = journalCleanArmed === sel.key;
        const rb = el('button', 'act', armed ? 'Click again to remove' : 'Remove');
        rb.onclick = () => {
          if (journalCleanArmed !== sel.key) { journalCleanArmed = sel.key; render(); return; }
          journalCleanArmed = null;
          clean.removeFinished?.(index);
          questSel = null;   // the indices past it moved down one: 'f:<index>' now names the next record
          render();
        };
        acts.append(rb);
      }
      if (acts.childNodes.length) detail.append(acts);
    }
    if (sel.entries) {
      // Active: the LATEST entry is the state of the quest; the trail
      // beneath it, newest first.
      const latest = sel.entries[sel.entries.length - 1];
      const desc = el('div', 'px-qdesc');
      for (const line of latest) desc.append(el('p', null, line));
      detail.append(desc);
      if (sel.entries.length > 1) {
        detail.append(pxDivider('Journal'));
        const offered = latestPlace(sel);   // GUIDE2: the place the where line above already offers
        for (let i = sel.entries.length - 2; i >= 0; i--) {
          const e = el('div', 'px-qentry');
          const mark = el('span', 'px-qmark', '\u25c7');
          const text = el('div');
          for (const line of sel.entries[i]) text.append(el('p', null, line));
          // GUIDE2: an OLDER entry's own place - the classic logbook takes a click on ANY entry to where it names -
          // drawn only where it is a way somewhere (on the map, with a door here) and not the place the quest points
          // now, which the line above already offers.
          const was = questWhere(sel.written?.[i]?.message, 'px-qentry-where', { wayOnly: true, skip: offered });
          if (was) text.append(was);
          e.append(mark, text);
          detail.append(e);
        }
      }
    } else {
      // Archived: the verdict line, then the filed record.
      const verdict = sel.success == null ? null
        : `${sel.success ? 'Completed' : 'Ended'}${sel.when ? ` at ${sel.when}` : ''}`;
      if (verdict) detail.append(el('p', `px-qverdict${sel.success ? ' won' : ''}`, verdict));
      const desc = el('div', 'px-qdesc');
      for (const line of sel.lines) {
        if (line === '') { desc.append(el('div', 'px-qgap')); continue; }
        desc.append(el('p', null, line));
      }
      detail.append(desc);
    }
  }
  wrap.append(detail);
  body.append(wrap);
}

function render() {
  // MENU-EXIT1 (2026-09-20, rabid.rivas on Discord: "Crash when exiting..." - TypeError reading innerHTML of null):
  // a click handler may run an ACTION and then repaint - the confirm card's yes runs `onAction('exit')` and repaints
  // after it - and an action can tear this screen down synchronously (exit unwinds to the front door, destroy()
  // nulls `app`). A screen that is gone has nothing to paint; the repaint after it was the crash, on every exit
  // through the confirm.
  if (!app) return;
  repaintKeepingScroll(app, () => renderInto(), { focus: true });   // AUDIT 32 P3: the focus and the caret too
}

/** The rebuild. Wrapped for the reason the wizard's is: the settings
 *  list carries the same steppers, and a repaint that forgets the
 *  scroll throws the player back to the top of 66 Video rows. */
function renderInto() {
  if (groundTimer) { clearInterval(groundTimer); groundTimer = null; }
  if (questTimer) { clearInterval(questTimer); questTimer = null; }
  stopTimers();   // TIMERS1: a rebuild builds the window again, with its own tick
  app.innerHTML = '';
  // PX1/PX2: both doors open on the pixel home; every section keeps
  // its shell.
  if (section === 'home') { renderHome(); return; }
  // PX11 (Mac): the BOOT shell stands on the same living sky as the
  // home - the ground draws behind it and the shell's own chrome goes
  // translucent (enhancedStyle's PX11 block), so Settings at boot is
  // the one treatment, fullscreen. Same clock, same owner, same
  // reduced-motion opt-out; pause never reaches this branch.
  if (mode === 'boot') {
    const ground = document.createElement('canvas');
    ground.className = 'px-ground';
    const vw = () => globalThis.innerWidth ?? 1280;
    const vh = () => globalThis.innerHeight ?? 720;
    drawPixelGround(ground, vw(), vh(), 0);
    const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) {
      const t0 = Date.now();
      groundTimer = setInterval(() => drawPixelGround(ground, vw(), vh(), (Date.now() - t0) / 1000), 125);
    }
    app.append(ground, el('div', 'px-vignette'));
  }
  const shell = el('div', 'shell');

  const side = el('aside', 'side');
  const brand = el('div', 'brand');
  const h1 = el('h1');
  // PX1/PX2: the wordmark is the way back to the pixel home - the
  // same affordance every site's masthead carries. Escape does it too
  // (onKey); this is the one a finger can see.
  const homeMark = el('button', 'brand-home');
  homeMark.type = 'button';
  homeMark.setAttribute('aria-label', 'Daggerfall Online — main menu');
  homeMark.append(brandMark());
  homeMark.onclick = () => go('home');
  h1.append(homeMark);
  brand.append(h1);
  side.append(brand);

  const rail = el('nav', 'rail');
  for (const label of sections) {
    const id = idOf(label);
    const b = el('button', `railbtn${id === section ? ' on' : ''}`);
    b.append(el('span', 'rk', label));
    // RAIL_ACTS: Resume resolves on the rail rather than opening a
    // pane. Every other entry is a destination.
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id]) : () => go(id);
    rail.append(b);
  }
  side.append(rail);

  const foot = el('div', 'foot');
  foot.append(document.createTextNode('build '));
  foot.append(el('span', null, BUILD_TAG));
  side.append(foot);

  const pane = el('main', 'pane');
  if (section === 'settings') {
    // The settings pane owns its own three columns and its own
    // scrolling, so it takes the pane whole rather than sitting under
    // a heading that would eat a third of a phone screen.
    pane.style.overflow = 'hidden';
    paneSettings(pane);
  } else {
    pane.append(head(sections.find((l) => idOf(l) === section)));
    const body = el('div', 'body');
    if (confirming) body.append(confirmCard());
    else {
      ({
        continue: paneContinue, new: paneNew, load: paneLoad, online: paneOnline,   // ONLINE1
        test: paneTest,
        save: paneSave, exit: paneExit,
        features: paneFeatures,   // FT0
        overhauls: paneOverhauls,   // OVH1
        about: paneAbout, begin: paneBegin,   // FD1: the classic rail's door; SO1: Enhanced is a Settings category now
      })[section](body);
    }
    pane.append(body);
  }

  shell.append(side, pane);
  app.append(shell);
}

// ── THE KEYBOARD, AND WHAT IT IS NOT ─────────────────────────────
// U51 ships ESCAPE AND NOTHING ELSE, and says so rather than leaving
// the gap looking like an oversight. Escape is the door's own key -
// it is what opened this screen - and a pause screen you cannot get
// out of with the key that got you in is the trap the never-traps law
// is about.
//
// FLAGGED: the rest of the keyboard. The wizard walks to `done` with
// no pointer at all (U50, tools/enhancedChargenProbe.mjs) because a
// wizard is a LINE - up, down, confirm, back. This screen is three
// panes wide with a rail, a list and a help sheet, and arrow keys over
// it is a real design question about focus order, not a table lookup.
// Half of it would be worse than none: a rail that answers Down while
// the settings list does not teaches a player the list is broken.
//
// It routes through overlayAction - the SHARED table ui/input.js owns
// and every other window in the port answers through - so Escape here
// is the same Escape, rebound the same way, as Escape anywhere else.
//
// AUDIT DISC28 UI-2: IT HEARS BOTH EDGES. mountEnhancedMenu hands it the
// keyup as well as the keydown, because on the PAUSE FACE the back stack
// answers on the RELEASE - DaggerfallPauseOptionsWindow.Update closes on
// `GetKeyUp(toggleClosedBinding) || GetBackButtonUp()`, and the release
// is the one edge a held key never repeats. The press ARMS (`backArmed`)
// and is the screen's; its auto-repeats are swallowed and do nothing;
// its release acts. The press that OPENED the screen was the host's -
// the screen did not exist yet - so its repeats are swallowed here too
// and its release, finding nothing armed, is left to the host: the
// classic window's own isCloseWindowDeferred (ui/pauseWindow.js), which
// is DaggerfallAutomapWindow.Update's latch. The screen used to answer
// on the press, so the key that opened it closed it on its first
// repeat (the default Escape), and the press that closed it went on
// repeating into a host with no screen up - where world.js's and
// exterior.js's own pause arms answer a repeat and opened it again.
// The boot door answers on the press, as it always has: it is no DFU
// window, and the menu pad's Back (ui/menuPad.js) sends a press alone.
let backArmed = null;   // AUDIT DISC28 UI-2: the code of the back press the pause face saw, answered on ITS release - cleared by that release and by every mount
function onKey(e) {
  const release = e.type === 'keyup';
  if (release) {
    if (e.code !== backArmed) return;   // not the end of a press this screen armed (only the pause face arms one)
    backArmed = null;
  }
  // AUDIT DISC28 UI-1: THE META CHORD ALONE IS REFUSED UP FRONT. Ctrl
  // and Alt were refused here too, before anything asked what the key
  // MEANT - so a pause the player moved to a Ctrl/Alt combo, or to a
  // bare Ctrl or Alt key (the Controls pane binds both through
  // comboFromEvent), opened this screen through the host's read and
  // could never close it. AUDIT KB1 took the same refusal out of the
  // dial's own close (ui/enhancedOverlays.js onTab) and the sheet's
  // (ui/charSheetDoor.js). The chord refusal stands below, for every
  // key that is NOT the pause action's.
  if (e.metaKey) return;
  // MWFIX: ...AND SO DOES THE ONE ABOVE THIS. The law three paragraphs
  // down - a modal overlay owns its input - cuts both ways: this
  // handler is on `globalThis` in CAPTURE and stops what it takes, so
  // it reaches a key before any modal THIS screen opened. The asset
  // picker is exactly that, and Escape over it must close the picker,
  // not walk this screen's back stack out from under it.
  if (assetPickerOpen()) return;
  // FIX-F: ...and so does an ARMED REBIND. This handler is on the GLOBAL
  // in capture, so it runs before the Controls pane's own listener and
  // would eat the one key DFU lets through: ReservedKeys is empty in DFU
  // (InputManager.cs:73 `new KeyCode[] { }`, exposed :174-177), so the
  // gate that consults it (DaggerfallControlsWindow.cs:410) never refuses
  // a key - Escape included. Stand down; the pane stops the key itself.
  if (captureArmed()) return;
  // DISC28-A: and a mod's TextKey capture (HT1) - the same law. Registered after this handler, it ran second, so the
  // one key it waits for walked the back stack first; with the pause action's own key now back, a pause rebound to P
  // could not be given to a mod key without also leaving the page.
  if (textKeyCapture) return;
  if (peerBindBusy()) return;   // PEERMENU1: the player-menu bind is waiting for a key (or swallowing a pad B's Back)
  if (plusBindsOpen()) return;   // PADPLUS10: the Controller bindings window is over the menu - its Escape is its own
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  // DISC28-A (EvoAva, Discord: "If you change the default pause key binding from escape to anything else, it allows you
  // to open pause menu with that key binding, but not close it"): the table above maps the LITERAL Escape to back, and
  // the host opens this screen on the PAUSE ACTION - so a pause rebound to P opened it and P then meant `char:p` here,
  // which nothing took. DFU's pause window closes on the action's own binding (DaggerfallPauseOptionsWindow.cs:159
  // toggleClosedBinding = GetBinding(Actions.Escape), :186 GetKeyUp) as well as the back button, and the classic
  // window already does (ui/pauseWindow.js). On the pause face the action's key is back too.
  // AUDIT DISC28 UI-1: read off the EVENT, its modifier flags and all (eventMeans - InputManager.GetKeyUp's
  // GetUnaryKey answers a combo binding while its modifier is held), and read BEFORE the chord refusal, which now
  // refuses only what the pause action does not mean.
  const pauseKey = mode === 'pause' && eventMeans(e, 'Escape');
  if (!pauseKey && (e.ctrlKey || e.altKey)) return;
  if (overlayAction(e) !== 'back' && !pauseKey) return;
  // THE BACK STACK, innermost first. A confirm card and a phone's help
  // sheet are both things Escape should close before it closes the
  // screen, or the one press that means "not that" quits the game. At
  // boot, with neither open, there is nothing behind the front door to
  // go back to - and a key this screen did not USE has to stay the
  // page's, which is the wizard's own rule (ui/enhancedChargen.js: do
  // not preventDefault a key you did not take, or Tab stops moving
  // focus and the screen becomes unreachable to anyone driving it that
  // way).
  // ACC1f: the account window is the innermost thing Escape can close,
  // ahead of the confirm card and the help sheet - it is a modal over
  // the door, so the one press that means "not that" must close IT
  // rather than walk the screen out from under it.
  const back = accountOpen ? () => { accountOpen = false; render(); }
    : timersOpen && timersView ? () => { timersOpen = false; timersFocusBack = true; render(); }   // TIMERS1: the window first, ahead of the pause face's resume (AUDIT UI-11: a window that is drawn)
    // AUDIT 32 P12: an act under way on the Stores page is set down first (nothing spent, said) - never the window
    : profActUnderWay() ? () => { setDownProfAct(); render(); }
    : confirming ? () => { confirming = null; render(); }
    : sheetOpen ? () => { sheetOpen = false; render(); }
      : controlsPromptOpen() ? () => dismissControlsPrompt()   // AUDIT KB1: the Controls pane's own prompt answers No first - it never leaves the section with the staged binds
      : section !== 'home' ? () => go('home')   // PX1/PX2: a section backs out to the face
        : mode === 'pause' ? () => onAction('resume')   // Escape on the pause face resumes
          : null;
  if (!back) return;
  e.preventDefault();
  // A MODAL OVERLAY OWNS ITS INPUT (the wizard's own law, U50). On
  // CAPTURE and stopped here, so the host's window keydown - which
  // walks the player and would re-toggle this very screen - never sees
  // a key this screen used.
  e.stopPropagation();
  // AUDIT DISC28 UI-2: THE PRESS ARMS, THE RELEASE ACTS, A REPEAT DOES
  // NOTHING - on the pause face (the header above says why). A repeat
  // never arms: DFU's GetKeyDown is getKeyDownMethod, held now and not
  // held last frame, an edge a held key does not fire twice.
  if (mode === 'pause' && !release) {
    if (!e.repeat) backArmed = e.code;
    return;
  }
  back();
}

/**
 * AND THE POINTER LOCK - the wizard's other half of the same report
 * (see ui/enhancedChargen.js). A locked pointer does not travel
 * through the DOM at all: every mouse event goes to the locked element
 * as a movement delta, so a fixed div over the canvas is invisible to
 * it however high its z-index. At boot there is no lock to drop; in
 * pause there always is, because mouselook is the port's resting
 * state. Dropped on mount and kept dropped, so a host that re-takes it
 * gets it taken back once rather than this screen fighting for clicks
 * it cannot receive.
 */
function releaseLock() {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  } catch { /* a browser that refuses is a browser with no lock to drop */ }
}

/**
 * Mount the menu into a host element. Returns { unmount }.
 *
 * `mode` is 'boot' (the front door) or 'pause' (Escape, over a running
 * game); `hooks` is the host's own { quickSave, quickLoad, exitToMenu,
 * savingPrevented } and is read by the pause panes only.
 *
 * The style goes in here rather than at import time: a module that
 * writes to the document when it is merely IMPORTED cannot be imported
 * by a test, and the classic skin imports nothing of this at all.
 */
export function mountEnhancedMenu(host, {
  onAction: handler = () => {}, mode: m = 'boot', hooks: h = {},
  // PX26: which page the window opens ON. A door pressed for a page
  // should land on that page rather than on a menu with it one press
  // further in - the dial's north asked for the character sheet.
  at = null,
} = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  app = host;
  onAction = handler;
  mode = m === 'pause' ? 'pause' : 'boot';
  hooks = h ?? {};
  questRepairSaid = null;   // QREPAIR: a repair's line is that visit's
  // PROFILE2: and the profile window is a visit's too - the pause screen mounts this module again, and a window left
  // open on the door (or on the last pause) must not be standing over the next one before the player asks for it
  accountOpen = false;
  timersOpen = false;   // TIMERS1: and the timers window the same
  timersFocusBack = false;
  // MAC1 (Mac, 2026-09-10: "after exiting game and then going back to
  // enhanced settings, the Build and Switch Arms options are gone and
  // require me to reattach the files"). The Morrowind store is COUNTED
  // by the hosts' loadMagicRegistries (scenes/shared.js), and the boot
  // door opens before any host boots - so on this surface
  // morrowindDataCount() read -1's zero, the card offered Attach alone,
  // and an attach (which counts) was the only thing that brought the
  // two buttons back. Nothing was lost: the archives sat in IndexedDB
  // the whole time. Count here, and repaint once the count lands - a
  // menu torn down first repaints nothing.
  //
  // AUDIT 65 XL-6: and it counts by NAME. registerMorrowindData also
  // fingerprints the set, which walks every stored file's SIZE - and
  // before this audit that walk went through assetBlob, so the title
  // screen read and rewrote every legacy record a player had attached.
  // This surface needs one number, so it asks for one number
  // (countMorrowindArchives: one getAllKeys, no value read, no write).
  // The sizes and the fingerprint stay on the host bootstrap
  // (scenes/shared.js), which is the reader that needs them.
  if (!morrowindDataCounted()) {
    countMorrowindArchives().then(() => { if (app === host && host.isConnected) render(); }).catch(() => {});
  }
  // ACC2c: THE CLOUD LATCH IS PER VISIT, and AUDIT-312 F4 found it was
  // per PAGE LOAD - the module state simply stayed true, so a player
  // who backed a save up on their phone, came back to this tab and
  // reopened the menu was shown the listing from the last time it was
  // asked. The latch exists so a REPAINT does not re-ask; a fresh mount
  // is a fresh visit. The armed Delete goes with it, because an armed
  // destructive button must never outlive the screen it was armed on.
  cloudAsked = false;
  cloudArm = null;
  cloudWhy = null;   // the pre-merge audit (0927b): a refusal is last visit's news - this visit asks the service again
  realmAsked = false; realmRows = null; realmBusy = false;   // REALM P1.3: the realm is asked again each visit
  realmWords = [takeRealmNotice(globalThis.sessionStorage)].filter(Boolean);   // REALM P1.3: why the last online boot came back here
  sections = mode === 'pause' ? SECTIONS_PAUSE : isEnhanced() ? SECTIONS_BOOT : SECTIONS_CLASSIC;   // FD1: one door, two rails
  // WHICH PANE OPENS. Both doors open on the PIXEL HOME (PX1/PX2) -
  // the face itself, every section one press away. Pause used to open
  // straight on SAVE GAME (U51's law: what Escape was pressed for);
  // PX2 trades one press of depth for the face Mac adopted, with Save
  // Game the second row a thumb meets and Resume the first.
  section = 'home';
  pauseTab = 'system';
  // ...and THEN the caller's landing, if it named one. After the reset,
  // which is what keeps the reset the default rather than a thing this
  // has to work around. The tabbed window IS the pause home face, so a
  // landing sets the TAB and leaves the section alone.
  if (['quests', 'stats', 'system'].includes(at)) pauseTab = at;
  // DISC22-B: ...or a SECTION of the rail - the classic pause window's Controls button lands on Settings (the port's
  // whole settings screen, Controls among its categories), not on the home face a press away from it.
  else if (at && sections.some((l) => idOf(l) === at)) section = at;
  questSel = null;
  bountyAbandonArmed = null;   // AUDIT 28 B11: an armed Abandon never outlives the visit it was armed on
  journalCleanArmed = null;   // JOURNAL-CLEAN: ...nor an armed Remove or Clear archive
  questShowHidden = false;
  statsSec = 'character';
  resetProfPages();   // PROF1: an armed change of specialisation never outlives the visit
  resetCompanionRoster();   // COMPANION-ROSTER: nor an armed Release
  statsAllSkills = false;
  sysSec = 'save';
  category = CATEGORIES[0].id;
  pickedKey = null;
  sheetOpen = false;
  confirming = null;
  featureQuery = '';   // FT18: a fresh visit searches nothing
  discardControlsStaging();   // FIX-F: a second visit never inherits the first one's staged binds
  // PROF2: a landing on a professions page - the Stats tab at it (a home forge's press opens the Stores' forge); the
  // draw falls back to the character's own page when the professions are not the account's
  if (PROF_PAGE_SECTIONS.some(([id]) => id === at)) { pauseTab = 'stats'; statsSec = at; }
  _eff = null;
  render();
  keyHandler = onKey;
  backArmed = null;   // AUDIT DISC28 UI-2: a press is a visit's - the last screen's never answers on this one
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  globalThis.addEventListener('keyup', keyHandler, { capture: true });   // AUDIT DISC28 UI-2: the release, where the pause face answers
  // PX1: the pixel ground is drawn for the viewport it mounted on; a
  // rotate or a resize while the home is up redraws it, or the sky
  // stretches - the prototype's own phone-shot lesson.
  resizeHandler = () => { if (mode === 'boot' && section === 'home') render(); };
  globalThis.addEventListener('resize', resizeHandler);
  lockHandler = releaseLock;
  releaseLock();
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  // The probe surface, the same shape settingsProbe.mjs drives: a real
  // browser check should read the SAME layout a finger taps.
  globalThis.__menu = () => JSON.stringify({
    mode, section, category, pickedKey,
    sections: sections.map(idOf),
    rows: [...host.querySelectorAll('.row')].length,
  });
  return {
    unmount() {
      // EVERY LISTENER HAS AN OWNER (the wizard's law, U50). A
      // window-level keydown outlives the DOM it was mounted for, so a
      // menu torn down without this eats Escape for the whole session
      // - which on the pause door means the game can never be paused
      // again.
      if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
      if (keyHandler) globalThis.removeEventListener('keyup', keyHandler, { capture: true });   // AUDIT DISC28 UI-2
      if (lockHandler && typeof document !== 'undefined') document.removeEventListener('pointerlockchange', lockHandler);
      if (resizeHandler) globalThis.removeEventListener('resize', resizeHandler);
      if (groundTimer) { clearInterval(groundTimer); groundTimer = null; }
      if (textKeyCapture) { globalThis.removeEventListener('keydown', textKeyCapture, true); textKeyCapture = null; }   // DISC28-A
      if (questTimer) { clearInterval(questTimer); questTimer = null; }
      stopTimers();   // TIMERS1
      // FIX-F: and the rebind pane's own capture listener, which is on
      // the DOCUMENT and would outlive this screen exactly as the one
      // above would.
      discardControlsStaging();
      keyHandler = null;
      lockHandler = null;
      resizeHandler = null;
      host.innerHTML = '';
      app = null;
      onAction = () => {};
      hooks = {};
      delete globalThis.__menu;
    },
  };
}

/**
 * The GAME's front door: mount over the canvas, resolve with the
 * action the player picked, and take the screen down on the way out.
 *
 * Settings, Mods and About never resolve - they are destinations
 * inside this screen, not exits from it - which is the whole point of
 * one menu rather than four.
 */
export function runEnhancedMenu(doc = document) {
  const host = doc.createElement('div');
  host.id = 'enhanced-menu';
  // Over the canvas, and OPAQUE: the renderer clears to the pale Iliac
  // Bay sky, which would otherwise show through as a blue wash. The
  // classic menu solves the same problem by filling its letterbox
  // black (startWindow.js draw), and this is that law in CSS.
  host.style.cssText = 'position:fixed;inset:0;z-index:12;background:#0e1013;overflow:hidden';
  doc.body.append(host);
  return new Promise((resolve) => {
    const menu = mountEnhancedMenu(host, {
      onAction: (action) => {
        // SAV4 shipped the save manager (systems/saveSlots.js:366
        // deleteSave), and this file deletes through it at :387 behind
        // an ask() confirm. Nothing routes 'delete' out here - every
        // onAction call site names its own verb and RAIL_ACTS (:162) is
        // `{ resume: 'resume' }` - so this belt is vacuous, kept only
        // so a future rail entry cannot resolve the boot promise with a
        // verb the caller has no window for.
        if (action === 'delete') return;
        menu.unmount();
        host.remove();
        resolve(action);
      },
    });
  });
}
