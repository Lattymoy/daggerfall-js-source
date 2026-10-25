// ═══════════════════════════════════════════════════════════════════
// ENHANCED — THE MAIN MENU
//
// The game's front door when the skin is enhanced, and ENHANCED IS THE
// DEFAULT (systems/uiSkin.js). One screen: continue, new game, load,
// settings, mods, about.
//
// ONE IMPLEMENTATION, THREE HOSTS. This module is mounted by the game
// at boot (src/main.js), by the prototype page (/menu.html, via
// src/tools/enhanced/enhancedMenu.js), and by the PAUSE DOOR once the game is
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
// This is ONE screen, under BOTH skins (main.js:"── THE FRONT DOOR", FD1: the
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
// settings screen uses - systems/settings/settings.js, ui/settings/settingsMap.js,
// ui/settings/settingsLaw.js, ui/settings/settingsCopy.js. About 850 lines of law, all
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

import { fpArm, hasDaggerfallArrows } from '../../combat/fpArm.js';
import { dressStanding } from '../../systems/clothingStanding.js';   // DRESS1 (2026-09-30, Discord): the Standing page's Dress line
import { questRail, shelvedRail, unloggedRail, journalLines, questTitleOf, QUEST_URGENT_SECONDS, remainWords } from '../quest/questRail.js';   // MAC-K2: the ONE quest walk, shared with the chronicle
import { qlObjectivesBlock, qlOfferDetail, offerRowWords, qlLineDetail, lineStateWords, qlLadderDetail } from '../questlines/qlJournal.js';   // QL2: a stamped quest's objectives, choices and outcome; the rewards waiting
import { lineStepOf } from '../../systems/questlines/qlLines.js';   // QL-OFFERED: a questline's step drawn under its line, never as a side quest
import { TITLE_TEXT } from '../playerBadge.js';   // QL12: the title a questline earns, in the badge's own words
import { filedOutcome } from '../../systems/notebook.js';   // AUDIT QUESTLINES UI-5: an archived quest's outcome, the archive's alone to draw
import { entryTarget, targetWords, WHERE_TEXT } from '../quest/questLens.js';   // GUIDE2: where a quest points, and the way there
import { questTracker, followOn, trackButton } from '../quest/questTracker.js';   // GUIDE4: the HUD's card - the Track toggle, and the quest the journal opens on
import { closeOnOutsideTap } from './enhancedOverlays.js';   // OT1: a tap on the scrim resumes
import { drawTutorialsPane, releaseTutorialsPane } from '../tutorialsPane.js';   // TUT1: the Tutorials tab and section - every tutorial page, to read again
import { drawShotsPane, releaseShotsPane } from '../shotsPane.js';   // LOAD1: the Screenshots pane - the gallery the PrintScreen key keeps
import { TEST_PRESETS, TEST_RIDE, TEST_SEA, TEST_LOOT } from '../../systems/testRoom.js';   // TR3: the one home the pane shows; TSR4: the ride; LR3: the loot ladder
import { mwRaceId } from '../../formats/morrowind/mwNpc.js';
import { EQUIP_SLOTS, equipTableOf } from '../../systems/equip.js';
import { boonStatRows } from '../temperatureCard.js';   // AUDIT C&C B11: the Attributes page names the boons that raise them
import { dfWornEquipment } from '../../formats/morrowind/mwItemMap.js';
import { ARMOR_ENUM } from '../../combat/enemyEquipment.js';
import { morrowindDataCount, morrowindDataCounted, countMorrowindArchives, assetPickerOpen, textureStoreRegistered, textureStoreSettled } from '../../scenes/dataSource.js';   // MAC1: the boot door counts the store itself; AUDIT 65 XL-6: by NAME - it never reads a stored file   // MW-IMPORT: the attach door; MWFIX: and the modal it opens owns the keyboard
import { CATEGORIES, keysOf, isSettingItem, optionPath, whereIs } from '../settings/settingsMap.js';   // ORG2: the one map of every option
import { GRAPHICS_PRESETS, PRESET_ROWS, PRESET_PARTS, presetNow } from '../../systems/graphicsPresets.js';   // ORG2; MEM-AUDIT: and its parts
import { widgetFor, blockedReason, formatValue, stepValue, COLOUR_KEYS, ENUM_LAW, enumWords } from '../settings/settingsLaw.js';   // FT14: the enum's own values are the bar's segments
import { labelOf, helpOf, INSTEAD, TIER_TEXT } from '../settings/settingsCopy.js';
import {
  effectiveSettings, setValue, saveSettings, resetToDefaults, tierOf, DEFAULTS, defaultOf,
} from '../../systems/settings/settings.js';
import { mostRecentRestorable, restorableSaves, firstRestorable, deleteSave, QUICK_SAVE_NAME, loadSlot, saveSlot } from '../../systems/save/saveSlots.js';
import { offlineCopyOf, onlineCopyOf } from '../../systems/offlineCopy.js';   // AUDIT LIVED1 E/G: the doors between the lanes
import { sharedClassicMinutes } from '../../net/wire.js';   // AUDIT LIVED1 G: the shared clock's minute a character joins at
import { SKY_SEGMENTS, skyClassicMinutes, wallMsForSkyMinutes } from '../../net/skyLaw.js';   // TIME4: the sky's day, said at the door
import {
  realmIo, realmList, realmCustoms, realmPut, realmDelete, realmUndo, realmFetch, realmRowAsSave, realmSummaryOf, realmRefusalText, takeRealmNotice,
  sweepUnsent,
} from '../../systems/realmSaves.js';   // REALM P1.3: the Online door lists the realm's characters, the service's
import { applyCustoms, customsLines, crossLeveling, LEVELING_CROSS_LINE } from '../../systems/realmCustoms.js';   // REALM P1.5: an offline character comes in once, through customs
import { createRealmLine } from '../../systems/legacy/realmLine.js';   // HOUSE-WAITS (FIELD BUGS 2026-10-09f): the account's lines, read at the door
import { loadFamily } from '../../systems/legacy/store.js';
import { waitingHouses, takeUpLine, houseWaitsTitle, houseWaitsLine, heirButtonLabel } from '../../systems/legacy/waitingHouses.js';
import { mintCharacterId } from '../../systems/characterId.js';   // REALM P1.4: a copy to offline is a new offline character
import { exportSavesZip, collectSlots, importSlots, entriesFromFiles, slotPathOf, TRANSFER_ZIP_NAME } from '../../systems/save/saveTransfer.js';   // SP1: saves move between the website and the app
import { appStorage, tabStorage } from '../../systems/appStorage.js';   // SP1: the store under this build - the browser's on the site, the file store in the app   // SAV4: the slot store; SLOTS1: every slot
import { uiSkin, SKIN_NAMES, isEnhanced } from '../../systems/uiSkin.js';   // FD1: which boot rail
import { getPref, setPref, isOpen, setOpen, PREF_DEFAULTS } from '../../systems/uiPrefs.js';
import { EG_DANGER_PALETTES, EG_DANGER_PALETTE_KEYS } from '../eliteGates/egAccess.js';   // EG-G1: the Spire's danger palettes, named once
import { TOUCH_BUTTON_SLOTS, touchButtonSlots, nextTouchButton, touchButtonChoices } from '../touch/touchButtons.js';   // TOUCH-BUTTONS: the corner's three slots
import { DEFAULT_SERVER } from '../../net/online.js';   // ONLINE1: the relay this port hosts, the field's placeholder   // R7: the port's own switches; SO1: the folded tiers' memory
import { GATE_CROWD_TIERS } from '../../net/gate/gateCrowd.js';   // GATE-CROWD: how many other players are drawn at once (CROWD-WIDE: everywhere, not a gate's court alone)
import { PEER_RANGE_TIERS, peerRangeOf } from '../../net/peer/peerRange.js';
import { YARD_RANGE_TIERS, yardRangeOf } from '../../net/yardRange.js';   // YARD-RANGE: how far other players' yards are drawn   // PEER-RANGE: how far out other players are drawn, and the distance a stored value stands for
import { replacementCount } from '../../systems/musicReplacement.js';   // M-EXT: the packs card reports what the pick covers
import { midiOutSupported, midiOutDenied, midiOutName, midiOutputs, setMidiOut, nextMidiOut, MIDI_OUT_PREF } from '../../systems/midiOut.js';   // MIDI-OUT1: the Audio tab's device row
import { brandMark } from '../brandMark.js';   // INTRO2: Mac's supplied logo, shared with the final splash
import { soundReplacementCount } from '../../systems/soundReplacer.js';   // SNDREP1: the sound pack's count
import { textureReplacementCount, bundleTextureCount } from '../../systems/textureReplacement.js';   // M-TEX: and the texture half; DFMOD1: and the bundles'
import { attachedDfmods, DFMOD_DETAIL, dfmodMaxSize, setDfmodEnabled, unregisteredDfmods } from '../../systems/dfmodTextures.js';   // VE3: a mod switched on or off; AUDIT VE R5: and one stored that did not register
import { isIilMod } from '../../systems/improvedInteriorLighting.js';   // IIL3: the lighting mod's own section   // DFMOD1: the attached texture mods, one row each; DFMOD2: the detail choice
import { isTouchDevice } from '../touch/touch.js';   // TI2: the Touch card mounts only where a finger can reach it
import { dateFromClassicMinutes, dateString } from '../../systems/gameDate.js';
// PX5: the pause clock reads THE ONE CLOCK directly (AUDIT 23 C2's
// law - every host already reads this same module), so no host seam
// is needed and no host can drift.
import { worldMinutes, skyMinutes, trustedWorldMinutes, worldSpanRealWords, ownMinutes } from '../../systems/worldTick.js';
import { BUILD_TAG, UPDATE } from '../../buildTag.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from '../domRepaint.js';
import { drawPixelGround } from '../pixelGround.js';
// PX3: the pause window's Stats tab reads the shared player entity
// through the char sheet's own model - one law, not a restatement.
// Both are plain modules with no game data; the boot door never
// renders the tab, so the front door still reads no game state.
import { sheetModel } from './enhancedCharSheet.js';
import { profPagesShown, PROF_PAGE_SECTIONS, drawProfessionsPage, drawStoresPage, resetProfPages, profActUnderWay, setDownProfAct } from '../professions/profPages.js';   // PROF1: the Professions and Stores pages, online
import { vendorPageShown, VENDOR_PAGE_SECTIONS, drawVendorPage } from '../vendor/vendorPage.js';   // HOME-VENDOR: the Vendor page
import { REVENANT_PAGE_SECTIONS, revenantPageShown, drawRevenantsPage } from '../revenant/revenantPage.js';
import { COMPANION_PAGE_SECTIONS, companionPageShown, drawCompanionsPage, resetCompanionRoster } from '../companionRoster.js';   // COMPANION-ROSTER: the sworn and the slots
import { STABLE_PAGE_SECTIONS, stablePageShown, drawStablePage, resetHoldingsPages, holdingsProvider } from '../holdingsPages.js';   // HOLDINGS: the horse and the wagon - GROWTH1: and the captain's sky's deps
import { FAMILY_PAGE_SECTIONS, drawTreePage, drawHousePage, drawHallPage, drawGuidePage, resetFamilyPages, disarmFamilyPages, sheetHouse, familyTabShown } from '../familyPages.js';   // LEGACY3: Project Legacy's Family tab; LEGACY-SHEET: the house on the Stats page; FAMILY-TAB: drawn while the game is played with it
import { FLEET_PAGE_SECTIONS, fleetPageShown, drawFleetPage, resetFleetPage } from '../fleetPage.js';   // HOLDINGS: the ships
import { CAPTAIN_PAGE_SECTIONS, captainPageShown, drawCaptainPage } from '../captainPage.js';   // CAPT-LOG: the captain's standing and log
import { drawGrowthTab, resetGrowthTab, releaseGrowthTab, growthBack, growthAsks, growthPageAt, setGrowthSection, growthDue } from '../growth/growthTab.js';   // GROWTH1: the Growth tab - the level, the specialisations, the skies
import { stageLive } from '../growth/growthStage.js';   // GROWTH3: a face up in the tab - the window's Escape asks it first
import { COLLECTION_PAGE_SECTIONS, COLLECTION_PARTS, collectionsPageShown, drawCollectionsPage, resetCollectionsPage, disarmCollectionsPage, setCollectionsPart, rereadCollectionsAccount } from '../collectionsPage.js';   // COLLECTIONS: the codex and the cards - AUDIT COLLECTIONS-II: its parts by name, and its read asked again when the account card closes
import { swornBodyOf } from '../../systems/revenant/revenantCompanions.js';   // COMPANION-ROSTER: a sworn one's live health
import { enemyDisplayName } from '../../characters/enemy/enemyBasics.js';   // REVENANT-PAGE: a revenant's kind   // REVENANT-PAGE: the foes that have earned your name
import { affiliations } from '../../systems/affiliations.js';
import { ROLL_GAIN_DAY_MAX } from '../../net/npcChapterLaw.js';   // STANDING-WORDS: the day's pace, said beside the owed
import { legalRepOf } from '../../systems/court.js';   // REP5: the law, region by region
import { banishmentLeft, banishmentDaysLeft, KNOWN_CRIMINAL_BELOW, pardonPrice, challengeFine } from '../../systems/standing.js';
import { legalStandingWord } from '../../systems/legalBands.js';
import { REGION_NAMES } from '../../formats/mapsTables.js';   // GUILD-REP: the sheet's Affiliations box, on the Standing page
import { hudLocked, setHudLocked, resetHudLayout, hudBarsSplit, setHudBarsSplit } from '../hud/hudLayout.js';   // HUD-MOVE: Lock UI and Reset UI
import { enhancedHudScale as hudScaleNow, HUD_SCALE_MIN, HUD_SCALE_MAX } from './enhancedHud.js';   // PX30c
import { mapScaleLabel, nextMapScale } from '../map/mapScale.js';   // FIELD BUGS 2026-10-09e MAP-SCALE: the Maps row
import { standingGroups } from '../../systems/faction/factionStanding.js';   // FIELD BUGS 2026-10-09e EVERY-STANDING: every organization's reputation
import { wayBackQuestLine } from '../../systems/guild/guildServiceFlow.js';   // WAY-BACK: the way into a guild, under its row
import { activeMemberships, guildOfFaction } from '../../systems/guild/guilds.js';   // WAY-BACK: the book the join reads, and GetGuild(factionId)
import { resolveVariantGuild } from '../../systems/guild/guildVariants.js';   // WAY-BACK: ...a temple's or an order's
import { playerEntity } from '../../characters/playerEntity.js';
// PX6: the Stats page's skill labels - the one home (systems/skills.js).
import { SKILLS, SKILL_NAMES } from '../../systems/skills.js';
import { overlayAction, bindings, eventMeans } from '../input.js';   // U51: Escape, through the shared table; UXB1-F: the live keys a tile names; DISC28-A: the pause action's own key
import { bindings as liveBindings } from '../input.js';   // PADPLUS1: the store the layout reset writes
import { resetPlusPadLayout } from '../plus/plusPad.js';   // PADPLUS1
import { hdGlyphSvg, hdGlyphName } from '../padGlyphsHD.js';   // PADPLUS1: the layout card's glyphs
import { padFamily as livePadFamily } from '../padGlyphs.js';   // PADPLUS1
import { openPlusPadBinds, plusPadLegend } from '../plus/plusPadBinds.js';   // PADPLUS10: the controller bindings window
import { plusBindsOpen, resetPlusDpad } from '../plus/plusPad.js';
import { peerBindBusy } from '../peerMenuBindCard.js';   // PEERMENU1   // PADPLUS10: the window over this one answers its own keys
import { modKeyRows } from '../../systems/controlsConfig.js';   // UXB1-F: a mod's keys, read-only on its tile
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, isIntKey, isFloatKey, isChoiceKey, isTextKey, isTupleKey } from '../../systems/modSettings.js';   // REALM P0.2: onlineModSetting, the room's value for a key it owns (whole mods included)
import { keyCodeForDomCode, KEYCODE_NONE } from '../../systems/keyCodes.js';   // HT1: a TextKey's capture spells the key as Unity would
import { isOnlinePage, onlineForcedPref, onlineForcedModSetting, onlineForcedSetting, onlineWholeModKey, ONLINE_ROOM_MOD_KEYS } from '../../systems/online/onlineLane.js';   // OL1: online is the enhanced lane, whole - a forced switch is shown locked   // ROADS 24; DS1: the integer keys; UL1: the choice keys
import { onlineSyncPlan, applyOnlineSync, lastOnlineSync, undoOnlineSync } from '../../systems/online/onlineSync.js';   // UXB1-E: the room's rules, copied home
import { CREDITS, translationCredits } from '../credits.js';   // CR1: who made what the port carries
import { SUPPORT_ASKS } from '../supportAsks.js';   // SUPPORT1: the project's asks - the website's corner and this door's
import { t, tIn, currentLocale, localeInfo, localeTable, availableLocales, BASE_LOCALE, localizedText, formatText } from '../../systems/textManager.js';   // L10N1b: the port's own strings, the language row and the first-run offer; L10N3d: DFU's Internal_Strings
import { localeForBrowser, catalogLocale } from '../../systems/localeCatalog.js';   // L10N1b
// FIX-F (Mac: "changing keybinds in classic/enhanced do not work"): the
// rebinding pane. The enhanced skin is the DEFAULT and had no door to
// the key bindings at all - the only one in the port opens off the
// CLASSIC pause window. The pane is its own module because it owns a
// document-level capture listener and a staged copy of both binding
// dicts, neither of which belongs in a screen that repaints itself.
import { paneControls, discardControlsStaging, captureArmed, controlsPromptOpen, dismissControlsPrompt } from './enhancedControls.js';
// FT0: the features home - one list over the three stores, filtered by kind
import { OVERHAUL_PANELS, currentOption } from '../../systems/overhauls.js';
import { setVeAddon } from '../../systems/vanillaEnhanced/vanillaEnhanced.js';   // VE4: an add-on switched from the Texture Overhaul card
import { installVanillaEnhancedPack } from '../../systems/vanillaEnhanced/vanillaEnhancedPack.js';   // VE4: the shipped mods listed before any host boots
import { PLUS_THEMES } from './enhancedFrame.js';   // PLUS2: Enhanced Plus's colours
import { plusTheme, setPlusTheme } from './enhancedPlusStyle.js';
import { plusCursorOn, setPlusCursor } from '../plus/plusCursor.js';   // OVH1: the three looks
import { CHAT_LANGS } from '../../net/wire.js';   // CHAT-LANG: the language channels, for the Chat rows
import { TEXT_FONTS, textFont, textFontSystem, setTextFont, setTextFontSystem, cleanFamily, canListFonts, installedFamilies, fontMatches } from '../textFont.js';   // TEXT-FONT: the words' face
import { GRIMOIRE_PAGES, GRIMOIRE_BACKDROPS, GRIMOIRE_VITALS, GRIMOIRE_SPELLBOOKS, GRIMOIRE_DIALS, grimoirePages, grimoireBackdrop, grimoireVitals, grimoireSpellbook, grimoireDial, setGrimoirePages, setGrimoireBackdrop, setGrimoireVitals, setGrimoireSpellbook, setGrimoireDial } from '../grimoireDress.js';   // GRIM1: DFO Grimoire's own rows; GRIM3: and its spellbook
import { UI_PACKS, packUrl } from '../../systems/uiPack.js';   // OVH2: a pack's own picture on its card
import { FEATURES, KINDS, KIND_ORDER, featureForControl, resolveControl, modModules, modDials, featureSearchText } from '../../systems/features.js';   // FT14: each mod's curated keys (ORG2: the map places the rows, ui/settings/settingsMap.js)
import '../../world/landView.js';   // RF4: the land-view lane registers itself with the registry
import '../../world/outdoors.js';   // RF4: the outdoors lane too
import '../../systems/featureLanes.js';   // FT18: the wind, the quick slots and the blood
// ACC1e: the account card at the head of the Online pane - the flow
// thinks (ui/accountFlow.js, node-drivable), this draws it
import { AccountFlow } from '../accountFlow.js';
import { accountCard } from './enhancedAccount.js';
import { skinCard } from '../skinCard.js';   // DISC23-B2: the skin, on the profile
import { saveTile, cloudStateOf, saveFromCard, newerBackup } from '../saveTile.js';   // TILE1 (Mac: "a detailed tile based design for your saves... showing your portrait and character information"), and ACC2c's card-shaped save
import { loadFace } from '../facePortrait.js';
import { timersMark, timersWindow, anchorBeside } from './enhancedTimers.js';   // TIMERS1: the hourglass beside the profile mark, and its window
import { postMark, postWindow, watchPostMark, anchorPost } from './enhancedPost.js';   // SERVER-POST: the mailbox beside the hourglass, and its window
import { seasonMark, seasonWindow, seasonSource, anchorSeason } from './enhancedSeason.js';   // SEASON-BOOK: the laurel beside the envelope, and its window
import { profileBadge, portraitSave, liveCharacter, characterLine } from '../profileBadge.js';   // PROFILE1: the mark is the last character's portrait   // TILE1: the character's face, the one home chargen also reads
import { profileIconNode } from '../profileIcons.js';   // WITCH1: a profile icon worn, in the mark's portrait
import { ownIcon } from '../../systems/ownGlyphs.js';   // WITCH1: the icon the stored session says this device's player wears
import { cloudIo, cloudList, pushSlot, pullSlot, removeCloudSlot, cloudOnly, slotKeyOf, cloudRefusalText } from '../../systems/cloudSaves.js';   // ACC2: the backup a tile can offer, AUDIT-312 F1's delete, and ACC2c's download of a save that is only up there
import { serviceBase, storedSession } from '../../net/accountClient.js';
import { isBountyQuestId, abandonBountyQuest, shareBountyQuest, bountyQuestShareable } from '../../systems/bounty/bountyJournal.js';   // BOUNTY1: a bounty in the journal - its Abandon and its Share
import { isHuntQuestId, abandonHuntQuest } from '../../systems/huntJournal.js';   // RVN7c: a revenant's hunt in the journal - its Abandon
import { liveBundles, canEndBundle, endBundle } from '../../systems/mysticism.js';   // BUFF-END: the Stats page's Effects - the ONE bundle walk, and which the player may end
import { maxRoundsRemaining } from '../hud/hudActiveSpells.js';   // BUFF-END: a bundle's rounds, as the HUD reads them

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
const SECTIONS_BOOT = ['Online', 'Continue', 'New Game', 'Load Game', 'Test Room', 'Settings', 'Overhauls', 'Tutorials', 'Screenshots', 'About'];   // UI-CALM: Online first, Offline's four under it (drawDoors, the rail's own word)   // TUT1: the tutorials, to read before the game (ui/tutorialsPane.js)   // ORG2: Features is Settings' tabs now   // LOAD1: the gallery (ui/shotsPane.js)   // OVH1: the three looks   // FT16: Controls is a Settings CATEGORY, not a rail door   // FT14: Mods is gone - every mod is a tile on Features, and what the pane carried besides stands under them   // ONLINE1: the shared world's door
// FD1 (Mac, 2026-09-11): the CLASSIC skin opens on this same door. Its
// three game doors collapse into BEGIN, which leads into the classic
// start sequence - the title, the film, Daggerfall's own start window -
// so the classic player keeps every screen Daggerfall had and gains
// the one it never did: settings before the game, without a wizard.
// SO1: ENHANCED left the rail for a category of Settings (settingsMap).
// ONLINE1: ONLINE joins it - Mac: "if using classic, you'd see the
// other user's paperdoll" - the same pane, the same save brought in.
const SECTIONS_CLASSIC = ['Begin', 'Online', 'Settings', 'Overhauls', 'Tutorials', 'Screenshots', 'About'];   // TUT1   // ORG2   // LOAD1: the key keeps its shots under either skin   // OVH1   // FT14; FT16: Controls is a Settings category

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
const SECTIONS_PAUSE = ['Resume', 'Save Game', 'Load Game', 'Settings', 'Overhauls', 'Tutorials', 'Screenshots', 'About', 'Exit'];   // TUT1: a landing's shell (the window's own door is its Tutorials tab)   // ORG2   // LOAD1   // OVH1   // FT14; FT16: Controls is a Settings category

const idOf = (label) => label.toLowerCase().split(' ')[0];

/** UI-CALM: the doors behind Offline on the enhanced front door, in order - the games this device keeps. */
export const HOME_OFFLINE = Object.freeze(['Continue', 'New Game', 'Load Game', 'Test Room']);
/** UI-CALM: the two small doors under the two questions - the settings a player may want before either. */
export const HOME_LINKS = Object.freeze(['Settings', 'Overhauls']);
/** UI-CALM: whether a section is one of Offline's (its Escape lands back on the offline doors). */
export const offlineSection = (id) => HOME_OFFLINE.some((l) => idOf(l) === id);

/** L10N1b: the rail's words in the player's language. The ids stay the English labels' (idOf), every English label
 *  reads back as itself, and each is one literal call so tools/l10nExtract.mjs reads the catalog off the source. */
const RAIL_TEXT = Object.freeze({
  continue: () => t('menu.rail.continue', 'Continue'),
  new: () => t('menu.rail.new', 'New Game'),
  load: () => t('menu.rail.load', 'Load Game'),
  online: () => t('menu.rail.online', 'Online'),
  test: () => t('menu.rail.test', 'Test Room'),
  settings: () => t('menu.rail.settings', 'Settings'),
  features: () => t('menu.rail.features', 'Features'),
  overhauls: () => t('menu.rail.overhauls', 'Overhauls'),
  tutorials: () => t('menu.rail.tutorials', 'Tutorials'),
  screenshots: () => t('menu.rail.screenshots', 'Screenshots'),
  about: () => t('menu.rail.about', 'About'),
  begin: () => t('menu.rail.begin', 'Begin'),
  resume: () => t('menu.rail.resume', 'Resume'),
  save: () => t('menu.rail.save', 'Save Game'),
  exit: () => t('menu.rail.exit', 'Exit'),
});
const railLabel = (label) => RAIL_TEXT[idOf(label)]?.() ?? label;

/** Rail entries that ACT rather than navigate. Resume has no pane to
 *  show - a screen whose only content is a button repeating the word
 *  you just pressed is a screen that wasted a press. */
const RAIL_ACTS = Object.freeze({ resume: 'resume' });

// PER-MOUNT STATE. It was module-scope while this was a page that
// could only be opened once; the game mounts and unmounts it, so a
// second visit must not inherit the first one's open sheet.
let section = 'continue';
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
// UI-CALM (2026-10-14, a player: "The first screen should just have ONLINE and OFFLINE, with Online first. Continue, New
// Game and Load Game belong under Offline. I've seen people create characters thinking they're playing online, only to
// discover later that they're offline."): THE ENHANCED DOOR ASKS ONE QUESTION FIRST - which world - and only then which
// game. 'top' is the two doors (Online, Offline); 'offline' the offline doors (HOME_OFFLINE) and the way back. Every
// visit opens on 'top'; a section an offline door opened backs out to 'offline', where its press was made.
let homeLevel = 'top';
/** AUDIT UICALM-FIRM1 L3 L1: the keyboard's place after a level changes - the door named, else the level's first. */
function focusDoor(id) {
  globalThis.requestAnimationFrame?.(() => (app?.querySelector?.(`.px-menu .door-${id}`) ?? app?.querySelector?.('.px-menu .doorbtn'))?.focus?.());
}
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
let timersFocusIn = false;    // AUDIT SEASON-BOOK U3: the window just opened - the focus goes into it, once
const stopTimers = () => { timersView?.stop(); timersView = null; timersAnchor?.(); timersAnchor = null; };
/** EG-ZM (Elite-Gates.md section 20): a timers row's door (the Elite rows' Boards) is a handoff, as the sheet's doors are -
 *  the pause face down first, the door's window in the slot it frees, and a door that opened nothing a resume. */
// AUDIT GROWTH LANE2-3: a Growth face under it asked first (GROWTH5) - the timers window shut so the ask is seen
const timersDoor = (fn) => {
  if (pauseTab === 'growth' && growthAsks()) { timersOpen = false; timersFocusBack = true; render(); return; }
  handoff(fn, (r) => !!r);
};
/** AUDIT SEASON-BOOK S3: A DOOR HANDED THE SLOT - the pause face down, the door asked, and a door that opened nothing
 *  (`opened` false of its answer) a resume. The handler is read BEFORE the handoff: the handoff unmounts the face, and the
 *  unmount empties `onAction` - a resume asked of it after was a no-op, the pointer left free under a running game (AUDIT
 *  27h A4's law, at every door that leaves the face: the sheet's, the hourglass's, the Fleet's, the Captain's, a Growth
 *  page's, the season's). */
function handoff(fn, opened = (r) => r !== false) {
  const act = onAction;   // AUDIT SEASON-BOOK S3: the handler as it stood - the handoff can unmount the face, which empties it
  onAction('handoff');
  const r = fn();
  if (!opened(r)) act('resume');
  return r;
}
/** SERVER-POST: the mailbox's window over the pause face, its live view, the envelope's count kept live and its placing. */
let postOpen = false;
let postView = null;
let postWatch = null;
let postAnchor = null;
let postFocusBack = false;   // a closed window hands the focus back to the envelope, as the hourglass's does
let postKeep = {};   // AUDIT SERVER-POST: what the window shows (the piece open, the line said) - a rebuild of the face keeps it
const stopPost = () => { postView?.stop(); postView = null; postWatch?.(); postWatch = null; postAnchor?.(); postAnchor = null; };
/** SERVER-POST (Mac: "an ingame server mailbox that goes next to the hourglass in the pause menu. It should show
 *  notifications whenever players have a message"): THE ENVELOPE on the pause face - online, where the host hands its box
 *  (hooks.post), left of the hourglass `glass` (or the profile mark); its count follows the box while the face stands
 *  (the face draws itself only when asked). Answers the envelope, or null where there is no box. */
function postEnvelope(home, glass) {
  if (!hooks.post?.()) return null;
  const envelope = postMark(document, { open: postOpen, count: hooks.post()?.waiting ?? 0, onOpen: () => { postOpen = true; render(); } });
  home.append(envelope);
  postAnchor = anchorPost(envelope, glass, home.querySelector?.('.px-profile'), home);
  postWatch = watchPostMark(envelope, () => hooks.post?.() ?? null);
  if (postFocusBack && !postOpen) { postFocusBack = false; globalThis.requestAnimationFrame?.(() => envelope.focus?.()); }
  return envelope;
}
/** SEASON-BOOK: the season window over the pause face, its live view and the laurel's placing - the hourglass's way. */
let seasonOpen = false;
let seasonView = null;
let seasonAnchor = null;
let seasonFocusBack = false;   // a closed window hands the focus back to the laurel
let seasonFocusIn = false;     // AUDIT SEASON-BOOK U3: the window just opened - the focus goes into it, once
const stopSeason = () => { seasonView?.stop(); seasonView = null; seasonAnchor?.(); seasonAnchor = null; };
const closeSeason = () => { seasonOpen = false; seasonFocusBack = true; render(); };
/** A season row's door - the hourglass's handoff (timersDoor), the season window shut first where a Growth face under it
 *  asks (AUDIT GROWTH LANE2-3's law: the ask seen, never a press that does nothing). */
const seasonDoor = (fn) => { if (pauseTab === 'growth' && growthAsks()) { closeSeason(); return; } timersDoor(fn); };
/** SEASON-BOOK (the owner: "a new pause menu icon, like we did for the timers and mail. A condensed place to see season
 *  related content and descriptions"): THE LAUREL on the pause face - online, where the hourglass stands (its clock is
 *  the hourglass's), at the end of the row of marks `chain`. Answers the laurel, or null with no clock. */
function seasonLaurel(home, chain) {
  if (!hooks.timers?.()) return null;
  const laurel = seasonMark(document, { open: seasonOpen, onOpen: () => { seasonOpen = true; seasonFocusIn = true; render(); } });
  home.append(laurel);
  seasonAnchor = anchorSeason(laurel, chain, home.querySelector?.('.px-profile'), home);
  if (seasonFocusBack && !seasonOpen) { seasonFocusBack = false; globalThis.requestAnimationFrame?.(() => laurel.focus?.()); }
  return laurel;
}
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
let questReveal = false;   // AUDIT QUESTLINES UI-14: a row was just pressed - its page is brought into view on a phone
let questShelfSaid = null;      // QUEST-SHELF: the last Abandon / Reclaim's words, said under the quest until the next press
let statsSec = 'character'; // PX6: the Stats page's rail - character | attributes | skills | standing
let famSec = 'tree';       // LEGACY3: the Family page's rail - tree | house | hall | guide
let holdSec = 'stable';     // HOLDINGS: the Holdings page's rail - stable | fleet | companions | revenants | stores | collections
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
 *  test/systems/quest/time4_words.test.js holds the numbers to the law. */
export function skyDayWords(nowMs = Date.now(), localTime = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
  localMinute = (ms) => { const d = new Date(ms); return d.getMinutes() + d.getSeconds() / 60; }) {
  const turn = SKY_SEGMENTS[SKY_SEGMENTS.length - 1].fromMs;
  const midnight = wallMsForSkyMinutes(Math.ceil(skyClassicMinutes(turn) / 1440) * 1440);
  const m0 = ((localMinute(midnight) % 60) + 60) % 60;
  const at = (m) => { const v = ((m % 60) + 60) % 60; return `:${String(Math.floor(v)).padStart(2, '0')}${v % 1 ? ':30' : ''}`; };
  // L10N4: one sentence, one pattern - the midnight's two shapes are a select inside it, never a glued fragment
  const day = { onHour: m0 === 0 ? 'yes' : 'no', midnight: at(m0), dusk: at(m0 + 45) };
  return nowMs >= turn
    ? t('menu.online.skyDay', 'A day in the world is an hour of real time: {onHour, select, yes {midnight falls on the hour} other {midnight falls at {midnight}}}, and dusk at {dusk}.', day)
    : t('menu.online.skyDayUntil', 'A day in the world is two hours of real time until {turn}; from then on it is an hour: {onHour, select, yes {midnight falls on the hour} other {midnight falls at {midnight}}}, and dusk at {dusk}.', { ...day, turn: localTime(turn) });
}

export function takePickedSaveKey() { const k = _pickedSaveKey; _pickedSaveKey = null; return k; }
/** REALM P1.3: the realm character the Online door's Play pressed - its id rides the boot (main.js ?realm). */
let _pickedRealmId = null;
export function takePickedRealmId() { const id = _pickedRealmId; _pickedRealmId = null; return id; }
/** HOUSE-WAITS (FIELD BUGS 2026-10-09f): the member the Online page's waiting house was answered with - `{ personId,
 *  region, loc }` - taken once by the boot (main.js), which births them online through the world host's own door. */
let _pickedLegacyBirth = null;
export function takePickedLegacyBirth() { const b = _pickedLegacyBirth; _pickedLegacyBirth = null; return b; }
/** REALM P1.3: the realm's characters as the service listed them this visit (null: not asked yet), its bound, what the
 *  last act said (a refusal, customs' report, a copy's word) and whether an act is running. Per VISIT, as the cloud's. */
let realmRows = null;
let realmAsked = false;
let realmMax = 0;
let realmWords = [];
let realmBusy = false;
/** HOUSE-WAITS: the account's lines as this visit read them (their ids, once pulled into the device's store), or null. */
let realmLineIds = null;
let realmLinesAsked = false;
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
    name: snap.name || t('menu.save.unnamed', 'Unnamed'),
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

