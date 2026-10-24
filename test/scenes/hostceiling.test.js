// HOST-SPLIT (2026-10-15, bible/01-Overview/Host-Split.md) - THE HOSTS DO NOT GROW.
//
// Each host keeps its whole state in ONE function's scope, and that scope grew
// faster than anyone could take it apart: world.js went from 8,897 lines to
// 36,374 in the month to 2026-10-14, nearly all of it bootWorld. Moving code out
// of a scope that grows ~850 lines a day is a race that cannot be won, so the
// hosts get ceilings: new behaviour goes into a module the host wires (fishHost.js,
// merchantYardsHost.js - a module that owns its state, constructed once), and the
// host's own function does not lengthen. Measured with tools/hostScope.mjs's own
// finder, so the ceiling and the map read the same function.
//
// AUDIT HOST-SPLIT 0 (2026-10-15), two laws of the ceiling's own:
// - IT COUNTS CODE. A line of comment is no weight - a third of bootWorld is the
//   bible's own explanation, and a ceiling on raw lines made deleting it the
//   cheapest way to make room.
// - IT GATES A CHANGE, NEVER A DEPLOY. Every open pull request is measured
//   against the base it last saw, so two that each fit can land together and
//   overflow; on the push that deploys them that is no reason to hold the
//   deploy (deploy.yml and relay-deploy.yml run the suite). The ceiling holds
//   on a pull request (GITHUB_EVENT_NAME pull_request*) and on a contributor's
//   own machine (no GITHUB_EVENT_NAME) - an overflow on main is the next pull
//   request's to fix, by moving code out or by a raise with its reason.
//
// LEGIBLE 1 (bible/01-Overview/Readability-Arc.md) added a third:
// - IT IS BLIND TO LAYOUT. The ceiling counts LOGICAL lines (tools/hostScope.mjs
//   logicalLines: statements, object and class entries, switch cases and the
//   implicit returns of expression arrows), not physical ones. Counting physical
//   lines made splitting a crowded line cost room and joining two lines free it,
//   so the cheapest way to fit a change was to cram it. Every ceiling and ROOM
//   were converted on 2026-10-19 with the room each host had then, so the
//   conversion gave no host room it did not already have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModule, findHostFunction, logicalLines } from '../../tools/hostScope.mjs';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const EVENT = process.env.GITHUB_EVENT_NAME;
const GATED = !EVENT || EVENT.startsWith('pull_request');
const SKIP = GATED ? false : `the ceiling gates a change, never a deploy (${EVENT})`;

/** The room a ceiling leaves above its host, in logical lines - a fix's worth, not a feature's (250 code lines before
 *  LEGIBLE 1, at the 1.6 logical lines per code line the hosts measured then). */
const ROOM = 400;
/** Where new code goes instead, by the host's shape. */
const MODULE = 'a module the host wires (src/scenes/fishHost.js is the shape)';
const METHOD = 'a Room method of its own (the SCALE5 arms\' shape)';
/** Each host's one-scope function and its ceiling in logical lines: its length when measured plus the room it had.
 *  A slice that moves code OUT lowers its ceiling in the same change (the second test makes it). Raise one only with
 *  the reason written beside it: the ceiling is the line between wiring a module in and growing the knot. Each row's
 *  history, and the code-line ceilings these replaced, are in bible/01-Overview/Host-Split.md and Readability-Arc.md. */
