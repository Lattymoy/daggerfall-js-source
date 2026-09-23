// PARTY-REST1 (2026-09-20, per-request: "when the party leader rests everyone in the party gets the
// resting screen counting down... only the leader should spawn mobs when resting", then "is it possible
// for it only working when party members near the leader?").
//
// The wire's own law (a rest/loiter session's live state riding the party pose, refused whole on one bad
// number, `bk` distinguishing two shops sharing one town pixel) is pinned with real, executable coverage
// in test/soc1_hub.test.js - validPartyPose is a pure function and earns that.
//
// Everything below it lives inside world.js's giant scene closure (composePartyPose, the follower-side
// partyRestFollowTick, its own copy of the rest deps) or inside worldModes.js's/dungeonContext.js's own
// window-stack closures (the restState getters each host exposes so world.js - which owns every
// party/online seam - can read INTO them). None of the three is reachable without a full scene, so this
// file follows the suite's own established law for that (test/auditsoc.test.js, test/soc3_socialpanel.
// test.js, test/soc4_partyhud.test.js): read the source, slice the one function under test, and pin its
// STRUCTURE - which hooks are swapped, which fields are read, in what order - rather than its output.
//
// WHAT IS WORTH PINNING, AND WHAT IS NOT. What can be WRONG here is: a follower's mirror rolling its own
// encounter (a room of four followers spawning four rooms' worth of monsters for one nap); a mirror
// starting for a follower who is not actually near the leader, or in a DIFFERENT building sharing the same
// town pixel; a mirror that never ends when the leader's rest does; a mirror stealing a screen that is
// already busy or already really resting; the leader's own broadcast picking up a MIRRORED session and
// reporting it as their own (which would chain the mirror through a third member); and the three hosts'
// mode-string/wire-number mapping disagreeing with each other. Every one of those is driven here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE MODE CODE, BOTH WAYS ─────────────────────────────────────────────

test('PARTY-REST1: partyRestModeCode and partyRestModeFromCode are exact inverses over all three modes, and agree with net/wire.js\'s own PARTY_REST_MODES numbering (mutants: a code that does not round-trip; a fourth number; the two functions drifting out of step)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const partyRestModeCode = \(mode\) => \(mode === 'timed' \? 1 : mode === 'full' \? 2 : 0\);/);
  assert.match(w, /const partyRestModeFromCode = \(code\) => \(code === 1 \? 'timed' : code === 2 \? 'full' : 'loiter'\);/);
  // eslint-disable-next-line no-new-func
  const code = new Function('mode', "return mode === 'timed' ? 1 : mode === 'full' ? 2 : 0;");
  // eslint-disable-next-line no-new-func
  const fromCode = new Function('code', "return code === 1 ? 'timed' : code === 2 ? 'full' : 'loiter';");
  for (const mode of ['loiter', 'timed', 'full']) assert.equal(fromCode(code(mode)), mode, `${mode} round-trips`);
  const wire = rd('src/net/wire.js');
  assert.match(wire, /const PARTY_REST_MODES = Object\.freeze\(\[0, 1, 2\]\);/, 'the wire admits exactly the three numbers these two functions produce and consume');
});

// ── THE SENDER: composePartyPose ─────────────────────────────────────────