/** SLOTS1: every restorable slot, most recent first (systems/save/saveSlots.js restorableSaves). */
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
        if (restore && newerBackup(card, save.dateAndTime)) line.actions.push({ label: t('menu.cloud.tryAgain', 'Try again'), onClick: () => restoreBackup(save, card) });
      } else if (act === 'delete') line.actions.push({ label: t('menu.cloud.tryAgain', 'Try again'), onClick: () => removeBackup(save) });
      else if (newerBackup(card, save.dateAndTime)) line.actions.push(guardedPush(save, t('menu.cloud.tryAgain', 'Try again')));
      else line.actions.push({ label: t('menu.cloud.tryAgain', 'Try again'), onClick: () => backUp(save) });
      break;
    }
    case 'saved':
      line.actions.push({ label: t('menu.cloud.backUpAgain', 'Back up again'), onClick: () => backUp(save) });
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
        ? { label: t('menu.cloud.deleteBackupAsk', 'Delete backup?'), primary: true, onClick: () => removeBackup(save) }
        : { label: t('menu.cloud.deleteBackup', 'Delete backup'), onClick: () => { cloudArm = slot; render(); } });
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
          ? { label: t('menu.cloud.replaceWithBackup', 'Replace with backup?'), primary: true, onClick: () => restoreBackup(save, card) }
          : { label: t('menu.cloud.restoreBackup', 'Restore backup'), primary: true, onClick: () => { cloudArm = `restore|${save.key}`; render(); } });
      }
      line.actions.push(guardedPush(save, t('menu.cloud.backUpAgain', 'Back up again')));
      break;
    default:   // 'none'
      line.actions.push({ label: t('menu.cloud.backUp', 'Back up'), onClick: () => backUp(save) });
  }
  return line;
}

/** FIELD 2026-09-27: the upload over a NEWER backup, asked twice - it is the one press that loses the newer game.
 *  Armed by this LOCAL copy's key (the pre-merge audit 0927b B5): two local copies of one slot are two presses. */
