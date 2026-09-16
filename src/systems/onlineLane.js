// ONLINE IS THE ENHANCED LANE, WHOLE (OL1, Mac, 2026-09-14: "with
// online ... I definitely think I want any current and future
// enhancements/mods enabled on for online").
//
// AUDIT WORLD5 recorded that the classic and enhanced lanes diverge
// under one shared seed (the weather's hourly evolution is the enhanced
// lane's; a mod's roads and seasons are a mod's), so two players in one
// world could stand under two skies on two road networks. Mac's answer
// is not a per-switch rule but a lane: while the page is ONLINE, the
// skin is enhanced, every enhancement the port owns is on, and every
// vendored mod is enabled - whatever the player's shelf says, and
// whatever a probe's `?skin=classic` says. The shelf is not written:
// the forcing is a READ, for this page load, so the player's own
// choices stand again the moment they play offline.
//
// ONE HOME, THREE READ PATHS. The three places a switch is read -
// uiSkin.js (the skin), uiPrefs.js getPref (the port's own switches)
// and modSettings.js modSetting (a mod's `Enabled`) - each ask this
// module first. Nothing is forced at a mount site, because a port that
// forces at forty-seven `isEnhanced()` sites is a port where the
// forty-eighth is missed. And the FUTURE half of Mac's sentence is a
// pin, not a promise: test/onlinelane.test.js walks PREF_DEFAULTS and
// MOD_SETTINGS and fails on any boolean switch this module has neither
// forced nor declared the player's own, so a new enhancement cannot
// land without answering the question.
//
// What stays the player's: the DIALS (grass density, cloud quality,
// land view distance - a machine that cannot hold the full field keeps
// the lane at a lower cost), the touch knobs, the FPS counter, the
// HUD scale and the text size - none of them decides what the world
// is, only how this machine draws it. The URL kill doors the probes
// ride (`?sky=classic`, `?water=off`, `?evolve=off`) stay doors: an
// online page never carries one.

/** The page is online: `?online` is on the URL (main.js sets it for
 *  Play Online and deletes it on every other door - and WRITES IT TO
 *  THE URL through publishBootParams below, which is what makes this
 *  read true). Injectable for node; a page without a location is never
 *  online. */
export const isOnlinePage = (search = globalThis.location?.search ?? '') => new URLSearchParams(search).has('online');

/** The keys main.js's front door DECIDES per choice (F12's law: set on
 *  the door that wants them, deleted on every other) - and so the keys
 *  a stale URL must not carry into the menu that decides them. */
export const BOOT_DOOR_KEYS = Object.freeze(['load', 'online', 'loadkey', 'test', 'classic', 'classicload']);

/**
 * MAC-N3 (2026-09-16, Mac: "Chat UI not visable with classic in online
 * mode"): THE BOOT'S PARAMS ARE THE URL, or the lane reads nothing.
 *
 * main.js builds `params` from location.search, and the front door
 * SETS `online` on it for Play Online - on the in-memory copy. Nothing
 * ever wrote that copy back, so `location.search` stood at whatever
 * the player typed (nothing) and isOnlinePage above - the one read
 * uiSkin, getPref and modSetting all go through - answered false on
 * every real online session. The whole lane OL1 records was live for
 * a URL typed by hand and for the probes, and dead for the button:
 * a player with Classic stored played online on the classic skin,
 * and the chat is the enhanced skin's DOM panel (world.js chatStart),
 * so there was no chat. The relay itself was fine, because the world
 * host reads `params.has('online')` off the copy.
 *
 * ONE HOME. The fix is not a second read path (a latch main.js could
 * set beside the URL - two truths, and the next reader picks one):
 * the boot publishes the params it decided to the URL it read them
 * from, before the world boots, and every `location.search` reader
 * in the tree sees the same page the world host does. The empty-value
 * spelling (`?world` not `?world=`) is the menu's own test door's.
 *
 * Answers the search string it wrote (or would have), for the pins. A
 * history that refuses (a scheme without the History API) is warned
 * about and not fatal - the boot still runs; the lane is what is lost,
 * and it is lost LOUDLY.
 */
export function publishBootParams(params, { history = globalThis.history, location = globalThis.location } = {}) {
  const body = String(params).replace(/=(&|$)/g, '$1');
  const search = body ? `?${body}` : '';
  if (!history?.replaceState || !location) return search;
  if (location.search === search) return search;
  try { history.replaceState(history.state ?? null, '', `${location.pathname}${search}${location.hash ?? ''}`); }
  catch (e) { console.warn('[boot] the URL could not be written - the online lane reads it and will not see this session:', e?.message ?? e); }
  return search;
}

/** Every port-owned switch the online lane forces, and the value it
 *  forces. The skin is here too: uiSkin.js reads it through
 *  onlineForcedPref before its own override. RF4: the FEATURE switches
 *  (the enhanced outdoors, AI, combat visuals, water, loot rarity) are
 *  declared on their registry rows (`online`) and land here through
 *  declareOnlinePrefs at the registry's load - this table holds only
 *  the two the registry has no row for. */
export const ONLINE_FORCED_PREFS = {
  skin: 'enhanced',
  mwArms: true,   // the Morrowind arms build at boot where the archives are attached (weaponRig.js autoBuildArms guards the data); without them the doll stands, as offline
};
/** RF4: the registry's door - `true`/`false` forces the key online,
 *  `'player'` leaves it to the player by name. Idempotent. */
export function declareOnlinePrefs(table) {
  for (const [key, answer] of Object.entries(table ?? {})) {
    if (answer === 'player') { if (!ONLINE_PLAYERS_OWN_PREFS.includes(key)) ONLINE_PLAYERS_OWN_PREFS.push(key); delete ONLINE_FORCED_PREFS[key]; }
    else if (typeof answer === 'boolean') { ONLINE_FORCED_PREFS[key] = answer; const i = ONLINE_PLAYERS_OWN_PREFS.indexOf(key); if (i >= 0) ONLINE_PLAYERS_OWN_PREFS.splice(i, 1); }
  }
}

/** The boolean switches the lane deliberately leaves to the player -
 *  the pin fails on a boolean uiPrefs key that is in neither list. */
export const ONLINE_PLAYERS_OWN_PREFS = [
  'touchAnalogStick', 'touchGyroLook', 'touchHaptics', 'touchFullscreen',   // TI2: how this phone is held
  'showFps',          // FPS1: a diagnostic over the game
  'chatHidden',       // CHAT-R2: whether THIS player wants the chat on screen - the room does not get a say in what someone looks at
  'proceduralSky',    // EE1's legacy key, read only by the migration
];   // (RF4: grown by declareOnlinePrefs with the registry's 'player' answers - the dials)

/** The forced value of a uiPrefs key on an online page, else undefined. */
export function onlineForcedPref(key, search) {
  return isOnlinePage(search) && Object.hasOwn(ONLINE_FORCED_PREFS, key) ? ONLINE_FORCED_PREFS[key] : undefined;
}

/** The one mod key the lane forces: every vendored mod's `Enabled`.
 *  A mod's other switches (a fog density, a material swap) are the
 *  player's, as its own modsettings would leave them. */
export const ONLINE_FORCED_MOD_KEY = 'Enabled';

/** The forced value of a mod's switch on an online page, else undefined. */
export function onlineForcedModSetting(vendor, key, search) {
  return isOnlinePage(search) && key === ONLINE_FORCED_MOD_KEY ? true : undefined;
}