const CEILINGS = [
  ['src/scenes/world.js', 'bootWorld', 36_387, MODULE],   // KETCH x MAIN (2026-10-24, the merge): the Ketch's wiring, 57 logical lines (AUDIT KETCH's 4 and KETCH's 53, below), on main's 36,330 -> 36,387. AUDIT KETCH (2026-10-24, the owner: "Its time to be a deep audit on this and ensure absolute perfection"; bible/01-Overview/audits/Audit-Ketch.md): the wiring alone, 4 logical lines, 36,365 -> 36,369 - the hub link's hand of my Ketch receipt (L1-2), the spent word and the save the client's own pool asks for (L1-2, L3-13), and the crash's door and the realm save's landed records reaching it (L2-2, L2-3); the pool, its ray, its pictures and its shares live in scenes/ketch/ketchClient.js and ketchShares.js. KETCH (2026-10-24, the owner: "A new quest line and world event that takes you to the skies"; bible/11-Multiplayer/Sky-Ketch.md): the wiring alone, 53 logical lines, 36,312 -> 36,365 - the sky-ketch's client constructed (scenes/ketch/ketchClient.js createKetchClient: its 24 reads), its word, its frame, its sky's draw, its room's key, its mark, the deck host's two seams, the floor's pool and the Sailwalk's traversal; everything it does is the module's. STAFF-VIEW1 (mob, 2026-10-23: "np player esp in staff panel?", "i need staff panel to have esp"): the wiring alone, 17 logical lines on main's count at the fold of the staff panel's five features, 36,295 -> 36,312 - the staff tags, Shift+M and a tag's follow live in scenes/staffViewHost.js and ui/staffTags.js, and these are the lines that hand it the follow, my glyphs, the chat's links, the travellers, the open air's foes, the travel view's key and state, the canvas and the notice line, and put it in the names pass, the travel view's marks and mark click, and the key ladder past its latch. SEA-DROPS (2026-10-23): 1 logical line, 36,296 -> 36,297, and 36,295 at the merge with main (its own host 36,282) - the boats' collider sync (csaSyncColliders) tells the collider its posed buckets moved (posesMoved), so their boxes are kept between syncs; the sync is the one place that carries them (player/collider.js holds the rest). SEA-DECK (FIELD BUGS 2026-10-23): 10 logical lines of wiring past the room DECK-POSE's 3 had taken - 36,284 -> 36,296 at the merge with main (its own host 36,283) - the sea's ships carry through the host's deck door (naval deps `deck`: the body, its facing and the eye taken again), and that door's three answers are hoisted so CSA-K's carry and the sea's are one (deckMayCarry, deckGround, deckCarry); the carry itself is scenes/naval/seaDecks.js. ACCOUNT-HOMES + GUILD-HALL-SALE (#653): 36,284 -> 36,282 - KNIGHT-HOUSE's boot deed holds (holdRealmDeedsOnline) out to scenes/homesBootHost.js beside ACCOUNT-HOMES' sweep, which lives there too; in, the wiring: the module built, its two calls, the line's houses whole and the hall's sale handed over. AURA-STALL (#1137): 3 logical lines out, 36,287 -> 36,284 - the aura pass built through its door (render/glProgram.js compiledPass) where the host had held its own try-once latch. STAFF-PANEL5 (the staff panel's relay release, 2026-10-22: 36,264 -> 36,287): the wiring alone - follow (scenes/staffFollowHost.js), Message on screen (net/staffMessages.js) and the freeze and staff chat (scenes/staffFreezeHost.js) each live in their own module, and these are the lines that hand the host's pose, chat tab, motor and camera to them; STAFF-PANEL2 and STAFF-PANEL2-CHATMENU (mob, 2026-10-22: "remove the report buttons iunch for admin and mods", "replace them follow mute freeze tp ban and other things we use for players", "in chat"): 8 logical lines, 36,256 -> 36,264 - the chat safety host is handed the staff member's glyphs and a TP by the line's socket (`glyphs`, `teleport`), and the staff TP's ask takes a socket `{ id }` as well as a name; the menu itself lives in chatSafetyHost.js, these are the host's own state it reads. TV-PACE REVERTED (the owner, 2026-10-22, at BOARD-SIFT's merge): 1 logical line out, 36,257 -> 36,256 - the frame no longer sets the travel view's pace cap. AUDIT PISTOLET A1 (merged beside TV-PACE, which had set the ceiling at the host's own count): 1 logical line, 36,256 -> 36,257 - the duel's arrow door hands its strike-out `{ off }` for a pair's off-hand shot, as each melee door already hands the striking rig's (duelStrikeOut's own option, at the door's own call - a fix that cannot live elsewhere). TV-PACE (#1059): 1 logical line, 36,255 -> 36,256 - the frame sets the travel view's pace cap (setTravelViewPaceCap, its value the mount's upkeep: x10 on foot or hungry, x20 fed), merged beside CRAFT-WRITS with its own check red on this count. CRAFT-WRITS: 12 logical lines in at the merge of main, 36,243 -> 36,255 - the crafting writs' host made once and named on the Work tab (its five getters over bootWorld's own player, realm session, checkpoint, save and book; scenes/craftWritHost.js holds the rest, Professions-Arc section 49). FIELD BUGS 2026-10-21d: 8 logical lines in at the merge of main, 36,235 -> 36,243. PARTY-PING: 77 logical lines of wiring that cannot leave the host (the look, the draw, the urgent pose), 36,158 -> 36,235. OW-HITCH: 13 logical lines out - the ground sets (groundLayersOf, loadGroundSet) to scenes/groundSets.js createGroundSets, the ceiling down by them (36,151 -> 36,138). WITCH1: 35 logical lines out - the Hollows' slots kept (sdSlotsKept) to systems/superDungeon/sdSlots.js - and the Witches' Festival's wiring (19) in, the ceiling down to what stands (36,187 on main at the merge); FIRM-STARS (HUD patch, 2026-10-20): +4 for setHudPauseAt's one statement - the stars' tile opens a pause page by name, which needs this scope's `modes` and `hudCtx` (the /mail door's own pair); the patch fit the 36,233 it was cut against and landed on 36,183. FIELD BUGS 2026-10-19f: 32 logical lines out - DISENCHANT-SAID's list to profPages.js disenchantableOf (8), BOSS-DOT's serpent door to scenes/gate/standInSpell.js createSerpentSpell (24) - TOWN-EXIT's six (tvJoinedLegs' body) back with its retirement; at the merge of main (PASSAGE took the room its own wiring found) the ceiling stands at the merged host, 36,233 -> 36,196, 36,198 at the next (main's own two lines, 36,228 -> 36,230 there) 36,201 at the third (main's own three, 36,230 -> 36,233) and 36,183 at the fifth (main's OW-DUNGEON-SIZE moved its own out, 36,233 -> 36,209 there): the lines the moves freed are not room to grow PERF-V8 x SOUNDSCAPE (2026-10-24, CI after the merge): 2 logical lines, 36,328 -> 36,330 - the music chain's feed (the sea's score among the holders) runs as a closure of its own (frameMusic), the frame's bytecode 46,309 -> 45,895 against the three quarters' 46,080 (test/scenes/perfv8.test.js). AUDIT SOUNDSCAPE (2026-10-24, the owner: "Audit this and ensure its perfect"): 3 logical lines of wiring, 36,334 -> 36,337 on its branch, 36,328 at its merge with main (main's STAR-CLEAR took 9 out, 36,307 -> 36,298) - the soundscape handed the naval host's deck test (any ship's deck is the sea's: a boat of mine at anchor, a sea ship's, a peer's - S2), her heading's law (boatForward: the spray over her bow, the bell on her deck - S3) and the naval host's battle word for the fight's song (the watch's alarm and a boarding, where hostileNear gave a dark ship away - M1, M2), the frame's time scale out (the bells judge the clock's own pace - S9). SOUNDSCAPE + HORSE-VOICE (the owner, 2026-10-24: "enhancing sound and ambience, different music and ambience sounds for sailing, more varied horse sounds, amd whatever else we could improve"): the wiring alone, 28 logical lines, 36,306 -> 36,334 at its merge with main (36,312 -> 36,340 on its branch) - the soundscape lives in scenes/soundscapeHost.js and systems/soundscape/, the horse's voices in systems/horse/horseVoice.js, and these are the lines that build the soundscape (handed the host's own doors and objects as they are: the deck under me, the sail runtime, the sea fight's word, the map's water, Deep Waters' player, the town's rect and the living towns' index, the doors), frame it beside the wind, stop it on the modal frame, put its score in the music's chain, and hand the mount rig the ground's kind, foes in sight and horse care's breath. STAR-CLEAR (2026-10-24): 9 logical lines out, 36,307 -> 36,298 at its merge with main (36,306 -> 36,297; 36,312 -> 36,303 on its branch) - the clearing set's memo (the gate's, the arches' and now the fallen stars') to world/gate/gateClearance.js gateClearMemo, where the host had kept its three inputs and its set by hand; the stars' list is the starfall host's own (scenes/starfall/starfallHost.js starClears). AUDIT FOE-KEEPS (2026-10-24): 1 logical line out, 36,308 -> 36,307 - the referee's fall moved beside the kill it makes (wildZone.js wildDeathAtHand, wildFallHeard), the rise and the Resurrect reading the kill from it (H1, H4). FOE-KEEPS (2026-10-24, the owner: "I dont want people to lose everything they have"): 5 logical lines out, 36,313 -> 36,308 - a death to a foe asks no drop (wildDeathBegin) and the drop's nonce path goes with it (wildTakeDrop: the receipt alone). CREW-TRADE (2026-10-23): 4 logical lines out, 36,317 -> 36,313 at its merge with main (36,312 -> 36,308 at the one before, 36,295 -> 36,291 on its branch) - the exchange's tab is handed the shipwright's window's model itself (harbourOffice.js exchange reads her hold, her room and, new, her crew off it) where the host had built a second object of three of its fields. STAFF-TAG-MENU (mob, 2026-10-24: "when u lcick on someon", "i mean the pop up") and STAFF-FLATMAP (mob: "did u get the flat map done?"): the wiring alone, 4 logical lines, 36,313 -> 36,317 - the staff view handed the chat safety host's player acts (scenes/chatSafetyHost.js playerActions) and the politic map's index; the menu lives in ui/staffTags.js, the flat map in scenes/staffFlatMapHost.js and ui/staffFlatMap.js. ROCKET1 (the owner, 2026-10-23: "/event rocket"): the wiring alone, 4 logical lines, 36,309 -> 36,313 on main's count at the merge (36,312 -> 36,316 on its branch) - the show lives in scenes/rocketHost.js, world/rocketEvent.js and render/rocketPass.js, and these are the lines that build it, hand it the hub's word beside the dread's and the sun baby's, frame it and draw it. EVENTS1 (the event board, bible/10-UI/Event-Board.md) at the merge with main: 36,311 -> 36,309, its two logical lines less (AUDIT EVENTS1 C10) - the Timers source's raid list to systems/raidingParties.js raidTimerList, the player's pixel, the three sites and the raids' own region on the source paid for by it. STAFF-VIEW1 (mob, 2026-10-23: "np player esp in staff panel?", "i need staff panel to have esp"): the wiring alone, 17 logical lines on main's count at the fold of the staff panel's five features, 36,295 -> 36,312 - the staff tags, Shift+M and a tag's follow live in scenes/staffViewHost.js and ui/staffTags.js, and these are the lines that hand it the follow, my glyphs, the chat's links, the travellers, the open air's foes, the travel view's key and state, the canvas and the notice line, and put it in the names pass, the travel view's marks and mark click, and the key ladder past its latch. SEA-DROPS (2026-10-23): 1 logical line, 36,296 -> 36,297, and 36,295 at the merge with main (its own host 36,282) - the boats' collider sync (csaSyncColliders) tells the collider its posed buckets moved (posesMoved), so their boxes are kept between syncs; the sync is the one place that carries them (player/collider.js holds the rest). SEA-DECK (FIELD BUGS 2026-10-23): 10 logical lines of wiring past the room DECK-POSE's 3 had taken - 36,284 -> 36,296 at the merge with main (its own host 36,283) - the sea's ships carry through the host's deck door (naval deps `deck`: the body, its facing and the eye taken again), and that door's three answers are hoisted so CSA-K's carry and the sea's are one (deckMayCarry, deckGround, deckCarry); the carry itself is scenes/naval/seaDecks.js. ACCOUNT-HOMES + GUILD-HALL-SALE (#653): 36,284 -> 36,282 - KNIGHT-HOUSE's boot deed holds (holdRealmDeedsOnline) out to scenes/homesBootHost.js beside ACCOUNT-HOMES' sweep, which lives there too; in, the wiring: the module built, its two calls, the line's houses whole and the hall's sale handed over. AURA-STALL (#1137): 3 logical lines out, 36,287 -> 36,284 - the aura pass built through its door (render/glProgram.js compiledPass) where the host had held its own try-once latch. STAFF-PANEL5 (the staff panel's relay release, 2026-10-22: 36,264 -> 36,287): the wiring alone - follow (scenes/staffFollowHost.js), Message on screen (net/staffMessages.js) and the freeze and staff chat (scenes/staffFreezeHost.js) each live in their own module, and these are the lines that hand the host's pose, chat tab, motor and camera to them; STAFF-PANEL2 and STAFF-PANEL2-CHATMENU (mob, 2026-10-22: "remove the report buttons iunch for admin and mods", "replace them follow mute freeze tp ban and other things we use for players", "in chat"): 8 logical lines, 36,256 -> 36,264 - the chat safety host is handed the staff member's glyphs and a TP by the line's socket (`glyphs`, `teleport`), and the staff TP's ask takes a socket `{ id }` as well as a name; the menu itself lives in chatSafetyHost.js, these are the host's own state it reads. TV-PACE REVERTED (the owner, 2026-10-22, at BOARD-SIFT's merge): 1 logical line out, 36,257 -> 36,256 - the frame no longer sets the travel view's pace cap. AUDIT PISTOLET A1 (merged beside TV-PACE, which had set the ceiling at the host's own count): 1 logical line, 36,256 -> 36,257 - the duel's arrow door hands its strike-out `{ off }` for a pair's off-hand shot, as each melee door already hands the striking rig's (duelStrikeOut's own option, at the door's own call - a fix that cannot live elsewhere). TV-PACE (#1059): 1 logical line, 36,255 -> 36,256 - the frame sets the travel view's pace cap (setTravelViewPaceCap, its value the mount's upkeep: x10 on foot or hungry, x20 fed), merged beside CRAFT-WRITS with its own check red on this count. CRAFT-WRITS: 12 logical lines in at the merge of main, 36,243 -> 36,255 - the crafting writs' host made once and named on the Work tab (its five getters over bootWorld's own player, realm session, checkpoint, save and book; scenes/craftWritHost.js holds the rest, Professions-Arc section 49). FIELD BUGS 2026-10-21d: 8 logical lines in at the merge of main, 36,235 -> 36,243. PARTY-PING: 77 logical lines of wiring that cannot leave the host (the look, the draw, the urgent pose), 36,158 -> 36,235. OW-HITCH: 13 logical lines out - the ground sets (groundLayersOf, loadGroundSet) to scenes/groundSets.js createGroundSets, the ceiling down by them (36,151 -> 36,138). WITCH1: 35 logical lines out - the Hollows' slots kept (sdSlotsKept) to systems/superDungeon/sdSlots.js - and the Witches' Festival's wiring (19) in, the ceiling down to what stands (36,187 on main at the merge); FIRM-STARS (HUD patch, 2026-10-20): +4 for setHudPauseAt's one statement - the stars' tile opens a pause page by name, which needs this scope's `modes` and `hudCtx` (the /mail door's own pair); the patch fit the 36,233 it was cut against and landed on 36,183. FIELD BUGS 2026-10-19f: 32 logical lines out - DISENCHANT-SAID's list to profPages.js disenchantableOf (8), BOSS-DOT's serpent door to scenes/gate/standInSpell.js createSerpentSpell (24) - TOWN-EXIT's six (tvJoinedLegs' body) back with its retirement; at the merge of main (PASSAGE took the room its own wiring found) the ceiling stands at the merged host, 36,233 -> 36,196, 36,198 at the next (main's own two lines, 36,228 -> 36,230 there) 36,201 at the third (main's own three, 36,230 -> 36,233) and 36,183 at the fifth (main's OW-DUNGEON-SIZE moved its own out, 36,233 -> 36,209 there): the lines the moves freed are not room to grow
  ['src/scenes/worldModes.js', 'createWorldModes', 11_039, MODULE],   // KETCH x MAIN (2026-10-24, the merge): the Ketch's wiring, 35 logical lines (KETCH's 36 and KETCH-LOOK KL3's one out, below), on main's 11,004 -> 11,039. KETCH-LOOK KL3 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 16): 1 logical line out, 11,040 -> 11,039 - the ship's late pass no longer handed her look's fog record (mode 'exp' with no range or eye: it fogged none of the passes), so it takes the renderer's own. KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 11): the wiring alone, 36 logical lines, 11,004 -> 11,040 - the deck host built (scenes/ketch/ketchDeckHost.js createKetchDeckHost, on one view of the mode machine shared with the Spire's circle), the door up (its record the module's - ketchShipHit), the ship stood and faced, its room's identity, its frame's look and sun, its sky, its telegraphs, its presses, and its four reads out (enterKetch, ktShip, ktLeave, ktPlace). GUILD-HALL-SALE (#653, on main at the fold of STAFF-PANEL 0.2.3): 10,998 -> 11,004, main's own six - the hall's sale door built (scenes/hallSaleDoor.js createHallSaleDoor), its two reads named and its two turns at the door; main stood over the ceiling at the fold, and the ceiling stands at main's count, not one line of room GUILD-HALL-SALE (#653, on main at the fold of STAFF-PANEL 0.2.3): 10,998 -> 11,004, main's own six - the hall's sale door built (scenes/hallSaleDoor.js createHallSaleDoor), its two reads named and its two turns at the door; main stood over the ceiling at the fold, and the ceiling stands at main's count, not one line of room
  ['src/scenes/dungeonContext.js', 'buildDungeonContext', 8_463, MODULE],   // FIELD BUGS 2026-10-19f STAND-IN-WHOLE: 8,601 -> 8,463, its four spell doors out (scenes/gate/standInSpell.js)
  ['src/scenes/exterior.js', 'bootExterior', 5_441, MODULE],
  ['src/scenes/naval/navalHost.js', 'createNavalHost', 6_455, MODULE],   // a *Host.js grown into a knot of its own (HOST-SPLIT NAVAL); AUDIT SEA VENTURES D12: 15 logical lines out - the Captain's Due and a legend's Tidemail to scenes/naval/navalSeaSet.js, the ceiling down by them (6,470 -> 6,455)
  ['src/systems/comeSailAway/comeSailAway.js', 'createComeSailAwayRuntime', 2_780, MODULE],   // the Come Sail Away runtime, one scope (AUDIT HOST-SPLIT NAVAL); BOAT-OWN (FIELD BUGS 2026-10-21c): 3 logical lines out - her boats' Animators and particle systems to scenes/comeSailAway/farLife.js createBoatLives - 2,783 -> 2,780
  ['server/src/index.js', '_message', 2_046, METHOD],   // the relay's Room is 473 methods already - its knot is the one dispatcher
  // knots the code-line count missed because their lines are crowded (createFpArm stood at 1,999 code lines against
  // KNOT's 2,000); held from LEGIBLE 1 at their length plus ROOM
  ['src/scenes/exteriorFoes.js', 'createExteriorFoes', 3_343, MODULE],
  ['src/combat/fpArm.js', 'createFpArm', 3_252, MODULE],
  ['src/scenes/eliteGates/egClient.js', 'createEgClient', 3_175, MODULE],
];

