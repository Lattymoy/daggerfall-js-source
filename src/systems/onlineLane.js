// ONLINE IS THE ENHANCED LANE, WHOLE (OL1, Mac, 2026-09-14: "with
// online ... I definitely think I want any current and future
// enhancements/mods enabled on for online").
//
// AUDIT WORLD5 recorded that the classic and enhanced lanes diverge
// under one shared seed (the weather's hourly evolution is the enhanced
// lane's; a mod's roads and seasons are a mod's), so two players in one
// world could stand under two skies on two road networks. Mac's answer
// is not a per-switch rule but a lane: while the page is ONLINE, the
// skin is enhanced and every enhancement the port owns is on -
// whatever the player's shelf says, and whatever a probe's
// `?skin=classic` says. The shelf is not written: the forcing is a
// READ, for this page load, so the player's own choices stand again
// the moment they play offline.
//
// THE VENDORED MODS ARE NOT IN THAT SENTENCE ANY MORE (MODS-ONLINE-2,
// 2026-09-22, Mac: "Is it possible to allow all mods to be toggled on
// and off for online?"). Every mod's `Enabled` is the player's now,
// online as offline; the lane forces exactly the two switches the
// room's GROUND depends on. The reading that got there - why a
// damage formula, a foe's stats, a loot roll and a block were never
// shared to begin with, and why a road bed is - is written over
// ONLINE_ROOM_MOD_KEYS below.
//
// ONE HOME, THREE READ PATHS. The three places a switch is read -
// uiSkin.js (the skin), uiPrefs.js getPref (the port's own switches)
// and modSettings.js modSetting (a mod's switches) - each ask this
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
  // OVH3 (2026-09-24, Mac: "These overhauls need to adapt to online with ease. Online specific UI's will need to
  // remain"): THE SKIN IS THE PLAYER'S, ONLINE TOO. It was forced to 'enhanced' because the online panels - the chat,
  // the friends and party, the F-menu, the names over heads, player trade - were built only under that skin. They
  // mount on either skin now (scenes/world.js chatStart; ui/playerTradeDoor.js) and keep their own face over the
  // classic screens, so the UI Overhaul a player chose (systems/overhauls.js) is the one they play online. Nothing
  // the room agrees on reads the skin: it is what THIS screen draws.
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

/** The switches the lane deliberately leaves to the player (SURV-TIERS: and one tier, the survival pref) -
 *  the pin fails on a boolean uiPrefs key that is in neither list. */
export const ONLINE_PLAYERS_OWN_PREFS = [
  'touchAnalogStick', 'touchGyroLook', 'touchHaptics', 'touchFullscreen',   // TI2: how this phone is held
  'showFps',          // FPS1: a diagnostic over the game
  'chatHidden',       // CHAT-R2: whether THIS player wants the chat on screen - the room does not get a say in what someone looks at
  'peerClassSprites', // 2026-09-17: how OTHER players are drawn on THIS machine (animated class sprite vs paperdoll) -
                       // purely a local rendering choice, same shape as chatHidden above; it changes nothing the room agrees on
  'peerAttackSounds', 'peerFootsteps',   // PEER-FS1: and how OTHER players are HEARD on this machine - the same local-only shape
  'nightCrickets', 'distantHowl',        // SNDREP1: whether THIS player hears the night's crickets and the far howl - an ear, nothing the room agrees on
  'heldMap',          // MAP-TOGGLE: whether THIS player's maps are the held sheet or DFU's windows - a look, nothing the room agrees on
  'proceduralSky',    // EE1's legacy key, read only by the migration
];   // (RF4: grown by declareOnlinePrefs with the registry's 'player' answers - the dials)

/** DISC22-A (2026-09-24, Mac: "repair magical items should be enabled by default and required online"): THE DFU
 *  SETTINGS THE ROOM PLAYS BY - the fourth read path (settings.js getData asks here first, as getPref and
 *  modSetting do). AllowMagicRepairs is a rule of the economy every player meets at the same smith: one player able
 *  to mend an enchanted blade and another turned away at the same counter is two games in one town. Its OFFLINE
 *  default is the port's too (settings.js PORT_DEFAULTS); online it is not a choice. Values are DFU's own strings. */