function guardedPush(save, label) {
  return cloudArm === `push|${save.key}`
    ? { label: t('menu.cloud.replaceNewer', 'Replace newer backup?'), onClick: () => { cloudArm = null; backUp(save); } }
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
      ? { label: t('menu.cloud.deleteBackupAsk', 'Delete backup?'), primary: true, onClick: () => removeBackup(card) }
      : { label: t('menu.cloud.deleteBackup', 'Delete backup'), onClick: () => { cloudArm = slot; render(); } });
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
  box.append(el('h4', null, t('menu.cloud.onlyInBackup', '{n, plural, =1 {One save is only in your backup} other {# saves are only in your backup}}', { n: cards.length })));
  // THE ONE LINE OF PROSE THIS GRID GETS, because without it the
  // heading is a statement and not an instruction: a player looking at
  // a character they cannot press Load on needs to be told what the
  // button does before they press it.
  box.append(el('p', 'meta', t('menu.cloud.downloadHint', 'Download one to bring it back to this device.')));
  const grid = el('div', 'svgrid');
  for (const card of cards) {
    grid.append(saveTile(document, saveFromCard(card, dateFromClassicMinutes, dateString), {
      cloud: cloudForCard(card),
      // NO FACE, AND NOT A BUG. Nothing about a portrait was ever
      // uploaded (server-account/src/saves.js keeps eleven columns and
      // none of them is a look), so the well draws the character's
      // initial - TILE1's own no-face arm, reached honestly.
      actions: [{
        label: t('menu.cloud.download', 'Download'),
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
    name: snap.name || t('menu.save.unnamed', 'Unnamed'),
    career: snap.career?.name ?? null,
    level: snap.level ?? null,
    health: snap.health, maxHealth: snap.maxHealth,
    // AUDIT 58: THE PURSE IS A COUNTER, NOT AN ITEM. E4 moved gold onto
    // GoldPieces (`data.playerEntity.goldPieces = entity.GoldPieces`,
    // SerializablePlayer.cs:133 - systems/save/save.js's snapshotPlayer
    // writes snap.goldPieces beside the collections), and restorePlayer
    // SPLICES every Currency row out of a pre-E4 envelope's item list.
    // Scanning snap.items for a gold-named row therefore never
    // matched on any post-E4 save, save.gold was always null, and
    // stats() drops a null outright - so the Continue and Save cards
    // silently lost their whole Gold row. Every other reader in the
    // tree asks the counter (ui/enhanced/enhancedInventory.js's goldPiecesOf).
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
const saveLine = (save) => [save.career, save.level ? t('menu.save.level', 'level {level}', { level: save.level }) : null,
  save.when, save.hour].filter(Boolean).join(' · ');

const saveStats = (save) => [
  [localizedText('health', 'Health'), save.maxHealth ? `${save.health} / ${save.maxHealth}` : save.health],
  [t('menu.save.gold', 'Gold'), save.gold != null ? save.gold.toLocaleString() : null],
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
function empty(title, line = null) {
  const e = el('div', 'empty');
  e.append(el('h3', null, title));
  if (line) e.append(el('p', null, line));
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
    { label: localizedText('cancel', 'Cancel'), onClick: () => { confirming = null; render(); } },
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
    body.append(empty(t('menu.continue.none', 'No game in progress'), t('menu.continue.noneHint', 'Quicksave with F9 and it appears here.')));
    body.append(acts([{ label: t('menu.continue.startNew', 'Start a new game'), primary: true, onClick: () => go('new') }]));
    return;
  }
  const c = el('div', 'card');
  c.append(el('h3', null, save.name));
  c.append(el('p', 'meta', saveLine(save)));
  c.append(stats(saveStats(save)));
  c.append(acts([{ label: t('menu.continue.play', 'Continue'), primary: true, onClick: () => onAction('continue') }]));
  body.append(c);
}

// ── NEW GAME ─────────────────────────────────────────────────────
// The three Startup keys are REAL and live here rather than buried in
// settings, because they are questions about the game you are about to
// start and nowhere else. StartInDungeon in particular is the answer
// to "do I begin in Privateer's Hold" - a new-game question wearing a
// settings key's clothes (systems/settings/settings.js:"BG1: ShopQualityPresentation.").
function paneNew(body) {
  const c = el('div', 'card');
  c.append(el('h3', null, t('menu.new.title', 'A new character')));
  c.append(el('p', 'meta', t('menu.new.blurb', 'Race, class, biography, face, skills.')));
  c.append(acts([{ label: t('menu.act.begin', 'Begin'), primary: true, onClick: () => onAction('new') }]));
  body.append(c);

  const opts = el('div', 'card');
  opts.append(el('h3', null, t('menu.new.wake', 'Where you wake up')));
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
  c.append(el('h3', null, t('menu.begin.title', 'Classic')));
  c.append(el('p', 'meta', t('menu.begin.blurb', 'The classic start: the original game\u2019s own title, intro and menu (Load Game, Start New Game, Exit).')));
  c.append(acts([{ label: t('menu.act.begin', 'Begin'), primary: true, onClick: () => onAction('begin') }]));
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
  intro.append(el('h3', null, t('menu.test.title', 'The test room')));
  intro.append(el('p', 'meta', t('menu.test.blurb',
    'A ready-made character in the normal world, with one of every weapon, armor in every '
    + 'material, all four shields and spare clothes in the pack. Equip things from the inventory '
    + 'to see them on the paperdoll and in your hands, and on the Morrowind body if you have its '
    + 'data. Scroll to switch views. Nothing here touches your real saves.')));
  body.append(intro);
  for (const p of TEST_PRESETS) {
    const c = el('div', 'card');
    c.append(el('h3', null, p.label));
    c.append(el('p', 'meta', p.blurb));
    c.append(acts([{ label: t('menu.test.enterAs', 'Enter as the {preset}', { preset: p.label }), primary: true, onClick: () => onAction(`test:${p.id}`) }]));
    body.append(c);
  }
  // TSR4: the ride - one more door through the SAME `test:<id>` choice,
  // the entry resolved by testRoom's testEntryById at the boot.
  const ride = el('div', 'card');
  ride.append(el('h3', null, TEST_RIDE.label));
  ride.append(el('p', 'meta', TEST_RIDE.blurb));
  ride.append(acts([{ label: t('menu.test.rideOut', 'Ride out'), primary: true, onClick: () => onAction(`test:${TEST_RIDE.id}`) }]));
  body.append(ride);
  // FIELD BUGS 2026-09-29 (the sea) #5 (Mac: "Add a ship combat test menu option"): the sea battle - the same
  // `test:<id>` door, a helm on the open Bay and a pirate standing in (systems/testRoom.js TEST_SEA)
  const sea = el('div', 'card');
  sea.append(el('h3', null, TEST_SEA.label));
  sea.append(el('p', 'meta', TEST_SEA.blurb));
  sea.append(acts([{ label: t('menu.test.setSail', 'Set sail'), primary: true, onClick: () => onAction(`test:${TEST_SEA.id}`) }]));
  body.append(sea);
  // LR3: the loot ladder - one of everything Loot rarity can mint, in
  // the pack, through the same `test:<id>` door.
  const loot = el('div', 'card');
  loot.append(el('h3', null, TEST_LOOT.label));
  loot.append(el('p', 'meta', TEST_LOOT.blurb));
  loot.append(acts([{ label: t('menu.test.enterLadder', 'Enter with the ladder'), primary: true, onClick: () => onAction(`test:${TEST_LOOT.id}`) }]));
  body.append(loot);
  // FT12 (Mac, 2026-09-14: "move the test the outdoors to the test room
  // tab"): the outdoors test door lives with the other test doors. It
  // was the last row of the Enhanced category of Settings, which is off
  // the rail now - every switch it held is the Features home's.
  const outdoors = el('div', 'card');
  outdoors.append(el('h3', null, t('menu.test.outdoors', 'The outdoors')));
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
//
// AUDIT RECOVERY-SET B1: THE FLOW IS THE WINDOW'S, NOT THE RENDER'S. A
// flow built anew on every render dropped whatever it held on the next
// one - and a boot resize, a skin switch or an Escape is a render. With
// recovery codes that is an account lost: "Make new codes" has already
// killed the old set when the new one is drawn, and a redraw (or a
// Close, an Escape, a tap outside) put it away unseen. So the flow lives
// while the window does (`acctFlow`, dropped by `closeAccount` and at
// each visit's mount), and the window will not close while it shows
// codes or while a press is out whose answer may be codes - "I have
// written it down" is the one way off the `code` stage.
let acctFlow = null;
let acctPaint = null;
let acctOff = null;   // MEM-AUDIT: the drawn card's focus listener, let go with the card (enhancedAccount.js accountCard `off`)
const accountMayClose = () => !acctFlow || (acctFlow.stage !== 'code' && !acctFlow.busy);
function closeAccount() {
  if (!accountMayClose()) return;
  accountOpen = false;
  acctFlow = null;
  acctOff?.(); acctOff = null;
  acctPaint = null;
  rereadCollectionsAccount();   // AUDIT COLLECTIONS-II (lane 2): what the card did, the Collections page reads again
  render();
}
/** COLLECTIONS-II: THE ONE CONSTRUCTION of an account flow (Home.md, THE ONE CONSTRUCTION SEAM) - the account card's,
 *  and the Collections page's that reads the wardrobe and wears from it (ui/collections/wardrobePart.js). */
const newAccountFlow = (onChange) => AccountFlow({ io: { fetch: (...a) => globalThis.fetch(...a), base: serviceBase(appStorage()) }, storage: appStorage(), onChange });
function accountBody() {
  const host = el('div', 'acctmount');
  const fresh = !acctFlow;
  if (fresh) acctFlow = newAccountFlow(() => acctPaint?.());
  // PROFILE-MENU: the card's plate wears the corner mark's portrait and says whose face it is - the same character
  // the mark shows (profileCharacter), its face asked for as a COPY (the mark and a save tile may draw this very face)
  const save = profileCharacter();
  const card = accountCard(document, acctFlow, {
    onClose: closeAccount,
    face: save ? loadFace(save, { scale: 2, copy: true }) : null,
    character: save ? `Playing ${characterLine(save)}` : null,
  });
  acctPaint = card.paint;
  acctOff?.(); acctOff = card.off ?? null;
  host.append(card.root);
  // Not awaited: the door must be on screen before the service is
  // asked anything, and `start` catches its own refusals. The guard is
  // the belt for a bug in it - a throw here would take the door with it.
  // AUDIT RECOVERY-SET B1: asked once per window, not once per render.
  if (fresh) Promise.resolve(acctFlow.start()).catch(() => {});
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
/** PROFILE2: the character the profile shows - paused, the one being PLAYED (the newest save may be another's); at the
 *  door, the newest finished save. PROFILE-MENU: one answer for the mark and the card it opens. */
function profileCharacter() {
  return mode === 'pause' ? liveCharacter(playerEntity) : newestPortraitSave();
}

/** WITCH1: THE PORTRAIT the corner mark and the card wear - the profile icon worn (ui/profileIcons.js, the stored session's
 *  word), else the character's face asked for as a COPY (the Continue pane's tile may draw this very face). */
function portraitOf(save) {
  const icon = ownIcon(appStorage());
  if (icon) return Promise.resolve(profileIconNode(document, icon));
  return save ? loadFace(save, { scale: 2, copy: true }) : null;
}

function profileMark() {
  const who = storedSession(appStorage());
  const save = profileCharacter();
  return profileBadge(document, {
    session: who,
    save,
    face: portraitOf(save),   // WITCH1: the icon worn, else the face
    onOpen: () => { accountOpen = true; render(); },
  });
}

/** SUPPORT1 (Mac, 2026-10-05: "add the patron/kofi ingame on the main menu as 2 icons"): THE ASKS, top-left of the
 *  door - the one corner it had free. An icon a platform, its mark drawn by ui/supportAsks.js exactly as the website's
 *  corner draws it, its name on the pointer's tooltip and in what a screen reader says. Each is a LINK out of the game,
 *  never a press the door acts on: a new tab on the web, the system browser from the desktop app (app/main.cjs hands
 *  http(s) there), as the credits' links and TERMS1's documents open. */
function supportMarks() {
  const nav = el('nav', 'px-support');
  nav.setAttribute('aria-label', 'Support');
  for (const ask of SUPPORT_ASKS) {
    const a = el('a', `px-supportlink px-support-${ask.id}`);
    a.href = ask.url; a.target = '_blank'; a.rel = 'noopener';
    a.title = ask.label;
    a.setAttribute('aria-label', ask.label);
    const mark = el('i', `supmark supmark-${ask.id}`);
    mark.setAttribute('aria-hidden', 'true');
    a.append(mark);
    nav.append(a);
  }
  return nav;
}

/** The window itself, wearing the pause window's own frame. */
function accountWindow() {
  const win = el('div', 'px-win px-acctwin');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
  const body = el('div', 'px-body');
  body.append(accountBody());
  body.append(skinCard(document, { gender: () => playerEntity?.gender }).root);   // DISC23-B2 (Mac: "a choosable skin system in the menu player profile system itself"): who you are drawn as, beside who you are; LAYERED-GEAR: the character's own body, the one Layered Gearing first wears
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
  //       belongs; `ui/settings/settingsMap.js` has no free-text row kind yet,
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
    c.append(el('p', 'meta bad', t('menu.online.needsAccount', 'Online needs an account, so no one else can use your name. Playing as a guest takes one click and no email.')));
    const go = el('button', 'act primary');
    go.type = 'button';
    go.textContent = t('menu.online.signIn', 'Sign in or continue as guest');
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
    body.append(empty(t('menu.saves.none', 'No saved games'), t('menu.online.noSaves', 'Each offline character can be brought online from here, once.')));
    body.append(onlineSyncCard());   // UXB1-E: the rules can come home before a character goes out
    return;
  }
  // REALM P1.5 (decision 3, "Migrate once via customs"): AN OFFLINE CHARACTER COMES IN ONCE. TILE2's tiles, with the
  // character's own face on them - and the press is customs, not a boot: the realm settles its loans and caps what it
  // carries (systems/realmCustoms.js) on a copy, the service makes the realm character, and it appears above to play.
  // The offline character stays exactly what it was.
  body.append(el('h4', null, t('menu.online.bringHeading', 'Bring an offline character in (once)')));
  body.append(tileGrid(saves, (save) => ({
    current: false,
    actions: [{
      // AUDIT SET D4: a Test Room character's button says why it is dead (the boot refuses it whatever door it comes by)
      label: save.testRoom ? t('menu.online.testRoomOffline', 'Test Room: offline only') : t('menu.online.bring', 'Bring online'),
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
  // L10N4: ONE pattern, the sky's sentence an argument in it (skyDayWords is itself routed)
  foot.append(el('p', 'meta', t('menu.online.rules', 'Everyone plays their own save, and you can see and talk to each other anywhere. Dungeons and buildings are shared: enemies, doors, levers and opened chests are the same for everyone and stay that way. In towns and the wilds, everyone nearby sees the same monsters and can fight them, and they can hurt you too. {skyDay} The world\u2019s clock and sky run on real time. Resting, travel, jail and training don\u2019t move them, so a quest waiting for a time of day waits for the world\u2019s, and a lycanthrope\u2019s full moon lasts one night. Your character also has their own clock. It runs while you play and stops while you are logged off. Resting, travel, jail and training use it. Your wounds, spells, hunger, diseases, curses, guild ranks, rented rooms, loans and repairs run on it. Quest timers run on the world\u2019s clock while you play. Resting, waiting and traveling don\u2019t use up a quest\u2019s days, and time logged off never counts. A quest that only asks you to wait, like a letter or \u201ccome back in a few days\u201d, moves on after a couple of minutes of play. Rest at a fire, a tent or a bed: a night passes at once, at most once every 10 minutes of play, and party members within 15 meters sleep with you. Every enhancement is on for everyone, but your interface is your own. Most mods stay your choice online. A few are set for everyone: those that change the ground, monsters, loot or the rules. The Mods page marks each one.', { skyDay: skyDayWords() })));   // AUDIT WORLD5 C12: the shared clock, said at the door; OL1: the lane, said at the door; QCLOCK-WORLD: the quests' clock; REST8: the short wait; REST9: the rest act and the party's night
  foot.append(field(t('menu.online.relay', 'Relay'), 'onlineServer', DEFAULT_SERVER, 200));
  body.append(foot);
  body.append(onlineSyncCard());   // UXB1-E: under the rules it copies
}

/** REALM P1.3: THE REALM CARD - the account's online characters as tiles (the service's list, asked once a visit), each
 *  played, copied to offline or deleted from here; a new one born online; and what the last act said. */
function realmCard(who) {
  const box = el('div', 'svrealm');
  box.append(el('h4', null, t('menu.realm.heading', 'Your online characters')));
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
  if (realmRows == null) { box.append(el('p', 'meta', t('menu.realm.asking', 'Asking the realm...'))); return box; }
  if (realmRows.length) {
    const grid = el('div', 'svgrid');
    for (const row of realmRows) {
      const save = realmRowAsSave(row, { dateText: (sec) => new Date(sec * 1000).toLocaleDateString() });
      grid.append(saveTile(document, save, {
        face: loadFace(save, { scale: 2, copy: true }),
        actions: [
          { label: save.unfinished ? t('menu.realm.neverSaved', 'Never saved') : t('menu.realm.play', 'Play'), primary: true, disabled: realmBusy || save.unfinished, onClick: () => { _pickedRealmId = row.id; onAction('online'); } },
          { label: t('menu.realm.copyOffline', 'Copy to offline'), disabled: realmBusy || save.unfinished, onClick: () => copyToOffline(row) },
          // HOUSE-LOSS (2026-09-29, Mac: "GarySoup lost his house and furniture"): a character brought in whose first save
          // never landed is UNDONE, never deleted - its delete took the home customs had carried, and it could never come
          // in again. The undo gives back its home, its guild place and its customs (realm.js undoRealm).
          row.customs && save.unfinished ? { label: t('menu.realm.undo', 'Undo bringing in'), disabled: realmBusy, onClick: () => ask(t('menu.realm.undoAsk', 'Undo bringing {name} in?', { name: row.name }), t('menu.realm.undoBody', '{name} didn\u2019t finish coming online because its first save never arrived. Undo removes it and gives back its home and guild place, so you can bring the offline character online again. To finish instead, click Bring online on it below.', { name: row.name }), t('menu.realm.undoYes', 'Undo'), () => realmAct(() => realmUndo(realmIoNow(), row.id), () => [t('menu.realm.undone', '{name} is no longer online. Its home and guild place are back with the offline character. Bring it online again when you are ready.', { name: row.name })])) }
            : { label: t('menu.realm.delete', 'Delete character'), disabled: realmBusy, onClick: () => ask(t('menu.realm.deleteAsk', 'Delete {name}?', { name: row.name }), t('menu.realm.deleteBody', 'Deleting an online character is permanent. Its Renown, professions, Stores, the homes it bought and its guild place are lost. Homes belong to your account, so your other characters lose them too. Any offline copy you made stays.'), t('menu.realm.deleteYes', 'Delete'), () => realmAct(() => realmDelete(realmIoNow(), row.id), () => [t('menu.realm.deleted', '{name} is gone from the realm.', { name: row.name })])) },
        ],
      }));
    }
    box.append(grid);
  } else box.append(el('p', 'meta', t('menu.realm.none', 'No online characters yet. Make one, or bring one of yours in below.')));
  for (const card of waitingHouseCards()) box.append(card);
  box.append(acts([{ label: t('menu.realm.new', 'New online character'), primary: !realmRows.length, disabled: realmBusy || realmRows.length >= realmMax, onClick: () => onAction('online-new') }]));
  return box;
}
/** HOUSE-WAITS (FIELD BUGS 2026-10-09f, Sahh: a Bloodline's fall whose heir's birth went back to the title - "despite the
 *  bloodline still having two characters left in it, I cannot access those characters in any way"): the account's lines
 *  whose Succession waits, each with the members who may carry it on (systems/legacy/waitingHouses.js). The fallen is the
 *  realm's tombstone and a member never played has no character, so this card is the line's one door from the menu. */
let realmLine = null;
function waitingHouseCards() {
  if (!realmRows) return [];
  if (!realmLinesAsked) {
    realmLinesAsked = true;
    realmLine = createRealmLine({ io: () => realmIoNow(), storage: () => appStorage() });
    realmLine.pull().then((r) => { realmLineIds = r?.ok ? r.ids : []; render(); }).catch(() => { realmLineIds = []; });
  }
  if (!realmLineIds?.length) return [];
  const living = new Set(realmRows.map((r) => String(r.id)));
  const families = realmLineIds.map((id) => loadFamily(appStorage(), id)).filter(Boolean);
  return waitingHouses(families, { played: (cid) => living.has(cid) }).map(({ family, fallen, heirs }) => {
    const card = el('div', 'card svhousewaits');
    card.append(el('h4', null, houseWaitsTitle(family)), el('p', 'meta', houseWaitsLine(family, fallen)));
    card.append(acts(heirs.map((p) => ({
      label: heirButtonLabel(p),
      disabled: realmBusy || realmRows.length >= realmMax,
      onClick: () => carryOn(family.id, p.id),
    }))));
    return card;
  });
}
/** HOUSE-WAITS: the Succession's choice, made here - the record stored and the realm's copy written (its birth checks
 *  the person there), then the boot births them online. */
function carryOn(familyId, personId) {
  realmBusy = true; render();
  const took = takeUpLine({ storage: appStorage(), tab: tabStorage(), familyId, personId });
  if (!took.ok) { realmWords = [took.why]; realmBusy = false; render(); return; }
  Promise.resolve(realmLine?.push(took.family)).then(() => realmLine?.flush()).then((ok) => {
    if (!ok) { realmWords = [realmRefusalText(realmLine?.refusalOf(familyId) ?? realmLine?.error ?? 'server')]; realmBusy = false; render(); return; }
    _pickedLegacyBirth = { personId, region: took.place.region, loc: took.place.loc };
    realmBusy = false;
    onAction('online-new');
  }).catch(() => { realmWords = [realmRefusalText('server')]; realmBusy = false; render(); });
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
  const leveling = crossLeveling(trial);   // LEVEL-ONLINE-2: an Oblivion-levelling character comes in on Daggerfall's leveling - said first
  const preview = [...(leveling ? [LEVELING_CROSS_LINE.before] : []), ...customsLines(applyCustoms(trial), { before: true })];
  return ask(t('menu.online.bringAsk', 'Bring {name} online?', { name: save.name }), preview.join(' '), t('menu.online.bring', 'Bring online'), () => { customsNow(save); });
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
    const leveling = crossLeveling(copy);   // LEVEL-ONLINE-2: a new online character levels the Daggerfall way (the offline one keeps its own)
    const report = applyCustoms(copy);
    const made = await realmCustoms(io, snap.characterId, copy.name || save.name, realmSummaryOf(copy));
    if (!made.ok) return made;
    copy.characterId = made.data.id;
    const put = await realmPut(io, made.data.id, { lease: made.data.lease, seq: 1, summary: realmSummaryOf(copy) }, JSON.stringify(copy), { gzip: made.data.gzip === true });   // REALM-GZIP: a long offline life comes in packed
    return put.ok ? { ok: true, lines: [...(leveling ? [LEVELING_CROSS_LINE.after] : []), ...customsLines(report)] } : put;
  }, (r) => [...r.lines, t('menu.realm.broughtIn', '{name} is online now. Play them from the list above.', { name: save.name })]);
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
  }, () => [t('menu.realm.copied', '{name} is copied as a new offline character. Nothing you play on the copy comes back online.', { name: row.name })]);
}

// UXB1-E (2026-09-25, the UX backlog: "Add a 'sync from server' option so players can ensure their offline play
// matches the host they prefer to play on if they want."): THE ROOM'S RULES, OFFLINE. The copy and its undo are
// systems/online/onlineSync.js's; this is the card - what differs, the one press, and the way back. Every relay plays by
// the same rules (they are this build's, not the server's), so there is no host to pick: the card says so.
export const ONLINE_SYNC_TITLE = 'Sync from server';
export const ONLINE_SYNC_NOTE = 'Play offline by the same rules as online. This sets the settings that are fixed online to match. Everything else stays your choice.';
export const ONLINE_SYNC_SAME = 'Your offline game already plays by the online rules.';
/** L10N4: the card's words in the player's language - the English constants above stay what the tests compare. */
export const onlineSyncTitle = () => t('menu.sync.title', ONLINE_SYNC_TITLE);
export const onlineSyncNote = () => t('menu.sync.note', ONLINE_SYNC_NOTE);
export const onlineSyncSame = () => t('menu.sync.same', ONLINE_SYNC_SAME);
const syncWord = (v) => (v === true || /^true$/i.test(String(v)) ? t('menu.toggle.on', 'On') : v === false || /^false$/i.test(String(v)) ? t('menu.toggle.off', 'Off') : String(v));
export function onlineSyncCard() {
  const card = el('div', 'card svsync');
  card.append(el('h3', null, onlineSyncTitle()));
  card.append(el('p', 'meta', onlineSyncNote()));
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
    const go = el('button', 'act primary svsync-go', t('menu.sync.go', '{n, plural, one {Sync # setting} other {Sync # settings}}', { n: differ.length }));
    go.type = 'button';
    go.onclick = () => { applyOnlineSync(plan); render(); };
    acts.append(go);
  } else {
    card.append(el('p', 'meta svsync-same', onlineSyncSame()));
  }
  const last = lastOnlineSync();
  if (last?.rows?.length) {
    const undo = el('button', 'act svsync-undo', t('menu.sync.undo', 'Undo sync'));
    undo.type = 'button';
    undo.title = t('menu.sync.undoTip', '{n, plural, one {Puts back the # setting the last sync changed} other {Puts back the # settings the last sync changed}}', { n: last.rows.length });
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
    body.append(empty(t('menu.load.onlineLocked', 'Loading is disabled during online play.'),
      t('menu.load.onlineLockedWhy', 'Leave the shared world to load a save.')));
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
      // own pause window loads on one press (pauseWindow.js:"exterior host, whose".."this._closeWith();")
      // and so does F11, and inventing a prompt on exactly one of the
      // port's three load doors is a divergence, not a safety net.
      { label: localizedText('loadButton', 'Load'), primary: true, disabled: !canLoad, onClick: () => { _pickedSaveKey = save.key; onAction('load'); } },   // L10N3d: the save window's own buttons (DaggerfallUnitySaveGameWindow.cs:445, :256)
      // ...and the destructive one still asks, and takes THIS slot
      // alone.
      { label: localizedText('deleteSave', 'Delete'), onClick: () => ask(
        t('menu.load.deleteTitle', 'Delete this save'),
        t('menu.load.deleteBody', 'Deleting {name}\'s "{slot}" cannot be undone.', { name: save.name, slot: save.saveName }),
        localizedText('deleteSave', 'Delete'),
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
  if (!saves.length && !onlyCloud) body.append(empty(t('menu.saves.none', 'No saved games'), t('menu.load.noneHint', 'Your saved games appear here.')));
  if (mode === 'pause' && typeof hooks.quickLoad !== 'function') {
    body.append(empty(t('menu.load.notHere', 'Not from here'),
      t('menu.load.notHereWhy', 'You can\u2019t load a game from here. Use the main menu instead.')));
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
// overwrites a slot the store already holds (systems/save/saveTransfer.js).
let _transferNote = null;
function transferCard(count) {
  const c = el('div', 'card');
  c.append(el('span', 'tag grey', t('menu.transfer.tag', 'Move saves')));
  c.append(el('h3', null, t('menu.transfer.title', 'Between the website and the app')));
  const shell = globalThis.daggerShell;
  c.append(el('p', 'meta', shell?.savesPath
    ? t('menu.transfer.app', 'This app keeps your saves as files in {path}. Export them as one zip to carry to the website, or import a zip the website exported.', { path: shell.savesPath })
    : t('menu.transfer.web', 'The website keeps your saves in this browser. Export them as one zip to carry to the desktop app or another browser, or import a zip the app or another browser exported.')));
  if (_transferNote) { c.append(el('p', 'meta', _transferNote)); _transferNote = null; }
  const zipIn = el('input'); zipIn.type = 'file'; zipIn.accept = '.zip,application/zip'; zipIn.style.display = 'none';
  const dirIn = el('input'); dirIn.type = 'file'; dirIn.setAttribute('webkitdirectory', ''); dirIn.multiple = true; dirIn.style.display = 'none';
  const done = (slots, r) => {
    const n = r.imported.length;
    _transferNote = !slots.length ? t('menu.transfer.noneIn', 'No saves in that selection. Pick the zip an Export made, or a Saves folder holding SAVE0, SAVE1, ...')
      : t('menu.transfer.imported', 'Imported {n, plural, one {# save} other {# saves}}{skipped, plural, =0 {} other {, # already here}}{failed, plural, =0 {} other {, # could not be written}}.', { n, skipped: r.skipped || 0, failed: r.failed || 0 });
    render();
  };
  zipIn.onchange = async () => {
    const f = zipIn.files?.[0]; if (!f) return;
    try {
      const { readZipEntries } = await import('../../scenes/dataSource.js');   // the port's own reader, methods 0 and 8
      const slots = collectSlots(await readZipEntries(f, { pick: (names) => names.filter((n) => slotPathOf(n)) }));
      done(slots, importSlots(slots, appStorage()));
    } catch (err) { _transferNote = t('menu.transfer.readFailed', 'Could not read {file}: {error}', { file: f.name, error: err?.message ?? err }); render(); }
  };
  dirIn.onchange = async () => {
    const slots = collectSlots(await entriesFromFiles([...(dirIn.files ?? [])]));
    done(slots, importSlots(slots, appStorage()));
  };
  c.append(zipIn, dirIn);
  c.append(acts([
    { label: t('menu.transfer.export', 'Export all saves'), primary: true, disabled: !count, onClick: () => {
      const zip = exportSavesZip(appStorage());
      if (!zip) { _transferNote = t('menu.transfer.nothing', 'Nothing to export.'); render(); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      a.download = TRANSFER_ZIP_NAME;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } },
    { label: t('menu.transfer.importZip', 'Import a zip'), onClick: () => zipIn.click() },
    { label: t('menu.transfer.importFolder', 'Import a Saves folder'), onClick: () => dirIn.click() },
  ]));
  return c;
}

// ── SAVE GAME (pause only) ───────────────────────────────────────
// U51. Classic's SAVE button closes the window and then writes
// (pauseWindow.js:"window, so it relocks".."this._closeWith();", `this._closeWith(); ... this.hooks.quickSave?.()`),
// and this does the same for a reason that is not only parity: the
// port answers a write with a HUD LINE, and this screen is a fixed
// opaque div over the whole canvas, so a save that left the door open
// would put its own confirmation underneath itself.
//
// THE CARD SHOWS WHAT IS ABOUT TO BE OVERWRITTEN. There is ONE slot
// (systems/save/save.js, `dagger.quicksave`), so every save is an
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
    body.append(empty(localizedText('cannotSaveNow', 'You cannot save now.'),
      t('menu.save.notHereWhy', 'You can\u2019t save here. Step back outside to save again.')));
    return;
  }
  // SLOTS1 (Mac: "multiple save slots"): a save is (character, slot
  // name) - SaveLoadManager's own identity (systems/save/saveSlots.js
  // saveSlot). The name field says which slot; a name the character
  // already has OVERWRITES it and the card says so, a new name is a
  // new slot. The pressed name rides the pause door's quickSave
  // through takePickedSaveName, onto the host's saveAs seam.
  const me = hooks.playerName?.() ?? savedGame()?.name ?? '';
  const myId = hooks.playerId?.() ?? null;   // CHARID1: the slots the press can overwrite are THIS character's, by id - a namesake's are not
  const mine = savedGames().filter((s) => (myId ? s.characterId === myId : s.characterName === me));
  const c = el('div', 'card');
  c.append(el('span', 'tag', t('menu.save.tag', 'Save as')));
  c.append(el('h3', null, me || t('menu.save.yourCharacter', 'Your character')));
  const wrap = el('label', 'field');
  wrap.append(el('span', 'fieldlabel', t('menu.save.slotName', 'Slot name')));
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
    line.textContent = save ? t('menu.save.overwrites', 'Overwrites "{slot}" - {line}', { slot: save.saveName, line: saveLine(save) }) : t('menu.save.newSlot', 'A new slot, "{slot}".', { slot: name });
    numbers.replaceChildren(); if (save) numbers.append(stats(saveStats(save)));
  };
  input.oninput = () => { _saveNameDraft = input.value; describe(); };
  describe();
  c.append(line, numbers);
  c.append(acts([{ label: localizedText('saveButton', 'Save'), primary: true, onClick: () => { _pickedSaveName = input.value.trim() || QUICK_SAVE_NAME; onAction('save'); } }]));   // L10N3d: the save window's (DaggerfallUnitySaveGameWindow.cs:439)
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
    actions: [{ label: t('menu.save.overwrite', 'Overwrite'), primary: true, onClick: () => { _pickedSaveName = save.saveName; onAction('save'); } }],
  }));
  body.append(grid);
}

// ── EXIT (pause only) ────────────────────────────────────────────
// U51. Classic confirms on TEXT.RSC 1069 and then posts dfuiExitGame
// (pauseWindow.js:"if (this._saveSettings) saveSettings();   // ConfirmExitBox"); in a browser Application.Quit means nothing,
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
  c.append(el('h3', null, t('menu.exit.title', 'Back to the main menu')));
  c.append(el('p', 'meta', t('menu.exit.blurb', 'This takes you back to the main menu. A browser tab can\u2019t close itself.')));
  c.append(stats([[t('menu.exit.lastSave', 'Last save'), save ? saveLine(save) : t('menu.exit.none', 'none')]]));
  c.append(acts([{
    label: t('menu.exit.leave', 'Leave this game'),
    primary: true,
    onClick: () => ask(
      t('menu.exit.leave', 'Leave this game'),
      save
        ? (save.when != null ? t('menu.exit.lostSince', 'Anything since {when} is lost. The quicksave itself is untouched.', { when: save.when })
          : t('menu.exit.lostSinceLast', 'Anything since the last save is lost. The quicksave itself is untouched.'))
        : t('menu.exit.allLost', 'Nothing has been saved in this game, so all of it is lost.'),
      t('menu.exit.yes', 'Exit'),
      () => onAction('exit'),
    ),
  }]));
  body.append(c);
}

// ── SETTINGS ─────────────────────────────────────────────────────
// The whole shipped screen, rendered from the same law. Three panes:
// tabs, rows, help. Nothing is filtered out by tier - a hidden
// setting is a setting the player cannot find out about, which is the
// rule U30 landed after the launcher hid them behind a filter.
//
// ORG2 (2026-10-09, Mac: "Graphic settings needs its own tab, etc. I really need you to go all in"): ONE SCREEN FOR
// EVERY OPTION. Settings held DFU's keys in seven categories and the Features home held the port's rows and the mods in
// seven groups of its own - the grass under Features > Sight, the field of view under Settings > Video - so "the
// graphics" were behind two doors and a long scroll each. Now the rail is TABS by subject (ui/settings/settingsMap.js:
// Graphics, Gameplay, Combat, World, Interface, Audio, Controls, Accessibility, Mods & files), each cut into SECTIONS
// with a line of what they hold, and every option is a ROW in one shape - its name, its line, its control on the right -
// whichever store it lives in: DFU's settingRow, the port's own rows, and a Features row as a row with its bar
// (featureTile). Over the rows, a toolbar: one SEARCH over every tab, filters (what you changed, and the three kinds the
// Features home filtered by), and the actions that act on everything. The help pane reads whichever row is picked, or,
// with none, the tab: its sections and a Restore of its own defaults. Graphics opens on a PRESET (systems/
// graphicsPresets.js). The pause window draws the same screen, condensed as PX10 had it: the rows that act in play.

let optQuery = '';          // ORG2: the search, over every tab - kept across a repaint, cleared by a tab change
let optFilter = 'all';      // ORG2: 'all' | 'changed' | a KINDS id
let pickedFeature = null;   // ORG2: the Features row the help pane reads (pickedKey is DFU's key)
let optScrollTo = null;     // ORG2: a row to bring into view after the next paint (the mods' list sends you to one)

/** ORG2: the filters over the rows - what you changed, then the Features home's three kinds. */
const OPT_FILTERS = Object.freeze([['all', 'All'], ['changed', 'Changed'], ['enhanced', 'Enhanced'], ['mod', 'Mods'], ['classic', 'Daggerfall Unity']]);

/** ORG2: the port's own rows, built once a paint and found by the id each carries (`dataset.opt`). A row its builder
 *  does not draw here - the touch knobs off a touch device, the HUD's layout on the classic skin, the start video at
 *  pause - is simply absent, and its item draws nothing. (Exported for test/systems/org2_options.test.js, which holds the map
 *  total over it.) */
export function portPool({ pause = false } = {}) {
  const pool = new Map();
  for (const r of [...portRowsGame({ pause }), ...portRowsAudio(), ...portRowsControls({ pause }), ...portRowsInterface({ pause })]) {
    if (r?.dataset?.opt) pool.set(r.dataset.opt, r);
  }
  return pool;
}

/** ORG2: a Features row's value as its control reads it - the lane's own read, or the pref. */
function featureValue(id) {
  const c = resolveControl(FEATURES.find((f) => f.id === id));
  return c?.read ? c.read() : getPref(c?.key);
}

/** ORG2: whether an item stands away from how the game ships - a DFU key off its default, a Features row off its
 *  default segment, a port row's pref off the shelf's default. The Changed filter and the row's mark read it. */
export function itemChanged(item, pool) {   // AUDIT MEM-AUDIT G1: exported for the pins
  if (isSettingItem(item)) {
    const [sec, k] = item.split('/');
    const d = defaultOf(sec, k);
    return d !== undefined && String(effective()[sec]?.[k] ?? d) !== String(d);
  }
  if (item.startsWith('feat:')) {
    const f = FEATURES.find((x) => x.id === item.slice(5));
    const st = f && tileStates(f);
    if (!st || st.locked) return false;
    const d = defaultSegment(f, st);
    if (d >= 0 && d !== st.at) return true;
    // AUDIT MEM-AUDIT G1: and a part of its drawer off its default (featuresDefaults' own walk) - the preset reads Steady
    // shadows, and a part turned off read Custom on a tab that said nothing was changed
    return (resolveControl(f)?.parts ?? []).some((pt) => Object.hasOwn(PREF_DEFAULTS, pt.key) && onlineForcedPref(pt.key) === undefined && String(getPref(pt.key)) !== String(PREF_DEFAULTS[pt.key]));
  }
  if (item.startsWith('port:')) {
    const pref = pool?.get(item.slice(5))?.dataset?.pref;
    return !!pref && Object.hasOwn(PREF_DEFAULTS, pref) && onlineForcedPref(pref) === undefined && String(getPref(pref)) !== String(PREF_DEFAULTS[pref]);
  }
  return false;
}

/** ORG2: the kinds an item answers the filter for - a Features row its own, DFU's settings Daggerfall Unity's, the
 *  port's rows the port's. The screen's own pieces (the preset, the cards, the bindings) answer All alone. */
function itemKinds(item) {
  if (isSettingItem(item)) return ['classic'];
  if (item.startsWith('feat:')) return FEATURES.find((f) => f.id === item.slice(5))?.kinds ?? [];
  if (item.startsWith('port:')) return ['enhanced'];
  return [];
}

/** ORG2: what the search reads of an item - a DFU key's label and help, a Features row's words (its search text), a port
 *  row's own text, a card's. */
function itemText(item, pool) {
  if (isSettingItem(item)) return `${labelOf(item)} ${helpOf(item)} ${item}`;
  if (item.startsWith('feat:')) { const f = FEATURES.find((x) => x.id === item.slice(5)); return f ? featureSearchText(f) : ''; }
  if (item.startsWith('port:')) return pool.get(item.slice(5))?.textContent ?? '';
  if (item === 'preset:graphics') return presetSearchText();
  if (item === 'link:overhauls') return 'overhauls looks textures vanilla enhanced sounds interface';
  if (item === 'bindings') return 'key bindings keys keyboard rebind controls';
  if (item.startsWith('card:')) return { morrowind: 'morrowind files data body 3d attach', packs: 'packs textures music replacement folder',
    peerSprites: 'other players look sprites', nightSounds: 'night sounds crickets howl' }[item.slice(5)] ?? '';
  return '';
}
const normWords = (s) => String(s).toLowerCase().replace(/[\u2018\u2019]/g, "'");
/** ORG2: every word of the query in the item's text. */
function itemMatches(item, pool, q) {
  const text = normWords(itemText(item, pool));
  return normWords(q).split(/\s+/).filter(Boolean).every((w) => text.includes(w));
}

/** ORG2: whether a DFU key draws as a row here - live, or read at the next start; at pause, live alone (PX10). */
const drawsHere = (key, pause) => (pause ? tierOf(key) === 'live' : drawsFlat(key));

/** ORG2: AN ITEM AS THE NODES IT DRAWS - none for a key a Features row owns (FT13), a key that folds (`fold`
 *  collects it), a port row this device does not have, or a row the filter leaves out. */
function itemNodes(item, ctx) {
  const { pool, pause, fold = null, any = false } = ctx;
  if (optFilter !== 'all') {
    if (optFilter === 'changed' ? !itemChanged(item, pool) : !itemKinds(item).includes(optFilter)) return [];
  }
  const mark = (n) => { if (n && itemChanged(item, pool)) n.classList.add('changed'); return n; };
  if (isSettingItem(item)) {
    if (featureForControl('settings', item)) return [];   // FT13: its switch is the Features row beside it
    if (!drawsHere(item, pause)) {
      if (any && !pause) return [mark(settingRow(item))].filter(Boolean);   // the search finds a folded key where it stands
      fold?.push(item);
      return [];
    }
    return [mark(settingRow(item))].filter(Boolean);
  }
  if (item.startsWith('feat:')) {
    const f = FEATURES.find((x) => x.id === item.slice(5));
    return f ? [mark(featureTile(f))] : [];
  }
  if (item === 'port:language') { const r = pool.get('language'); const pack = r ? translationPackRow() : null; return r ? [mark(r), ...(pack ? [pack] : [])] : []; }   // L10N3b: the translation pack rides under the language row
  if (item.startsWith('port:')) { const r = pool.get(item.slice(5)); return r ? [mark(r)] : []; }
  if (item === 'preset:graphics') return [graphicsPresetRow()];
  if (item === 'link:overhauls') return pause ? [] : [overhaulsLinkRow()];
  if (item === 'mods-index') return modsIndexRows();
  if (item === 'bindings') { const box = el('div', 'opt-bindings'); paneControls(box, { render }); return [box]; }
  if (item.startsWith('card:')) {
    const make = { morrowind: () => morrowindCard(), packs: () => packsCard(), peerSprites: () => peerSpritesCard(), nightSounds: () => nightSoundsCard() }[item.slice(5)];
    return make ? [make()] : [];
  }
  return [];
}

/** ORG2: a section's head - its title and how many rows it drew. Its id is the jump strip's anchor. */
function sectionHead(tab, s, n, { path = false } = {}) {
  const head = el('div', 'sec-head');
  head.id = `sec-${tab.id}-${s.id}`;
  const t = el('div', 'sec-title');
  t.append(el('h3', null, path ? `${tab.title} \u203a ${s.title}` : s.title));
  if (n) t.append(el('span', 'count', String(n)));
  head.append(t);
  return head;
}

/** ORG2: a node that is an option - a row or a Features row - and not the screen's own door (the Overhauls link), a
 *  card, or a row greyed here. What a section's head counts, as the rail's count does (tabCount). */
const isOptionNode = (x) => (x.classList?.contains('row') && !x.classList.contains('opt-link') && x.dataset?.live !== '0') || x.classList?.contains('ft-tile');

/** ORG2: the rows one tab draws, section by section - `[{ s, nodes }]`, a section that drew nothing left out - and
 *  the keys it folds. */
function tabSections(tab, ctx) {
  const fold = [];
  const out = [];
  for (const s of tab.sections) {
    const nodes = s.items.flatMap((item) => itemNodes(item, { ...ctx, fold }));
    if (nodes.length) out.push({ s, nodes });
  }
  return { sections: out, fold };
}

/** ORG2: how many options a tab draws - what the rail counts. Rows, not the screen's own pieces. */
function tabCount(tab, ctx) {
  let n = 0;
  for (const s of tab.sections) {
    for (const item of s.items) {
      if (isSettingItem(item)) { if (!featureForControl('settings', item) && drawsHere(item, ctx.pause)) n++; }
      else if (item.startsWith('feat:')) n++;
      else if (item.startsWith('port:')) { const r = ctx.pool.get(item.slice(5)); if (r && r.dataset.live !== '0') n++; }   // QREPAIR: a row greyed here is not one that works here
      else if (item === 'mods-index') n += FEATURES.filter((f) => f.kinds.includes('mod')).length;   // every mod has a row in the list
      else if (item === 'preset:graphics') n++;   // the preset is a choice of its own; the Overhauls door is not
    }
  }
  return n;
}

/** ORG2: the body under the toolbar - the open tab's page, or, while the search holds a word, what it finds on every
 *  tab under "Tab › Section" heads. Painted in place on each key of the search (so the field keeps its caret) and by
 *  every render. */
function paintOptionsBody(body, { pause = false } = {}) {
  const pool = portPool({ pause });
  const ctx = { pool, pause };
  body.replaceChildren();
  const q = optQuery.trim();
  if (q) {
    let found = 0;
    for (const tab of CATEGORIES) {
      for (const s of tab.sections) {
        const nodes = s.items.filter((item) => item !== 'mods-index' && itemMatches(item, pool, q)).flatMap((item) => itemNodes(item, { ...ctx, any: true }));
        if (!nodes.length) continue;
        body.append(sectionHead(tab, s, nodes.filter(isOptionNode).length, { path: true }), ...nodes);
        found += nodes.length;
      }
    }
    if (!found) body.append(empty('No matches'));
    return;
  }
  const tab = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  if (tab.id === 'mods' && isOnlinePage()) body.append(el('p', 'meta opt-note', noteText(ONLINE_MODS_NOTE)));   // MODS-ONLINE-2: said once, over the mods; L10N4: in the player's language
  const { sections, fold } = tabSections(tab, ctx);
  if (sections.length >= 3 && !pause) {
    const strip = el('nav', 'sec-jump');
    strip.setAttribute('aria-label', 'Sections');
    for (const { s } of sections) {
      const b = el('button', 'sec-jumpbtn', s.title);
      b.type = 'button';
      b.onclick = () => document.getElementById(`sec-${tab.id}-${s.id}`)?.scrollIntoView({ block: 'start' });
      strip.append(b);
    }
    body.append(strip);
  }
  const many = sections.length > 1;
  for (const { s, nodes } of sections) {
    const n = nodes.filter(isOptionNode).length;
    if (many) body.append(sectionHead(tab, s, n));
    body.append(...nodes);
  }
  if (!sections.length) body.append(empty(optFilter === 'changed' ? 'Nothing changed' : 'Nothing here'));
  if (pause) body.append(el('p', 'meta opt-note', 'More options in the main menu\u2019s Settings.'));   // PX10: the closing line says so
  // the tiers a tab folds: SAVED FOR LATER and NOT AVAILABLE HERE (SO1), counted and remembered per tab
  if (!pause) {
    for (const [tier, title, blurb] of TIER_GROUPS) {
      const ks = fold.filter((k) => tierOf(k) === tier);
      if (ks.length) body.append(tierGroup(tab.id, tier, title(), blurb(), ks));   // L10N4: the group's words read as drawn
    }
  }
}

/** UNSAVED-MARK (FIELD BUGS 2026-10-11): the toolbar's height, kept on its list as `--opt-tools-h` - what a sticky card
 *  under it (the bindings' head and its Confirm, enhancedStyle.js) stands below. The bar wraps by the width (the search,
 *  the chips, the actions), so it is measured, not assumed: once now and on every resize, until the bar leaves the page
 *  (a repaint builds a new one). No observer, no measure: the card sticks at the top, as before. */
export function stickUnderToolbar(list, bar, RO = globalThis.ResizeObserver) {
  const put = () => { const h = bar.offsetHeight; if (Number.isFinite(h) && h > 0) list.style?.setProperty?.('--opt-tools-h', `${h}px`); };
  if (typeof RO !== 'function') return null;
  const ro = new RO(() => { if (bar.isConnected === false) { ro.disconnect(); return; } put(); });
  ro.observe(bar);
  return ro;
}

/** ORG2: the toolbar over the rows - the search, the filters, and the actions that act on every tab. */
function optionsToolbar(body, { pause = false } = {}) {
  const bar = el('div', 'opt-tools');
  const search = el('input', 'opt-search');
  search.type = 'search';
  search.id = 'opt-search';   // AUDIT 32 P3: a repaint gives the caret back by id
  search.placeholder = 'Search settings';
  search.setAttribute('aria-label', 'Search settings');
  search.value = optQuery;
  search.oninput = () => {
    discardControlsStaging();   // FIX-F: a search repaints the page - a walk away from the bindings, which drops what they staged
    optQuery = search.value; pickedKey = null; pickedFeature = null;
    paintOptionsBody(body, { pause });
    // the rail says no tab while the search reads them all - painted in place, as the body is
    for (const b of search.closest('.panes')?.querySelectorAll('.subbtn') ?? []) b.classList.toggle('on', !optQuery.trim() && b.dataset.tab === category);
  };
  bar.append(search);
  const chips = el('div', 'opt-filters');
  const pool = portPool({ pause });
  const changed = CATEGORIES.reduce((n, t) => n + t.sections.reduce((m, s) => m + s.items.filter((i) => !(isSettingItem(i) && featureForControl('settings', i)) && itemChanged(i, pool)).length, 0), 0);
  for (const [id, label] of OPT_FILTERS) {
    const b = el('button', `chip${optFilter === id ? ' on' : ''}${id === 'all' || id === 'changed' ? '' : ` ${id}`}`, label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(optFilter === id));
    if (id === 'changed') b.append(el('span', 'n', String(changed)));
    b.onclick = () => { discardControlsStaging(); optFilter = id; pickedKey = null; pickedFeature = null; render(); };   // FIX-F: a filter hides the bindings
    chips.append(b);
  }
  bar.append(chips);
  // FT18 + FEATURES-DEFAULTS (issue #399): the switches' All off and its Restore, and one reset of everything
  const kept = getPref(FEATURES_RESTORE_PREF);
  bar.append(acts([
    { label: t('menu.features.allOff', 'All off'), onClick: () => ask(t('menu.features.allOffTitle', 'Turn Everything Off'), allOffAsk(), t('menu.features.allOff', 'All off'), () => { featuresAllOff(); }) },
    ...(kept && typeof kept === 'object' ? [{ label: t('menu.features.restore', 'Restore'), onClick: () => { featuresRestore(); render(); } }] : []),
    { label: t('menu.settings.reset', 'Reset everything to defaults'), onClick: () => ask(t('menu.settings.resetTitle', 'Reset Everything'), resetAllAsk(), t('menu.settings.resetYes', 'Reset'), () => { resetEverything(); }) },   // L10N4: the words the Features toolbar and the category card carried, routed where they stand now
  ]));
  return bar;
}

/** ORG2: the one reset of everything - DFU's settings as Daggerfall Unity ships them, and every Features row, part, mod
 *  module and dial as the game ships them (FEATURES-DEFAULTS). Your interface, text size and key bindings are not
 *  options here, and are left alone. */
export const RESET_ALL_ASK = 'Every setting and mod goes back to its default. Your interface, text size and key bindings are kept.';
/** L10N4: the confirm's body in the player's language (RESET_ALL_ASK stays the English the pins read) - the reset's ask, its
 *  words main's since ORG2. */
const resetAllAsk = () => t('menu.settings.resetBody', RESET_ALL_ASK);
function resetEverything() {
  resetToDefaults(); _eff = null;
  featuresDefaults();
}

/** ORG2: one tab back to how the game ships it - its DFU keys, its Features rows (with their parts and a mod's modules
 *  and dials) and its port rows' prefs. The All off keep is left for Restore: this is one tab, not everything.
 *  (Exported for test/systems/org2_options.test.js.) */
export function restoreTabDefaults(tab) {
  const items = tab.sections.flatMap((s) => s.items);
  for (const item of items) {
    if (!isSettingItem(item) || featureForControl('settings', item)) continue;
    const [sec, k] = item.split('/');
    if (onlineForcedSetting(sec, k) !== undefined) continue;
    const d = defaultOf(sec, k);
    if (d !== undefined) setValue(sec, k, d);
  }
  saveSettings(); _eff = null;   // AUDIT F7: the store changed
  featuresDefaults(items.filter((i) => i.startsWith('feat:')).map((i) => FEATURES.find((f) => f.id === i.slice(5))).filter(Boolean), { spendKeep: false });
  const pool = portPool();
  for (const item of items) {
    const pref = item.startsWith('port:') ? pool.get(item.slice(5))?.dataset?.pref : null;
    if (pref === MIDI_OUT_PREF) setMidiOut(PREF_DEFAULTS[pref]);   // AUDIT MIDI-OUT1: through the door the music hears
    else if (pref && Object.hasOwn(PREF_DEFAULTS, pref) && onlineForcedPref(pref) === undefined) setPref(pref, PREF_DEFAULTS[pref]);
  }
}

function paneSettings(pane, { pause = false } = {}) {
  const panes = el('div', 'panes opt');
  const pool = portPool({ pause });

  const rail = el('div', 'subrail');
  for (const cat of CATEGORIES) {
    const on = cat.id === category && !optQuery.trim();
    const b = el('button', `subbtn${on ? ' on' : ''}`, cat.title);
    b.dataset.tab = cat.id;
    b.append(el('span', 'count', String(tabCount(cat, { pool, pause }))));   // SO1: what works here, not the file's row count
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
      // their copy says a walk away drops them. ORG2: and from the search - a tab pressed is the tab wanted.
      if (on) { pickedKey = null; pickedFeature = null; sheetOpen = true; } else { discardControlsStaging(); category = cat.id; pickedKey = null; pickedFeature = null; optQuery = ''; }
      render();
    };
    if (on) b.append(el('span', 'more-dot'));
    rail.append(b);
  }

  const list = el('div', 'list');
  const body = el('div', 'opt-body');
  const tools = optionsToolbar(body, { pause });
  list.append(tools, body);
  stickUnderToolbar(list, tools);   // UNSAVED-MARK: the bindings' sticky head stands under this sticky bar, never behind it
  paintOptionsBody(body, { pause });
  if (optScrollTo) {
    const id = optScrollTo;
    optScrollTo = null;
    globalThis.requestAnimationFrame?.(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }));
  }

  const detail = el('div', 'detail');
  const close = el('button', 'sheet-close', t('menu.sheet.close', 'Close'));
  close.onclick = () => { sheetOpen = false; confirming = null; render(); };
  detail.append(close);
  const f = pickedFeature ? FEATURES.find((x) => x.id === pickedFeature) : null;
  detail.append(confirming ? confirmCard() : (pickedKey ? helpCard(pickedKey) : f ? featureCard(f) : categoryCard({ pool, pause })));
  if (sheetOpen) detail.classList.add('open');

  panes.append(rail, list, detail);
  pane.append(panes);
}

/* MENU-TOGGLE (2026-09-26, Mac: "We really need to remove the enhanced/classic menu toggle and ensure all the UI is
 * linked up properly"): THE MENU'S SKIN TOGGLE IS RETIRED - the pair under the brand and on the home's foot, the
 * Settings row "Interface Style" and its help. Plain Enhanced went with PLUS-ONLY; the interface is chosen on the
 * Overhauls page's UI Overhaul card alone (Classic, Enhanced Plus, GrimoireUI - systems/overhauls.js uiChoiceUrl, the
 * SKIN-CARRY law's one home now), which both skins' boot rails and the pause menu carry. */
/** ORG2: THE TAB'S CARD, the help pane with no row picked - how many options it holds, how many you changed, and a
 *  Restore of its own defaults. */
function categoryCard({ pool = portPool(), pause = false } = {}) {
  const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const d = el('div', 'dcard');
  d.append(el('h3', null, cat.title));
  const ctx = { pool, pause };
  const changed = cat.sections.reduce((n, s) => n + s.items.filter((i) => !(isSettingItem(i) && featureForControl('settings', i)) && itemChanged(i, ctx.pool)).length, 0);
  d.append(el('p', 'status', t('menu.settings.tabStatus', '{n} options \u00b7 {changed} changed', { n: tabCount(cat, ctx), changed })));
  const b = el('button', 'act', t('menu.settings.restoreTab', 'Restore defaults'));
  b.onclick = () => ask(
    t('menu.settings.restoreTabTitle', 'Restore {tab} Defaults', { tab: cat.title }),
    t('menu.settings.restoreTabBody', 'Every option on this tab goes back to its default.'),
    t('menu.settings.restoreYes', 'Restore'),
    () => { restoreTabDefaults(cat); },
  );
  d.append(b);
  return d;
}

// ── ORG2: THE SCREEN'S OWN PIECES ────────────────────────────────

/** AUDIT MEM-AUDIT G4/G5/G6: the preset row's words, one home and in the player's language - its note names what it
 *  sets, its effect when, and its search finds it by either (in English too) and by the rows' own titles: a fixed list
 *  of English words did not know its own note, and the row was the one on the tab no language reached. */
const PRESET_WORDS = {
  name: () => t('menu.settings.preset.name', 'Quality preset'),
  note: () => t('menu.settings.preset.note', 'View distance, grass, clouds, ground sharpness, water, windows and steady shadows.'),
  effect: () => t('menu.settings.preset.effect', 'Steady shadows and the windows change at once; the rest when the world next loads.'),
  custom: () => t('menu.settings.preset.custom', 'Custom'),
};
const PRESET_LABELS = {
  low: () => t('menu.settings.preset.low', 'Low'), medium: () => t('menu.settings.preset.medium', 'Medium'),
  high: () => t('menu.settings.preset.high', 'High'), ultra: () => t('menu.settings.preset.ultra', 'Ultra'),
};
export const presetSearchText = () => ['quality preset graphics low medium high ultra performance frame rate slow',
  'View distance, grass, clouds, ground sharpness, water, windows and steady shadows.', PRESET_WORDS.name(), PRESET_WORDS.note(), PRESET_WORDS.effect(),
  ...GRAPHICS_PRESETS.map((p) => PRESET_LABELS[p.id]?.() ?? p.label),
  ...PRESET_ROWS.map((id) => FEATURES.find((f) => f.id === id)?.title ?? ''),
  ...PRESET_PARTS.map((k) => FEATURES.flatMap((f) => resolveControl(f)?.parts ?? []).find((pt) => pt.key === k)?.label ?? k)].join(' ');
/** ORG2: THE GRAPHICS PRESET - one bar over the six rows that cost the most and its parts (systems/graphicsPresets.js), reading
 *  the preset they stand at or Custom. A press writes each row through its own door, so a lane's second store moves
 *  with it and a row the room decides is left as it is. */
export function graphicsPresetRow() {   // AUDIT MEM-AUDIT G3: exported for the pins - the bar as drawn
  const now = presetNow(featureValue, getPref);
  const row = el('div', 'row opt-preset');
  row.dataset.opt = 'graphicsPreset';
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', PRESET_WORDS.name()));
  main.append(el('div', 'row-note', PRESET_WORDS.note()));   // RW1: and the real windows; MEM-AUDIT: and Steady shadows
  main.append(el('div', 'row-sub', PRESET_WORDS.effect()));   // AUDIT MEM-AUDIT G6: when it takes effect, as every other row says
  row.append(main);
  const ctl = el('div', 'ctl');
  const seg = el('div', 'ft-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', PRESET_WORDS.name());
  for (const p of GRAPHICS_PRESETS) {
    const b = el('button', 'ft-segb', PRESET_LABELS[p.id]?.() ?? p.label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(now?.id === p.id));
    b.onclick = (e) => { e.stopPropagation(); applyGraphicsPreset(p); render(); };
    seg.append(b);
  }
  if (!now) { const c = el('span', 'ft-segb custom', PRESET_WORDS.custom()); c.setAttribute('aria-current', 'true'); seg.append(c); }
  ctl.append(seg);
  row.append(ctl);
  return row;
}
/** ORG2: a preset, written - each of its rows to its value through the row's own states (tileStates). */
export function applyGraphicsPreset(p) {
  for (const id of PRESET_ROWS) {
    const f = FEATURES.find((x) => x.id === id);
    const c = resolveControl(f);
    const st = f && tileStates(f);
    if (!st || st.locked || !c?.tiers) continue;
    const i = c.tiers.findIndex(([v]) => String(v) === String(p.values[id]));
    if (i >= 0 && (i !== st.at || c.write)) st.set(i);   // AUDIT MEM-AUDIT G2: a lane's row written whole - its bar reads one store (land view off the enhanced outdoors: DFU's 1..4), and Low left the other at 5
  }
  // MEM-AUDIT: and its parts, each written straight as its drawer writes it - one the room decides is left as it is
  for (const k of PRESET_PARTS) if (onlineForcedPref(k) === undefined && String(getPref(k)) !== String(p.parts[k])) setPref(k, p.parts[k]);
}

/** ORG2: the Overhauls page's door, on the Graphics tab - the whole looks are chosen there. */
function overhaulsLinkRow() {
  const row = el('div', 'row opt-link');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', 'Overhauls'));
  main.append(el('div', 'row-note', 'Overhauls for the world, its sounds and the interface, such as Vanilla Enhanced, are on the Overhauls page.'));
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act rowact', 'Open');
  b.type = 'button';
  b.onclick = () => go('overhauls');
  ctl.append(b);
  row.append(ctl);
  return row;
}

/** ORG2: EVERY MOD, ONE LIST - each mod the game carries, where its options live, and its switch. A press on its name
 *  takes you to its row on its own tab. */
function modsIndexRows() {
  return FEATURES.filter((f) => f.kinds.includes('mod')).sort((a, b) => a.title.localeCompare(b.title)).map((f) => {
    const st = tileStates(f);
    const row = el('div', 'row opt-modrow');
    const main = el('button', 'row-main');
    main.type = 'button';
    main.append(el('div', 'row-name', f.title), el('div', 'row-note', optionPath(`feat:${f.id}`).replace(/^Settings \u203a /, '')));
    main.onclick = () => { const w = whereIs(`feat:${f.id}`); if (w) { category = w.tab.id; pickedFeature = f.id; pickedKey = null; optScrollTo = `opt-${f.id}`; render(); } };
    row.append(main);
    const ctl = el('div', 'ctl');
    if (st) ctl.append(segBar(st, f.title));
    row.append(ctl);
    return row;
  });
}

/** ORG2: A FEATURES ROW'S CARD in the help pane - where it lives, what it does, when it takes effect, a mod's keys. */
function featureCard(f) {
  const c = resolveControl(f);
  const d = el('div', 'dcard ft-card');
  d.append(el('div', 'ft-rail-k', optionPath(`feat:${f.id}`)));
  d.append(el('h3', null, f.title));
  d.append(kindTags(f.kinds));
  if (f.note) d.append(el('p', 'ft-rail-note', f.note));
  if (f.effect) d.append(el('p', 'ft-rail-effect', f.effect));
  const kv = el('dl', 'ft-rail-kv');
  const pair = (k, v) => { kv.append(el('dt', null, k), el('dd', null, v)); };
  const rv = c.store === 'mods' ? c.vendor
    : (Array.isArray(c.also) ? c.also.find((a) => a.store === 'mods')?.vendor : null) ?? null;
  if (rv) {
    // UXB1-F: a mod's keys, where a player reading about the mod is already looking
    const keys = modKeyRows(rv, bindings());
    if (keys.length) pair(t('menu.features.keysLabel', 'Keys'), t('menu.features.keysList', '{keys} \u2013 {note}', { keys: keys.map((k) => `${k.label}: ${k.key}`).join(' · '), note: featureKeysNote() }));   // L10N4: one pattern
  }
  if (kv.children?.length) d.append(kv);
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
      b.setAttribute('aria-label', dir < 0 ? t('menu.settings.less', 'less {name}', { name: labelOf(key) }) : t('menu.settings.more', 'more {name}', { name: labelOf(key) }));
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
// There is NO mod system (Ledger C, Not planned - and systems/settings/settings.js:"UI4: the item info"
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
const ONLINE_LOCK_NOTE = 'Always on online: the shared world uses every enhancement. Offline, your own choice applies.';
/** MODS-ONLINE-2: a mod switch wears a lock for a DIFFERENT reason - not
 *  the lane, the floor - and a lock that gives the wrong reason is a
 *  refusal nobody can read. The two road switches say which. */
/** MODS-ONLINE-2: the Mods pane's own line. The lane's note (above)
 *  is about the PORT's switches and was wrong over the tiles the
 *  moment a mod stopped being forced. */
const ONLINE_MODS_NOTE = 'Most mods are your choice online. A few are set for everyone, so all players share the same ground and rules. Ground: Basic Roads, World of Daggerfall, Detailed Ships, Iliac Puddle No More\u2019s sea and depth, and There\u2019s a Hole in the Bottom of the Ocean. Rules: every setting of Meaner Monsters, the Combat and Armor Overhaul, Unleveled Loot, Roleplay & Realism, Roleplay & Realism: Items and Oblivion leveling, except who stands behind shop counters and which leveling your character uses. Travel Options is on for everyone, so every trip over land is traveled and ships sail only from ports. Immersive Travel is on for everyone too: carriages wait at every city gate, a driver\u2019s fare is your fast travel over land, and fares are the same for everyone. Its map style stays your choice.';   // AUDIT IT1 W5: a port's ship passage is fast travel online too
const ONLINE_GROUND_NOTE = 'Set for everyone online, because everyone has to stand on the same ground: roads, rivers, camp sites, ship decks and the seafloor. Offline, your own choice applies.';   // AUDIT LANDFORMS C4: the rivers' row is one of the ground's since LANDFORM3 cut their channels
/** WOD1: the vendors whose room-owned switch is the GROUND's - the two
 *  that write terrain heights (roads' beds, World of Daggerfall's sites). */
const ONLINE_GROUND_VENDORS = Object.freeze(['roads-hazelnut', 'world-of-daggerfall', 'detailed-ships', 'ocean-holes']);   // DS1: the ships' shared deck   // OH-A: the pits cut into the seafloor
/** DW-D: a vendor whose room-owned switches are the ground's AND other reasons names its ground keys - the carved
 *  sea's switch and its depth. */
const ONLINE_GROUND_KEYS = Object.freeze({ 'iliac-puddle-no-more': Object.freeze(['Enabled', 'General.WaterDepth']) });
/** MODS-ONLINE-4: the other three, and their reason is not the ground -
 *  it is that this switch would be spending somebody else's evening. */
const ONLINE_SHARED_NOTE = 'On for everyone online, because a dungeon\u2019s monsters belong to whoever hosts it and loot passes between players. Offline, your own choice applies.';
/** MODS-ONLINE-5: one ruleset per room - the reason PCAAO is forced whole, and RR's six combat overrides and its
 *  intensive training with it. Not the ground's reason and not the host's foes', so its own words. */
const ONLINE_RULESET_NOTE = 'Set for everyone online, so all players share one set of combat, training and swimming rules. Offline, your own choice applies.';
const ONLINE_RULESET_KEYS = Object.freeze({
  'roleplay-realism': Object.freeze(['advancedArchery', 'weaponSpeed', 'weaponMaterials', 'classicStrengthDamageBonus', 'equipDamage', 'encumbranceEffects', 'RefinedTraining.intensiveTraining']),
  'iliac-puddle-no-more': Object.freeze(['General.SwimSpeedMultiplier', 'General.EnableSwimStroke', 'General.ArgonianInfiniteBreath']),   // DW-D: the swim and the breath
});
/** REALM P0.2: a dial of a balance mod the room owns whole (onlineLane.js ONLINE_WHOLE_MODS) - its own reason. */
const ONLINE_BALANCE_NOTE = 'Set for everyone online, so no setting makes one character stronger or richer than the rest. Offline, your own choice applies.';
/** DISC22-A: a DFU setting the room plays by (onlineLane.js ONLINE_FORCED_SETTINGS) - its own reason. */
const ONLINE_SETTING_NOTE = 'Set for everyone online, so enchanted items are repaired the same way for all players. Offline, your own choice applies.';
/** RAID2: a world event the room shares - its own reason, not the ground's, the ruleset's or a host's foes'. */
const ONLINE_WORLD_EVENT_VENDORS = Object.freeze(['world-events-raiding-parties']);
const ONLINE_WORLD_EVENT_NOTE = 'On for everyone online: a raid is shared, so everyone in town fights the same raiders and every kill counts for all. Offline, your own choice applies.';
/** TRAVEL-ONLINE: Travel Options' three room switches - the mod and its two journey dials - and their own reason. */
const ONLINE_TRAVEL_VENDORS = Object.freeze(['travel-options']);
const ONLINE_TRAVEL_NOTE = 'On for everyone online: every trip over land is traveled, and ships sail only from ports. Offline, your own choice applies.';
/** IT1: Immersive Travel's two room switches - the mod (its carriages stand at the gates, ground everyone walks among) and
 *  Disable Normal Travel held off - and their own reason. */
const ONLINE_CARRIAGE_VENDORS = Object.freeze(['immersive-travel']);
const ONLINE_CARRIAGE_NOTE = 'Set for everyone online. Carriages wait at every city gate, trips on the travel map are traveled in full, and a driver\u2019s fare is your fast travel over land, at the same price for everyone. Offline, your own choice applies.';   // AUDIT IT1 W5
/** L10N4: the notes above in the player's language. Each constant stays the English identity the ladders below hand
 *  round (and the pins read); a note is turned into words where it is shown (noteText). */
const NOTE_TEXT = new Map([
  [ONLINE_LOCK_NOTE, () => t('menu.online.lockNote', ONLINE_LOCK_NOTE)],
  [ONLINE_MODS_NOTE, () => t('menu.online.modsNote', ONLINE_MODS_NOTE)],
  [ONLINE_GROUND_NOTE, () => t('menu.online.groundNote', ONLINE_GROUND_NOTE)],
  [ONLINE_SHARED_NOTE, () => t('menu.online.sharedNote', ONLINE_SHARED_NOTE)],
  [ONLINE_RULESET_NOTE, () => t('menu.online.rulesetNote', ONLINE_RULESET_NOTE)],
  [ONLINE_BALANCE_NOTE, () => t('menu.online.balanceNote', ONLINE_BALANCE_NOTE)],
  [ONLINE_SETTING_NOTE, () => t('menu.online.settingNote', ONLINE_SETTING_NOTE)],
  [ONLINE_WORLD_EVENT_NOTE, () => t('menu.online.worldEventNote', ONLINE_WORLD_EVENT_NOTE)],
  [ONLINE_TRAVEL_NOTE, () => t('menu.online.travelNote', ONLINE_TRAVEL_NOTE)],
  [ONLINE_CARRIAGE_NOTE, () => t('menu.online.carriageNote', ONLINE_CARRIAGE_NOTE)],
]);
const noteText = (note) => NOTE_TEXT.get(note)?.() ?? note;
const onlineLockNote = (vendor, key) => (ONLINE_GROUND_VENDORS.includes(vendor) || ONLINE_GROUND_KEYS[vendor]?.includes(key) ? ONLINE_GROUND_NOTE : ONLINE_RULESET_KEYS[vendor]?.includes(key) ? ONLINE_RULESET_NOTE : ONLINE_WORLD_EVENT_VENDORS.includes(vendor) ? ONLINE_WORLD_EVENT_NOTE : ONLINE_TRAVEL_VENDORS.includes(vendor) ? ONLINE_TRAVEL_NOTE : ONLINE_CARRIAGE_VENDORS.includes(vendor) ? ONLINE_CARRIAGE_NOTE : ONLINE_SHARED_NOTE);   // IT1
/** REALM P0.2: a key the room owns only because its mod is owned whole wears the balance note; a key the room table names keeps its own. */
const modLockNote = (vendor, key) => (!Object.hasOwn(ONLINE_ROOM_MOD_KEYS[vendor] ?? {}, key) && onlineWholeModKey(vendor, key, undefined, { offline: true }) ? ONLINE_BALANCE_NOTE : onlineLockNote(vendor, key));
/** REALM P0.2: a DIAL the room owns online - its steppers and buttons answer nothing, and say why. */
function lockDial(ctl, note) {
  for (const b of ctl.querySelectorAll('button')) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); b.title = noteText(note); }
  ctl.title = noteText(note);
}
function lockOnline(b, main, { note = ONLINE_LOCK_NOTE, value = true } = {}) {
  b.textContent = value ? t('menu.online.lockedOn', 'On (online)') : t('menu.online.lockedOff', 'Off (online)');
  b.classList.toggle('primary', !!value);
  b.disabled = true;
  b.title = noteText(note);
  b.setAttribute('aria-disabled', 'true');
  if (main) main.onclick = null;
}

/** One toggle over a uiPrefs key. */
function prefRow(key, name, note, { onChange = null, home = false } = {}) {
  if (!home) { const moved = featureForControl('prefs', key); if (moved) return movedRow(moved); }   // FT2: one home per idea, every store
  const row = el('div', 'row');
  row.dataset.opt = key; row.dataset.pref = key;   // ORG2: the map places a port row by its id; Changed reads its pref
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', name));
  if (note) main.append(el('div', 'row-note', note));
  const on = !!getPref(key);
  main.onclick = () => { setPref(key, !on); onChange?.(!on); render(); };
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', `act${on ? ' primary' : ''}`, on ? t('menu.toggle.on', 'On') : t('menu.toggle.off', 'Off'));
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
  if (onlineForcedPref(key) !== undefined) { lockOnline(b, main); b.textContent = t('menu.online.lockedTier', '{tier} (online)', { tier: tiers[at][1] }); }   // OL1: the outdoors row reads the lane's forced answer and names its tier under the lock
  ctl.append(b, el('span', 'tier live'));
  row.append(ctl);
  return row;
}

/** A stepped number row over a uiPrefs key (TI2's shape). */
function stepRow(key, name, note, { min, max, step: inc, fmt }) {
  const row = el('div', 'row');
  row.dataset.opt = key; row.dataset.pref = key;   // ORG2
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', name));
  if (note) main.append(el('div', 'row-note', note));
  row.append(main);
  const ctl = el('div', 'ctl');
  const cur = () => { const v = Number(getPref(key)); return Number.isFinite(v) ? v : 1; };   // MONSTER-VOL: 0 is a value (a muted volume), not unset
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

/** L10N1b: THE LANGUAGE ROW. Every language the build holds text for, by its own name and its English one, switched
 *  at once - its tables fetched, the text core switched, the menu drawn again - and remembered (uiPrefs `language`).
 *  The front door's alone, as the skip-video row is: a running game keeps the language it booted in. A language whose
 *  strings are Claude's drafts says so (Mac: "AI drafts, labeled"). */
function languageRow() {
  const row = el('div', 'row');
  row.dataset.opt = 'language'; row.dataset.pref = 'language';   // ORG2: the map finds it by its key (settingsMap port:language)
  const main = el('div', 'row-main');
  const cur = currentLocale();
  main.append(el('div', 'row-name', t('settings.language.name', 'Language')));
  main.append(el('div', 'row-note', t('settings.language.note', 'The language of the game\u2019s text. Takes effect at once.')));
  if (localeInfo(cur)?.source === 'machine') main.append(el('div', 'row-note', t('settings.language.machine', 'Machine translated')));
  row.append(main);
  const ctl = el('div', 'ctl');
  const sel = el('select', 'act langsel');
  sel.setAttribute('aria-label', t('settings.language.name', 'Language'));
  const offered = availableLocales();
  for (const l of offered.length ? offered : [catalogLocale(BASE_LOCALE)]) {
    if (l.hidden && l.code !== cur) continue;
    const o = el('option', '', l.name === l.englishName ? l.name : `${l.name} (${l.englishName})`);
    o.value = l.code;
    o.lang = l.code === 'qps-ploc' ? BASE_LOCALE : l.code;
    if (l.code === cur) o.selected = true;
    sel.append(o);
  }
  sel.onchange = () => { chooseLanguage(sel.value); };
  ctl.append(sel, el('span', 'tier live'));
  row.append(ctl);
  return row;
}

/** L10N3b: THE TRANSLATION PACK ROW, under the language's: a Daggerfall Unity translation of the chosen language,
 *  installed from the player's own files (scenes/dataSource.js pickTranslationPack) - never bundled, never uploaded -
 *  or replaced, or removed. Its text takes the place of the machine translation wherever it has some. English has
 *  none: English is the game's own. */
function translationPackRow() {
  const cur = currentLocale();
  const info = localeInfo(cur);
  if (!info || cur === BASE_LOCALE || info.hidden) return null;
  const pack = info.pack ?? null;
  const row = el('div', 'row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', t('settings.pack.name', 'Translation pack')));
  main.append(el('div', 'row-note', pack
    ? t('settings.pack.installed', '{name}: {tables, plural, one {# table} other {# tables}}, {quests, plural, one {# quest} other {# quests}}, {books, plural, one {# book} other {# books}}. Its text replaces the machine translation.', { name: pack.name, tables: pack.counts?.table ?? 0, quests: pack.counts?.quest ?? 0, books: pack.counts?.book ?? 0 })
    : t('settings.pack.none', 'Install a Daggerfall Unity translation into {language} from your own files. Nothing is uploaded.', { language: info.name })));
  row.append(main);
  const ctl = el('div', 'ctl');
  const install = el('button', 'act', pack ? t('settings.pack.replace', 'Replace…') : t('settings.pack.install', 'Install…'));
  install.onclick = async () => {
    const ds = await import('../../scenes/dataSource.js');
    await ds.pickTranslationPack(cur, info.name);
    render();
  };
  ctl.append(install);
  if (pack) {
    const remove = el('button', 'act', t('settings.pack.remove', 'Remove'));
    remove.onclick = async () => {
      const { removeTranslationPack } = await import('../../scenes/localeData.js');
      await removeTranslationPack(cur);
      render();
    };
    ctl.append(remove);
  }
  row.append(ctl);
  return row;
}

/** L10N1b: the player's language chosen - remembered, loaded, switched and drawn. A language that fails to load
 *  leaves the one that stood (scenes/localeData.js switchLocale answers English for text the build lacks). */
async function chooseLanguage(code) {
  setPref('language', code);
  setPref('languageOffered', true);
  try {
    const { switchLocale } = await import('../../scenes/localeData.js');
    await switchLocale(code);
  } catch (err) { console.error('[text] the language could not switch:', err?.message ?? err); }
  render();
}

/** L10N1b: THE FIRST-RUN OFFER. A player whose browser reads another language first is asked, once and IN that
 *  language, whether to play in it; either answer is remembered and the offer never returns. Shown only when the
 *  boot has fetched that language's text (scenes/localeData.js initLocale), so it can never ask in English. */
function languageOffer() {
  if (getPref('languageOffered') || currentLocale() !== BASE_LOCALE) return null;
  const nav = globalThis.navigator;
  const code = localeForBrowser(nav?.languages?.length ? nav.languages : [nav?.language], (c) => availableLocales().some((l) => l.code === c));
  if (!code || !localeTable(code, 'Port_Strings')?.has('lang.offer')) return null;
  const card = el('div', 'px-langoffer');
  card.lang = code;
  card.append(el('div', 'px-langoffer-q', tIn(code, 'lang.offer', 'Play in English?')));
  if (localeInfo(code)?.source === 'machine') card.append(el('div', 'px-langoffer-note', tIn(code, 'lang.offer.machine', 'This translation is machine-made and still being checked.')));
  card.append(acts([
    { label: tIn(code, 'lang.offer.yes', 'Yes'), primary: true, onClick: () => { chooseLanguage(code); } },
    { label: tIn(code, 'lang.offer.no', 'No, keep English'), onClick: () => { setPref('languageOffered', true); render(); } },
  ]));
  return card;
}

/** TOUCH-BUTTONS: a choice among named values, walked with the same two steppers as stepRow (wrapping - a list, not
 *  a range). `choices` is [id, label] in order; the store holds the id. */
function slotChoiceRow(key, name, note, choices, current) {
  const row = el('div', 'row');
  row.dataset.opt = key; row.dataset.pref = key;   // ORG2
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
  row.dataset.opt = 'hudScale'; row.dataset.pref = 'hudScale';   // ORG2
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', t('menu.hud.scale', 'Gameplay HUD scale')), el('div', 'row-note', t('menu.hud.scaleNote', 'Compass, bars and effect icons.')));
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

/** FIELD BUGS 2026-10-09e MAP-SCALE ("Desktop client in-game map icons and text too small on high resolutions"): the
 *  held map's interface scale, on the prefs shelf (uiPrefs.mapScale) - Auto (the screen's height over 1080) or a fixed
 *  scale, stepped through MAP_SCALE_CHOICES (ui/map/mapScale.js). An open map takes it on its next frame. */
function mapScaleRow() {
  const row = el('div', 'row');
  row.dataset.opt = 'mapScale'; row.dataset.pref = 'mapScale';   // ORG2
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', 'Map text and icons'), el('div', 'row-note', 'The world, town and dungeon maps. Auto grows them on screens taller than 1080p.'));
  row.append(main);
  const ctl = el('div', 'ctl');
  const h = () => globalThis.innerHeight || 0;
  const val = el('span', 'val', mapScaleLabel(getPref('mapScale'), h()));
  const step = (dir, label) => {
    const b = el('button', 'step', label);
    b.onclick = () => {
      const next = nextMapScale(getPref('mapScale'), dir);
      setPref('mapScale', next);
      val.textContent = mapScaleLabel(next, h());
    };
    return b;
  };
  ctl.append(step(-1, '\u2039'), val, step(1, '\u203a'));
  row.append(ctl);
  return row;
}

/** HUD-MOVE: LOCK UI and RESET UI. Locked (the default) the HUD stands still and takes no pointer; unlocked, every
 *  piece - the vitals, the hotbar, the chat, the compass, the Overworld's panel and the rest - is outlined in play and
 *  moves with a drag of the freed mouse. Reset puts every piece back where the game stands it. */
function hudLayoutRows() {
  const lockRow = el('div', 'row');
  lockRow.dataset.opt = 'hudLock';   // ORG2
  const main = el('button', 'row-main');
  const locked = hudLocked();
  main.append(el('div', 'row-name', t('menu.hud.lock', 'Lock UI')), el('div', 'row-note', locked
    ? t('menu.hud.lockOn', 'Turn off (or press Alt+U) to move HUD pieces.')
    : t('menu.hud.lockOff', 'In play, drag a piece to move it; double-click to put it back.')));
  const flip = () => { setHudLocked(!hudLocked()); render(); };
  main.onclick = flip;
  lockRow.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', `act rowact${locked ? ' primary' : ''}`, locked ? t('menu.toggle.on', 'On') : t('menu.toggle.off', 'Off'));
  b.setAttribute('aria-pressed', String(locked));
  b.onclick = flip;
  ctl.append(b, el('span', 'tier live'));
  lockRow.append(ctl);

  // the three bars: moved as one piece, or each on its own
  const barsRow = el('div', 'row');
  barsRow.dataset.opt = 'hudBars';   // ORG2
  const bmain = el('button', 'row-main');
  const split = hudBarsSplit();
  bmain.append(el('div', 'row-name', t('menu.hud.splitBars', 'Move bars separately')), el('div', 'row-note', split
    ? t('menu.hud.splitBarsOn', 'Each bar moves on its own.')
    : t('menu.hud.splitBarsOff', 'The three bars move as one.')));
  const bflip = () => { setHudBarsSplit(!hudBarsSplit()); render(); };
  bmain.onclick = bflip;
  barsRow.append(bmain);
  const bctl = el('div', 'ctl');
  const bb = el('button', `act rowact${split ? ' primary' : ''}`, split ? t('menu.toggle.on', 'On') : t('menu.toggle.off', 'Off'));
  bb.setAttribute('aria-pressed', String(split));
  bb.onclick = bflip;
  bctl.append(bb, el('span', 'tier live'));
  barsRow.append(bctl);

  const resetRow = el('div', 'row');
  resetRow.dataset.opt = 'hudReset';   // ORG2
  const rmain = el('div', 'row-main');
  rmain.append(el('div', 'row-name', t('menu.hud.reset', 'Reset UI')), el('div', 'row-note', t('menu.hud.resetNote', 'Puts every HUD piece you moved back in its usual place.')));
  resetRow.append(rmain);
  const rctl = el('div', 'ctl');
  const rb = el('button', 'act rowact', t('menu.hud.resetGo', 'Reset'));
  rb.onclick = () => { resetHudLayout(); rb.textContent = t('menu.hud.resetDone', 'Done'); setTimeout(() => { rb.textContent = t('menu.hud.resetGo', 'Reset'); }, 1200); };
  rctl.append(rb, el('span', 'tier live'));
  resetRow.append(rctl);
  return [lockRow, barsRow, resetRow];
}

/** EE13: the outdoors test door - a season, a weather, a random town.
 *  A TEST door, not a setting: it navigates and stores nothing. */
function outdoorsTestRow() {
  const test = el('div', 'row');
  const testMain = el('div', 'row-main');
  testMain.append(el('div', 'row-name', t('menu.test.outdoorsName', 'Test the outdoors')));
  testMain.append(el('div', 'row-note', t('menu.test.outdoorsNote', 'Pick a season and a weather, and drop into a random town. A test door: it stores nothing, and it names the town in the console.')));
  const testCtl = el('div', 'ctl');
  const seasonSel = el('select', 'act');
  // Daggerfall has three ARCHIVE seasons (winter, rain, summer),
  // and the field has a CALENDAR. A season here is both: the archive
  // the world dresses in; the day is sent for any test that wants it.
  const SEASONS = [['winter', 'winter', 0], ['spring', 'rain', 90], ['summer', 'summer', 180], ['fall', 'summer', 300]];
  // L10N4: what the two lists SAY; each option's value stays the id the world's door reads
  const SEASON_TEXT = { winter: () => t('menu.test.season.winter', 'winter'), spring: () => t('menu.test.season.spring', 'spring'), summer: () => t('menu.test.season.summer', 'summer'), fall: () => t('menu.test.season.fall', 'fall') };
  const WEATHER_TEXT = { sunny: () => t('menu.test.weather.sunny', 'sunny'), cloudy: () => t('menu.test.weather.cloudy', 'cloudy'), overcast: () => t('menu.test.weather.overcast', 'overcast'), fog: () => t('menu.test.weather.fog', 'fog'), rain: () => t('menu.test.weather.rain', 'rain'), thunder: () => t('menu.test.weather.thunder', 'thunder'), snow: () => t('menu.test.weather.snow', 'snow') };
  for (const [label, , day] of SEASONS) { const o = el('option', '', SEASON_TEXT[label]()); o.value = String(day); seasonSel.append(o); }
  const weatherSel = el('select', 'act');
  for (const wn of ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow']) { const o = el('option', '', WEATHER_TEXT[wn]()); o.value = wn; weatherSel.append(o); }
  const go = el('button', 'act primary', t('menu.test.spawn', 'Spawn'));
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


/** MIDI-OUT1 (2026-10-11, a player asking for MIDI out): THE AUDIO TAB'S PORT ROW - the music on a MIDI device
 *  (systems/midiOut.js). The button names the device; a click steps to the next one connected, then Off. The first
 *  click is the one that asks the browser for MIDI, so nothing is asked of a player who never touches the row. */
export const MIDI_OUT_NAME = 'MIDI out';
export const MIDI_OUT_NOTE = 'Play the music on a MIDI synth or device.';
export const MIDI_OUT_NONE = 'This browser has no MIDI.';
export const MIDI_OUT_DENIED = 'MIDI is blocked for this site.';
export const MIDI_OUT_EMPTY = 'No MIDI device connected.';
export const MIDI_OUT_AWAY = 'Not connected. The game’s own synthesizer plays.';
let midiOutList = null;   // the outputs as last asked - null until the row's first click
function portRowsAudio() {
  const can = midiOutSupported();
  const cur = midiOutName();
  const note = !can ? MIDI_OUT_NONE
    : midiOutDenied() ? MIDI_OUT_DENIED
    : midiOutList && !midiOutList.length ? MIDI_OUT_EMPTY
    : cur && midiOutList && !midiOutList.some((o) => o.name === cur) ? MIDI_OUT_AWAY
    : MIDI_OUT_NOTE;
  const row = el('div', 'row');
  row.dataset.opt = 'midiOut'; row.dataset.pref = 'midiOut';   // ORG2
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', MIDI_OUT_NAME));
  main.append(el('div', 'row-note', note));
  const step = async () => {
    if (!can) return;
    midiOutList = await midiOutputs();
    setMidiOut(nextMidiOut(midiOutName(), midiOutList));
    render();
  };
  main.onclick = step;
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act rowact', cur || 'Off');
  b.onclick = step;
  if (!can) b.disabled = true;
  ctl.append(b, el('span', `tier ${can ? 'live' : 'unavailable'}`));
  row.append(ctl);
  return [row, monsterVolumeRow(), companionVolumeRow()];
}

/** MONSTER-VOL (2026-10-20, the owner: "add an option under audio for it called Monster Volume with 0 - 100%"): the
 *  Audio tab's Volume row for what monsters say - calls, attack sounds, pain cries (systems/monsterVolume.js). */
export const MONSTER_VOLUME_NAME = 'Monster Volume';
function monsterVolumeRow() {
  return volumeRow('monsterVolume', t('menu.audio.monsterVolume', MONSTER_VOLUME_NAME),
    t('menu.audio.monsterVolumeNote', 'How loud monsters call, strike and cry out.'));
}
/** COMPANION-VOL (2026-10-23, the owner: "add companion moaning random screaming in idle volume option"): the Audio tab's
 *  Volume row for a companion's idle calls - the moans and cries a crew hand or a sworn one gives out while it walks with
 *  you (systems/monsterVolume.js companionVolume), under Monster Volume and drawn as it is, so Enhanced Plus and the DFO
 *  Grimoire dress paint it as every Volume row. */
export const COMPANION_VOLUME_NAME = 'Companion Idle Volume';
function companionVolumeRow() {
  return volumeRow('companionVolume', t('menu.audio.companionVolume', COMPANION_VOLUME_NAME),
    t('menu.audio.companionVolumeNote', 'How loud companions moan and cry out while they idle, yours and other players\' alike. 0% silences them.'));   // AUDIT UPDATE E-N6: every companion's idle call - a peer's puppet carries `companion` too
}
/** MONSTER-VOL's row, for any 0..1 volume on the shelf (`key`): its name, `note` its title. */
function volumeRow(key, name, note) {
  // drawn as Sound Volume and Music Volume are (settingRow's number arm): the name alone, then the value and its two
  // arrows - 5% a press, 20% with Shift - and the row's tier
  const row = el('div', 'row');
  row.dataset.opt = key; row.dataset.pref = key;   // ORG2
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', name));
  main.title = note;
  row.append(main);
  const ctl = el('div', 'ctl');
  const cur = () => { const v = Number(getPref(key)); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; };
  const pct = (v) => `${Math.round(v * 100)}%`;
  const val = el('span', 'val', pct(cur()));
  ctl.append(val);
  for (const [dir, glyph] of [[-1, '\u2039'], [1, '\u203a']]) {
    const b = el('button', 'step', glyph);
    b.setAttribute('aria-label', dir < 0 ? t('menu.settings.less', 'less {name}', { name }) : t('menu.settings.more', 'more {name}', { name }));
    b.onclick = (e) => {
      const next = Math.round(Math.max(0, Math.min(1, cur() + dir * (e.shiftKey ? 0.2 : 0.05))) * 100) / 100;
      setPref(key, next);
      val.textContent = pct(next);
    };
    ctl.append(b);
  }
  ctl.append(el('span', 'tier live'));
  row.append(ctl);
  return row;
}

/** The CONTROLS category's port rows: the touch layer's knobs, only
 *  where the device reports touch (TI2). */
function portRowsControls() {
  const out = [];
  // PAD-CURSOR: a controller's, on every device and both skins - the touch knobs below stay a finger's device's
  out.push(prefRow('padCursorAssist', 'Controller cursor assist',
    'Eases the controller\u2019s menu cursor onto buttons.'));
  if (!isTouchDevice()) return out;
  const times = (v) => `${v.toFixed(2)}\u00d7`;
  out.push(stepRow('touchLookSensitivity', t('menu.touch.look', 'Look sensitivity'),
    t('menu.touch.lookNote', 'How far a drag turns the camera.'),
    { min: 0.25, max: 4, step: 0.25, fmt: times }));
  out.push(prefRow('touchAnalogStick', t('menu.touch.analog', 'Analog stick'),
    t('menu.touch.analogNote', 'Push farther to run. Off: any push is a full step.')));
  // the anchor is a two-way choice, not a switch: a row whose button names the OTHER option
  {
    const fixed = getPref('touchStickAnchor') === 'fixed';
    const row = el('div', 'row');
    row.dataset.opt = 'touchStickAnchor'; row.dataset.pref = 'touchStickAnchor';   // ORG2
    const main = el('button', 'row-main');
    main.append(el('div', 'row-name', t('menu.touch.stick', 'Stick position')));
    main.append(el('div', 'row-note', fixed
      ? t('menu.touch.stickFixedNote', 'Bottom-left.')
      : t('menu.touch.stickFloatNote', 'Wherever your thumb lands.')));
    const flip = () => { setPref('touchStickAnchor', fixed ? 'float' : 'fixed'); render(); };
    main.onclick = flip;
    row.append(main);
    const ctl = el('div', 'ctl');
    const b = el('button', 'act rowact', fixed ? t('menu.touch.stickFixed', 'Fixed') : t('menu.touch.stickFloat', 'Floating'));
    b.onclick = flip;
    ctl.append(b, el('span', 'tier live'));
    row.append(ctl);
    out.push(row);
  }
  out.push(prefRow('touchGyroLook', t('menu.touch.gyro', 'Gyro aim'),
    t('menu.touch.gyroNote', 'Tilt the phone to aim.'), {
    // iOS grants motion only from a user gesture - this click is one.
    onChange: (on) => { if (on) { try { globalThis.DeviceMotionEvent?.requestPermission?.()?.catch?.(() => {}); } catch { /* not iOS */ } } },
  }));
  out.push(stepRow('touchGyroSensitivity', t('menu.touch.gyroSensitivity', 'Gyro sensitivity'),
    t('menu.touch.gyroSensitivityNote', 'Degrees of camera per degree of phone.'),
    { min: 0.25, max: 4, step: 0.25, fmt: times }));
  out.push(prefRow('touchHaptics', t('menu.touch.haptics', 'Haptics'),
    t('menu.touch.hapticsNote', 'A short buzz on presses, swings and locks.')));
  // TOUCH-BUTTONS (2026-09-27, Discord: "I haven't been able to remap the android "buttons" on the bottom right of the
  // screen. I would much rather use a button to attack"): the corner's three slots, right to left. Changed here while
  // playing, the corner is re-laid as soon as no finger holds one of its buttons.
  {
    const choices = touchButtonChoices();
    const slotNames = [t('menu.touch.slot1', 'Corner button'), t('menu.touch.slot2', 'Second button'), t('menu.touch.slot3', 'Third button')];
    TOUCH_BUTTON_SLOTS.forEach((slot, i) => {
      out.push(slotChoiceRow(slot, slotNames[i],
        i === 0 ? t('menu.touch.slotNote', 'The bottom-right buttons, from the corner in.') : null,
        choices, () => touchButtonSlots(getPref)[i].id));
    });
  }
  out.push(prefRow('touchFullscreen', t('menu.touch.fullscreen', 'Fullscreen on touch'),
    t('menu.touch.fullscreenNote', 'Fullscreen on the first touch. On iPhone, add the game to the home screen.')));
  return out.filter(Boolean);   // FT13: a pref that lives on the home draws nothing
}

/** The INTERFACE category's port rows: the HUD's size, the FPS counter
 *  and the rest. The interface itself is chosen on the Overhauls page
 *  (MENU-TOGGLE: the Interface Style row is retired). */
function portRowsInterface({ pause = false } = {}) {
  const out = [];
  if (!pause) out.push(languageRow());   // L10N1b: the front door's alone - a running game is the language it booted in
  if (!pause) { const packRow = translationPackRow(); if (packRow) out.push(packRow); }   // L10N3b: and its translation pack
  out.push(hudScaleRow());
  out.push(mapScaleRow());   // MAP-SCALE
  out.push(prefRow('standingAll', 'Every faction\'s standing',
    'Show your reputation with every guild, temple, knightly order, kingdom, coven, vampire clan and Daedric Prince on the character sheet\'s Standing page, including ones you don\'t belong to.'));   // EVERY-STANDING
  if (isEnhanced()) out.push(...hudLayoutRows());   // HUD-MOVE: the Enhanced Plus HUD's own - Classic draws none of it
  // FOEBAR1: the target bar's face is a two-way choice, not a switch - the
  // stick-position row's shape: a row whose button names the OTHER option.
  {
    const blade = getPref('foeBarStyle') === 'blade';
    const row = el('div', 'row');
    row.dataset.opt = 'foeBarStyle'; row.dataset.pref = 'foeBarStyle';   // ORG2
    const main = el('button', 'row-main');
    main.append(el('div', 'row-name', t('menu.hud.foeBar', 'Target bar')));
    main.append(el('div', 'row-note', blade
      ? t('menu.hud.foeBarBladeNote', 'Twin blades under the compass.')
      : t('menu.hud.foeBarBarNote', 'A plain bar under the compass.')));
    const flip = () => { setPref('foeBarStyle', blade ? 'bar' : 'blade'); render(); };
    main.onclick = flip;
    row.append(main);
    const ctl = el('div', 'ctl');
    const b = el('button', 'act rowact', blade ? t('menu.hud.foeBarBlade', 'Blade') : t('menu.hud.foeBarBar', 'Bar'));
    b.onclick = flip;
    ctl.append(b, el('span', 'tier live'));
    row.append(ctl);
    out.push(row);
  }
  out.push(prefRow('showFps', t('menu.hud.fps', 'FPS counter'),
    t('menu.hud.fpsNote', 'Frame rate in the top-right corner.')));
  if (!pause) out.push(prefRow('skipStartVideo', skipStartVideoName(), skipStartVideoNote()));   // UXB1-A: read at launch, so the front door's alone - as the skin's
  out.push(...spireAccessRows());   // EG-G1: Settings > Accessibility lists them (ui/settings/settingsMap.js)
  return out.filter(Boolean);   // FT13
}

/** EG-G1 (bible/11-Multiplayer/Elite-Gates.md section 25.7): THE SPIRE'S ACCESSIBILITY ROWS (ui/eliteGates/egAccess.js) - reduced
 *  motion, the danger palette and a danger fill's light; every device, both skins. AUDIT EG V (c, L7-10): their words in the
 *  player's language, as the rows around them (L10N4). */
function spireAccessRows() {
  const motion = prefRow('reducedMotion', t('menu.spire.motion.name', 'Reduced motion'), t('menu.spire.motion.note', 'Nothing on the HUD pulses, flies or rises. Your system\'s own setting does the same.'));
  const palette = choiceRow('dangerPalette', t('menu.spire.palette.name', 'Danger colors'), t('menu.spire.palette.note', 'The color of a blow\'s edge, of safe ground and of a hazard.'),
    EG_DANGER_PALETTE_KEYS.map((k) => [k, EG_DANGER_PALETTES[k].name]));   // AUDIT EG V (c, L7-10): each its own t() (ui/eliteGates/egAccess.js)
  const fill = choiceRow('telegraphFill', t('menu.spire.fill.name', 'Danger fill'), t('menu.spire.fill.note', 'How brightly a blow\'s ground fills. Its edge stays whole.'),
    [[1, '100%'], [0.85, '85%'], [0.7, '70%'], [0.5, '50%']]);
  for (const [row, key] of [[palette, 'dangerPalette'], [fill, 'telegraphFill']]) if (row?.dataset) { row.dataset.opt = key; row.dataset.pref = key; }   // ORG2: the map finds it by its key
  return [motion, palette, fill];
}

/** UXB1-A (2026-09-25, the UX backlog: '"Skip Start Video" in the options ... Disabled by default, of course.'):
 *  the row's words. The switch is uiPrefs' skipStartVideo, read by main.js at the front door. */
export const SKIP_START_VIDEO_NAME = 'Skip start video';
export const SKIP_START_VIDEO_NOTE = 'Open straight onto the main menu. Applies next launch.';
/** L10N4: the row's words in the player's language (the constants stay the English the pins read). */
export const skipStartVideoName = () => t('menu.skipVideo.name', SKIP_START_VIDEO_NAME);
export const skipStartVideoNote = () => t('menu.skipVideo.note', SKIP_START_VIDEO_NOTE);

/** QREPAIR (2026-09-24, Mac: "Add a quest refresh option to settings" - "Repair active quests"): THE GAME CATEGORY'S
 *  PORT ROW. The repair runs over a game in play, so its door is the PAUSE's settings (the host hands
 *  `hooks.repairQuests`, scenes/quest/questBridge.js repair); on the front door the row is drawn, greyed, and says where it
 *  lives - nothing hidden. The confirm is the one sheet every destructive-looking press here takes (`ask`), and the
 *  repair's own line replaces the row's note until the menu is mounted again. */
let questRepairSaid = null;
export const QUEST_REPAIR_NOTE = 'Restores missing quest people, items, foes and map marks. Progress is kept.';
export const QUEST_REPAIR_AWAY = 'In a game: open Settings from the pause menu.';
export const QUEST_REPAIR_ASK = 'Restores missing quest people, items, foes and map marks. Progress is kept.';
/** L10N4: the repair's words in the player's language (the constants stay the English the pins read). */
const questRepairNote = () => t('menu.questRepair.note', QUEST_REPAIR_NOTE);
const questRepairAway = () => t('menu.questRepair.away', QUEST_REPAIR_AWAY);
const questRepairAsk = () => t('menu.questRepair.ask', QUEST_REPAIR_ASK);
function portRowsGame({ pause = false } = {}) {
  const can = pause && typeof hooks?.repairQuests === 'function';
  const row = el('div', 'row');
  row.dataset.opt = 'questRepair';   // ORG2
  if (!can) row.dataset.live = '0';
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', t('menu.questRepair.name', 'Repair active quests')));
  main.append(el('div', 'row-note', can ? (questRepairSaid ?? questRepairNote()) : questRepairAway()));
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act rowact', t('menu.questRepair.go', 'Repair'));
  if (!can) b.disabled = true;
  b.onclick = () => {
    if (!can) return;
    ask(t('menu.questRepair.title', 'Repair Active Quests'), questRepairAsk(), t('menu.questRepair.go', 'Repair'), () => {
      let r = null;
      try { r = hooks.repairQuests(); } catch { r = null; }
      questRepairSaid = r?.text ?? t('menu.questRepair.failed', 'The repair could not run here.');
    });
  };
  ctl.append(b, el('span', `tier ${can ? 'live' : 'unavailable'}`));
  row.append(ctl);
  return [row, techniqueMotionRow()];
}
/** TECH-FX (bible/05-Combat/Weapon-Techniques.md THE FEEL): how much a weapon technique moves the screen - every device,
 *  both skins; Settings > Accessibility > Motion lists it (ui/settings/settingsMap.js). GATHER-FEEL II: and a gathering tool's
 *  landed blow (systems/gatherBlow.js gatherBlowFeel - the springs' one door), on the enhanced skin. */
function techniqueMotionRow() {
  const row = choiceRow('techniqueMotion', 'Technique camera motion',
    'How much a weapon technique shakes and tilts the view and dips your hands. On the Enhanced skin, it also sets how far your hands dip when you gather.',
    [[1, 'Full'], [0.75, '75%'], [0.5, 'Half'], [0.25, 'Low'], [0, 'Off']]);
  if (row?.dataset) { row.dataset.opt = 'techniqueMotion'; row.dataset.pref = 'techniqueMotion'; }   // ORG2: the map finds it by its key
  return row;
}

/** FPS-VSYNC: a key the desktop shell reads at its next launch does something here too - drawn flat with the live
 *  ones (never at pause, whose rows take effect at once). */
function drawsFlat(key) { const t = tierOf(key); return t === 'live' || t === 'restart'; }

/** The tiers a category folds: SAVED FOR LATER (stored, unread) and
 *  NOT AVAILABLE HERE (fixed by the browser or a port choice). Each is
 *  a collapsible group with a live count in its heading - nothing is
 *  ever hidden, the beginner sees a short list, the veteran opens the
 *  rest with one press. The fold is remembered per category on the
 *  prefs shelf (uiPrefs isOpen/setOpen), which is what the shelf's
 *  `open` map was made for. */
const TIER_GROUPS = Object.freeze([   // L10N4: each group's title and blurb read when drawn, in the player's language
  ['stored', () => t('menu.settings.storedTitle', 'Saved for later'), () => t('menu.settings.storedBlurb', 'Kept in your settings file, but not used yet.')],
  ['unavailable', () => t('menu.settings.unavailableTitle', 'Not available here'), () => t('menu.settings.unavailableBlurb', 'Fixed by the browser or by this game. Each row says what you get instead.')],
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


/** MWA4: what the Morrowind files do, in the card's one line. */
export const MW_CARD_LINE = 'Your Morrowind.bsa and Morrowind.esm draw your character in 3D. They stay in this browser.';
/** L10N4: the card's line in the player's language (MW_CARD_LINE stays the English the pins read). */
export const mwCardLine = () => t('menu.mw.line', MW_CARD_LINE);
/** MWA4: the arms' state in words - the one row the card keeps beside the data count. */
export function morrowindArmsLine(armState) {
  if (armState?.active) return t('menu.toggle.on', 'On');
  const reason = armState?.reason ?? 'not built';
  return reason === 'not built' || reason === 'unloaded' ? t('menu.mw.buildsLater', 'Builds when you play') : reason;   // a refusal says why (MWDIAG)
}
/** MWA4: what did not work, in words - and nothing when everything did. */
export function morrowindTroubleLines(armState) {
  const out = [];
  if (armState?.notes?.length) out.push(t('menu.mw.notInArms', 'Not in the arms: {notes}', { notes: armState.notes.join('; ') }));
  if (armState?.third && !armState.third.ok) out.push(t('menu.mw.thirdRefused', 'Third person refused - {stage}: {error}', { stage: armState.third.stage, error: armState.third.error }));
  const e = armState?.esm;
  if (e && !e.raceIsThere) {
    out.push(e.racesFound.length ? t('menu.mw.noBody', 'Your files carry no "{race}" body (they have: {found}).', { race: e.raceWanted, found: e.racesFound.join(', ') })
      : t('menu.mw.noBodyNone', 'Your files carry no "{race}" body (they have: none).', { race: e.raceWanted }));
  }
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
  mw.append(el('h3', null, t('menu.mw.title', 'Morrowind assets')));
  mw.append(el('p', 'meta', mwCardLine()));
  mw.append(stats([
    [t('menu.mw.data', 'Data'), t('menu.mw.archives', '{n, plural, =0 {none attached} one {# archive attached} other {# archives attached}}', { n: count || 0 })],
    ...(count ? [[t('menu.mw.arms', 'Arms'), morrowindArmsLine(armState)]] : []),
  ]));
  const attach = async () => {
    const ds = await import('../../scenes/dataSource.js');
    const n = await ds.pickMorrowindFiles();
    // A character in play gets the body now (seconds, once); otherwise the next one made or loaded builds it at its
    // door (autoBuildArms). TR2: the opts come from weaponRig's one home.
    if (n > 0 && playerEntity?.chargenDone) {
      const { buildArmsFor } = await import('../../combat/weapon/weaponRig.js');
      await buildArmsFor(playerEntity);
    }
    render();
  };
  const actions = [{ label: t('menu.mw.attach', 'Attach data'), primary: !count, onClick: attach }];
  // MWA2 (2026-09-16): the door that removes the data itself - the one off there is now. Routed through the same
  // confirm-before-destroy pattern as Delete Save.
  if (count) {
    actions.push({ label: t('menu.mw.remove', 'Remove data'), onClick: () => ask(
      t('menu.mw.removeTitle', 'Remove Morrowind data'),
      t('menu.mw.removeBody', 'This clears the Morrowind files from this browser and unloads the arms. You can attach them again later.'),
      t('menu.packs.removeYes', 'Remove'),
      async () => {
        fpArm.unload();
        const ds = await import('../../scenes/dataSource.js');
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
  c.append(el('h3', null, t('menu.peers.title', 'Other players')));
  c.append(el('p', 'meta', t('menu.peers.blurb', 'Players without a Morrowind body show as their chosen sprite, or their class.')));   // DISC23-B: the chosen set first, the class only for a player without one
  c.append(prefRow('peerClassSprites', t('menu.peers.sprite', 'Animated sprite'), t('menu.peers.spriteNote', 'On: the sprite above. Off: the paperdoll.'), { home: true }));
  c.append(prefRow('peerAttackSounds', t('menu.peers.attack', 'Attack sounds'), t('menu.peers.attackNote', 'Hear other players\u2019 weapon swings, and their tools as they gather.'), { home: true }));   // PEER-FS1: the two peer-sound switches, beside the sprite one; PEER-ACTS: a gathering tool's blow is a swing, and the act's other beats its hands' work (net/remotePlayers.js _syncGatherSound)
  c.append(prefRow('peerFootsteps', t('menu.peers.footsteps', 'Footstep sounds'), t('menu.peers.footstepsNote', 'Hear other players\u2019 footsteps.'), { home: true }));
  // PEER-RANGE (2026-10-10, the owner: "the rendering of players far out is contributing to poor performance"): far
  // players, not drawn - the near tier is inside a player's shot (200 m), and the row says so; the row reads the law's own
  // answer, so a stored value that is no tier shows the 300 m it stands for (AUDIT PEER-RANGE A L2)
  c.append(choiceRow('peerRange', t('menu.peers.range', 'Draw distance'),
    t('menu.peers.rangeNote', 'How far away other players are drawn. Your party and your duel opponent always show. Shorter runs faster, but 150 m can hide an archer.'),
    PEER_RANGE_TIERS.map((m) => [m, m ? t('menu.peers.metres', '{m} m', { m }) : t('menu.peers.everyone', 'Everyone')]), { home: true, read: () => peerRangeOf(getPref('peerRange')) }));
  // YARD-RANGE (2026-10-11, a player: "20-40 fps in cities"): how far their yards' decorations are drawn - none, nearer, or
  // as far as ever; one's own yard always (scenes/homeYards.js)
  c.append(choiceRow('yardRange', t('menu.peers.yards', 'Yard decorations'),
    t('menu.peers.yardsNote', 'How far away other players\u2019 yard decorations are drawn. Your own yard always shows. Nearer is faster in busy towns.'),
    YARD_RANGE_TIERS.map((m) => [m, m ? t('menu.peers.metres', '{m} m', { m }) : t('menu.toggle.off', 'Off')]), { home: true, read: () => yardRangeOf(getPref('yardRange')) }));
  // GATE-CROWD (2026-10-07, Mac: "some type of filter when there are too many people"): a crowd, thinned - CROWD-WIDE
  // (2026-10-23, the owner: "into the entire game"): everywhere, not the Burning Court alone, but never where a stranger can
  // fight you; AUDIT CROWD-WIDE D1: the note says what the count does - the Draw distance row above still hides the far
  c.append(choiceRow('gateCrowd', t('menu.peers.crowd', 'Players shown at once'),
    t('menu.peers.crowdNote', 'How many other players are drawn at once, the nearest first. Your party, your duel opponent and anyone you trade, ride or sail with always show. The count is off in a PvP zone, a siege, a Royal Tourney and the Arena, but not in the Burning Court.'),
    GATE_CROWD_TIERS.map((n) => [n, n ? t('menu.peers.nearest', 'Nearest {n}', { n }) : t('menu.peers.everyone', 'Everyone')]), { home: true }));
  // SPELL-GIFT (2026-09-27, Tabitha: "Allow casting of buffs on players outside party"): the receiver's say
  c.append(prefRow('acceptStrangerSpells', t('menu.peers.spells', 'Spells from strangers'),
    t('menu.peers.spellsNote', 'Let players outside your party cast healing and protective spells on you.'), { home: true }));
  // REST-OPT (2026-09-27, Tabitha: "Allow party members to choose not to rest with their party")
  c.append(prefRow('restWithParty', t('menu.peers.rest', 'Rest with my party'),
    t('menu.peers.restNote', 'Sleep when a party member within 15 m sleeps at a fire, a tent or a bed.'), { home: true }));   // AUDIT REST: REST5's night, no vote
  // TV3 (2026-09-28, bible/06-Systems/Travel-View.md): being SEEN - the region's travellers see where you are
  c.append(prefRow('showToTravellers', t('menu.peers.show', 'Show me to travelers in my region'),
    t('menu.peers.showNote', 'Outdoors, players in your region see you on the overworld and the map. '
    + 'Nothing is shared from indoors except with your party. Kept on this device.'), { home: true }));   // AUDIT DEEP2 C5: the party pose rides from indoors too
  // CHAT-LANG, CHAT-COLOURS, PING1 (2026-10-11, the players: "More chat channels per-language", "Chat color-coding per
  // channel", "A unique color or alert for @name pings"): the chat's own three, beside the other players'
  c.append(el('h3', null, t('menu.chat.title', 'Chat')));
  c.append(choiceRow('chatLang', t('menu.chat.lang', 'Language channel'),
    t('menu.chat.langNote', 'A chat tab for players who speak your language, wherever they are. /lang in the chat chooses it too.'),
    [['', t('menu.toggle.off', 'Off')], ...Object.entries(CHAT_LANGS).map(([code, name]) => [code, name])], { home: true }));
  // CHAT-TRADE (2026-10-14, Mac: "New channels: Trading, LFG"): the two channels a player joins, beside the language's
  c.append(prefRow('chatTrade', t('menu.chat.trade', 'Trade channel'),
    t('menu.chat.tradeNote', 'A chat tab for buying, selling and swapping with players anywhere. /join trade in the chat joins it too.'), { home: true }));
  c.append(prefRow('chatLfg', t('menu.chat.lfg', 'LFG channel'),
    t('menu.chat.lfgNote', 'A chat tab for finding a group, or one more for yours. /join lfg in the chat joins it too.'), { home: true }));
  c.append(prefRow('chatChannelColours', t('menu.chat.colours', 'Chat colors by channel'),
    t('menu.chat.coloursNote', 'World white, Region green, Guild purple, Local gray, Party teal, Language rose, Trade gold, LFG blue.'), { home: true }));
  c.append(prefRow('chatPingSound', t('menu.chat.ping', 'Chime when someone @mentions you'),
    t('menu.chat.pingNote', 'A line with @YourName is always marked in gold; this adds a chime.'), { home: true }));
  return c;
}

/** AUDIT VE R2: THE TEXTURE STORE, READ BEFORE A CARD READS THE TEXTURE-MOD DOOR. The enhanced main menu runs before
 *  any host boots, and the store's mods register at a host's boot - so the Texture Overhaul card and the packs card read
 *  a door holding the shipped mods alone. The first pane that reads the door begins the page's registration
 *  (dataSource.js textureStoreRegistered), and the menu is drawn again when it lands. */
let _storeWait = null;
function waitForTextureStore() {
  if (textureStoreSettled() || _storeWait) return;
  _storeWait = textureStoreRegistered().catch(() => 0).finally(() => { _storeWait = null; render(); });
}

/** M-EXT: the replacement packs - music and textures - attach here.
 *  The launcher's row was the only door; FD1 removed the launcher.
 *  DFMOD1: and every pack comes OFF here too - each has a Remove beside its Attach once something is attached,
 *  behind the same confirm Delete Save uses - and Daggerfall Unity .dfmod texture mods (DREAM and its kin) attach
 *  as files, each listed with its own Remove. */
function packsCard() {
  waitForTextureStore();   // AUDIT VE R2: the attached mods registered before they are listed - a host may not have yet
  installVanillaEnhancedPack();   // VE4: the shipped mods are listed even before a host has registered the store
  const c = el('div', 'card');
  c.append(el('h3', null, t('menu.packs.title', 'Replacement packs')));
  c.append(el('p', 'meta', t('menu.packs.blurb', 'Your own music, sounds and texture packs (.dfmod), kept in this browser.')));
  let mods = attachedDfmods();
  const attached = mods.filter((m) => !m.shipped);   // VE4: what the player attached - the shipped mods are never removed
  const builtIn = mods.length - attached.length;
  c.append(el('p', 'meta', t('menu.packs.supplied', 'Music files supplied: {music} \u00b7 Texture files supplied: {textures} \u00b7 Sound files supplied: {sounds}', { music: replacementCount(), textures: textureReplacementCount(), sounds: soundReplacementCount() })));   // the row reports what the pick covers
  c.append(stats([
    [t('menu.packs.textureMods', 'Texture mods'), attached.length || builtIn
      ? (builtIn
        ? t('menu.packs.textureModsBuiltIn', '{n} attached \u00b7 {builtIn} built in \u00b7 {inUse} textures in use', { n: attached.length, builtIn, inUse: bundleTextureCount() })
        : t('menu.packs.textureModsAttached', '{n} attached \u00b7 {inUse} textures in use', { n: attached.length, inUse: bundleTextureCount() }))
      : t('menu.packs.none', 'none')],
  ]));
  /** A removal behind the confirm; a storage failure is logged and costs nothing else. */
  const remove = (label, title, body, run) => ({ label, onClick: () => ask(title, body, t('menu.packs.removeYes', 'Remove'), async () => {
    try { await run(await import('../../scenes/dataSource.js')); } catch (err) { console.warn(`[packs] ${title.toLowerCase()} failed: ${err?.message ?? err}`); }
    render();
  }) });
  // L10N4: "It takes full effect the next time an area loads." closes two of the sentences below - each its own whole pattern
  c.append(acts([
    { label: t('menu.packs.attachMusic', 'Attach music pack'), onClick: async () => { const ds = await import('../../scenes/dataSource.js'); await ds.pickMusicFolder(); render(); } },
    ...(replacementCount() > 0 ? [remove(t('menu.packs.removeMusic', 'Remove music pack'), t('menu.packs.removeMusic', 'Remove music pack'), t('menu.packs.removeMusicBody', 'This clears your music files from this browser; the original game\u2019s own songs play again. A sound pack stays.'), (d) => d.clearStoredMusic())] : []),
    { label: t('menu.packs.attachSound', 'Attach sound pack'), onClick: async () => { const ds = await import('../../scenes/dataSource.js'); await ds.pickSoundFolder(); render(); } },   // SNDREP1
    ...(soundReplacementCount() > 0 ? [remove(t('menu.packs.removeSound', 'Remove sound pack'), t('menu.packs.removeSound', 'Remove sound pack'), t('menu.packs.removeSoundBody', 'This clears your sound files from this browser; the original game\u2019s own sounds play again. A music pack stays.'), (d) => d.clearStoredSounds())] : []),
    { label: t('menu.packs.attachTexture', 'Attach texture pack'), onClick: async () => { const ds = await import('../../scenes/dataSource.js'); await ds.pickTextureFolder(); render(); } },
    ...(textureReplacementCount() > 0 ? [remove(t('menu.packs.removeTexture', 'Remove texture pack'), t('menu.packs.removeTexture', 'Remove texture pack'), t('menu.packs.removeTextureBody', 'This clears the texture folder you picked from this browser. Attached .dfmod texture mods stay. It takes full effect the next time an area loads.'), (d) => d.clearStoredTexturePack())] : []),
  ]));
  // IIL3 (Mac: "add a button for attach lighting mod, so players arent confused"): THE LIGHTING MOD HAS ITS OWN
  // SECTION. It is a .dfmod like the texture mods and rides the same store, but it carries no picture - listed among
  // them it read as a texture pack that did nothing. Here it says what it is, whether it is attached, and where it
  // is switched (the Modded lighting row in Features).
  const lighting = mods.filter(isIilMod);
  mods = mods.filter((m) => !isIilMod(m));
  c.append(el('h3', null, t('menu.packs.lighting', 'Lighting mod')));
  c.append(el('p', 'meta', t('menu.packs.lightingBlurb', 'Improved Interior Lighting: warm lights in buildings and dungeons. Pick its .dfmod, then turn it on in {path}.', { path: optionPath('feat:modded-lighting') })));   // ORG2
  for (const m of lighting) {
    const row = el('div', 'card');
    row.append(el('p', null, `${m.title}${m.version ? ` ${m.version}` : ''}${m.author ? ` \u00b7 ${m.author}` : ''}`));
    row.append(el('p', 'meta', m.error ? t('menu.packs.notWorking', 'Not working: {error}.', { error: m.error }) : t('menu.packs.attached', 'Attached.')));
    row.append(acts([remove(t('menu.packs.removeYes', 'Remove'), t('menu.packs.removeMod', 'Remove {mod}', { mod: m.title }), t('menu.packs.removeLightingBody', 'This clears {mod} from this browser; the lighting goes back to what it was.', { mod: m.title }), (d) => d.removeStoredDfmod(m.key))]));
    c.append(row);
  }
  if (!lighting.length) c.append(acts([{ label: t('menu.packs.attachLighting', 'Attach lighting mod'), primary: true, onClick: async () => { const ds = await import('../../scenes/dataSource.js'); await ds.pickLightingModFiles(); render(); } }]));
  // DFMOD1: the texture mods, one row each
  c.append(el('h3', null, t('menu.packs.dfmods', 'Texture mods (.dfmod)')));
  // DFMOD2: two mods that dress the same things (DREAM and DREAM 90s side by side) cost memory twice for one picture
  const sameTitle = (t) => String(t ?? '').replace(/\b90s\b/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const seen = new Map();
  for (const m of mods) { const k = sameTitle(m.title); seen.set(k, (seen.get(k) ?? 0) + 1); }
  if ([...seen.values()].some((n) => n > 1)) c.append(el('p', 'meta', t('menu.packs.twoVersions', 'Two versions of the same mod are attached (for example DREAM and DREAM 90s). Only one shows for each texture, but both use memory. Remove one.')));
  c.append(el('p', 'meta', t('menu.packs.dfmodsBlurb', 'Daggerfall Unity texture mods, such as DREAM. Pick one or more .dfmod files. Mod scripts don\u2019t run. Vanilla Enhanced comes with the game, and a copy you attach is used instead of the built-in one.')));
  // VE1: listed in load order - a mod loads after the mods it depends on, and where two carry the same texture the one
  // loaded later is drawn (DFU's ModManager)
  if (mods.length > 1) c.append(el('p', 'meta', t('menu.packs.loadOrder', 'In load order: where two mods carry the same texture, the later one is drawn. A mod always loads after the mods it is built on.')));
  if (!textureStoreSettled()) c.append(el('p', 'meta', t('menu.packs.reading', 'Reading your attached texture mods\u2026')));   // AUDIT VE R2
  for (const m of mods) {
    const row = el('div', 'card');
    row.append(el('p', null, `${m.title}${m.version ? ` ${m.version}` : ''}${m.author ? ` \u00b7 ${m.author}` : ''}`));
    row.append(el('p', 'meta', m.shipped
      ? (m.enabled ? t('menu.packs.shipped', 'Ships with the game \u00b7 {n} textures', { n: m.textures }) : t('menu.packs.shippedOff', 'Ships with the game \u00b7 {n} textures \u00b7 switched off', { n: m.textures }))
      : (m.enabled ? t('menu.packs.inBundle', '{n} textures in the bundle', { n: m.textures }) : t('menu.packs.inBundleOff', '{n} textures in the bundle \u00b7 switched off', { n: m.textures }))));
    if (m.error) row.append(el('p', 'meta', t('menu.packs.notWorking', 'Not working: {error}.', { error: m.error })));   // DFMOD2: said where the Remove is
    row.append(acts([
      // VE3: DFU's mod window switches a mod off without removing it (Mod.Enabled); the Texture Overhaul card does the same
      { label: m.enabled ? t('menu.packs.switchOff', 'Switch off') : t('menu.packs.switchOn', 'Switch on'), onClick: () => { setDfmodEnabled(m.key, !m.enabled); render(); } },
      // VE4: a shipped mod is switched, never removed - it is not in this browser's store
      ...(m.shipped ? [] : [remove(t('menu.packs.removeYes', 'Remove'), t('menu.packs.removeMod', 'Remove {mod}', { mod: m.title }), t('menu.packs.removeModBody', 'This clears {mod} from this browser. It takes full effect the next time an area loads.', { mod: m.title }), (d) => d.removeStoredDfmod(m.key))]),
    ]));
    c.append(row);
  }
  // AUDIT VE R5/R11: a stored mod that did not register - still being read, one that will not read, or the page opened
  // with ?nomods - is listed with why, and its Remove: it was listed nowhere, so a mod that would not read could not go
  for (const u of unregisteredDfmods()) {
    const row = el('div', 'card');
    row.append(el('p', null, u.fileName));
    row.append(el('p', 'meta', u.state === 'indexing' ? t('menu.packs.indexing', 'Reading. It joins the load order when done.')
      : u.state === 'nomods' ? t('menu.packs.nomods', 'Not loaded: this page was opened with ?nomods.') : t('menu.packs.notWorking', 'Not working: {error}.', { error: u.error })));
    row.append(acts([remove(t('menu.packs.removeYes', 'Remove'), t('menu.packs.removeMod', 'Remove {mod}', { mod: u.fileName }), t('menu.packs.removeModBody', 'This clears {mod} from this browser. It takes full effect the next time an area loads.', { mod: u.fileName }), (d) => d.removeStoredDfmod(u.key))]));
    c.append(row);
  }
  // DFMOD2: TEXTURE DETAIL - the longest side a mod's picture is decoded at (a smaller mip past it). Full-resolution
  // packs (DREAM's HD set) are gigabytes of pixels; 512 keeps them several times Daggerfall's own and inside memory
  const cap = dfmodMaxSize();
  const detailLabel = Number.isFinite(cap) ? t('menu.packs.detailPx', '{px} px', { px: cap }) : t('menu.packs.detailFull', 'full');
  const nextDetail = () => { const i = DFMOD_DETAIL.indexOf(Number.isFinite(cap) ? cap : 0); return DFMOD_DETAIL[(i + 1) % DFMOD_DETAIL.length]; };
  c.append(el('p', 'meta', t('menu.packs.detailNote', 'Texture detail: {detail}. Higher is sharper but uses more memory and loads slower. \u201cfull\u201d can run out of memory with HD packs. Applies to areas loaded afterwards.', { detail: detailLabel })));
  c.append(acts([
    { label: t('menu.packs.detail', 'Texture detail: {detail}', { detail: detailLabel }), onClick: () => { setPref('dfmodTextureDetail', nextDetail()); render(); } },
    { label: t('menu.packs.addDfmods', 'Add texture mods'), primary: !mods.some((m) => !m.shipped), onClick: async () => { const ds = await import('../../scenes/dataSource.js'); await ds.pickDfmodFiles(); render(); } },
    ...(mods.filter((m) => !m.shipped).length + unregisteredDfmods().length > 1 ? [remove(t('menu.packs.removeAllDfmods', 'Remove all texture mods'), t('menu.packs.removeAllDfmods', 'Remove all texture mods'), t('menu.packs.removeAllDfmodsBody', 'This clears every attached .dfmod texture mod from this browser; the built-in ones stay. It takes full effect the next time an area loads.'), (d) => d.clearStoredDfmods())] : []),
  ]));
  return c;
}

/** SNDREP1: the two night sounds a player may want gone - on by default, as Daggerfall has them. Off silences the
 *  sound whether it is the classic one or a sound pack's replacement. */
function nightSoundsCard() {
  const c = el('div', 'card');
  c.append(el('h3', null, t('menu.night.title', 'Night sounds')));
  c.append(prefRow('nightCrickets', t('menu.night.crickets', 'Crickets'), t('menu.night.cricketsNote', 'Outdoors on clear nights.'), { home: true }));
  c.append(prefRow('distantHowl', t('menu.night.howl', 'Distant howl'), t('menu.night.howlNote', 'Near graveyards.'), { home: true }));
  return c;
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
      b.textContent = t('mods.pane.pressKey', 'press a key');   // L10N4: the Mods pane's own words
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
    clear.title = t('mods.pane.clearKey', 'Clear this key');
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
    const b = el('button', 'act rowact', on ? t('menu.toggle.on', 'On') : t('menu.toggle.off', 'Off'));
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
        set: (i) => { (c.write ?? ((v) => setPref(c.key, v)))(c.tiers[i][0]); TILE_AFTER[c.key]?.(); } };   // MW-STEEL1: a choice's after-step too (the Steel Helm)
    }
    return { labels: ['Off', 'On'], shown: toggleWords(), at: getPref(c.key) ? 1 : 0, locked,
      set: (i) => { setPref(c.key, i === 1); TILE_AFTER[c.key]?.(); } };
  }
  if (c.store === 'settings') {
    const [sec, k] = c.key.split('/');
    const raw = effective()[sec]?.[k];
    const w = widgetFor(c.key);
    if (w === 'switch') {
      return { labels: ['Off', 'On'], shown: toggleWords(), at: raw === 'True' ? 1 : 0, locked: false,
        set: (i) => write(c.key, i === 1 ? 'True' : 'False') };
    }
    if (w === 'enum' && ENUM_LAW[c.key]?.encode === 'index') {
      const vals = ENUM_LAW[c.key].values;
      const i = parseInt(raw, 10);
      // L10N3d: `labels` stay the law's words (All off and the switch reading find Off by them); the bar SHOWS DFU's
      // words for them in the player's language (enumWords, DaggerfallAdvancedSettingsWindow.cs:248)
      return { labels: vals, shown: enumWords(c.key), at: Number.isInteger(i) && i >= 0 && i < vals.length ? i : 0, locked: false,
        set: (n) => write(c.key, String(n)) };
    }
    return null;
  }
  // a vendored mod's Enabled - the player's online too (MODS-ONLINE-2), but for the road switches the room's ground depends on
  const on = modSetting(c.vendor, c.key) === true || modSetting(c.vendor, c.key) === 'True';
  return { labels: ['Off', 'On'], shown: toggleWords(), at: on ? 1 : 0,
    locked: onlineForcedModSetting(c.vendor, c.key) !== undefined,
    set: (i) => setModSetting(c.vendor, c.key, i === 1) };
}
/** L10N4: what a two-state bar SHOWS for its law's ['Off', 'On'] - the labels stay the law's words (All off, the
 *  switch reading and Restore find Off by them), the shown words are the player's language. */
const toggleWords = () => [t('menu.toggle.off', 'Off'), t('menu.toggle.on', 'On')];

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
const rebuildMorrowindBody = async () => {
  if (!morrowindDataCount() || !playerEntity?.chargenDone) return;   // MWA4: attached is on - a character in play wears it
  const { buildArmsFor } = await import('../../combat/weapon/weaponRig.js');
  await buildArmsFor(playerEntity);
  render();
};
const TILE_AFTER = Object.freeze({
  mwSheathing: rebuildMorrowindBody,
  mwSteelHelm: rebuildMorrowindBody,   // MW-STEEL1: the steel helm's style, closed or open, on the standing body at once
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
    const b = el('button', `ft-segb${i === r.off ? ' off' : ''}`, st.shown?.[i] ?? L);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(i === st.at));
    if (st.locked) {
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
      b.title = noteText(ONLINE_LOCK_NOTE);
    } else {
      b.onclick = (e) => { e.stopPropagation(); st.set(i); render(); };
    }
    seg.append(b);
  });
  return seg;
}

/** FT14: which row has its drawer open. It survives a `render()`, so pressing a segment does not close the drawer you
 *  pressed it in. (ORG2: which row the help pane reads is `pickedFeature`.) */
let featureOpen = null;

/** FT14: one feature. ORG2: AS A ROW of the one Settings screen - its name and labels on the left (a press picks it for
 *  the help pane, which carries its words), its bar on the right, and its drawer beneath. (Exported for
 *  DISC23-C's pins, which press its bar against a fake document.) */
export function featureTile(f) {
  const c = resolveControl(f);
  const st = tileStates(f);
  const tile = el('div', `ft-tile${pickedFeature === f.id ? ' sel' : ''}`);
  tile.id = `opt-${f.id}`;   // ORG2: the mods' list brings a row into view by it
  tile.dataset.fid = f.id;   // FT18: the search hides tiles by it
  tile.dataset.on = st && barReading(st).on ? '1' : '0';
  if (st?.locked) tile.dataset.locked = '1';

  const main = el('button', 'ft-tile-main');
  main.type = 'button';
  main.append(el('div', 'ft-tile-name', f.title));
  const meta = el('div', 'ft-tile-meta');
  for (const k of KIND_ORDER) if (f.kinds.includes(k)) meta.append(el('span', `kind ${k}`, KINDS[k].label));
  if (st?.locked) meta.append(el('span', 'ft-tile-lock', t('menu.features.onlineLock', 'online')));
  main.append(meta);
  main.onclick = () => { pickedFeature = f.id; pickedKey = null; sheetOpen = true; render(); };
  tile.append(main);

  // the control, or the row's own builder when it is not a bar
  const ctl = el('div', 'ft-tile-ctl');
  if (st) ctl.append(segBar(st, f.title));
  else ctl.append(featureRow(f));
  tile.append(ctl);

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
        + [mods.length ? t('menu.features.modules', '{n, plural, other {# modules}}', { n: mods.length }) : '', dials.length ? t('menu.features.dials', '{n, plural, other {# dials}}', { n: dials.length }) : '',
          keys.length ? t('menu.features.keys', '{n, plural, other {# keys}}', { n: keys.length }) : '']
          .filter(Boolean).join(' \u00b7 ')));
      b.onclick = (e) => { e.stopPropagation(); featureOpen = open ? null : f.id; render(); };
      tile.append(b);
      if (open) tile.append(featureDrawer(vendor, mods, dials, keys));
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
    tile.append(b);
    if (open) tile.append(featurePartsDrawer(parts));
  }
  return tile;
}

/** UXB1-F (2026-09-25, the UX backlog: "Show keybinds for game features, even if they cannot be changed there (Drop
 *  torch/summon horse/summon cart)"): the tile's door to where its keys ARE changed - Settings, Controls. */
export const FEATURE_KEYS_NOTE = 'Keys are changed in Settings \u203a Controls.';
/** L10N4: the note in the player's language (FEATURE_KEYS_NOTE stays the English the pins read). */
export const featureKeysNote = () => t('menu.features.keysNote', FEATURE_KEYS_NOTE);
function openControls() {
  category = 'controls';
  optQuery = ''; optFilter = 'all';   // ORG2: a search or a filter would hide the bindings it was sent to
  optScrollTo = 'sec-controls-bindings';   // and it lands on them, not the top of the tab
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
      if (onlineForcedPref(pt.key) !== undefined) { b.disabled = true; b.title = noteText(ONLINE_LOCK_NOTE); }
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
export const ALL_OFF_ASK = 'Every mod and enhancement goes to Off. Restore puts back what you had.';
/** L10N4: the confirm's body in the player's language (ALL_OFF_ASK stays the English the pins read). */
export const allOffAsk = () => t('menu.features.allOffAsk', ALL_OFF_ASK);
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

// ── FEATURES-DEFAULTS (issue #399: "An option to put them back as stock values") ──
// All off keeps what you had and Restore brings it back - so a player who had changed things never got the game's own
// values again. Defaults sets every tile to the value the game ships it at (the row's own default, the port's settings
// default over DFU's, a mod's shipped switch), and its drawer with it: a condensed row's parts and a mod's modules and
// dials. A row or key the online room decides is left as the room has it. Asked first: there is no keep to Restore.
// ORG2: its button is the Settings toolbar's "Reset everything to defaults" (RESET_ALL_ASK), DFU's settings with it,
// and each tab's card restores that tab alone (restoreTabDefaults).
/** The segment a tile ships at, or -1 when its default is not one of its segments. */
export function defaultSegment(f, st) {
  const c = resolveControl(f);
  let i = -1;
  if (c.store === 'prefs') {
    const d = c.default ?? c.initial ?? PREF_DEFAULTS[c.key];
    i = c.tiers ? c.tiers.findIndex(([v]) => String(v) === String(d)) : (d ? 1 : 0);
  } else if (c.store === 'settings') {
    const [sec, k] = c.key.split('/');
    const d = defaultOf(sec, k);
    i = widgetFor(c.key) === 'switch' ? (d === 'True' ? 1 : 0) : parseInt(d, 10);
  } else {
    const d = MOD_SETTINGS[c.vendor]?.keys?.[c.key]?.default;
    i = d === true || d === 'True' ? 1 : 0;
  }
  return Number.isInteger(i) && i >= 0 && i < st.labels.length ? i : -1;
}
/** Defaults. Returns how many tiles, parts and mod keys it moved; the All off keep is spent. */
export function featuresDefaults(list = FEATURES, { spendKeep = true } = {}) {
  let n = 0;
  for (const f of list) {
    const st = tileStates(f);
    if (st && !st.locked) {
      const to = defaultSegment(f, st);
      if (to >= 0 && to !== st.at) { st.set(to); n++; }
    }
    const c = resolveControl(f);
    for (const pt of c?.parts ?? []) {   // the drawer's parts write their pref straight, as the drawer does
      if (onlineForcedPref(pt.key) !== undefined || !Object.hasOwn(PREF_DEFAULTS, pt.key)) continue;
      if (String(getPref(pt.key)) !== String(PREF_DEFAULTS[pt.key])) { setPref(pt.key, PREF_DEFAULTS[pt.key]); n++; }
    }
    const vendor = c?.store === 'mods' ? c.vendor : (Array.isArray(c?.also) ? c.also.find((a) => a.store === 'mods')?.vendor : null) ?? null;
    for (const key of vendor ? [...modModules(vendor), ...modDials(vendor)] : []) {
      const def = MOD_SETTINGS[vendor].keys[key];
      if (onlineModSetting(vendor, key) !== undefined || JSON.stringify(modSetting(vendor, key)) === JSON.stringify(def.default)) continue;   // a tuple dial is a frozen pair
      setModSetting(vendor, key, def.default); n++;
    }
  }
  if (spendKeep) setPref(FEATURES_RESTORE_PREF, null);   // nothing for Restore to go back to (ORG2: one tab's restore leaves it)
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
    d.append(el('div', 'ft-drawer-label', t('menu.features.keysLabel', 'Keys')));
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
    const to = el('button', 'act ft-keys-to', t('menu.features.toControls', 'Change in Controls'));
    to.type = 'button';
    to.title = featureKeysNote();
    to.onclick = () => openControls();
    d.append(to);
  }
  if (mods.length) {
    d.append(el('div', 'ft-drawer-label', t('menu.features.modulesLabel', 'Modules')));
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
    d.append(el('div', 'ft-drawer-label', t('menu.features.dialsLabel', 'Dials')));
    for (const key of dials) d.append(modRow(vendor, key, MOD_SETTINGS[vendor].keys[key], { home: true }));
  }
  return d;
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
  // GRIM1: DFO Grimoire wears the pack's art too - shown by its desk, where GrimoireUI is shown by its inventory
  const grim = p.id === 'ui' && o.dress === 'grimoire';
  const pack = p.id === 'ui' ? UI_PACKS[o.pack] ?? (grim ? UI_PACKS.grimoire : null) : null;
  if (pack) {
    const img = el('img');
    img.alt = grim ? t('menu.ovh.packAltDesk', '{look}: the desk', { look: o.name }) : t('menu.ovh.packAlt', '{look}: the inventory', { look: o.name });
    img.loading = 'lazy';
    img.src = packUrl(pack, grim ? 'Img/BIOG00I0.IMG.png' : 'Img/INVE00I0.IMG.png');
    pic.append(img);
  } else {
    const em = el('div', 'look-emblem', o.name);
    em.append(el('small', null, p.title.replace(/ Overhaul$/, '')));
    pic.append(em);
  }
  if (inUse) pic.append(el('span', 'look-badge', t('menu.ovh.inUse', 'In use')));
  return pic;
}
/** TEXT-FONT: the installed font 'My font' writes in - typed (shown in its own face as it is typed), or picked from the
 *  machine's list where the browser offers one. Kept on Enter or on leaving the field.
 *  FONT-PICK (FIELD BUGS 2026-10-13, a player on Gentoo / Niri, Wayland: "the font selector is a bit buggy on my setup as
 *  it has no scrolling ability ... I have 376 fonts"): the list was the browser's own `<datalist>` popup - a surface the
 *  system draws outside the page, which ran off the screen and took no wheel under that compositor. It is the page's own
 *  list now (`.look-fontpick`): under the field, a fixed height that scrolls by wheel, by the arrow keys and by touch, the
 *  typed text filtering it (textFont.js fontMatches - those beginning with it first), each name in its own face; a click
 *  or Enter picks, Escape closes. The machine's list is asked once a session (`fontFamiliesSeen`). */
let fontFamiliesSeen = null;
/** FONT-PICK: the list button's word once the machine has answered - how many, and where to pick (L10N4). */
const fontsPickBelow = (n) => t('menu.font.pickBelow', '{n, plural, one {# font - pick below} other {# fonts - pick below}}', { n });
let fontPickShut = false;   // a pick's own repaint hands the field its focus back: that focus does not reopen the list
function systemFontRow(redraw) {
  const row = el('div', 'look-colours look-fontrow');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Your font');
  row.append(el('span', 'look-colours-label', 'Font name'));
  const input = document.createElement('input');
  input.className = 'look-fontname';
  input.type = 'text';
  input.spellcheck = false;
  input.placeholder = 'e.g. Verdana';
  input.value = textFontSystem();
  input.setAttribute('aria-label', 'Installed font name');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  const pick = el('div', 'look-fontpick');
  pick.id = 'look-fontpick';
  pick.setAttribute('role', 'listbox');
  pick.setAttribute('aria-label', t('menu.font.installed', 'Installed fonts'));
  pick.hidden = true;
  input.setAttribute('aria-controls', pick.id);
  pick.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });   // the list's own scroll - no window under it takes the wheel
  const look = () => { const f = cleanFamily(input.value); if (f) input.style.setProperty('font-family', `'${f}', sans-serif`, 'important'); else input.style.removeProperty('font-family'); };   // important: over the words' own face
  look();
  const keep = () => { if (cleanFamily(input.value) !== textFontSystem()) { setTextFontSystem(input.value); redraw(); } };
  let hi = -1;
  /** @type {string[]} */
  let shown = [];
  const close = () => { pick.hidden = true; input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const settle = () => { fontPickShut = true; try { keep(); } finally { fontPickShut = false; } };
  const choose = (f) => { input.value = f; look(); close(); settle(); };
  const paint = () => {
    if (!fontFamiliesSeen?.length) { close(); return; }
    shown = fontMatches(fontFamiliesSeen, input.value);
    hi = Math.min(hi, shown.length - 1);
    const all = fontFamiliesSeen.length;
    pick.replaceChildren(el('div', 'look-fontcount', shown.length === all ? `${all} fonts` : `${shown.length} of ${all} fonts`));
    shown.forEach((f, i) => {
      const o = el('button', 'look-fontopt', f);
      o.type = 'button';
      o.setAttribute('role', 'option');
      o.setAttribute('aria-selected', String(i === hi));
      o.style.fontFamily = `'${f}', sans-serif`;
      o.onmousedown = (e) => e.preventDefault();   // the field keeps its focus, so its blur never closes the list under the click
      o.onclick = (e) => { e.stopPropagation(); choose(f); };
      pick.append(o);
    });
    pick.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const move = (d) => {
    if (pick.hidden) { paint(); if (pick.hidden) return; }
    if (!shown.length) return;
    hi = hi < 0 ? (d > 0 ? 0 : shown.length - 1) : (hi + d + shown.length) % shown.length;
    const opts = pick.querySelectorAll('.look-fontopt');
    opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === hi)));
    opts[hi]?.scrollIntoView?.({ block: 'nearest' });
  };
  input.oninput = () => { look(); hi = -1; if (fontFamiliesSeen?.length) { paint(); pick.scrollTop = 0; } };
  input.onfocus = () => { if (fontFamiliesSeen?.length && !fontPickShut) paint(); };
  input.onblur = () => close();
  input.onchange = keep;
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!pick.hidden && hi >= 0 && shown[hi]) choose(shown[hi]); else { close(); settle(); } }
    else if (e.key === 'Escape' && !pick.hidden) { e.preventDefault(); close(); }
  };
  input.onkeyup = (e) => e.stopPropagation();
  input.onclick = (e) => { e.stopPropagation(); if (pick.hidden && fontFamiliesSeen?.length) paint(); };
  row.append(input);
  if (canListFonts()) {
    const b = el('button', 'look-colour', fontFamiliesSeen?.length ? fontsPickBelow(fontFamiliesSeen.length) : 'List my fonts');
    b.type = 'button';
    b.onclick = async (e) => {
      e.stopPropagation();
      if (!fontFamiliesSeen?.length) fontFamiliesSeen = await installedFamilies();
      b.textContent = fontFamiliesSeen.length ? fontsPickBelow(fontFamiliesSeen.length) : 'No font list. Type the name';
      input.focus();
      paint();
    };
    row.append(b);
  }
  row.append(pick);
  return row;
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
    b.setAttribute('aria-label', word(p.title.toLowerCase()));
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
  nav.append(arrow(-1, '‹', (panel) => t('menu.ovh.previous', 'Previous {panel} look', { panel })), mid, arrow(1, '›', (panel) => t('menu.ovh.next', 'Next {panel} look', { panel })));
  card.append(nav, el('p', 'look-blurb', o.blurb));
  // PLUS2: ENHANCED PLUS'S COLOURS - offered on its own card while it is the look in use (they are its surfaces, and
  // they change at once, no reload). One swatch per stone; the chosen one is pressed.
  // GRIM1: DFO Grimoire is the same enhanced skin, so it offers the same rows (the cursor, the hover card, the
  // controller) - and in place of the stones, its own two: the page the windows are written on and what the front door
  // stands on. Both are worn at once.
  if (p.id === 'ui' && (o.id === 'enhanced-plus' || o.id === 'dfo-grimoire') && o === cur) {
    const choiceRow = (label, options, now, wear) => {
      const row = el('div', 'look-colours');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', label);
      row.append(el('span', 'look-colours-label', label));
      for (const [id, name] of Object.entries(options)) {
        const b = el('button', 'look-colour', name);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(id === now));
        b.onclick = (e) => { e.stopPropagation(); wear(id); render(); };
        row.append(b);
      }
      return row;
    };
    if (o.id === 'dfo-grimoire') {
      card.append(choiceRow('Pages', GRIMOIRE_PAGES, grimoirePages(), (id) => setGrimoirePages(id)));
      card.append(choiceRow('Backdrop', GRIMOIRE_BACKDROPS, grimoireBackdrop(), (id) => setGrimoireBackdrop(id)));
      card.append(choiceRow('Vitals', GRIMOIRE_VITALS, grimoireVitals(), (id) => setGrimoireVitals(id)));
      card.append(choiceRow('Spellbook', GRIMOIRE_SPELLBOOKS, grimoireSpellbook(), (id) => setGrimoireSpellbook(id)));   // GRIM3: a player: "(optionally) retain the look of the original GrimoireUI spellbook"
      card.append(choiceRow('Tab dial', GRIMOIRE_DIALS, grimoireDial(), (id) => setGrimoireDial(id)));   // DIAL-PACK: Daggerfall's own icons, or the pack's paintings
    } else {
    const row = el('div', 'look-colours');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t('menu.ovh.plusColour', 'Enhanced Plus color'));
    row.append(el('span', 'look-colours-label', t('menu.ovh.uiColour', 'UI color')));   // Mac, 2026-09-29
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
    }
    // PLUS6: the gauntlet cursor, on or off - worn at once
    const crow = el('div', 'look-colours');
    crow.setAttribute('role', 'group');
    crow.setAttribute('aria-label', t('menu.ovh.plusCursor', 'Enhanced Plus cursor'));
    crow.append(el('span', 'look-colours-label', t('menu.ovh.cursor', 'Cursor')));
    for (const [on, label] of [[true, t('menu.ovh.cursorGauntlet', 'Gauntlet')], [false, t('menu.ovh.cursorSystem', 'System')]]) {
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
    hrow.setAttribute('aria-label', t('menu.ovh.itemHover', 'Item info on hover'));
    hrow.append(el('span', 'look-colours-label', t('menu.ovh.itemHover', 'Item info on hover')));
    for (const [on, label] of [[true, t('menu.toggle.on', 'On')], [false, t('menu.toggle.off', 'Off')]]) {
      const b = el('button', 'look-colour', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String((getPref('plusItemHover') !== false) === on));
      b.onclick = (e) => { e.stopPropagation(); setPref('plusItemHover', on); render(); };
      hrow.append(b);
    }
    card.append(hrow);
    // TEXT-FONT (2026-10-11, a player: "a Sans font, a Monospace font and a Dyslexic compatible font would be nice. But
    // allowing selection from system fonts would be most ideal"): the words' face, worn at once; 'My font' names one of
    // this machine's own (ui/textFont.js).
    card.append(choiceRow('Text font', TEXT_FONTS, textFont(), (id) => setTextFont(id)));
    if (textFont() === 'system') card.append(systemFontRow(render));
    card.append(plusControllerRows());   // PADPLUS1
  }
  // VE4: A LOOK'S ADD-ONS - Vanilla Enhanced's Masked Roads and Snowless Swamps and Jungles, offered as switches while
  // the look is worn (the PLUS rows' shape); each takes effect when the world next loads, and is kept for the next wear
  const addons = o === cur ? o.addons?.() ?? [] : [];
  for (const m of addons) {
    // ALIKR1/SNOWFALL1: the environment packs ride the look as its add-ons do (built on its Base) - each named with its
    // own author where the archive names one, so Snowfall does not read as carademono's
    const label = /^Vanilla Enhanced - /.test(m.title) ? String(m.title).replace(/^Vanilla Enhanced - /, '') : m.author ? t('menu.ovh.addonBy', '{title} by {author}', { title: m.title, author: m.author }) : m.title;
    const row = el('div', 'look-colours');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    row.append(el('span', 'look-colours-label', label));
    for (const [on, word] of [[true, t('menu.toggle.on', 'On')], [false, t('menu.toggle.off', 'Off')]]) {
      const b = el('button', 'look-colour', word);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(m.enabled === on));
      b.onclick = (e) => { e.stopPropagation(); setVeAddon(m.key, on); render(); };
      row.append(b);
    }
    card.append(row);
  }
  // AUDIT VE R2: the texture store not yet read (the main menu runs before any host registers it) - a look worn now would
  // miss the attached mods; AUDIT VE R10: what stands in a look's way (a loose texture pack, Classic's)
  const reading = p.id === 'texture' && !textureStoreSettled();
  const blocked = o.blocked?.() ?? null;
  const use = el('button', 'act primary look-use', o === cur ? t('menu.ovh.inUse', 'In use') : t('menu.ovh.use', 'Use {look}', { look: o.name }));
  use.type = 'button';
  use.disabled = o === cur || reading || !!blocked;
  use.onclick = () => {
    const r = o.apply();
    if (r?.reload) { location.replace(r.url); return; }
    render();
  };
  card.append(use);
  if (reading) card.append(el('p', 'look-note', t('menu.ovh.reading', 'Reading your texture mods\u2026')));
  else if (blocked && o !== cur) card.append(el('p', 'look-note', blocked));
  if (!cur) card.append(el('p', 'look-note', p.custom ?? t('menu.ovh.custom', 'Custom: your own mix from Settings. Using a look sets every switch it covers.')));
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
  wrap.append(row(t('menu.pad.crossbar', 'Controller crossbar'), [['auto', t('menu.pad.auto', 'Auto')], ['on', t('menu.toggle.on', 'On')], ['off', t('menu.toggle.off', 'Off')]], xb, (v) => setPref('plusCrossbar', v)));
  wrap.append(row(t('menu.pad.stickRun', 'Left stick run'), [[true, t('menu.pad.toggle', 'Toggle')], [false, t('menu.pad.hold', 'Hold')]], getPref('plusToggleRun') !== false, (v) => setPref('plusToggleRun', v)));
  const fam = livePadFamily() ?? 'xbox';
  const legend = el('div', 'look-padlegend');
  legend.setAttribute('aria-label', t('menu.pad.layout', 'Controller layout'));
  for (const [codes, word] of plusPadLegend(liveBindings())) {
    const it = el('div', 'look-paditem');
    for (const c of codes) { const im = el('img'); im.src = hdGlyphSvg(fam, c, { size: 40 }) ?? ''; im.alt = hdGlyphName(fam, c); it.append(im); }
    it.append(el('span', null, word));
    legend.append(it);
  }
  wrap.append(legend);
  // PADPLUS10: the separate window - buttons, the d-pad's tap and hold, the sticks' sensitivity
  const binds = el('button', 'act primary look-padbinds', t('menu.pad.bindings', 'Controller bindings\u2026'));
  binds.type = 'button';
  binds.onclick = (e) => {
    e.stopPropagation();
    openPlusPadBinds();
    globalThis.addEventListener?.('plus-padbinds-closed', () => render(), { once: true });   // the legend shows what was set
  };
  wrap.append(binds);
  const reset = el('button', 'act look-padreset', t('menu.pad.reset', 'Reset controller layout'));
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
  waitForTextureStore();   // AUDIT VE R2
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
  c.append(el('h3', null, 'DFO Online'));   // the public name (BR1, BR4, BR5); project-dagger is the repo
  c.append(el('p', 'meta', t('menu.about.tagline', 'An open-source reimplementation of a classic 1996 RPG.')));
  c.append(stats([
    [t('menu.about.update', 'Update'), UPDATE ?? t('menu.about.devBuild', 'a development build')],   // REL8: the player's update number (scripts/updateNumber.mjs)
    [t('menu.about.build', 'Build'), BUILD_TAG],
    [t('menu.about.interface', 'Interface'), currentOption(OVERHAUL_PANELS.find((p) => p.id === 'ui'))?.name ?? SKIN_NAMES[uiSkin()]],   // PLUS1; MENU-TOGGLE: the UI Overhaul worn, by its card's name (GrimoireUI is the classic skin with a pack)
    [t('menu.about.settings', 'Settings'), t('menu.about.keys', '{n, plural, other {# keys}}', { n: Object.values(DEFAULTS).reduce((n, s2) => n + Object.keys(s2).length, 0) })],
  ]));
  body.append(c);
  body.append(creditsCard());
  body.append(empty(t('menu.about.exit', 'Exit'), t('menu.about.exitNote', 'A browser tab can\u2019t close itself. Close the tab yourself. Your quicksave is kept.')));
}