const sizes = new Map();
/** A host function's logical lines (each file parsed once for both tests). */
const measure = (file, fn) => {
  const key = `${file}#${fn}`;
  if (!sizes.has(key)) {
    const host = findHostFunction(parseModule(readFileSync(join(ROOT, file), 'utf8')), fn);
    assert.ok(host, `${file} has no function ${fn} - renamed or taken apart: move or remove its ceiling in test/scenes/hostceiling.test.js`);
    sizes.set(key, logicalLines(host.fn));
  }
  return sizes.get(key);
};

test('HOST-SPLIT THE HOSTS DO NOT GROW: bootWorld, createWorldModes, buildDungeonContext, bootExterior, navalHost\'s createNavalHost, Come Sail Away\'s createComeSailAwayRuntime and the relay\'s _message each stay under their ceiling in logical lines - new behaviour goes into a module the host wires (a Room method, on the relay), not into the host\'s own scope; on a pull request and on a contributor\'s machine, never on a deploy (mutants: a ceiling under its host)', { skip: SKIP }, () => {
  const over = [];
  for (const [file, fn, ceiling, instead] of CEILINGS) {
    const n = measure(file, fn);
    if (n > ceiling) over.push(`${file} ${fn}: ${n} logical lines, over its ceiling ${ceiling} by ${n - ceiling}. Put the new code in ${instead} (bible/01-Overview/Host-Split.md, THE HOSTS DO NOT GROW) - or, for a fix that cannot live elsewhere, raise its ceiling in test/scenes/hostceiling.test.js with the reason beside it`);
  }
  assert.deepEqual(over, []);
});