test('PARTY-REST1: composePartyPose reads exactly one host\'s own live session - worldModes.js\'s restState indoors, dungeonContext.js\'s in a dungeon, this host\'s own outdoor overlay outside - and NEVER a mirrored one, so a follower watching someone else\'s countdown never reads back as its own leader (mutants: a mirrored session broadcast as real; the wrong host read for the mode; the wire\'s mode code read from a raw string)', () => {
  const w = rd('src/scenes/world.js');
  const pose = w.slice(w.indexOf('const composePartyPose = () => {'), w.indexOf('/** PARTY-REST1: the wire\'s small numbers'));
  assert.match(pose, /const restWin = !isEnhanced\(\) \? null[^\n]*\n\s*: mode === 'interior' \? modes\?\.restState\s*\n\s*: mode === 'dungeon' \? modes\?\.dungeonCtx\?\.restState\s*\n(?:\s*\/\/[^\n]*\n)*\s*: \(townTalk\.overlay\?\.isRestWindow && !townTalk\.overlay\.isPartyRestMirror && townTalk\.overlay\.session && townTalk\.overlay\.state === 'resting'/,
    'interior -> worldModes.js, dungeon -> dungeonContext.js, else this host\'s own overlay - and the overlay arm excludes a mirror of its own, AND (PARTY-REST6) requires the window still actually be ticking (state === \'resting\'), not merely holding a session object - a window sitting on its own ended/refused screen must not go on broadcasting as live');
  assert.match(pose, /bk: mode === 'interior' \? \(modes\?\.interiorBuilding\?\.buildingKey \?\? null\) : null,/, 'a building key only indoors - a dungeon and the open air both leave it null');
  assert.match(pose, /rest: restWin \? \{ mode: partyRestModeCode\(restWin\.mode\), hoursRemaining: restWin\.hoursRemaining, totalHours: restWin\.totalHours, kind: playerEntity\.restKind \?\? null \} : null,/,
    'the session\'s own mode string goes through partyRestModeCode on the way OUT - the wire never sees the string; PARTY-REST4 adds the entity\'s own live restKind alongside it, so a follower can inherit the SAME rest quality, not guess their own');
});

test('PARTY-REST1: worldModes.js\'s and dungeonContext.js\'s restState getters are the SAME law, twice - null while not resting, null for a mirror of someone else\'s, the live numbers otherwise (mutants: a mirror read back as real; the getter answering while not resting; the two hosts disagreeing)', () => {
  for (const [file, closureVar] of [['src/scenes/worldModes.js', 'interiorOverlay'], ['src/scenes/dungeonContext.js', 'activeOverlay']]) {
    const src = rd(file);
    const re = new RegExp(`get restState\\(\\) \\{\\s*const w = ${closureVar};(?:\\s*\\/\\/[^\\n]*)*\\s*if \\(!w\\?\\.isRestWindow \\|\\| w\\.isPartyRestMirror \\|\\| !w\\.session \\|\\| w\\.state !== 'resting'\\) return null;\\s*return \\{ mode: w\\.mode, hoursRemaining: w\\.session\\.hoursRemaining, totalHours: w\\.session\\.totalHours \\};\\s*\\},`);
    assert.match(src, re, `${file}: the getter over its own window-stack slot (${closureVar}), and (PARTY-REST6) requiring state === 'resting' - a window sitting on its own ended/refused screen must not go on reading as a live session`);
  }
});

// ── THE FOLLOWER: partyRestFollowTick + partyRestMirrorDeps ─────────────

test('PARTY-REST1: a follower\'s mirror never rolls its own encounter - enemiesNearby answers false unconditionally, and advanceMinutes calls the local ticker alone, never runEncounterTick (mutants: enemiesNearby reading the real pools; advanceMinutes keeping the encounter call; a follower silently getting the leader\'s own deps object instead of its own copy)', () => {
  const w = rd('src/scenes/world.js');
  const deps = w.slice(w.indexOf('const partyRestMirrorDeps = (restKind, targetAcct) => {'), w.indexOf('const partyRestFollowTick = () => {'));
  assert.match(deps, /\.\.\.outdoorRestDeps,/, 'every OTHER hook (tickVitals, fullyHealed, onRestFinished, the message box, onClose) is this SAME player\'s own real deps - a mirror heals exactly as a real rest would');
  assert.match(deps, /enemiesNearby: \(\) => false,/);
  assert.match(deps, /advanceMinutes: \(n\) => \{ playerTicker\.advance\(n\); \},/);
  assert.doesNotMatch(deps, /runEncounterTick\(/, 'the one call that spawns anything is not reachable from a follower\'s deps at all - the doc comment above it names it, deliberately, but never calls it');
  assert.match(deps, /commitCrime: \(\) => \{\},/, 'a follower did not choose to trespass here themselves');
});

test('PARTY-REST1c (2026-09-20, per-request: "when the member initializes the resting when everyone is ready he only rests for himself and not the others as well" - the bug this closed): partyRestFollowTick mirrors ANY near party member actually resting for real, not only the formal leader - a follower whose own rest was approved through PARTY-REST2\'s extended gate is mirrored by everyone near them exactly as the leader would be; and, once mirroring, tracks that ONE specific account (win._mirrorAcct) rather than re-searching "is anyone nearby resting" each frame, so a second person starting to rest just as the first one ends can never silently hand a follower\'s countdown off mid-nap (mutants: the search narrowed back to social.party.leader only; a new mirror seeded from the wrong member\'s rest numbers; the continuing check re-searching every frame instead of pinning the one account it started with; win._mirrorAcct never set, or set after showOverlay instead of before)', () => {
  const w = rd('src/scenes/world.js');
  const tick = w.slice(w.indexOf('const partyRestFollowTick = () => {'), w.indexOf('/** SOC6 (Mac: "Party members should be able to be seen on the world map'));
  assert.match(tick, /if \(!social\?\.party\) \{\s*if \(mirroring\) ov\._end\(ov\.session\.endEarly\(\)\);/, 'the party broke up - any mirror I am somehow running ends; NOT gated on social.leads() any more, since a leader can now mirror a resting follower too');
  assert.doesNotMatch(tick, /social\.leads\(\)/, 'leader status no longer excludes anyone from mirroring - only PARTY-REST2\'s consensus gate (a separate function) still treats the leader specially, for who must be asked, never for who may be mirrored or may mirror');
  // PARTY-REST1b (unchanged by this fix): once mirroring, only MY OWN distance to the specific account I
  // started mirroring - never whether they are still resting, and never re-picked each frame.
  // PARTY-REST1b (unchanged in spirit by PARTY-REST5/6/7's additions below - still keyed on the ONE account
  // this mirror tracks, never re-searched, never widened back to "the leader" generically): the lookup is
  // still `ov._mirrorAcct`, and ending still ultimately routes through `ov.session.endEarly()` for both the
  // "target stopped resting" (PARTY-REST7) and distance checks - matched loosely around the enemy-break arm
  // (PARTY-REST5) and any diagnostics between them, since those additions are the point of PARTY-REST5/6/7's
  // own tests elsewhere and are not what this assertion is pinning.
  assert.match(tick, /if \(mirroring\) \{[\s\S]*?const mirrorRow = social\.party\.members\.find\(\(m\) => m\.acct === ov\._mirrorAcct\);[\s\S]*?if \(!mirrorRow\?\.p\?\.rest\) \{[\s\S]{0,400}?ov\._end\(ov\.session\.endEarly\(\)\);[\s\S]{0,50}?\}\s*\n\s*if \(!memberPresent\(mirrorRow\) \|\| !nearAccount\(ov\._mirrorAcct, mirrorRow\?\.p\)\) \{[\s\S]{0,400}?ov\._end\(ov\.session\.endEarly\(\)\);\s*\n\s*\}\s*\n\s*return;\s*\n\s*\}/,
    'the continuing check reads ov._mirrorAcct, set once at start - never re-searches "anyone nearby resting" while already running, and still ends (via session.endEarly()) on either the tracked account no longer resting or the distance check failing');
  assert.match(tick, /if \(townTalk\.overlayActive \|\| playerEntity\.isResting \|\| playerEntity\.isLoitering \|\| playerEntity\.health <= 0\) \{[\s\S]{0,300}?return;\s*\n\s*\}/,
    'never steals an open window, never doubles a real rest of my own, never starts on a dead player');
  // PARTY-REST1c itself: ANY near member with a live `rest`, not just the leader\'s row.
  assert.match(tick, /const restingRow = nearPartyMembers\(\)\.find\(\(m\) => m\.p\.rest\);\s*\n\s*if \(!restingRow\) return;/,   // AUDIT PARTY-REST: over the PRESENT near members (memberPresent + nearAccount, the one list the gate reads)
    'the search is over every other seated member, filtered to one who is both near AND actually resting for real - the leader is one candidate among however many, not a special case');
  assert.match(tick, /win\.isPartyRestMirror = true;\s*\n\s*win\._mirrorAcct = restingRow\.acct;[\s\S]{0,700}?\n\s*townTalk\.showOverlay\(win\);/,
    'tagged and pinned to the resting account BEFORE it is shown, so the very first frame it is read back by composePartyPose/restState it already excludes itself');
  assert.match(tick, /win\._start\(partyRestModeFromCode\(restingRow\.p\.rest\.mode\), restingRow\.p\.rest\.hoursRemaining\);/,
    'seeded with the RESTING MEMBER\'S own live hoursRemaining (not the leader\'s specifically) - a follower who joins mid-nap sees the same clock the resting member does, whoever that is');
  const w2 = rd('src/scenes/world.js');
  assert.match(w2, /const samePlace = \(a, b\) => !!\(a && b && a\.px === b\.px && a\.py === b\.py && a\.in === b\.in && \(a\.in !== 2 \|\| a\.bk === b\.bk\)\);/,
    'px, py, in, and - only indoors - bk: two shops sharing one town pixel are not "the same place" here either, same law net/wire.js\'s own doc comment on bk states');
  // PARTY-REST3 (2026-09-20, per-request: "how near is near" - a world-map pixel is ~832x416 METERS, so
  // samePlace alone is nowhere near "together"): a second, tighter law - real distance, off the SAME 3D
  // positions CAMP-REST's own group-roll guard already reads (peersNear/player.feetAt), not the wire's
  // own coarse px/py.
  assert.match(w2, /const PARTY_REST_RADIUS = 15;/, 'a room/camp-circle scale, not GROUP_ROLL_RADIUS\'s 100 - that guard only keeps unrelated camps from double-rolling, this one means "close enough to rest together"');
  assert.match(w2, /const feetOfPartyAccount = \(acct\) => \{\s*const row = social\?\.party\?\.members\.find\(\(m\) => m\.acct === acct\);\s*const peer = row \? peersNear\(\)\?\.find\(\(p\) => row\.peers\.includes\(p\.id\)\) : null;\s*return peer\?\.feet \? \[[^\n]*?\] : null;\s*\};\s*const distanceToPartyAccount = \(acct, from = player\.feetAt\(\)\) => \{\s*const peerFeet = feetOfPartyAccount\(acct\);\s*if \(!peerFeet\) return Infinity;/,   // AUDIT PARTY8: the feet are asked once, and the distance is measured from `from` (the leader's feet for a follower's gather check)
    'a member not even a rendered, visible peer right now (out of stream range, or never loaded in) is Infinity away - too far, not an error');
  // PARTY-REST8 (2026-09-21): restructured from a single expression into a block body so the meters-based
  // distance check can be skipped indoors (a building's own key is already precise enough - see the doc
  // comment on nearAccount itself) - but samePlace is still asked FIRST and is still REQUIRED either way, and
  // distanceToPartyAccount is still the deciding factor whenever it does run (outdoors, or in a dungeon).
  assert.match(w2, /const nearAccount = \(acct, pose, from = player\.feetAt\(\)\) => \{\s*if \(!pose \|\| !samePlace\(myPartyLocation\(\), \{ px: pose\.px, py: pose\.py, in: pose\.in, bk: pose\.bk \}\)\) return false;\s*\n\s*if \(\(modes\?\.mode \?\? 'exterior'\) === 'interior'\) return true;[^\n]*\n\s*return distanceToPartyAccount\(acct, from\) <= PARTY_REST_RADIUS;\s*\n\s*\};/,   // AUDIT PARTY8: measured from `from` - my feet by default, the leader's for a follower's gather check
    'samePlace is asked first and is still required either way; indoors (a building key match) is sufficient on its own; outdoors/dungeon still fall through to the real distance check');
  assert.match(w2, /const nearPartyMembers = \(from = player\.feetAt\(\)\) => \{\s*if \(!social\?\.party\) return \[\];\s*return social\.others\(\)\.filter\(\(m\) => memberPresent\(m\) && nearAccount\(m\.acct, m\.p, from\)\);[^\n]*\n\s*\};/,   // AUDIT PARTY-REST/PARTY8: present members, measured from `from`
    'the gate\'s own list is built from the exact same nearAccount the follower\'s mirror reads');
});

test('PARTY-REST1: partyRestFollowTick runs every frame, not throttled to the pose send cadence, right beside partyFrame - a follower\'s own countdown should start and stop as promptly as the leader\'s does, not lag behind PARTY_SEND_MS (mutant: the call dropped, or moved behind the network throttle)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /partyRestFollowTick\(\);[^\n]*\n\s*partyFrame\(performance\.now\(\)\);/, 'called unconditionally on the same line-run as the pose send, not gated on its own throttle (BEFORE the pose goes out: SOC3/SOC4 pin the run after it as renders alone)');
  assert.equal((w.match(/partyRestFollowTick\(\);/g) ?? []).length, 1, 'called from exactly the one place');
  assert.equal((w.match(/const partyRestFollowTick = /g) ?? []).length, 1, 'declared exactly once');
});

// ── PARTY-REST2: THE CONSENSUS GATE ──────────────────────────────────────

test('PARTY-REST2 (2026-09-20, per-request: "a party member confirmation like 4/5 party member agree to rest... if not all party members are ready the leader can\'t rest"): `/ready` is a LOCAL chat command, never sent to the relay, toggling one boolean that composePartyPose then carries out as `ready` (mutants: the command forwarded to the relay as chat; the toggle inverted; a stray leading/trailing character defeating the match)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /let _partyRestReady = false;/);
  assert.match(w, /if \(\/\^\\\/ready\$\/i\.test\(text\.trim\(\)\)\) \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!social\?\.party\)[^\n]*\n\s*if \(!_partyRestReady && !social\.leads\(\) && !partyRoundActive\(\)\)[^\n]*\n\s*_partyRestReady = !_partyRestReady;/, 'a whole-line, case-insensitive match on the trimmed text - not a substring, so "already" or "I am ready" do not fire it');
  assert.match(w, /ready: _partyRestReady,/, 'composePartyPose carries this tab\'s own vote out, plain');
});

test('PARTY-REST2 (extended, per-request: "can this also initiate a rest vote... only when the member is near the leader", then per-request: "when the leader or the party member starts resting when outside the range a pop up should appear - for the leader \'you must gather the party\' and for the member \'you\'re not near the leader\'", then per-request: "when someone presses R and another member presses R it starts a new vote for the other member. Put a cooldown of 1 minute on it and when someone tries to rest while the vote is going it has to tell Resting vote ongoing", then per-request: "it only counts down the countdown for the player who initiated it not for the whole group... every one in the group can start a vote and has its own timer. The vote time also shouldn\'t start when out of range"): partyRestGate is null only with no party at all, or once everyone standing here has voted; the leader-alone and follower-far-from-leader lines RETURN IMMEDIATELY, never touching the cooldown clock at all - being merely out of range is never mistaken for an ongoing vote; only the third line (not everyone ready) reads AND writes the clock, and reads it as the MOST RECENT of my own last refusal and every near member\'s own broadcast voteAt, so the whole group standing there shares one cooldown rather than each of them getting an independent timer of their own (mutants: a follower near the leader let through ungated; a follower gated even when the leader is nowhere near them; the two role-specific lines swapped or merged into one; one unready member among several not enough to block; the leader-alone or follower-far lines touching the cooldown clock at all; the cooldown read from ONLY my own _partyRestGateRefusedAt, ignoring near members\' broadcast voteAt - each member back to their own separate timer; the cooldown checked BEFORE the line is computed, blocking an already-cleared rest; the clock read on the relay\'s own social.now() swapped for the page-local performance.now(), which two different machines can never meaningfully compare)', () => {
  const w = rd('src/scenes/world.js');
  const gate = w.slice(w.indexOf('const partyRestGate = () => {'), w.indexOf('const refusePartyRest = '));
  assert.match(gate, /if \(!social\?\.party\) return null;[\s\S]{0,4800}?const nearHere = nearPartyMembers\(\);\s*const iAmLeader = social\.leads\(\);[\s\S]{0,1600}?const onlineOtherCount = social\.others\(\)\.filter\(memberPresent\)\.length;[^\n]*\n\s*if \(iAmLeader\) \{\s*if \(nearHere\.length < onlineOtherCount\) return 'You must gather the party before you can rest\.';/,
    'the leader-alone/not-whole-party line returns immediately - no cooldown clock touched');
  assert.match(gate, /\} else if \(!nearHere\.some\(\(m\) => m\.acct === social\.party\.leader\)\) \{\s*return 'You are not near the leader\.';/,
    'the follower-far-from-leader line ALSO returns immediately - no cooldown clock touched');
  // PARTY-REST18: null is still the eventual fallthrough once nobody near is left unready - just no longer
  // unconditional, since someone else's earlier press may still own this specific round (checked first).
  assert.match(gate, /const notReady = nearHere\.filter\(\(m\) => !voteStands\(m\.p, social\.now\(\), lastStartedAt\)\);[\s\S]{0,1800}?if \(!notReady\.length\) \{[\s\S]{0,700}?return null;\s*\n\s*\}/, 'null the moment nobody near is left unready - not a majority, not a count, ALL of them');
  // PARTY-REST12: reworded from "Not everyone is ready" to "You are ready to rest" - the popup itself is now
  // the confirmation the presser asked for (pressing Rest sets their own ready flag first), folded into the
  // same line as the tally and the waiting-on list, rather than a separate message.
  // PARTY-REST17: no names in the popup either, per the same "dont name names" instruction Update 14 already
  // applied to the chat broadcast - this was the one spot that instruction missed.
  assert.match(gate, /const line = `You are ready to rest\. \(\$\{readyCount\}\/\$\{totalCount\} ready\)\. Everyone can \/ready or press Rest\.`;/);
  // PARTY-REST18: the shared-clock computation moved earlier (before the ready-tally branch, so both that
  // branch and this one can read the SAME owner/`voteActive` result) and gained tracking of WHOSE voteAt won,
  // not only the timestamp - matched by the ownership loop and social.now() itself, and separately, that
  // `voteActive` (computed once, above) is what both gates it here and only ever gets written on this one path.
  // PARTY-REST22: the ownership computation now lives in its own shared function (computeVoteOwner), used by
  // PARTY-REST25 (2026-09-22, per-request: "Change this to leader only so it isnt confusing anymore"): the
  // whole "who owns this round" tracking this test used to pin (computeVoteOwner/voteBy/_partyRestVoteInitiator)
  // was retired - only the leader's press can ever open a real rest now, a plain `social.leads()` check with
  // nothing left to derive or disagree about.
  assert.match(gate, /if \(!notReady\.length\) \{\s*\n\s*if \(!iAmLeader\) return 'Everyone is ready\. The leader must press Rest to start\.';\s*\n\s*return null;\s*\n\s*\}/,
    'everyone ready succeeds ONLY for the leader\'s own press - anyone else\'s completing press is refused, told the leader must be the one to press Rest');
  assert.match(gate, /if \(partyRoundActive\(nearHere\)\) return 'Resting vote ongoing\.';\s*\n\s*_partyRestGateRefusedAt = social\.now\(\);[\s\S]{0,1200}?return refusePartyRest\(line\);/,
    'AUDIT PARTY-REST: the round is ONE question (partyRoundActive - latestStamp over every near member\'s voteAt and my own refusal, each read against the shared clock, a stamp from the future refused)');
  assert.match(w, /const partyRoundActive = \(nearHere = nearPartyMembers\(\)\) => \{\s*\n\s*const now = social\.now\(\);\s*\n\s*return now - latestStamp\(nearHere, 'voteAt', _partyRestGateRefusedAt, now\) < PARTY_REST_VOTE_COOLDOWN_MS;\s*\n\s*\};/,
    'the cooldown is read as the MOST RECENT of mine and every near member\'s broadcast voteAt (one shared clock for the group), on the relay\'s own now(), and only ever WRITTEN on this one path - a fresh vote round, never the leader-alone/follower-far lines, never the already-ready success path');
  assert.match(w, /let _partyRestGateRefusedAt = -Infinity;/, 'starts effectively expired, so the very first ever refusal is never throttled');
  assert.match(w, /const PARTY_REST_VOTE_COOLDOWN_MS = 60_000;/, '"put a cooldown of 1 minute on it"');
  assert.match(w, /const refusePartyRest = \(line\) => \{ chatNotice\(line\); return line; \};/,
    'the DETAILED refusal line funnels through this one function for the chat push - the throttled "Resting vote ongoing." line deliberately does NOT, so a spammed Rest key does not also spam chat');
  // composePartyPose carries the clock out, so a NEAR member's client can read it too - never the current moment
  // (that would make every tab look like an ongoing vote forever), only the STORED value.
  assert.match(w, /voteAt: Number\.isFinite\(_partyRestGateRefusedAt\) \? _partyRestGateRefusedAt : null,/);
});

test('PARTY-REST2/28: the SAME gate reaches all three hosts - world.js\'s own outdoor toggleRest calls it directly, and it is injected into worldModes.js (as host.partyRestGate) and forwarded again into dungeonContext.js (as opts.partyRestGate) - so a leader resting indoors or underground is gated exactly as one resting outdoors. PARTY-REST28 (2026-09-22, per-request: confirmed by direct testing, in a dungeon - "when we finished resting... it shows 1/2 ready to rest again that shouldnt happen" - the bug this closes): the SAME three-host wiring now ALSO carries markPartyRestSpent, the "spent the moment it is acted on" reset - a rest granted indoors or underground used to leave the granting player\'s own ready flag (and the group\'s cooldown state) stuck true forever, since only world.js\'s own outdoor toggleRest ever reset it (mutants: the gate wired into only one or two of the three; the injection silently dropped on the way through worldModes.js into the dungeon; markPartyRestSpent wired into fewer hosts than partyRestGate itself, or dropped from any one of the three)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const partyRefusal = modes \? partyRestGate\(\) : null;[^\n]*\n\s*if \(partyRefusal\) \{ townTalk\.showOverlay\(new ActionTextBox\(\[partyRefusal\]\)\); return; \}\s*if \(modes\) markPartyRestSpent\(\);[^\n]*\n\s*townTalk\.showOverlay\(createRestWindow\(outdoorRestDeps\)\);/,
    'the outdoor host: gated, then spent (through the shared function, not its own inline copy), then the real window - in that order');
  assert.match(w, /const markPartyRestSpent = \(\) => \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!isEnhanced\(\)\) return;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!social\) return;\s*\n\s*_partyRestReady = false;/, 'the reset itself (REST-OFFLINE1: a no-op with no social clock) - a real function, not an inline block only world.js\'s own toggleRest could reach');
  assert.match(w, /partyRestGate: \(\) => partyRestGate\(\),/, 'handed into createWorldModes as one more host dep, the same door onDungeonLeave and the rest already ride');
  assert.match(w, /markPartyRestSpent: \(\) => markPartyRestSpent\(\),/, 'the reset itself is handed into createWorldModes too, the same way partyRestGate already is');

  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /const partyRefusal = host\.partyRestGate\?\.\(\);\s*if \(partyRefusal\) \{ mountInterior\(new ActionTextBox\(\[partyRefusal\]\)\); return; \}\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*host\.markPartyRestSpent\?\.\(\);\s*\n\s*mountInterior\(createRestWindow\(interiorRestDeps, ignoreAllocatedBed\)\);/,   // AUDIT-RR F6: the bed's flag rides through the door
    'the interior host: the SAME shape, reading the injected deps rather than a closure of its own - worldModes.js has no `social` to ask directly, and now also actually spends the vote it was granted, not just checks it');
  assert.match(wm, /partyRestGate: \(\) => host\.partyRestGate\?\.\(\),/, 'and forwarded again into dungeonContext.js\'s own opts, unchanged, so the dungeon does not need a fourth copy of the same wiring');
  assert.match(wm, /markPartyRestSpent: \(\) => host\.markPartyRestSpent\?\.\(\),/, 'the reset is forwarded into dungeonContext.js\'s own opts the same way partyRestGate itself already is');

  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const partyRefusal = opts\.partyRestGate\?\.\(\);\s*if \(partyRefusal\) \{ activeOverlay = new ActionTextBox\(\[partyRefusal\]\); return; \}\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*opts\.markPartyRestSpent\?\.\(\);\s*\n\s*activeOverlay = createRestWindow\(_restDeps\);/,
    'the dungeon host: the same shape a third time, and the same actual spend, not just the gate check');
});