export const ONLINE_FORCED_SETTINGS = Object.freeze({
  Controls: Object.freeze({ AllowMagicRepairs: 'True' }),
});
/** The forced raw value of a DFU `section/key` on an online page, else undefined. */
export function onlineForcedSetting(section, key, search) {
  return isOnlinePage(search) && Object.hasOwn(ONLINE_FORCED_SETTINGS[section] ?? {}, key) ? ONLINE_FORCED_SETTINGS[section][key] : undefined;
}

/** The forced value of a uiPrefs key on an online page, else undefined. */
export function onlineForcedPref(key, search) {
  return isOnlinePage(search) && Object.hasOwn(ONLINE_FORCED_PREFS, key) ? ONLINE_FORCED_PREFS[key] : undefined;
}

/**
 * THE MOD KEYS THE ONLINE LANE FORCES - AND THEY ARE THE GROUND.
 *
 * MODS-ONLINE-2 (2026-09-22, Mac: "Is it possible to allow all mods to
 * be toggled on and off for online?" / "So all mods can now be
 * toggled?"). The first answer was half of one: eight mods freed, eight
 * left forced because they sounded like world state. This is the other
 * half, and it is a READING of the port rather than a reading of the
 * names.
 *
 * WHAT THE ROOM ACTUALLY AGREES ON. The port is already owner-
 * authoritative everywhere a mod could disagree, by design and by pin:
 *
 *   - a blow's damage is the STRIKER's number and the host applies it
 *     without recomputing (dungeonContext applyHit: "The number is a
 *     peer's word and the host trusts it"), so PCAAO's formulas were
 *     never shared - each machine already rolls its own;
 *   - a foe's stats are minted where it SPAWNS (meanerMonsters edits
 *     makeEnemyEntity) and a peer sees a puppet the owner steps, so a
 *     joiner already fights the host's foes under the host's numbers,
 *     whatever the joiner's shelf says;
 *   - a corpse's loot is rolled and granted by the owner's word
 *     (WORLD6b-iii(c)), so Unleveled Loot's rolls are the owner's;
 *   - a blow AT a body is mitigated where it lands - hurtPlayer for me,
 *     damageFoe for the host's foe, both through damageShieldPool - so
 *     the Shield Widget's block is always the defender's own;
 *   - Oblivion leveling is written into a CHARACTER at creation and
 *     kept by that character; Handheld Torches is an item in my save
 *     with a light on my screen; Travel Options is my own journey
 *     (OL2 already spends no world time online).
 *
 * None of those reaches a second machine as a RULE. Each reaches it as
 * a RESULT, which is exactly what the wire carries.
 *
 * ONE THING IS DIFFERENT, and it is not a rule either - it is the
 * floor. Basic Roads rewrites TERRAIN HEIGHTS: terrainGen calls
 * smoothRoadHeights over the road beds, so which network is painted
 * (`Enabled`: Hazelnut's arrays or the port's own generated network,
 * BR3) and whether the beds are smoothed at all (`SmoothRoads`) decide
 * where the ground IS. Two players who disagree stand on two floors
 * along every road in the Bay, and a pose is a position on that floor,
 * so each sees the other sunk into or floating over the bed. That is
 * the room disagreeing about the world itself, and it is the only
 * place in the shelf where a switch does that.
 *
 * AND THIS WAS ALREADY BROKEN. `SmoothRoads` is a DIAL, and the old
 * lane forced only `Enabled`, so the smoothing has been the player's
 * on every online page since the lane was written - the heights
 * already diverged, quietly, for anyone who turned it off for the
 * "minor extra performance" its own description offers. Forcing
 * `Enabled` bought the room nothing while its own dial gave the floor
 * away. So the table is by KEY, not by mod.
 *
 * `RiversAndStreams` is NOT here, and that is measured too:
 * SMOOTHED_TILES is {46, 0xff} - the road and track beds - and the
 * painter lays a road before it ever considers water (roadPainter
 * paintRoads), so a river paints tiles and never moves a height. It is
 * paint, and paint is the player's.
 *
 * MODS-ONLINE-4 (2026-09-22, Mac: "What about player balance?"): AND
 * THE READING ABOVE ANSWERED THE WRONG QUESTION FOR THREE OF THEM.
 *
 * "Does it desync?" and "does my switch reach another player?" are not
 * the same question, and the passes above only asked the first. The
 * port really is owner-authoritative, so nothing below breaks a room -
 * but OWNERSHIP IS NOT PRIVACY. Two of the places a machine owns
 * something are places its answer is handed to everyone else:
 *
 *   THE HOST OWNS THE DUNGEON'S FOES. A world room's layout foes are
 *   streamed by its host and stood as puppets by everyone else
 *   (WORLD2), so the host's Meaner Monsters and PCAAO are not "the
 *   host's own game" - they are what the whole party fights. A host
 *   with either off runs a softer dungeon for four other people who
 *   never chose that, and none of them can see why.
 *
 *   ITEMS CHANGE HANDS. A corpse's pile is granted to peers
 *   (WORLD6b-iii(c)) and a room's containers are shared (WORLD4), so
 *   Unleveled Loot's rolls do not stay with the roller. One player
 *   rolling level-scaled drops and handing them across is two
 *   rulesets feeding one economy.
 *
 * So these three are the room's - not because a room where they
 * differ falls apart, but because a room where they differ is one
 * player's setting spending someone else's evening.
 *
 * WHAT STAYED THE PLAYER'S AFTER THE SAME QUESTION. Climates &
 * Calories reaches another player only through a corpse's FOOD -
 * meat and rations, no power and no gear - and forcing it means
 * nobody may opt out of freezing to death, which is a live
 * complaint; the Shield Widget, Handheld Torches, Oblivion leveling
 * and Travel Options only ever make the player's OWN run harder or
 * easier, and the last two of those mostly harder.
 *
 * So: what the lane forces is the floor the room stands on, and the
 * three switches that spend a stranger's evening. (CORPSE-FOOD, 2026-09-23: the food itself is the room's - minted online whatever the tier, survival/switch.js corpseFoodOn - and the tier stays the player's.)
 */