test('HOST-SPLIT A CEILING COMES DOWN WITH ITS HOST: no ceiling stands more than twice ROOM over its host - a slice that moves code out lowers the ceiling in the same change, or the room it freed becomes room to grow back into (mutants: a ceiling left high)', { skip: SKIP }, () => {
  const slack = [];
  for (const [file, fn, ceiling] of CEILINGS) {
    const n = measure(file, fn);
    if (ceiling - n > 2 * ROOM) slack.push(`${file} ${fn}: ${n} logical lines under a ceiling of ${ceiling} - lower it to ${n + ROOM} in test/scenes/hostceiling.test.js`);
  }
  assert.deepEqual(slack, []);
});

// Every kind of logical line, each once, and every look-alike that is not one: 20 logical lines, however laid out.
const SAME_CODE_CROWDED = 'function host() { let a = 1; for (let i = 0; i < 3; i++) a += i; const o = { x: 1, y: () => a }; const { x } = o; '
  + 'switch (a) { case 1: a++; break; default: a--; } class K { m() { return 1; } f = 2; } return () => a; }';
const SAME_CODE_SPREAD = `function host() {
  // a comment is no weight
  let a = 1;
  for (let i = 0; i < 3; i++) {
    a += i;
  }
  const o = {
    x: 1,
    y: () => a,
  };
  const { x } = o;
  switch (a) {
    case 1:
      a++;
      break;
    default:
      a--;
  }
  class K {
    m() {
      return 1;
    }

    f = 2;
  }
  return () => a;
}`;

