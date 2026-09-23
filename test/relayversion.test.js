// SLAM8 (2026-09-16, AUDIT SLAM): RELAY_VERSION CANNOT BE FORGOTTEN AGAIN.
//
// The line above `RELAY_VERSION` has said "Bump it with every relay-changing slice" since WORLD1, and SLAM5 changed
// the relay's hello path - the 130-player wall - and left it at `world67`. So `world67` named BOTH the relay that
// stops an event at 130 players and the one that does not, and `/health` is the only pre-flight check this port has
// on event day: the relay is deployed by hand and nothing in CI deploys it.
//
// A hand-maintained constant beside a comment asking politely will be forgotten again; that is what a comment is.
// So the version is bound to the LAW ITSELF here. `server/src/index.js` is the relay and `src/net/wire.js` is the
// law it runs (re-exported by server/src/relay.js), and a change to either is a change to what a deployed worker
// does. Change one of those files and this pin fails until a NEW version with its own hash is added below - and it
// has to be new, because the old version's recorded hash is the old bytes and stays that way.
//
// This deliberately fires for a comment-only edit too. `/health` answers "is the worker running the bundle I built?",
// and a bundle whose comments differ is a different bundle; a version that is only sometimes trustworthy is the
// thing that just cost us.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { graph } from './importGraph.mjs';   // ACC4: the walk moved to a helper so the ACCOUNT Worker's deploy filter is held to its own graph by the same law
import { RELAY_VERSION } from '../src/net/wire.js';   // LOCALDEV1: the worker entry exports handlers alone

/** SLAM13 (AUDIT SLAM, final lens): THE LAW IS THE WHOLE BUNDLE, not two files. wrangler bundles every relative import
 *  the worker reaches - server/src/relay.js, src/net/wire.js and, since ONCRASH1, src/world/mat4.js (wrapAngle, which
 *  poseChanged and validPose run on every pose) - and an edit to any of them is a different deployed worker under the
 *  same name. So from world73 on the hash walks the import graph from server/src/index.js: every relative `from '...'`,
 *  depth first, each file once, in the order the imports are written. A file joining the graph changes the hash too,
 *  which is the point - a new import is a new bundle. Rows before world73 were sha256(index.js + wire.js) and stay
 *  as recorded: they are facts about bytes already deployed, under the hash law of their day. */
export const RELAY_GRAPH = graph('server/src/index.js');

/** A version bump is `sed world<N>/world<N+1>` over nine test files - RUN IT WITH THIS FILE EXCLUDED, or it
 *  rewrites a row's KEY and relabels bytes already deployed (AUDIT SLAM / SLAM9 did exactly that, and this pin caught it).
 *  Every relay this repo has shipped a law for, and the sha256 of its law that IS it (see `graph` for what the law is).
 *  Append; never edit an existing row - an old row is a historical fact about bytes that have already been deployed. */