test('PARTY-REST2b (2026-09-20, per-request: "it\'s only asking the first time... [when I] start with the leader [it does] not ask for a vote"): a /ready vote carries its own timestamp and expires on its own after PARTY_READY_TIMEOUT_MS, checked unconditionally on every frame - the bug this closes was a vote that cleared someone ELSE\'s gate (the ordinary case - the leader\'s own /ready is what usually clears a FOLLOWER\'s check) never getting reset at all, so it silently pre-approved every rest after the first, forever (mutants: the timestamp never set on toggle; the expiry check dropped, gated behind a condition that skips it, or only run for the leader/only for a follower; the timeout absent or checked against the wrong clock)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /let _partyRestReady = false;.*\n\s*let _partyRestReadyAt = 0;/, 'the vote and its timestamp are declared together');
  assert.match(w, /if \(\/\^\\\/ready\$\/i\.test\(text\.trim\(\)\)\) \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!social\?\.party\)[^\n]*\n\s*if \(!_partyRestReady[^\n]*\n\s*_partyRestReady = !_partyRestReady;\s*_partyRestReadyAt = social\.now\(\);/,
    'every toggle - on AND off - stamps the moment, so a stale "yes" from an old vote cannot outlive a fresh "no"');
  assert.match(rd('src/systems/partyRestLaw.js'), /export const PARTY_READY_TIMEOUT_MS = 60_000;/, 'AUDIT PARTY-REST: the one number, in the law module the wire\'s reader and the voter share');
  assert.match(w, /import \{ PARTY_READY_TIMEOUT_MS, memberPresent, latestStamp, voteStands, snapshotCancels, cancelRequestFor, mirrorKey, cooldownStamp, stampOf \} from '\.\.\/systems\/partyRestLaw\.js';/);
  const tick = w.slice(w.indexOf('const partyRestFollowTick = () => {'), w.indexOf('/** SOC6 (Mac: "Party members should be able to be seen on the world map'));
  assert.match(tick, /^\s*if \(_partyRestReady && \(!social \|\| social\.now\(\) - _partyRestReadyAt > PARTY_READY_TIMEOUT_MS\)\) _partyRestReady = false;/m,   // AUDIT PARTY-REST: on the shared clock the readers use
    'the FIRST thing partyRestFollowTick does, every frame, unconditionally - before the mirroring/leader/party checks below it, which all reach it only in SOME frames');
});