// CR1: THE CREDITS (Mac, 2026-08-30). Rendered from ui/credits.js, the
// one table every vendored work has a row in; this function knows the
// shape and nothing about the works. Mods are the point - a modder's
// name on the screen the player sees, not only in a README - so they
// take their own heading, with the terms the work is carried under.
function creditsCard() {
  const c = el('div', 'card credits');
  c.append(el('h3', null, t('menu.credits.title', 'Credits')));
  c.append(el('p', 'meta', t('menu.credits.blurb', 'What this game is built on, and the mods included with their authors\' permission.')));
  const group = (heading, rows) => {
    c.append(el('h4', 'credits-head', heading));
    for (const r of rows) {
      const row = el('div', 'credit');
      const title = el('div', 'credit-title');
      title.append(el('span', 'credit-name', r.version ? `${r.title} ${r.version}` : r.title));
      title.append(el('span', 'credit-by', t('menu.credits.by', 'by {author}', { author: r.author })));
      row.append(title);
      row.append(el('p', 'credit-what', r.what));
      const foot = [];
      if (r.terms) foot.push(r.terms);
      if (r.contact) foot.push(t('menu.credits.contact', 'Contact: {contact}.', { contact: r.contact }));
      if (foot.length) row.append(el('p', 'credit-terms', foot.join(' ')));
      if (r.link) {
        const a = el('a', 'credit-link', r.link.replace(/^https?:\/\//, ''));
        a.href = r.link; a.target = '_blank'; a.rel = 'noopener';
        row.append(a);
      }
      c.append(row);
    }
  };
  group(t('menu.credits.builtOn', 'Built on'), CREDITS.builtOn);
  group(t('menu.credits.mods', 'Mods'), CREDITS.mods);
  const languages = translationCredits();   // L10N6: whose words each language's are, a bundled pack's terms
  if (languages.length) group(t('menu.credits.translations', 'Translations'), languages);
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
  if (id === 'features') id = 'settings';   // ORG2: the Features home is Settings' tabs - an old door's name still lands
  if (id !== section) discardControlsStaging();
  // UI-CALM: back home from one of Offline's games is back on the offline doors; from Online, Settings or Overhauls the
  // two questions; from a page both levels show (Tutorials, Screenshots, About) the level it was opened from
  if (id === 'home' && mode === 'boot') {
    if (offlineSection(section)) homeLevel = 'offline';
    else if (section === 'online') homeLevel = 'top';   // AUDIT UICALM-FIRM1 L3 N1: Settings and Overhauls stand in the foot of both levels, so they keep the level they were opened from, as Tutorials does
  }
  pickedFeature = null;   // ORG2: a walk away drops the picked Features row, as it drops pickedKey
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
      mark = timersMark(document, { open: timersOpen, onOpen: () => { timersOpen = true; timersFocusIn = true; render(); } });
      home.append(mark);
      timersAnchor = anchorBeside(mark, home.querySelector?.('.px-profile'), home);   // AUDIT TIMERS1 UI-3: placed again on every resize
      if (timersFocusBack && !timersOpen) { timersFocusBack = false; globalThis.requestAnimationFrame?.(() => mark.focus?.()); }   // UI-5: back where the press was
    }
    const envelope = postEnvelope(home, mark);   // SERVER-POST: the mailbox beside the hourglass, online - its count kept live
    const laurel = seasonLaurel(home, [mark, envelope]);   // SEASON-BOOK: the laurel beside the envelope, online
    // AUDIT SEASON-BOOK S4: a window whose mark is gone (the clock lost, the box gone) is closed - never kept to come back
    // over whatever the player moved on to when the mark returns
    if (timersOpen && !mark) timersOpen = false;
    if (postOpen && !envelope) { postOpen = false; postKeep = {}; }
    if (seasonOpen && !laurel) seasonOpen = false;
    if (accountOpen) {
      const acct = el('div', 'px-stage px-acctstage');
      acct.append(accountWindow());
      home.append(acct);
      closeOnOutsideTap(home, '.px-acctwin', closeAccount);   // AUDIT RECOVERY-SET B1: not over codes
      for (const n of [stage, mark, envelope, laurel]) n?.setAttribute?.('inert', '');   // AUDIT SERVER-POST: the face under the account window out of reach, as under the timers' - SEASON-BOOK: the laurel too
    }
    else if (timersOpen && hooks.timers?.()) {
      const tstage = el('div', 'px-stage px-timersstage');
      // AUDIT TIMERS1 UI-9: the window's read is the one that asks the service (the seats list); the hourglass's test does not
      timersView = timersWindow(document, { read: () => hooks.timers?.({ ask: true }) ?? null, onClose: () => { timersOpen = false; timersFocusBack = true; render(); }, door: timersDoor, focus: timersFocusIn });   // EG-ZM: a row's door
      timersFocusIn = false;
      tstage.append(timersView.root);
      home.append(tstage);
      closeOnOutsideTap(home, '.px-timerswin', () => { timersOpen = false; timersFocusBack = true; render(); }, { swallow: true });   // AUDIT SEASON-BOOK U1: the tap's release never lands on the face drawn under it
      // AUDIT TIMERS1 UI-5/UI-7: the pause face under the window is out of reach - no Tab into it, no Enter on its
      // Resume, no bumper turning its tabs (plusPad's tab strips skip what is not visible to it), no profile window
      for (const n of [stage, home.querySelector?.('.px-profile'), mark]) n?.setAttribute?.('inert', '');
      envelope?.setAttribute?.('inert', '');   // SERVER-POST: and the envelope beside it
      laurel?.setAttribute?.('inert', '');   // SEASON-BOOK: and the laurel
    }
    else if (postOpen && hooks.post?.()) {
      // SERVER-POST: the mailbox's window, on the hourglass's own stage (centred, its own padding - enhancedStyle.js)
      const pstage = el('div', 'px-stage px-timersstage px-poststage');
      postView = postWindow(document, { box: () => hooks.post?.() ?? null, keep: postKeep, onClose: () => { postOpen = false; postKeep = {}; postFocusBack = true; render(); } });
      pstage.append(postView.root);
      home.append(pstage);
      closeOnOutsideTap(home, '.px-postwin', () => { postOpen = false; postKeep = {}; postFocusBack = true; render(); }, { swallow: true });
      for (const n of [stage, home.querySelector?.('.px-profile'), mark, envelope, laurel]) n?.setAttribute?.('inert', '');
    }
    else if (seasonOpen && laurel) {
      // SEASON-BOOK: the season window, on the hourglass's own stage; its read asks the boards (the laurel's test does not)
      const sstage = el('div', 'px-stage px-timersstage px-seasonstage');
      seasonView = seasonWindow(document, { read: (opening) => seasonSource(hooks, { opening }), onClose: closeSeason, door: seasonDoor, focus: seasonFocusIn });   // a row's door is a handoff, as the hourglass's
      seasonFocusIn = false;
      sstage.append(seasonView.root);
      home.append(sstage);
      closeOnOutsideTap(home, '.px-seasonwin', closeSeason, { swallow: true });
      for (const n of [stage, home.querySelector?.('.px-profile'), mark, envelope, laurel]) n?.setAttribute?.('inert', '');
    }
    // OT1 (Mac: "tapping outside of any UI closes the UI"): a tap on the
    // scrim - outside the window, the clock and the foot - resumes,
    // the way Escape does; the front door has no scrim and no resume.
    // PROFILE2: the mark is inside too (a press on it opens the window), and with the window open the tap is its.
    else closeOnOutsideTap(home, '.px-win, .px-clock, .px-foot, .px-profile, .px-timersmark, .px-postmark, .px-seasonmark', () => { if (pauseTab === 'growth' && growthAsks()) return; onAction('resume'); });   // SERVER-POST: the envelope inside too - AUDIT GROWTH LANE3-4: a Growth face asked first (GROWTH5)
    // PX4 (Mac): NO FOOT AT PAUSE - no skin toggle, no About plaque;
    // About is a System-tab row instead, and the skin switch stays on
    // the boot face and the settings shell.
    // PX5: the world's date and time, bottom-right like the reference,
    // through DFU's own header formatter over THE ONE CLOCK - a paused
    // clock, so one read at render is the truth for the whole visit.
    const d = dateFromClassicMinutes(Math.floor(skyMinutes()));   // TIME1: the date and time the world shows are the sky's
    const clock = el('div', 'px-clock');
    // the time is DateTimeString's own head ('{0:00}:{1:00}:{2:00}'), read off the clock - never by splitting the
    // formatted line at ' on ', which a translation's pattern need not contain (L10N3d)
    clock.append(el('span', null, dateString(d)), el('span', 'px-clocktime', formatText('{0:00}:{1:00}:{2:00}', d.hour, d.minute, d.second)));
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
  menu.setAttribute('aria-label', t('menu.home.aria', 'Main menu'));
  // UI-CALM: the enhanced door asks which world first (drawDoors); the classic skin's door keeps its one list
  if (twoQuestionDoor()) drawDoors(menu);
  // PX1b: About leaves the center list for the corner box below - the
  // list is what a player DOES, the box is who made it. The SECTION
  // still exists on the shell rail untouched, so the rail-hole pin and
  // the shared-sections law hold.
  else {
    for (const label of sections) {
      if (label === 'About' || label === 'Screenshots') continue;   // LOAD1: Screenshots stands in the foot, beside About
      if (label === 'Tutorials') continue;   // TUT1: the foot's left plaque (an eighth door ran the list past a 720-pixel screen)
      const id = idOf(label);
      menu.append(doorBtn(id, railLabel(label), '', RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id]) : () => go(id)));   // L10N1b
    }
  }
  stage.append(menu);
  home.append(stage);

  // ACC1f: the profile mark, top-right - the corner the foot's About
  // box does not use.
  home.append(profileMark());
  // SUPPORT1: the asks, top-left - the front door's alone; PX4 keeps the
  // pause face to its window, so they are not drawn over a game.
  home.append(supportMarks());
  // L10N1b: the first-run language offer, in the top-left corner nothing else uses
  const offer = languageOffer();
  if (offer) home.append(offer);

  // ...and the window, offered ONCE per visit to a device with nobody
  // signed in. `accountOffered` latches here rather than in the
  // opener, so the mark can reopen it as often as a player likes.
  // L10N1b: the language is asked first - the window waits while the
  // offer stands (found by tools/languageProbe.mjs: it covered the
  // offer, so a French player was asked in English before French).
  if (!offer && !accountOpen && !accountOffered && !signedIn()) { accountOffered = true; accountOpen = true; }
  if (accountOpen) {
    const acct = el('div', 'px-stage px-acctstage');
    acct.append(accountWindow());
    home.append(acct);
    // OT1, the same law the pause window lives under: a tap outside
    // closes it. The account is never a thing a player is stuck in.
    closeOnOutsideTap(home, '.px-win', closeAccount);   // AUDIT RECOVERY-SET B1: not over codes
  }

  appendPxFoot(home);
  app.append(home);
}