export const ONLINE_ROOM_MOD_KEYS = Object.freeze({
  'roads-hazelnut': Object.freeze({
    Enabled: true,        // which network is painted, and so which beds are smoothed
    SmoothRoads: true,    // whether the beds are smoothed at all - the dial that gave the floor away
  }),
  // WOD1 (2026-09-23): the second floor. World of Daggerfall levels the
  // ground under every camp and rock field it stands (LocationLoader.cs
  // lerps the heightmap toward the site's mean) and stands collidable
  // rock in it, so two players who disagree walk two terrains and pass
  // through each other's boulders - the roads' own reason, word for
  // word. Its one switch is the room's.
  'world-of-daggerfall': Object.freeze({ Enabled: true }),
  // MODS-ONLINE-4: the host's foes are the party's foes.
  meanerMonsters: Object.freeze({ Enabled: true }),
  pcaao: Object.freeze({ Enabled: true }),
  // MODS-ONLINE-4: a roll that leaves the roller's hands.
  unleveledLoot: Object.freeze({ Enabled: true }),
  // RRI1/RR1 (merged 2026-09-23), asked MODS-ONLINE-4's question - "does
  // my switch reach another player?": Roleplay & Realism: Items' custom
  // items stand in shared containers (lootRebalance), on the host's foes
  // (realisticEnemyEquipment) and in the piles a killer grants to peers
  // (newWeapons, newArmor) - a peer with the class unregistered receives
  // a nameless record, Unleveled Loot's exact shape. Its formula and
  // pricing dials are the player's own. Roleplay & Realism adds a
  // LOCATION to a region (RR3b's world data, under Enabled) - the ground
  // - and rewrites the host's foes' behaviour (enemyAppearance: a
  // Sorcerer that casts); every other switch is the player's own run.
  'roleplay-realism-items': Object.freeze({ Enabled: true, newWeapons: true, newArmor: true, lootRebalance: true, realisticEnemyEquipment: true }),
  // MODS-ONLINE-5 (2026-09-23, Mac, asked which of RR's switches to
  // force "especially when it comes to balance", then: "Yeah its the
  // reason we forced PCAAO"): ONE RULESET PER ROOM. PCAAO was forced
  // whole - its player-side formulas with its foe-side ones - and RR's
  // six combat overrides are the same kind of thing (FormulaHelper
  // overrides on the striker's own blow, the wearer's own armor, the
  // walker's own load), so they take the same answer for the same
  // reason, forced to the mod's own shipped defaults. And ONE that is
  // an exploit rather than a preference: intensive training spends four
  // days of world time for its +4, and the shared clock refuses the
  // days (CLOCK-REFUSAL) - online it would be four points for nothing.
  // Forced OFF, which is what the mod ships anyway.
  'roleplay-realism': Object.freeze({
    Enabled: true, enemyAppearance: true,
    advancedArchery: true, weaponSpeed: true, weaponMaterials: true, classicStrengthDamageBonus: false, equipDamage: true, encumbranceEffects: true,
    'RefinedTraining.intensiveTraining': false,
  }),
});