test('LEGIBLE 1 THE CEILING IS BLIND TO LAYOUT: a host is measured in logical lines - statements, object and class entries, switch cases, the implicit returns of expression arrows - so the same code crowded onto one line or spread over twenty-six measures the same, and splitting a crowded line for its reader costs no room (bible/01-Overview/Readability-Arc.md) (mutants: a loop head counted; a destructuring entry counted; object entries not counted; class members not counted; expression arrows not counted; braces counted)', () => {
  const sizeOf = (src) => logicalLines(findHostFunction(parseModule(src), 'host').fn);
  assert.equal(sizeOf(SAME_CODE_CROWDED), 20, 'each kind of logical line counted once, and no look-alike counted');
  assert.equal(sizeOf(SAME_CODE_SPREAD), 20, 'the same code spread out, with a comment and a blank line, measures the same');
});

/** A function this long is a knot of its own, whatever wires it (HOST-SPLIT NAVAL). In logical lines: 2,000 code lines
 *  before LEGIBLE 1, set where every knot that line held is still held - Come Sail Away's runtime, the least crowded,
 *  measures 2,484. */
const KNOT = 2_400;

/** Every source file under a folder. */
const sources = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : /\.m?js$/.test(e.name) ? [`${dir}/${e.name}`] : [])).sort();