/** UI-CALM: the two-question door stands on the enhanced front door alone (the classic skin's door keeps its list). */
const twoQuestionDoor = () => mode === 'boot' && sections === SECTIONS_BOOT;

/**
 * One door of the front door: its name, and (UI-CALM) under it in a smaller hand what lies behind it.
 *
 * PX31: THE DOOR'S BUTTONS CARRY THEIR OWN NAME. Until now they were classless, and nine probes still reached for
 * `.railbtn` - the SHELL rail's class, which this door has never had since PX1 replaced it. Every one of them timed out
 * at its front door and no gate noticed, because a probe is not a gate (AUDIT 17f F4). Selecting on PROSE would be the
 * same bug waiting on a relabel, so the hook is structural: doorbtn plus the section id, which is what a probe actually
 * means when it says New Game.
 */
function doorBtn(id, label, sub, onClick) {
  const b = el('button', `doorbtn door-${id}`);
  // AUDIT PLUS-MENU M2: the diamonds stand at rest under Plus (MENU_CSS), so they are drawing, not words - hidden from
  // a reader, or every door was named "◆ Continue ◆"
  const dia = () => { const d = el('span', 'px-c', '\u25c6'); d.setAttribute('aria-hidden', 'true'); return d; };
  const word = el('span', 'door-word');
  word.append(el('span', 'door-name', label));
  if (sub) word.append(el('span', 'door-sub', sub));
  b.append(dia(), word, dia());
  // AUDIT UICALM-FIRM1 L3 M2: a double click's second click is no door's - a door drawn under the pointer by the first
  // (Offline's level: Load Game stood where Offline was) took it
  b.onclick = (e) => { if (e?.detail > 1) return; onClick(e); };
  return b;
}