// ── THE ENHANCED WINDOW'S SIZE (per-request: "the hours could be a bit
// bigger and also more centralized... the windows in general are too big") ──

test('enhancedRest.js: the rest panel is a small, centered dialog, NOT the generic .px-win default (min(920px,94vw) x min(620px,74dvh) - most of the screen, pinned top-left with no .rest-shell rule over it, the SAME missing-shell bug the tavern and merchant panels shipped with and already carry their own fix for) - and the hours field is a large, centered number, not the tavern\'s small left-aligned goldfield (mutants: .rest-shell missing the centering flex rule; .px-win left at its generic size under .rest-shell; the hours field sharing the goldfield\'s small font instead of its own bigger one)', () => {
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.rest-shell \{ display: flex; align-items: center; justify-content: center; \}/);
  assert.match(css, /\.rest-shell \.px-win \{ width: min\(420px, 92vw\); height: auto; max-height: min\(420px, 80dvh\); \}/,
    'a compact dialog sized for four buttons or one number field, not a content-heavy panel\'s default');
  assert.match(css, /\.rest-shell \.hours-field \{ display: block; width: 140px; margin: 4px auto 22px; font-family: inherit;\s*\n\s*font-size: 34px; text-align: center;/,
    'bigger and centered, not the goldfield\'s small left-aligned field meant for a gold amount beside a button');
  const js = rd('src/ui/enhancedRest.js');
  assert.match(js, /const input = el\('input', 'hours-field'\);/, 'the hours picker actually wears the class the CSS above targets');
  assert.match(js, /const acts = el\('div', 'acts selection-acts'\);/, 'the four Rest-screen buttons stack vertically in the compact dialog, not wrap in a row meant for a wide panel');
});