const LAW = {
  world69: '27da57b0787d8e18e93dea8358614d9af2e9c65133774755f39960e0ec8f89de',   // SLAM8: a keepalive is never tiered; turn counts what was relayed
  world70: '06cb8eb45de961f9756a71a3cfba19fd84e3a3e7a5217d5e3798e3b11cf4ebed',   // SLAM9: the who budget derived from the socket gates, spent before the scan
  world71: '37bfb4d0bc508775233bcbabbe4bbd7b1b4dc4fccd148e9a17c72fba0dd0e877',   // SLAM10: the far tier bucketed by the listener's id, stable under movement
  world72: 'de19e038912ea8e2e0568923bcf398b86ea2c80c173051129c0ece93bf6efa51',   // SLAM11: the memory push and the act fan borrow against their budgets and land whole
  world73: 'c12e8b6497602a53eead0f4b7abb41a0f6b65be217e174e9ed11c0244a9362ba',   // SLAM13: the keepalive floor, the sender's act share, the memory a listener at a time, the yaw seam, the version in the welcome (first row over the import graph)
  world74: 'f09ab5bdcc836a30fe540d4558a7d0a6c1c933130d9db4d61d5e86c896b55595',   // MERGE (SLAM13 + SRV-N/CHAT-G onto main): one `v` on every welcome, last; the chat's third gate reaches nameFilter.js
  world75: '4587d8fa5adbfc5df062feb6831c1d191ac0563b7312d4bff7d311aa00093cac',   // SLAM15: a stop is heard whole, under the keepalive's floor
  world76: '6f7d8d11d5c055d02fadc70935d9951b3c99732f8b59c9f9f4b72363b873781f',   // LOCALDEV1: the worker entry no longer exports the version string (workerd refused the bundle locally)
  world77: 'b8daad37e99a5f42c73910a000a44c3cca5d82c955cfed8bb064c10239e6aa60',   // ROSTER-G: the channel's welcome names its members with the true count; its joins and leaves are said
  world78: '059dda8d32a6e836c44d67cb2a81e969f7d9f15468e60262f57798b37c083ec6',   // SOC1: the world channel is the social hub - accounts (id + secret beside the peer's), friends, requests, presence and last-seen, four-seat parties, the party pose fan
  world79: '1ce0aa5a1a3080a2ce121be6e9bb832cd4f5a0312dd47bb18963aebfacd03a6a',
  world80: 'fc02a655c311d19778d026248c77d6a2f85bf25888865942e0520164db7bac8d',   // RESPAWN1: validSharedFoe takes `team`/`mobileTeam` as the MobileTeams NAME - the numeric law refused every foe record a dungeon published, so every memory restored empty and every kill came back alive   // AUDIT SOC: the hub's cooldowns, the paged sweep of idle accounts and lapsed parties, pending rows without presence, by-account acts for relations alone, the record cache, the newest tab speaking, the replaced socket's leave, the clock on the channel welcome, `peers` on the picture, the act projected at the door
  world81: '38878bdb5febe591e819830f195ef68f75a620930f4f35d08e18984887559328',   // AUDIT WATCH1 A1: wire.js gained CELL_WATCH_PUPPETS_MAX (the reader's allowance for a criminal's watch beside its foes) - no relay behaviour moved, the bytes did
  world82: '2c97add60a97d56f949ce6af4f8bba4947a862ad75183c578803c1c62864325a',
  world83: '30d4fd6bb7a536b22ff0c01c08db137026181e39d0222b3607db30a43014f21e',
  world84: '3cb3d6118b2798c89790a182d0d3eb69bd8f5bfb1cb87fcb997b0d50c2e433e2',
  world85: '87888cc6cd63b20a02967f9d839ca20781d453585baf41e482ad58f2cd0f5878',   // ACC1d: THE TOKEN SEAM. server/src/index.js imports src/net/identityToken.js, so the module joins the bundle and the hash changes for that alone; wire.js carries `tok` on the hello (shape only - parseClient is sync and pure and the crypto is the relay's); the room verifies, takes the name OUT of the token, spends each signature once per room (F8, Mac: a token is spent once), and marks the frames it vouches for with `v`. The key and the TTL ceiling are config beside each other in server/wrangler.toml.   // RELAY-H1: HEARTBEAT_MS 5000 -> 20000 and PING_MS beside it in wire.js (the standing player's liveness rides the runtime-answered ping, so the object sleeps between poses); KEEPALIVE_FAN_MS follows; the relay's own SLAM8 comment notes the pair moved   // ONLINE-CLASS1: validLook carries the character's class name (letters-only, optional), so a peer without a Morrowind body stands as its class-enemy sprite; an older peer's look without it still validates   // AUDIT ALL (the merge): the main merge moved a comment line in wire.js under world81 and the row was rewritten in place - SLAM5 verbatim; world81 restored to the audit's bytes, world82 names today's
  world86: '35e2f0bb2c14248083dd5514c52951015b85646d9d97ee207e4162684f4f1a2b',   // ACC1g: THE WALL MOVES TO THE DOOR (Mac: "You shouldnt be able to just type a name and enter anymore.... this is what the account system is for"). server/src/index.js `_named` REFUSES a hello with no token and one it has no usable key to check - the two arms ACC1d admitted, and admitting them was the hole ACC1a opened this arc to close: the name on a hello was the client's own and the relay only sanitised it. A GUEST IS NOT SHUT OUT - a guest session mints a token like anybody else, so the cost to a new player is one press and no email. AND `v` LEAVES THE WIRE IN THE SAME DEPLOY: every admitted socket is verified now, so the per-name verdict on the join, the roster (wire.js `rosterFor`) and the chat line said the same thing about everybody - a field carrying no information. It goes here rather than in a later slice because a wire change costs a drop and this deploy is already paying for one; ACC1d-MARK, its only reader, is retired with it.
  world87: 'b35a4d0ec7579023e6ba83ea894ceeba3bd65c26f22ea9a568e9de94eb7b4150',   // ACC3: TITLES AND GLYPHS RIDE THE SIGNATURE (Mac: "Player titles appear above a player name... name glyphs... appear on the right side"). src/net/identityToken.js gains TITLES, GLYPHS and the `t`/`g` claims, validated against those two closed lists before a token verifies; server/src/index.js `_named` reads both OUT of the verified claims, and wire.js `badged` puts them on the welcome's roster rows, the join, the channel roster and the `who` answer - absent, never null, when there is no badge. A CLIENT NEVER ASSERTS EITHER, which is ACC1g's law applied to a stronger claim than a name: a title over somebody's head reads as this project's own word about them. The deployed relay is still world84, so world86 and world87 ride ONE drop between them.
  world88: 'b96b8ca4a994bf052081da4499f6b34d864bf8ceb03fd8c27aa981c03510747d',   // ACC3b: `readBadge`, the INVERSE of world87's `badged`, in wire.js beside it - the client's half of one field, so a badge cannot be written one way and understood another. It is the relay's bundle only because the pair lives together; the relay never calls it (it reads a badge out of a verified token, never off the wire). wire.js imports the vocabulary from identityToken.js, which was already in the graph, so the bundle gained bytes and no file.
  world89: 'c6bbe33551e8d6be470e63cb75cfa75dd9012ebe56dad189b7681f4a8d573067',   // RED1: THE SERVER SPEAKING (Mac: "a red text system (kind of like warframe) where I can message chat as the server before we merge"). A `say` frame in, a `red` frame out to every socket in the room, and THE AUTHORITY IS THE DEV GLYPH THE TOKEN ALREADY CARRIED - `a.glyphs` was written by `_named` off the verified claims and can be written by nothing else on that socket, so the right to speak as the server is the same fact as the mark beside the name, granted and revoked the same way, with no second password, no admin route and no second key to leak. Its own bucket at RED_HZ_MAX, deliberately well under chat's, because a player's line reaches a room and this reaches every player in the game. The line carries no id and no name, because nobody is speaking it - and it is its OWN frame type rather than a flag on a chat line, so the client marks it from the type, which no player can send.
  world90: '7f109a2bc863ab36fe9517fad4c43300e4409839ad8036459024fd0db4e443aa',   // MOD1: THE MODERATOR'S MUTE (Mac: "a moderator glyph and moderator chat commands" - /mute, /unmute, the blue shield). identityToken.js gains the `mod` glyph, the `mu` claim (a mute rides the signature, so a reconnect cannot shed one) and a second token SHAPE - the mute ORDER, `{o:'mute', s, mu}`, which one key signs beside identities and which the claim shapes keep apart both ways. server/src/index.js keeps the verified account (`sub`) and the mute (`mu`) on the attachment, refuses a muted line and tells only its sender, and gains a `mute` arm that believes the ORDER'S SIGNATURE and never its carrier, the newest order per account winning (`_orders`) so a replay cannot undo an unmute and a token older than the order is held to it. wire.js carries `{t:'mute', order}` in, `{t:'muted', until}` out, `sub` on chat lines and a channel's roster and joins, MUTE_HZ_MAX. The key load moved into `_loadKey` so the hello and the order share one.
  world91: '0a4606f6b2d934132adaf12ec9bb3eb28190c5b080c2946445c395a2c315bd10',
  world92: '4dbadc7abb0751cc241a86991bbc8c45df9379416fd5cd9b91ab3ef0524a9c79',   // AUDIT DROPS (2026-09-22): the trade bytes budgeted per sender (B3), the hub's quest cooldown at half the client's floor (C1), the quest budget spent only with a party to reach (C3)   // QUEST1 + TRADE1 + PEER-FS1 (2026-09-22, three drops from Mac's contributors in one deploy): the {t:'quest'} hub frame (a party member's quest shared, validQuestFrame, its own cooldown and QUEST_FRAME_MAX), the {t:'trade'} directed frame (a courier between two peers - validTradeData, tradeGate, the room's trade byte budget), and the pose's footstep byte for the peers' footsteps. An older relay closes on the unknown frames, so the clients offer Trade only to world91 or later (TRADE_RELAY_MIN).
  world93: 'ff1fac557b7368668303860530b55780673c8fb33c8627b1b3a9fc1c39b98562',   // PARTY-REST DROP (2026-09-22): the party pose grew rest.kind, voteAt, restEnemyAt, restCancelFor/At, restStartedAt; bk a full 32-bit key
  world94: '6f482bb81f3a49306cfe3b936e44f8b7bec72d0b09286d687b2b9e58cb9e16da',   // PARTY8 (2026-09-22, Mac: "increase the party limit to 8"): PARTY_MAX 4 -> 8 in wire.js - a party frame's member bound, so the hub and the client move together
  world95: '4c705e967ac2f039cb79517a3ad64e89404d2a15c0500f917e0b336f66e5a0a7',   // AUDIT PARTY8 + AUDIT PARTY-REST (2026-09-23): the party pose carries `readyAt` (a vote's shared-clock stamp every reader judges for freshness), the hub's quest fan pays in bytes (QUEST_ROOM_BYTES_PER_S), a lapse burst says the lead once, the lead passes to an online seat
};

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url));