/**
 * THE MODS WHOSE EVERY SWITCH IS THE PLAYER'S, ONLINE.
 *
 * Hand-written, and that is the point: test/onlinelane.test.js walks
 * MOD_SETTINGS and fails on a vendor that is in neither this list nor
 * ONLINE_ROOM_MOD_KEYS, so a new mod cannot land without someone
 * answering the question above for it. A list derived from the table
 * would agree with the table by construction and pin nothing.
 *
 * AUDIT-WH R8's own case (world-tooltips) and MODS-ONLINE's seven are
 * kept first, with the reason each was freed; the eight below them are
 * MODS-ONLINE-2's, each with what the port does instead of sharing it.
 */
export const ONLINE_PLAYERS_OWN_MODS = [
  // AUDIT-WH R8: a readout is the player's - it stands nothing, rolls
  // nothing, writes nothing and is not on the wire.
  'world-tooltips',
  // MODS-ONLINE (2026-09-22): what draws on your own screen and nowhere else.
  'dynamic-skies',         // the sky dome over a weather the room already shares (WORLD5 rolls it; this only paints it)
  'seasons-iliac-bay',     // which texture archives load for the season - a swap in front of the same terrain
  'weapon-widget',         // the first-person weapon's own motion; no damage, no timing, no attack state
  'eye-of-the-beholder',   // third person and your own billboard; peers are drawn by remotePlayers either way
  'ambient-text',          // flavour lines on your own screen
  'immersive-footsteps',   // your own footstep audio
  'better-ambience',       // ambient audio and the dungeon's darkness, both drawn locally
  // MODS-ONLINE-2 (2026-09-22): what the port already resolves at the
  // machine that owns the actor, so the wire carries the result and
  // never the rule - and which MODS-ONLINE-4 then re-asked "does my
  // switch reach another player?", moving three of them back.
  'shield-widget',               // the block is the DEFENDER's - damageShieldPool runs where the blow lands
  'handheld-torches',            // an item in my save with a light on my screen
  'oblivion-remaster-leveling',  // written into a character at creation and kept by that character
  'travel-options',              // my own journey; OL2 already spends no world time online
  'diverse-weapons',        // DW1: the first-person weapon's and the icons' art - drawn on your own screen and nowhere else
  'horse-cart-and-cargo',   // HCC: whose horse and wagon stand where is the player's own; the others only SEE them (the online half rides the pose and the cell's frame, never a switch of the room's ground)
];

/** The forced value of a mod's switch on an online page, else undefined -
 *  the table above, by vendor AND key, so a mod may have one switch the
 *  room owns and the rest the player's. */
export function onlineForcedModSetting(vendor, key, search) {
  const room = ONLINE_ROOM_MOD_KEYS[vendor];
  if (!room || !Object.hasOwn(room, key)) return undefined;
  return isOnlinePage(search) ? room[key] : undefined;
}