// ── ui/restWindow.js PARITY (per-request: "when the member gets the you wake
// up message he cant press ok till the leader pressed it") ──────────────

test('enhancedRest.js now matches ui/restWindow.js\'s own three deps calls exactly - deps.setResting(true) raised on OPEN (restWindow.js\'s own doc comment: "on OPEN, not on the first rested hour"), deps.setLoitering(true) only when Loiter is the chosen mode, and BOTH cleared on every exit through close() before deps.onClose() runs - and deps.onRestFinished() fires on the ended screen\'s OK button, not only on the died/no-lines path (mutants: setResting never called, or called only for a fresh rest and not a party mirror; setLoitering raised for every mode instead of loiter alone; close() clearing the flags AFTER onClose instead of before; the OK button calling close() alone, silently dropping the skill-raise moment restWindow.js\'s own input() names verbatim: "closing the finished popup is THE advancement moment")', () => {
  const js = rd('src/ui/enhancedRest.js');
  const ctor = js.slice(js.indexOf('const overlay = {'), js.indexOf('const startFixed = '));
  assert.match(ctor, /deps\.setResting\?\.\(true\);/, 'raised once, right after the overlay object itself is built - before any mode is even picked, same as restWindow.js\'s own constructor');
  const start = js.slice(js.indexOf('const startFixed = '), js.indexOf('overlay._start = '));
  assert.match(start, /if \(mode === 'loiter'\) deps\.setLoitering\?\.\(true\);/, 'only Loiter raises it - Rest-for-a-while and Rest-Until-Healed never do, same as restWindow.js\'s own TimedRestPrompt/loiter-prompt split');
  const close = js.slice(js.indexOf('const close = () => {'), js.indexOf('render();\n  releaseLock();'));
  assert.match(close, /deps\.setResting\?\.\(false\);\s*\n\s*deps\.setLoitering\?\.\(false\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(lockHandler[^\n]*\n\s*host\?\.remove\(\);/,
    'both flags cleared BEFORE host teardown/onClose - restWindow.js\'s own _close(): "The flags first and UNGUARDED... Then the dispatch, ONCE"');
  assert.match(js, /ok\.onclick = \(\) => stopOrClose\(\);/, 'AUDIT PARTY-REST: through the one body the keys and the stack share');
  assert.match(js, /if \(overlay\.state === 'ended'\) \{ close\(\); deps\.onRestFinished\?\.\(\); return true; \}/,
    'the ended screen\'s OK button calls onRestFinished too, not just close() - the died/no-lines path in overlay._end already called both together; this was the OTHER of restWindow.js\'s own two call sites, and the one this skin was missing entirely');
});

// ── STRANGER-REST1: non-party players can't rest too close together ─────

test('STRANGER-REST1 (2026-09-20, per-request: "other players that are not in a party together can rest near each other that should have a 100 meter block range... players not in a party together cant rest near each other in a 100m radius", then per-request: "stranger resting near each other should still work in taverns its okay to rest there and 30 meter radius in dungeons"): strangerRestGate skips the check entirely indoors (a tavern room, a shop, a guild hall - walls already separate one room\'s strangers from another\'s), uses a THIRD of the outdoor radius in a dungeon (its corridors are far tighter than the open road), and otherwise blocks on ANY rendered, visible peer within radius who is not a fellow member of MY OWN party - fires for a solo player with no party at all exactly as it does for one mid a party vote (mutants: the indoor skip missing, so a tavern with two unrelated guests blocks either of them from resting; the dungeon radius left at the outdoor 100 instead of 30; a fellow party member counted as a stranger; a peer with no live position, or myself, counted as a stranger; the mode read once and cached instead of fresh off modes.mode every call)', () => {
  const w = rd('src/scenes/world.js');
  const gate = w.slice(w.indexOf('const strangerRestGate = () => {'), w.indexOf('/** PARTY-REST1 (2026-09-20'));
  assert.match(gate, /const mode = modes\?\.mode \?\? 'exterior';\s*\n\s*if \(mode === 'interior'\) return null;/,
    'indoors - any building, not just a tavern by name - the check never runs at all');
  assert.match(w, /const radius = mode === 'dungeon' \? STRANGER_REST_BLOCK_RADIUS_DUNGEON : STRANGER_REST_BLOCK_RADIUS;/,
    'a dungeon gets its OWN, tighter radius; everywhere else (exterior, since interior already returned) gets the outdoor one');
  assert.match(w, /const STRANGER_REST_BLOCK_RADIUS = 50;/, 'STRANGER-REST2: "from 100m to 50m" (was "a 100 meter block range")');
  assert.match(w, /const STRANGER_REST_BLOCK_RADIUS_DUNGEON = 30;/, '"30 meter radius in dungeons"');
  assert.match(gate, /if \(!p\?\.id \|\| p\.id === online\?\.id \|\| !p\.feet\) continue;/, 'skips myself and any peer with no live position at all');
  assert.match(gate, /if \(social\?\.isPartyPeer\(p\.id\)\) continue;/, 'a fellow member of MY OWN party is never a stranger - regardless of whether I even have a party, this alone gates nothing about readiness or gathering');
  assert.match(gate, /if \(Math\.sqrt\(dx \* dx \+ dy \* dy \+ dz \* dz\) <= radius\) \{\s*\n\s*return 'Other players are too close to rest here\.';/);
  // wired into all three hosts, checked BEFORE partyRestGate in every one of them - a stranger blocks resting
  // regardless of party status at all, even for a solo player with no party.
  assert.match(w, /const strangerRefusal = modes \? strangerRestGate\(\) : null;[^\n]*\s*\n\s*if \(strangerRefusal\) \{ townTalk\.showOverlay\(new ActionTextBox\(\[strangerRefusal\]\)\); return; \}\s*\n\s*\/\/ PARTY-REST2/);
  assert.match(w, /strangerRestGate: \(\) => strangerRestGate\(\),/, 'injected into createWorldModes as one more host dep, alongside partyRestGate');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /const strangerRefusal = host\.strangerRestGate\?\.\(\);\s*\n\s*if \(strangerRefusal\) \{ mountInterior\(new ActionTextBox\(\[strangerRefusal\]\)\); return; \}/);
  assert.match(wm, /strangerRestGate: \(\) => host\.strangerRestGate\?\.\(\),/, 'forwarded again into dungeonContext.js\'s own opts, unchanged');
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const strangerRefusal = opts\.strangerRestGate\?\.\(\);\s*\n\s*if \(strangerRefusal\) \{ activeOverlay = new ActionTextBox\(\[strangerRefusal\]\); return; \}/);
});

// ── PARTY-REST1d: the pointer-lock bug ───────────────────────────────────

test('PARTY-REST1d (2026-09-20, per-request: "only the one who initiated the rest is prob able to press ok and then the others are [not]" - the bug this closed): enhancedRest.js releases pointer lock the SAME way every other enhanced DOM window already does (enhancedInventory.js, enhancedMenu.js, enhancedChargen.js, ui/heldMap.js) - once on mount, and again on every pointerlockchange event for as long as the window stays open, cleaned up on close (mutants: releaseLock never called on mount, so a follower\'s mirror - opened with zero clicks of its own - keeps the mouse captured for camera-look the whole time and every click on OK lands on the 3D view instead; the pointerlockchange listener never registered, so a relock mid-rest is never caught; the listener never removed on close, leaking one per rest)', () => {
  const js = rd('src/ui/enhancedRest.js');
  assert.match(js, /function releaseLock\(\) \{\s*try \{\s*if \(typeof document !== 'undefined' && document\.pointerLockElement\) document\.exitPointerLock\(\);\s*\} catch \{/,
    'the exact guarded pattern enhancedInventory.js/enhancedMenu.js/enhancedChargen.js/ui/heldMap.js already use');
  assert.match(js, /render\(\);\s*\n\s*releaseLock\(\);\s*\n\s*lockHandler = releaseLock;\s*\n\s*if \(typeof document !== 'undefined'\) document\.addEventListener\('pointerlockchange', lockHandler\);/,
    'released once on mount (covers BOTH a real rest someone clicked into and a follower\'s mirror that opened with no clicks at all) and kept released for as long as the window is open');
  assert.match(js, /if \(lockHandler && typeof document !== 'undefined'\) document\.removeEventListener\('pointerlockchange', lockHandler\);/,
    'the listener is removed in close() - every exit (Cancel, Stop, or dismissing the ended message) cleans it up, not just one of them');
});

// ── PARTY-REST2f: the stale-cooldown bug ─────────────────────────────────

test('PARTY-REST2f (2026-09-20, per-request: "it also seems it cant initiate a new rest it tell me vote is still ongoing" - the bug this closed): _partyRestGateRefusedAt is cleared back to -Infinity the moment a rest ACTUALLY STARTS - both when the leader\'s (or a gated follower\'s) own real rest opens, and when a follower\'s mirror starts - so a SECOND rest attempted soon after the first one succeeds is judged on its own fresh situation, never on the first vote\'s already-resolved refusal timestamp (mutants: the reset missing from either site; the reset run BEFORE the refusal check instead of after a successful start, clearing a cooldown that was still legitimately protecting an UNRESOLVED vote)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const partyRefusal = modes \? partyRestGate\(\) : null;[^\n]*\n\s*if \(partyRefusal\) \{ townTalk\.showOverlay\(new ActionTextBox\(\[partyRefusal\]\)\); return; \}\s*if \(modes\) markPartyRestSpent\(\);[^\n]*\n\s*townTalk\.showOverlay\(createRestWindow\(outdoorRestDeps\)\);/,
    'the leader/gated-follower\'s own toggleRest: spent (through the shared function - PARTY-REST28) happens AFTER the gate has already cleared, right before the real window opens');
  assert.match(w, /const markPartyRestSpent = \(\) => \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!isEnhanced\(\)\) return;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!social\) return;\s*\n\s*_partyRestReady = false;   \/\/ PARTY-REST2: spent the moment it is acted on - next nap asks again\s*\n\s*\/\/ PARTY-REST2f[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*_partyRestGateRefusedAt = -Infinity;/,
    'the shared reset itself: ready cleared, then (PARTY-REST2f) the cooldown clock cleared too, in that order');
  assert.match(w, /win\._start\(partyRestModeFromCode\(restingRow\.p\.rest\.mode\), restingRow\.p\.rest\.hoursRemaining\);\s*\n\s*_partyRestReady = false;[^\n]*\n\s*_partyRestGateRefusedAt = -Infinity;/,
    'a follower\'s mirror start ALSO clears it - this round is resolved from their own side too, not only the initiator\'s');
});