test('SLAM8: RELAY_VERSION names exactly one relay law - change the worker or the wire without bumping it and this fails (mutants: the relay edited under a version already shipped, which is SLAM5 verbatim; a row rewritten in place, which relabels bytes that are already deployed)', () => {
  // MERGE onto main (SRV-N / CHAT-G): wire.js reaches net/nameFilter.js now - the chat's third gate - and this pin caught the graph growing, as it is for
  // ACC1d: identityToken.js JOINED THE BUNDLE, which is the expensive line in the accounts arc - the relay verifies the name it is told, so the token module is the worker now, and this deploy drops every connected player. The order is the walk's own (index.js reaches the token module before relay.js re-exports the wire).
  assert.deepEqual(RELAY_GRAPH, ['server/src/index.js', 'src/net/identityToken.js', 'src/net/wire.js', 'src/world/mat4.js', 'src/net/nameFilter.js', 'server/src/relay.js'], 'the bundle the worker is: a new file here is a new law, and this row says so until it is written down');
  const h = createHash('sha256');
  for (const f of RELAY_GRAPH) h.update(rd(f));
  const hash = h.digest('hex');
  assert.ok(LAW[RELAY_VERSION], `RELAY_VERSION is '${RELAY_VERSION}' and this file has no law recorded for it - add the row`);
  assert.equal(hash, LAW[RELAY_VERSION],
    `THE RELAY'S LAW CHANGED UNDER '${RELAY_VERSION}'.\n`
    + `  Bump RELAY_VERSION in src/net/wire.js and add a row here in the SAME commit:\n`
    + `      ${'<new version>'}: '${hash}',\n`
    + `  /health is the only pre-flight check the event has, and it has to mean something.`);
  assert.equal(new Set(Object.values(LAW)).size, Object.keys(LAW).length, 'two versions cannot name the same bytes');
  assert.ok(/^world\d+$/.test(RELAY_VERSION), 'the shape law (nine test files hard-code this spelling)');
});