/**
 * UI-CALM: THE TWO QUESTIONS, then the games. The top level is two doors - ONLINE first, then OFFLINE - each saying in a
 * line what lies behind it, and Settings and Overhauls as two small doors under them (a player may want either before
 * choosing). OFFLINE opens the offline doors (HOME_OFFLINE) where Continue, New Game and Load Game always stood, and a
 * way back. Each level is two PAGES - DFO Grimoire writes them on the open book's two leaves under their own heads; Plus
 * stands them in one column, the offline doors under the word Offline.
 */
function drawDoors(menu) {
  menu.dataset.level = homeLevel;
  const page = (cls, head) => {
    const p = el('section', `px-page ${cls}`);
    if (head) p.append(el('h2', 'px-pagehead', head));
    menu.append(p);
    return p;
  };
  const level = (to) => () => {
    const focused = menu.contains?.(document.activeElement);
    homeLevel = to;
    render();
    // a keyboard or a pad that pressed it keeps its place: the first door of the level it opened
    if (focused) globalThis.requestAnimationFrame?.(() => app?.querySelector?.('.px-menu .doorbtn')?.focus?.());
  };
  if (homeLevel === 'offline') {
    const games = page('px-page-games', t('menu.home.offline', 'Offline'));
    games.append(el('p', 'px-pagenote', t('menu.home.offlineSub', 'Your own game, kept on this device')));
    for (const label of HOME_OFFLINE.slice(0, 3)) games.append(doorBtn(idOf(label), railLabel(label), '', () => go(idOf(label))));
    const more = page('px-page-more', t('menu.home.elsewhere', 'Elsewhere'));
    for (const label of HOME_OFFLINE.slice(3)) more.append(doorBtn(idOf(label), railLabel(label), '', () => go(idOf(label))));
    more.append(doorBtn('back', t('menu.home.back', 'Back'), '', level('top')));
    return;
  }
  page('px-page-online', t('menu.home.realmHead', 'The Realm'))
    .append(doorBtn('online', railLabel('Online'), t('menu.home.onlineSub', 'Play with others in the shared world'), () => go('online')));
  page('px-page-offline', t('menu.home.ownHead', 'Thine Own Tale'))
    .append(doorBtn('offline', t('menu.home.offline', 'Offline'), t('menu.home.offlineSub', 'Your own game, kept on this device'), level('offline')));
  // Settings and Overhauls stand in the foot's box beside Screenshots and About (appendPxFoot) - UI-CALM, a player:
  // "settings and overhaul can be put in the ... bottom" - so the book's leaves hold the two questions and nothing else
}

/** PX1b: three-zone foot - build left and About as the bottom-right
 *  box, the centre left open (MENU-TOGGLE retired the skin toggle that
 *  stood there). One builder for both faces (PX3 gave pause its own
 *  stage). */
function appendPxFoot(home) {
  const foot = el('div', 'px-foot');
  const build = el('span', 'px-build');
  build.append(document.createTextNode(`${t('menu.foot.build', 'build')} `), el('span', null, BUILD_TAG));
  const about = el('button', 'px-about', RAIL_TEXT.about());
  about.onclick = () => go('about');
  foot.append(build, about);   // MENU-TOGGLE: the skin pair that stood between them is retired
  // TUT1: the tutorials' plaque stands over the build line, at the LEFT - the book a new player reads before the game. A
  // third plaque in About's box ran into the menu's column on a 1280x720 screen, and three stacked overran a phone's foot.
  if (mode !== 'pause' && sections.includes('Tutorials')) {
    const tuts = el('button', 'px-about px-tuts door-tutorials', RAIL_TEXT.tutorials());   // AUDIT UICALM-FIRM1 L3 N3: the player's language, as About beside it
    tuts.onclick = () => go('tutorials');
    const left = el('div', 'px-footleft');
    build.remove();
    left.append(tuts, build);
    foot.prepend(left);
  }
  // LOAD1: the gallery's plaque stands beside About, in About's own box, so the foot keeps one shape - the centre
  // runs under the menu's last rows on a 720-pixel screen. The door's face only: the pause window's System rail carries
  // it as a row (SYSTEM_PANES).
  if (mode !== 'pause' && sections.includes('Screenshots')) {
    const shots = el('button', 'px-about px-shots', RAIL_TEXT.screenshots());
    shots.onclick = () => go('screenshots');
    const right = el('div', 'px-footright');
    about.remove();
    // UI-CALM: the two-question door's Settings and Overhauls, first in the box (HOME_LINKS)
    if (twoQuestionDoor()) {
      for (const label of HOME_LINKS) {
        const b = el('button', `px-about px-homelink door-${idOf(label)}`, railLabel(label));
        b.onclick = () => go(idOf(label));
        right.append(b);
      }
    }
    right.append(shots, about);
    foot.append(right);
  }
  home.append(foot);
  // AUDIT UICALM-FIRM1 L3 H1: THE STAGE RESERVES THE FOOT IT HAS (PX8's law, measured): UI-CALM's two plaques wrap the
  // foot to a second row the stage's fixed reserve did not hold, and Settings stood over Offline, Load and Back - a tap
  // on a door opened Settings. The foot says its height (--px-foot-h) and the sheet keeps the stage's foot clear of it.
  footObs?.disconnect?.();
  const reserve = () => { const h = Math.ceil(foot.getBoundingClientRect?.().height ?? 0); if (h > 0) home.style?.setProperty?.('--px-foot-h', `${h}px`); };
  reserve();
  try { footObs = new globalThis.ResizeObserver(reserve); footObs.observe(foot); } catch { footObs = null; }   // no observer: the sheet's own reserve stands
}
/** The foot's watch (appendPxFoot) - one at a time, the last door's. */
let footObs = /** @type {ResizeObserver|null} */ (null);

// ── PX3: THE PAUSE WINDOW ────────────────────────────────────────
// HOLDINGS (2026-10-03, Mac: "Lets add a new tab to the pause menu as the stat page is starting to get bloated"): what the
// player owns and who follows them moved off the Stats rail onto a tab of their own (pauseHoldings, below).
// LEGACY3 (2026-10-05, Mac: "implement it into the pause menu as a new tab"): Project Legacy's family - its tree, its house
// and the Hall of Ancestors - on a tab of its own (pauseFamily, below; ui/familyPages.js).
// TUT1 (2026-10-11, Mac: "a menu section where tutorials can be revisited"): every tutorial page, on a tab of its own
// (pauseTutorials, below; ui/tutorialsPane.js) - the same pane the front door's Tutorials section draws.
// GROWTH1 (2026-10-17, the owner: "give the firmament, level up page, and specializations its own tab within the pause
// menu"): how a character grows - the Ascension, the specialisations' guide, the Firmament and the captain's stars, the
// skies drawn in the tab (pauseGrowth, below; ui/growth/growthTab.js), after the Stats it grew out of.
const PAUSE_TABS = Object.freeze([['quests', 'Quests'], ['stats', 'Stats'], ['growth', 'Growth'], ['holdings', 'Holdings'], ['family', 'Family'], ['tutorials', 'Tutorials'], ['system', 'System']]);
/** HOLDINGS: every tab a landing may name (mountEnhancedMenu's `at`). */
export const PAUSE_TAB_IDS = Object.freeze(PAUSE_TABS.map(([id]) => id));
/** LEGACY3: a tab drawn now - the Family tab while the game is played with Project Legacy (FAMILY-TAB: the mod on AND a
 *  house for the game played - ui/familyPages.js familyTabShown); a landing on it otherwise lands on System. */
const pauseTabShown = (id) => id !== 'family' || familyTabShown();
/** L10N4: the pause window's tab and page words in the player's language, by id - the tables keep the English ids'
 *  labels; a page another module adds (the professions', the revenants', the companions') shows its own label. */
const PAUSE_TEXT = Object.freeze({
  quests: () => t('pause.tab.quests', 'Quests'),
  stats: () => t('pause.tab.stats', 'Stats'),
  growth: () => t('pause.tab.growth', 'Growth'),
  holdings: () => t('pause.tab.holdings', 'Holdings'),
  family: () => t('pause.tab.family', 'Family'),
  tutorials: () => t('pause.tab.tutorials', 'Tutorials'),
  system: () => t('pause.tab.system', 'System'),
  character: () => t('pause.stats.character', 'Character'),
  attributes: () => localizedText('helpAttributes', 'Attributes'),
  skills: () => localizedText('helpSkills', 'Skills'),
  specials: () => t('pause.stats.advantages', 'Advantages'),
  standing: () => t('pause.stats.standing', 'Standing'),
  effects: () => t('pause.stats.effects', 'Effects'),
});
const pauseLabel = (id, label) => PAUSE_TEXT[id]?.() ?? label;
// The token formattings that carry a journal line - questJournal's own
// counted set (DaggerfallQuestJournalWindow.cs:658-662 via its :322).