/** A module's OUTERMOST functions, in any shape - a declaration, an arrow, a method, async or not - named as
 *  tools/hostScope.mjs names them. (A function inside another is the outer one's: its host's ceiling holds it.) */
const outermost = (ast) => {
  const out = [];
  const isFn = (n) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type) && n.body?.type === 'BlockStatement';
  const visit = (n, name) => {
    if (!n || typeof n.type !== 'string') return;
    if (isFn(n)) { out.push({ fn: n, name: n.id?.name ?? name }); return; }
    const nm = n.type === 'VariableDeclarator' ? n.id?.name
      : (n.type === 'MethodDefinition' || n.type === 'Property' || n.type === 'PropertyDefinition') && !n.computed ? n.key?.name : undefined;
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, nm)); else if (v && typeof v.type === 'string') visit(v, nm);
    }
  };
  visit(ast);
  return out;
};

/** The outermost functions in a module's source past KNOT logical lines, as `{ fn, name, size }`. */
const knotsOf = (src) => {
  // a logical line takes at least two characters (`a;`), so a source shorter than that cannot hold a knot - a bound on
  // characters, not lines: a crowded file can hold more logical lines than it has physical ones
  if (src.length < 2 * KNOT) return [];
  return outermost(parseModule(src)).map(({ fn, name }) => ({ fn, name, size: logicalLines(fn) })).filter((f) => f.size > KNOT);
};