// ── REST-VITALS1: health/fatigue/magicka visible during resting ─────────

test('REST-VITALS1 (2026-09-20, per-request: "while healing fully you dont see your magica and health and fatigue so you dont know when its somewhat full you need to still track it. Make it visible again"): the resting screen shows the SAME Health/Fatigue/Magicka line ui/restWindow.js\'s own resting page already draws (restingLines()/its native counter draw both read deps.vitals()), reading the exact same shared deps.vitals() a mirror inherits unchanged from outdoorRestDeps - so a follower sees their own real numbers advancing too, not just the leader (mutants: the vitals line missing entirely; deps.vitals() never called, or called but not written into the line; a hand-rolled health/fatigue/magicka read instead of the shared deps.vitals() every OTHER skin and the classic window already agree on)', () => {
  const js = rd('src/ui/enhancedRest.js');
  assert.match(js, /const vit = deps\.vitals\?\.\(\);[\s\S]{0,700}?_restingRefs\.vitalsLine\.textContent = vit \? `Health \$\{vit\.health\}\/\$\{vit\.maxHealth\} {2}Fatigue \$\{vit\.fatigue\} {2}Magicka \$\{vit\.magicka\}` : '';/,
    'the exact same line shape restWindow.js\'s own restingLines()/native counter draw already use, read off deps.vitals() - never a separate health/fatigue/magicka read of its own; written by updateRestingDisplay (RESTFIX1), not rebuilt by restingCard on every tick');
  const rw = rd('src/ui/restWindow.js');
  assert.match(rw, /lines\.push\(`Health \$\{v\.health\}\/\$\{v\.maxHealth\} {2}Fatigue \$\{v\.fatigue\} {2}Magicka \$\{v\.magicka\}`\);/,
    'confirms the enhanced line matches classic\'s own wording exactly, not a close approximation');
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.rest-shell \.vitals-line \{/);
});