function pauseWindow() {
  const win = el('div', 'px-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const tabs = el('div', 'px-tabs');
  if (!pauseTabShown(pauseTab)) pauseTab = 'system';
  for (const [id, label] of PAUSE_TABS.filter(([id]) => pauseTabShown(id))) {
    const b = el('button', id === pauseTab ? 'on' : null);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(pauseLabel(id, label)), el('span', 'px-c', '\u25c6'));
    b.onclick = () => { if (pauseTab === 'growth' && id !== 'growth' && growthAsks()) return; if (id !== 'system') discardControlsStaging(); disarmFamilyPages(); disarmCollectionsPage(); if (id !== 'growth') releaseGrowthTab(); pauseTab = id; render(); };   // AUDIT CARDS-5 D5: and the Collections page's - GROWTH3: and a face on the Growth stage
    tabs.append(b);
  }
  win.append(tabs);

  const body = el('div', 'px-body');
  ({ quests: pauseQuests, stats: pauseStats, growth: pauseGrowth, holdings: pauseHoldings, family: pauseFamily, tutorials: drawTutorialsPane, system: pauseSystem })[pauseTab](body);   // TUT1 - GROWTH1
  if (pauseTab === 'growth') win.classList.add('px-win-growth');   // GROWTH-BOOK: one size for every page of the tab (was GROWTH3's px-win-wide, a face up only)
  win.append(body);
  return win;
}

// ── GROWTH1: THE GROWTH PAGE ────────────────────────────────────
// The journal's bones once more (PX6's rail of pages, the chosen one on the right), for how the character grows
// (ui/growth/growthTab.js): the Ascension, the specialisations' guide, the Firmament and the captain's stars - the
// Ascension and the skies drawn in the pane (ui/growth/growthStage.js), Master Skills a press away on the Stats tab.
function pauseGrowth(body) {
  drawGrowthTab(body, {
    el, divider: pxDivider, skillMeter, askCard, entity: playerEntity, render, hooks, captain: holdingsProvider()?.captain ?? null,
    openMaster: () => { releaseGrowthTab(); pauseTab = 'stats'; statsSec = 'master'; _masterNote = null; render(); },
  });
}