test('HOST-SPLIT NAVAL A MODULE THAT BECOMES A HOST GETS A CEILING: every function in src/ and the relay\'s server/src/ past KNOT logical lines - a module the host wires that grew into one scope of its own, as navalHost\'s createNavalHost did unnoticed to 4,865 lines and Come Sail Away\'s runtime to 2,065 code lines - stands in CEILINGS; found by walking src/ and reading every outermost function, whatever its name or shape, not by a list (mutants: the naval ceiling dropped; the sail runtime\'s ceiling dropped; the knot never reached; the walk by the first create* export alone; the walk by declarations alone; a crowded file skipped by its line count)', { skip: SKIP }, () => {
  // AUDIT HOST-SPLIT NAVAL, the second read: every shape the walk claims to read, read - the held knots are all
  // declarations, so a walk narrowed to declarations passed on them; a fixture of each shape holds the rest
  const shapes = 'function decl() {\n\n}\nasync function* gen() {\n\n}\nexport const arrow = async () => {\n\n};\nconst expr = function () {\n\n};\n'
    + 'class C {\n  method() {\n\n  }\n  field = () => {\n\n  };\n  #hidden() {\n\n  }\n}\nexport const o = {\n  objMethod() {\n\n  },\n  prop: function () {\n\n  },\n};\n'
    + 'export default function named() {\n\n}\n';
  assert.deepEqual(outermost(parseModule(shapes)).map((x) => x.name), ['decl', 'gen', 'arrow', 'expr', 'method', 'field', 'hidden', 'objMethod', 'prop', 'named'], 'the walk reads every shape a function takes');
  // LEGIBLE 1: and a knot crowded onto one physical line is still a knot
  assert.deepEqual(knotsOf(`function crowded() {${' a();'.repeat(KNOT + 1)} }`).map((x) => x.name), ['crowded'], 'the walk skips no file by its line count');
  const held = new Set(CEILINGS.map(([file, fn]) => `${file}#${fn}`));
  const loose = [], knots = [];
  const files = [...sources('src'), ...sources('server/src')];   // the relay's Room too (AUDIT HOST-SPLIT NAVAL, the second read)
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const { fn, name, size: n } of knotsOf(src)) {
      knots.push(`${file}#${name}`);
      if (!name) loose.push(`${file}: an unnamed function at line ${fn.loc.start.line}, ${n} logical lines - name it (a declaration or a const) and give it a ceiling in CEILINGS`);
      else if (!held.has(`${file}#${name}`)) loose.push(`${file} ${name}: ${n} logical lines and no ceiling - add ['${file}', '${name}', ${n + ROOM}, MODULE] to CEILINGS in test/scenes/hostceiling.test.js`);
    }
  }
  assert.ok(files.length >= 1000, `only ${files.length} source files under src/ - the walk is reading the wrong tree`);
  assert.ok(files.includes('server/src/index.js'), 'the walk reads the relay, whose Room is the next knot\'s home');
  // and the line reaches a function in the tree: a KNOT so high it reached none would hold nothing (when the last knot
  // is taken apart, this is the assertion to drop - say so in the change that does it)
  assert.ok(knots.length > 0, `KNOT (${KNOT}) reaches no function in src/ - drop this assertion if the last knot was taken apart`);
  // and the walk sees every knot the ceilings already hold, whatever its shape (an async declaration, a const arrow) -
  // a walk that read only one shape would pass on the knots it never met
  const unseen = CEILINGS.filter(([file, fn]) => (file.startsWith('src/') || file.startsWith('server/src/')) && measure(file, fn) > KNOT && !knots.includes(`${file}#${fn}`)).map(([file, fn]) => `${file}#${fn}`);
  assert.deepEqual(unseen, [], 'a held knot the walk did not reach');
  assert.deepEqual(loose, []);
});