// ── RESTFIX1: the Stop button (per-request: "the initiator and the one who
// rests with him both cant cancel the resting! the button is not working
// and doesnt cancel it. Waiting and healing to full cant be canceled by
// both sides prob loitering too") ──────────────────────────────────────

test('RESTFIX1 (2026-09-21, the bug this closed): overlay.tick() no longer calls render() while resting - a full render() runs host.innerHTML = \'\' and rebuilds every element FRESH, the Stop button included, and tick() used to call it on EVERY FRAME (the countdown has to move with no input at all), tearing the real button out from under a click roughly sixty times a second - a browser click needs mousedown AND mouseup to land on the SAME element, and a human gesture almost always spans more than one animation frame. tick() now calls updateRestingDisplay() instead, which writes into three node references restingCard kept (the hour/time label, the meter fill\'s width, the vitals line) and never touches the button at all - true for every mode (timed, loiter, full) and both roles (a real rest or a follower\'s mirror), since neither ever depended on which one it was (mutants: render() still called from tick(); updateRestingDisplay() rebuilding rather than writing in place; the Stop button recreated by anything that runs every frame)', () => {
  const js = rd('src/ui/enhancedRest.js');
  assert.match(js, /overlay\.tick = \(dt\) => \{\s*\n\s*if \(overlay\.state !== 'resting' \|\| !overlay\.session\) return;\s*\n\s*const r = overlay\.session\.tick\(dt\);\s*\n\s*if \(r\) \{ overlay\._end\(r\); return; \}\s*\n(?:\s*\/\/[^\n]*\n)*\s*updateRestingDisplay\(\);\s*\n\s*\};/,
    'tick() calls updateRestingDisplay(), never render()');
  assert.doesNotMatch(js.slice(js.indexOf('overlay.tick = (dt) => {'), js.indexOf('overlay.dispose = ')), /render\(\)/,
    'render() is not named anywhere inside tick() at all - not called, not even in a comment that could hide a stray call');
  assert.match(js, /let _restingRefs = null;/, 'the three per-frame node references, kept across ticks - not rebuilt each one');
  assert.match(js, /_restingRefs = \{ hourLabel: v, fill, vitalsLine \};\s*\n\s*updateRestingDisplay\(\);/,
    'restingCard() builds the structure ONCE (on the real state change into \'resting\') and immediately primes the first frame\'s numbers through the SAME update path tick() uses later - never a separate initial render of the text');
  assert.match(js, /function updateRestingDisplay\(\) \{\s*\n\s*if \(!_restingRefs\) return;/, 'safe to call before the resting card has ever built its nodes');
  assert.match(js, /_restingRefs\.hourLabel\.textContent = overlay\.mode === 'timed' \? `\$\{s\?\.hoursRemaining \?\? 0\}h` : `\$\{s\?\.totalHours \?\? 0\}h`;/, 'AUDIT PARTY-REST: a rest until healed counts the hours passed, as loiter does');
  assert.match(js, /_restingRefs\.fill\.style\.width = `\$\{Math\.max\(0, Math\.min\(100, frac \* 100\)\)\}%`;/);
  // the Stop button itself: built once, inside restingCard - never inside updateRestingDisplay, which only
  // ever WRITES into existing text/style, never creates a button at all.
  const update = js.slice(js.indexOf('function updateRestingDisplay() {'), js.indexOf('function endedCard()'));
  assert.doesNotMatch(update, /el\('button'/, 'updateRestingDisplay never creates any element, the Stop button included');
  // PARTY-REST19: the Stop button now also fires deps.onManualStop() before _end() - matched loosely so this
  // survives that addition while still pinning the one thing this assertion actually cares about: built once,
  // never touched by updateRestingDisplay.
  assert.match(js, /const stop = el\('button', 'act', 'Stop'\);\s*\n(?:\s*\/\/[^\n]*\n)*\s*stop\.onclick = \(\) => stopOrClose\(\);/,
    'the Stop button is built exactly once, inside restingCard, and never touched again while the same rest keeps running');
});

test('REST-VITALS1 confirmed by code, not just by test: a follower\'s mirror heals with the SAME deps.tickVitals/deps.fullyHealed every real rest uses (per-request: "check if the members who didnt initiate the rest also heal up with everything") - both are composed UNCONDITIONALLY inside createRestDeps over its own `entity` closure (never something a caller\'s spread can drop or override), and partyRestMirrorDeps only ever overrides enemiesNearby/advanceMinutes/commitCrime/place - never tickVitals, fullyHealed, dead, or vitals - so a follower\'s own health/fatigue/magicka genuinely advance exactly as they would if that follower had opened the window themselves (mutants: tickVitals/fullyHealed made overridable, so a future edit could silently stub them for a mirror; the entity closure swapped for one not this follower\'s own)', () => {
  const sh = rd('src/scenes/shared.js');
  assert.match(sh, /tickVitals: \(\) => \{[\s\S]{0,900}?return healed;\s*\n\s*\},\s*\n\s*fullyHealed: \(\) => restFullyHealed\(entity\),/,
    'both close over THIS createRestDeps call\'s own `entity` param - always the caller\'s own playerEntity, never anyone else\'s');
  assert.match(sh, /restHour\(entity, _kind, \(\) => restVitals\(entity, \{ day: day\(\), inside: inside\(\) \}\), _roughCarry\)/,
    'PARTY-REST10: the per-session rough-rest carry rides along on every call - the same entity\'s own banked remainder, never a fresh/shared one');
  const w = rd('src/scenes/world.js');
  const mirrorDeps = w.slice(w.indexOf('const partyRestMirrorDeps = (restKind) => {'), w.indexOf('/** PARTY-REST1 (2026-09-20'));
  for (const untouched of ['tickVitals', 'fullyHealed', 'dead:', 'vitals:']) {
    assert.doesNotMatch(mirrorDeps, new RegExp(`${untouched.replace(':', '\\s*:')}\\s*:`), `partyRestMirrorDeps never overrides ${untouched} - inherited unchanged from outdoorRestDeps via the spread`);
  }
});

// ── PARTY-REST4: a follower heals at the SAME quality as the leader ─────

test('PARTY-REST4 (2026-09-21, per-request: "15m away from the leader do not change the healrate party member MUST heal their health near the leader" - the bug this closed): partyRestMirrorDeps takes the resting member\'s own broadcast restKind and, when one was actually broadcast, overrides restKind() to answer it directly - a follower shares the LEADER\'s bed/camp/rough, never their own feet\'s independent (almost always Rough) reading of it; with no kind broadcast at all (an older peer, or survival mode off) the override is skipped entirely, falling back to the inherited outdoorRestDeps one exactly as before this fix existed (mutants: the override unconditional, replacing a perfectly good absent-kind fallback with `() => undefined`; the mirror-start call site not passing the resting member\'s own p.rest.kind at all)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const partyRestMirrorDeps = \(restKind, targetAcct\) => \{/, 'takes the resting member\'s broadcast kind as its own parameter (and, PARTY-REST19, their account - for onManualStop\'s own cancel-request target)');
  // PARTY-REST4b (2026-09-21, confirmed by live testing - the ORIGINAL PARTY-REST4 fix below was a genuine
  // closure bug: spreading a `restKind` KEY onto a copy of outdoorRestDeps never reached `setResting`, which
  // is one specific closure made once over outdoorRestDeps' OWN `restKind` local, never a property looked up
  // off whatever object it happens to be attached to. Fixed at the real seam: `overrideRestKind`, a door
  // shared.js's createRestDeps exposes into the SAME closure setResting reads from.
  assert.match(w, /outdoorRestDeps\.overrideRestKind\(restKind \? \(\) => restKind : null\);/,
    'reaches the actual closure setResting reads from - not a spread-added key on a copy of the returned object, which setResting was never able to see');
  assert.match(w, /const win = createRestWindow\(partyRestMirrorDeps\(restingRow\.p\.rest\.kind, restingRow\.acct\)\);/,
    'the mirror-start call site passes the SAME restingRow already used to seed mode/hoursRemaining - one consistent read of who is actually being mirrored (and, PARTY-REST19, their account, for onManualStop\'s own cancel-request target)');
  const sh = rd('src/scenes/shared.js');
  assert.match(sh, /overrideRestKind: \(fn\) => \{[^\n]*_restKindOverride = fn \?\? null;[^\n]*\},/,
    'the override door itself - null/undefined goes back to inheriting restKind(), a function wins over it');
  assert.match(sh, /\(_restKindOverride \?\? restKind\)\(\)/,
    'setResting reads the override FIRST when one is set, falling back to the inherited position-based restKind() only when none was broadcast at all');
});