// ── HOLDINGS: THE HOLDINGS PAGE ──────────────────────────────────
// The journal's bones a fourth time (PX6's rail of pages, the chosen
// one on the right), for what the Stats rail had grown past the
// character sheet: the horse and the wagon (ui/holdingsPages.js), the
// ships (ui/fleetPage.js), the sworn companions, the revenants, and
// the Stores online. A page gone (nothing to show, offline) is never
// drawn, and the rail falls back to its first.
function pauseHoldings(body) {
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  const secs = holdingsSections();
  if (!secs.some(([id]) => id === holdSec)) holdSec = secs[0]?.[0] ?? 'stable';
  for (const [id, label] of secs) {
    const b = el('button', `px-qrow${id === holdSec ? ' on' : ''}`);
    b.append(el('span', 'px-c', '◆'), document.createTextNode(label));
    b.onclick = () => { holdSec = id; disarmCollectionsPage(); render(); };   // AUDIT CARDS-5 D5: an armed act never waits for the way back
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', 'px-qdetail px-sys');   // the system page's dress, as the Stats detail wears it (PLUS4)
  const kit = { el, divider: pxDivider, meter: pxMeter };
  // AUDIT HOLDINGS C6: a host with no page to show (the standalone dungeon sets no provider) never draws the Stable's "you
  // own no horse" - AUDIT COLLECTIONS-II (lanes 2, 5): the rail is never empty now, the Collections page every player's
  // (collectionsPageShown), so such a host opens on it; the empty rail's own words went with their last reader
  const draw = {
    stable: (d) => drawStablePage(d, render, kit),
    // a door the page opens over the world (the shipwright's window, the water's placing click): the pause goes down
    // first, as the sheet's doors do (PX25/ESC-BOOK), and comes back if the door opened nothing (AUDIT 27h A4)
    fleet: (d) => drawFleetPage(d, render, { ...kit, door: (fn) => { handoff(fn); } }),   // AUDIT SEASON-BOOK S3: the handoff's one home
    captain: (d) => drawCaptainPage(d, render, { ...kit, door: (fn) => { handoff(fn); }, growth: () => { setGrowthSection('captain'); pauseTab = 'growth'; render(); } }),   // CAPT-LOG: the crowns' regard, the letter, the contracts, the log - CAPTAIN-TREE: the stars' door, the Fleet's shape
    companions: (d) => drawCompanionsPage(d, render, { ...kit, kindName: enemyDisplayName, here: swornBodyOf, stars: typeof hooks.openRevenantStars === 'function' ? hooks.openRevenantStars : null }),   // COMPANION-ROSTER - RVN-STARS: a sworn one's stars, over this window
    revenants: (d) => drawRevenantsPage(d, render, { ...kit, player: playerEntity, kindName: enemyDisplayName }),   // REVENANT-PAGE
    stores: (d) => drawStoresPage(d, render, kit),   // PROF1
    collections: (d) => drawCollectionsPage(d, render, { ...kit, player: playerEntity, account: newAccountFlow }),   // COLLECTIONS: the codex and the cards - COLLECTIONS-II: and the account's wardrobe, read through its own flow
  }[holdSec];
  draw?.(detail);
  wrap.append(detail);
  body.append(wrap);
}

// ── LEGACY3: THE FAMILY PAGE ────────────────────────────────────
// The journal's bones once more (PX6's rail of pages, the chosen one on the right): Project Legacy's tree, its house
// and the Hall of Ancestors (ui/familyPages.js). Every page says why when there is no family to show.
function pauseFamily(body) {
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  if (!FAMILY_PAGE_SECTIONS.some(([id]) => id === famSec)) famSec = 'tree';
  for (const [id, label] of FAMILY_PAGE_SECTIONS) {
    const b = el('button', `px-qrow${id === famSec ? ' on' : ''}`);
    b.append(el('span', 'px-c', '◆'), document.createTextNode(label));
    b.onclick = () => { famSec = id; disarmFamilyPages(); render(); };   // AUDIT LEGACY U8: an armed act never waits for the way back
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', 'px-qdetail px-sys');
  // an act that takes the player out of the game (a switch's load, a birth, the mantle's Succession): the pause goes down
  // first, as the Fleet's doors do, and comes back if the act did nothing
  // AUDIT LEGACY U4: a refused act is refused on the card before the press (switchRefusal, mantleRefusal); one refused
  // after it (a save that would not take) is said on the HUD by the host, and the world resumes under it
  const kit = { el, divider: pxDivider, door: (fn) => handoff(fn, (r) => !!r?.ok),   // AUDIT SEASON-BOOK S3
    goto: (id) => { famSec = id; disarmFamilyPages(); render(); } };   // AUDIT PLAIN-UI U8: the tree's way to How it works
  ({ tree: drawTreePage, house: drawHousePage, hall: drawHallPage, guide: drawGuidePage })[famSec](detail, render, kit);   // PLAIN-UI: How it works
  wrap.append(detail);
  body.append(wrap);
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
  ['overhauls', 'Overhauls'],   // OVH1
  ['screenshots', 'Screenshots'],   // LOAD1: the gallery, mid-game too
  ['about', 'About'], ['exit', 'Exit'],   // FT14: no Mods pane
]);

function pauseSystem(body) {
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const [id, label] of SYSTEM_PANES) {
    const b = el('button', `px-qrow${id === sysSec && !RAIL_ACTS[id] ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(railLabel(label)));   // L10N4: the rail's own words
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
    // own confirm/help placement (the sheet). ORG2: the same screen as the main menu's - its tabs, its search - with
    // the rows that act in play.
    paneSettings(detail, { pause: true });
  } else if (confirming) {
    detail.append(confirmCard());
  } else {
    ({
      save: paneSave, load: paneLoad,
      overhauls: paneOverhauls,   // OVH1
      screenshots: drawShotsPane,   // LOAD1
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
// (formats/factionFile.js:"export const SOCIAL_GROUPS"; talk.js seeds the array) - the enum
// slots past Underworld are DFU's own placeholders and stay unlisted.
const SOCIAL_GROUP_NAMES = Object.freeze(['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld']);
/** L10N4: the five groups' names as DFU keys them (Internal_Strings commoners..underworld), in the player's language. */
const socialGroupNames = () => [localizedText('commoners', 'Commoners'), localizedText('merchants', 'Merchants'),
  localizedText('scholars', 'Scholars'), localizedText('nobility', 'Nobility'), localizedText('underworld', 'Underworld')];

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
 *  page (ui/professions/profPages.js). HOLDINGS: the Stores page, the Revenants and the Companions went to the Holdings rail. */
const PROF_STATS_SECTIONS = Object.freeze(PROF_PAGE_SECTIONS.filter(([id]) => id === 'professions'));
const PROF_HOLD_SECTIONS = Object.freeze(PROF_PAGE_SECTIONS.filter(([id]) => id !== 'professions'));
const statsSections = () => [...STATS_SECTIONS, ...(profPagesShown() ? PROF_STATS_SECTIONS : []), ...(vendorPageShown() ? VENDOR_PAGE_SECTIONS : [])];   // HOME-VENDOR: the Vendor page, under the Professions
/** HOLDINGS: the Holdings rail's pages - what the player owns (the Stable, the Fleet while ships sail, the Stores
 *  online) and who follows them (the Companions, the Revenants), each while it has a thing to show. */
const holdingsSections = () => [...(stablePageShown() ? STABLE_PAGE_SECTIONS : []), ...(fleetPageShown() ? FLEET_PAGE_SECTIONS : []), ...(captainPageShown() ? CAPTAIN_PAGE_SECTIONS : []), ...(companionPageShown() ? COMPANION_PAGE_SECTIONS : []), ...(revenantPageShown(playerEntity) ? REVENANT_PAGE_SECTIONS : []), ...(profPagesShown() ? PROF_HOLD_SECTIONS : []), ...(collectionsPageShown(playerEntity) ? COLLECTION_PAGE_SECTIONS : [])];   // COLLECTIONS

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
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(pauseLabel(id, label)));
    b.onclick = () => { statsSec = id; render(); };
    rail.append(b);
  }
  wrap.append(rail);
  // PLUS4: the ONE other detail pane on this rail with buttons on it (Pack/Spellbook/Chronicle/
  // Ascend, below) - and the one that never picked up the px-sys class its System-tab twin (below,
  // pauseSystem) carries. The kit's button role (enhancedFrame.js FRAME_ROLES) reads `.px-sys .act`,
  // so without it these four fell through to the bare, unpainted base .act under Plus.
  const detail = el('div', 'px-qdetail px-sys');   // DROPS-AUDIT F3: the system-page dress (Plus's; PLUS-DEAD: the only one)
  if (statsSec === 'professions' || statsSec === 'stores') detail.classList.add('prof-detail');
  const profKit = { el, divider: pxDivider, meter: pxMeter };
  ({
    character: statsCharacter, attributes: statsAttributes, skills: statsSkills, specials: statsSpecials, standing: statsStanding, effects: statsEffects, master: statsMaster,   // SOFTCAP4: `master` - the Master Skills door's page
    professions: (d) => drawProfessionsPage(d, render, profKit),
    vendor: (d) => drawVendorPage(d, render, profKit),   // HOME-VENDOR
  })[statsSec](detail, m);
  // PX25: THE DOORS THE F5 SHEET CARRIED. The classic character sheet
  // has four buttons down its side - Inventory, Spellbook, Logbook,
  // History - and the enhanced F5 overlay copied them. This page shows
  // the same model from the same sheetModel, so it is the same sheet;
  // it was simply the only one of the two with no way out. Each door
  // appears ONLY when the host handed one over, because a button that
  // opens nothing is PX14's drawn door.
  const doors = statsSec === 'master' ? [] : [   // SOFTCAP6: the Master Skills page carries none of the sheet's doors
    [t('pause.door.pack', 'Pack'), hooks.openPack], [t('pause.door.spellbook', 'Spellbook'), hooks.openSpellbook], [t('pause.door.chronicle', 'Chronicle'), hooks.openChronicle],
    // ARENA3: THE ARENA WINDOW, once a banner is worn (bible/11-Multiplayer/Arena.md 5 - "from the pause menu's Arena entry
    // once you have joined"): the host's arm (scenes/arena/arenaGate.js windowOverlay, shown in its own slot)
    [t('pause.door.arena', 'Arena'), hooks.arenaJoined?.() ? hooks.openArena : undefined],
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
      b.onclick = () => { handoff(fn); };   // AUDIT SEASON-BOOK S3: the handler read before the handoff unmounts the face
      row.append(b);
    }
    detail.append(row);
  }
  // SOFTCAP4: THE MASTER SKILLS DOOR (Mac, in game: "add a button to it like ASCEND and there it should be described and
  // chosen"). It opens a page of THIS window (statsSec 'master'), so it neither resumes nor hands off; the page's own
  // button comes back to Skills. A count on the button when a mastery is waiting (GROWTH2: a specialisation waiting is
  // the Growth door's count now - its guide moved there).
  const masterDoor = m.master ? (() => {
    const n = m.master.candidates?.length ?? 0;
    const b = el('button', n ? 'act primary' : 'act', n ? t('pause.door.masterCount', 'Master Skills ({n})', { n }) : t('pause.master.title', 'Master Skills'));
    b.onclick = () => { statsSec = 'master'; _masterNote = null; render(); };
    return b;
  })() : null;
  // GROWTH1 (bible/10-UI/Growth.md section 3; the owner, asked: "Move them"): THE GROWTH DOOR where Ascend and the
  // Firmament stood (ASCEND-ANYTIME's and FIRM1's) - both moved to the Growth tab with the specialisations and the
  // captain's stars, drawn in its pane. A page of this window, so it neither resumes nor hands off; a count on it when
  // something waits there (a level owed, a path open, the captain's points).
  if (statsSec !== 'master') {
    const row = el('div', 'px-sheetdoors');
    const n = Object.values(growthDue({ entity: playerEntity, captain: holdingsProvider()?.captain ?? null })).reduce((a, b) => a + b, 0);
    const g = el('button', n ? 'act primary' : 'act', n ? t('pause.door.growthCount', 'Growth ({n})', { n }) : t('pause.door.growth', 'Growth'));
    g.onclick = () => { pauseTab = 'growth'; render(); };
    row.append(g);
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
  head2.append(el('span', 'px-qwing'), el('h3', null, m.name || t('pause.stats.adventurer', 'Adventurer')), el('span', 'px-qwing px-flip'));
  detail.append(head2);
  const meta = el('div', 'px-qmeta');
  meta.append(el('span', 'px-qkind', m.career ? t('pause.stats.kindCareer', '{race} {career} \u00b7 Level {level}', { race: m.race, career: m.career, level: m.level })
    : t('pause.stats.kind', '{race} \u00b7 Level {level}', { race: m.race, level: m.level })));
  detail.append(meta);
  detail.append(meterRow(localizedText('health', 'Health'), m.health.now, m.health.max, 'blood'));
  detail.append(meterRow(localizedText('fatigue', 'Fatigue'), m.fatigue.now, m.fatigue.max, ''));
  detail.append(meterRow(localizedText('magicka', 'Magicka'), m.magicka.now, m.magicka.max, 'verdigris'));
  detail.append(pxDivider(t('pause.stats.burden', 'Burden')));
  const g = el('div', 'px-statgrid');
  for (const [label, v] of [[t('menu.save.gold', 'Gold'), String(m.gold)], [t('pause.stats.encumbrance', 'Encumbrance'), `${m.encumbrance.now} / ${m.encumbrance.max}`]]) {
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', label), el('span', 'v', v));
    g.append(r);
  }
  detail.append(g);
  // LEGACY-SHEET (bible/06-Systems/Legacy-Arc.md section 11): THE HOUSE - the one played's own facts off their Family
  // card (ui/familyPages.js sheetHouse): the model, the generation, and an Enduring house's age, toll and elder's word
  const house = sheetHouse();
  if (house) {
    detail.append(pxDivider(house.title));
    const h = el('div', 'px-statgrid');
    for (const [label, v] of house.rows) { const r = el('div', 'px-stat'); r.append(el('span', 'k', label), el('span', 'v', v)); h.append(r); }
    detail.append(h);
    if (house.word) detail.append(el('p', 'px-note', house.word));
  }
  // ARENA2: THE ARENA'S NAME FOR YOU (offline - systems/arena/arenaLadder.js): the title of the highest tier whose champion you
  // beat, Grand Champion over all, and your record on its sand; said only once you have fought there
  if (m.arena) {
    detail.append(pxDivider('The Arena'));
    const a = el('div', 'px-statgrid');
    for (const [label, v] of [['Title', m.arena.title ?? 'None yet'], ['Record', m.arena.record], ...(m.arena.banner ? [['Banner', m.arena.banner]] : [])]) {   // ARENA3: the banner worn
      const r = el('div', 'px-stat');
      r.append(el('span', 'k', label), el('span', 'v', v));
      a.append(r);
    }
    detail.append(a);
  }
}

/** BUFF-END (Leafen on Discord: "Could there be a way to dispel magic for non-magic users?"): EFFECTS - every spell on
 *  you, with its rounds, and an End on each the player may end (systems/mysticism.js canEndBundle: a spell of the
 *  kinds that only help - never a held item's, a duel's or anything harmful). The door that needs no freed mouse: a
 *  pad, a finger, a player who never presses Enter. The HUD's right-click is its twin (ui/enhanced/enhancedHud.js). */
function statsEffects(detail) {
  detail.append(pxDivider(t('pause.effects.title', 'Active spells')));
  const bundles = liveBundles(playerEntity).filter((b) => b.showIcon);
  if (!bundles.length) {
    detail.append(el('p', 'px-note', t('pause.effects.none', 'No spells are on you.')));
    return;
  }
  for (const b of bundles) {
    const r = el('div', 'px-stat px-effect');
    const held = b.bundleType === 'HeldMagicItem';
    const rounds = maxRoundsRemaining(b);
    r.append(el('span', 'k', String(b.name ?? '').replace(/^!+/, '') || t('pause.effects.aSpell', 'A spell')),
      el('span', 'v px-src', held ? t('pause.effects.whileHeld', 'While held') : t('pause.effects.rounds', '{n, plural, one {# round} other {# rounds}}', { n: rounds })));
    if (canEndBundle(b)) {
      const end = el('button', 'act', t('pause.effects.end', 'End'));
      end.type = 'button';
      end.title = t('pause.effects.endTip', 'End this spell now');
      end.onclick = () => { endBundle(playerEntity, b.bundleId); render(); };
      r.append(end);
    }
    detail.append(r);
  }
}

/** ATTRIBUTES: the eight, each with a meter on the classic 100 - and, AUDIT C&C B11 (2026-10-12), in Climates &
 *  Calories' Boons tier the boons that raise them, named under them (ui/temperatureCard.js boonStatRows, the pack's
 *  Stats side's one source): a 55 that a meal made says so where it shows. */
function statsAttributes(detail, m) {
  detail.append(pxDivider(localizedText('helpAttributes', 'Attributes')));
  for (const a of m.attributes) {
    detail.append(meterRow(localizedText(a.key, a.key[0].toUpperCase() + a.key.slice(1)), a.value, 100, ''));   // L10N4: DFU's own attribute keys (strength..luck)
  }
  const boons = boonStatRows(playerEntity);
  if (!boons.length) return;
  detail.append(pxDivider('Boons'));
  for (const [k, v] of boons) {
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', k), el('span', 'v', v));
    detail.append(r);
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
  const back = acts([{ label: `\u2039 ${localizedText('helpSkills', 'Skills')}`, onClick: () => { statsSec = 'skills'; _masterNote = null; render(); } }]);
  back.classList.add('px-master-back');
  detail.append(back, pxDivider(t('pause.master.title', 'Master Skills')));
  const lead = !ms.on
    ? (ms.switchable ? t('pause.master.offClassic', 'Off \u2013 your skills stop at 100, as in the original game.') : t('pause.master.off', 'Off.'))
    : t('pause.master.on', 'Choose the skills that may climb past 100, up to 200. A choice is permanent.');
  detail.append(el('div', 'px-master-lead', lead));
  if (_masterNote) detail.append(el('div', 'px-master-note', _masterNote));
  // GROWTH2 (bible/10-UI/Growth.md section 5): the two specialisation cards (SCHOOLS1's, MARTIAL1's) moved to the Growth
  // tab's guide - every path, what opens it and what it does; one line and its door stand here
  // AUDIT GROWTH LANE5-6: and only for a character with a family still to reach or one held (AUDIT SCHOOLS L4 8)
  if (ms.on && (ms.paths?.open || ms.paths?.held)) {
    const card = el('section', 'px-mgroup px-spec');
    card.append(el('div', 'px-master-about', ms.paths.open ? t('pause.master.specMoved', 'Master two schools of magic or two weapon skills to unlock a specialization. See every path and what it needs on the Growth tab.')
      : t('pause.master.specHeld', '{n, plural, one {Your specialization is on the Growth tab.} other {Your specializations are on the Growth tab.}}', { n: ms.paths.held })));
    const go = acts([{ label: t('pause.master.specGo', 'Specializations'), onClick: () => { setGrowthSection('specs'); pauseTab = 'growth'; render(); } }]);
    card.append(go);
    detail.append(card);
  }
  for (const g of ms.groups) {
    const card = el('section', 'px-mgroup');
    const head = el('div', 'px-mhead');
    const pips = el('span', 'px-pips');
    for (let k = 0; k < g.max; k++) pips.append(el('span', k < g.used ? 'px-pip on' : 'px-pip', k < g.used ? '\u25c6' : '\u25c7'));
    head.append(el('span', 'px-mname', g.label), pips, el('span', 'px-mcount', t('pause.master.chosen', '{used} of {max} chosen', { used: g.used, max: g.max })));
    card.append(head);
    for (const sk of g.skills) {
      const row = el('div', sk.mastered ? 'px-mrow2 is-mastered' : sk.candidate ? 'px-mrow2 is-ready' : 'px-mrow2');
      const top = el('div', 'px-mtop');
      top.append(el('span', 'k', `${sk.mastered ? '\u25c6 ' : ''}${sk.name}`), el('span', 'v', String(sk.value)));
      const side = el('div', 'px-mside');
      if (sk.mastered) side.append(el('span', 'px-mtag gold', sk.value >= 200 ? t('pause.master.masteredFull', 'Mastered \u00b7 200') : t('pause.master.mastered', 'Mastered')));
      else if (sk.candidate) {
        const b = el('button', 'act primary px-mbtn', t('pause.master.master', 'Master'));
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
      label: ms.on ? t('pause.master.turnOff', 'Turn off Master Skills') : t('pause.master.activate', 'Activate Master Skills'), primary: !ms.on,
      onClick: () => {
        if (ms.blocked) { _masterNote = ms.blocked; render(); return; }
        if (ms.on) { flip(); return; }
        askCard([t('pause.master.askTitle', 'Activate Master Skills?'), '', ...t('pause.master.askBody', 'Dangerous dungeons will send stronger enemies,\nand points past 100 are slow to earn.\nYou can turn it off here at any time.').split('\n')], flip);
      },
    }]);
    foot.classList.add('px-master-foot');
    detail.append(foot);
  }
}

/** SOFTCAP3: the enhanced face's own Yes/No card over the pause page (the same card class the skin's YesNo box wears). */
/** The Yes/No card standing (askCard) - its close, or null. AUDIT GROWTH LANE3-9: the window's keys stand down while it
 *  stands (its Escape is the card's No - the back stack's release had resumed the game under it), and the window's
 *  unmount takes it down (the sheet's key left it over the running game, its Y still choosing a permanent path). */
let askUp = /** @type {null | (() => void)} */ (null);
let askSeq = 0;
function askCard(lines, onYes) {
  askUp?.();
  const back = el('div', 'px-master-ask');
  const card = el('div', 'inputbox yesnobox');
  card.setAttribute('role', 'alertdialog');
  // AUDIT SPEC-RESET L3-3: modal for the keys and the reader too - named by its rows, the window under it inert (Tab and
  // Space walked it: the family switched, the tabs changed, and Y paid a reset over the Quests tab), the focus on No and
  // given back to its opener when it goes
  card.setAttribute('aria-modal', 'true');
  const rows = el('div', 'inputbox-rows');
  rows.id = `px-ask-${++askSeq}`;
  card.setAttribute('aria-labelledby', rows.id);
  for (const t of lines) rows.append(el('div', 'notice-row center', t));
  const opener = globalThis.document?.activeElement ?? null;
  const under = app && !app.hasAttribute?.('inert') ? app : null;
  // AUDIT SPEC-RESET L3-4: answered ONCE, however many doors call it (THE SLOT IS EMPTIED's other half, as the skin's
  // YesNoBoxWindow.answer is), and a key held down before the card stood answers nothing by its repeat
  let answered = false;
  const answer = (yes) => { if (answered) return; answered = true; close(); if (yes) onYes(); };
  // DFU's keys, as the skin's YesNo box keeps them: Y yes, N or Return no (the default) - and Escape no here too, on
  // CAPTURE and stopped, so it answers the card instead of closing the pause page under it
  const onKey = (e) => {
    const k = e.code;
    if (k !== 'KeyY' && k !== 'KeyN' && k !== 'Enter' && k !== 'NumpadEnter' && k !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    answer(k === 'KeyY');
  };
  const close = () => {
    removeEventListener('keydown', onKey, true); back.remove(); under?.removeAttribute?.('inert');
    if (askUp === close) askUp = null;
    if (opener?.isConnected) opener.focus?.({ preventScroll: true });
  };
  addEventListener('keydown', onKey, true);
  askUp = close;
  const bar = acts([
    { label: t('pause.ask.yes', 'Yes'), onClick: () => answer(true) },
    { label: t('pause.ask.no', 'No'), primary: true, onClick: () => answer(false) },
  ]);
  bar.classList.add('yesnobox-acts');
  const hint = el('div', 'notice-hint', t('pause.ask.hint', 'Y yes · N or Enter no'));
  card.append(rows, bar, hint);
  back.append(card);
  document.body.append(back);
  under?.setAttribute?.('inert', '');
  [...(bar.querySelectorAll?.('button') ?? [])].pop()?.focus?.({ preventScroll: true });   // No, the default
}

/** SKILL-TICK (systems/advancement.js skillAdvanceProgress): a skill's line under its bar - the uses it has toward its next
 *  point and the uses that point costs, or that the next rest or journey raises it, or why none will. */
export function skillTickText(p) {
  if (!p) return '';
  if (p.held === 'cap') return t('pause.skills.tickCap', 'At its limit - uses are not kept');
  // AUDIT SUGGESTIONS-1019 L3-3: a 100 a mastery is still open to is not at its limit, and a locked skill above 95 is not "at 95"
  if (p.held === 'master') return t('pause.skills.tickMaster', 'At 100 - master it to climb further');
  if (p.held === 'lock') return t('pause.skills.tickLock', 'Held while a primary skill is at 100 - uses are not kept');
  // AUDIT SUGGESTIONS-1019 L3-1: ready, but the gate shut - a rest or a journey before it opens raises nothing
  if (p.ready && p.wait > 0) return t('pause.skills.tickReadyLater', 'Ready - a rest or a trip raises it once {hours, plural, one {# more hour has} other {# more hours have}} passed', { hours: Math.ceil(p.wait / 60) });
  if (p.ready) return t('pause.skills.tickReady', 'Ready - rest or travel to raise it');
  return t('pause.skills.tick', '{have} / {need} uses to the next point', { have: p.have, need: p.need });
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
      top.append(el('span', mastered ? 'k px-mastered' : 'k', `${mastered ? '\u25c6 ' : ''}${SKILL_NAMES[id] ?? t('pause.skills.unknown', 'Skill {id}', { id })}`), el('span', 'v', m.skillText ? m.skillText(id) : String(m.skill(id))));
      // SOFTCAP1/6: 0..100 as ever, and under a MASTERED skill the gold 100..200 bar (its track shows from the moment
      // of mastery, empty at 100) - the one mark this pane carries of it
      r.append(top, skillMeter(m.skillBase ? m.skillBase(id) : m.skill(id), mastered));   // SOFTCAP7: the bars climb the TRAINED value
      const tick = m.progress ? skillTickText(m.progress(id, ownMinutes())) : '';   // SKILL-TICK; AUDIT SUGGESTIONS-1019 L3-1: on the character's own clock (systems/worldTick.js), the gate's
      if (tick) r.append(el('div', 'px-skilltick', tick));
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
        formatText(localizedText('hthDamageFormatString', '{0} dmg: {1}-{2}'), SKILL_NAMES[SKILLS.HandToHand], m.handToHandDamage.min, m.handToHandDamage.max)));
      detail.append(hth);
    }
  }
  const more = el('button', 'px-qrow px-disclose');
  const miscCount = m.groups[3]?.ids.length ?? 0;
  more.append(el('span', 'px-c', '\u25c6'),
    document.createTextNode(statsAllSkills ? t('pause.skills.hideMisc', 'Hide miscellaneous') : t('pause.skills.showMisc', 'Show {n} miscellaneous skills', { n: miscCount })));
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
    detail.append(pxDivider(t('pause.stats.advantages', 'Advantages')));
    detail.append(el('p', 'px-note', t('pause.specials.none', 'No special advantages or disadvantages.')));
    return;
  }
  for (const [kind, title] of [['advantage', t('pause.stats.advantages', 'Advantages')], ['disadvantage', t('pause.specials.disadvantages', 'Disadvantages')]]) {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) continue;
    detail.append(pxDivider(title));
    for (const r of list) {
      const row = el('div', 'px-stat');
      row.append(el('span', 'k', r.label));
      row.append(el('span', 'v px-src', r.source === 'race' ? (m.race || t('pause.specials.race', 'Race')) : (m.career || t('pause.specials.class', 'Class'))));
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
  detail.append(pxDivider(t('pause.standing.reputation', 'Reputation')));
  const reps = playerEntity.sGroupReputations ?? [];
  const groupNames = socialGroupNames();
  for (let i = 0; i < SOCIAL_GROUP_NAMES.length; i++) {
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', groupNames[i]), signedRep(reps[i] ?? 0));
    detail.append(r);
  }
  statsDress(detail, playerEntity);
  statsLaw(detail, playerEntity);
  statsGuilds(detail, playerEntity);
  if (getPref('standingAll')) statsEveryStanding(detail, playerEntity);   // EVERY-STANDING
}

/** FIELD BUGS 2026-10-09e EVERY-STANDING ("Could we have a setting to see our reputation with every guild/kingdoms?" -
 *  expelled from the Mages Guild, the way back in had no number on the screen): with the Interface tab's Character
 *  sheet row on, every organization's reputation under its own divider - the guilds and temples the player is not in,
 *  the knightly orders, the kingdoms, the covens, the clans, the Daedra (systems/faction/factionStanding.js). */
export function statsEveryStanding(detail, entity) {
  for (const g of standingGroups(entity)) {
    detail.append(pxDivider(g.title));
    for (const r of g.rows) {
      const row = el('div', 'px-stat px-org');
      row.append(el('span', 'k', r.name), signedRep(r.rep));
      detail.append(row);
      // WAY-BACK (FIELD BUGS 2026-10-16d): under a guild that will not take this standing, its quests' way in - the hall's
      // own line (the rest is said at the hall, and on the classic skin's refusal of the join)
      const way = wayBackQuestLine(guildOfFaction(r.factionId, resolveVariantGuild(entity.factionRep?.dict)), activeMemberships(entity), entity.factionRep);
      if (way) detail.append(el('p', 'px-note', way));
    }
  }
}

/** DRESS1 (2026-09-30, Discord: "Add positive and negative reputation buffs for clothing items"): what the worn clothes
 *  are doing right now - one light line under the groups, only when the dress moves anybody. Read live off the equip
 *  table (dressStanding is pure), so it is right before the next magic round folds it into reactionMods. */
export function dressLine(entity) {
  const d = dressStanding(entity);
  const parts = [];
  const groupNames = socialGroupNames();
  for (let i = 0; i < SOCIAL_GROUP_NAMES.length; i++) if (d.groups[i]) parts.push(`${groupNames[i]} ${d.groups[i] > 0 ? '+' : ''}${d.groups[i]}`);
  if (d.temple) parts.push(t('pause.standing.temples', 'Temples {mod}', { mod: `${d.temple > 0 ? '+' : ''}${d.temple}` }));
  return parts.join(', ');
}
export function statsDress(detail, entity) {
  const line = dressLine(entity);
  if (!line) return;
  const r = el('div', 'px-stat px-dress');
  r.append(el('span', 'k', t('pause.standing.dress', 'Dress')), el('span', 'v', line));
  detail.append(r);
}

/** REP5: THE LAW, REGION BY REGION - every region with a standing other than a common citizen's, or a banishment. */
export function statsLaw(detail, entity, { worldNow = trustedWorldMinutes() } = {}) {   // AUDIT REP F2
  const rows = lawRows(entity, worldNow);
  if (!rows.length) return;
  detail.append(pxDivider(t('pause.law.title', 'The law')));
  for (const w of rows) {
    const r = el('div', 'px-stat px-law');
    r.append(el('span', 'k', w.region), el('span', 'v px-rank', w.note ? t('pause.law.wordNote', '{word} - {note}', { word: w.word, note: w.note }) : w.word), signedRep(w.rep));
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
    const days = banishmentDaysLeft(entity, i, worldNow);   // BANISH-SKY: the days of the calendar the player sees
    const real = Number.isFinite(left) ? worldSpanRealWords(left) : null;   // ...and online what they are on the wall
    // the price of each: a pardon at the region's temple, a stop's fine on the street (L10N4: each note one pattern)
    const note = left !== 0 ? (Number.isFinite(left)
      ? (real
        ? t('pause.law.banishedDaysReal', 'banished, {days, plural, one {# day} other {# days}} left, {real} (a pardon: {gold} gold)', { days, real, gold: pardonPrice(entity, i) })
        : t('pause.law.banishedDays', 'banished, {days, plural, one {# day} other {# days}} left (a pardon: {gold} gold)', { days, gold: pardonPrice(entity, i) }))
      : t('pause.law.banished', 'banished (a pardon: {gold} gold)', { gold: pardonPrice(entity, i) }))
      : rep < KNOWN_CRIMINAL_BELOW ? t('pause.law.known', 'known to the watch (a stop: {gold} gold)', { gold: challengeFine(entity, i, { worldNow }) }) : '';
    out.push({ region: REGION_NAMES[i] ?? t('pause.law.region', 'Region {i}', { i }), rep, word: legalStandingWord(rep), note });
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
  detail.append(pxDivider(t('pause.guilds.title', 'Guilds')));
  // STANDING-WORDS: a probation's days on the character's own clock, as the review reads it; AUDIT GUILD-WORDS II C-7:
  // online a promotion does not wait (PROMO-NOW), so a probation may end sooner
  const book = affiliations(entity, { now: dateFromClassicMinutes(Math.floor(ownMinutes())), online: isOnlinePage() });
  if (!book.length) {
    detail.append(el('p', 'px-note', t('pause.guilds.none', 'You have no affiliations.')));
    return;
  }
  for (const a of book) {
    const r = el('div', 'px-stat px-guild');
    r.append(el('span', 'k', a.affiliation), el('span', 'v px-rank', a.probation ? t('pause.guilds.probation', '{title} - on probation', { title: a.title }) : a.title), signedRep(a.rep));   // REP6
    detail.append(r);
    // STANDING-WORDS (Field-Bugs-2026-10-15g): a probation's stakes, and what the Roll still owes online
    for (const w of a.warnings) detail.append(el('p', 'px-note', w));   // AUDIT GUILD-WORDS L1-2: a probation's stakes, a demotion before it lands
    if (a.owed > 0) detail.append(el('p', 'px-note', t('pause.guilds.owed', '{owed} more standing on the way, at most {max} a real day (days turn at midnight UTC).', { owed: a.owed, max: ROLL_GAIN_DAY_MAX })));   // AUDIT GUILD-WORDS L1-6: the owed's pace, not the standing's; II C-8: the UTC day
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
  return { text: t('pause.journal.timeRemains', 'Time remains: {left}', { left: remainWords(q.clockSeconds) }), urgent: q.clockSeconds < QUEST_URGENT_SECONDS };
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
 *  '<name> completed|ended at <date>:' (notebook.js:"AddFinishedQuest(messages)"). The name
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
 *  (ui/quest/questLens.js targetWords - only the names the entry says, or DFU's box would), the way there where this host
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
    go.onclick = () => { handoff(() => door(find)); };   // AUDIT SEASON-BOOK S3
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
    body.append(el('p', 'px-note', t('pause.journal.notWired', 'The journal isn\u2019t available here yet.')));
    return;
  }
  // MAC-K2: THE WALK IS ui/quest/questRail.js's now, because the chronicle
  // needs the same one - the L key's window had no quests in it at all
  // and a second copy of this here is how the two would drift.
  const log = hooks.questLog() ?? { active: [], finished: [] };
  const rail0 = questRail(log);
  const { finished, hidden } = rail0;
  // QL2: a stamped quest whose objectives stand before its first journal entry is a quest of the rail's too
  const active = [...rail0.active, ...unloggedRail(log)];
  const shelved = shelvedRail(log);   // QUEST-SHELF: and the quests set aside
  // JOURNAL-CLEAN (2026-09-30, Discord: "Should there be a way to clean both finished and unfinished quests from your
  // journal for a cleaner look?"): the host's tidy-ups (scenes/quest/questBridge.js journalClean - remove / clear the
  // archive, hide / unhide an active quest). A host that hands none draws no buttons rather than buttons that do
  // nothing.
  const clean = hooks.journalClean?.() ?? null;
  // QL3 (bible/06-Systems/Questlines-Arc.md section 5.2): the rewards waiting to be chosen - each an ended quest's three
  // pieces, its own rail section above the quests, one press from the Take (key `r:<id>`)
  const offers = (clean?.offers?.() ?? []).map((o) => ({ key: `r:${o.id}`, name: offerRowWords(o), offer: o }));
  // QL12 (Questlines-Arc.md section 6, the owner's fifth: "One unified place to view questlines"): THE QUESTLINES - every
  // line begun or on offer, under its own heading (key `l:<id>`): the ones under way first, then those on offer, the
  // finished last. None while the questlines are off (the bridge hands none). QL-OFFERED: a line its gate shuts is no row
  // (the runner draws none - UI-Calm's law, nothing drawn that cannot be taken)
  const LINE_ORDER = { running: 0, retry: 1, shelved: 1, waiting: 1, offered: 2, done: 3 };   // AUDIT QUESTLINES UI-7: retry, shelved
  const lines = (log.lines ?? []).map((l) => ({ key: `l:${l.id}`, name: l.title, line: l }))
    .sort((a, b) => (LINE_ORDER[a.line.state] ?? 9) - (LINE_ORDER[b.line.state] ?? 9));
  // QL12 (section 4.4): and each guild the player is a member of, as its own ladder (key `g:<guild>`)
  const ladderRows = (log.ladders ?? []).map((g) => ({ key: `g:${g.key}`, name: g.name, ladder: g }));
  lines.push(...ladderRows);
  // STORY-AGAIN (#982): a step of the main story that failed, under Main Quests (key `st:<quest>`), one press (twice)
  // from starting again - the host's door (scenes/quest/questBridge.js journalClean.storyAgain)
  const story = (clean?.storyAgain?.() ?? []).map((s) => ({ key: `st:${s.questName}`, name: s.title, story: s }));
  if (!active.length && !finished.length && !hidden.length && !shelved.length && !offers.length && !lines.length && !story.length) {
    body.append(el('p', 'px-note', t('pause.journal.none', 'No active quests.')));
    if (questShelfSaid) { body.append(el('p', 'px-note', questShelfSaid)); questShelfSaid = null; }   // AUDIT QA3 F6: said, the tab empty or not
    return;
  }
  const shown = questShowHidden ? hidden : [];
  const rows = [...offers, ...active, ...story, ...shown, ...shelved, ...finished, ...lines];
  // AUDIT QA3 B9: the words of a press whose quest has no row yet (a step started again waits for its questor, no entry)
  // are said at the tab's head - under the detail they landed at the foot of whichever quest the selection fell to
  if (questShelfSaid && !rows.some((r) => r.key === questSel)) { body.append(el('p', 'px-note', questShelfSaid)); questShelfSaid = null; }
  // GUIDE4: THE JOURNAL OPENS ON THE QUEST THE HUD SHOWS - the tracker's (the one tracked, else the one the journal
  // last changed) - and only then on the first row.
  if (!rows.some((r) => r.key === questSel)) {
    const onHud = followOn() ? questTracker.tracked()?.id : null;   // AUDIT GUIDE T2: the card's or the marks' quest
    questSel = (onHud != null ? rows.find((r) => r.id === onHud)?.key : null) ?? rows[0]?.key ?? null;   // JOURNAL-CLEAN: every quest hidden is no row; QL12: the lines come last, so a quest is opened on first
  }
  const sel = rows.find((r) => r.key === questSel);

  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  const railList = (items, cls) => {
    for (const q of items) {
      const b = el('button', `px-qrow${cls}${q.key === questSel ? ' on' : ''}`);
      b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(questTitleOf(q.name)));   // PX28
      if (q.clockSeconds != null) b.append(el('span', 'px-qtimed', '\u25c6'));
      b.onclick = () => { questSel = q.key; questReveal = true; render(); };   // AUDIT QUESTLINES UI-14
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
  // (notebook.js:"AddFinishedQuest(messages)"). Three sections is the shape the DATA has.
  const mains = active.filter((q) => q.main);
  // QL-OFFERED (2026-10-25, Lord Rumpkin: "My quest log ... has become congested"): a questline's step is its
  // line's - drawn under the line's row in Questlines, never a second time as a side quest (while the line is drawn)
  const drawnLines = new Set(lines.filter((r) => r.line).map((r) => r.line.id));
  const lineOfStep = (q) => { const at = lineStepOf(q.questName); return at && drawnLines.has(at.line.id) ? at.line.id : null; };
  const sides = active.filter((q) => !q.main && !lineOfStep(q));
  const section = (label, items, cls, first = false) => {
    rail.append(el('div', `px-qarch${first ? ' px-qfirst' : ''}`, label));
    if (items.length) railList(items, cls);
    else rail.append(el('div', 'px-qnone', '\u2014'));
  };
  // QL3: a section only while a reward waits - a quest's choice of gear, the first thing the journal has to ask
  if (offers.length) { rail.append(el('div', 'px-qarch px-qfirst', t('ql.journal.rewards', 'Rewards waiting'))); railList(offers, ' px-qreward'); }
  section(t('pause.journal.main', 'Main Quests'), [...mains, ...story], '', !offers.length);
  section(t('pause.journal.side', 'Side Quests'), sides, '');
  // QL12: the questlines - each row tagged with where it stands, a finished one dimmed as the archive is
  if (lines.length) {
    rail.append(el('div', 'px-qarch', t('ql.journal.lines', 'Questlines')));
    for (const q of lines) {
      const state = q.line?.state ?? 'running';
      const cls = ['px-qrow', 'px-qlinerow'];
      if (state === 'done') cls.push('done');
      if (q.key === questSel) cls.push('on');
      const b = el('button', cls.join(' '));
      b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(questTitleOf(q.name)));
      b.title = q.ladder ? t('ql.journal.ladderRow', 'Your guild\u2019s quests, rank by rank') : lineStateWords(state);
      b.onclick = () => { questSel = q.key; questReveal = true; render(); };   // AUDIT QUESTLINES UI-14
      rail.append(b);
      // QL-OFFERED: the line's step under way, under its line - its own quest's page, one press away
      if (q.line) railList(active.filter((s) => lineOfStep(s) === q.line.id), ' px-qstep');
    }
  }
  // JOURNAL-CLEAN: the hidden quests, drawn only when asked for, under their own heading - and the toggle that asks,
  // which names how many are hidden so a tidied journal never looks like quests were lost.
  if (questShowHidden && hidden.length) section(t('pause.journal.hidden', 'Hidden'), hidden, ' done');
  // QUEST-SHELF (2026-10-08, Mac: "All quests should be able to be abandoned and reclaimed"): the quests set aside, each
  // one press from coming back - a section only while there are any
  if (shelved.length) section(t('pause.journal.abandoned', 'Abandoned'), shelved, ' done');
  section(t('pause.journal.archived', 'Archived'), finished, ' done');
  const railAct = (label, onclick) => {
    const b = el('button', 'px-qrow done', label);
    b.style.cssText = 'font-size:12px;margin-top:6px';
    b.onclick = onclick;
    rail.append(b);
  };
  if (clean && finished.length) {
    const armed = journalCleanArmed === 'clear';
    railAct(armed ? t('pause.journal.clearArmed', 'Click again to clear archive') : t('pause.journal.clear', 'Clear archive ({n})', { n: finished.length }), () => {
      if (journalCleanArmed !== 'clear') { journalCleanArmed = 'clear'; render(); return; }
      journalCleanArmed = null;
      clean.clearFinished?.();
      if (String(questSel).startsWith('f:')) questSel = null;
      render();
    });
  }
  if (hidden.length) {
    railAct(questShowHidden ? t('pause.journal.hideHidden', 'Hide hidden ({n})', { n: hidden.length }) : t('pause.journal.showHidden', 'Show hidden ({n})', { n: hidden.length }), () => {
      questShowHidden = !questShowHidden;
      if (!questShowHidden && hidden.some((q) => q.key === questSel)) questSel = null;
      render();
    });
  }
  wrap.append(rail);

  const detail = el('div', 'px-qdetail');
  if (sel?.offer) {
    // QL3: a reward waiting - its quest's name, and its three pieces, each with its Take
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.offer.title)), el('span', 'px-qwing px-flip'));
    // AUDIT QUESTLINES UI-10: a Take ARMS on its first press and takes on the second - BOUNTY1's arming, as Abandon, Remove
    // and Clear archive do here: one press gave a choice away, and the focus then stood on the next reward's Take, so a
    // second Enter chose for a reward never looked at. Armed by the piece (`take:<offer>:<index>`, its button's own key)
    const takeKey = (i) => `take:${sel.offer.id}:${i}`;
    const armedTake = sel.offer.pieces.findIndex((_, i) => journalCleanArmed === takeKey(i));
    detail.append(head2, qlOfferDetail(document, sel.offer, (i) => {
      if (journalCleanArmed !== takeKey(i)) { journalCleanArmed = takeKey(i); render(); return; }
      journalCleanArmed = null;
      clean?.takeOffer?.(sel.offer.id, i); questSel = null; render();
    }, { armed: armedTake }));
  } else if (sel?.line) {
    // QL12: a questline - its story, its steps as the path walked, what it waits on and what it earns
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.line.title)), el('span', 'px-qwing px-flip'));
    detail.append(head2, qlLineDetail(document, sel.line, { titleText: (k) => TITLE_TEXT[k] ?? k }));
    // QL-OFFERED (the owner: a questline is TAKEN, never SENT): a line on offer - its Take up, arming on its first press
    // as Abandon, Remove and Take it up again do (the host's door - scenes/quest/questBridge.js journalClean.takeLine)
    if (sel.line.state === 'offered' && clean?.takeLine) {
      const acts = el('div', 'px-qacts');
      acts.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px';
      const armed = journalCleanArmed === sel.key;
      const go = el('button', 'act', armed ? t('ql.journal.takeUpArmed', 'Click again to take it up') : t('ql.journal.takeUp', 'Take it up'));
      go.title = t('ql.journal.takeUpTitle', 'Begin this questline: its first step starts now');
      go.onclick = () => {
        if (journalCleanArmed !== sel.key) { journalCleanArmed = sel.key; render(); return; }
        journalCleanArmed = null;
        questShelfSaid = clean.takeLine(sel.line.id)?.text ?? null;
        render();
      };
      acts.append(go);
      detail.append(acts);
    }
  } else if (sel?.story) {
    // STORY-AGAIN: the step that failed - what happened, and its one press (twice, BOUNTY1's arming)
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.name)), el('span', 'px-qwing px-flip'));
    detail.append(head2, el('p', 'px-note', t('quest.story.stalled', 'This step of the main story ended before the story could go on.')));
    const acts = el('div', 'px-qacts');
    acts.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px';
    const armed = journalCleanArmed === sel.key;
    const go = el('button', 'act', armed ? t('quest.story.againArmed', 'Click again to take it up') : t('quest.story.again', 'Take it up again'));
    go.title = t('quest.story.againTitle', 'Start this step of the main story again from the beginning, so the story can go on');
    go.onclick = () => {
      if (journalCleanArmed !== sel.key) { journalCleanArmed = sel.key; render(); return; }
      journalCleanArmed = null;
      const out = clean.startStoryAgain(sel.story.questName);
      questShelfSaid = out?.text ?? null;
      if (out?.ok) questSel = `a:${out.uid}`;
      render();
    };
    acts.append(go);
    detail.append(acts);
  } else if (sel?.ladder) {
    // QL12 (section 4.4): a guild's ladder - its quests by the rank that opens them
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.ladder.name)), el('span', 'px-qwing px-flip'));
    detail.append(head2, qlLadderDetail(document, sel.ladder));
  } else if (sel) {
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.name)), el('span', 'px-qwing px-flip'));   // PX28
    detail.append(head2);
    const isShelvedRow = String(sel.key).startsWith('s:');   // QUEST-SHELF: a quest set aside - its clock stopped, nothing to track
    // AUDIT QUESTLINES UI-8: nor a stamped quest with no journal entry yet (unloggedRail) - no clock, no place, and no Track:
    // the HUD's card reads the entries (ui/quest/questLens.js), so Track pinned a quest it never sees and the card went blank
    if (sel.entries?.length && !isShelvedRow) {
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
        const timer = el('span', `px-qtimer${urgent ? ' urgent' : ''}`, t('pause.journal.timeRemains', 'Time remains: {left}', { left: remainWords(sel.clockSeconds) }));
        meta.append(timer);
        armQuestTimer(timer, sel.key);
      }
      // GUIDE4: TRACK THIS QUEST on the HUD's card (ui/quest/questTracker.js), beside its clock - the card follows the quest
      // the journal last changed until the player chooses one here (or in the chronicle: the same toggle, one home).
      if (followOn() && sel.id != null) meta.append(trackButton(document, sel.id, questTitleOf(sel.name)));   // AUDIT GUIDE T2; T5: changed in place, the tab not rebuilt
      if (meta.childNodes.length) detail.append(meta);   // PX22: an empty meta line is a gap the eye reads as a mistake
      // GUIDE2: WHERE THE QUEST POINTS NOW, and the way there - DFU's own logbook click (HandleQuestClicks), which
      // this journal never had: the latest entry's target through the quest lens, in the find-place box's words.
      const where = questWhere(sel.written?.at(-1)?.message, 'px-qwhere');
      if (where) detail.append(where);
    }
    // QL2 (bible/06-Systems/Questlines-Arc.md section 6): a stamped quest's objectives, its choices and how it ended -
    // ui/questlines/qlJournal.js, the chronicle's own block too. DFU's quest (no `ql`) draws nothing here.
    { const block = qlObjectivesBlock(document, sel.ql); if (block) detail.append(block); }
    // BOUNTY1 (Mac: "i also dont see the bounty in my questlog means i cant abandon it?"): a bounty's two presses - Abandon
    // (twice: the first arms it, so a stray click gives nothing up) and, in a party, Share
    if (sel.entries && isBountyQuestId(sel.id)) {
      const acts = el('div', 'px-qacts');
      acts.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px';
      if (bountyQuestShareable(sel.id)) {
        const sh = el('button', 'act', t('pause.journal.share', 'Share with party'));
        sh.onclick = () => { shareBountyQuest(sel.id); render(); };
        acts.append(sh);
      }
      const armed = bountyAbandonArmed === sel.id;
      const ab = el('button', 'act', armed ? t('pause.journal.abandonArmed', 'Click again to abandon') : t('pause.journal.abandon', 'Abandon bounty'));
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
    // RVN7c (bible/12-Enhanced-AI/Feud-Arc.md 18.3): a hunt's one press - Abandon (twice, as a bounty's): its lair forgotten
    if (sel.entries && isHuntQuestId(sel.id)) {
      const acts = el('div', 'px-qacts');
      acts.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px';
      const armed = bountyAbandonArmed === sel.id;
      const ab = el('button', 'act', armed ? t('pause.journal.abandonArmed', 'Click again to abandon') : t('pause.journal.abandonHunt', 'Abandon hunt'));   // QUEST-AUDIT III SHELF-WORDS
      ab.onclick = () => {
        if (bountyAbandonArmed !== sel.id) { bountyAbandonArmed = sel.id; render(); return; }
        bountyAbandonArmed = null;
        abandonHuntQuest(sel.id);
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
      // QUEST-SHELF: a running quest ABANDONS - twice, BOUNTY1's arming (its clocks stop and its questor is free the moment
      // it goes) - where the quest may be set aside (scenes/quest/questBridge.js canAbandon); one set aside RECLAIMS in one press
      if (isShelvedRow && sel.id != null && clean.reclaim) {
        const rc = el('button', 'act', t('pause.journal.reclaim', 'Reclaim quest'));   // QUEST-AUDIT III SHELF-WORDS
        // its audit: the selection follows the quest only where it went - a refusal is said under the quest it refused
        rc.onclick = () => { const out = clean.reclaim(sel.id); questShelfSaid = out?.text ?? null; if (out?.ok) questSel = `a:${sel.id}`; render(); };
        acts.append(rc);
      // AUDIT QUESTLINES UI-8: and not on a quest with no journal entry yet - set aside, it was no row at all (the bridge's walk
      // lists a quest set aside by its entries), so no Reclaim could reach it
      } else if (sel.entries?.length && sel.id != null && clean.abandon && clean.canAbandon?.(sel.id)) {
        const armed = journalCleanArmed === `ab:${sel.id}`;
        const ab = el('button', 'act', armed ? t('pause.journal.abandonArmed', 'Click again to abandon') : t('pause.journal.abandonQuest', 'Abandon quest'));   // QUEST-AUDIT III SHELF-WORDS
        ab.onclick = () => {
          if (journalCleanArmed !== `ab:${sel.id}`) { journalCleanArmed = `ab:${sel.id}`; render(); return; }
          journalCleanArmed = null;
          const out = clean.abandon(sel.id);
          questShelfSaid = out?.text ?? null;
          if (out?.ok) questSel = `s:${sel.id}`;
          render();
        };
        acts.append(ab);
      }
      // QUEST-RESET (LostMyLeg: "an option that can fully reset a quest"): a running quest RESTARTS from its first step -
      // twice, the same arming - where it may be (scenes/quest/questBridge.js canRestart); the selection follows its new copy
      if (!isShelvedRow && sel.entries && sel.id != null && clean.restart && clean.canRestart?.(sel.id)) {
        const armed = journalCleanArmed === `rs:${sel.id}`;
        const rs = el('button', 'act', armed ? t('pause.journal.restartArmed', 'Click again to restart') : t('pause.journal.restart', 'Restart quest'));
        rs.title = t('pause.journal.restartTitle', 'Start this quest again from the beginning. Anything it placed or gave you is taken back');
        rs.onclick = () => {
          if (journalCleanArmed !== `rs:${sel.id}`) { journalCleanArmed = `rs:${sel.id}`; render(); return; }
          journalCleanArmed = null;
          const out = clean.restart(sel.id);
          questShelfSaid = out?.text ?? null;
          if (out?.ok) questSel = `a:${out.uid}`;
          render();
        };
        acts.append(rs);
      }
      // AUDIT QUESTLINES UI-8: Hide is an entry's - a row with none (unloggedRail) stayed drawn, still saying Hide, and the
      // Show hidden toggle never named it (the rail hides only the logged rows, ui/quest/questRail.js questRail)
      if (sel.entries?.length && sel.id != null && !isShelvedRow) {
        const isHidden = hidden.some((q) => q.key === sel.key);
        const hb = el('button', 'act', isHidden ? t('pause.journal.unhide', 'Unhide') : t('pause.journal.hide', 'Hide from journal'));
        hb.onclick = () => {
          if (isHidden) clean.unhide?.(sel.id);
          else { clean.hide?.(sel.id); questSel = null; }
          render();
        };
        acts.append(hb);
      } else if (!sel.entries) {
        const index = Number(String(sel.key).slice(2));
        const armed = journalCleanArmed === sel.key;
        const rb = el('button', 'act', armed ? t('pause.journal.removeArmed', 'Click again to remove') : t('pause.journal.remove', 'Remove'));
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
      if (questShelfSaid) { detail.append(el('p', 'px-note', questShelfSaid)); questShelfSaid = null; }   // QUEST-SHELF: said once
    }
    if (sel.entries) {
      // Active: the LATEST entry is the state of the quest; the trail
      // beneath it, newest first.
      const latest = sel.entries[sel.entries.length - 1];
      const desc = el('div', 'px-qdesc');
      for (const line of latest ?? []) desc.append(el('p', null, line));   // QL2: a quest with no entry yet has its objectives alone
      if (latest) detail.append(desc);
      if (sel.entries.length > 1) {
        detail.append(pxDivider(t('pause.journal.title', 'Journal')));
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
        : sel.when ? (sel.success ? t('pause.journal.completedAt', 'Completed at {when}', { when: sel.when }) : t('pause.journal.endedAt', 'Ended at {when}', { when: sel.when }))
          : (sel.success ? t('pause.journal.completed', 'Completed') : t('pause.journal.ended', 'Ended'));
      if (verdict) detail.append(el('p', `px-qverdict${sel.success ? ' won' : ''}`, verdict));
      const desc = el('div', 'px-qdesc');
      for (const line of sel.lines) {
        if (line === '') { desc.append(el('div', 'px-qgap')); continue; }
        desc.append(el('p', null, line));
      }
      // AUDIT QUESTLINES UI-5: how a stamped quest ended - the filed entry's side record (systems/notebook.js filedOutcome),
      // the archive's alone to draw: DFU's classic logbook draws the entry as DFU filed it
      const outcome = filedOutcome(log.finished?.[Number(String(sel.key).slice(2))]);
      if (outcome) desc.append(el('p', 'px-qoutcome', t('quest.outcome.filed', 'Outcome: {text}', { text: outcome })));
      detail.append(desc);
    }
  }
  // QUEST-SHELF: the words of a press, under the quest they speak of
  if (questShelfSaid) { detail.append(el('p', 'px-note', questShelfSaid)); questShelfSaid = null; }
  wrap.append(detail);
  body.append(wrap);
  // AUDIT QUESTLINES UI-14: on a phone the journal stacks (enhancedStyle.js PX4: the rail a strip over the page, at 480px),
  // and a row pressed below the fold drew its page out of sight - the page pressed for is brought into view, after the
  // repaint has put the scroll back (ui/domRepaint.js), as the broker's card is (ui/brokerWindow.js)
  if (questReveal) {
    questReveal = false;
    if (globalThis.matchMedia?.('(max-width: 480px)')?.matches) Promise.resolve().then(() => { if (detail.isConnected !== false) detail.scrollIntoView?.({ block: 'start' }); });
  }
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
  stopPost();   // SERVER-POST: and the mailbox's, and the envelope's count
  stopSeason();   // SEASON-BOOK: and the season window's
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
  homeMark.setAttribute('aria-label', t('menu.home.homeAria', 'DFO Online — main menu'));
  homeMark.append(brandMark());
  homeMark.onclick = () => go('home');
  h1.append(homeMark);
  brand.append(h1);
  side.append(brand);

  const rail = el('nav', 'rail');
  // UI-CALM (2026-10-14, a player on DFO Grimoire's rail: "here back to main menu is missing"): THE WAY HOME, SAID. The
  // wordmark above has always been it (PX1/PX2), and Escape - but a wordmark is not a door a player reads as one; the
  // rail's first row is, at the door the Main menu and over a game the window it came from
  const homeRow = el('button', 'railbtn railhome');
  homeRow.append(el('span', 'rk', mode === 'pause' ? t('menu.home.back', 'Back') : t('menu.home.aria', 'Main menu')));
  homeRow.onclick = () => go('home');
  rail.append(homeRow);
  for (const label of sections) {
    const id = idOf(label);
    // UI-CALM: on the enhanced front door's rail Offline's doors stand under their word, as they do on the door
    if (sections === SECTIONS_BOOT && label === HOME_OFFLINE[0]) rail.append(el('span', 'railgroup', t('menu.home.offline', 'Offline')));
    const b = el('button', `railbtn${id === section ? ' on' : ''}`);
    b.append(el('span', 'rk', railLabel(label)));   // L10N1b
    // RAIL_ACTS: Resume resolves on the rail rather than opening a
    // pane. Every other entry is a destination.
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id]) : () => go(id);
    rail.append(b);
  }
  side.append(rail);

  const foot = el('div', 'foot');
  foot.append(document.createTextNode(`${t('menu.foot.build', 'build')} `));
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
    pane.append(head(railLabel(sections.find((l) => idOf(l) === section))));   // L10N4: the rail's own word for the pane
    const body = el('div', 'body');
    if (confirming) body.append(confirmCard());
    else {
      ({
        continue: paneContinue, new: paneNew, load: paneLoad, online: paneOnline,   // ONLINE1
        test: paneTest,
        save: paneSave, exit: paneExit,
        overhauls: paneOverhauls,   // OVH1
        screenshots: drawShotsPane,   // LOAD1
        tutorials: drawTutorialsPane,   // TUT1
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
// window, and the menu pad's Back (ui/menu/menuPad.js) sends a press alone.
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
  // dial's own close (ui/enhanced/enhancedOverlays.js onTab) and the sheet's
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
  if (askUp) return;   // AUDIT GROWTH LANE3-9: and the Yes/No card answers its own keys
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
  // PRIVATE-REPORT (AUDIT PRIVATE-REPORT UI-2): a field's keys are the field's - but Escape in the mailbox's window leaves it,
  // as the notice and arena windows let it (noticeWindow.js): `/bug` lands the focus in the report form, and its Escape
  // had done nothing at all
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) && !(e.key === 'Escape' && t.closest?.('.px-postwin'))) return;
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
  // page's, which is the wizard's own rule (ui/enhanced/enhancedChargen.js: do
  // not preventDefault a key you did not take, or Tab stops moving
  // focus and the screen becomes unreachable to anyone driving it that
  // way).
  // ACC1f: the account window is the innermost thing Escape can close,
  // ahead of the confirm card and the help sheet - it is a modal over
  // the door, so the one press that means "not that" must close IT
  // rather than walk the screen out from under it.
  const back = accountOpen ? () => closeAccount()   // AUDIT RECOVERY-SET B1: Escape is held while the window shows codes
    : timersOpen && timersView ? () => { timersOpen = false; timersFocusBack = true; render(); }   // TIMERS1: the window first, ahead of the pause face's resume (AUDIT UI-11: a window that is drawn)
    : postOpen && postView ? () => { postOpen = false; postKeep = {}; postFocusBack = true; render(); }   // SERVER-POST: the mailbox's window, as the timers'
    : seasonOpen && seasonView ? () => closeSeason()   // SEASON-BOOK: the season window, as the timers'
    // AUDIT 32 P12: an act under way on the Stores page is set down first (nothing spent, said) - never the window
    : profActUnderWay() ? () => { setDownProfAct(); render(); }
    : confirming ? () => { confirming = null; render(); }
    : sheetOpen ? () => { sheetOpen = false; render(); }
      : controlsPromptOpen() ? () => dismissControlsPrompt()   // AUDIT KB1: the Controls pane's own prompt answers No first - it never leaves the section with the staged binds
      : section !== 'home' ? () => { const from = section; go('home'); if (mode !== 'pause') focusDoor(from); }   // PX1/PX2: a section backs out to the face (AUDIT L3 L1: the keyboard on its door)
        : mode === 'pause' && pauseTab === 'growth' && stageLive() ? () => { if (!growthBack()) onAction('resume'); }   // GROWTH3: a face in the tab answers first (a confirm, unaccepted stars, full screen)
        : mode === 'pause' ? () => onAction('resume')   // Escape on the pause face resumes
          : homeLevel !== 'top' && twoQuestionDoor() ? () => { const from = homeLevel; homeLevel = 'top'; render(); focusDoor(from); }   // UI-CALM: the offline doors back out to the two questions (AUDIT L3 L1: the keyboard back on Offline)
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
 * (see ui/enhanced/enhancedChargen.js). A locked pointer does not travel
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
  acctFlow = null; acctPaint = null;
  timersOpen = false;   // TIMERS1: and the timers window the same
  timersFocusBack = false;
  postOpen = false;   // SERVER-POST: and the mailbox's
  postFocusBack = false;
  postKeep = {};
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
  realmAsked = false; realmRows = null; realmBusy = false; realmLinesAsked = false; realmLineIds = null;   // REALM P1.3: the realm is asked again each visit
  realmWords = [takeRealmNotice(globalThis.sessionStorage)].filter(Boolean);   // REALM P1.3: why the last online boot came back here
  sections = mode === 'pause' ? SECTIONS_PAUSE : isEnhanced() ? SECTIONS_BOOT : SECTIONS_CLASSIC;   // FD1: one door, two rails
  // WHICH PANE OPENS. Both doors open on the PIXEL HOME (PX1/PX2) -
  // the face itself, every section one press away. Pause used to open
  // straight on SAVE GAME (U51's law: what Escape was pressed for);
  // PX2 trades one press of depth for the face Mac adopted, with Save
  // Game the second row a thumb meets and Resume the first.
  section = 'home';
  homeLevel = 'top';   // UI-CALM: every visit asks which world first
  pauseTab = 'system';
  // ...and THEN the caller's landing, if it named one. After the reset,
  // which is what keeps the reset the default rather than a thing this
  // has to work around. The tabbed window IS the pause home face, so a
  // landing sets the TAB and leaves the section alone.
  if (PAUSE_TAB_IDS.includes(at)) pauseTab = at;
  // DISC22-B: ...or a SECTION of the rail - the classic pause window's Controls button lands on Settings (the port's
  // whole settings screen, Controls among its categories), not on the home face a press away from it.
  else if (at && sections.some((l) => idOf(l) === at)) section = at;
  questSel = null;
  bountyAbandonArmed = null;   // AUDIT 28 B11: an armed Abandon never outlives the visit it was armed on
  journalCleanArmed = null;   // JOURNAL-CLEAN: ...nor an armed Remove or Clear archive
  questShowHidden = false;
  questReveal = false;   // AUDIT QUESTLINES UI-14: a press is this visit's
  statsSec = 'character';
  resetProfPages();   // PROF1: an armed change of specialisation never outlives the visit
  resetCompanionRoster();   // COMPANION-ROSTER: nor an armed Release
  holdSec = 'stable';   // HOLDINGS: the Holdings rail opens on its first page
  famSec = 'tree';   // LEGACY3: the Family rail opens on the tree, centred on the one played
  resetFamilyPages();
  resetHoldingsPages(); resetFleetPage(); resetCollectionsPage();   // ...and an act's word, an open name field, an armed press never outlive the visit
  resetGrowthTab(at);   // GROWTH1: the Growth rail on its landing's page (else the Level), the guide fresh, no face up
  statsAllSkills = false;
  sysSec = 'save';
  category = CATEGORIES[0].id;
  pickedKey = null;
  sheetOpen = false;
  confirming = null;
  optQuery = '';   // FT18: a fresh visit searches nothing (ORG2: over every tab)
  optFilter = 'all';
  pickedFeature = null;
  discardControlsStaging();   // FIX-F: a second visit never inherits the first one's staged binds
  seasonOpen = false;   // SEASON-BOOK: and the season window's (a visit's, as the timers' and the mailbox's above)
  seasonFocusBack = false;
  // PROF2: a landing on a professions page - the Stats tab at it (a home forge's press opens the Stores' forge); the
  // draw falls back to the character's own page when the professions are not the account's
  // HOLDINGS: the Professions page is the Stats rail's, the Stores page the Holdings rail's
  if (PROF_STATS_SECTIONS.some(([id]) => id === at)) { pauseTab = 'stats'; statsSec = at; }
  else if (PROF_HOLD_SECTIONS.some(([id]) => id === at)) { pauseTab = 'holdings'; holdSec = at; }
  else if (FAMILY_PAGE_SECTIONS.some(([id]) => id === at)) { pauseTab = 'family'; famSec = at; }   // LEGACY3: a Family page by name
  else if (growthPageAt(at)) pauseTab = 'growth';   // GROWTH1: a Growth page by name (its rail set by resetGrowthTab, above)
  else if (at === 'mailbox') postOpen = true;   // SERVER-POST: the mailbox's door (/mail, either skin) - the pause face with its window open
  else if (at === 'report') { postOpen = true; postKeep = { view: 'report' }; }   // PRIVATE-REPORT: `/bug` - the mailbox's window on its report form
  else if (at === 'season') { seasonOpen = true; seasonFocusIn = true; }   // SEASON-BOOK: `/season` - the pause face with the season window open
  else if (at === 'collections' || COLLECTION_PARTS.some(([id]) => id === at)) { pauseTab = 'holdings'; holdSec = 'collections'; if (at !== 'collections') setCollectionsPart(at); }   // AUDIT CARDS-5 D14: the Collections page by name, or one of its parts - AUDIT COLLECTIONS-II (lanes 2, 5): every part, the wardrobe's four too
  else if (at === 'companions') { pauseTab = 'holdings'; holdSec = 'companions'; }   // RVN-STARS: back from a sworn one's stars
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
    /** GROWTH5: a door about to put this window away (the sheet's key, the QuickDial's) asks first: whether a face on the
     *  Growth stage held the press (its unaccepted stars said once - the second press goes). */
    asksFirst: () => mode === 'pause' && pauseTab === 'growth' && growthAsks(),
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
      releaseShotsPane();   // LOAD1: the gallery's pictures and its listener
      stopPost();   // SERVER-POST: and the mailbox's ticks
      releaseTutorialsPane();   // TUT1: the next visit opens on the first page
      stopSeason();   // SEASON-BOOK: and the season window's
      releaseGrowthTab();   // GROWTH3: a face on the Growth stage goes with the window (full screen too)
      askUp?.();   // AUDIT GROWTH LANE3-9: and a Yes/No card standing over it
      // FIX-F: and the rebind pane's own capture listener, which is on
      // the DOCUMENT and would outlive this screen exactly as the one
      // above would.
      discardControlsStaging();
      // MEM-AUDIT (2026-10-23): and what still watched the last screen - the foot's observer (its reserve keeps the home's
      // whole tree, the sky's canvas with it) and the account card's paint and focus listener
      footObs?.disconnect?.(); footObs = null;
      acctPaint = null; acctOff?.(); acctOff = null;
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
        // SAV4 shipped the save manager (systems/save/saveSlots.js:"export function deleteSave"
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