// ── RESTFIX3: the illegal-rest confirm/crime flow ────────────────────────

test('RESTFIX3 (2026-09-21, per-request: "normaly when you start resting it asks you if you really want to rest cause its not allowed and when you press yes the guards come. This message is missing entirely now" - the bug this closed): the enhanced skin\'s Rest-for-a-While and Rest-Until-Healed buttons now route through the EXACT SAME two pure functions ui/restWindow.js\'s own _restButton/_canRest call - illegalRestWarning() (a settings preference) and canRest() (systems/restSession.js) - never a reimplementation of either; a confirm box shows ILLEGAL_REST_WARNING verbatim when camping in the open street of a town and the preference is on; canRest\'s own crime is committed regardless of which arm answers, and an outright refusal shows canRest\'s own text and closes the window rather than raising RaiseSkills (never routed through the \'ended\' state). Loiter is NOT gated by any of this, matching restWindow.js\'s own explicit exclusion (mutants: Loiter also routed through the confirm/canRest check; commitCrime only called on the refusal path, never on an ALLOWED-after-crime one; a refusal routed through the normal ended/onRestFinished path instead of closing without it; canRest\'s own logic duplicated here instead of imported and called)', () => {
  const js = rd('src/ui/enhancedRest.js');
  assert.match(js, /import \{ RestSession, MAX_REST_HOURS, PROMPT_INITIAL, canRest, illegalRestWarning, ILLEGAL_REST_WARNING, REST_TEXT, loiterLimitHours, cannotLoiterLines, CANNOT_REST_MORE_THAN_99_HOURS_ID \} from '\.\.\/systems\/restSession\.js';/,
    'the same pure functions classic imports - never a local reimplementation of the legality/crime law');
  assert.match(js, /btn\('Rest for a While', \(\) => continueRest\('while', false\)\);/);
  assert.match(js, /btn\('Rest Until Healed', \(\) => continueRest\('healed', false\)\);/);
  assert.match(js, /btn\('Loiter', \(\) => \{ overlay\.state = 'hours'; overlay\.mode = 'loiter';[^}]*\}\);/,
    'Loiter goes straight to the hours picker, exactly as before this fix - never through continueRest/canRestNow at all');
  const continueRestFn = js.slice(js.indexOf('function continueRest('), js.indexOf('function selectionCard()'));
  assert.match(continueRestFn, /if \(!alreadyWarned && illegalRestWarning\(\) && deps\.restPlace\?\.\(\)\?\.inTownOutside\) \{/,
    'the confirm box only fires camping in the open street of a town, and only if the preference is on - never for an indoor rest, a dungeon, or the wilderness');
  assert.match(continueRestFn, /overlay\._pendingRest = which;\s*\n\s*overlay\.state = 'confirm';/);
  const canRestNowFn = js.slice(js.indexOf('function canRestNow('), js.indexOf('function continueRest('));
  assert.match(canRestNowFn, /const d = canRest\(\{ \.\.\.place, alreadyWarned \}\);/, 'the SAME canRest() classic calls, not a copy of its logic');
  assert.match(canRestNowFn, /if \(d\.crime\) deps\.commitCrime\?\.\(d\.crime, d\.spawnGuards\);/,
    'committed unconditionally on d.crime, BEFORE the allowed check - canRest\'s own inTownOutside arm sets crime on EVERY answer, allowed or not, and this must not skip it either way');
  assert.match(canRestNowFn, /if \(d\.allowed\) return true;/);
  assert.match(canRestNowFn, /overlay\.state = 'refused';/);
  assert.doesNotMatch(canRestNowFn, /onRestFinished/, 'a refusal never reaches the RaiseSkills moment - canRest\'s own law, restWindow.js\'s own comment: "a refusal raises nothing"');
  assert.match(js, /const yes = el\('button', 'act', 'Yes'\);\s*\n\s*yes\.onclick = \(\) => \{ const which = overlay\._pendingRest; overlay\._pendingRest = null; continueRest\(which, true\); \};/,
    'Yes re-enters with alreadyWarned=true - the SAME two-call shape classic\'s own _restButton(which, true) uses');
  assert.match(js, /const no = el\('button', 'act', 'No'\);\s*\n\s*no\.onclick = \(\) => \{ overlay\._pendingRest = null; overlay\.state = 'selection'; render\(\); \};/);
  assert.match(js, /overlay\.state === 'confirm' \? confirmCard\(\)\s*\n\s*: overlay\.state === 'refused' \? refusedCard\(\)/,
    'both new states wired into render()\'s own switch');
});
