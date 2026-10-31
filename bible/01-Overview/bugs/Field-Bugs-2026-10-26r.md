# FIELD BUGS 2026-10-26r - the private reports of 10-18 to 10-26, read to their roots

The 293 reports open in the private-report inbox (PRIVATE-REPORT, `server-account/src/reports.js`: 258 bugs, 33 exploits
and 2 marked security, sent 2026-10-18 to 2026-10-26 from updates 0.0.233 to 0.0.432). The owner: "I want to fix them
all". Read on main's `d5a4c9c6a` with the freeware's data (`tools/fetch-data.sh`), in twelve lanes, each by a reader of
its own, and merged here with main as it then stood. Field-Bugs-2026-10-19f read the first 56 of these reports; a
report that record or a later one closed is marked ALREADY FIXED with the record that closed it.

The inbox is private - a report is read by the handles `REPORT_READER_HANDLES` names and nobody else - and this
repository is public, so this page names no reporter and quotes none of their words (19f's rule); an exploit is described
only as far as its fix needs. A report's number here (`#n`) is its place in the inbox, oldest first.

AUDIT RPT1026 (`../audits/Audit-Rpt1026.md`, 2026-10-27) read this batch cold in thirteen lanes; what it found is
fixed in place, and the rows and sections below say what each fix now does (each audit fix names its `AUDIT RPT1026 <id>`).

Every report has one verdict. #245 is the one report read in two lanes - its bank half under RPT1026-CHESTGOLD, its
trade-hold half under RPT1026-MARKET - and it is counted once, FIXED (HOLD-SAID); every other report has one row.
A row's verdict is its Done column's first words; an "Answer the player" row's is the first words of its What it was.

| Verdict | Reports | What it means |
|---|---|---|
| FIXED | 103 | The cause found on the code, fixed, and pinned by a test that fails without the fix |
| ALREADY FIXED | 67 | Closed by a record newer than the build it was sent from (the update a report carries is its build - REL8) |
| AS DESIGNED | 46 | The game's rule or DFU's, named; what to tell the player is in its row |
| NOT REPRODUCED | 26 | Traced end to end on the real producers, and nothing there makes it; what was run is in its row |
| NEEDS DATA | 38 | The cause is in one player's own record or machine; what to read is in its row |
| STAFF | 10 | A staff action or a moderation call, not code (the last section) |
| WITHDRAWN | 3 | Taken back by its own reporter |

AUDIT RPT1026 M1: the counts were taken before RPT1026-WORLD's second pass made FAR-QUAY (#200), CONFIRM-REREAD and
CONFIRM-ONCE (#252) and DECOR-VERBS (#244) fixes, and before #261 and #23 were given their sections' verdicts (NEEDS
DATA both); they are the rows' now, held by `test/bible/audit_rpt1026_m.test.js`.

The pins are `test/**/rpt1026_*.test.js`, the mutants `tools/mutants/rpt1026_*.json` (all dead, a few recorded
equivalent). Pins of other records that a fix moved say PIN MOVED beside the line they read now.

THE SERVICES. ACCOUNT_VERSION acct198 (`server-account/src/service.js`, `wrangler.toml`; acct197 on its lane, renumbered past FIELD BUGS 2026-10-26d's at the merge), migration 0178
(`0178_rpt1026_ledgerlaw.sql`: `products.handed_to`, `realm_characters.law_v` - 0176 on its lane, renumbered past main's
0176 and 0177 at the merge). RELAY_VERSION world272 (`src/net/wire.js`, world270 then world271 on its lane, renumbered past main's CHAT-POST and MASTER-THREE at the merges; the relay's law moved under RPT1026-FIGHTS,
-SECNET, -EVENTS and -PROGRESS). Either service may deploy first: every new field is one an older peer ignores, and every
new refusal is one an older client reads as a refusal.

## Accounts, blocks and the line (RPT1026-SECNET)

| | Report | What it was | Done |
|---|---|---|---|
| 104 | A private security report: a thief racing the owner's recovery could keep the account | AUDIT 68 S01 guarded only the writes a recovery makes itself. A password change, a sign-in's rehash and new session, and a second device each wrote by the account's id alone, on what they had found when they began. A thief who held the password and raced the owner's recovery kept the account: the change put the thief's password on top of the owner's and ended the session the recovery had just opened, and a sign-in opened a session after the recovery had ended every device's | RPT1026-SECNET (RECOVERY HOLDS) |
| 107 | Requests a block should stop (trades, journal pages) were let through | The relay's arms for trades and pages were older than SAFE1 and stamped the sender's id alone, never its account. The session asked its block list only about a frame that named an account, so one naming none counted as not blocked. SAFE CLIENT-7's pin hand-built a trade frame naming an account the relay never put there, in the world channel, where the relay routes no trade | RPT1026-SECNET (BLOCK STAMP) |
| 102 | Back online inside an instance, a party member is put offline for good | `sendAct` was the one world-room sender left that SD-HELLO did not cover. It checked only that the socket was open, which it is from the hello on. A party member's hello at an instance is held while the hub is asked, whenever the room's yes for that member is older than INSTANCE_KIN_KEEP_MS. A door's act queued while the socket was away left with the frame after the hello, the room read it first and refused it with a policy close, and that close is terminal | RPT1026-SECNET (ACT WAITS) |
| 232 | Out of step with the party after dying in an instance; after a wipe, one member invisible | The same failures WIPE-RETURN was written for. The door offered a partner's room only off a pose that named it, and listed `Your instance` (a quest copy's own room) before the party's | ALREADY FIXED: WIPE-RETURN (`594830855`, on main in #1280 `34584a5c0`, after the report's build). RPT1026-SECNET's ACT WAITS closes the other path a return took (the rejoin's hello is held while the hub is asked) |
| 236 | Two party members lost sight of each other after one took a dungeon teleporter up and back | A teleporter inside a dungeon moves the player within the same room. The code cannot part two players that way. The two ways it could part them are closed: a trip out and back through the door (WIPE-RETURN's party rows first, #1280, after the report's build) and a reconnect whose door act was read ahead of the hello (ACT WAITS) | NOT REPRODUCED |
| 91 | Dropped from the online world many times over on a poor line | Every close is retried with backoff except a policy refusal and another window taking the seat. A bad line reached two policy refusals. One was a frame read ahead of a reconnect's hello (ACT WAITS, and three more sends it found). The other: a stalled TCP line keeps every pose and delivers them in one burst, and about 22 s of a walk (18 s of a host's foes) is DROP_STRIKES_MAX over-rate frames in a row - the relay's meter closes the socket, terminal in that room. The session had no way to know its line was stalled | RPT1026-SECNET (LINE-STALL) |

### RPT1026-SECNET: RECOVERY HOLDS (104) - `server-account/src/accounts.js`, `server-account/src/index.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no accounts.

WHAT THE PORT DID. Recovery is the way back for an owner whose password was stolen. It sets a new password and ends
the session of every device (`06-Systems/Accounts-And-Cloud-Saves-Arc.md`, A PASSWORD IS CHANGED WITH THE OLD ONE).
AUDIT 68 S01 had made the write a recovery makes itself conditional on the codes it found (`recovery_hash = ?`). Everything a
recovery could race still checked what it found when it began, then wrote by `id` alone:
- `changePassword`: `UPDATE players SET password = ? WHERE id = ?`, then the delete of every session but its own. With
  the recovery landing during the change's two derivations, the thief's password replaced the owner's, and the session
  the recovery had opened was deleted. The thief signed in, and the owner had spent a code.
- `login`: the session's INSERT had no condition. A sign-in on the former password, already deriving as the recovery
  landed, kept a working session past the recovery's sign-out. Its rehash (`UPDATE players SET password = ? WHERE id = ?`,
  on an older-cost hash) put the OLD password back in place of the recovered hash.
- `/v1/auth/session` (a device admitting a second one) and the recovery's own session had the same unguarded INSERT.

FIXED. Every write stands on what its request proved, checked by the statement itself:
- The change lands only while the password is still the one it checked the old one against, and only while its session
  still stands (`AND password = ? AND EXISTS (... sessions ...)`). On no change it is refused `bad-login`, as a wrong old
  password is. The other devices are signed out only while the password is still this change's: a recovery that came
  between the two statements opened its own session, and this change would have deleted it.
- `openSession` takes a `guard` that its INSERT checks (`INSERT ... SELECT ... WHERE EXISTS`). `{ password }` is the hash
  a sign-in verified or a recovery wrote, and `{ session }` is the device admitting this one. Null comes back where it
  does not stand. A guest's first session takes none: nothing can race it.
- A sign-in's rehash lands only where the hash it verified still stands. Where the row moved, the typed password is
  checked once more against the row as it stands now. So a recovery refuses the old password (`bad-login`), and two
  honest sign-ins at once on an older-cost hash both get in (the second finds the first's rehash).
- A recovery whose session a second recovery outran (another code of the same set) hears `codes-moved`. `/v1/auth/session`
  through a device that is gone answers `auth` (401).
- AUDIT RPT1026 A3: and a recovery signs every device out only while the password is still the one it wrote, as a
  change does. A second recovery that wrote after it had signed every device out itself and been answered with a
  session, and the first one's sign-out, by the account's id alone, then deleted that session.

SEEN, NOT CHANGED. The hot routes' pass (SESSION-SIGN) still lets a signed-out device's reads run up to
`PASS_TTL_S - PASS_RENEW_S` past a recovery. That lag is the design's own (`sessionPass.js`'s header), and its writes ask
the session. A staff panel session needs the extension key's signature as well as the password, so a thief who holds
only the password opens none. `newRecoveryCodes` on a row with no codes asks the password alone, by RECOVERY-SET A1's
decision. A race adds nothing there that the password alone does not already give.

AUDIT RPT1026 (lane A): A3 above, pinned by `test/server/audit_rpt1026_secnet_acct.test.js` (two recoveries, the
first held at its sign-out while the second runs whole), mutant `tools/mutants/audit_rpt1026_secnet.json`
AUDIT-RPT1026-A3-recovery-signout-by-id (dead). `acc1c.json` ACC1c-11 re-aimed by content at the guarded sign-out.

PINS: `test/server/rpt1026_secnet.test.js` (4), through the real service over the real migrations, on a database that
holds one request between two of its statements while another runs whole. The change with the recovery landing before
its write and between its write and its sign-out, a device signed out mid-change, two changes at once. A sign-in still
deriving as the recovery lands, the same on an older-cost hash, two honest sign-ins at once. A second device asked by
the thief's session, two recoveries with two codes. And an honest player alone, unchanged. Mutants
`tools/mutants/rpt1026_secnet.json` RPT1026-SECNET-change-*, -login-*, -new-device-*, -recovery-*, -guard-* (13, all
dead).

### RPT1026-SECNET: BLOCK STAMP (107) - `server/src/index.js`, `src/net/online.js`, `src/scenes/chatSafetyHost.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no chat, trades between players or block list.

WHAT THE PORT DID. SAFE1's block list holds back every request a blocked account directs at you (a trade, a duel, a
wedding, a card, a page), at the session (`OnlineSession._directedIn`, AUDIT SAFE CLIENT-7), by the account the relay
verified and stamped (`sub`). The arms for cards, duels, weddings and the open zone stamped it. Those for trades and
pages were older than SAFE1 and sent `{ t, id, data }`. The session asked the list only when a frame named an account
(`if (sub && !this.hears(sub))`), so a blocked account's trade offer (announced in the social tab, with an accept on the player)
and its page (free text, to the page's bound) came through to the player who blocked it. CLIENT-7's pin passed because
it built its frames by hand with a `sub` the relay never sends, in the world channel, where the relay routes no trade,
and with no page.

FIXED. The relay now stamps every request it routes to one player with the account it verified for the sender: a Room
method of its own, `_directedFrame`, which the arms for trades and pages call (`_message` loses six object entries). The
session asks the block list by the frame's account, else the account the room's roster said for that sender (a relay
from before the stamp). AUDIT RPT1026 A2: a place room's roster and joins name no account (MOD1), so that fallback has
none to ask, and against a relay from before the stamp a player who blocks anyone hears no sender's trade or page. An
account nobody named is heard only while the list blocks nobody (`chatSafetyHost.js` hears(null)). The chat log and the
social picture never ask for one, because a line with no account is a system line.

The relay's trade fan-out now carries ~33 more bytes, and the widest offer's fan-out can stand a few dozen bytes past
TRADE_FRAME_MAX. No door reads it at that cap: the receiver's door is INBOUND_FRAME_MAX. `wire.js`'s TRADE_DATA_MAX note
says so.

THE FOUR HOSTS. The block list's ear is `chatSafetyHost.js`'s, which `world.js` wires and hands every room it holds
(unchanged). `worldModes.js`, `dungeonContext.js` and `exterior.js` hold no session of their own.

PINS: `test/net/safety/safe_client.test.js` CLIENT-7 (PIN MOVED): its frames are now the relay's own. Three players
stand in one place room of the real Room (real tokens), two of them ask the third for a trade, a card, a duel and a
page, and the session drops the blocked one's four and takes the other's. `test/net/rpt1026_secnet_net.test.js` (1 of
its 7): a frame with no account is held back while anyone is blocked and heard while nobody is. AUDIT RPT1026 A2: its
first case stood on a hand-built roster naming each peer's account, which no place room sends; it is gone, and
`test/net/audit_rpt1026_secnet.test.js` A2 reads the real Room's roster and join. PIN MOVED `test/net/journal1.test.js`:
the relay's page frame carries the writer's account, and the arm's source pin reads `_directedFrame`. Mutants
`tools/mutants/rpt1026_secnet.json` RPT1026-SECNET-relay-*, -client-* (6: five dead, and
RPT1026-SECNET-client-roster-never-asked recorded equivalent by AUDIT RPT1026 A2 - no producer names the account it
would ask). Re-aimed by content: `journal1.json` JRN-relay-page-fanned, JRN-relay-page-unstamped,
JRN-relay-funnel-skipped; `safe_audit_client.json` SAFE-AUDIT-CLIENT-7-a-blocked-request-lands.

DOCS. `11-Multiplayer/Chat-Safety-Arc.md` section 2 says what the stamp is and why it was missing.
`01-Overview/audits/Audit-Chat-Safety.md`'s CLIENT-7 row is NARROWED: its FIXED did not cover trades and pages.

### RPT1026-SECNET: ACT WAITS (102) - `src/net/online.js`

WHAT DFU DOES. Nothing to follow: Daggerfall is not networked.

WHAT THE PORT DID. SD-HELLO (2026-10-08) and PARK-HELLO (FIELD BUGS 2026-10-09b) made a socket say nothing past its
hello until its room has welcomed it, since a room takes the socket's next frame while its hello is waiting on another
object. A frame read before the socket is named is refused (`parseClient`: "<kind> before hello") with CLOSE_POLICY, and
the session treats that close as terminal. `sendAct` went round it: it asked `status === 'open'`, which is set as the
hello goes. An instance's hello for anyone but its owner asks the hub (`_instanceHello` -> `_instanceKinOf`) whenever
the room's yes for that member is older than INSTANCE_KIN_KEEP_MS (15 s). That covers every return after a death, a
while away or a relay deploy. A door, lever or loot change touched while the socket was away sits in the world host's
pending set (`world.js` actSend, AUDIT WORLD34 C3). `actFlush` sent it as soon as the socket counted as open, the room
read it before the hello finished, and the member was offline in the instance, seen by nobody, until they changed room.
Nobody else saw the doors they had moved.

FIXED. `sendAct` asks the socket's welcome (`online.welcomed`). A refused act stays in the pending set and is sent once
the welcome has come. `world.js`'s `_actLive` is left as it stands (the host does not move): with `sendAct` refusing, a
refused act is kept by the same set, so changing `_actLive` too would change nothing. The other senders an instance
hears from an honest page wait for the welcome already: `_send`, `_socketFor`, the pose's own check, or a flag reset at
the hello (`host` for the world and the hit, `ownOk`, `grantMode`).

AUDIT RPT1026 A5: `host` is no flag a hello resets. An AURA-LIVE rehello (an aura or a name chosen) opens a replacement
socket that stands for the room from its hello on (`_promote`), its host kept from the welcome before. At an instance
whose hub was slow to say the party, a member's blow at the owner's foe (`sendHit`'s world-room path) and, hosting, the
room's memory (`sendWorld`) went down the replacement ahead of its welcome, and the room closed it for good ("hit before
hello", "world before hello"). Both ask the welcome now: a refused blow waits in its queue, and the memory goes again
after the welcome (`world.js` worldPublish, keyed on the welcome).

AND THE THREE SENDS ONLINE-ARC CALLED LATENT. `06-Systems/Online-Arc.md` listed room sends that skip SD-HELLO's
welcomed check. They wait now too, and each refusal is kept by its owner.
- `sendDuel` to a bout's room. A refused blow is no blow (DUEL1: a late blow is a wrong one), and an end waits in the
  bout's outbox (`duelSession.js` post).
- `sendWild`, the zone's room words and a fallen's room. A deposit's chunk is asked again a frame later, a take goes
  back on its pile, and a pick is pressed again.
- `sendHit`'s cell loop, by a roster a blink kept. A blow waits in its queue (`hitPend.js`).
The list's sentence now says so.

THE FOUR HOSTS. The acts are `world.js`'s (`actSend`, `actFlush` - unchanged). `worldModes.js`'s buildings and
`dungeonContext.js`'s dungeons hand theirs to it (`onActions`, unchanged). `exterior.js` sends none: a cell is no world
room, and `sendAct` refuses one.

PINS: `test/net/rpt1026_secnet_net.test.js` (2 of its 7):
- Through the real Room and the real session, with a party member at the owner's instance and the hub's answer held.
  First the failure: the frame `sendAct` used to send is read ahead of the hello, refused by parseClient, and the socket
  is closed for good. Then now: `sendAct` refuses until the welcome, is sent after it, and the socket stands.
- Across a reconnect, the bout's room, the zone's take and a cell's blow wait for the welcome, and go after it.

Mutants `tools/mutants/rpt1026_secnet.json`: RPT1026-SECNET-act-before-welcome, -duel-room-unwelcomed, -wild-unwelcomed,
-hit-cell-unwelcomed (4, all dead).

AUDIT RPT1026 A5: `test/net/audit_rpt1026_secnet.test.js` - a member's rehello at the owner's instance, the hub held,
through the real Room: the blow at the owner's foe and, hosting, the memory wait for the replacement's welcome, go after
it, and the socket stands. Mutants `tools/mutants/audit_rpt1026_secnet.json` AUDIT-RPT1026-A5-world-blow-unwelcomed,
-memory-unwelcomed (dead).

DOCS. `11-Multiplayer/Instances.md` section 3: a member's hello is held while the hub is asked, so its page says nothing
past the hello until the welcome. `06-Systems/Online-Arc.md`'s latent list: the three sends it named wait now.

### The desyncs after a death or a teleport (232, 236)

232 is WIPE-RETURN's report (`11-Multiplayer/Instances.md` section 11). A party that fell together came back to a door
where no pose named its room, and after a single death the door listed `Your instance` (a quest copy's own room) before
the owner's. Both were fixed on 2026-10-25 (`594830855`, the door keeps the party's room, and the party's rows first).
They reached main in #1280 (THE FOLD, `34584a5c0`, 22:12 UTC), after the reporter's build (v0.0.388). ALREADY FIXED.
A return also re-joins the instance, and its hello is held while the hub is asked, so ACT WAITS closes the other way
that return could drop the member offline.

236 came from the same reporter on v0.0.392, also before #1280. A teleporter inside a dungeon is a motor warp in the same
room (`worldModes.js` `ctx.actions.onTeleport`). No socket changes and no hello is said. A world room fans every pose to
everyone (`inRange` culls only `world:` cells), and a teleport's jump is snapped (WORLD2). Nothing in the code parts two
players that way. The ways the code could part them: a trip out of the dungeon and back in through the door (#1280's
party rows first), or a reconnect around the teleport whose act was read ahead of the hello (ACT WAITS, here). An
instance's re-check only refuses on the hub's word that the party changed, and it says "That instance is closed to you".
NOT REPRODUCED. For the reporter: update. If it happens again, say whether you left the dungeon and whether either line
appeared.

### RPT1026-SECNET: LINE-STALL (91) - `src/net/online.js`

WHAT DFU DOES. Nothing to follow: Daggerfall is not networked.

WHAT THE PORT DID. On a close (`ws.onclose`) the session retries every code but two, jittered from 1 s doubling to 8 s
(`_scheduleRetry`): a deploy's 1006, 1001, 1011, a busy room (backed off hard), a moved node (CLOSE_REPARTITION) and the
same room's halo (CLOSE_SAME_ROOM). The two it does not retry:
- CLOSE_REPLACED: another window or tab took the seat (ONE-SEAT, by design).
- CLOSE_POLICY, a frame the relay refused. A hello refused while the token was late is excepted (retried once one may
  be had), and so is a ban (latched).

No non-policy close is terminal. A bad line met two policy refusals:
- A frame read ahead of a reconnect's hello: ACT WAITS, above.
- The meter's strike-out. The relay meters each socket's poses at POSE_HZ_MAX with that much burst, and closes the socket
  past DROP_STRIKES_MAX over-rate frames in a row (AUDIT ONLINE A8's flood guard). A stalled TCP line keeps every frame it
  is given and delivers them all when it clears. A walk sends POSE_HZ (10) poses a second, so ~22 s of stall arrived as
  a flood: the relay's "too many poses" close, CLOSE_POLICY, terminal in that room until the player moved room. A host's
  foes stream (FOES_HZ_MAX, 12) struck out after ~18 s.
- The session had no way to tell. It pinged only a socket that was saying nothing (RELAY-H1), and a lone player who was
  walking hears nothing back.

FIXED. The session hears its line and hands a stalled one no burst.
- A socket that has heard nothing for PING_MS is pinged however busy it is, the halos too. The runtime answers every
  ping, asleep or awake, so a ping unanswered LINE_STALL_MS (= PING_MS) means the line is stalled (`_ear`, `_stalled`).
  Any frame in clears it.
- While stalled, its poses wait (`_poseHeld`). The latest goes the moment the line answers (`sendPose` is asked every
  frame), and one goes per HEARTBEAT_MS meanwhile. Its foes streams wait too (`sendFoes`, `sendOwnFoes`), and the host's
  next frame is whole (AUDIT WORLD2 A9).
- AUDIT RPT1026 A1: and its blows (`sendHit`). A blow spends the relay's POSE meter (the hit arm's `_meter`), so a
  fight's blows rode the burst beside its poses: at the session's own blow rate (HIT_HZ_MAX, 10) a held fight struck
  out after ~11 s. A refused blow waits in its queue (`net/hitPend.js`), which ages it out.
- A stall is known within PING_MS + LINE_STALL_MS (10 s). By then a walk has handed the line about 100 poses and a host
  about 120 foes frames, both under the strike-out (cap + DROP_STRIKES_MAX = 220 and 212), and a fight about 100 poses
  and 110 blows (AUDIT RPT1026 A1). The meter drops part of the
  burst and never closes on it.
- THE RELAY'S METER DOES NOT MOVE. The flood guard stands as it was, and an honest page no longer meets it. The burst a
  page can still send is bounded by the session's own laws, and a pin holds that arithmetic to them, so a change to
  POSE_HZ, PING_MS, LINE_STALL_MS or DROP_STRIKES_MAX that would break it fails.

THE PROOF. Through the real Room, with the runtime's ping answer in front of it as in production, a player walks alone
while the line is held 29 s, then let go at once. Before this change that is 290 poses in one burst and the strike-out
(the mutants that remove the hold or the ping die on exactly that). Now it is about 90, the socket stands, and the
latest pose reaches the room once the line answers. With ACT WAITS and the blows held (AUDIT RPT1026 A1), the policy
refusals a bad line could draw from a walk, a host's streams and a fight are closed. The report is short and names
neither cause, so a staff check (in the notes) can still confirm which one the player met.

THE FOUR HOSTS. The session is `net/online.js`'s. Its poses come from every host through `world.js`'s frame
(`sendPose`), and its foes from the host's streams (`world.js` foesStream and ownStream, the exterior's handovers through
`world.js`). Nothing in a host moved.

PIN MOVED. `test/fakeSocket.mjs` answers the runtime's ping, as the relay's runtime does in front of every room. A fake
that never answered was a dead line in every pin. `pong: false` is the dead line, for the stall's own pins. Also moved:
`test/net/relayh1.test.js`'s own fake (the same), `test/net/lease1.test.js` (a deaf lane's ping read past),
`test/net/haloremains.test.js` (its hand-built session's sockets welcomed), and `test/net/halothin.test.js`'s keepalive
pin (a busy cell hears its room, or its own deaf ping goes down the halos and their own clock is never asked).

Re-aimed by content: `halothin.json` HALOTHIN-last-not-kept, -last-per-room, -welcome-unasked and -ping-none, and
`relayh1.json` RELAY-H1-no-presence-ping-at-all. Every record of `halothin.json` and `relayh1.json` was judged again:
37, all dead. The other lists' records this change could reach were judged again too (the notes say which, and what
they found).

PINS: `test/net/rpt1026_secnet_net.test.js` (4 of its 7):
- the walk through the real Room;
- the arithmetic;
- a host's stream and own lane held, and the heartbeat let through;
- a halo's stalled line: the shared ping, a halo's own ping while my cell is busy, and its answer.

AUDIT RPT1026 A1: `test/net/audit_rpt1026_secnet.test.js` - a fight through the real Room held 30 s from the moment the
line was last heard, a world room's blow at the host, and the arithmetic with the blows; mutants
`tools/mutants/audit_rpt1026_secnet.json` AUDIT-RPT1026-A1-blow-never-held and -stall-wait-doubled (dead).

Mutants `tools/mutants/rpt1026_secnet.json`: RPT1026-SECNET-stall-*, -no-deaf-ping, -line-never-heard, -foes-never-held,
-own-never-held, -halo-* (12, all dead).

DOCS. `06-Systems/Online-Arc.md` LINE-STALL.

## Gold: the shared chest and the card table (RPT1026-CHESTGOLD)

| | Report | What it was | Done |
|---|---|---|---|
| 279 | A gold dupe through shared home chests: take a pile from a shared chest, keep the window open past three minutes (or have any other close refused), and the gold stands in the purse and the chest at once | A gold click paid the purse at once (`itemTransfer.js` applyTransfer's gold arm), every checkpoint after carried it, and the close's settle went out with nothing to take it back. The 180 s hold was taken once and never kept, so a long window's settle was refused `decor-busy` and the pile stayed in the bin. The classic skin's window never settled anything, so its gold click duplicated on every close and its other moves were undone. Found beside it: a piece taken out and put back in the same window was parked on the character's pack and left in the bin; the wagon and the Materials Bag opened inside the window, and a piece moved there stood in both; a Physical Items shift-drop laid a piece on the floor the pack still held - each a duplicate of any item, no wait needed | RPT1026-CHESTGOLD |
| 283 | The same dupe with no wait: while a guest has the chest open and has taken gold, the owner sets it to Private, the chest's goods return to the owner's record, and the guest's gold stays | `setDecorAccess` -> `moveChest` never read `decor_hold`, and poured the bin it had read even if a settle had landed since. The guest's settle was refused (`decor-shut`), and the purse had been paid at the click | RPT1026-CHESTGOLD |
| 224 | Sat at a gold card table with 336 gold, nobody sat, stood up, reloaded: no gold - yet the next buy-in offered the 336 again, with the 100 earned since | Not lost: a gold table's cash-out is paid into the bank account of the region it was staked from (Tavern-Cards section 23, THE CLAIM), and the buy-in's offer reads the purse and that account together. Nothing said where the stake had gone | RPT1026-CARDBANK |
| 133 | Orcish greaves sell to a merchant for about 23,000 gold | DFU's own value ladder: a plate piece is its template's base price x 3 x the metal's multiplier, and Orcish is x256 (Greaves: 80 x 3 x 256 = 61,440 for a plain pair). A rarity grade or an enchantment adds its own worth. The online counter pays at most half of the least it asks (MERC-RISE, MERC-SLOPE), so 23,000 is an Orcish pair worth about 92,000 or more | AS DESIGNED |
| 245 | (Its bank half) A bank account holding a vast sum never earned, which could be withdrawn, after depositing looted gold into a guild treasury from inside dungeons | Traced and not found: no door credits a bank account from a guild deposit, and none multiplies one. What moved this character's gold is in the service's rows (notes). The trade-hold half is RPT1026-MARKET HOLD-SAID | NEEDS DATA / STAFF |
| 12 | A sale worth some eighteen million left the purse and the carried weight both below zero | The counter's price wrapped int32 | ALREADY FIXED: TRADE-WRAP (`Field-Bugs-2026-10-18b.md`, update 0.0.249; `shopStock.js` calculateTradePrice). A purse that already wrapped is mended by PURSE-MEND (`Field-Bugs-2026-10-19f.md`, `/v1/staff/fix/mend`) |
| 28 | About 2 million gold in letters of credit vanished from the wallet | The report FIELD BUGS 2026-10-18b answered: every door that takes a letter out of the pack, three of them bugs | ALREADY FIXED: LETTERS-HOME, BURNT-SAID, NO-NAN-PAY, TRADE-WRAP (`Field-Bugs-2026-10-18b.md`). Which door took this player's letters is in the service's rows (notes) |
| 58 | Sold stolen loot for 129k: the gold is not in the inventory; the bank shows it but will not deposit it | A sale whose coin would push the seller past their carrying limit pays a letter of credit instead (DFU's own rule). 129,000 gold weighs 322 kg, more than any character carries | AS DESIGNED |

### RPT1026-CHESTGOLD (279, 283) - `src/systems/item/itemTransfer.js`, `src/systems/decor/decorGrants.js`, `server-account/src/decorAccess.js`, `src/net/accountClient.js`

WHAT DFU DOES. DoTransferItem's first statement spends a gold pile into GoldPieces the moment it reaches the pack
(DaggerfallInventoryWindow.cs:1562-1571). DFU has no chest another player shares, and no service to settle one.

WHAT THE PORT DID. A shared chest's goods live in the service's `decor_bin`. Its window (`decorGrants.js`
openSharedChest) moves them locally and the close sends the whole difference once, as the record's act
(`realmSaves.js` realmGoldAct: the save checkpointed, then `op: 'settle'`). Opening takes an exclusive hold
(`decorAccess.js` takeHold, HOLD_S 180 s), and the settle is refused unless that hold still stands (ourHold). Three
things made gold twice:
- THE CLICK PAID. A gold pile taken from the chest went through applyTransfer's gold arm, which pays the purse at once
  and lands nothing. Every checkpoint after the click carried the bigger purse - a timer's, and realmGoldAct's own
  before the settle - and the act passed no reserve, so nothing took it back. The service's settle skipped the coin take
  ("the window already counted a gold pile into the purse") and deleted the row. A settle refused for any reason left
  the row: the gold was in the saved purse and in the chest.
- THE HOLD WAS NEVER KEPT. The window took the hold once, with the list (the code called it a "shortcut"). A window open
  past 180 s settled into `decor-busy`. After that, any other player could open the chest and take the same pile.
- THE OWNER'S PRIVATE. `setDecorAccess` -> `moveChest` never read `decor_hold`. Set to Private, it poured the bin into
  the owner's save while a guest still held the chest. The guest's settle was then refused (`decor-shut`), and the guest's
  purse had the gold already. moveChest also poured the bin as it had READ it: a settle landing between the read and the
  batch (a take, a cut) left the guest paid and the owner poured.
- THE CLASSIC SKIN. The classic inventory window never called the chest's `commit`: it ran every move itself, so
  nothing it moved reached the settle. Its gold click paid the purse, and the close released the chest with the pile
  still in the bin - the dupe on every close. Every other take and put was undone at the close. Its gold field also
  opened over the chest (the enhanced pack's is closed there - goldMayGo, AUDIT UPDATE II B1): the purse paid for a pile
  the close never sent.

FOUND BESIDE IT (the brief's sibling, items). A piece taken out of the chest and put back in the same window was parked
on the CHARACTER's pack by the put branch ("one copy stays in the pack until the close"), which is right only for a
piece that came from the pack. The take was cancelled, so the close had nothing to settle and released the chest: the
piece was in the pack and in the bin. Any item, no friend, no wait. A part of a stack taken and put back did the same
for the part, and part of a stack put in and taken back was cut from a bin it was not in yet (the settle refused
`bad-item`, and the part was lost). And the window's pack is its own copy until the close, but the WAGON and the
MATERIALS BAG opened inside it as the character's real lists (`inventorySession.js` planWagonToggle, planBagToggle): a
piece stowed in the bag left the copy and stood in the bag and the pack at once, and on the enhanced pack the stow went
through the chest's door, which parked one of the chest's own rows on the pack. A Physical Items shift-drop
(`physicalItems.js` shiftDrop) took a piece out of the copy alone and laid it on the room's floor - in the room and in
the pack. Both skins.

FIXED.
- A LIST WHOSE MOVES A SERVICE SETTLES KEEPS ITS COIN A PILE (`itemTransfer.js:"if (toPlayer && isGoldPieces(item) && from?.pileCoins !== true) {"`).
  The shared chest's list carries the mark (`decorGrants.js:"Object.defineProperty(goods, 'pileCoins', { value: true })"`),
  so in both windows a pile taken from it lands in the window's pack as a pile. The close counts the coins leaving
  (whole piles and handfuls cut off one), tells the service (`purse` on the settle), and pays the purse in the act's
  `apply` (the door's new `pay`, `bindDecorHouseFrom`) - only once the settle lands, or a lost answer's record moved one
  step (that half since AUDIT RPT1026 B3: the settle asked its hold before the record, so a settle sent again after a lost
  answer was told `decor-busy`, its purse unpaid, and the next checkpoint ended the session; it answers where the record
  stands first now, `realmActFirst`). A refused close moves nothing: the pile is in the chest alone.
- THE SERVICE PAYS THE RECORD (`decorAccess.js` decorSettle). With `purse` said, the coins leaving are counted from the
  bin as it stands, a count the window did not see is refused (`no-item`), and they go into the record's purse in the
  settle's own batch (`creditSave`; witnessed, INT5). Unsaid - a window from before this build, whose click paid its
  purse - the old law stands, and the coins are not paid twice.
- THE HOLD IS KEPT WHILE THE WINDOW IS USED, AND NEVER TAKEN BACK. A move asks `op: 'hold'` once DECOR_HOLD_KEEP_MS (60 s)
  has passed (`decorGrants.js` keepHeld). The service extends only a live hold of the asking window
  (`decorAccess.js` keepHold). A hold that ran out is never that window's again - someone may have opened the chest
  since - so keep and settle answer `decor-lapsed`, and the window moves nothing more. The close says "The chest was
  left open too long, so nothing in it moved. Open it again."
- NO POUR OVER A BIN THAT MOVED (`decorAccess.js` moveChest). ~~Another player's live hold refuses the owner's access
  change (`decor-busy`, "Someone else is using this chest.").~~ AUDIT RPT1026 B2 took that half back: a hold is kept as
  long as its window asks, so a guest who asked every three minutes shut the owner out of the chest's access, its window
  and its removal for good. The owner's change lands whatever window is open; a guest's settle it shut is refused
  (`decor-shut`) and moves nothing, and a window of this build pays its purse only with a landed settle. The Private pour
  deletes each row as it was read (uid and text, each guarded), and a row added since refuses it: a settle that landed in
  between leaves the batch undone (`decor-busy`).
- A PIECE THE WINDOW TOOK GOES BACK AS IT CAME (`decorGrants.js` commit). A put of a piece in the window's pack and not
  the character's undoes its take, or joins the stack it was cut from and drops the cut; a part of it is refused
  ("The chest takes the whole stack."). Part of a piece put in this window, taken back, is the pack's again, not a cut.
- THE CLASSIC WINDOW SETTLES THROUGH THE CHEST'S DOOR (`nativeInventory.js` _held). Over a store that settles its own
  pieces (`loot.commit`), its Remove both ways is the chest's `commit` with the move as `go`, as the enhanced pack's
  heldThen does - so the close sends what it moved, and gold reaches the purse only with a landed settle, on both skins.
  An Equip-mode take off the chest takes and does not wear (the piece is not the pack's until the close; `equipItem`
  splits a stack into the character's own pack). Its gold field does not open over such a store (`_dropGold`).
- A CHEST WINDOW SHOWS THE CHEST ALONE (`inventorySession.js` settlesOwnPieces, CHEST_ALONE_REFUSAL). Both skins'
  wagon and bag ladders refuse to open while the chest is up ("Shut the chest before you open your wagon or your bag."),
  and the chest's spec answers the floor (`decorGrants.js` openSharedChest's `dropRefusal`), so a shift-drop is refused
  in the chest's own words ("Shut the chest before you drop that.").
- AND ITS PACK CHANGES BY THE CHEST'S DOOR ALONE (AUDIT RPT1026 B1, B4, B5 - `inventorySession.js` chestActRefusal). The
  sweep above left the window's other acts, each of which took a piece out of the window's copy alone: a Use (a potion
  drunk, a meal eaten, off the pack or off the chest's own list), a Salvage, the batch's and a Dismantle kept the piece
  in the character's pack or the chest's bin, and a salvage's shards and a dismantle's embers landed on the stack the
  pack shares - every opening of a chest the player shares, even with nobody. Those are refused in both skins ("Shut the
  chest before you do that."). A piece taken this window is not worn from the pack either (a Remove and then an Equip
  walked round the Equip-mode take's law). A map moves through the chest as a piece both ways, never read on the way
  (TransferItem's map arm read it out of the window's list, and the chest or the pack kept it).

THE FOUR HOSTS. The chest window is `decorGrants.js`'s, opened by `scenes/worldModes.js` (an interior home's or hall's
chest, wired, unchanged); `world.js` hands the inventory window over (unchanged); `exterior.js` and `dungeonContext.js`
open no home's chest. No host line moved.

THE WORDS. `account.refusal.decorLapsed`, `inventory.store.chestAlone` and (AUDIT RPT1026 B1) `inventory.store.chestAct` (new), drafted in every language
(`SCRATCH/drafts/chestgold.json`). The shift-drop reuses `decor.grants.noDrop`, a refused commit on the classic skin
`inventory.store.chestShut`.

LEFT AS IT IS.
- A client from before this build still pays the purse at the click, and the service cannot tell its purse from an
  honest one. ~~The Private trigger is closed for every client by the service.~~ The run-out trigger, and since AUDIT
  RPT1026 B2 the Private one, close for a player once their client runs this build.

DEPARTURE. DoTransferItem's gold interception, for the shared chest's list, and WagonButton_OnMouseClick's ladder,
refused while such a chest is open; and (AUDIT RPT1026) UseItem refused in such a window, and TransferItem's map arm
(DaggerfallInventoryWindow.cs:1471-1478) not run for such a chest: Port-Ledger A, RPT1026-CHESTGOLD.

PINS. `test/systems/decor/rpt1026_chestgold.test.js` (11): the real window's moves (applyTransfer as both windows end a
transfer), the host's door (bindDecorHouseFrom), realmGoldAct over a session whose checkpoint is the realm's own PUT, and
the account worker over SQLite. The run-out hold, with a timer's checkpoint while the window is open (gold in the chest
once, the purse and the record untouched; open again, a handful taken, paid by the service in the settle's batch); the
owner's Private under a guest's window; the pour against a bin cut, emptied and added to between its read and its batch;
a piece taken and put back; a part and a handful taken and put back; part of a piece put in and taken back; the
service's `purse` (paid, a wrong count, no count, a cut, a window from before); the hold kept, another's not, a run-out
one never; the classic skin's own window (NativeInventoryWindow over the host's spec, the host's doors under it):
its gold, a piece taken in Equip mode (taken, not worn) and a piece put in, all settled once at the close, the gold
with the settle; its gold field shut; the wagon, the bag and the floor refused in a chest window (the three classic
pins fail on the code before). PIN MOVED: `decorchest.test.js` (two tests: the take is the window's real transfer, the
purse is paid by the settle). Mutants `tools/mutants/rpt1026_chestgold.json` (32 CHESTGOLD records, all dead). Re-aimed by content:
`decor1.json` DECOR1-the-cap-not-a-conflict (the status line names `decor-lapsed`). AUDIT RPT1026 (lane B):
`test/systems/decor/audit_rpt1026_chestgold.test.js` (6 - the realm session itself under the window, both skins driven),
`tools/mutants/audit_rpt1026_chestgold.json` (17, all dead); PIN MOVED: the owner's Private under a guest's window lands
(rpt1026_chestgold.test.js), and its record CHESTGOLD-svc-pour-under-guest is retired (AUDIT-RPT1026-B2-owner-refused-under-guest
is its inverse).

### RPT1026-CARDBANK (224) - `src/net/card/cardStakes.js`, `src/scenes/worldModes.js`

WHAT DFU DOES. Nothing to follow: Daggerfall Unity has no card games.

WHAT THE PORT DID. A realm character's gold table buy-in is paid from the purse, its letters, then the bank (the
wallet's order). Its cash-out - a stand, a refused sit, a void - is claimed into the bank account of the region it was
staked from (`cardStakes.js` claim: `wallet(k.reg).bank(g)`; Tavern-Cards section 23, THE CLAIM, AUDIT CARDS-4 A7). The
buy-in's offer reads the purse and that account together (`purse()`: `wallet.gold()`). So the reporter's 336 came home
into the Empire's account while the purse showed nothing, and the next buy-in offered 336 + 100. Nothing said where the
stake had gone.

FIXED. The claim says it: "The card table paid N gold into your account at the Bank of the Empire."
(`cardStakes.js:"export const cardBankedText"`), once for each receipt the service pays (a repeat pays and says
nothing). `claim(say)` takes the host's own `say`. Both of the host's claims pass it - a cash-out heard
(`worldModes.js:"if (j) { host.cardOnline?.send({ op: 'ack', table: f.table, j }); host.cardStakes.claim(say); }"`) and
the receipts kept across a reload, claimed on a visit. No host line added.

THE FOUR HOSTS. The card tables are `worldModes.js`'s (interiors), wired. `world.js` builds the book (unchanged);
`exterior.js` and `dungeonContext.js` seat no card table.

THE WORDS. `cards.cashout.banked` (new), drafted in every language.

For the reporter now: the 336 (and every stake since) is in their account at any bank.

PINS. `test/net/card/rpt1026_chestgold_cards.test.js` (2: the real book's stake, the relay's receipt, the claim; the
host's two claims by source). PIN MOVED: `cards6_client.test.js` (the host's claim). Mutants
`tools/mutants/rpt1026_chestgold.json` (3 CARDBANK records, all dead). Re-aimed by content: `auditcards4.json`
AC4-E2-latch-set-after-finally and AC4-D4-c6-host-no-ack, `auditcards5.json` AC5-E-S-claim-bank-repeat.

### The rest - each traced, no change

ORCISH GREAVES (133), AS DESIGNED. `itemTemplates.js` itemBaseValue is ItemBuilder's: a plate piece's value is
`basePrice * 3 * valueMultipliersByMaterial[metal]` (ItemBuilder.cs:649), and Orcish is index 8, x256 - a plain pair of
Greaves (base price 80) is worth 61,440. A rarity grade, an enchantment or a gem adds its worth (`lootRarity.js`). The
online counter pays at most half of the least it asks the best haggler, moved by the seller's skills
(`shopStock.js` calculateTradePrice, MERC-RISE, MERC-SLOPE): a plain pair fetches 7,000 to 15,000, so 23,000 is a graded
or enchanted pair. No table is wrong. What to tell the player: Orcish is Daggerfall's second-dearest metal, priced so on
purpose, and the online counters already pay well under what they ask.

THE BANK'S VAST SUM (245), NEEDS DATA / STAFF. Traced: a guild deposit pays from the purse, its letters, then the
Empire's account, the same on both ends (`guildBook.js` deposit over `payUndoable`; `guilds.js` realmTreasury over
`payFromSave`), with an undo that gives back exactly what it took (MARKET-AUDIT). A realm act whose checkpoint was refused
(`onlineCheckpoint` false) settles against the older record, but the client's next checkpoint replaces that record
whole, so no gold is made - only a judge's finding can be confused. The doors that pay a bank account (a card cash-out,
rent, a home or a deed sold, Marks sold, a loan, the Empire's fold) each pay what they are told, once. No door multiplies
an account, and none credits one from a guild deposit. What staff should read is in the notes.

NEGATIVE GOLD AFTER AN 18M SALE (12), ALREADY FIXED. TRADE-WRAP (`Field-Bugs-2026-10-18b.md`, update 0.0.249):
`calculateTradePrice`'s last step is a float division, never int32's shift. PURSE-MEND (`Field-Bugs-2026-10-19f.md`)
mends a purse a wrapped sale left below nothing. Swept again: no `>>`, `| 0` or `>>> 0` stands on a sale's, a buy's, a
repair's or a bank's gold. Two of DFU's own int steps stand. CalculateItemIdentifyCost's `(25 * value) >> 8`
(`tradeModes.js`) wraps only for an item worth more than 85.9 million, which no producer mints. The court's fine
`>>= 1` halves fines of at most a few thousand.

LETTERS OF CREDIT (28), ALREADY FIXED: the same report, answered as FIELD BUGS 2026-10-18b (LETTERS-HOME, BURNT-SAID,
NO-NAN-PAY, TRADE-WRAP). Which door took this character's letters is in that page's "What would prove which door it was".

STOLEN LOOT SOLD FOR 129K (58), AS DESIGNED. A sale's proceeds are weighed before they are paid (`tradeModes.js`
sellProceeds, DaggerfallTradeWindow.cs:1044-1048). Coin that would push the seller past their carrying limit is paid as a
LETTER OF CREDIT for the whole sum, at the front of the pack (`worldModes.js` commitTrade's Sell arm). 129,000 gold weighs
322 kg (GOLD_PIECE_WEIGHT_KG 0.0025), more than any character carries. So the purse showed nothing new, the letter sat in
the pack and the wallet, and the bank's Deposit took coin alone (NOT_ENOUGH_GOLD). A stolen piece's sale is a sale like
any other (STOLEN-GOODS: the piece is gone, the gold paid). What to tell the player: the 129,000 is the Letter of Credit
in the pack. It spends like gold, and "Deposit letters" at any bank puts it in the account.

## The ledger and the item law (RPT1026-LEDGERLAW)

| | Report | What it was | Done |
|---|---|---|---|
| 105 | A maker who trades or sells a crafted piece to another player (a realm trade, the market's pack listings) and writes it back into their own save wins it back, and the buyer's is locked as the copy | The ledger settled a contested claim on a crafted piece for the account `products.owner` names, and a realm trade, a market delivery, a vault and a chest hand a piece on without moving that owner - so the buyer lost the piece whenever its maker claimed it. Integrity-Arc said "CLOSED by INT19" over this clause | RPT1026-LEDGERLAW (CRAFT-HANDED) |
| 99 | Staff's clear of one bad purse let every later purse of that character pass, however large | `review.js` clear excused `law_sig`, and the signature names a character finding by its code alone: one cleared negative purse excused every purse after it. Its usage lines never said it excuses | RPT1026-LEDGERLAW (EXCUSE-VALUES) |
| 98 | Wear spent a found piece's own-mend sale credit, and a smith's restore paid it out again; two kits a wear apart credited past what the piece held | `foundMark.js` `selfMended` only ever grew: wear hid it, a smith's restore made it count | RPT1026-LEDGERLAW (MEND-SPENT) |
| 8 | The item maker lets one "User Takes Damage" setting be picked up to ten times, each copy paying into the budget | DFU's own flags, ported as they were - changed by SIDE-ONCE on 2026-10-19, the day after this report (build 0.0.235) | ALREADY FIXED (SIDE-ONCE) - the service's law: the owner's (below) |
| 13 | The same, for "in holy places", "all the time" and "sunlight"; and Health Leech stays in the side-effect list with all its settings taken | The same flags, and the primary list asked of the effect, never of its settings | ALREADY FIXED (SIDE-ONCE) |
| 3 | A crafted jewel enchanted once can be enchanted again, new powers beside the ones it carries | AUDIT PROF10 J2, decided: the item maker takes a crafted jewel with what it carries, every row counted against its points | AS DESIGNED |
| 269 | A stolen piece offered by another player, at a trader or on the market, looks like any other | The theft's mark rides a listing to its buyer (STOLEN-GOODS: a player may buy one, the mark riding), and no row another player buys from named it | RPT1026-LEDGERLAW (STOLEN-SAID) |
| 290 | A player's first King's Mark was gone after they bought another from a player | No code path found that removes a carried piece when another arrives; the cause is in the player's records | NEEDS DATA / STAFF |

### RPT1026-LEDGERLAW: CRAFT-HANDED (105) - `server-account/src/ledger.js`, `market.js`, `writs.js`, migration 0178

WHAT DFU DOES. Nothing to follow: Daggerfall has no realm, no ledger and no market.

WHAT THE PORT DID. INT4's ledger keeps the first holder of a piece; another record showing it claims it, and the
holder's checkpoint still with it past `DUPE_GRACE_S` (750 s) settles the claim a copy - the claimant's, locked. A
crafted piece's claim was settled by the craft's record instead: where `products.owner` named the claimant's account
and not the holder's, the holder "kept a piece it sold", so the piece went to the claimant and the holder's copy was
written down (`craft`) and locked (`ledger.js:"const upheld = new"`). The owner moves with a market sale, an
auction won and a commission filled - and with nothing else: a realm trade (`realmTrade.js`), a delivery collected from
the market's pack route (MARKET-ANY, `market.js` collectGood), a guild vault and a shared chest move the piece and never
the owner (Professions-Arc 18's hand-over of the owner was never built). The report's steps, run on the real Worker: a
maker trades a sword made at the real anvil for 40 gold, writes it back into their save with a modified client and checkpoints; past the grace
the buyer's checkpoint hands the sword to the maker, locks the buyer's as the copy (`dupes` 1) and the buyer is refused
`piece-dupe` passing it on, while the maker keeps the price and an untouched sword. `06-Systems/Integrity-Arc.md` marked the
open item "CLOSED by INT19" - INT19 closed its listing half (a crafted piece lists only out of its seller's record), not
this clause.

FIXED. The craft's record is the account the service last HANDED the piece to. Every move of a crafted piece into a
record - `ledgerMoves`' entered set, so the trade, the collect, the vault, the chest, the zone's escrow and staff's
return alike - writes `products.handed_to` (`ledger.js:"RPT1026-LEDGERLAW: and a"`;
NULL where it is the owner's own account, and only where it changes) - where the account handing it on is the one the
record names (AUDIT RPT1026 C1, `ledger.js:"AND COALESCE(handed_to, owner)"`: the trade's other side,
`realmTrade.js` `from`, or the account an escrow row names). The batch wrote it whoever gave the piece: a seller that kept
a piece it SOLD holds the ledger's row first (the sale lets the row go, and the buyer's piece is minted at its pack), and
one realm trade of it to an accomplice, or one listing of it from the pack an accomplice collected, named the
accomplice the craft's record - the buyer's claim was settled the copy and the buyer's piece locked, where INT19 had
given it to the buyer. A sale that moves the owner clears it
(`market.js` pieceSoldSteps - the Drakes buy, the gold buy, the auction won - and `writs.js`'s fill); the uphold reads
`COALESCE(handed_to, owner)` (`ledger.js:"const CRAFT_RECORD_SQL"`) - and never
against the owner holding it (`ledger.js:".all(); // RPT1026-LEDGERLAW"`: a piece come back
to its owner by a peer's hands is the owner's, so the hand-over before it cannot turn the report's exploit round). The
maker's written-back piece is now the claimant's copy - locked, no strike, as every contested claim's - the buyer keeps theirs
and passes it on, and the maker is refused `piece-dupe`. The seller that kept a piece it SOLD is still the copier (the
sale clears the hand-over before it). `products.owner` is unmoved, so who may list a piece as a crafted piece, and for
which currency, is the market's own question as before (FIELD BUGS 2026-10-01's question (3), whether a handed-on piece
counts as bought with gold, stays the owner's). Migration `0178_rpt1026_ledgerlaw.sql`: `products.handed_to`, NULL for
every piece today. Integrity-Arc's INT4 and its open item narrowed, and a section of its own;
`Field-Bugs-2026-10-01.md`'s "can list a forged copy" sentence narrowed.

LEFT OPEN. A crafted piece passed hand to hand (the ground, a shelf, a room's container) moves no craft's record: the
ledger cannot tell a giver's written-back copy from an owner's piece taken back, so the craft's record stands for the
account the service last handed it to, as before - and a service move by its new holder hands none on either (AUDIT
RPT1026 C1: a griefer's forged copy taken up while its owner set the piece down was one vault's round trip from being the
record). The owner holding it keeps it whatever the record says, so a buyer whose checkpoint shows the piece gone while its
maker's written-back copy still claims it (the ground, a counter) hands it to the maker for good.

PINS: `test/server/rpt1026_ledgerlaw.test.js` (4 of its 8: the report's steps through the real anvil craft, the real
realm trade and real checkpoints; the market's pack route bought and collected; a hand-back, an owner holding it again by
a peer's hands against the account the trade handed it to, a sale giving the owner's word back with the seller that kept
a sold piece still the copier; a commission's fill). `test/server/audit_rpt1026_ledgerlaw.test.js` (C1: the seller that
kept a sold piece, its trade to an accomplice and its listing collected by one; either side of a trade hands on).

### RPT1026-LEDGERLAW: EXCUSE-VALUES (99) - `server-account/src/judge.js`, `verdict.js`, `review.js`, `staffPlayers.js`, `tools/realmReview.mjs`, migration 0178

WHAT THE PORT DID. Staff's clear (`/v1/mod/realm-clear`, the Staff Panel's Unfreeze) writes the law's standing signature
into `law_excused`, and a finding of that signature holds nothing again. `verdict.js` lawSigOf signs a finding
`code:template`, and the character law's findings (`judge.js` characterFindings: gold, bank, level, an attribute, a
skill, a path) carry no template and no value - so clearing the wrapped purse of a shop sale's victim excused that
character's every purse after it: on the real Worker purses of 9e15 and 5e9 gold both passed. Only the budget, under
`enforce` (off as shipped), would have caught it. realmReview's usage lines named the hold and the strikes, never the
excuse.

FIXED. Every judgement keeps the character law's VALUES beside the signature (`judge.js:"export function lawValuesOf(save, summary) {"`
- each finding's key and the value it read, `gold@=-8000000`, `stat@agility=101`; `realm_characters.law_v`), the clear
excuses the two together (`review.js:"law_excused = CASE"`,
`verdict.js:"export const lawExcuseOf"` - a finding of pieces alone keeps its signature as every excuse was), and a
checkpoint the law finds nothing in ends an excuse of the values (`verdict.js:"RPT1026-LEDGERLAW: a checkpoint"`;
AUDIT RPT1026 C2: the batch ended every excuse there, so a piece staff had cleared, put away for one checkpoint - a vault,
a listing, a trade and back - held its holder again, with a strike, when it came back; a piece's excuse stands, as every
excuse did). A state whose values pass the 1,000 characters kept, or a value its 40, is cut and marked so
(`judge.js:"export const LAW_VALUES_CUT"`), and no excuse names it (AUDIT RPT1026 C5: the cut was silent, so eighty bank
accounts below nothing ahead of the purse in the sort read alike whatever the purse, and a clear of a negative one
excused nine quadrillion after it). A change of the state does not end the excuse - a checkpoint back at the state staff
read is excused again. An excuse written before this covers its pieces' findings still and no character finding (`verdict.js:"export const lawExcused"`),
so a character cleared on a bare `gold:` before the deploy is held again at its next out-of-law purse, the same purse
included, and that hold is a strike. The strikes count as before: a held finding's change of value is no new strike,
and the state leaving an excuse is one, as a new signature's is (`rising` reads the excuse the same way); the finding row
is written once a signature, and once more where an excuse ends. The Staff Panel's profile reads the excuse the same way (`staffPlayers.js` lawStands).
The clear's help says it (`tools/realmReview.mjs` USAGE and its header: it EXCUSES the finding standing, exactly as it
stands; any other state holds again; a clean checkpoint ends a character finding's excuse and a piece's stands - AUDIT
RPT1026 C3, the batch's words said a change ended it; a purse below nothing is `mend`'s). PURSE-MEND reads the stable signature as before (`PURSE_SIG`).

PINS: `test/server/rpt1026_ledgerlaw.test.js` (4 of its 8: lawValuesOf and the excuse, pure; the report's steps on the
real Worker - a negative purse cleared, purses of 9e15 and 5e9 held again, a clean checkpoint ending the
excuse, a pre-fix excuse covering no purse; an attribute's value and key; the tool's words). `test/server/audit_rpt1026_ledgerlaw.test.js`
(C2: a piece put away and taken back; C3: the tool's words; C5: the cut state).

### RPT1026-LEDGERLAW: MEND-SPENT (98) - `src/systems/item/foundMark.js`, `src/systems/repairService.js`, `src/scenes/worldModes.js`

WHAT DFU DOES. A repair is `currentCondition = maxCondition` (ConfirmTrade's InstantRepairs arm,
DaggerfallTradeWindow.cs:1062-1065; a finished job in FilterRemoteItems, DaggerfallTradeWindow.cs:705-728). Its sale has no found mark - MEND-THIRD is the port's own (Port-Ledger A).

WHAT THE PORT DID. MEND-THIRD's design: a found piece sells at its mark and a third of what its owner's own mends hold
above it, and wear spends those mends first. `creditOwnMend` only ever added to `selfMended`; no wear and no repair
lowered it, and the sale capped it at the condition above the mark only when the piece was sold. So wear hid the credit,
and a smith's restore made it count again. On the real producers (a Daedric cuirass off Roleplay & Realism: Items' roll at
its low end, two field kits, a blow's wear back to the mark): a smith's whole repair then sold at 29% where a piece only a
smith ever repaired sells at 19%; kits a wear apart credited 14,748 of a room the piece held 6,555 of (35% at a smith).

FIXED. `foundMark.js:"export function spendOwnMends"` cuts `selfMended` to what the
piece holds above its mark, and every rise of a found piece's condition calls it first: an own mend before it credits
(creditOwnMend, at its `from`), a smith's paid repair before it restores - `repairService.js:"export function repairWhole"`,
the one door every paid repair restores through (the finished job's `repairJobsAt`, and the two InstantRepairs arms of
the interior host, the counter's and the keyed flow's). A fall needs nothing: a sale reads the count no higher than the
piece holds. The cuirass reads 19% after the smith, and 26% after the two kits a wear apart. Economy-Arc's MEND-THIRD
("wear and re-mending cannot stack it" was not true) and its Port-Ledger A row narrowed.

THE FOUR HOSTS. The repairs are a shop's: `scenes/worldModes.js` (interiors) holds both InstantRepairs arms - each line
now calls `repairWhole` in place of the restore, net zero logical lines; `scenes/world.js`, `scenes/exterior.js` and
`scenes/dungeonContext.js` restore no condition of their own (the pin sweeps all four).

PINS: `test/systems/item/rpt1026_ledgerlaw_mend.test.js` (4: the report's steps, worn part way; the variant and a stale
count spent at the mend; a finished job and spendOwnMends' floor; every paid repair through the one door). PIN MOVED:
`test/systems/audit26_questitem.test.js` F070 (the InstantRepairs arms read `repairWhole(it)`).

### RPT1026-LEDGERLAW: STOLEN-SAID (269) - `src/systems/stolenGoods.js`, `src/ui/marketTab.js`, `src/ui/vendor/vendorTab.js`, `src/ui/vendor/vendorPage.js`, `src/scenes/vendorHost.js`, `src/ui/enhanced/enhancedPlusStyle.js`

WHAT DFU DOES. Nothing: its items carry no theft and it has no player market (STOLEN-GOODS, Standing-Arc, is the port's
own).

WHAT THE PORT DID. A stolen piece carries `stolen: true` through the save, the wire and a listing (a piece handed on is no
less stolen), and a player may buy one off the market's pack route or a hired trader - the court takes it from its buyer
on a conviction and a counter destroys it at the sale. The listing keeps the mark (traced on the real Worker: listed from
a pack, read back as the Goods view reads it, `stolen` still set), but only the owner's own pack card said "Stolen": the
Goods rows, the traders' rows and their look said nothing.

FIXED. A stolen piece's row says "Stolen" (`stolenGoods.js:"export const stolenTag"`) in the market's Goods view
(`marketTab.js` goodRow, and its Buy bar the card's line, stolenLine), on a hired trader's rows on the board and at the
stall (`vendorTab.js` rowNodes) and in its look (`systems/item/itemLook.js` itemLookRows' `stolen`, the host's
vendorItemStats, drawn by vendorStatsNode), on the Vendor page's search (`vendorPage.js`), and - AUDIT RPT1026 C4, left
by the batch - in the window two players trade in: a stolen piece the other player holds out says "Stolen" on its row and
its strip the card's line (`ui/enhanced/enhancedPlayerTrade.js`, both skins: the window keeps its own face). Nothing
about what may be listed or traded changed.

THE FOUR HOSTS. None: the market tab, the traders' tab and page are wired by `scenes/vendorHost.js` and the Notice
Board as before, and the trade window by `ui/playerTradeDoor.js`; no host line moved.

THE WORDS. One key, `stolen.tag` ("Stolen"), drafted in the thirteen whole languages (`SCRATCH/drafts/ledgerlaw.json`).

PINS: `test/ui/rpt1026_ledgerlaw_stolen.test.js` (2: a stolen and an honest sword listed through the real Worker and drawn
by the Goods view, its bar; the trader's board rows, its look and the Vendor page's line).
`test/ui/audit_rpt1026_ledgerlaw_trade.test.js` (C4: a stolen piece stolen by the theft's law, wired by its holder's
pack, received by a real session and drawn by the real window).

### ALREADY FIXED: SIDE-ONCE (8, 13) - and the service's law, the owner's

Both reports are of build 0.0.235 (2026-10-18). SIDE-ONCE (`01-Overview/bugs/Field-Bugs-2026-10-19f.md`, the owner: "One
copy per setting"; on main with #1054, merged 2026-10-20 13:06 UTC) took User Takes Damage's and Item Deteriorates' `AllowMultipleSecondaryInstances`
away (`enchantmentCatalogue.js:"UserTakesDamage: 1"`), so a setting is
picked once, and the primary list leaves out an effect with no setting left - Health Leech with all three taken (checked
on main: `primaryPickerList` drops it with three, keeps it with two; User Takes Damage offers "sunlight" alone after "holy
places"). `test/systems/fb1019f_sideonce.test.js`.

What it left, and still leaves: the account service's item law counts the maker's rows by effect (`itemLaw.js` makerFindings,
`many`), so a piece made before keeps its copies (the owner's call) - and so does a modified client's new piece. Traced
for a fix: the rows carry no time, and the item maker is the client's (the service never sees an enchant), so telling the
two apart takes a record the service keeps, and each one found carries an owner's call - a table of stacked pieces' prints
read off each record at its first checkpoint after the deploy misses the pieces in transit then (a listing, a delivery, a
shelf: their next holders held) and lets any configuration it read be minted again on a fresh piece; a law against the
record last judged clean (INT6's `clean_obj`) holds a receiver whose own record is held for something else, and its
service writes carry forward what an unclean checkpoint stored; locking every stacked piece from trade, as a copy is
locked, changes what an honest pre-fix piece may do. Recorded in Integrity-Arc's "What lane 1 leaves open". Note the honest
window still lays one setting twice for AbsorbsSpells and RepairsObjects (the singleton shortcut, primaryPick) - powers,
which spend the budget; every negative-cost side effect has two settings or more.

### AS DESIGNED (3)

AUDIT PROF10 J2 (`06-Systems/Professions-Arc.md`, "Audited (2026-10-03, AUDIT PROF10)"; Mac: "Item maker can add to it"):
the item maker takes a crafted piece of jewellery with the enchantments it carries (`enchanting.js` keptEnchantments), each
kept row costed as the maker costs a row and counted against the piece's points (`enchanting.js:"const cost = totalEnchantmentCost"`
in enchantDecision, the "used/available" label), in DFU's eleven-row guard and the picker's filters, never removed, at no
gold. MAKER-RARE took identified Rares the same way. Tell the player: a crafted jewel stays open to the item maker by
design - it can take more enchantments until its enchantment points are used up, and what it has always counts.

### NEEDS DATA / STAFF (290)

Traced: a realm trade's receipt adds the received lot (`tradeSession.js` _settled, `tradePack.js` give - jewellery never
stacks, and the duplicate refusal is by identity), the market's pack route and a trader's buy collect into the record and
the pack (`marketBook.js` collectGood, `tradePack.js` receive), and the only filters that drop a piece by its ledger key drop
the INCOMING one (a room's word, `interiorShared.js` withoutCarried). Nothing removes a carried King's Mark when another
arrives. A Legendary is a valuable piece: two King's Marks are two keys unless one is a copy of the other. What to read, for
the reporter's realm character: its findings (`/v1/staff/findings` - a `dupe` finding naming a key, a death in the zone),
`item_dupes` and `item_uids` for the King's Marks' keys (one key twice is a `twice` copy: the bought one was a copy of their
own, both locked, none removed), its trades (`/v1/mod/realm-trades`) and `market_sales`/`market_deliveries` on the report's
day, `wild_falls` (a death in the Wrothgarian zone takes the drop off the record, and the next join plays the record
without it), and the record's own items (its object and `prev`): if it holds both, the device's pack was a session the
realm moved past (a rejoin shows both); if one, the act that took the other is in its findings. Restore by Add an item
(Staff Panel) on the finding.

Mutants: `tools/mutants/rpt1026_ledgerlaw.json` - 24, all dead (CRAFT-HANDED 5: the owner alone, no hand-over written,
the owner holding it upheld against, a sale and a fill leaving it standing; EXCUSE-VALUES 7: the values ignored, unread,
dropped, the clean checkpoint keeping the excuse, the clear writing none, the excuse's end said as no finding, the tool's
words; MEND-SPENT 6: the paid repair spending nothing, the kit's credit unspent,
the spend cut to the condition, the job and both InstantRepairs arms past the one door; STOLEN-SAID 6: each row, the bar,
the look's two halves, the page). AUDIT RPT1026 (lane C, 2026-10-27) re-aimed three of them by content (the clean
checkpoint's end, the value's cut, the excuse's compare) and added `tools/mutants/audit_rpt1026_ledgerlaw.json` - 10, all dead (C1 4: the
hand-over from any giver, the escrow row's giver unread, either side of a trade naming none; C2 1; C3 1; C4 2; C5 2).

## The market and its deliveries (RPT1026-MARKET)

| | Report | What it was | Done |
|---|---|---|---|
| 121 | Buying anything at a player's home trader takes the gold and the item never comes (written in Spanish) | The buy landed: the purse paid, the listing sold, and the piece became a DELIVERY on the service, which only a collect puts into the record and the pack. The press's own collect did not land, and the stall still said "Bought". Only the Market tab's settle read the road and collected a waiting piece, and a trader's buyer never opened it. The piece is still waiting for the character on the service | RPT1026-MARKET ARRIVE |
| 130 | An axe bought from a home trader never arrived, and the gold was gone | The same: the piece waits as an uncollected delivery | RPT1026-MARKET ARRIVE |
| 174 | A bow bought at a player's house never came, though other things bought at the same time did | The same, for one of several presses in a row: the collect that did not land was this one's | RPT1026-MARKET ARRIVE |
| 231 | An amulet bought from a home trader for 5,000: a crash, and back in the game the piece, its price and the stall's copy were all gone | The same: the sale landed, and the piece waits as an uncollected delivery | RPT1026-MARKET ARRIVE |
| 74 | A character cannot be deleted online, refused for market business still open, after a home trader's purchase on a bad connection took the gold and never gave the piece | The delete refuses a character with market business open (`realm.js` REALM_MARKET_OPEN_SQL), and an uncollected delivery is such business. A later home-trader purchase of this character is still waiting for it on the service. The refusal named no way out. The katana of the report (10-20) is not among the character's waiting deliveries: a staff check (notes) | RPT1026-MARKET ARRIVE |
| 249 | Legendary pieces disappeared while being taken off the auction house | Their returns were collected on the service seven minutes before the report, so the pieces went into the character's record. A collect whose answer was lost ended the session ("crashed to the menu") with the piece in the record and none in the pack until a join - the gap VENDOR-LOST left open for a collect | RPT1026-MARKET COLLECT-LANDED |
| 246 | Mid-purchase of a legendary at a trader, the game black-screened to the login, and on reconnecting the piece was gone | After VENDOR-LOST a buy's lost answer is answered, and a collect's was not: the session ended mid-collect, and the player has no waiting delivery, so the collect landed and the piece went into the record | RPT1026-MARKET COLLECT-LANDED |
| 92 | Mid-purchase of a legendary amulet, the game dropped to the login, and the piece was neither on the stall nor in the pack (10-20, before VENDOR-LOST) | Traced: every path either leaves an uncollected delivery, which this player does not have, or puts the piece into the record. Before VENDOR-LOST a buy's lost answer ended the session with the sale landed and the piece a delivery, so a later Market tab visit may have collected it since. Which one happened is in the service's rows (notes) | NEEDS DATA |
| 291 | Gathering stopped working; the only message says trading is frozen, with no specifics, and nothing points to Discord | A hold refuses every progression claim, a harvest and every craft among them (`progress.js` seatRefusalOf), and every notice said "trading". Staff's notice said only "The realm's staff have frozen this character's trading." The toast on a refused harvest said "The notice shown when it froze says why", a line said once, in chat | RPT1026-MARKET HOLD-SAID |
| 245 | (Its trade-hold half) A staff trade hold: the reason is said to be shown somewhere but cannot be found, and crafting and gathering are blocked as trading is | The same words | RPT1026-MARKET HOLD-SAID |
| 242 | New resources (Arcane Essence, Cured Leather) in the Stores are not offered for sale on the market, nor when moving them to the guild Stores (written in Russian) | The service's walls: a silver listing, a writ and the guild Stores take only gathered and silver-bought units, and no market takes a station's loose ones. Cured Leather cured from looted or traded hides is loose, and Essence of a piece made of such goods is loose too (FB1020h ESSENCE-LOOSE), or gold's if the piece was bought with gold. The List form and the guild Stores offered only what may go and said nothing about the rest | AS DESIGNED (now said: RPT1026-MARKET STORES-SAID) |
| 181 | The sale preview (the yellow figure at the bottom left) reads about 30,000, but the sale pays about 600; does Mercantile do anything? | The enhanced counter's footer showed the staged lot's raw cost, while the keeper's offer and the gold paid are getTradePrice's: online, a sale pays at most half of the least the counter asks, moved by the seller's Mercantile and Personality (MERC-SLOPE) | ALREADY FIXED: SELL-SHOWN (`72b3b41d9`, 2026-10-25) |

### RPT1026-MARKET ARRIVE (121, 130, 174, 231, 74) - `server-account/src/market.js`, `src/net/marketArrivals.js`, `src/net/marketBook.js`, `src/scenes/vendorHost.js`, `src/systems/tradePack.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no market between players.

WHAT THE PORT DID. A piece bought from a pack (a home's trader, the Market tab's Goods) or come back to its seller (taken
off a trader, cancelled, run out, removed by a moderator) is a delivery on the service (`market_deliveries`). Only a
collect puts it into the character's record and pack (`market.js` collectGood, through the realm act). The trader's
press collects its own piece on the buy's answer (`vendorHost.js` vendorBuy, vendorTake). When that collect did not
land - another act of the record under way (`busy`), a checkpoint still waiting (`offline`), the hour's rate, an
answer lost - the press ignored the failure and still said "Bought X for N gold". Two doors asked again:
- the Market tab's settle, which collects what a read of the road names (`marketBook.js` settle over `state.road`);
- VENDOR-LOST's stall settle, which collected only a buy kept unanswered, and read no road.

A buyer at a home's trader who never opened the Market tab never got the piece. In the live database, 154 item
deliveries were uncollected for 102 players, 123 of them past a day: 68 bought and 55 come back. Each of the five
reporters' pieces is among them (the triage). Nor could the character be deleted: an uncollected delivery is market
business that holds the delete (`realm.js` REALM_MARKET_OPEN_SQL, `realm-market-open`). That is the refusal #74
met.

FIXED. The game reads the road itself and collects what arrived. It does not depend on the player knowing where to look.
- THE ROAD ALONE (`market.js` marketRoad, `/v1/market/road`): the account's own market is settled (listings and orders
  past their time closed and their goods sent back as deliveries, the couriers' loads put into the Stores) and its road
  is read with the balance. No view's rows, couriers' hubs or medians. Two round trips: the settle's reads (writes only
  when there is work) and the road's.
- THE SWEEP (`net/marketArrivals.js` createMarketArrivals, built in `vendorHost.js` createVendorHost): the road read,
  then the book's settle (`marketBook.settle`), which asks every kept act again and collects every piece that has arrived
  for this character. It runs:
  - after the join, ARRIVALS_FIRST_MS on, and only once `ready`. That is the checkpoint's own gate
    (`checkpointGateOpen`: the character spawned, its save the realm's, no duel) with the page visible, so nothing is
    collected into a pack the boot has not restored yet;
  - at a courier's arrival: a piece of this character's still on the road is asked for when the road says it arrives
    (bounded to ARRIVALS_WAIT_MAX_MS);
  - ARRIVALS_SOON_MS after a press whose own collect did not land (`soon`);
  - as a trader's stall opens (the stall's settle is now the sweep, so its road is read first).
  A "not yet" (no answer, the service's fault, the record busy) is asked again ARRIVALS_AGAIN_MS on, ARRIVALS_TRIES times
  in a row at most. A market shut to the account is asked no more this session.
- ONE COLLECT A DELIVERY, WHOEVER ASKS. Each collect is one realm act: the record moves in the collect's own batch,
  guarded on the delivery (`collected = 0` and mustChange), so a second collect of the same delivery is the service's
  `market-gone`. The book's acts run one at a time (`once`), and a settle waits for an act under way. A lost answer is
  asked again with the same id, and COLLECT-LANDED (below) answers it as that collect.
- THE PRESS SAYS IT. A trader's buy or take-back whose own collect did not land says "Bought X for N gold. It is on its
  way to your pack and will reach it on its own." (or "X is on its way back to your pack ...") and asks the sweep `soon`.
  `market-gone` means another door collected the piece first: it is in the pack, and the press's own words stand.
- THE PACK SAYS WHAT CAME. A settle's collect hands the road's word on to `goods.receive` (`tradePack.js`
  createMarketGoods): "A purchase has arrived: X is in your pack." / "X has come back from the market and is in your
  pack." The press's own collect still says "X is in your pack."
- THE DELETE SAYS THE WAY OUT. `realm-market-open` names a trader's takings too (`market_gold` holds the delete and was
  never named), and says: "Play it online once and goods waiting for it come to its pack on their own; takings are
  collected on the Vendor page."

For the reporters: each piece reaches the pack within about a quarter of a minute after the character next joins online.
#74's character can be deleted after that (its takings, if any, collected first).

THE FOUR HOSTS. The sweep's clock is the vendor host's (`scenes/vendorHost.js`, built once by `scenes/world.js` bootWorld,
which hands it `checkpointGateOpen` - one entry). The market book is bootWorld's alone. `worldModes.js` (a trader pressed
in its home, openHomeVendor) opens the stall through the vendor host, so the stall's settle is the sweep wherever it is
pressed. `dungeonContext.js` and `exterior.js` hold no market of their own (FLAGGED: none is needed, the clock is
global). HOST-SPLIT: to pay for the entry, the Vendor page's Collect body (`setVendorPage`'s `collectGold`) moved to the
vendor host as `vendorCollectGold`, so bootWorld goes 36,222 -> 36,216 logical lines, net six out. The ceiling is left
for the batch's merge.

THE WORDS. `market.arrived.bought`, `market.arrived.returned`, `vendor.buy.onWay`, `vendor.take.onWay`,
`account.refusal.realmMarketOpen` (moved), and the moved Collect's two lines, now `vendor.collect.noBank`,
`vendor.collect.done` and `vendor.collect.thisRegion`. All drafted in the thirteen whole languages (SCRATCH
`drafts/market.json`, 20 keys each with HOLD-SAID's and STORES-SAID's). The two moved refusals are also redrafted in
the seven partial languages that held them. `l10n4_hardcoded.test.js`'s ratchet was written
down again: world.js 331 -> 329, realmTradeLaw.js 21 -> 20, itemIds.js 2 -> 0.

PINS: `test/server/rpt1026_market_road.test.js` (4, two of them ARRIVE's: the road names a waiting purchase, the road's
settle sends a run-out listing back and names it, a taken-back piece is a delivery the seller's collect takes) and
`test/net/rpt1026_market_arrive.test.js` (7: over the real Worker, the real realm session and realmGoldAct, a trader's
piece bought and never collected reaches the pack and the record once, said; a taken-back piece comes back; the clock's
law (courier, bounded tries, `soon`, shut); the stall's press words and `soon`; the stall reading the road before it
settles; the wiring and the delete's words). PIN MOVED: `goldmarket_client.test.js`'s wiring regex (the road's word
handed through `goods.receive`), `profdelete.test.js` (the delete's words). Mutants `tools/mutants/rpt1026_market.json`, ARRIVE's 20 of its 40 (all 40
dead). Re-aimed by content, their sites' text having moved, and judged again: `autohold.json`
AUTOHOLD-AUDIT-the-review-promised; `fb1001_market.json` MARKET-ANY-book-the-repeat-received, -pack-nothing-said and
-host-the-book-receive-unwired; `fb1025_vendorlost.json` VENDORLOST-the-host-handing-no-settle, and
-the-repeat-without-the-record-s-sequence and -the-batch-s-catch-answering-seq, each aimed at the buy's own line since
collectGood grew its twin; `fieldbugs1012.json` RING-WARN-the-strikes-unsaid; `int4_int5.json` INT3-the-lift-unsaid.

AUDIT RPT1026 (lane D, MARKET; read cold over the real Worker, the realm session, realmGoldAct and the vendor host).
Three doors the sweep still missed, each fixed:
- D1. A press's `soon` asked while a sweep was under way was cancelled by that sweep's own clock (`after` decides the
  clock), and the sweep's road had been read before the press - so the piece the press said "will reach it on its own"
  waited for the next join. The poke is kept and swept for once the sweep under way ends (`marketArrivals.js` `poked`,
  Home.md ASYNC NEVER DROPS).
- D2. A courier the service still has on the road, past its arrival by a clock running ahead of the service's, was
  asked every ARRIVALS_LATE_MS for the courier's whole road (an hour ahead and a fifteen-minute courier: 181 reads). It
  is asked ARRIVALS_AGAIN_MS on; a clock on time keeps the slack.
- D3. A take-back kept unanswered (its first asking never reached the service) landed on a later settle - the stall's
  opening sweep - and that settle never collected the piece it sent back: off the stall and in nobody's pack until
  another settle. The settle collects a kept cancel's delivery on the answer that names it, as VENDOR-LOST's kept buy's
  (`marketBook.js` settle); `market-gone` there is a collect another door made, said as nothing.
- D4 (record). STORES-SAID's module, its pin and the arc page quoted #242's words (in translation); paraphrased.
Pinned by `test/net/audit_rpt1026_market.test.js` (5: D1's two, D2's and D3's first fail at the batch head; D3's second
holds its `market-gone` branch), mutants
`tools/mutants/audit_rpt1026_market.json` (8, all dead). The client alone: no service, relay or migration changed.

### RPT1026-MARKET COLLECT-LANDED (249, 246) - `server-account/src/market.js`, `src/net/marketBook.js`, `src/net/accountClient.js`

WHAT THE PORT DID. VENDOR-LOST (FIELD BUGS 2026-10-25g) answered a landed buy's repeat with the record's sequence, and
left the collect as it was. A collect of a piece from a pack answers where the record stands before any other word
(AUDIT REALM L1-F2). So when the first answer was lost, the retry found the record one on and was told `seq`.
realmGoldAct's `needsAnswer` then ended the session: "The realm did not answer about a trade in progress" and the title
screen, with the piece already in the record and none in the pack until a join read it back. The book's apply abandoned
the session on any repeat besides. The Field-Bugs page called this NOT CHANGED, "its own change". #249's returns were
collected on the service seven minutes before the report, which is this state. #246 came after VENDOR-LOST and has no
waiting delivery, so its collect landed too.

FIXED.
- THE SERVICE (`collectGood`). A record one on from where the tab asked, under its lease, with a delivery this id
  collected, is that collect, landed. It is answered as the repeat with the record's sequence and the piece
  (`realm.seq`), to a tab that sends `landed`. A record one on with no collect of the id, or two on, is still `seq`. The
  retry whose own batch was refused because the first asking's landed while it ran is answered the same way (the batch's
  catch). This departs from AUDIT REALM L1-F2 for a collect, as VENDOR-LOST did for a buy.
- THE BOOK (`marketBook.js` collectGood). It asks with `landed` (`accountMarket.collect`'s option), and receives a repeat
  that names the record's sequence into the pack. That is this ask's own collect, its first answer lost: its id is minted
  once, here, and the realm's hold moved nothing else in between. The session stands, at that sequence. A repeat that
  names no sequence (a collect made before this ask) still ends the session, and the join reads the record.

DEPLOY. The service and the client in either order. An old service ignores `landed`: a lost answer ends the session, as
before. An old client beside the new service sends no `landed` and is told `seq`, as before.

PINS: `test/server/rpt1026_market_road.test.js` (COLLECT-LANDED's 2: the repeat with the record's sequence, `seq` to an
older tab, to a stranger id and two on, the piece in the record once; the retry whose batch raced the first) and
`test/net/rpt1026_market_arrive.test.js` (2: the collect's answer lost over the real Worker, received on the retry with
the session standing at the record's sequence; a repeat naming none abandoned). Mutants: 9 of the 40.

### RPT1026-MARKET HOLD-SAID (291, 245) - `src/net/realm/realmTradeLaw.js`, `src/systems/item/itemIds.js`, `src/scenes/realmHoldHost.js`, `src/net/accountClient.js`

WHAT THE PORT DID. A held character's trade is refused (INT3), and so is every progression claim: INT16's seat refuses a
held character's harvest, smelt, craft, brew, disenchant, temper and writ delivery (`progress.js` PROGRESS_ROUTES,
seatRefusalOf) with `trade-held`. The notices said only "Trading is frozen", and staff's said only "The realm's staff
have frozen this character's trading." The notice is said once, when a checkpoint's answer moves the hold (onTradeHeld).
Every refused harvest after it toasted "This character's trading is frozen. The notice shown when it froze says why, and
until when." All of it was English to every player.

FIXED.
- Every notice names the three a player meets: "Its trading, gathering and crafting are frozen ...". That covers the
  law's (with its piece, and the strikes - "the freeze stays", never "trading" alone), the budget's, the timed hold's and
  the lifting ("... are open again").
- Staff's says how to reach them: "To ask why, send them a private report with /bug, or ask on the game's Discord." The
  staff note stays staff's own (`staffRealm.js`), and no player-facing reason field exists.
- A `trade-held` refusal anywhere (a harvest's toast, a craft's, a sale's) says the standing hold's own notice as the
  session last heard it (`realmTradeLaw.js` tradeHeldSaid, wired by `realmHoldHost.js` wireRealmHolds; with none heard
  yet, what a hold freezes). The automatic holds name their reason there: the law's piece and its end, the budget's
  wealth.
- In the player's language: `realm.held.law`, `lawNamed`, `budget`, `staff`, `open` are t() keys now, beside the timed
  ones already there.

THE WORDS. `realm.held.law`, `realm.held.lawNamed`, `realm.held.budget`, `realm.held.staff`, `realm.held.open` (new),
`realm.held.until`, `realm.held.untilPiece`, `account.refusal.tradeHeld` (moved), drafted in the thirteen whole languages.

PINS: `test/systems/rpt1026_market_held.test.js` (3: the seat's law the words speak for and every notice's three; staff's
contact and the automatic reasons; the refusal saying the standing hold through the wired session, and nothing once the
session is gone). PIN MOVED: `autohold.test.js` (the timed notices, the lifting, the generic refusal, the strikes),
`ringhold.test.js` (the strikes). Mutants: 6 of the 40.

### RPT1026-MARKET STORES-SAID (242) - `src/ui/storesWalled.js`, `src/ui/marketTab.js`, `src/ui/socialPanel.js`

AS DESIGNED. The walls are the service's and stand. A silver listing, a writ and the guild Stores take only gathered and
silver-bought units (`bagLaw.js` WRIT_ORIGINS; GOLD-MARKET's wall: gold's goods never fetch silver). A gold listing takes
gathered and gold-bought ones. No market takes a station's loose units (AUDIT BAG-CRAFT A1: what a station's put-in brought
from the pack, and what a station made of it). Cured Leather cured from looted or traded hides is loose. Arcane Essence of
a piece made of loose goods is loose, and of one bought with gold is gold's (FB1020h ESSENCE-LOOSE). ANY-GOODS (2026-10-26)
lifted the wall for crafting writs alone and kept it here. What the player should be told: those units are for crafting
stations (loose) or for gold sales (gold-bought), and the Stores page's card for each material says which it holds.

SAID NOW. The market's List form names the Stores' units its currency may not take, each material with its count and why
("Not for a silver sale: Cured Leather (40), Arcane Essence (12). Goods bought with gold sell only for gold, and goods
from your pack, or made from them, only go to crafting stations."). The guild Stores' Put in names those the guild may not
take. It had offered only what may go and said nothing of the rest.

THE WORDS. `market.list.walledSilver`, `market.list.walledGold`, `market.list.walledGuild`, `market.list.walledMore`.

PINS: `test/ui/rpt1026_market_walled.test.js` (2: over the service's own Stores counts (`professions.js` storeOf), what
lists and what does not partition every material in each currency, the three lines word for word; both places say it).
Mutants: 5 of the 40.

### SELL-SHOWN (181) - already fixed

WHAT DFU DOES. DaggerfallTradeWindow's cost label shows the staged items' cost, and the trade popup offers
FormulaHelper.CalculateTradePrice of it.

WHAT IT WAS. The figure the report names is the enhanced counter's footer, whose first figure is yellow
(`enhancedStyle.js` `.trade-fig:first-child b`). It showed the lot's raw cost. Online, a sale pays at most half the least
the counter asks, scaled by the seller's own haggle (`shopStock.js` calculateTradePrice: MERC-CAP, MERC-RISE,
MERC-SLOPE), so the gap was several times. SELL-SHOWN (`72b3b41d9`, 2026-10-25, a day before this batch) made the footer
read the keeper's own offer (`enhancedTrade.js` lotPrice), pinned by `test/ui/sellshown.test.js`. Mercantile counts: it
raises the seller's offer within the counter's online bound. The classic window's strip keeps DFU's raw cost, as DFU
draws it (not changed).

### NEEDS DATA (92), and the staff checks for 249, 246, 74

Traced for #92: the trader's or the Market tab's buy (`marketBook.js` goldBuy over realmGoldAct). A refusal of the buy
(the listing sold to another buyer, or gone) gives back exactly what the purse paid (`walletReserve`). A buy that landed
leaves a delivery. Its collect, landed, puts the piece into the record (collected = 1). Its collect, not landed, leaves the
delivery uncollected, which ARRIVE now collects. No path leaves neither a delivery nor the piece in the record. The
lead's queries are in the notes.

## Bosses and PvP (RPT1026-FIGHTS)

| | Report | What it was | Done |
|---|---|---|---|
| 120 | Two fighters clear the Abyss's Remnant far faster than one could (the report's own trace: a fighter's share retired, its blows still whole) | A fighter the beat has not seen for `ABSENT_RETIRE_MS` has its share taken out of the boss, and no blow arm asked whether the striker was one of them: a level-60 that stopped posing beside a level-1 struck a Remnant holding the level-1's share alone. And the relay judged a blow from the socket's last pose however old, where the census drops one older than `SD_POSE_FRESH_MS`. The same shape stood in the gate's Warden and the Ketch's Tonal Warden | RPT1026-FIGHTS RETIRED-BLOW |
| 106 | In the Abyss the Remnant loses health about 30 seconds after a fighter dies, so the survivors finish a smaller boss; the docs say it keeps a fallen fighter's share | The Hour's law as built and as its own design page says: a fighter away from the arena `ABSENT_RETIRE_MS` has its share out, at the fraction the Remnant stands at, and a death is such an absence (SD-ONELIFE: the fallen page leaves the realm at once). Two pages said otherwise and were wrong | AS DESIGNED - the pages corrected |
| 48 | Continuous-damage spells land only their first hit on a breach boss | Fixed since the build it was sent from: the relay's bodies carry a spell's rounds | ALREADY FIXED (Field-Bugs-2026-10-19f BOSS-DOT) |
| 55 | Disintegrate does nothing to the breach bosses and the Remnant | Fixed since the build it was sent from: the stand-ins hold a count the wire carries | ALREADY FIXED (Field-Bugs-2026-10-19f STAND-IN-WHOLE) |
| 119 | The new monsters take no damage from a 3x Disintegrate spell, the Ice Golem worst (written in Portuguese) | A spellmaker spell is element Magic unless the player picks another, Disintegrate saves by the spell's element, and the Enemy Expansion's Ice and Stone Golems are immune to Magic. DFU tells the player nothing when a foe saves | AS DESIGNED |
| 187 | Soul Trap in a party member's dungeon says "Trap active." and never traps a soul, whichever of the two kills the Daedra Lord | Two holes where the foe is another player's: a CAST's trap lay on the caster's copy (only a strike's crossed, STRIKE-SHARED), and the runner's own trap was read for no peer's killing blow (AUDIT WORLD2 B9) | RPT1026-FIGHTS TRAP-TO-OWNER |
| 282 | Pausing or opening the inventory in a shared dungeon freezes every foe while a party member kills them | The dungeon arm returned before `drawFoes` under any pausing window, online as offline - and the room's host steps the room's foes for everyone | RPT1026-FIGHTS WINDOW-ONLINE |
| 240 | A paralysis in a dungeon can be waited out in the inventory | The same return; and online the character's own clock runs with the world's (LIVED1), so the rounds the window stood were walked whole on the first frame after it | RPT1026-FIGHTS WINDOW-ONLINE |
| 293 | Just after logging in, foes seem to do no damage | Not found. Every veto of a foe's damage on the player was traced and is scoped; the likeliest live causes are a room host's window (282, now fixed) or a host's hidden tab, neither confirmed | NEEDS DATA |
| 233 | Spell Absorption, Reflect and Resist do nothing against another player's Disintegrate in PvP | INT10's referee: a spell between players is counted on the neutral stand-in, and the target's own wards are not read (AUDIT C&C H5) | AS DESIGNED (the owner's call to change) |
| 275 | In a PvP dungeon one player could not hurt another who could hurt them, until both were on the surface | The cast engine's seam to the zone's fair players underground was chosen at the build, and the world-hosted dungeon always took the arena's branch: no spell met a player in the halls, only a swing | RPT1026-FIGHTS HALL-SPELLS |
| 292 | Magic does nothing to players in the PvP zone's dungeons | The same | RPT1026-FIGHTS HALL-SPELLS |
| 195 | In the PvP zone a Chameleon (and, it says, any invisibility) stays up after its wearer attacks a player | A blow between players is rolled on a stub of the striker's sheet, and the formula's tail took the normal-power concealment off the stub | RPT1026-FIGHTS STRIKE-UNVEILS |
| 34 | In a duel the player's own health bar never drops | Fixed since the build it was sent from | ALREADY FIXED (Field-Bugs-2026-10-19f DUEL-BAR) |

Context, not verdicted here: two staff threads (players clearing Abyss bosses in about five minutes, and a fast arrival
at an Abyss portal) match 120's shape. RETIRED-BLOW closes the share hole; whether either account used it is staff's to
read in the fight records.

### RPT1026-FIGHTS RETIRED-BLOW (120) - `src/net/superDungeon/sdRemnant.js`, `src/net/gate/gateBrain.js`, `src/net/ketch/ketchWarden.js`, `server/src/index.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no boss shared between players.

WHAT THE PORT DID. A boss's health is one share a fighter (`gateBrain.js` joinFight). A fighter the beat has not seen
for `ABSENT_RETIRE_MS` (30 s) has its share taken out, at the fraction the boss stands at (retireShare), and a sighting
brings it back (restoreShare) - AUDIT SD II L7 M2, so that fighters who walk away do not leave an unwinnable fight. The
relay's census sees a body only from a pose no older than `SD_POSE_FRESH_MS` (25 s, `_sdFightBodies`). The blow arms
asked nothing of this. A page that stopped posing was absent from the census, its share out 55 s on, and its blows -
judged from the socket's last pose, however old - landed whole on the share of whoever was left. With the real module:
two level-60s bring 68,250; one retired leaves 34,125; with a level-1 beside the level-60, 3,150 - and the "absent" one's
next blow took 780 of it. The Echoes and Hearts of the Dragon Break, the gate's Warden and the Ketch's Tonal Warden and
its tuning-forks had the same shape. The Elite Breach's lords did not: a blow there joins its striker first
(`egBrain.js` egBlow, EG_SEAM's join). Nor the Serpent: AUDIT SERPENT E2 restores a share on a hit.

FIXED. A BLOW IS A SIGHTING. A blow that reaches the purse comes from a pose in the arena, so its striker is seen and
its share brought back, at the fraction the boss stands at (a return never heals it), before what it lands is judged:
`net/superDungeon/sdRemnant.js:"function sighted"` in applyRemnantHit, applyEchoHit (the Echoes rescaled
with it) and applyHeartHit; `gateBrain.js` applyHit; `ketchWarden.js:"function sighted"`
in applyWardenHit and applyForkHit. Restored rather than refused: the same blow a beat later would find its share in,
so a refusal only drops an honest blow struck between a return and the beat that sees it. And the relay judges a blow
from a pose no older than the census's own law: `server/src/index.js:"const pose = a.pose && !a.pose.dd && now - (a.pAt ?? a.since ?? 0) <= SD_POSE_FRESH_MS"`
(the Hour) and `KT_POSE_FRESH_MS` in `_ktWord` (the Ketch) - a stale pose speaks for no body, and its blow lands nothing.

PINS: `test/net/superDungeon/rpt1026_fights.test.js` (6: the report's numbers through the real module; the Echo and
the Heart; the gate's Warden; the Tonal Warden and a fork; the relay, through `fakeRooms`, dropping a stale pose's
blow; the Ketch relay's pose law). Moved: `sd8b_fight.test.js` and `sd11b_relay.test.js` each pose again before a
blow struck more than 25 s after their last pose (PIN MOVED: a heartbeat, as every live page sends one).
Mutants `tools/mutants/rpt1026_fights.json` RETIRED-BLOW-* (10, all dead). AUDIT RPT1026 E3: the Ketch relay's pose law
had been pinned by its source text alone; it is driven at the real Room now
(`test/net/ketch/audit_rpt1026_fights_ketch.test.js`: a crewmate gone quiet past `KT_POSE_FRESH_MS` lands nothing on a
risen construct, and lands again once it poses; `tools/mutants/audit_rpt1026_fights.json` AUDIT-RPT1026-E3-*, 2, dead).

### RPT1026-FIGHTS (106) - AS DESIGNED, the pages made to agree

WHAT THE PORT DOES. `11-Multiplayer/Super-Dungeons.md` section 10: a fighter away from the arena `ABSENT_RETIRE_MS` has
its share out, the fallen not excepted. Under SD-ONELIFE a fallen page leaves the realm the moment it falls
(`world.js`'s death branch, `online.leave()`), so every death is such an absence and its share goes 30 s on, at the
fraction. A party member's raise inside `SD_REZ_MS` brings the fallen back, and its share with it when the beat sees it.
The Elite Breach's lords keep a fallen member's share (Field-Bugs-2026-10-19e LORD-SHARES, the owner's call there).

WHAT WAS WRONG. Two pages said the Remnant keeps a fallen body's share as the lords do: `Elite-Gates.md` section 13.2,
the Field-Bugs-2026-10-19e note and the comment over `egLords.js` sharesOf. True of the law only (a body seen dead in
its arena keeps its share), never of play. All three now say what the code does; Super-Dungeons section 10 names the
death case and the raise, and the `stepRemnant` comment says so where the absence is judged.

WHAT TO TELL THE PLAYER. The Remnant's health bar holds its percentage when a fighter falls; the boss is resized to
the fighters still in the Hour about 30 seconds later. A party member who raises the fallen within the Hour's window
brings that share back. If the owner wants LORD-SHARES in the Hour (the dead's share stays in the boss), that is a
design change, not a bug: the report's own proposal (mark a fallen fighter in the fight, skip it when retiring) is the
shape it would take.

### ALREADY FIXED (48, 55, 34) - no change

- 48 (sent from 0.0.256): Field-Bugs-2026-10-19f BOSS-DOT. The relay's bodies carry a spell's lasting rounds
  (`scenes/gate/standInSpell.js` createStandInRounds, ticked by `dungeonContext.js:"standInRound();"`).
- 55 (0.0.256): Field-Bugs-2026-10-19f STAND-IN-WHOLE. A stand-in holds a count the wire carries
  (`world/gate/gateBoss.js:"e.maxHealth = e.health"`), so a Disintegrate's claim is landed, not refused.
- 34 (0.0.244): Field-Bugs-2026-10-19f DUEL-BAR, the owner's call. The duel's vitality is shown on the player's own bar
  (`net/duel/duelBar.js` duelVitality).

All three came with FIELD BUGS 2026-10-19f (#1054, merged 2026-10-20 13:06 UTC), after all three builds.

### (119) - AS DESIGNED: the Enemy Expansion's golems save against Magic

WHAT DFU DOES. Disintegrate saves by its spell's element (FormulaHelper.SavingThrow, the bundle's element), and a
career immune to that element always saves. A foe's save is silent: "Save versus spell made." is said for the player
alone.

WHAT THE PORT DOES. The same: `effects.js:"const saveElement = (e) => (savesAsMagic(e) ? 4 : spell.element);"` -
Disintegrate is not one of MAGIC_ONLY_KEYS. The spellmaker's default element is Magic
(`spellMaker.js:"export const DEFAULT_ELEMENT_INDEX"`). The Enemy Expansion's careers (`dexTableText.js`
CareerBase): the Ice Golem is immune to Magic, Frost and Poison; the Stone Golem to Magic and Poison; the Iron Golem
to Shock and Poison. Run on the real modules (200 casts each of a three-Disintegrate spell at 100%): element Magic -
Iron Golem 200 of 200 disintegrated, Ice and Stone Golems 0; element Fire - all three, every time.

WHAT TO TELL THE PLAYER. Make the spell's element one the golem is not immune to - Fire works on all three; Magic, the
spellmaker's default, does nothing to the Ice and Stone Golems.

### RPT1026-FIGHTS TRAP-TO-OWNER (187) - `src/scenes/hostMagic.js`, `src/systems/enchantments.js`, `src/scenes/hostEnchant.js`, `src/scenes/exteriorFoes.js`, `src/scenes/dungeonContext.js`

WHAT DFU DOES. The Soul Trap intercept sits in EnemyEntity.SetHealth (DFU's `EnemyEntity.cs`), before the death, every
damage source alike: a trapped foe's death rolls the trap whoever struck.

WHAT THE PORT DID. A foe another player runs (a party member's dungeon, a street foe of another page's pool) is a
puppet here, and its death is its runner's word. STRIKE-SHARED (Field-Bugs-2026-10-20h) carried a STRIKE's Soul Trap to
the runner. A CAST's - a missile's, a touch's, an area's - went through the cast engine's foe door onto the copy: "Trap
active." was said, and the runner's foe fell with no trap on it. And AUDIT WORLD2 B9 had a peer's killing blow read no
gem of the runner's: a trap the runner laid on its own foe was spent for nothing when a party member landed the blow.
So the trap failed whichever of the two killed it, as reported.

FIXED. The cast engine sends a cast's Soul Trap effects through the session's door to the foe's runner
(`hostMagic.js:"if (trapToOwner?.(foe, { ...spell, effects: trapFx }, casterLevel))"`; the door is
`enchantments.js:"export const spellToFoeOwner"`, the mounted enchantment ctx's `spellToOwner`, routed by the pool as
a strike's is). The rest of the spell lands here as before. The runner lands the trap marked as the caster's, names the
caster on the body as it falls (`j`, `q`), and the caster rolls it against its own pack. And the runner's own trap is
read whoever struck: `exteriorFoes.js:"if (!trap.allowDeath && !peer) { f.entity.health = 1; return; }"` and its
dungeon twin. A peer's blow is still never tethered and fills no Azura's Star (B9 stands for those). The caster hears no
"Trap active." for a puppet's trap, as for a strike's under STRIKE-SHARED; the soul's line comes as the foe falls.

THE FOUR HOSTS. The street pool (`exteriorFoes.js`, mounted by `world.js` and `exterior.js`) and the dungeon pool
(`dungeonContext.js`, mounted by `worldModes.js` and `dungeon.js`) take the same law. The cast engine
(`createPlayerMagic`) is every host's. The standalone hosts run no peers: unchanged in play.

PINS: `test/scenes/rpt1026_fights_trap.test.js` (4: a cast trap on a foe another pool runs rides to it and the soul to
the caster; one on a foe I run lands here, and the session door is the ctx's; the runner's own trap filled on a peer's
kill and no tether without a gem; the dungeon twin by source). Moved: `strikeshared.test.js` (2 trap-door pins),
`world2.test.js` and `auditworld6b.test.js` (B9's and B2's "a peer's kill reads no gem", now "reads my own trap, never
tethers"), `audit24_lifetimes.test.js` (the death arm's proximity bound, 4,200 to 4,500 characters, for the comment).
Mutants `tools/mutants/rpt1026_fights.json` TRAP-TO-OWNER-* (9, all dead); `strikeshared.json`'s
STRIKE-SHARED-owner-reads-own-gem re-aimed at the new line.

### RPT1026-FIGHTS WINDOW-ONLINE (282, 240) - `src/scenes/windowWorld.js` (new), `src/scenes/worldModes.js`, `src/scenes/world.js`, `src/scenes/dungeonContext.js`

WHAT DFU DOES. A PauseWhileOpen window pauses the game (UserInterfaceManager.PushWindow -> GameManager.PauseGame,
`Time.timeScale` 0): the foes, the player's own clock and every effect's rounds stop and resume together.

WHAT THE PORT DID. Above ground WINFOE1 had already ended the pause online (the owner: "enemies should still be able to
do damage - a window ... no longer zeroes their clock; only your own input/camera pause"). The dungeon never had it.
Both dungeon hosts returned before `drawFoes` under any pausing window, so online:
- the room's foes - one simulation, stepped by the room's host for the whole party (WORLD2) - stood frozen while the
  host's window was up, and its party member killed them freely (282);
- the character's own clock runs with the world's (LIVED1), so the rounds a paralysis lasted ran out under the
  inventory and were walked whole on the first frame after it (240). On the real tick: a ten-round paralysis is spent
  by the first tick after fifteen game minutes the frame never ran.

FIXED. Online a window holds no dungeon while the player lives under it:
`windowWorld.js:"export const windowHoldsDungeon = (up, alive) =>"`, read by `worldModes.js`'s dungeon arm (the window's
early return, the frozen bodies, the Hour's poses and late telegraph) and by `world.js`'s tactics clock. The frame runs -
the foes act, the rounds tick - and the window is drawn last over it. The motor, the input, the collision triggers
(`drawFoes`' move flag false under a window), the breath and a pending cast stay held, and the HUD and the hover take
the window's cover as a street frame's do. The death screen holds the dungeon in both modes. Offline the dungeon pauses
as DFU's does. Departure: Port-Ledger section A, ONLINE A WINDOW HOLDS NO DUNGEON.

AUDIT RPT1026 E1: AND THE TECHNIQUE KEY. The frame that now runs under a window online steps the dungeon's weapon rig, and
the rig steps the technique key. AUDIT TECH1 holds that key under a window by its door's `blocked` - the street's is
`gamePaused()` - and the dungeon's door had none, its rig never having stepped under one of its windows: the key (Mouse3,
which reaches the held keys under any window) fired a weapon's technique from under the inventory or the map. The door
holds it by the context's own pause now (`dungeonContext.js:"blocked: dungeonPaused,"`; the host's length unchanged -
its `drainFatigue` entry is the function itself). Pinned by `test/scenes/audit_rpt1026_fights.test.js` (the door as the host
writes it, on the real rig); `tools/mutants/audit_rpt1026_fights.json` AUDIT-RPT1026-E1-* (2, dead).

THE FOUR HOSTS. `scenes/worldModes.js` (the world-hosted dungeon) WIRED; `scenes/world.js` WIRED (the tactics clock);
`scenes/dungeonContext.js` WIRED (the breath and a pending cast held under its own window); `scenes/dungeon.js` and
`scenes/exterior.js` FLAGGED: offline hosts with no shared clock, DFU's pause stands. Recorded in `Systems-Arc.md`.

PINS: `test/scenes/rpt1026_fights_window.test.js` (3: the report's clock on the real tick; the law, offline and online,
alive and dead; the hosts by source). Moved with the arm's window test (PIN MOVED, 17 files): `spellhand`,
`name1_bubbles`, `sd8d_remnant_blows`, `fb1018f_dungeondigits`, `statuslive`, `hudtext`, `sd26_render`, `audittact`,
`audittell`, `sd11a_scenes`, `auditcrew`, `auditclimbarc`, `worldhover`, `fb1015_lootbody`, `searise`,
`audit0929_actions`, and `audit18` (AUDIT 18 F5's gate count skips the one-line block that draws the window over a
frame that ran - no gate, the frame goes on past it). Mutants `tools/mutants/rpt1026_fights.json` WINDOW-ONLINE-* (6, all dead); re-aimed at the moved
lines: `audit27h.json`, `audittell.json`, `fb1018f_dungeondigits.json`, `font1.json`, `sd11a.json`,
`sd26_render.json` (2), `statuslive1.json`.

### (293) - NEEDS DATA

Traced every door that vetoes or zeroes a foe's damage on the player: the jail's arrest shield (in court only, not
kept across a login), staff god and freeze (staff-set, said on the HUD), and the damage modifiers that return 0 (an
Elite Breach witness, the POI editor, a Ketch member down) - each scoped to its place. None stands at a fresh login
in the open. The likeliest live causes are a room host whose window was up (282, fixed above) or a host whose tab was
hidden (its foes are not stepped) - neither confirmed. Ask the player: alone or in a party, in a dungeon or outdoors,
whether the foes swung at all, and whether it outlasted a relog.

### (233) - AS DESIGNED: the referee counts a spell between players on the stand-in

WHAT THE PORT DOES. INT10 (`06-Systems/Integrity-Arc.md`): a spell between players is counted on the neutral stand-in
with the caster's sheet (`siegeCombat.js` siegeSpellNumbers), and the referee clips the number. The target's own
Spell Absorption, Reflection, Resistance and elemental resistances are not read (AUDIT C&C H5): a defender-declared
ward is a number the defender's own client would hand the referee. Nor is the save the defender's: it is rolled on the
stand-in's own sheet - every attribute at the middle of the wire's clamp, no race (`duelCombat.js` DUEL_STAND_IN) - so
the defender's Willpower is not read either. [AUDIT RPT1026 E2: this said the defender's Willpower save applied, as the
report supposed - the code reads none of the defender's sheet.]

WHAT TO TELL THE PLAYER. Absorb, Reflect and Resist work against monsters; between players the server judges a spell
on a neutral target, so they do not apply in PvP - and neither does the target's Willpower: every spell between players
saves as it would against an average target. Changing that is the owner's decision - it needs the wards (and the sheet)
on the referee's own record, not the defender's word.

### RPT1026-FIGHTS HALL-SPELLS (275, 292) - `src/scenes/dungeonContext.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no players to fight.

WHAT THE PORT DID. PVPDUNGEON's seam from the cast engine to the zone's fair players underground (`duelMark`, the marks
a harmful spell can meet; `castAtDuel`, the door it leaves by) was chosen once, at the build, by whether the context
was handed the arena's door. The world-hosted dungeon is handed it always (`worldModes.js` `arenaRival`, a door that
answers null off a relay's sand), so every dungeon took the arena's branch: off the sand it found no rival and no mark,
and no spell met another player in the zone's halls. A swing did (the zone's strike door is asked at the blow), so a
caster could not hurt a fighter who could hurt them, until both were back on the surface (275).

FIXED. Both are asked at the cast: the arena's rival while a bout between players stands, else the zone's fair players
(`dungeonContext.js:"castAtDuel: (id, sp) => (arenaRivalBody()?.rival === id ? spellOnRival(sp) : !!opts.wildSpellOut?.(id, sp)),"`).

THE FOUR HOSTS. `dungeonContext.js` is the dungeon of `worldModes.js` (WIRED, the zone's halls) and of `dungeon.js`
(offline, no zone: both doors answer none). The street's seam (`world.js`) was already asked at the cast.

WHAT IS LEFT (AUDIT RPT1026 E4). A bow. Underground no arrow is aimed at a player (`11-Multiplayer/Wild-Zone.md` section
22, Known limits): the dungeon's missile lane meets the arena's rival and the relay's bodies, never the zone's fair
players (`world.js` wildArrowTargets is the street's alone). An archer in the halls still cannot hurt a fighter who can
hurt them, until both are back on the surface - 275's own shape, for a bow. HALL-SPELLS closes the caster's half, the
one these reports describe (292 is of magic). WHAT TO TELL THE PLAYER: in the PvP zone's dungeons a spell or a swing reaches
another player; an arrow does not yet.

PINS: `test/scenes/rpt1026_fights_halls.test.js` (2: the context's own seam text run with the real cast engine - an
area spell meets the zone's marks underground and goes out by the zone's door; on the sand the rival is the one mark
and door). Moved: `arena4b_blows.test.js`, `int10_spells.test.js` (the seam's text). Mutants
`tools/mutants/rpt1026_fights.json` HALL-SPELLS-* (3, all dead); `arena4b_blows.json`'s ARENA4b-BLOW-SPELL-UNROUTED
re-aimed.

### RPT1026-FIGHTS STRIKE-UNVEILS (195) - `src/combat/duelCombat.js`, `src/scenes/world.js`

WHAT DFU DOES. FormulaHelper.CalculateAttackDamage ends by breaking the attacker's normal-power concealment when the
blow does damage (EntityEffectManager.BreakNormalPowerConcealmentEffects): a Chameleon, an Invisibility or a Shadow of
the normal power ends on a blow that lands. The true powers stand.

WHAT THE PORT DID. A blow between players is rolled on a stub of the striker's sheet against the neutral stand-in
(INT8, `duelCombat.js` resolveDuelStrike). The formula's tail took the concealment off its attacker - the stub - and
the striker's own Chameleon, Invisibility or Shadow stood through every blow it landed on a player.

FIXED. The one stand-in carries the entity that strikes it (`duelStandIn(striker)`, `struckBy`), and a blow that lands
damage unveils that entity:
`duelCombat.js:"if (n > 0 && target?.struckBy) breakNormalPowerConcealment"`. The world host's four
rolls hand the player (a duel's, a siege work's, a battle's, the zone's - a hall's swing reaches the zone's). A miss
unveils nothing; the true powers stand. A spell's harm is counted with the player as its caster, whose damage arms
already unveil (`effects.js` handleAttackFromSource).

THE FOUR HOSTS. Every roll between players is `world.js`'s (the zone's halls reach it through wildStrike); the
standalone hosts hold no players.

PINS: `test/combat/rpt1026_fights_unveil.test.js` (2: Chameleon, Invisibility and Shadow of the normal power broken
on a landed blow and not on a miss, the true Chameleon standing; the four calls by source). Moved: `auditcc_pvp`,
`duel_combat`, `twohands` (the four rolls' text). Mutants `tools/mutants/rpt1026_fights.json` STRIKE-UNVEILS-* (3, all
dead); `auditcc_pvp.json`'s four roll records re-aimed.

Mutants in all: `tools/mutants/rpt1026_fights.json`, 31 records, 31 dead. The 15 records re-aimed in other lists and
the 7 other records whose lines this change touched were run again: 22 dead. The audit's (AUDIT RPT1026, lane E):
`tools/mutants/audit_rpt1026_fights.json`, 4 records, 4 dead.

## Spells, skills and progression (RPT1026-PROGRESS)

### RPT1026-PROGRESS - the progression, spell and item reports (22)

Read on main's `d5a4c9c6a`, with the freeware's data. The pins are named under each fix, the mutants
`tools/mutants/rpt1026_progress.json` (33: 31 dead, 2 equivalent as recorded - `node tools/mutate.mjs --jobs 4 tools/mutants/rpt1026_progress.json`). Code comments carry `RPT1026-PROGRESS`.

AUDIT RPT1026 (lane F, 2026-10-27) read the section cold and proved four defects, fixed beneath the fixes they follow
(F1 PRACTICE-KEPT, F2 JEWEL-USED, F3 the absorption answer, F4 SUMMON-BARE's left item), corrected one claim (F5) and
pinned one law end to end that only a hand-built entity held (F6, under F4); code comments carry `AUDIT RPT1026 F<n>`,
the pins are `test/scenes/audit_rpt1026_progress.test.js` (7, each failing on the batch's head), the mutants
`tools/mutants/audit_rpt1026_progress.json` (21, all dead).

| # | Report | What it was | Done |
|---|---|---|---|
| 101 | Weak-foe practice banked on a skill at 100 paid out past the cap once the skill was mastered (the reporter measured some twenty points) | Real. A skill held at 100 unmastered (or mastered with Master Skills off) counts every use whole, to DFU's 20,000 clamp; mastering it later (or switching Master Skills on) let MOVE-BANK spend that plain practice at the over-cap price, a point a rest | PRACTICE-KEPT |
| 100 | A party mate's lesser ward, landed first, hid the player's own greater one | Real. The three ward readers took the first live entry (FindIncumbentEffect); a gift never merges with your own spell, so a 6% gift read over your 100% | WARD-BEST |
| 62 | Skull of Corruption's copies carry their original's full loot | Real, and DFU's own rule (CreateFoe gives an allied summon its kind's loot): a Skull that never breaks farmed Daedra loot | SUMMON-BARE |
| 103 | A discounted Identify gave back more than it took | The report's profit was closed by `2000334cd` (2026-10-25); two leftovers were real: the 5-point floor applied after discounts (a cast of 1 gave back 5), and the refund was re-priced at the landing (a discount gone between ready and release gave back the whole price) | IDENTIFY-SPENT |
| 284 | A single filled gem paid for several items in one sitting at the item maker | Real. The window froze its soul list as DFU's does, and a bind whose gem was already spent went ahead with the soul's negative (free) budget | SOUL-HELD |
| 286 | Resting removes Spell Absorption; the player then dies to their own spell | Answered AS DESIGNED; REAL (AUDIT RPT1026 F3): at a full pool the cast makes room for what it spent, and DFU's absorb fits it - the port's discounts left that room short of the absorb's undiscounted price | AUDIT RPT1026 F3 |
| 45 | Level progress barely moves when skills past 100 rise | AS DESIGNED (SOFTCAP1): past 100 a point enters the level sum at a quarter | Answer the player |
| 46 | The same, measured: +15 school points gave 2/15 of a level | AS DESIGNED - the reporter's own numbers through `levelUpSkillSum` give exactly +2 | Answer the player |
| 154 | Growth's specialization shows Restoration 90, the Stats page 115 | AS DESIGNED: the specialization reads the trained skill (mastery needs the trained 100); the Stats page adds gear and spells (the Amulet of the Nine is +25 Restoration) | Answer the player |
| 125 | The sheet's level and the level shown under the vitals disagree (18 and 20); a school reads 10 lower than the player expects | AS DESIGNED for the level: the bar under the vitals is the account's Renown, its own level. The Destruction gap is not explained by the report | Answer the player |
| 267 | Blademaster's passive seems not to work and shows nothing | It works (pinned through the real formula); it said nothing | FLOW-SEEN |
| 251 | The Nine's amulet's death save seemed never to fire | NOT REPRODUCED: Divine Grace saves through the one damage door (`loot5_powers` pins it); the places it cannot act are listed below | Answer the player |
| 288 | The Goldsmith's Silver-for-Gold choice seemed to do nothing | It works (a Goldsmith's Silver piece holds Gold's points and worth); its card's words promised Silver standing in for Gold in a recipe | GOLDSMITH-SAID |
| 261 | Equipping the sixth Ruhn piece lowers armour and damage | NEEDS DATA: the damage half is the set's law (a set stands at its lowest piece's stage); the armour half is not reachable in the code as read | NEEDS DATA (below) |
| 66 | A jewel with Cast When Used on the hotbar is put on or taken off instead of cast | Real: UI2 wore every piece a body slot takes | JEWEL-USED |
| 59 | Training can be bought again and again by resting or waiting between sessions | AS DESIGNED (DFU's DaggerfallGuildServiceTraining): once every 12 game hours on the character's own clock, each session three hours, gold and fatigue | Answer the player |
| 61 | Fast travel seems to skip the wait between skill raises | AS DESIGNED: skills rise at a rest's end and at a fast travel's arrival (DFU's PerformFastTravel calls RaiseSkills), once the 6-game-hour gate is open | Answer the player |
| 75 | Running out of fatigue restores health and fatigue | AS DESIGNED (DFU's PlayerEntity_OnExhausted): you collapse into an hour's rest with no foe near, and die with one near | Answer the player |
| 117 | Jumping and Running level very fast during an x60 journey | Real: a journey's tick ran the tallies on the scaled clock - 60-100x the uses a real second | JOURNEY-REAL |
| 235 | A made Shock spell cast at range harmed nothing | NOT REPRODUCED on main (the reporter says it was fixed, #250); no commit between their two builds touches the spell path | Answer the player |
| 33 | A bow's lightning powers show no element's look or colour on a hit | Already recorded (Field-Bugs-2026-10-19f #7): Chain Lightning's number was CHAIN-SEEN's; an element's colour and a Cast When Strikes visual are requests | ALREADY FIXED (CHAIN-SEEN) / request |
| 109 | The same, after an update: still no animation, no second number | The same; the build predates CHAIN-SEEN's merge | ALREADY FIXED (CHAIN-SEEN) / request |

### PRACTICE-KEPT (101) - `src/systems/masterSkills.js`

WHAT DFU DOES. PlayerEntity.TallySkill counts every use, to 20,000; RaiseSkills raises one point a pass when the
Reflexes-scaled uses reach the requirement, and a skill at 100 never spends them. Master Skills is the port's own.

WHAT THE PORT DID. Past 100 a mastered skill counts only uses against a tough foe (`skills.js` tallySkill's
`overcapTallyWeight`) and raiseSkills banks the counter as progress (MOVE-BANK). The tally asks `skillCanPassCap` -
mastered AND Master Skills in force - so a skill held at 100 unmastered (or, offline, mastered with the switch off)
counted every weak blow whole, to the clamp. Mastering it from the sheet (or switching Master Skills on) handed that
counter to the bank, which cannot tell how it was counted: 20,000 plain uses bought a point every rest. Mastering at the
prompt was safe only because the pass that raised the skill to 100 had just zeroed it.

FIXED. The plain practice is dropped the moment a skill may pass 100 (`masterSkills.js:"function dropPlainPractice"`):
in masterSkill, and in setMasterSkills when the switch moves on, for each skill mastered and at the cap or beyond. A skill below 100
keeps its uses (it counts by the plain rule either way), a switch pressed On while on drops nothing, the weighted fraction
(`skillUseFrac`) is the tough-foe rule's own and stays. DFU's TallySkill is untouched. Port-Ledger A's MOVE-BANK row
narrowed beside it. THE RELAY: masterSkills.js is a leaf of the relay's bundle (FOE-BOUNDS reads `masterSkillsActive` and
`masterCappedSkill`); the relay calls neither function changed, but its law is the bundle's bytes - RELAY_VERSION moves
(`relayversion.test.js` SLAM8), once for the batch.

PINS: `test/systems/rpt1026_progress.test.js` (2: the report's grind - 20,000 plain uses, mastered, thirty rests, no
point - and its control; the offline switch, a skill below 100 kept, an unmoved switch). Mutants 1-5 (4 dead, 1
equivalent: the helper's own 100 guard, which no caller can reach below).

AUDIT RPT1026 F1 (minor, fixed). The drop at the switch on took practice the tough-foe rule had counted. Past 100 a mastered
skill's counter holds the tough-foe uses since its last rest's pass (MOVE-BANK banks them there), so Master Skills switched
off and on again before a rest threw them all away - 119 uses of a level-30 foe's blows in the audit's probe - under the
switch's own line, "Your progress is kept". The switch off now notes each mastered skill's counter at the cap
(`masterSkills.js` holdMasterPractice, `entity.masterPracticeHeld`, saved by `save.js`), and the switch on drops the
counter as before and gives the noted uses back (returnMasterPractice). masterSkills.js is in the relay's bundle and the
account service's: the relay's `world270` row is re-hashed in place (undeployed); no version moves.

### WARD-BEST (100) - `src/systems/effects.js`

WHAT DFU DOES. FindIncumbentEffect<T> (`EntityEffectManager.cs:666-678`) answers the first effect of its kind; one
bundle holds it, since a recast merges into it.

WHAT THE PORT DID. A party mate's gift never folds into a spell the player cast (AUDIT ALLY-CAST C2) and a worn item's bundle
never merges with a spell's (E2), so two entries of a kind stand, and `spellResistanceChance`, `spellReflectionChance`
and `comprehendLanguagesChance` read the first: a level-one mate's 6% Resistance gift, landed first, masked the player's
own 100% for its whole duration, the HUD showing both. The Hierophant's Sanctify and a ward cast past 100 in Thaumaturgy
are entries of that kind too, hidden alike. Spell Absorption's reader took the best since AUDIT SPELL-GIFT B4.

FIXED. All three read the best live entry (`effects.js:"export function bestLiveChance(target, kind) {"`), never a sum (X2).
Port-Ledger A; Online-Arc's B4 line names the three beside absorption.

PINS: `test/scenes/rpt1026_progress_magic.test.js` (the report's sequence through the player's cast engine: the gift by
the receiver's door, the player's own ward readied and cast, a foe's bolt rolling 50 resisted; an ended ward read by
nobody; Reflection turning the bolt back; Comprehend Languages). PIN MOVED: `test/scenes/x11.test.js` (an item's 91 beside a
spell's 71 reads 91). Mutants 6-7 (2 dead).

### SUMMON-BARE (62) - `src/systems/foeLootCap.js`, `src/scenes/hostEnchant.js`

WHAT DFU DOES. The Skull of Corruption clones the nearest foe and the Sanguine Rose stands a Daedroth, both allied, through
CreateFoe; SetEnemyCareer gives the summon its kind's loot and its corpse is looted like any foe's.

WHAT THE PORT DID. The same: the copy's spawn rolled its table and kit (`hostCombat.js` spawnEnemyLoot), its death laddered
the kit and ran the death's handlers. With Repairs Objects the Skull never breaks, so a player set copy after copy on a
Daedra and looted each.

FIXED. The enchant ctx's allied door marks the foe its host's stand answers (`foeLootCap.js:"export function summonedBody"`:
its carried list emptied - its hand and worn kit still fight), and the last word every body door asks
(`foeLootCap.js:"if (entity?.summoned === true && Array.isArray(entity.items))"`)
empties whatever its death laid on it. Elite and revenant drops were never an ally's. Port-Ledger A.

THE FOUR HOSTS. `scenes/hostEnchant.js` createEnchantCtx is the one ctx body; `world.js`, `exterior.js` and
`dungeonContext.js` mount it (`worldModes.js`'s interiors through world.js's stand), and each host's stand answers the foe
it stood - the street's and a building's pool (`exteriorFoes.js` spawnFoe), the dungeon's loose stand (spawnLooseFoe) -
so no host changed.

AND EVERY OTHER PLAYER'S COPY OF IT. In a dungeon online the room's other players stand the copy as a loose stand's
puppet (SUMMON-SYNC), built on their own machine - and that build rolled its kind's loot there (buildFoeAt's
spawnEnemyLoot), its stream death its kit, food and card, so the farm reopened with a second player. The owner's own frame
names its summons beside its loose stands (`sm`: `foeLootCap.js:"export function summonedWord"`); a reader
flags the record (`dungeonContext.js:"      const r = summonedRecord(validFoeRecord(raw), summ);"`) and marks the puppet
it stands (`dungeonContext.js:"    applyFoeRecord(markSummoned(f, r), r);"`, in applyOwnRecord) - bare alive, its death's
finds emptied by capFoeLoot. Both ways at once (my summon on a friend's machine, theirs on mine), and the mark rides the
entity (AUDIT RPT1026 F5, record: no producer hands a summon to an heir - both `heirOf`s in world.js refuse a PlayerAlly,
as Online-Arc's SUMMON-SYNC says; the pin's handover names its heir by hand). No relay or wire change: the relay fans an own frame unread
(OWN1). Four edits inside existing statements of buildDungeonContext - its logical lines unchanged (8,429). The street's and
a building's lane needed nothing: a puppet there carries no loot (exteriorFoes.js WORLD6b B14), and a handed one carries
its owner's (empty) list.

~~LEFT, FOR THE OWNER. A summon restored from a save stands again with its empty list, its mark not saved, so a death
handler's find (food, a card) can land on it.~~ AUDIT RPT1026 F4 (minor, fixed): proved on the street's pool - the Skull's
copy of a Grizzly Bear, saved alive and loaded, stood unmarked and died with three pieces of meat on its body. The street's
and a building's save carry the mark now and their restore re-marks the foe (`foeLootCap.js` savedSummon and
restoredSummon, over two existing statements of `exteriorFoes.js` createExteriorFoes - no logical line added). A dungeon's
fresh load stands no loose stand again, and a load in the same room patches the live, marked foe. Its pin also pins the
death's finds emptied end to end: this section's own pin of capFoeLoot's first line was a hand-built entity, and its
end-to-end test passed with that line gone (no death handler laid a find on the copy).

PINS: `test/scenes/rpt1026_progress_summon.test.js` (2: the real Skull off MAGIC.DEF used through the payload door over the
real ctx and a real street pool on the freeware's MONSTER.BSA - the copy empty alive and dead, the original looted; the cap's
in-place emptying); `test/scenes/rpt1026_progress_peersummon.test.js` (2, over HEAD's own statements of the own lane, the
puppet's stand and record, the build's real loot roll and the stream's real death: my summon bare on a friend's machine alive
and dead, theirs on mine; a plain loose stand's copy keeps its roll; a handed summon bare to a third player). PINS MOVED:
`test/systems/artifacts.test.js` and `test/scenes/loosefoespawn.test.js` (the door's line); `test/scenes/summonsync.test.js`,
`test/scenes/questparty3c.test.js`, `test/systems/quest/keptkill.test.js` and `test/characters/audit0928_merge.test.js`
(their mounts of the own lane take the three new names). Mutants 14-16 and 27-33 (10 dead).

### IDENTIFY-SPENT (103) - `src/scenes/hostMagic.js`

WHAT DFU DOES. Identify.Start refunds the effect's cost, floored at 5 (`Identify.cs:50-56`), and the window charges the same
number per click; its TODO says "Only refund if spell cast from spellbook".

WHAT THE PORT DID. The report's loop (a 30% discount casting at 211 and refunding 302) was closed on 2026-10-25 by `2000334cd`
(`spell/identifyRefund.js`, the refund priced as the cast is). Two leftovers stood: the floor of 5 applied after every
discount, so a cast a modifier took to 1 gave back 5; and the refund was priced at the landing while the cast paid the price
stored at the ready, so a discount gone in between gave back the whole price.

FIXED. The refund is capped at what this release spent - its token's `cost`
(`hostMagic.js:"      const spent = caster?.entity === playerEntity ? (caster.cast?.cost ?? 0) : 0;"`); a free cast (an item's,
a trap's) gets nothing. The window still charges the effect's price, floor and all. Port-Ledger A; its X11c row's "round trip
free" narrowed; `identifyRefund.js`'s header says the price is the window's and the refund's ceiling.

PINS: `test/scenes/rpt1026_progress_magic.test.js` (3: five casts at 30% off leave the pool where it was; the cast of 1 and
the discount gone mid-cast; a free ready). PIN NARROWED: `test/systems/identify.test.js` (its floor is the window's price).
Mutants 8-9 (2 dead).

### SOUL-HELD (284) - `src/ui/item/itemMakerWindow.js`, `src/systems/enchanting.js`

WHAT DFU DOES. EnumerateEnchantments runs at Setup and OnPush only (`DaggerfallItemMakerWindow.cs:171`, `:182`), so a soul
spent on one item is still offered for a second in the same window, and RemoveFilledTrap (`SoulBound.cs:129-155`) finds
nothing to take and the bind goes ahead.

WHAT THE PORT DID. Exactly that, on purpose (AUDIT 63 F14's review round). A bound soul's costs are negative, so the second
item got the soul's whole budget free: a single gem paid for item after item while that window stayed open.

FIXED. The window reads the pack's souls every time it asks (`itemMakerWindow.js:"get _souls() {"`),
and the law refuses a Soul Bound row whose soul the pack no longer holds, whatever list the row came from
(enchantDecision's `souls`: "That soul is no longer in your pack.", nothing paid). Port-Ledger A; Systems-Arc's AUDIT 63
F14 record says the freeze is gone. The account service's item law cannot tell such a piece: it reads one item, and holds a
Soul Bound row to its forced set, not to a gem the save gave up.

THE WORDS. `enchant.soulGone`, drafted in the thirteen whole languages (`SCRATCH/drafts/progress.json`).

PINS: `test/ui/rpt1026_progress_ui.test.js` (2: one Wraith in one gem binds one blade, the second not offered and refused
when laid anyway, nothing paid; two gems bind two, the law's three answers). PIN MOVED: `test/systems/audit63_effects.test.js`
(the spent soul is no longer offered) and `test/systems/prof12_client.test.js` (the enchant call's line). Mutants 10-13 (4 dead).

### FLOW-SEEN (267) - `src/systems/martialPowers.js`, `src/scenes/world.js`, `src/ui/enhanced/enhancedHud.js`, `src/ui/hud/statusTips.js`

WHAT THE PORT DID. Flowing Steel worked - +3% a landed blow, five deep, four seconds after the last (AUDIT MARTIAL L1 L2 pins
it through the real formula) - and said nothing; the Legendary Flow, the same law on a blade, has had a chip since LOOT5.

FIXED. Its stacks stand on the HUD beside the sets' and the Legendaries' (`martialPowers.js:"export function martialHudChips"`):
"Flowing Steel 3" and its seconds, in the technique's blue, its card "Specialization". world.js hands it on in the one
setHudSetChips statement it already had (no logical line added to bootWorld).

THE FOUR HOSTS. The chips are the one enhanced HUD's, set once by `scenes/world.js` (its interiors and dungeons through
worldModes.js and dungeonContext.js under the same HUD); `exterior.js`, the fixed-city bench, hands the HUD no set or loot
chips either.

PINS: `test/systems/rpt1026_progress.test.js` (1: three real blows, the chip, its seconds, gone; another path none; the
host's line). PINS MOVED: `test/scenes/tech1_hosts.test.js` (the chip's blue), `test/systems/loot5_powers.test.js` and `test/systems/set5_ui.test.js` (world.js's chip line). Mutants 17-19 (2 dead, 1 equivalent: only the Blademaster's strike raises the stacks).

### JEWEL-USED (66) - `src/systems/quickslots.js`

WHAT DFU DOES. The pack's Use on an enchanted item fires its Used payload (DaggerfallInventoryWindow.UseItem's enchanted arm).
DFU has no hotbar; UI2's is the port's.

WHAT THE PORT DID. UI2 put every piece a body slot takes on the bar as worn - a press put it on or took it off - so a Cast When
Used amulet could not be cast from the bar.

FIXED. A piece carrying Cast When Used is USED, the pack's Use (`quickslots.js:"const castsWhenUsed"`); a slot saved
as worn before the change asks the piece at the press. A Cast When Held piece is still worn; a weapon still readies and a
shield still straps on. Slots-Hotbar-Status.md's UI2 line narrowed.

PINS: `test/systems/rpt1026_progress.test.js` (1: two amulets the item maker enchanted - the Used one readies its spell from
the bar, neither put on nor taken off, a saved worn slot too; the Held one put on). Mutants 20-22 (3 dead).

AUDIT RPT1026 F2 (minor, fixed). A piece carrying Cast When Used beside armour or another power - a Warlock's Ring, a
Lord's Mail, a made amulet of Lightning and Water Walking - became a used slot, and a slot saved as worn asked the piece
and cast it too: no press could put it on from the bar again. Such a piece keeps its worn slot now; the press puts it on,
and casts once it is on (`quickslots.js` wornForMore: its armour, or a power's row beside the Cast When Used, never a
side effect's cost, a bound soul or Feather Weight). A piece whose only power is Cast When Used is cast unworn, as above.

### JOURNEY-REAL (117) - `src/systems/worldTick.js`

WHAT DFU DOES. PlayerEntity tallies Running every fourth classic update (`PlayerEntity.cs:309-320`) and Jumping a jump;
Travel Options runs a journey on `Time.timeScale` (`TravelOptionsMod.cs:382-390`), which scales both; DFU's own fast travel
trains nothing.

WHAT THE PORT DID. The same as the mod: world.js ticks the player with the journey's scaled dt and the motor lands a jump a
frame at x60, so a held run or jump key on a journey filled in seconds the uses a rest or an arrival raises - 240 Running uses
and 60 Jumping uses a real second at x60.

FIXED. A journey's run counts its real seconds and each jump 1/scale of a use, read off the one time scale
(`worldTick.js:"  const pace = Math.max(1, timeScale());"`), so a journey trains as walking the same real minutes does; at x1
nothing changes. Past 100 the tally count bounds MOVE-REAL's ground weight too. Port-Ledger A; Travel-Options.md's time-scale
section names it.

THE FOUR HOSTS. The tally is the shared tick's (`worldTick.js` tickPlayerMinutes), which every host's frame runs; only
`world.js` runs journeys (its scaled dt), and the others tick at x1, unchanged.

PINS: `test/systems/rpt1026_progress.test.js` (1: a real second at x1, x60 and x100 - 4/64, 4/1, 4/0). Mutants 23-25 (3 dead).

### GOLDSMITH-SAID (288) - `src/net/professionLaw.js`

WHAT THE PORT DID. The Goldsmith works: a Goldsmith's Silver piece carries hand 1 (`recipeLaw.js` jewelHand; the service's
record, `prof10_service` pins it) and mints with a Gold piece's enchantment points and a higher worth. The card's words were
the design's shorthand, "Silver counts as Gold.", which reads as Silver standing in for Gold in a recipe.

FIXED. The card says what it does: "Silver jewelry you make has the enchantment points and worth of Gold." (raw English, as
every specialisation card's text is - no catalog row). Professions-Arc's DECIDED line notes it. No service behaviour moves.

PINS: `test/systems/rpt1026_progress.test.js` (1: the words; a Goldsmith's Silver Ring minted from the record holds a Gold
Ring's points and more worth than a plain Silver one). Mutant 26 (dead).

### The answers (AS DESIGNED, NOT REPRODUCED, NEEDS DATA)

- ~~**286 - absorption after a rest.** DFU's TryAbsorption (`absorption.js` tryAbsorption): an absorb needs room in the pool
  for the spell's cost; a rest fills the pool, so the first destruction spell of your own that catches you (your area, a
  reflection) lands whole. Tell the player: spend some magicka first, or keep out of your own blast. Rest touches no effect
  (`systems/rest/` writes no active effect).~~
  AUDIT RPT1026 F3 (major, fixed): not DFU's rule. At a full pool the cast makes room for what it spent, and DFU prices
  the absorb "as if the target cast the spell" - for a self-absorb the same price, so it fits. The port's cast is
  priced with its modifiers (a focus piece, a set, the Firmament, a path's school) and the absorb without, so a
  discounted cast left too little room: through the real cast engine, an absorber's own Area at Range blast at a full
  pool, 42 spell points undiscounted, is drunk; at 30% off it costs 29, asks room for 42 and hurts for 24. Spending
  first worked only because it made the room. The caster's own spell now asks room for, and drinks, no more than its
  release spent (`absorption.js` tryAbsorption's `paid`, from `effects.js` applySpell), so the refund, half of it, is
  never a profit; anyone else's spell asks DFU's whole price. Port-Ledger A. Tell the player: fixed.
- **45, 46 - level past 100.** SOFTCAP1 (`skills.js` levelUpSkillSum): a point past 100 counts a quarter toward the level.
  The report's own skills (Destruction 128 to 131, Alteration 121 to 124, Thaumaturgy 112 to 115, Mysticism 120 to 123,
  Illusion 121 to 124) move the sum 627 to 629 - exactly the 2/15 seen. Levels past 30 come from skills still under 100.
- **154 - specialization 90, Stats 115.** The specialization page reads the trained skill (`specGuide.js` skillStand); a
  mastery needs the trained skill at 100 (`masterSkills.js` masteryRefusal). The Stats page adds gear and spells: the Amulet
  of the Nine alone is +25 Restoration (90 + 25 = 115).
- **125 - level 18 or 20.** The level box and bar under the vitals is the account's Renown (`ui/hud/hudRenown.js`), not the
  character's level; the sheet's 18 is the character's. If Destruction still reads lower than the player trained it, the
  sheet shows a mentored value as "90 (100)" while mentoring a lower party - otherwise staff can read the realm record.
- **251 - Divine Grace.** Pinned working through the one damage door (`playerEntity.js` hurtPlayer;
  `loot5_powers.test.js` "death, the vigil..."). It cannot act where the game decides a death by another's word or by
  design: the open (wild) zone, whose referee calls every fall (INT9 `forcePlayerDeath`); a world boss whose health the relay
  counts (INT11/INT12 `bossCountFell`); drowning and the exhaustion collapse (SetHealth(0) doors); a duel or an Arena bout
  (the powers sleep); offline with the loot ladder off; and after one save it needs 180 s (in the Spire, the next Redoubt).
  A foe's blow at full health leaves you at 1 without spending it (FULL-GUARD). For the owner: the referee's and the boss
  count's deaths asking a death save is a relay change.
- **261 - Ruhn, the sixth piece.** A set stands at its lowest piece's stage ("grow together", `sigilSets.js`), so a sixth
  piece won fresh at Faint lowers the Burning Gate's fire damage a blow and its fire resistance on every piece until it
  drinks up - the damage drop. Ruhn's tiers give no armour, and a pauldron's armour lands on its own arm alone
  (`equip.js` updateEquippedArmorValues), so the armour drop is not reachable as read. NEEDS DATA: the piece equipped and
  the paperdoll's armour before and after (or the realm record's worn items).
- **59 - training.** `guildServiceActions.js` trainingTooSoon: once every 720 classic minutes (12 hours) on the character's
  own clock, each session three hours, gold and 180 minutes' fatigue (DaggerfallGuildServiceTraining.cs). Training caps at
  50. Resting to clear the wait costs the time.
- **61 - fast travel and skills.** world.js's fast-travel tail calls raisePlayerSkills after the arrival clamp, as DFU's
  PerformFastTravel calls RaiseSkills; the gate is 360 classic minutes since the last pass (`advancement.js` raiseSkills).
  The wait is six game hours, not a short real-time timer.
- **75 - exhaustion.** DFU's PlayerEntity_OnExhausted: at 0 fatigue with no foe near you drop for an hour and recover an
  hour's rest; with a foe near you die (`worldTick.js`'s collapse, the hosts' 'spent' arm).
- **235 - Shock at range.** A custom Shock Damage Health at range lands its whole damage on main through `effects.js`
  applySpell (39 on an orc, traced); the reporter says it was fixed by their next build (#250). No commit between
  Update 0.0.392 and 0.0.404 touches the spell path, so the cause lay outside it (a target's immunity, a relay-run body) or
  in that build's world; nothing to fix.
- **33, 109 - the bow's visuals.** Field-Bugs-2026-10-19f #7 (`CHAIN-SEEN`): Chain Lightning's arc raises its own number
  since then (report 109's build predates its merge). An element's colour on a number and a Cast When Strikes visual are
  requests already recorded for the owner there: DFU's CastWhenStrikes assigns its bundle straight onto the target, with no
  missile.

## Items and loot (RPT1026-ITEMS)

| | Report | What it was | Done |
|---|---|---|---|
| 280 | Gear vanishes while identifying: a friend lost three or four of his best pieces in two days, and the reporter a chest piece | A trade counter takes the pieces you lay on it out of the pack until it closes. The online checkpoint (every five minutes, on a hidden page, at a title exit) saved the pack alone. A save written while the lot stood on the counter left those pieces out, and a session that ended before the next save came back without them | RPT1026-ITEMS HELD-OUT |
| 281 | Items identified at the Mages Guild disappear: an orange (Legendary) shield, a sword and armour over a couple of days | The same | RPT1026-ITEMS HELD-OUT |
| 213 | Legendaries identified and worn at the Mages Guild were missing after the client restarted for a new version (10-24) | The same. The last save that landed before the update was one written under the counter | RPT1026-ITEMS HELD-OUT (staff: notes) |
| 142 | A new character's pile asks for an update the client already has, or a take goes back to the pile within seconds and never reaches the pack | A dungeon pile's contents are computed by each client from the same dice, and the room's word carries their signature. A player on another build computes another signature. AUDIT SETS M2's line told the reader its own game was the old one even when the other player's was. The host, reading the joiner the same way, never judged that joiner's take, so the take went back after four seconds without a word. (A purse past 65,535 dropped into a pile was a second cause, fixed by GOLD-WIRE in 0.0.410) | RPT1026-ITEMS LOOT-SKEW |
| 264 | Some piles tell a client that is current, and was restarted, to update | The same | RPT1026-ITEMS LOOT-SKEW |
| 137 | The new Dremora's bodies vanish at death, leaving only a pool of blood and the loot; the pool can still be searched (written in Portuguese) | The new Dremora are Daggerfall Enemy Expansion's Dremora Churl (DEX, 10-20). The pool is BLOOD2c's corpse pool, and the loot is intact. Checked lane by lane: on the classic lane it dies into its row's own corpse picture (1708 record 25, the authors' picture of it lying), which the texture door carries, sizes and uploads; on the Morrowind lane it is Morrowind's dremora, laid in that body's death pose, with the flat under it casting only its shadow; and a body with no death to pose lets the flat draw. Neither lane lacks a body. The report's picture fits the Morrowind lane only if its body stands and draws nothing, and that lane needs Morrowind's own files to run (none here) | NEEDS DATA (the classic lane pinned: RPT1026-ITEMS DEX-CORPSE) |
| 265 | Corpses vanish as foes fall | In a dungeon room, the host's foes frame carries at most 32 of the room's encounters (rest ambushes, shared). The standing go first, and every body stays the room's while its corpse lies. Past 32, the cap cut the newest bodies off a full frame that still said it listed them whole, and every joiner took each new body down within seconds of its death. The report names no room; this is the cause the code has for exactly this, and it is demonstrated. AUDIT RPT1026 G1: the cap needs 33 of one visit's rest ambushes, the only shared encounters (one a broken rest), and the fix still lost one new body in ten there - the frame after its death the full one; now the newest dead go first | RPT1026-ITEMS BODY-CAP |
| 89 | In dungeons (small, medium, elite), after looting some bodies and then dying or leaving, two or three of the bodies have their loot again on return; played in a party | Walked in a real two-player room (the relay keeping the memory and the seat): the looter is the host or its level-2 partner, the seat passes while the looter is away, and the room empties. Nothing taken is offered twice. The way it was offered is CHAMP-BASE's (Field-Bugs-2026-10-25b, after the report). A champion body was rolled at each player's own level, so the low-level partner held the host's word about it unread. A memory the partner then wrote as the room's host left that body out, and the looter's next visit rolled it afresh: two or three bodies, the champions and the elite. With CHAMP-BASE's line taken out, the walk fails that way | ALREADY FIXED: CHAMP-BASE (pinned: RPT1026-ITEMS RE-ENTRY) |
| 257 | A magic axe was gone after a death to a boss the report names as a warden | AUDIT RPT1026 G3: the fight is the Sky Ketch's Tonal Warden, who stands at the ship's helm (`net/ketch/ketchDeck.js` KT_WARDEN_HOME); a death aboard is a fall with no death penalty (`11-Multiplayer/Sky-Ketch.md`), so it takes nothing. Each death door that takes a piece says so (a revenant's take in the wake box; an open zone's drop). Online keeps Allow Magic Repairs on, so a magic piece is never destroyed by breaking there. The character's saves around the death are what tell | NEEDS DATA |
| 277 | A two-handed Wyrmbane, worn to nothing in a hard dungeon, was gone from the pack | DFU's LowerCondition destroys a broken enchanted item that its own enchantment wore out unless Allow Magic Repairs is on. Wyrmbane's Cast When Strikes bills ten a blow. RARE-BREAK1's "breaks, not destroyed" had reached the fading only. AUDIT RPT1026 G2: but the report's dungeon was an elite one, a spawned dungeon, which stands online alone (`scenes/world.js` spawnedDungeonAt), and online the room forces Allow Magic Repairs on: that door kept every enchanted piece there before RARE-KEPT too. The piece went another way; its character's saves around the break are what tell | NEEDS DATA (RARE-KEPT stands, an offline hardening) |
| 222 | After a dungeon death to a daedra, most of the inventory and the rare leg armour were gone | A revenant took the piece; the reporter's later report (withdrawn, #227) says so. The take is said at the wake ("{name} took your {item}.") | AS DESIGNED |
| 132 | The Visor of King Lysandus does not say its material | DFU's Helm And Shield Metal setting (HelmAndShieldMaterialDisplay) defaults to classic, where a helm or shield never shows its metal (`itemInfo.js` armorShouldShowMaterial) | AS DESIGNED (tell: Settings, Helm And Shield Metal, On) |
| 289 | Potions brewed at the home alchemy station did not count toward a writ (it showed none brewed by the character) | The home station is a brew door since POTION-DOOR (968d9bd43, in 0.0.421); a writ counted only brews of gathered goods until ANY-GOODS (20de263c1, 10-26, after 0.0.421) | ALREADY FIXED: ANY-GOODS |
| 47 | Crafted leg and shoulder armour of several metals gives nothing at the Enchanting Station | PROF12's law: their template points (50, 40) make no Essence, and the station now says so | ALREADY FIXED: DISENCHANT-SAID (Field-Bugs-2026-10-19f row 19, this report) |
| 22 | Camping Equipment does not lose charges after a rest | REST2: a camp spends one charge a NIGHT its owner sleeps at it (`camp.js` spendCampNight), not a rest. The count rides the standing camp and is back on the item when it is packed | AS DESIGNED (tell: a charge a full night slept beside it) |
| 140 | A Campfire's and a tent's uses go up on their own, perhaps from ambushes at night | A night spends one charge (spendCampNight), and a night an ambush breaks spends none (`shared.js` restNight), which reads as a charge kept. Only Firewood the player feeds adds any (three nights). Placing carries the item's charges, and packing returns what is left | NOT REPRODUCED |
| 65 | Harpies drop Gryphon feathers, not Harpy Feathers; Twigs are too rare | The Harpy's loot theme is DFU's Gryphon's Feather (`lootThemes.js`, an alchemy ingredient). Harpy Feathers are a Hunting skin, from rank 5 (`professionLaw.js` hide:harpy). Twigs are an herb of Herbalism's tables, not a woodcutting yield | AS DESIGNED (the Twigs' rate a design question for the owner) |
| 177 | About 40 teleport stones gone at a login (written in Spanish) | No path found that takes Portal Stones from a pack at a login. The character's kept saves say when they left | STAFF |
| 173 | Did not receive all the items (written in Portuguese) | Nothing to trace: no place, no items, no source | NEEDS DATA |

### RPT1026-ITEMS HELD-OUT (280, 281, 213) - `src/systems/item/heldOut.js`, `src/systems/save/save.js`, `src/ui/native/nativeTrade.js`, `src/ui/enhanced/enhancedTrade.js`

WHAT DFU DOES. DaggerfallTradeWindow.TransferItem moves a piece the player lays on the counter out of the player's
collection into the window's own (`remoteItems`). ClearSelectedItems puts back whatever is still there when the window
closes. An Identify, a sale or a repair works on that lot. DFU saves only from its pause menu, never with the window
open, so no save is ever written while pieces are on the counter.

WHAT THE PORT DID. Both counters follow DFU (D7). The classic one is `NativeTradeWindow.staged`; the enhanced one is
`enhancedTrade.js`'s module `staged`. Online, the realm checkpoints wherever the player stands: every
ONLINE_CHECKPOINT_MS (five minutes), when the page is hidden, at a title exit and at each trade change.
`snapshotPlayer` wrote the pack alone, so a checkpoint while a lot stood on the counter wrote the character without it.
When the session went on, the next save brought the pieces back. The ledger let them go and took them up again as new
keys (`ledger.js` letGoSteps, then `fresh`). When the session ended before that next save landed (a crash, a quit, an
update's reload, as in #213), the realm's record was the one without the lot. Identify is the counter a
player leaves pieces on longest. The reports' pieces were Legendaries and their best gear, the pieces worth
identifying.

FIXED. A counter's staged lot is still the player's, and every save holds it.
- `heldOut.js` (a leaf, no imports): `holdOut(entity, items)` registers a reader of a counter's staged lot for one
  entity and returns its release. `heldOutOf(entity)` answers the held pieces that are not in that entity's pack.
- The classic counter holds `this.staged` from its constructor
  (`nativeTrade.js:"this._releaseHeld = holdOut(hooks.entity, () => this.staged);"`) and releases it in `_close()`,
  after `_clear()` has put the lot back. A host's teardown (`dispose`) runs `_close`.
- The enhanced counter holds `staged` at mount
  (`enhancedTrade.js:"releaseHeld = holdOut(hooks.entity, () => staged);"`) and releases it at unmount, after its clear.
- The save writes the lot at the pack's end
  (`save.js:"snap.items = [...(entity.items ?? []), ...heldOutOf(entity)].map((it) => ({ ...it }));"`). It goes at the
  end so that the equip table's places in the pack are unchanged. A piece already back in the pack is written once.
- A Buy's basket is the shop's (`basket`, never `staged`) and is never held. A sale empties `staged` when it pays, so a
  sold piece is never written.

THE FOUR HOSTS. The counters are opened by `worldModes.js` (shops, guild halls' Identify, Sell Magic and Repair,
`openTradeWindow` through `ui/tradeDoor.js`), and - AUDIT RPT1026 G4, where this said a dungeon or the open world
opens none - the Identify SPELL opens one wherever it is cast: `worldModes.js` openIdentifyWindow in the street (the world
host's slot) and underground (the dungeon's), and `dungeonContext.js` openIdentifySpellWindow in the standalone dungeon.
The hold rides the window, so every one of them holds its lot as a guild's counter does. The save is one door
(`snapshotPlayer`) for every host. No host grew.

THE WORDS. None.

FOR THE REPORTERS (staff). A piece lost this way is in the save written before the counter opened. The realm keeps the
current save (`obj`), the one before it (`prev`) and the last clean one (`clean_obj`) on `realm_characters`. A piece is
recoverable while one of those still holds it. Staff's rollback (`/v1/staff/rollback`) restores the clean one.
Staff's item give (`staffGive.js`) mints from templates and the item maker's enchantments, so it cannot give a
Legendary back. Notes, (b).

PINS. `test/systems/rpt1026_items.test.js` (three of its four): through the real counters, a legendary laid on the
classic counter (its slot pressed), identified (the mode's hotkey) and in the save while the window stands, then back
in the pack once at Escape. The judge's own `ledgerPieces` reads the save's keys. A save written under the counter
restores the piece. The enhanced counter is driven the same way (a row double-clicked, unmounted). A counter holds
only its own player's goods, and a Buy's basket is never written. Mutants: 4. AUDIT RPT1026 G5: "a piece already back
in the pack is written once" had no pin that could fail - every pin asked after the counter had closed and let go, and
a mutant reading the held lot without the pack lived through them all. Pinned over a counter handed a selection of the
pack (`nativeTrade.js` localList's F102 shape: the staged piece still in the pack), its save and its load
(`test/systems/audit_rpt1026_items_heldout.test.js`).

### RPT1026-ITEMS LOOT-SKEW (142, 264) - `src/systems/roomLoot.js`, `src/scenes/roomLootHost.js`, `src/scenes/dungeonContext.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no shared loot.

WHAT THE PORT DID. A dungeon pile's or a body's base is every client's own computation from the room's seeded dice
(PARTY-LOOT). The room's word carries the base's signature (`h`). When a live peer's signature differs from this
client's (`roomLootHost.js` landRoomWord), the container is marked unreadable. The press then said AUDIT SETS M2's line,
`systems/loot/loot.js:"export const LOOT_NEWER_TEXT"`.
But a signature differs whenever the two clients run different loot code. That happens with any build apart: a page
open since the last update, or a desktop copy not restarted. The older build is as often the other player's as the
reader's, and the line told a current player that their own game was the old one. The host reads a joiner on
another build the same way and never judges that joiner's claims. So a take from such a pile lapsed after
ROOM_CLAIM_TIMEOUT_MS (four seconds) and went back to the pile in silence, which #142 saw as the pile refilling. GOLD-WIRE
(0.0.410) had already fixed one other cause, a purse past 65,535 dropped into a pile.

FIXED. The press says what the reader can know, and a lapse says that it lapsed.
- The live-peer mismatch marks the container as skewed (`_roomSkew`). A word this build cannot read at all clears the
  mark, whether it is a room word (`unreadableWord`) or an older build's list (`landLegacyList`), because a piece no
  build of this one reads is M2's case.
- `roomLootHost.js:"const roomUnreadableText = (canon) => (_roomSkew.has(canon) ? LOOT_SKEW_TEXT() : LOOT_NEWER_TEXT);"`
  is what the dungeon's press says
  (`dungeonContext.js:"setMidScreenText(roomUnreadableText(lootKeyOf(_u)));"`; one expression, so the host does not grow).
- A lapsed claim says ROOM_LAPSED_TEXT as its piece comes back (roomClaimTick).
- Mixed builds still share a room. No relay law keeps them apart, and the pile opens once both players are on one build.

FLAGGED. A building's cupboard and a street's bodies (OUTDOOR-LOOT) keep M2's line. The same law applies to them, but
they were not changed here.

THE FOUR HOSTS. `dungeonContext.js` presses the room's containers, and only its press reads the skew. `exterior.js`'s
outdoor containers are FLAGGED above. `world.js` and `worldModes.js` hold no room containers.

THE WORDS. Two new lines through the text core (`roomLoot.js`): `loot.room.skew` "Another player here is on a different
version of the game, so this can't be opened until you are both on the same one." and `loot.room.lapsed` "That take
was not confirmed in time, so the item is back where it was." The 13 whole languages are drafted.

PINS. `test/scenes/rpt1026_items_skew.test.js` (2), through the real room module (`createRoomLoot`) for clients over one
pile. The host mints the pile and says its word, and a client on the same build lands it. A client on another chain
finds it unreadable and is told the two sides differ (never "newer", "older", "update" or "Reload"). A word holding a piece
no build of this one reads keeps M2's line, and so does an older build's list holding one, even after a skew. A take no
host answers comes back at ROOM_CLAIM_TIMEOUT_MS and is said, and nothing is said before then. PIN MOVED:
`fb1016b_graveparty.test.js` (the destructure), `auditsetsonline.test.js` (the press's regex). Mutants: 6. Five records
in `auditsetsonline.json`, `fb1016b_graveparty.json` and `partyloot.json` were re-aimed by content, all dead.

### RPT1026-ITEMS RARE-KEPT (277) - `src/systems/enchantments.js`

WHAT DFU DOES. Every enchantment payload's wear goes through DaggerfallUnityItem.LowerCondition with the wearer's
collection: Cast When Strikes' ten a blow (CastWhenStrikes.cs), Cast When Held's equip bill, Item Deteriorates, and a
used item's durability. That collection arm REMOVES a broken piece unless the Allow Magic Repairs setting is on. Combat
wear passes no collection and keeps the husk.

WHAT THE PORT DID. The same (`enchantLowerCondition`). Online forces Allow Magic Repairs on, and the port's offline
default is on, so the door was open wherever a player had turned it off. RARE-BREAK1 (the owner, 2026-09-25: "Rarity
loot breaks, not destroyed") had reached the overhaul's fading only (`combat/pcaao.js` pcaaoFades). A Legendary's own
enchantment is DFU's: Wyrmbane rolls Cast When Strikes, so its own blows wore it out and destroyed it.

FIXED. A piece the rarity ladder stamped (`rarityTier.js` stampedTier: Magic, Rare, Legendary, Aetheric, Gilded)
breaks at that door as a blow breaks it. It says "has broken", is taken off, and stays, repairable
(`enchantments.js:"if (broke && !stampedTier(item) && !(ctx?.allowMagicRepairs ?? false))"`). DFU's own enchanted items
(MAGIC.DEF's, the item maker's, soul-bound) keep DFU's law. A departure: Port-Ledger A, RARE-KEPT.

AUDIT RPT1026 G2: NOT THE REPORT'S CAUSE. The report's dungeon was an elite one - a spawned dungeon, which stands on an
online page alone (`scenes/world.js` spawnedDungeonAt) - and online the room forces Allow Magic Repairs on
(`onlineLane.js` ONLINE_FORCED_SETTINGS), which the host's mounted ctx reads (`hostEnchant.js` createEnchantCtx). So this
door kept every enchanted piece at its break online before RARE-KEPT as after it; it opens only offline, under a
player's own Off. RARE-KEPT stays as that hardening, and #277 is NEEDS DATA: the character's saves around the break.
Pinned: `test/systems/audit_rpt1026_items_kept.test.js` (online, DFU's own magic axe is kept at its break whatever
the store holds).

THE FOUR HOSTS. The dispatcher is one door for every host. No host changed.

THE WORDS. None: the break says DFU's own "has broken" (lowerCondition).

PINS. `test/systems/rpt1026_items.test.js` (one of four): Wyrmbane on a Battle Axe, struck through the real dispatcher
with Allow Magic Repairs off, breaks, is said, comes off the doll and stays. A DFU magic axe from a MAGIC.DEF row is
consumed as DFU consumes it. PIN MOVED: `weaponpool.test.js` counts strikes to the break, not to the piece leaving the
pack (160, as before), and checks that the piece is kept. Mutants: 2, and `weaponpool.json`, `auditweaponpool.json`
and `mend_third.json`'s 30 records that name `weaponpool.test.js` are all dead.

### RPT1026-ITEMS BODY-CAP (265) - `src/scenes/dungeonContext.js`

WHAT DFU DOES. Nothing to follow: Daggerfall has no shared room.

WHAT THE PORT DID. A dungeon room's encounters (a rest's ambush, a joiner's rest's ask) are the room's: the host stands
them shared and streams them on its foes frame, SHARED_FOES_MAX (32) a frame, the standing first (REST-SYNC). A body
stays the room's while its corpse lies, so a room that rests often keeps every ambush's body. A full frame says `xf`
when it lists them all, and a joiner then takes down every puppet the frame does not name (the host forgot it, a
Destroy()ed one). The frame still said `xf` when the COUNT cap had cut the list: the test was the byte room alone.
Past 32 encounters, the newest bodies fell off the end, and every joiner took each new body down at the next full
frame (FOES_FULL_MS, two seconds): a body gone moments after its foe fell, on every screen but the host's.

FIXED. A full frame the count cap cut says `xf` 2: whole for the standing alone
(`dungeonContext.js:"frame.xf = shared.length < _sharedById.size ? XF_STANDING : XF_WHOLE;"`). A joiner reads 2
(`applySharedRecords(..., data.xf === XF_WHOLE || data.xf === XF_STANDING ? data.xf : 0)`, its own test `full ===
XF_STANDING` - AUDIT RPT1026 M5: it was the literal 2) and keeps a body the frame does not name,
while a standing puppet the host no longer has still goes. An older build, which reads 1 alone, takes nothing down
from such a frame. Three expressions changed, no statement added: the host does not grow.

AUDIT RPT1026 G1: AND THE NEWEST DEAD FIRST. The frame named the bodies in the room's numbering, the oldest first, so
the body the cap shed was the one that had just fallen. Its death rode a delta alone (a delta counts only what changed),
and when the frame after the death was the full one (FOES_FULL_MS over FOES_MS: one in ten), the joiner's puppet still
stood there, went as a standing puppet the frame did not name, and the death's record that followed named an encounter
the joiner no longer held - "a body never seen standing" stands nothing. The bodies now go newest dead first
(`dungeonContext.js:"sort((a, b) => (a.dead ? 1 : 0) - (b.dead ? 1 : 0) || (a.dead ? (b._diedAt ?? 0) - (a._diedAt ?? 0) : 0))"`,
spawnCorpse's `_diedAt`), so the cap sheds an old body every joiner has held dead for a while, and keeps. The cap is
reached only by 33 of one host's visit's rest ambushes (a rest's ambush is the only shared encounter, one a broken
rest). A body the host forgets while the room is past the cap stays on a joiner until a frame is whole again.
Pinned: `test/net/audit_rpt1026_items.test.js` (the death through the context's own corpse door, the full frame
first).

THE FOUR HOSTS. The shared encounters are the dungeon's alone (`dungeonContext.js`). `exterior.js`'s cells carry each
owner's own foes (WORLD6b), and `world.js` and `worldModes.js` forward the frame unread.

THE WORDS. None.

PINS. `test/net/rpt1026_items_bodycap.test.js` (2): the context's own frame statements, mounted as restsync's
harness mounts them. A host with 2 standing encounters and 33 bodies says 2. A joiner holding all 35 keeps every body,
and none is taken down. A frame within the cap is whole (1). A standing puppet the host no longer has is taken down
under 2, and a word the joiner does not know takes nothing down. PIN MOVED: `restsync.test.js`'s source regex for the
joiner's call. Mutants: 3, and `restsync.json`'s three records re-aimed by content, all dead. AUDIT RPT1026 G6: the
pin said for an older build sends `xf` 3, a word no build says - it holds the unknown word to nothing taken down, not an
older build's reading (that is the older build's own `=== 1`); its words say so now.

### RE-ENTRY (89) and DEX-CORPSE (137) - checks, no code change

- RE-ENTRY: `test/scenes/rpt1026_items_reentry.test.js` (4). A real two-player room: the relay's Room over
  `test/fakeRoom.mjs` keeps the memory and names the seat, and the two players' act frames go to each other in order.
  Each player is the dungeon host's own doors (the kill, the corpse, the room's loot block, the quick door, the seat,
  the memory out and in) over the real producers, at CHAMP-BASE's layout (two champion marks of six), with a
  level-12 host and a level-2 partner. Four walks:
  - the host loots three bodies, dies (the death screen's farewell), and the seat passes to the partner;
  - the partner loots and walks back in under a memory older than its takes, which shows the pieces again; the host
    refuses each press, and its answer empties the body;
  - the partner loots, and the host leaves too;
  - the host loots, the partner hosts, and the partner leaves.
  Each time, the pack and purse stay what one emptying made them. Mutants: 3 (CHAMP-BASE's line taken out: all four
  fail; the memory without its words; a taken piece granted again).
- DEX-CORPSE: `test/systems/enemyExpansion/rpt1026_items_dexcorpse.test.js` (1). Through the real install and texture
  door, the Dremora Churl's row names its corpse, and the stand-in carries, measures, sizes and uploads it. The row's
  Morrowind body is the dremora. Mutants: 2.

### The rest

- **222 (AS DESIGNED).** The triage reads the reporter's withdrawn #227: a revenant had taken the leg armour. A
  revenant's kill takes one piece online, and the respawn says it (`revenant.js` revenantTakes, "{name} took your
  {item}.", said by `world.js`'s and `worldModes.js`'s respawns; `12-Enhanced-AI/Feud-Arc.md` 19). The piece is on the
  revenant, and beating it gets the piece back.
- **132 (AS DESIGNED).** `itemInfo.js` armorShouldShowMaterial is DFU's ArmorShouldShowMaterial over
  HelmAndShieldMaterialDisplay, whose default (`settingsDefaults.js`, "0") is DFU's classic: a helm or a shield never
  says its metal, and MAT-SHOW's sub-line keeps that gate (`gearMaterialText`). Tell the player: Settings, Helm And
  Shield Metal, On.
- **289 (ALREADY FIXED).** POTION-DOOR (968d9bd43, 10-25) made a home's alchemy station a brew door. ANY-GOODS
  (20de263c1, 10-26, after the reporter's 0.0.421): "A potion writ counts every brew a station made for the character
  ... Brews of looted or gold-bought ingredients count, and so do brews from before the column." The reporter's four
  count now.
- **47 (ALREADY FIXED).** Field-Bugs-2026-10-19f row 19 is this report: DISENCHANT-SAID, the owner's call (the points
  law stands, and the station says why).
- **22 (AS DESIGNED).** A Campfire's fuel and a tent's wear go one a night slept at your own lit camp within reach
  (`camps.js` spendNightNear, from `shared.js` restNight's `onNightSlept`). A short rest, a night an ambush breaks, a
  Field Cook's own Campfire (PROF9's) and a night in a bed spend none. Tell the player that.
- **140 (NOT REPRODUCED).** Traced every write of `camp.wear`. spendCampNight counts it down, one a night. Firewood
  (`camps.js` feedFire) adds FIREWOOD_NIGHTS (three) when the player feeds it, up to the Campfire's cap.
  `placeCampItem` carries the item's charges onto the camp, and packing (`packCamp`) returns what is left. A night
  broken by an ambush (`result.enemyBroke`) spends nothing, which is what an ambushed night looks like. No path adds a
  charge on its own.
- **65 (AS DESIGNED).** `lootThemes.js` gives the Harpy DFU's Gryphon's Feather (a flying, feathered thing's
  ingredient). Harpy Feathers are Hunting's skin of a Harpy from rank 5 (`professionLaw.js` hide:harpy, read by the
  arrows' recipe in `recipeLaw.js`). Twigs are an herb (nodeLaw HERB_TABLES). Whether Twigs should come more often is
  the owner's call.
- **177 (STAFF).** No code path found that empties a stack of Portal Stones (template 572, a bound piece) at a login.
  Staff: read the character's kept saves (`prev`, `clean_obj`) for the stack. Roll back to the clean one if it holds
  the stones and nothing since matters, or give them with the item give (a bound piece, so check the preview's
  findings first).
- **137, 257, 173, 277 (NEEDS DATA).** See the rows (277 by AUDIT RPT1026 G2). For each, the character, the time and the place let staff read the
  saves around it. For #137, whether a Morrowind folder is set and a picture of the spot.

## Quests (RPT1026-QUESTS)

| | Report | What it was | Done |
|---|---|---|---|
| 111 | The Lost Artifact shared in a party: the sharer's copy done with no reward, the partner's never done, and neither can take another order quest | B0B81Y02's knight pays with `give pc nothing` and `remove log step 0`, and the quest runs on under `_2dung_` (its 30-day wait, closed on the short wait online since RAVEN-CLOSE, which also pays both copies the outcome's gear). A running quest whose questor is the NPC clicked shuts the guild's door (DFU's law), and a quest with nothing in its journal was no row of the Quests tab, so there was nothing to abandon | RPT1026-QUESTS ABANDON-ALWAYS |
| 112 | The same shared quest: every objective crossed out, the order's questor still asks for it | The same | RPT1026-QUESTS ABANDON-ALWAYS |
| 113 | The same: cannot abandon it, the order locked to both | The same | RPT1026-QUESTS ABANDON-ALWAYS |
| 43 | The Lost Artifact: the lich dropped no letter, the quest not archived, and the order says "the service isn't available yet" | The door shut by the running quest, with no row to abandon (the words were QUESTOR-SAID's, fixed 2026-10-19f). The letter's drop: the script gives it on the lich's own death in its own dungeon, never a Public room's - not reproduced | RPT1026-QUESTS ABANDON-ALWAYS |
| 145 | Knights of the Dragon: "you already have one" after a quest was turned in, and nothing in the log to abandon | The same quest's shape | RPT1026-QUESTS ABANDON-ALWAYS |
| 183 | The Mages Guild says no more quests can be taken, and none are listed | N0B21Y14 writes its first journal entry only when its letter is read; until then it holds the questor's door with no row | RPT1026-QUESTS ABANDON-ALWAYS |
| 203 | Two quests' NPCs at one place: one hides the other, and abandoning one does not bring the other back | The intro questlines' contacts are `local` Persons in a `local tavern`. Two quests parsed before either starts take one building (DFU's GetAllActiveQuestSites reads only running quests), and most taverns lay one spawn marker: both Persons stood on it, one billboard over the other | RPT1026-QUESTS QUEST-CROWD |
| 84 | A Hand of Cards and Raiders at the Gate both sent to one tavern; neither contact found | The same, measured on the real data: Rhaneraza's "The Pig and Mug" lays one spawn marker | RPT1026-QUESTS QUEST-CROWD |
| 128 | The Long Haul: the contact missing from the named inn | The same | RPT1026-QUESTS QUEST-CROWD |
| 151 | The town raid's questline: the contact missing from the named tavern | The same | RPT1026-QUESTS QUEST-CROWD |
| 221 | Raiders at the Gate: the contact missing (written in Russian) | The same | RPT1026-QUESTS QUEST-CROWD |
| 95 | Lord K'avar part 1: after No to the Queen of Sentinel's letter prompt, she never speaks of it again | M0B11Y18's No hands the letter back (`get item`); the prompt is spent and the asking click a set task's, so nothing asks again - DFU's own soft-lock, which NO-ASKS-AGAIN's inert and clearing Nos did not cover | RPT1026-QUESTS NO-GIVES-BACK |
| 67 | A vampire quest's lair in the middle of the open zone, its door sealed (written in Russian) | Online every dungeon inside the open zone is sealed but for the day's halls, and a quest's remote dungeon was drawn among them | RPT1026-QUESTS QUEST-ZONE |
| 209 | The arena questline: after one bout the next Fight loads no opponent | The next Fight past `CLIMB_WAIT_MS` entered the floor for the step just fought while that bout's receipt was still with the service; the floor's own guard then let the bout go | RPT1026-QUESTS ARENA-ORDER |
| 229 | Arena: "not your next bout" and no opponent after a bout; sometimes the day's progress reset | The same; the reset is the climb's law - a loss breaks the tier's run, and a ticketed bout walked away from counts as lost (AUDIT ARENA-LADDER) | RPT1026-QUESTS ARENA-ORDER |
| 127 | After becoming Grand Champion the game crashed in the undercroft; on return most of the gold was gone and the Herald will not offer a fight | The Herald's "ladder done" is the climb's end (40 bouts). The purses are paid into the character, which the realm keeps at its checkpoints; a crash before the next one loses what came after it. The account service keeps the title | NEEDS STAFF (restore the gold from the arena's record) |
| 226 | The Dark Brotherhood's invitation never comes | Fixed for new cases (329a05516); this character's invitation was consumed by the failed start | NEEDS STAFF (Staff Panel, fix letter: guild `db`, op `send`) |
| 141 | A bounty's rats in Privateer's Hold did not count in a private instance | Driven in the real game on the freeware's data: the new game's own start into the Hold, a board's Hold hunt held (Ripidge's, 3 rats) - the pack stood past the layout's 42 foes at the Hold's quest marker, each kill counted (1, 2, 3) through the dungeon's own damage door, and the last paid the purse and the piece. A hunt counts only the beasts it stands; the Hold's own rats are not them. Online a private instance stands the pack the same way: with nobody else in the room the grant law lets the stand go ahead (GRANT-SLEEP, kept since world261), and the instance builds the dungeon whole | NOT REPRODUCED |
| 215 | A bounty's orchard rats never appeared | Driven in the real game on the freeware's data (Charengate's board, an orchard hunt of 4 rats, the hunter walked onto its pixel): the farm stood 330 to 350 metres from where the hunter came onto the pixel, the way to it was said ONCE on the screen among the arrival's own lines, and walked, the four rats stood ("You spot 4 Rats, 111 meters to the north!"). The way was kept in the journal for a split hunt alone, so on a hunt of one group a hunter who missed the line had nothing to go on and no rat within 150 metres; the tutorial sent hunters back for a purse the last kill pays | RPT1026-QUESTS BOUNTY-WAY |
| 166 | Quest guidance no longer shows the target in a dungeon | The same reporter's public-instance case (168): a public room laid smaller stands none of a quest's things | AS DESIGNED (QUEST-FIRST, 70d9210c4, now lists Public last) |
| 167 | Quest tracking no longer shows on the world or dungeon map | The same | AS DESIGNED (QUEST-FIRST) |
| 168 | A Mages Guild quest's mummy and NPC absent from the dungeon's public instance | The same | AS DESIGNED (QUEST-FIRST) |
| 182 | Quests sometimes cannot be done in a dungeon's public room; the own instance works | The same | AS DESIGNED (QUEST-FIRST) |
| 87 | Six side quests arrive by notification long before their letters | Fixed since the build it was sent from | ALREADY FIXED (FB1020c LETTER-PACE; QL-OFFERED 72e85b169, 6029646b2) |
| 150 | The witches' Daedra's heart: the heart taken, the turn-in says not done | Fixed since the build it was sent from | ALREADY FIXED (FB1025i HEART-KEPT, 89fe2a775) |
| 254 | Written in the Stars asks for a birthsign already chosen | Fixed since the build it was sent from: the Firmament panel names a birthsign accepted outside the window | ALREADY FIXED (FIRM-SIGNPANEL, 54d046056) |
| 1 | Twelve Mages Guild quests in Daggerfall, no gold | The guild's errands for a non-member (N0C00Y10 to N0C00Y13) end `give pc nothing` - they earn the standing to join; a member's pay gold or an item | AS DESIGNED |
| 19 | Mages Guild standing keeps dropping while quests are done | Online a guild's standing rises at most fifteen a day (OWED-PACE: the rest is owed and credited on the days after) and a loss lands in full; some outcomes cost the guild standing by the player's choice | AS DESIGNED |
| 54 | A smuggling quest's contact vanished after the ambusher fell | K0C00Y03's own script hides the contact (FIELD BUGS 2026-10-19f) | AS DESIGNED |
| 165 | A questgiver refuses directions to the quest's own person ("I despise you"); nobody in town knew where a courier's target was | Daggerfall's talk law: what an NPC tells depends on their reaction to the player (TalkManager GetReactionToPlayer), and a quest person's whereabouts are known only as the script lets | AS DESIGNED |
| 175 | The Artifact: the child returned, and in the second dungeon a knight asked for the child; Yes ended the quest | B0B71Y03 sends the knights and battlemages after the child for up to five waves, and an injured one asks for her back; Yes ends the quest by the script (DFU's own). The progress asked back is a staff restore | AS DESIGNED |
| 176 | The Thieves Guild: "unheld" everywhere, no chapter to take quests from | "Its Charter is unheld" is the town's seat line, not the guild's. The Thieves Guild's halls are hidden, revealed on a town's map to a member as DFU reveals them (RevealGuildHallOnMap), in the towns whose blocks hold one | AS DESIGNED |
| 256 | Banish Daedra failed by killing the daedra; abandoned, taken back, the failure is still written | A Reclaim brings back the quest set aside as it was, its failure included; a new quest from the guild starts with fresh objectives (each quest stamped anew) | AS DESIGNED |
| 20 | A Fighters Guild quest to kill a creature in a tavern will not turn in, and no new quest | M0B00Y07 owes the kill and then the click; either beast's death counts. Nothing found that holds a done one; Abandon is the way out | NOT REPRODUCED |
| 40 | Knights of the Dragon quests in Daggerfall give standing for Bergama | The order's faction is Daggerfall's (FACTION.TXT region 18, one-based); the regional standing a knightly script moves is `change repute with _local_`, the People of the region the quest was parsed in. Bergama is no ally of either | NOT REPRODUCED |
| 44 | The Mummy's Finger: clicking the sage with the finger does nothing | A0C41Y18's sage takes it on `have _finger_` at the click; the finger is a quest item that never stacks (`inventory.js` isStackable) | NOT REPRODUCED |
| 148 | A Great Errand's fairy dragon scale picked up and not counted (written in Russian) | Q0C10Y00's objective is done on the item carried or clicked, and a quest item never stacks into the pack's own ingredients | NOT REPRODUCED |
| 157 | Azimuthal Vectors: after the scholar's errand and teleport, the item is not found in the cavern and the map marks nothing | The cavern is the catalogue's dungeon, and the quest moves only when the catalogue is READ (the cousin's map reveals where the item is). The journal's step crossed the catalogue off when it was picked up, so a player who found it before the errand was sent back to an emptied dungeon with no step naming the letter in the pack | RPT1026-QUESTS CATALOG-READ |
| 250 | Azimuthal Vectors: on the dead end the Guildmagister never pays for the trouble and the player is sent back | The same: the dead end pays once its catalogue page has been read (`_I.03_ used do _S.16_`), and nothing said so | RPT1026-QUESTS CATALOG-READ |
| 161 | Hidden quests show no text, no Track and no Abandon | Driven through the pause window: a hidden quest under Show hidden draws its entries, Track, Abandon and Unhide | NOT REPRODUCED |
| 262 | Directions to a quest's house said to be marked on the map show nothing | Asked through the real TopicTree and AnswerPipeline on the freeware's Daggerfall (classic and both town packs), both ways a player asks - the person, and the house itself in Where Is's General list: the residence, undiscovered before, is discovered under the quest's name and its plate stands on the town map (18 of 18 draws, 12 asking the person and 6 the house). The host files it under the key the town map reads (`region index:location name`, both sides). STAR-PLATE and STREETS-TAB (FIELD BUGS 2026-10-20c) shipped before this build; a building already found is not marked again (DFU's) | NOT REPRODUCED |
| 212 | Prince Lhotun only makes a noise after his letter | His letter is the main story's director's own (S0000999 `_S.45_: when _S.14_ and _S.15_` - a standing of at least 0, level 5 done), and S0000001 starts on `_S.40_: when _S.00_ and _S.14_ and _S.15_`: a player holding the letter has both. What stands between them is `_S.00_`, `when Prince_Lhotun is available` - his own click while no running quest holds a Person of his faction (WhenNpcIsAvailable; a quest set aside holds none); until then his click is his own. AUDIT RPT1026 H3: this row said "likely a character below level 5", which the letter itself rules out | NEEDS DATA (the character's running quests that hold a Person of Prince Lhotun's faction, 382, and its S0000999 and S0000001 state after a click on him) |
| 230 | Disconnected just after accepting Morgiah's step to the King of Worms; the quest is gone and Morgiah will not talk | The accept fell between the realm's checkpoints | NEEDS STAFF (read the character's S0000004 state; restore, or STORY-AGAIN once it has ended) |

### RPT1026-QUESTS ABANDON-ALWAYS (111, 112, 113, 43, 145, 183) - `src/systems/quest/machine.js`, `src/scenes/quest/questBridge.js`, `src/ui/enhanced/enhancedMenu.js`

WHAT DFU DOES. A guild's and a coven's quest door close on IsLastNPCClickedAnActiveQuestor
(`DaggerfallGuildServicePopupWindow.cs` GetQuest): no new quest from a questor whose quest still runs. DFU's journal
lists a quest by its log messages, so one that has written none is nowhere, and DFU has no abandon at all.

WHAT THE PORT DID. QUEST-SHELF gave every quest an Abandon, but only from a row, and the bridge's walk made a row of a
quest with nothing written only when it was a stamped quest with objectives; AUDIT QUESTLINES UI-8 then drew no Abandon on
such a row. B0B81Y02 (The Lost Artifact) answers the lich's death with `give pc nothing` and `remove log step 0` and runs
on under `_2dung_`; N0B21Y14 writes its first entry only when its letter is read. Both held the questor's door with no
row: the guild shut, and nothing to abandon. Driven on current main with two machines sharing the quest, the sharer and
the partner both close on the short wait and both get the outcome's gear (RAVEN-CLOSE, FIELD BUGS 2026-10-21d): the
reward and the long wait the reports met are already gone; the lock was not.

FIXED. `machine.js:"export const holdsQuestorDoor"` names a running quest that holds the door - a Person its
questor by the click, the one lastNPCClickedQuestorOf asks of. Each is a row
(`questBridge.js:"if (!ql?.objectives?.length && !holdsQuestorDoor(q)) continue;"`), its Abandon drawn
(`ui/enhanced/enhancedMenu.js:"} else if (sel.entries && sel.id != null && clean.abandon && clean.canAbandon?.(sel.id)) {"`), its
detail "Nothing is written in your journal for this quest yet." where it has no objectives, and once set aside an
Abandoned row with its Reclaim. The questor's close adds a row under the work: "If you cannot finish it, you can abandon
it from the Quests tab of the pause menu." A quest with nothing written and no questor the player met (the main story's
backbone, a letter's errand) stays off the tab. Port-Ledger A, QUEST-SHELF's row, widened.

THE FOUR HOSTS. None grows: the bridge's walk and the pause window are read by every host.

THE WORDS. `quest.offer.questorBusyAbandon`, `pause.journal.unwritten`, drafted in the thirteen whole languages. AUDIT
RPT1026 H2: on the classic skin the close named "the Quests tab of the pause menu", which DFU's classic pause window
lacks (AUDIT QUESTLINES UI-6's own defect); there it says UI-6's way - Controls, then Escape, then Quests
(`quest.offer.questorBusyAbandonClassic`, drafted in the thirteen).

PINS. `test/systems/quest/rpt1026_quests.test.js` (3 of 10: the paid-and-unwritten quest through the real bridge and the
pause window's Quests tab - its row, its note, Abandon twice, the hall's door open, the Abandoned row, the Reclaim; what
is not a row; the close's two rows in French). PIN MOVED: `test/systems/quest/fb1019f_questorsaid.test.js` (the close's
second row), `test/ui/questlines/ql2_pause.test.js` and `test/systems/quest/questshelf.test.js` (UI-8: an entryless row
offers Abandon), `test/systems/quest/questbridge.test.js` (the lifted walk handed holdsQuestorDoor). `tools/mutants/ql2_ui.json`:
AUDIT-QL-UI-8-abandon-on-an-entryless-row retired (its old text is the fix). Mutants: 7.

### RPT1026-QUESTS QUEST-CROWD (203, 84, 128, 151, 221) - `src/systems/quest/sceneMount.js`, `src/scenes/worldModes.js`

WHAT DFU DOES. Place.cs draws a building for `local tavern` among those no active quest holds, and GetAllActiveQuestSites
reads only the running quests; GameObjectHelper.AddQuestNPC stands a Person on a marker drawn at random, whoever stands
there.

WHAT THE PORT DID. Before QL-OFFERED (2026-10-25) the intro questlines started their lines' first steps together; two
quests parsed before either started took one tavern. Of Daggerfall's 345 tavern interiors 215 lay one spawn marker, so
both contacts stood on it, one billboard inside the other: one clicked, the other never found. Measured on the real data:
Rhaneraza's "The Pig and Mug", one spawn marker and two item markers. FB1020c CROWD-CLEAR moved a Person off a resident,
not off another quest's Person, and with no clear marker it kept DFU's stand.

FIXED. Another quest Person already stood in the room crowds as a resident does
(`sceneMount.js:"export function crowdOf"` - drawn, standing, a Person's, never the
asker's own), and with no spawn marker clear the Person stands beside its own: the first of eight spots a box out (then
1.6 boxes) on the same floor within 0.3 m, in plain line at waist height and clear of everyone
(`sceneMount.js:"export function besideSpot"`); none, DFU's marker. Its layout data stays
the drawn marker's. Port-Ledger A, QUEST-MARKERS' row, widened.

THE FOUR HOSTS. `worldModes.js` standQuestFlatIn's one logical line (CROWD-CLEAR's) hands the stands: no growth. world.js
and exterior.js are served by it; dungeonContext.js stands quest people on Daggerfall's RDB markers, unaffected.

PINS. `test/systems/quest/rpt1026_quests.test.js` (3 of 10: two quests through the real parser and machine taking one
house, the second at its other marker and, with one marker, beside; besideSpot against a table, a wall, a ring and no
floor; crowdOf's skips). PIN MOVED: `test/systems/quest/fb1020c_crowdclear.test.js` ("none clear" now beside). The reach is `QUEST_BESIDE_REACH`
(`partyTravelLaw.js`'s BESIDE_REACH is another law - `audit24_onehome.test.js`). Mutants: 9.

### RPT1026-QUESTS NO-GIVES-BACK (95) - `src/systems/quest/noAsksAgain.js`

WHAT DFU DOES. M0B11Y18 asks under `toting _I.03_ and _ruler_ clicked` / `prompt 1050 yes _S.18_ no _S.20_`, and
`_S.20_` is `get item _I.03_`. Prompt.cs asks once and ClickedNpc stays true for a set task: after a No the letter is
back in the pack and the Queen never asks again.

WHAT THE PORT DID. NO-ASKS-AGAIN re-arms an inert No and the author's clearing No; a No that does something else stayed
DFU's.

FIXED. `noAsksAgain.js:"export function givesBackNo"`: a No whose every action is a `get item` of
the item its asking click toted, named by nothing but the prompt, asks again once that item is back in the pack. The
corpus has four (M0B11Y18 `_S.20_`, 80C0XY00 `_school_`, $CUREWER `_S.15_`, N0B00Y09 `_nononono_`). A departure,
Port-Ledger A, NO-ASKS-AGAIN's row, widened.

PINS. `test/systems/quest/rpt1026_quests.test.js` (1 of 10: the Queen's own lines through the real parser, machine and
click, No twice and a Yes). PIN MOVED: `test/systems/quest/fb1013e_noasks.test.js` (the census law list, six). Mutants: 2.

AUDIT RPT1026 H1 (the audit's lane H, read cold): NARROWED. Three of the four Nos are answers the questlines' sheets read
as the player's choice - N0B00Y09's `_nononono_` is its "Keep it for the Guild" and its `refused` ending (the Mages Guild
+3, the Dark Brotherhood -3), $CUREWER's `_S.15_` its `spared` ending, 80C0XY00's `_school_` its kept secret. Forgotten a
tick after the No, N0B00Y09 settled `loyal` (+2, nothing to the Brotherhood) under a journal that still named the choice,
and $CUREWER's refusal ended `failed` - with the questlines on, as they are by default and always online. A stamped
quest's No that its sheet reads (a choice's `sets`, a task an objective or an outcome binds:
`noAsksAgain.js:"export function sheetReadTasks"`) is DFU's again, asked once. The reported queen's
(M0B11Y18's sheet reads nothing of `_S.20_`) still asks again, and while the questlines are off all four do. Pinned by
`test/systems/quest/audit_rpt1026_quests.test.js` (the stamped and unstamped census, N0B00Y09 and $CUREWER through the
real bridge and layer; red at the batch head); `tools/mutants/audit_rpt1026_quests.json`.

### RPT1026-QUESTS QUEST-ZONE (67) - `src/systems/quest/place.js`

WHAT DFU DOES. Place.cs CollectDungeonIndicesOfType draws any dungeon of the type in the region that no other Place holds.

WHAT THE PORT DID. Online the open zone seals its dungeons but the day's halls (`world.js` wildDungeonGate: "The way in
is sealed. Only the halls marked on the map are open today."); 205 of the real MAPS.BSA's dungeons stand inside it, and
a quest's remote dungeon could be one.

FIXED. Online the draw skips every dungeon inside the open zone (`place.js:"_zoneSeal(world) {"`, handed to KVAR-HOLD's
collector), and the load's re-seat draws such a saved site again; offline DFU's draw stands. No main-story dungeon stands
inside the cut. A departure, Port-Ledger A, KVAR-HOLD's row, widened.

PINS. `test/systems/quest/rpt1026_quests.test.js` (2 of 10: forty draws online and offline; the re-seat online, not
offline). Mutants: 4.

### RPT1026-QUESTS CATALOG-READ (157, 250) - `src/systems/questlines/sheets/magesGuild.json`

WHAT DFU DOES. N0B00Y17 moves on reading its catalogue, never on carrying it: `_map2_ used do _S.15_` (the cousin's map)
reveals the item's dungeon and logs 1023; `_I.03_ used do _S.16_` (the dead end's page) logs 1024 and is the last
condition of `_S.19_`, the Guildmagister's 1060 and its gold. DFU's journal says nothing until the letter is read.

THE BRANCHES, read for 250 again. The start picks one of four (`pick one of _S.02_ _cousin_ _cousin_ _S.03_`): on _S.02_
(a quarter) the scholar names the item's dungeon himself (1040) and offers no errand; on _cousin_ (a half) the catalogue is
the cousin's map, whose reading reveals the item's dungeon (1023); on _S.03_ (a quarter) it is a page that names nothing
(1024), and that is the dead end. The errand (1041, 1042) and the teleport (1045, 1046) come only on the last two, and the
teleport lands in the CATALOGUE's dungeon (`teleport pc to _hintdung_`), never the item's: the item stands at
`_itemdung_`, which nothing marks until it is revealed. So a player who did the errand and was teleported is on the
cousin's branch or the dead end, and the Guildmagister's 1060 and its gold (`_S.19_`: _S.03_, _S.05_, _S.16_ and his
click) are reachable on the dead end alone, once its page is read. Both reports are that state: the errand done, the
catalogue carried and unread, the item's dungeon never revealed. The scholar has nothing more to say once his errand is
paid (DFU's), and the Guildmagister's click before the page is read only arms `_clickqgiver_`, which pays the moment the
page is read.

WHAT THE PORT DID. The questlines' sheet for N0B00Y17 struck its first step, "Look for the old catalog", the moment the
catalogue was carried, and had no step for reading it. A player who went to the catalogue's dungeon first saw the step
done, took the scholar's errand, was teleported back to that dungeon (emptied) and found nothing; the item's dungeon was
never revealed, and on the dead end the Guildmagister stayed silent. The placement was checked on the freeware's data
(24 draws through the real machine and Place, online): every marker - the catalogue's, the vambrace's, the scholar's and
the teleport's landing at spawn marker 0 - stands in a block of the dungeon whole, which the quest's instance builds;
the public room, laid smaller, stands none of them (QUEST-FIRST). Over every sheet, N0B00Y17's is the one objective struck
on carrying an item whose script moves only on its use (N0C00Y13 and S0000017 turn theirs in by carrying it).

FIXED. The reading is its own step, open while the catalogue is carried unread: "Read the old catalog from ___hintdung_,
which is in your pack", done on `_S.15_` or `_S.16_`. The script and DFU's journal are untouched. The port's own layer,
not a DFU member.

THE WORDS. A questline sheet's text (English; a translation pack's `QL.N0B00Y17.o.read`).

PINS. `test/systems/quest/rpt1026_quests.test.js` (1: both branches through the real bridge and the questlines layer -
carried unread the reading is open and the script unmoved, read through the inventory's own use it is done and, on the
cousin's branch, the item's search opens). Mutants: 2.

### RPT1026-QUESTS BOUNTY-WAY (215) - `src/scenes/bountyHost.js`, `src/systems/tutorialCatalogue.js`

NOT A DFU MEMBER. The bounty boards are the port's own (Ledger A, THE TOWN'S BOUNTY BOARDS).

IN THE REAL GAME. The freeware's data, the streamed world, the real host: a new game in Charengate, the board's orchard
hunt (363.506.83.1.1, 4 rats) held through the game's own mod-save registry, the hunter walked a pixel east onto its
target (499,85). The farm (Daggerfall's own farmstead block, five models) stood the moment the pixel was built; the host
named the way once - "The farmstead lies 330 meters to the north-east." (350 on a second run) - in the same few seconds as
the arrival's own lines (the festival, the cold, the needs, the family seat). Walked that way, the hunter came within 150
metres and the host stood the pack: "You spot 4 Rats, 111 meters to the north!", four rats in the exterior pool. Two
probe artefacts on the way: the tutorial boxes pause the world (the host's canStand false until they are read), and the
overworld's own probe door (`__overworld`) opens the overworld.

WHAT THE PORT DID. The journal's lines kept the last way named for a split hunt alone (BOUNTY-TRAIL's branch). A farm
hunt of fewer than six is one group, so its way lived in one HUD line; a hunter who missed it stood on the right pixel,
330 metres or so from a farmhouse, with no rat within reach and nothing to go on. The Bounties tutorial said to return
for the gold, which no hunt asks.

FIXED. The journal keeps the last way named for every hunt whose group waits at its spot (questLogEntries). The
tutorial page now says where a hunt is found (the middle of its black circle, or the dungeon it names), that the Quests
tab keeps the way, and that the last kill pays; English, as every tutorial page (the l10n ratchet's count for the page
rose by one: the old words held "return", which the scan reads as code).

PINS. `test/systems/quest/rpt1026_quests.test.js` (2). Mutants: 2.

### RPT1026-QUESTS ARENA-ORDER (209, 229) - `src/scenes/arena/arenaOnline.js`

WHAT THE PORT DID. A ladder bout's next Fight waits on a held purse `CLIMB_WAIT_MS` at most, a loss holding none. Past
it, while the bout's receipt was still with the service, the board's climb was still the one before that bout: Fight
entered the floor for that step, and only there did askTicket's guard ("Your last ladder bout is still being recorded")
or the service's `order` ("That is not your next ladder bout") let it go - the player on an empty floor.

FIXED. `arenaOnline.js:"once the flush moved".."if (claims.ladderKept?.()) {"`
in fightLadder: the receipt holds the Fight at the Herald, is carried again by the refusal, and the next press asks the
climb the service moved. Not a DFU member. `11-Multiplayer/Arena.md` RPT1026-QUESTS ARENA-ORDER.

PINS. `test/systems/quest/rpt1026_quests.test.js` (1 of 10: the real account service over node:sqlite, the receipt signed
with the relay's key, the claim out of reach then reached). Mutants: 2.

Mutants in all: `tools/mutants/rpt1026_quests.json` (29, all dead; AUDIT RPT1026 H5 re-aimed its close-row record to the
row chosen by skin). AUDIT RPT1026 H5: givesBackNo, written between clearingNo and asksOnAClick, took the text
`questaudit3_life.json`'s QA3L-NO-ASKS-clearer-named-twice was aimed by, so at the batch head that record mutated
givesBackNo and survived while clearingNo's named-once rule was checked by nothing; re-aimed by content onto clearingNo's
return, dead. AUDIT RPT1026 H4: four of the batch's laws survived a one-character mutation of its own pins - the "Nothing is written"
note drawn on a stamped row that has objectives, givesBackNo's toted item and its named-once rule, and besideSpot's second
ring; each is pinned now (`test/systems/quest/audit_rpt1026_quests.test.js`, The Lost Artifact itself paid with its
journal taken back, stamped and not, through the real bridge and the Quests tab). Re-aimed by content where these fixes moved the text
they read, and judged again with their lists (59, all dead): `fb1020c_crowdclear.json` (the-people-unread, items-moved,
always-moved, floor-unasked), `kvarhold.json` (a-named-site-drawn-again, any-dungeon-drawn-again, the-local-scope-left),
`questor_said.json` (the-row-off-centre), `questreset1.json` (QRESET-questor-rung).

## Breaches, world events and revenants (RPT1026-EVENTS)

| | Report | What it was | Done |
|---|---|---|---|
| 228 | The Sky-Ketch questline's step did not complete after the Tonal Warden fell; on every try after, its resonator phase took more than a whole health bar at once and spent every death-saving piece worn | The whole-bridge blows (the Discord, a quarter of everyone's health) stay in the fight's list a breath past their landing, and every room word folded in that breath owed the paid blow again. One Discord landed once for every word heard after it. The quest half: the Warden step (QLSK03) counts a felling whose claim answers the week's share, then asks for a visit to Imrah; a felling before the step was open, or one whose share was already taken that week, does not count (the questline's design) | RPT1026-EVENTS KETCH-OWED (the damage); the quest is AS DESIGNED, said in the notes |
| 199 | A Redoubt's spoils on the Court's floor could not be taken | The Spire's circle stood no target and no name for the floor pool the Redoubt's spoils are thrown into, so the press never reached a piece. The gate's court and the Hour's realm stand both | RPT1026-EVENTS SPIRE-SPOILS |
| 237 | The same, at the end of another Redoubt | The same | RPT1026-EVENTS SPIRE-SPOILS |
| 223 | A member whose window was in the background as the rest ended stayed in the finished circle and lost what they carried | The step into the company's next circle was taken only while the room's stage read `arrive` (its gather, at most thirty seconds). A hidden window draws no frame, so the state woke in the trial and every frame returned in the finished Court until the absent law cast the member out with their Reliquaries | RPT1026-EVENTS SPIRE-CATCHUP |
| 198 | At a crowded Dagon's Breach the sound failed and stayed silent for minutes after; the crowd hid the boss | No bound on one-shots: every blow, step and cry of forty players was a source, a gain and an HRTF panner sounding at once, and no one-shot's chain was let go when it ended, so the audio context fell behind. The sight half is the Other players card's Players shown at once count (GATE-CROWD, CROWD-WIDE) and GATE-COURTS' courts of fifty | RPT1026-EVENTS VOICE-CAP (the sound); the sight half ALREADY FIXED (GATE-CROWD, CROWD-WIDE, GATE-COURTS) |
| 219 | Portal Stone portals laid before events to carry the arrivals elsewhere | A portal takes whoever steps in, and nothing kept one from an event's gate | RPT1026-EVENTS GATE-WAY |
| 287 | A wagon parked across a breach's gate and a portal laid in it as the gate opened, more than once | The same, and another player's wagon parked across the gate hid the fire and the portal inside it (it walls nothing - PR-WAGON1 - but it is drawn) | RPT1026-EVENTS GATE-WAY |
| 247 | A crowded Orrery stayed unsolved for half an hour; the reporter blamed concealed players turning stones the wrong way on purpose, and asked to see who they were | THE STONES' RIGHTS held a griefer to a dozen of the fray's forty-eight turns, but the snap began the counts again, so a few accounts spent the fray between them for ever (measured: four griefer accounts against a team that knows the way never reach the Concord in any slot). A concealed hand could not be named | RPT1026-EVENTS ORRERY-HANDS |
| 197 | The Players shown at once count left other players' revenants standing | A peer's revenants, their bands and their companions are foe puppets their owner's screen stands, and no foe pool asked the crowd's cut (AUDIT CROWD-WIDE B1's open item) | RPT1026-EVENTS CROWD-KIN |
| 27 | The Soul-Pools encounter, deep in an Elite Breach, stuck with three casters still counted | A Caster killed by blows took its body away and left its pillar not done; nothing marked the plates | ALREADY FIXED: GAUNTLET-SLAIN (`Field-Bugs-2026-10-19d.md`, `egBrain.js:"if (g.i && !egBodyById(F, g.i)) { g.done = 1;"`) and GAUNTLET-PLATES (`Field-Bugs-2026-10-19f.md`); the run's lost keys are a staff restore (notes) |
| 26 | A Dread revenant never appeared | The lair's Dread stood nowhere a hunt reached | ALREADY FIXED: LAIR-DOOR (`Field-Bugs-2026-10-22d.md`), after LAIR-REACH, LAIR-HOME and LAIR-WALK (`Field-Bugs-2026-10-19.md`, `Field-Bugs-2026-10-19f.md`) |
| 32 | A hunt sent a player to a dungeon the revenant was not in | The hunt named a den the revenant was not stood in | ALREADY FIXED: LAIR-REACH, LAIR-HOME, LAIR-WALK (`Field-Bugs-2026-10-19.md`; `Field-Bugs-2026-10-19f.md`) |
| 38 | A revenant marked in two different caves was in neither | The same | ALREADY FIXED: LAIR-REACH, LAIR-HOME, LAIR-WALK |
| 42 | A revenant gone Dread was nowhere at its lair | The same, the Dread's case | ALREADY FIXED: LAIR-DOOR (`Field-Bugs-2026-10-22d.md`) |
| 216 | A piece of the Ketchmaster's share lodged in the chest | The Ketchmaster's chest threw its share from inside its own solid box; the live run reproduced 80 of 80 pieces at rest in it | ALREADY FIXED: KETCH-FIX (`Sky-Ketch.md` section 18, `6fa55aa46`, 2026-10-25 01:55 UTC - after the reports) |
| 217 | The same, most of the share out of reach | The same | ALREADY FIXED: KETCH-FIX |
| 218 | The same, no share reached at all | The same | ALREADY FIXED: KETCH-FIX |
| 138 | A star landed in a mountainside and could not be fought | A star's landing was taken on ground no defender could stand on (WoD rock fields; a slope past the clearing's law) | ALREADY FIXED: STAR-CLEAR (`Field-Bugs-2026-10-24b.md`, `f7898a91f`, 2026-10-24 16:01 UTC - after the three reports): of 1,366 landings 0.6% stood on ground steeper than 45 degrees within 40 m; the mountains were the rock fields its clearing now lifts. `test/scenes/starfall/starclear.test.js` passes on this tree |
| 162 | A character sank through the ground at a fallen star and was stuck | The same ground (ROCK-CLEAR, `Field-Bugs-2026-10-19f.md`, covers a fall into the rocks) | ALREADY FIXED: STAR-CLEAR, ROCK-CLEAR |
| 196 | A star landed inside a hillside, its coven never came, and the event ran out | The same | ALREADY FIXED: STAR-CLEAR |
| 220 | Around the thirties, a hall whose task is to hold its engine for a time: the count never moves and the hall never opens | Not found: 22 engine chambers over 30 seeds and 40 halls each stand on the fight floor, the real `egStep` counts a member's hold there, and the hold's progress is said every 2 s | NOT REPRODUCED - the breach's id or seed (notes) |
| 31 | A finished Elite Breach paid nothing | A Redoubt pays its spoils once per account per arena week (after that, gold), a Reliquary opens at a good end only (a tear, a wipe or a fall keeps it shut) and a Rehearsal pays nothing. Which applied is in the service's rows; unpressable pieces were also a cause (SPIRE-SPOILS) | NEEDS DATA/STAFF (notes) |
| 185 | The latest Elite Breach run paid nothing | The same | NEEDS DATA/STAFF |
| 207 | A long breach run with a guild party paid nothing, and nothing came by mail | The same (after LOST-SPOILS, so a piece left on the floor would have been mailed) | NEEDS DATA/STAFF |
| 238 | Some text said to be missing in the Elite Breach for one of its Blade emblems | No panel in the Spire goes by the report's name for it. The five Vestige families (Stone, Blade, Hunt, Arcana, Fellowship) each have every Vestige's name and line and their capstone's; no Blade text is missing on this tree | NEEDS DATA - a screenshot of the panel (notes) |
| 263 | A finished gate's night paid no spoils | A gate's spoils come off its receipt at the kill (`gateStand` offers each piece to the press); which receipt this account earned and claimed is in the service's rows | NEEDS DATA/STAFF |
| 266 | The Dagon's Breach said to break often, and another airship voyage that paid nothing | Two ways a crew lost its share were closed by AUDIT KETCH II after the report (L1-4, a fall's receipts told before the voyage's record goes; L5-1, crews shut out without a receipt). The breach half is too vague to trace; GATE-COURTS (2026-10-26) split a crowded night | NEEDS DATA/STAFF (the voyage's receipt rows) |
| 18 | In a raided city, blows on the raiders did nothing | In a raided town every monster may be another player's copy; a blow on one is a claim its owner's screen judges and may refuse (the cell, the quest party, `exteriorFoes.js` applyHit's bounds), rolled back on the striker's screen - `Field-Bugs-2026-10-19f.md` traced the same report. Which refusal fired needs the relay's counters for that cell | NOT REPRODUCED (notes) |

### RPT1026-EVENTS KETCH-OWED (228) - `src/net/ketch/ketchLink.js`

WHAT DFU DOES. Nothing: Daggerfall has no raid, no airship and no blow owed to a screen.

WHAT THE PORT DID. The Tonal Warden's whole-bridge blows - the Discord, the Keel-Song, the turn west - are owed to every
screen in the fight, so a hidden tab still pays them (`ketchLink.js` `owed`). The page pays each as it lands and calls
`paid(i)` (`scenes/ketch/ketchFight.js`). A blow stays in the fight's list (`ws.bl`) a breath past its landing
(`ktBlowDone`: its landing, its spell, 1.5 s more), and the room's walks and health words come several a second. Each
word folded in that breath found the blow in the list and not in `owed`, and owed it again. So a Discord - a quarter of
everyone's maximum health, no save - landed once for every word heard after it: a crew of eight took it six or seven
times over on the real voyage, past a full bar, and a death-defying piece answered each one.

FIXED. The link keeps the blows it has paid by fight and number (`paidKeys`, `fi:i`) and never owes one again; the keys
go with a new fight and with `leave()`, the newest 64 kept. The blow's damage and its law are unchanged.

PINS. `test/net/ketch/rpt1026_events_ketch.test.js` (2): the real voyage (`ketchSim.mjs`) heard by the real link, judged
by the real fight with my feet on the bridge - each Discord lands once at a quarter of the health; a blow paid and heard
again is owed no more, and `leave()` empties the list. `tools/mutants/rpt1026_events.json` KETCH-OWED (3: two dead, one
recorded equivalent - the clear at a new fight only bounds the set, since each key carries its fight's number). PIN
MOVED: `ketch_link.json` KTK-a-paid-blow-owed-again re-aimed by content. Record: `Sky-Ketch.md` section 22.

### RPT1026-EVENTS SPIRE-SPOILS (199, 237) - `src/scenes/eliteGates/egCircleHost.js`

WHAT DFU DOES. Nothing: Daggerfall has no Redoubt and no shared floor of spoils.

WHAT THE PORT DID. A Redoubt's spoils are thrown from the Court's heart into the Hour's floor pool (`world.js`
egSpoilsPaid, kept to the Court's floor by `egClient.js` beaconAt), and the press takes a piece as a target the one ray
wins. The gate's court (`gate/gateStand.js`) and the Hour's realm (`worldModes.js` standSdRealm) stand the pool's targets
and names in their context; the Spire's circle stood neither. Every piece lay drawn on the Court's floor with its line
rising, and no press reached it. Leaving the Spire took it to the pack, and since LOST-SPOILS to the mailbox.

FIXED. `standEgHall` stands the pool's targets (`addActivationTargets`) and names (`addActivationNamer`), as the court
and the realm do.

PINS. `test/scenes/eliteGates/rpt1026_events_spire.test.js` SPIRE-SPOILS: the real circle stood into a context of the
dungeon host's shape, the real pool throwing a Redoubt's real spoils (`egSpoilsList`) from the Court's beacon over the
circle's own collider; each piece offered, named and picked. Mutants: 2, dead.

### RPT1026-EVENTS SPIRE-CATCHUP (223) - `src/scenes/eliteGates/egClient.js`

WHAT DFU DOES. Nothing: Daggerfall has no company and no shared run.

WHAT THE PORT DID. The company steps into its next circle at the rest's end. A member's page took the step on the frame
that first saw the new circle, only while the room's stage read `arrive` - the gather's seconds, thirty at most. A
hidden window draws no frame while its socket's words still come, so its state woke past the arrival into the trial.
Every frame after returned in the finished Court until the absent law (`EG_ABSENT_TRIAL_MS`, 180 s) cast the member out,
with the Reliquaries they carried.

FIXED. The member is taken into the company's circle at whatever stage it first draws, unless that stage is the rest
(the one stage whose next circle is still being built); they land on its arrival plate and walk to the fight as a late
arrival does. One existing line in `createEgClient`; its ceiling holds.

PINS. `rpt1026_events_spire.test.js` SPIRE-CATCHUP: played against the relay's real Room (EG-PLAY's harness), with a
hidden window's beats (the room's words, no frame, no pose): still in circle 1 while the room fights circle 2's trial,
then in circle 2, on its arrival plate and alive at its first frame. It failed before the fix (circle 1). Mutant: 1,
dead. PIN MOVED: `egplay.json` EGPLAY-the-next-circle-never-built and `egz_return.json` EGZ-return-never-rebuilds
re-aimed by content.

### RPT1026-EVENTS VOICE-CAP (198) - `src/systems/audio.js`

WHAT DFU DOES. DFU plays through Unity, which sounds at most `m_RealVoiceCount` sources at once - 32 in DFU's own
`ProjectSettings/AudioManager.asset` (512 virtual) - and makes the rest virtual, the least audible first.

WHAT THE PORT DID. No bound. Every blow, step, cast and cry of forty players near was a source, a gain and an HRTF panner
of its own, all sounding together, and a one-shot's chain was never let go when it ended (RAIN-LEAK's `releaseNodes`
held for the loops alone). The bus carried thousands of finished chains, the context fell behind, and every sound
stopped until it caught up.

FIXED. A one-shot - `playOneShot`, `play3d`, `play3dVoice` - takes one of `REAL_VOICES` (32). Past them it plays only
if it reaches the ear as loud as the quietest sounding or louder (`voiceRoom`), and that one is faded out over
`VOICE_FADE_S` and stopped; a quieter shot never starts. A positional shot's level is what reaches the ear (`distanceGain`,
the Web Audio spec's distance models). Every one-shot's chain is let go as it ends (`_voiceKeep`). Loops and beds are not
counted. THE DEPARTURE: Unity's number, not Unity's law - Unity keeps a virtual voice and can bring it back; a short
one-shot here is let go, and one that finds no voice never starts. Ledger A (VOICE-CAP).

PINS. `test/systems/rpt1026_events_audio.test.js` (3): the law and the distance models; forty players' blows round my
ear, at most 32 sounding, the stolen faded and stopped, a far one refused, a flat shot at the crowd's own level finding a
voice (AUDIT RPT1026 I2: at a real crowd's it did not - below); the chains let go and the voices freed. The 62 audio pin
files that were there pass (886 tests). Mutants: 6, dead. PIN MOVED: `auditgatherfeel.json` (two) and `egz_sound.json` (one) re-aimed by content. Record: `08-Audio/Audio.md` VOICE-CAP.

AUDIT RPT1026 I2 (2026-10-27): the page's own sounds were not safe from the bound. A peer's swing is played whole inside
six metres at 1.1 (`net/remotePlayers.js` `PEER_SOUND_PROFILE`), louder at the ear than the blow that lands on me, my cry
and my steps, so thirty-two peers swinging about me refused every one of mine and a near swing stole any that sounded;
the pin's crowd had been built by hand at the flat shot's own level. Now a flat one-shot always takes a voice, the
quietest positional one stolen for it, and a positional shot never steals a flat voice
(`audio.js:"export function voiceRoom("`). Pinned by `test/systems/audit_rpt1026_events_audio.test.js` (the crowd's own
producer); mutants `tools/mutants/audit_rpt1026_events.json` (I2, 6, dead); `egz_sound.json` EGZ-audio-scope-unread
re-aimed by content.

### RPT1026-EVENTS GATE-WAY (219, 287) - `src/systems/eventGround.js` (new), `src/systems/portalStone.js`, `src/scenes/portalGates.js`, `src/scenes/horseCartPool.js`, `src/scenes/gate/gatePool.js`, `src/scenes/eliteGates/egArch.js`, `src/scenes/eliteGates/egCall.js`, `src/scenes/starfall/starfallHost.js`, `src/scenes/world.js`

WHAT DFU DOES. Nothing: Daggerfall has no portals, no world events and no other players.

WHAT THE PORT DID. A Portal Stone's portal takes whoever steps in, and a crowd running at a Dagon's Breach as it opens runs
into whatever stands before the fire. Nothing kept a portal off an event's gate. A peer's wagon walls nothing (PR-WAGON1),
but parked across a gate it was drawn there, hiding the fire and the portal inside it.

FIXED - THE RULE (chosen). While an event's gate stands on a screen, no Portal Stone's portal stands within `EVENT_GROUND_M`
(40 m on the ground - past the gate's 24 m rock clearing and a star's 28 m coven ring) of it there: the opener's pick
refuses the place (`portalStonePlace` - `refused: 'event'`, its line said, no stone spent); a peer's word of one there is
not believed (`portalGates.js` applyOwner); one standing when a gate rises beside it closes and takes nobody (tick).
Another player's PARKED wagon on that ground is not drawn, nor its team, nor pressed (`horseCartPool.js` `offGround`); my
own draws. THE AUTHORITY: every screen's. A portal and a parked wagon are their owners' words in the foes frame, which the
relay never reads, and a portal's step is taken on the screen that steps in - so each screen judges by the gates it
stands, and a modded opener cannot reach a screen past that screen's law. The gates: the Dagon's Breach (`gatePool.js`,
rising to collapsing), an Elite Breach's arch (`egArch.js`) and a fallen star (`starfallHost.js`, falling and fallen), each
said once through the new leaf (`setEventGround` / `eventGroundAt`, the construction seam's shape - no host grew). An
Elite Breach's call opens its own portal by `portalPlace` and its pool keeps no ground (`eventGround: false`): it is the way
in. `world.js` changed in two existing lines (the import and the pick), no growth.

THE FOUR HOSTS. `scenes/world.js` WIRED in two existing lines (the import, and standPortal's pick asking
`portalStonePlace`) - no growth; `worldModes.js`, `dungeonContext.js` and `exterior.js` untouched (a portal is the open
sky's). hostceiling green.

THE WORDS. One new line, `portal.refused.event` - *"A portal cannot open this close to an event's gate."* - drafted in
every language.

PINS. `test/scenes/rpt1026_events_gateway.test.js` (7): the law; the real gate pool's ground (sealed, open, gone); the
pick refused and the place law unchanged; a peer's word refused on the ground and believed past it, a standing one closed
taking nobody, the call's kept; a peer's wagon parked in the gate undrawn and teamless while mine and a far one draw; the
real arch pool's ground from a hub-signed call; the real starfall host's ground while a star stands fallen and none
before or after. `portal1_stone.test.js` scope gains `portalStonePlace` (PIN MOVED). Mutants: 11, dead. PIN MOVED:
`auditinvis.json` (two) re-aimed by content. Record: `06-Systems/Portal-Stone.md`, `06-Systems/Horse-Cart-And-Cargo.md`.

### RPT1026-EVENTS ORRERY-HANDS (247) - `src/net/superDungeon/sdBrain.js`, `server/src/index.js`, `src/scenes/superDungeon/sdHall.js`, `src/scenes/world.js`

WHAT DFU DOES. Nothing: Daggerfall has no shared puzzle and no other players.

WHAT THE PORT DID. THE STONES' RIGHTS (AUDIT SD II, L7 H2) hold a turner that has lengthened the road six times while
others turn, so one griefer spends at most a dozen of the fray's forty-eight turns. But the realm began the rights afresh
at every snap (`_sdTurn`: `orreryRightsFresh()`), so each griefer's dozen came back with every thread. Over the realm's own
law, four, five or eight griefer accounts against a team of three that knows the way reach the Concord in no slot of 24
within 1,200 turns. A concealed body is drawn by nobody, so the forty could not tell whose hand it was.

FIXED - THE CHOICE: both. (1) Counted for the Hollow (`orreryRightsSnapped`): past a snap the lash's nets begin again and each
turner's count is kept; once a hand's six are spent it waits while others turn until the Hollow is gone. Over the same
contest the Concord comes in every slot, the Hour snapping back at most once for every two griefer accounts; a lone
learner and a solver are never held. The bound is per account per Hollow. (2) Named: the realm's word already carried
the turner (`id`) and the lashed (`ls`); the world host names both off its roster, drawn or concealed (`sdHallNamed`).
A stone's hover reads "Last turned by Ash"; the snap's line names the lashed, five then a count (`sdSnapLine`). Nothing
says which way a turn went. `_sdTurn` is a Room method of its own (`_message` untouched); `world.js` changed in two
existing lines.

THE FOUR HOSTS. `scenes/world.js` WIRED in two existing lines (sdHallHeard names the word and says the snap by it) -
no growth; the relay's `_message` untouched (`_sdTurn` is a Room method of its own). hostceiling green.

THE WORDS. Four new lines in `SD_HALL_TEXT`: `sd.hall.lastBy` (*"Last turned by {name}"*), `sd.hall.you`,
`sd.hall.snapLashes` and `sd.hall.snapLashesMore` (*"The Hour snaps back. No help came from {names} and {more}
others."*, a plural) - drafted in every language. The relay's own refusal line is unchanged.

PINS. `test/net/superDungeon/rpt1026_events_orrery.test.js` (4): the contest, old rights never and kept rights always;
the rights past a snap and the realm's judge; the names; the plaque over the real hall. PIN MOVED: `sd11b_relay` (past
the snap a griefer turns only after the company's minute; a second snap's lash is its own thread's; the page's lash named), `sd6c_hall`, `sd11a_scenes`,
`sd20a_fight`, and `egseam_law`'s golden Orrery frames (the Hour's realm through the real Room, taken again: 229 frames,
every one up to the held turn the seam's). Mutants: 9, dead; `sd11b.json` SD11b-L7H2-a-fresh-thread-never re-aimed by
content. Record: `11-Multiplayer/Super-Dungeons.md` section 8 and ORRERY-HANDS. A relay change: RELAY_VERSION owed.

AUDIT RPT1026 I1 (2026-10-27): held hands hold each other - a held hand waits while ANY other has turned within the
company's minute - and the Hollow-long count took away the snap that had freed them. A team that spent its six apiece
learning the gearing (each long turn mended) was held out of every thread by one held griefer account turning on: over
the realm's own judge the Concord came in no slot of 24 against one griefer (the old law's 24). Now a hand the thread
held out behind held hands alone is marked (`sdBrain.js:"export function orreryWaited"`) and begun again at the snap; a
hand held out by a free hand's turns keeps its count, so the contest above stands. Against one, two, four or eight griefer
accounts the learned team reaches the Concord in every slot. Pinned by `test/net/superDungeon/audit_rpt1026_events.test.js`
(the realm's judge, `orreryJudge`, and its snap); mutants `tools/mutants/audit_rpt1026_events.json` (I1, 5, dead);
`rpt1026_events.json` (two) and `sd11b.json` SD11b-L7H2-the-rights-unasked re-aimed by content. A relay change (`sdBrain.js`
is in its bundle): RELAY_VERSION owed again.

### RPT1026-EVENTS CROWD-KIN (197) - `src/net/gate/gateCrowd.js`, `src/systems/combatVisuals.js`, `src/player/activate.js`

WHAT DFU DOES. Nothing: Daggerfall has no other players.

WHAT THE PORT DID. The Players shown at once count (GATE-CROWD, CROWD-WIDE) hid a cut player's body, team, wagon, boat and
torch, but no foe pool asked it: a peer's revenants, their bands and their companions are foe puppets their owner's screen
stands, so a crowd of forty cut to twelve still stood every revenant the forty brought (AUDIT CROWD-WIDE B1's open item).

FIXED. Every foe pool's one draw question asks the page's one crowd (`crowdCutsPeer` - the crowd `createGateCrowd` made
last, the world host's; no host wiring). One of a cut player's own (`crowdKinHidden`: its owner's word made it a revenant,
a band's follower or a companion) is HIDDEN (`combatVisuals.js` foeDraw - the open world's, a building's, a dungeon's and
the watch's pools all ask it where they draw), and has no box for the ray (`activate.js` foeAabb - the plaque's sweep and
the press's both read it). Never one on me (`_pupMine`), never the world's foes a peer's screen happens to run.

THE FOUR HOSTS. None touched: the draw question and the ray's box are modules every host already asks
(`exteriorFoes.js`, `dungeonContext.js` and `cityGuards.js` unchanged).

PINS. `test/scenes/rpt1026_events_crowdkin.test.js` (3): the crowd's word; the real open-world pool over the owner's own
records - revenant, band follower and companion hidden and unpressable, the plain foe drawn, the revenant on me drawn,
all back with the owner; a dungeon's by its records' shape, the draw question and the box. Mutants: 8, dead. Record:
`11-Multiplayer/World-Bosses.md` section 21, `06-Systems/Revenants.md` section 50, the audit's open item closed.

## Travel, sailing and homes (RPT1026-WORLD)

| | Report | What it was | Done |
|---|---|---|---|
| 6 | An underwater dungeon entered invisible: foes spawn without end on the player | No spawner reads invisibility, and a foe replaced never fires again (FIELD BUGS 2026-10-19f's trace) | NOT REPRODUCED |
| 14 | Pushed out of a dungeon's walls by a moving floor that came down on a swimmer | The mover law and the dungeon's missing void rescue - read and fixed by FIELD BUGS 2026-10-19f (#1054, merged 2026-10-20, after the report's 0.0.235) | ALREADY FIXED (MOVER-BODY, VOID-DUNGEON) |
| 15 | At sea, after a couple of fights, the Overworld is refused for foes said to be near when none are | Fixed after the report's build: RAID-WON (`Field-Bugs-2026-10-19.md`; 19f item 24) | ALREADY FIXED (RAID-WON) |
| 17 | A fast travel left the character inside a mountain | A neighbour pixel's rock built round a body already standing - FIELD BUGS 2026-10-19f item 13 | ALREADY FIXED (ROCK-CLEAR, UNSTUCK-OUT's landing) |
| 30 | Entering a house, its furniture moved and boxed the player in | An online home's pieces land after the entry, solid where the player stands - 19f item 4 | ALREADY FIXED (DECOR-CLEAR) |
| 37 | The Overworld's pace drops on a road with no foe near, and resets on leaving it | TV2's load cap (the owner: "Cap it to what loads cleanly") - the pace waits for the ground to build, and starts again from its floor when the view is left | AS DESIGNED |
| 49 | Leaving or crossing a town on the Overworld, the walk is pinned into a corner | A journey from inside a walled town aimed through the wall - 19f item 10 | ALREADY FIXED (OW-TOWN-WALK) |
| 51 | Talking to a home's trader, a table loaded in round the player | The same late solid - 19f item 4 | ALREADY FIXED (DECOR-CLEAR) |
| 53 | Stuck in a lift, and `/unstuck` on its cooldown | The lift: MOVER-BODY (19f item 11). The 30-minute cooldown is PVPUNSTUCK's (`11-Multiplayer/Wild-Zone.md` section 17) | ALREADY FIXED (MOVER-BODY); the cooldown AS DESIGNED |
| 60 | Fell through the map under a hold (no place of the report's name exists; Privateer's Hold read) | A dungeon had no void rescue - 19f's VOID-DUNGEON, merged after the report's 0.0.270 | ALREADY FIXED (VOID-DUNGEON) |
| 64 | A wagon parked by a building: in and out of its caravan, the player stands inside the building | The caravan door's landing never asked what stood there | WAGON-OUT |
| 68 | At sea in a storm, the camera scrolled out: the rain is a box round the ship | The falling weather wrapped the head, not the view's eye, off the Overworld | RAIN-EYE |
| 69 | Asks for houses shared by an account's characters | Merged since: a home is its account's | ALREADY FIXED (ACCOUNT-HOMES) |
| 72 | Decorating a new house, a placed piece put the player in the wall | A placed piece solid round the body - fixed by 19f's DECOR-CLEAR, merged after the report's 0.0.276 | ALREADY FIXED (DECOR-CLEAR) |
| 77, 78, 79 | Walking a town on the Overworld, stuck inside a building's walls (one a player's home whose house did not draw); asks to be moved out | A town's model built round a body already standing - 19f's ROCK-CLEAR, merged 2026-10-20 13:06 UTC, after these reports' 0.0.281; a save held in a solid lands on open ground (UNSTUCK-OUT) | ALREADY FIXED (ROCK-CLEAR) |
| 86 | A house in Daggerfall city that cannot be bought | One player's house and save; no law found that refuses one house alone | NEEDS DATA |
| 88 | A Chesterwark guild hall shows its banners only from inside the house | The banners faced the house's middle, not its door's own normal - fixed by AUDIT WITCH1 D1 (with WITCH1, #1079, merged 2026-10-20 21:06 UTC, after the report's 0.0.287) | ALREADY FIXED (AUDIT WITCH1 D1) |
| 93 | An alt logged out in the owner's house; the owner signs in and the map says the house is for sale, its yard bare, until a knock | Traced: the town's homes are read again at a knock; no path found that keeps the owner's own read empty | NOT REPRODUCED |
| 122 | Asks staff to put a bank-bought ship back on the Fleet and tie its cabin to it again | One character's save: its ship link and cabin record | NEEDS DATA / STAFF |
| 126 | Another character stuck in a wall (after ROCK-CLEAR) | One character's saved spot | NEEDS DATA / STAFF |
| 136 | A house bought in Daggerfall city, now a different one | One account's homes row against the town's layout | NEEDS DATA / STAFF |
| 139 | Why can some beds and tables be taken out and others not; asks for a way to clear a house of its furniture | BASE-HIDE: a piece that holds anything is never taken out, and the room's own walls are no piece | AS DESIGNED (the clear-it-all ask for the owner). CORRECTED by `Field-Bugs-2026-10-29e.md` BUILT-IN-MODS: the town mods' furniture written as scenery was never offered - fixed |
| 156, 202 | Pirates and failed encounters every few seconds on the Overworld at sea | The sea's spawn rolls waited on the sea's scaled seconds | TRAFFIC-REAL |
| 158 | A fast travel left the character inside a mountain (after ROCK-CLEAR) | UNSTUCK-OUT's landing and ROCK-CLEAR both stand; the one gap on record (the collider's bilinear floor under the drawn landform's ridge) needs the place | NEEDS DATA / STAFF |
| 169 | Horses neigh constantly | DFU's TransportManager neigh (2-39 s) and the animal flats' own, near the player; Horse Volume (HORSE-VOL) lowers or mutes them | AS DESIGNED |
| 170 | The Hearth Offering cannot be set at the house's door | Set at the home's first door where the build kept it room; the other door is refused in its own words | AS DESIGNED |
| 171 | Crouch-jumping out of a dungeon's geometry; looting a room above through its floor | A stand under a 1.25-1.45 m ceiling put the head's centre past the face, and the collider pushed it through | STAND-THROUGH |
| 193 | The ship capped under 5% of her speed after the 10-23 sailing patch | Second pass: #1177's DECK-POSE, SEA-DECK and SEA-DROPS (the patch) reach nothing of her way; every hold the naval host lays on her lets go with its cause (a guard pins it). The one law that holds her under 5% under sail and oars alike is Come Sail Away's cargo rule - and under the Classic helm a hull with no Cargo node weighs against a hold of nothing (the mod's own, kept) | NOT REPRODUCED |
| 194, 271 | Inns lit by nothing (the Howling Mug in Westhead Moor) | Daggerfall hangs no lamp in 177 of its rooms, and DFU lights them at InteriorAmbientLight's 0.18 | DARK-ROOM (AUDIT RPT1026 J1) |
| 200 | Sailing port to port, no other port's quays stand | The host named one town, from the 3x3 about the player, and read every unbuilt pixel of its ring as land: a ship at 24 of the 36 far harbours' first berths never sounded them, and Pencart's waited on Longham | FAR-QUAY |
| 201 | A yard at its limit resets; nothing can be placed or sold | A town's yards were answered 2,000 pieces at most, in building-key order - YARD-TOWN, after the report's 0.0.363 | ALREADY FIXED (YARD-TOWN) |
| 205 | A cooking hearth cannot be placed in a home | DECOR-USE (5dfc764b6), after the report's 0.0.366: a placed fire cooks, and a cooking station | ALREADY FIXED (DECOR-USE) |
| 208 | Every character's first switch starts in Daggerfall, not the family's seat | Traced the switch's place (the family's seat, else the nearest town, else Daggerfall) to the boot; a new character made from the menu founds its own house | NOT REPRODUCED |
| 244 | Since the decorator's new menu, a caravan's pieces cannot be moved | Since the overhaul a piece is moved by a press on it, the plaque's lit row - and no plaque is drawn on a touch screen or the classic skin with quick loot off, nor named with World Tooltips off: there a press opened its chest or did nothing. The decorator's own Move works in the caravan by both doors at 0.0.392, 0.0.404 and now (a guard) | DECOR-VERBS |
| 248 | A Wildertown guild hall: one banner floats in the air | A cloth hung past its small house's corner | BANNER-WALL (AUDIT RPT1026 J2) |
| 252 | Pieces cannot be placed in a house: the Confirm button does nothing | A room read unanswered as the draft opened (the service slow) left every Confirm of the visit refused; and a second click while one was on its way sent it twice and paid twice | CONFIRM-REREAD, CONFIRM-ONCE |
| 259 | All volumes at 10%: in and out of the caravan by a shipwright, deafening ship sounds | A moored boat stood again woke her wake's loop at full | LOOP-AWAKE |
| 268 | On the Grayidge-Westwall road the Overworld leaves the bridge and walks into the water; on the beach the body sinks | The route law refused the road's step onto the inlet's water pixel, which his painter paves | CAUSEWAY |
| 270 | Sentinel's docks stand on sand, a sliver of water beside them | DFU's own ground: Sentinel stands 2 pixels off the sea and its pixel is blended flat; its harbour is the nearest shore, 721 m off its footprint (HARBOUR-REACH) | AS DESIGNED |
| 272 | Westhead Moor's "The Champion Bookroom" has no vendor | It is a Library (type 10, the Bookroom name its own); DFU's RMBLayout.IsShop leaves libraries out - books sell at a Bookseller | AS DESIGNED |
| 273 | The Overworld walk through a town hangs on tavern signs | Fixed after the report's 0.0.416: SIGN-PASS (e2d83ca56, #1303) | ALREADY FIXED (SIGN-PASS) |
| 274 | Fighting at sea, the player's ship freezes with sails and oars working | Second pass, driven on the real naval host: the heave-to of 0.0.416 let go under BOARD_SPEED or at 8 s, BOARD-MAGNET's haul by HAUL_MAX_S, and nothing of either is left after the fight or beside a cutter fighting a pirate (a guard); Come Sail Away's own collision and beaching read and no freeze found | NOT REPRODUCED |

### LOOP-AWAKE (259) - `src/systems/comeSailAway/comeSailAway.js`

WHAT THE MOD DOES. Come Sail Away adds two AudioSources to each boat (AddComponent: playOnAwake true), plays the slow
loop on placement (PlaySlow) and crossfades to the fast one under way. Unity stops a source when its object goes
inactive and plays a playOnAwake source again when it comes back.

WHAT THE PORT DID. `setBoatActive` did as Unity does: a boat put out of sight (a building, a caravan entered) and stood
again played BOTH loops - the fast loop too, which a moored boat never plays, at its AddComponent volume of 1. A plain
AudioSource's volume is handed to the bus with Sound Volume divided out (`audio.js` plainSourceGain), so every moored
boat in earshot ran her wake's loop at full volume whatever the sliders said.

FIXED - a departure from the mod (Port-Ledger A, LOOP-AWAKE). A loop plays again only if it was playing as its boat went
(`awake`), at the volume it had; a boat never put away wakes her slow loop alone, the one every placement starts.

THE FOUR HOSTS. The runtime's own `setBoatActive`; no host line moved (createComeSailAwayRuntime unchanged in size).

PINS. `test/systems/comeSailAway/rpt1026_world_loops.test.js` (2: a moored boat at Sound Volume 10% in and out - the slow
loop back at its level, the fast one silent, nothing heard past the slider; under way the fast loop comes back and the
slow one the crossfade stopped does not). PIN MOVED: `csa_time_audio.test.js`'s "two loops" now asserts [true, false].
Mutants: RPT1026-LOOP-AWAKE-unity-wakes-both, -never-noted (2); `csa_time.json`'s CSA-G-inactive-keeps-playing and
CSA-G-no-play-on-awake re-aimed by content - dead.

### TRAFFIC-REAL (156, 202) - `src/systems/naval/navalDirector.js`, `src/scenes/naval/navalHost.js`

WHAT THE PORT DID. The naval host steps the sea on the world's clock (`frame`: `dt * worldTimeScale()`, AUDIT NAV1's "the
sea keeps the world's time"), and the director's spawn rolls waited on those seconds. Under the Overworld's x60-x100 a
roll came every one or two real seconds, not SEA-EASE's "a minute to two and a half"; a ship left DESPAWN_BEYOND astern
in a breath freed her berth for the next, and a pirate among them (SPAWN_RING 650-1000 m, a seventh of it inside
HOSTILE_NEAR_M) stopped the journey (Travel Options' enemies stop and its avoid roll) and held it at x1 (TIME-DILATION).
Measured through the real host at x60: five ships in twenty real seconds, the first in under one, 760-940 m off.

FIXED. The host hands the director its real clock (`real: realClock`); the wait spends the real seconds that clock
advanced (`trafficSeconds`: the first read spends none; no clock handed, the step's own `dt`; never negative; a reset
forgets the last read, so the time ashore is no wait). The ships at sea, their sailing and their fights keep the world's
time as before. A balance change the owner may want to hear of: the sea is as busy per real minute at x100 as at x1.

THE FOUR HOSTS. `createNavalHost` +1 entry (the director's ctx), under its ceiling (hostceiling.test.js green). The other hosts run
no sea.

PINS. `test/systems/naval/rpt1026_world_traffic.test.js` (3: at x60 no ship before FIRST_ROLL_S real seconds; at x1 the
traffic as it was; the law with its reset). Mutants: RPT1026-TRAFFIC-REAL-no-clock-handed, -the-seas-seconds,
-reset-remembers, -first-read-spends (4).

### DARK-ROOM (194, 271) - `src/world/interior/interiorLights.js`, `src/scenes/worldModes.js`, `src/scenes/interior.js`

WHAT DFU DOES. PlayerAmbientLight sets InteriorAmbientLight (0.18; 0.20, 0.18, 0.20 by night) in every room, and
DaggerfallInterior.AddLight hangs a lamp on each archive-210 flat. Only DFU's Lit Interiors setting (AmbientLitInteriors)
lights a room by ambient alone, at InteriorAmbientLight_AmbientOnly (0.8; 0.5 by night - `PlayerAmbientLight.cs:29-30`).

WHAT THE PORT DID. The Howling Mug is MARKAA01.RMB's first room (classic and under Beautiful Cities alike): 27 models and
no archive-210 flat, so no lamp, and the room stood at 0.18 - 0.027 in linear on the Enhanced Lighting lane under an eye
held to 1.2 (INTERIOR-DIM): black. 177 of BLOCKS.BSA's 6,832 rooms lay no such flat (5 taverns of 290, 30 weaponsmiths
of 55, 16 banks of 31).

FIXED - a departure for those rooms alone (Port-Ledger A, DARK-ROOM). `roomAmbient(ambient, lamps)`: a room built with no
lamp (the archive-210 flats its build hung, `interiorContext.js` roomLamps - AUDIT RPT1026 J1, below) takes DFU's own
ambient-only level for the hour; a room with a lamp keeps InteriorAmbientLight to the bit.

THE FOUR HOSTS. `worldModes.js`'s building arm and the `?interior` bench (`interior.js`) both light through
`roomAmbient` over the room's own lights - the one statement each already had, no logical line added
(createWorldModes 11,025 of 11,025). A dungeon and the exterior have no interior ambient.

PINS. `test/world/interior/rpt1026_world_darkroom.test.js` (3: MARKAA01 #0 lit at 0.8 / 0.5 and a lamped tavern
unchanged, on the player's data; the law; both hosts by source). PIN MOVED: `windows1_view.test.js`'s indexOf string;
`time1.json`'s TIME1-the-interior-light-on-the-event-clock re-aimed. Mutants: RPT1026-DARK-ROOM-every-room-classic,
-no-night, -host-unwired (3).

AUDIT RPT1026 J1 (the batch's audit, lane J). As merged the law read the room's LIVE light list (`interiorCtx.lights`),
which a home's placed lamp joins (`decorRoom.js` roomLights) and a lamp its owner takes out leaves (`decorBase.js` hide):
one candle set down in a room Daggerfall left unlit put it back to 0.18, dark but for the candle, and the caravan's
lantern taken out (WAGONS2-BASE) lit the caravan at 0.8. Both hosts now hand `roomAmbient` the lamps the room was built
with (`interiorContext.js` roomLamps, frozen at the build), so nothing a player does in a room moves the level it is lit
at. The record's "a home's placed lamps among them" was the defect. Pinned by `test/scenes/audit_rpt1026_world.test.js`
(J1: the caravan's own block through the interior build, its lantern taken out; an unlit room with a lamp placed through
the real decor room; both hosts by source); PIN MOVED: this record's by-source test, `windows1_view.test.js`, and the
`time1.json` and RPT1026-DARK-ROOM-host-unwired records. Mutants: `tools/mutants/audit_rpt1026_world.json` J1 (3).

### WAGON-OUT (64) - `src/scenes/caravanRoom.js`, `src/scenes/world.js`

WHAT THE PORT DID. The caravan's door landed the player on the ground behind the rear door (`ground`: the street
collider's floor, the door's landing law) and asked nothing of what stood there. A caravan parked with its back to a
house, a palisade or a rock put that ground inside the solid, and the collider - both faces of every skin - held the body
in. DFU has no caravan.

FIXED. `caravanStepOut`: the landing asked as a fast travel's is (UNSTUCK-OUT): a spot a static solid holds
(`heldInSolid`) stands on the nearest open ground (`openGroundNear`), above the sea (`tvSeaY`); with none open, where it
was.

THE FOUR HOSTS. `bootWorld`'s caravan door: the one entry it had, no logical line added. The caravan room exists only in
the streaming world.

PINS. `test/scenes/rpt1026_world_wagonout.test.js` (2: a caravan parked against a house, the real collider and the
caravan's own door - out on the open ground beside the house, never in it, and behind its door as before in the open; the
law and its wiring). Mutants: RPT1026-WAGON-OUT-landing-unasked, -the-sea-is-ground, -host-unwired (3).

### BANNER-WALL (248) - `src/scenes/hallBanners.js`

WHAT THE PORT DID. A hall's two cloths hung a jamb's gap either side of its door whatever the wall did there. ARCH3D 118
(a small box house) has its door on the last 1.25 m of its west wall, so its second cloth hung wholly past the corner, in
the air - 105 of the cloths of Wildertown's 364 doors under the town packs.

FIXED. A cloth whose either end, at the wall, falls past its building's box (BANNER_WALL_PAD_M, 0.05 m) is not hung:
one cloth, or none, where the door leaves room for one, or none. Not a DFU member (the port's guild halls).

THE FOUR HOSTS. The pixel build's hall frames (`pixelBuild.js`) are the streaming world's; no host line moved.

PINS. `test/scenes/rpt1026_world_bannerwall.test.js` (2: Wildertown with the packs on the player's data - the box house
hangs one, every door's cloths on their walls, 259 doors of 364 keeping their pair; the law). The existing banner suites
(guild1d_client, auditguild1d, audit_chap5, castle_gate, seat_standing_festival) unchanged. Mutants:
RPT1026-BANNER-WALL-both-hung, -one-end-asked, -pad-a-metre (3).

AUDIT RPT1026 J2 (the batch's audit, lane J). "Every door's cloths on their walls" was the box asked again: the pin's
`onTheBox` is the law's own test, and its frames took the first model's box where the pixel build unions every model's
(`pixelBuild.js` homeFrames). Asked of the building's own faces through the real collider, a cloth still hung before no
wall where a door stands on a vestibule or in a porch, its facade stepped back beside it (ARCH3D 326, 339, 249, 324 and
more: 19 of Wildertown's 364 doors, 29 of Daggerfall's, 29 of Chesterwark's, 14 of Sentinel's). The frame now carries its
building's models (`parts`), and a cloth hangs only where a face of them stands behind both its ends, at its lower edge
and its middle, within BANNER_WALL_BEHIND_M (1.2 m) of the door's plane (`hallBanners.js` wallBehind); a frame with no
models (a castle's gate, a test's) asks the box alone. Wildertown: 240 doors keep their pair, 124 hang one, none hangs
none. Pinned by `test/scenes/audit_rpt1026_world.test.js` (J2: Wildertown through the real collider; the law; the build's
`parts` by source). Mutants: `tools/mutants/audit_rpt1026_world.json` J2 (6).

### RAIN-EYE (68) - `src/scenes/world.js`

WHAT THE PORT DID. OW-WEATHER (FIELD BUGS 2026-10-01 #9) wrapped the rain's, the snow's and the sand's boxes and the
wind's wisps round the view's eye under the Overworld only; on the ground they wrapped the head (`cam.pos`). A camera
drawn from behind the head - the third person's, a helm's scrolled out over her stern (`seaZoom.js`), the broadside's
aim - stood outside that box: a cube of rain round the ship.

FIXED. `wxEye` is the view's eye (`mwv.eye`) in every frame; in the first person the two are one, as they always were.

THE FOUR HOSTS. `bootWorld`'s weather block: the same statement, its value changed. The other hosts draw no Overworld
weather.

PINS. PIN MOVED: `test/net/peer/fb1001_overworld.test.js` (OW-WEATHER's pin) and its `fb1001_overworld.json` record.
Mutant: RPT1026-RAIN-EYE-the-head-on-the-ground (1).

### CAUSEWAY (268) - `src/systems/travel/travelRoute.js`

WHAT THE MOD DOES. Travel Options' follow key walks Basic Roads' bytes whatever the ground under them, and Hazelnut's road
painter paves water under a road (ROAD_TILES column 0: tile 46).

WHAT THE PORT DID. The Overworld's step law refused every step into a pixel whose WOODS byte is the sea's, his road's
too. His road crosses 42 such pixels: the Grayidge inlet's (72, 131) - a strip of 256 road tiles two wide, the water
either side, its ground at or over the ocean's elevation - one at (324, 205), and a coast road of 40 through the sea at
(515-559, 296-316). The route from Grayidge (72, 133) to Westwall (72, 130) left the road at (72, 132) and went by the
open pixel (73, 131) - across the inlet's east arm, into the water the causeway stands in.

FIXED. A step ON his road (both ends carrying the edge, `pavedStep`) is taken into a sea pixel and through a corner of the
sea, in the land's search and in a boat's (no launch at a causeway). A track's is not: his painter lays water over a track
(a ford). The beach's sinking beside it is MAC2's law (the player swims where the surface draws water: a shore tile's
water corners) and was not changed. The comments that said his data never routes a road over water (`roadPainter.js`,
ROADS 2 in `03-World/Roads.md`) are struck.

THE FOUR HOSTS. The planner is pure; the hosts' `planRoute` calls are unchanged.

PINS. `test/systems/travel/rpt1026_world_causeway.test.js` (4: Grayidge to Westwall on the road over (72, 131), with a
boat to hand too; the 40-pixel coast road walked end to end; the inlet's tiles as the terrain kernel paints them; the law,
synthetic). PIN MOVED: `tv2_click_to_move.test.js`'s "a road laid over the strait joins nothing" - it joins the two now;
`tv2.json`'s TV2-route-swims and AUDIT-DEEP-T2-5-swim-the-corner re-aimed. Mutants: RPT1026-CAUSEWAY-the-sea-under-the-road,
-the-corner-refused, -the-boat-launches, -a-track-paved, -one-end-asked (5).

### STAND-THROUGH (171) - `src/player/motor.js`

WHAT DFU DOES. PlayerHeightChanger.CanStand (`:525-531`) sweeps a sphere 0.45 m up from the crouched controller's centre
- clear to feet + 1.25, the camera's rise - and DoStand (`:265-283`) raises the controller to 1.8 whatever stands over
it. Unity's CharacterController never crosses a plane: the head clips.

WHAT THE PORT DID. The stand was DFU's (AUDIT 64 F5), but the port's collider reads no face's facing: under a ceiling
1.25-1.45 m over the feet the standing head sphere's centre (feet + 1.45) stood on the ceiling's far side and was pushed
out that way - AUDIT 64 F5's own recorded RESIDUE ("the head sphere resolves from ABOVE the plane"), worse than it said.
Measured through the real motor: crouched under a ceiling tilted 10 degrees at 1.35 m with a room's floor 0.15 m over it,
one stand put the body on that floor, 3.8 m along. A stand pressed at the top of a crouched jump does the same - the
report's crouch-jump, and its loot taken from the room overhead through its floor. What was NOT reproduced: a jump into a
steep overhang, an overhang's wedge or a sloped roof meeting the floor (through the real motor: 2,025 runs into roofs
of 15 slopes, 35 to 82 degrees, with every crouch timing; 300 into random overhang wedges; 1,472 crouch-jumps under
Privateer's Hold's 508 steep down-facing faces, on the player's data): none passes a face.

FIXED - a departure from CanStand for that 0.2 m band (Port-Ledger A, STAND-THROUGH). `standHeadClear`: the stand is
refused, as CanStand's own refusal is (retried until timerFast, then forgotten), where the line the head's centre rises
along - from the capsule's head now to the standing capsule's - crosses a face. 1.45-1.8 m stands as DFU stands it.

THE FOUR HOSTS. The motor is every host's; no host line moved.

PINS. `test/player/rpt1026_world_standthrough.test.js` (4: the tilted ceiling and the room above; flat ceilings at 1.3 and
1.4 refused, 1.5 and 1.7 standing, 1.2 DFU's own refusal; the stand at the top of a crouched jump; the law). PIN MOVED:
`audit64_motor.test.js`'s "a 1.4 ceiling PERMITS the stand" is 1.6 now. Mutants: RPT1026-STAND-THROUGH-the-heads-line-unasked,
-the-cameras-rise, -from-the-heads-top (3).

### FAR-QUAY (200) - `src/systems/naval/harbourBook.js`, `src/scenes/world.js`

WHAT THE PORT DID. HARBOUR-REACH's far sounding (`03-World/Holdings.md`) stood, but the world host's feed kept it from
running for a Bay port whose quays stand on a shore 2 pixels off its town: `navalHarbourNear` named ONE town, from the
3 x 3 pixels about the player, and its readiness read every unbuilt pixel of the ring's box as land - though most of that
box is the town's own dry ground, never streamed about a ship at sea (DFU's TerrainDistance 3) - and its far edge read one
pixel past the ring. Measured on the player's data, a ship at each of the 36 far harbours' first berths, the world built
as DFU builds it about her: the old law sounded 12. 7 first berths lie 2 pixels off their town (Daggerfall, Wayrest,
Holwych, Ripmore, Isfakabi, Pencart, Gallocart) where the 3 x 3 found no port; Pencart's lies within a pixel of Longham,
and the nearest port alone was named; 16 more waited on the pixel past the ring. With no quay standing, the harbour
office's sea errands to those ports could not be done.

FIXED (Not a DFU member - QUAYS). The host names every port town in the 5 x 5 ring (`HARBOUR_TOWN_ORDER`, the 3 x 3
first, as before); each is handed as `harbourOf` hands it (its footprint and readiness, moved out of the host); the book
sounds each. The readiness's box is half-open (`EDGE_IN`); a pixel is known where it is built, or where the noiseless
height map holds every sample above the sea (`dryPixel`, a strict lower bound - no water can stand there, a location's
flattening keeps it so, Deep Waters carves only under water). AUDIT HOLDINGS O1 kept: the harbour sounded equals the
whole ring's, to the bit, for all 36.

THE FOUR HOSTS. `bootWorld`'s feed (no growth, hostceiling green); the other hosts have no sea or no harbour.

PINS. `test/systems/naval/rpt1026_world_farquay.test.js` (6: the 36 on the player's data - every one sounded, equal to the
whole ring's, the old law's 24 missed by name; the order; the dry-pixel law; the half-open box; the book over a list;
by source). PINS MOVED (the host's lines now the book's): `fb1020c_harbourreach`, `auditholdings`, `shiplife`,
`sealanes`, `auditcaptsea`, `etherplaces` (tests), and their records in `fb1020c_harbourreach.json`, `sealanes.json`,
`etherplaces.json`, `auditcaptsea.json`. Mutants: RPT1026-FAR-QUAY-* (7), dead; the re-aimed five dead. Doc:
`03-World/Holdings.md` (HARBOUR-REACH's two leftovers closed). Left recorded: a Deep Waters berth's depth is not measured
(unchanged).

### CONFIRM-REREAD, CONFIRM-ONCE (252) - `src/scenes/decor/decorTool.js`

Driven through the real decorator, its real bar (`ui/decorPanel.js`) and the click's own path (mousedown, mouseup, click on
the bar's Confirm with the look unlocked - the decorator's capture listeners leave an unlocked press to the page).

WHAT THE PORT DID. A home's draft reads the room's revision once, as it opens, beside the host's own read of the room. A
read the account service left unanswered (a stalled request is given up after 10 s and answered offline - the overloaded
database DECOR-BATCH records) left the draft with no revision: every Confirm of the visit said the room could not be read
and sent nothing, and the standing poll never mended it while the draft had changes (it remembers the first revision it
hears, and stands down while the draft is dirty). And while a Confirm was on its way the bar said nothing, so a second
click sent the same batch again: the service answers a repeated transaction with the first's receipt, and the client paid
the purse again - one piece paid twice.

FIXED (the port's own decorator - not a DFU member). Confirm reads the room again where the draft has no revision
(`rereadRev`) and takes it only for the room the draft began from; a room another hand changed since is the service's own
stale-revision refusal (`decor-rev`), never written over; a read that fails again says so, and the draft stands. A
Confirm on its way is not sent again (`d.keeping`), let go when it ends.

PINS. `test/scenes/decor/rpt1026_world_decor.test.js` (CONFIRM-REREAD 2, CONFIRM-ONCE 1). Mutants: 3 + 2, dead.

### DECOR-VERBS (244) - `src/systems/decor/decorLook.js`, `src/systems/quickLoot.js`, `src/ui/worldPlaque.js`, `src/scenes/decor/decorTool.js`, `src/scenes/worldModes.js`

Driven through the real decorator in the caravan's, a ship cabin's and a house's room at 0.0.392 (the report's build),
0.0.404 and now: by the plaque's row (`act('move')`) and by the panel's In this room Move, the next left click stands the
piece where it is set down - the decorator itself was never the fault (pinned as a guard). What a click on a piece does
is the host's: tryExit's decor arm runs the plaque's lit row, else the piece's own use.

WHAT THE PORT DID. Since the overhaul of 2026-10-24 the Decorate button opens the flight, and a placed piece is moved by a
press on it, the plaque's lit row (Move first). The plaque is drawn on the enhanced skin alone, never on a touch screen
nor on the classic skin with quick loot off (`worldPlaqueOn`, `classicPlaqueOn`), and the interior host's namer names
nothing with World Tooltips off - there no row was folded, and a press on a piece opened its chest or did nothing; the
one Move left was the catalogue's In this room, where the old menu had kept it.

FIXED (the port's own). A decorator that browses asks for its verbs (`wantPlaqueVerbs`); where no plaque is drawn the
seam folds its frame with its first verb alone (`decorPressFrame`, the decorator's keys alone - `decorVerbKey`): a press
on a piece is Move, on the room's own furniture Take out, on a swing door Remove - what it is on the plaque - and no wheel
steps a list nobody sees. The interior namer's World Tooltips gate lets the decorator's keys through while it browses -
the one statement, createWorldModes grows by nothing (11,025 of 11,025).

PINS. `test/scenes/decor/rpt1026_world_decor.test.js` (the press on the classic skin with quick loot off, the law, the
host's gate, the guard). PIN MOVED: `test/ui/enhanced/enhancedInventory.test.js` (the seam's first act admits the verbs'
line); `disc22c_classic_loot.test.js`'s draw line kept by the order of the statements. Mutants: 8, dead;
`worldhover.json`'s two gate records re-aimed (dead). Doc: `06-Systems/Online-Arc.md`, the closing section.

### The sea-brake guard (193, 274) - `test/systems/naval/rpt1026_world_seabrake.test.js`

Not a fix: the coordinator's question - is a brake left on after a fight, or near a cutter? - answered no on the real
naval host. (AUDIT RPT1026 J3: the cutter's test now asserts the cutter and the pirate are engaged with each other - it
asked nothing of the fight it is named for; mutant AUDIT-RPT1026-J3-the-cutter-stands-off.) A pirate's repel haul holds my way only while it hauls (by HAUL_MAX_S), and nothing of it is left after the
fight; a navy cutter alongside fighting a pirate takes nothing (no brake, no haul, no warp; her hurts alone). The
10-23 patch (#1177: DECK-POSE, SEA-DECK, SEA-DROPS) touches none of her way; SEA-DROPS's own replay pins its answers.
Recorded on `03-World/Naval-Refit.md` beside BOARD-MAGNET.

### Not fixed here - what would prove each

- **#6** (0.0.235): traced in FIELD BUGS 2026-10-19f (no spawner reads the player's invisibility; a foe replaced never
  fires again). The dungeon's name, or a recording, would let the dungeon and quest lanes read its spawners.
- **#86, #136** (the same player): staff read the account's `homes` rows and the house the client stands for that
  building key in Daggerfall city (the town's layout pins, `systems/layoutPins.js`; ARENA4b's moved homes) - the house
  they see against the one they paid for.
- **#93**: the town's homes are read again at a knock; whether the owner's sign-in read came back empty needs the
  account's sign-in log for that session.
- **#122**: staff read the character's `boatCabinLink`, `ownedShip`, boats and scene cache; the bank cabin's room is
  moved whole by the link (`systems/boatCabinOwnership.js` linkBankCabin) - relinking it needs one boat or deed of the
  cabin's type to point at.
- **#126, #158**: staff read the character's saved spot; outdoors the player's own `/unstuck` walks to the nearest town
  (PVPUNSTUCK). #158's place would test the one gap on record (Player-Arc UNSTUCK-OUT: the collider's bilinear floor
  under a landform ridge's drawn triangles).
- **#193**: her hull, her load (her hold, what the player carries, the wagon's load), the Ship handling chosen (Classic or
  Responsive), and whether the screen said she was heavily laden.
- **#208**: the account's family (its seat) and how the characters were made; a character made from the menu founds its
  own house.
- **#274**: whether she was at her helm when she froze (a boarding's fight puts the player on her deck; she is taken back
  to the wheel after it), whether another hull lay against hers, and her hull and load.

## The client: crashes, settings and the Firmament (RPT1026-CLIENT)

| | Report | What it was | Done |
|---|---|---|---|
| 206 | Every Accept in the Firmament throws an IndexSizeError (an arc of negative radius), and the red report covers the health bars and hotkeys until a restart | A star's burst was stamped with `performance.now()` and drawn by the `requestAnimationFrame` clock, which hands every callback of a frame that frame's START: a burst stamped later in the frame (Accept's answer, after the world's own frame callback) was younger than nought, and its ring's radius went below it. The crash report had no way off it over a session that ran on | RPT1026-CLIENT SPARKS, DISMISS |
| 9 | A Weir Key moved to the wagon or a container is back in the pack at the next login | The pack's key is the face of the account's balance, restacked off the pack alone; a face stowed elsewhere counted nothing and the pack was minted another | ALREADY FIXED: KEY-FACE (`Field-Bugs-2026-10-19f.md`) |
| 41 | All eight Weir Keys lost on using one | The eight were faces the account never held (stowed and carried back, KEY-FACE's record); the open staked the one real key and the answer restacked the pack to the balance. The open never restacks on a refusal or a lost answer (`egClient.js` open) | ALREADY FIXED: KEY-FACE |
| 83 | Weir Keys change number in the pack from more than one back to one | KEY-FACE's one open door (sent before it merged): the dungeon find's throw restacked the pack to the balance less that one face, so a second find before the first body was looted, or a balance answer before the take-up, showed a key the account never held, and the next answer took it back | RPT1026-CLIENT WEIR-FACE |
| 163 | With VSync off in the desktop app the game runs uncapped (the cap defaults to Off), churning garbage a thousand frames a second | FPS-VSYNC followed DFU's VSync off with no target frame rate: frames as fast as they go | RPT1026-CLIENT LIFTED-CEILING |
| 2 | Firmament stars selected, the bonuses do not apply | The tree in force comes only from a read of the service, and the world host read once: a failed first read left a classic-HUD character with no stars until a Renown rise; nothing said whether the stars acted | ALREADY FIXED: FIRM-RETRY + FIRM-STATUS (`98930c243`) |
| 97 | Firmament health regeneration and health on a kill stopped working | The same unread tree, or a sleep by design: the combat stars sleep in a duel or Arena bout, while mentoring (automatic in a party 3+ levels below), and with the seat in another tab; bodies the relay runs report no kill | ALREADY FIXED: FIRM-RETRY + FIRM-STATUS |
| 134 | Flat Firmament stats apply past the cap, % increases (Speed) do not | Not reproduced: a small star's share lifts a maxed attribute (FIRM-MAX: 100 Speed + 2 + 2% reads 104). A share is floored (1% of a Speed under 100 is 0) and the raw and the percent share one +15 budget | NOT REPRODUCED |
| 243 | The Firmament gives nothing at all, however it is specced | FIRM-RETRY's case, sent an hour before it was written from a report of the same failure ("Firmament fully bugged and im not getting any benefits from it"): the unanswered first read | ALREADY FIXED: FIRM-RETRY + FIRM-STATUS |
| 52 | Maximum health 134 fell to 34 on entering a castle, no illness | Traced (below): the online layer (Renown's health, LEVEL-EVEN's floor, the Firmament's health) is the only part of the maximum that can leave at once; a 100-point drop to a level-one body is that layer off. What turned it off on this character is in its data | NEEDS DATA |
| 147 | Health dropped to 61 after an update and never rose again, no debuffs | The same trace | NEEDS DATA |
| 155 | Health points lost during a level-up | Traced: a level-up adds DFU's roll to the stored maximum and moves no current health (`advancement.js` applyLevelUp, `oblivionLeveling.js`; AUDIT LEVEL-EVEN L2-1 took out the one way an online level-up did, LEVEL-EVEN's own first cut, which the reporter's 0.0.241 predates). Read with the same reporter's #160, the loss is a gain of DFU's floor, +1 | NOT REPRODUCED |
| 160 | Maximum health does not change through level-ups, stuck at its level-one value | DFU's own law on that build: CalculateHitPointsPerLevelUp adds at least 1, and a low Endurance takes a small class's roll to that floor. LEVEL-EVEN floors the online maximum at the class's average roll with the Endurance held now | ALREADY FIXED: LEVEL-EVEN (`Field-Bugs-2026-10-19b.md`) |
| 188 | The stats low again, with nothing more said | With #186 (the same reporter, minutes before): stats, maximum magicka and the Firmament's regeneration all down at once is the online layers asleep - the seat out (another tab, window or device) or the tree unread | NEEDS DATA |
| 146 | Spell points stopped regenerating while travelling the Overworld, came back briefly, then not for two game days | No natural magicka regeneration exists (DFU's: only rest); what regenerates is the Firmament's Font of Magnus and Clarity, Soul Siphon and the wellspring. The rounds run on the Overworld's clock as anywhere (`worldTick.js` runMagicRoundsFor's hooks). The stars' one bug was the unread tree | ALREADY FIXED: FIRM-RETRY + FIRM-STATUS |
| 186 | Spell points do not regenerate, and about 150 of them are gone | The maximum's online terms (Renown's, the Firmament's) and the stars' regeneration leave together when the stars sleep or the tree was never read | ALREADY FIXED: FIRM-RETRY + FIRM-STATUS |
| 96 | Every spell landing within 14 m shakes the camera whoever cast it, and no setting turns it down (Dagon's Breach's constant tremor) | `hostMagic.js` landFx kicked Better Ambience's camera for every landing, a peer's drawn missile among them; Screen Shake On Damage is DFU's recoil, the player's own injuries; the shake's ceiling was off the mod's tile | RPT1026-CLIENT PEER-SHAKE |
| 114 | The game crashes talking to the fast-travel woman in Wayrest | OFFERING-RAY: a Hearth Offering's target handed the street's one ray a 6-array where it reads `{ min, max }`, so every press in a street with one threw | ALREADY FIXED: OFFERING-RAY (`Field-Bugs-2026-10-20e.md`) |
| 115 | Any interact (E, left click) crashes | The same | ALREADY FIXED: OFFERING-RAY |
| 116 | Every interact crashes since a Morrowind folder was used, a TypeError in the world tick | The same stack, frame for frame: OFFERING-RAY's record reads `Qv <- bye <- i <- oy <- fy <- exteriorActivationHit`, `rayAabb` on an offering's 6-array. The Morrowind folder was the day's coincidence: the festival's offerings stood that day | ALREADY FIXED: OFFERING-RAY |
| 178 | A pad's A on the world map throws a NotFoundError from setPointerCapture, stuck until a reload | The pad's press is a synthetic pointer (id 1, the mouse's in Chromium); Firefox holds no pointer 1 and refused the map's capture with a throw out of its listener | RPT1026-CLIENT PAD-CAPTURE, DISMISS |
| 85 | The game's lost-graphics message, which blamed a phone's memory, on a PC, loading into an Oblivion Gate | The browser lost the game's WebGL context (`webglcontextlost`). Nothing in the game lets the main context go but the page's own going (GL-LEAK); the line blamed a phone | NEEDS DATA (the words: RPT1026-CLIENT GL-SAID) |
| 81 | FPS drops massively while travelling since the day before | Sent the day before OW-HITCH, which measured an Overworld journey frame by frame in the real game and took its hitches out (the grass's cell frees, the collector, the snow's catch-up, the ground sets) | ALREADY FIXED: OW-HITCH (`e394529e8`) |
| 82 | FPS lower in general since an update | Sent minutes after #81 by the same reporter from the same build (0.0.281), and tied to it in its own words; sent before OW-HITCH, whose hitches were the Overworld's. If the drop is #81's, OW-HITCH took it out; no scene or numbers to measure what stays (AUDIT RPT1026 K4: this row had read "no build named") | NEEDS DATA |
| 129 | Stutter from three "Cast When Held: Tongues" items (Pacify checks?) | Traced: a held item's work is once a game minute (the magic round's payload, its reroll every six hours), not once a frame; the pacification roll is an edge, one roll a foe at first sight (`hostCombat.js` tryLanguagePacification) | NOT REPRODUCED |
| 184 | FPS drops, nothing changed (under the "No freeze at the first aura, smoother fast travel" notes) | No scene or numbers | NEEDS DATA |
| 260 | Lag spike and CPU use in a Magor tavern, the Flying Scorpion | A tavern; no profile | NEEDS DATA |
| 164 | On Linux the temp folder grows by gigabytes over long travel | Nothing the app writes goes to the temp folder during play (the one `os.tmpdir()` write is Windows' registry probe, `arena2Detect.cjs`); the game's files, the GPU cache (capped, GPU-CACHE) and the updater live under userData and the cache folder. Which folder grew, and with what, is the player's machine's | NEEDS DATA |

### RPT1026-CLIENT SPARKS (206) - `src/ui/firmamentWindow.js`

WHAT DFU DOES. Nothing to follow: the Firmament is the port's own.

WHAT THE PORT DID. A star allocated, a sign chosen or Accept's added stars each burst - a ring growing 60 px from the
star and eight sparks out to 90 px over 900 ms (`firmamentWindow.js:"  function sparks(t) {"`). `burst` stamped `t0`
with `performance.now()`, and `sparks(t)` drew it by the frame clock `requestAnimationFrame` hands its callback. Every
callback of one frame is handed that frame's START, and Accept's answer lands in a microtask - after the world's own
frame callback, which can run for half a second - so a burst stamped in that frame was younger than nought when this
window's callback drew it: `u = (t - t0) / 900` below 0, and `NODE_R + u * 60` below 0 for the 900 ms the burst stays
(the report's -21.27 is a notable's 16 px ring at u = -0.62, a frame begun 560 ms before the stamp). The arc threw
IndexSizeError on every Accept; the window's loop asks for its next frame first, so the sky went on and the throw
reached the page: the crash report.

FIXED. A burst starts on the first frame that draws it (`t0` null at the burst, `b.t0 ??= t` in `sparks`): one clock,
so its age is never below nought. Every other `arc` in the file (the dust, the edges' arcs, the stars' own rings) reads
no clock; `firmamentOver.js` draws none.

PINS: `test/ui/rpt1026_client_firmsparks.test.js` (1: the window's own loop on a canvas that throws as the browser's
does on a negative radius - a burst whose frame began 560 ms before it, drawn at the star's radius, half grown at
450 ms, over past 900).

### RPT1026-CLIENT DISMISS (206, 178) - `src/main.js`

WHAT THE PORT DID. `crashOverlay` puts up the red report for every uncaught error and rejection. Its comment assumes a
dead frame loop, but a throw from a window's own frame or an input listener leaves the game running - and the report
stood over the HUD (bottom 45% of the screen, click-through since PL3) for the rest of the session. FIELD BUGS
2026-10-02c KEY-BOOT had written it down ("no dismiss") and left it.

FIXED. The report keeps its click-through body and gains one button after its text, the only part that takes a click
(`main.js:"function crashDismiss(el) {"`): Dismiss takes the report down. A second throw's text replaces the children,
so the button is put back each time; its click goes no further, so it never reaches a lost context's tap-to-reload
beneath it. A probe's first line under CRASH is still the error's (`tools/bootProbe.mjs`). English, as every line of the
report is (main.js loads before the text core).

AUDIT RPT1026 K2. A lost graphics context's report is the one report the game does not run on past: nothing draws
again on that page, and the report is its way back (click or tap to reload). It carried the Dismiss too, and dismissed
it left a dead picture with nothing on it to say how to reload. It is kept now: crashDismiss puts no button on a report
marked kept, and the context's loss takes off the one a report already up had (`main.js:"  if (el._kept) return;"`).
Every other report keeps its Dismiss. Pinned: `test/scenes/audit_rpt1026_client.test.js` (K2, 2).

PINS: `test/scenes/rpt1026_client_crashdismiss.test.js` (2 - one here: the report and its button through main.js's own
two functions on a document that keeps a real element's rules). PIN MOVED: `test/ai/nav/audit68_enemies.test.js`
S02-contextlost-tap-dead runs `crashDismiss` beside `crashOverlay`, its fake elements given `appendChild`.

### RPT1026-CLIENT WEIR-FACE (83; 9 and 41 KEY-FACE's) - `src/systems/eliteGates/weirKey.js`, `src/systems/eliteGates/egFind.js`, `src/systems/item/itemInfo.js`

WHAT DFU DOES. Nothing to follow: DFU has no Weir Key and no online.

WHAT THE PORT DID. The account's count (`players.eg_keys`) is the balance, the pack's stack its face, restacked by every
answer that carries the count. KEY-FACE (FIELD BUGS 2026-10-19f) made the face pack-only and folded faces out of the
pack at a load, and left one door open, in its own words: "the find's own throw is the one face still made outside the
pack". The throw put a face on the elite's body and restacked the pack to the balance less THAT face
(`keys - (onBody ? 1 : 0)`). A second find before the first body was looted restacked to the new balance less one, so the
pack and the two bodies showed a key the account never held; and any answer before the take-up - the keys asked every
ten minutes, a preflight, a claim - restacked the pack to the whole balance, so the face taken up after it made the pack
one over. The next answer took the extra back: *The key turns to rust.* - the stack fell to one. The open
(`egClient.js` open) restacks only on the service's yes, never on a refusal or a lost answer: #41's eight were KEY-FACE's
faces.

FIXED. Every face thrown is kept with the body's list it lies in (`weirKey.js:"export function throwWeirKeyFace"`), and
every restack sets the pack to the balance less the faces still lying (`weirKey.js:"const want = Math.max"`):
one taken up - gone from its list, whatever door took it - leaves the count, so the pack and the bodies always show the
balance together. Out of the dungeon (the find's tier door, `setWeirKeyFacesHere`, null outside a dungeon) the faces left
behind are folded off their bodies at the next answer, so a dungeon entered again shows none and the pack holds
the whole balance; a load keeps none as lying (`foldStrayWeirKeys`, KEY-FACE's fold, clears the list); the find let go
keeps none. The throw is now `throwWeirKeyFace` then the restack to the balance
(`egFind.js:"if (Array.isArray(entity?.items))"`).

THE WORDS. Nothing the player saw said the keys are the account's. The key's card carries, under its own line, *Every
character on your account shares the same Weir Keys.* (`itemInfo.js:"export const weirKeySharedLine = () =>"`,
`eg.key.shared`, drafted in the thirteen whole languages with the key's name as each table already says it). Not in
`EG_TEXT`: that table rides the relay's bundle, and a line there moved the relay's law (`test/net/relayversion.test.js`)
for words the relay never reads - so no RELAY_VERSION is owed.

Docs: `11-Multiplayer/Elite-Gates.md` section 5 (the OPEN sentence struck, "The faces lying on bodies count" in its
place, the card's line); `Field-Bugs-2026-10-19f.md` KEY-FACE's "Left open" closed, its two anchors moved to the lines
as they read now.

AUDIT RPT1026 K1. "Out of the dungeon" was read only at an answer, and an answer comes every ten minutes: out of one
dungeon and into the next (or into the same one, which the world's modes build anew at every entry) before one landed
outside, the faces of the visit before were still counted as lying - on bodies its context took with it - and every
restack there held the pack a key short of the balance for each, none of them on any body to take up, until an answer
landed outside again. A face is kept against the visit it was thrown in: the world host's door is
`egFind.js:"export const egFindPlace"` (the dungeon's tier and its context), and a face of another
visit is folded as one away is (`weirKey.js:"foldLyingWeirKeys((e) => e.at !== here)"`). A find answered after the
player left the visit it was asked in puts its key in the pack, not on the body left behind. The world host's entry is
rewritten in place (`placeNow` for `tierNow`), no host line added. Pinned: `test/scenes/audit_rpt1026_client.test.js`
(K1, 5); PIN MOVED: `test/scenes/eliteGates/egeco_hosts.test.js` reads the world's `placeNow`.

PINS: `test/systems/eliteGates/rpt1026_client_weirface.test.js` (4: two finds through the real find and the world host's
own throw, each body taken up by `inventory.js` takeOneInto - the balance, never three; a balance answer between the
throw and the take-up; out of the dungeon the face folded off and the pack whole, and a load's fold keeping none as
lying; the card's line under the key's own). Mutants re-aimed by content: `egeco_relay.json`
EGECO3-the-pack-the-whole-balance (now the restack that ignores the lying faces) and EGECO3-PL-pack-short (a room's body,
no face, the pack short), `egaudit5_c.json` AUDIT-EG-V-c-L8-6-line-unshown (the arm with its second line) - each judged
again, dead.

### RPT1026-CLIENT LIFTED-CEILING (163) - `src/systems/frameCap.js`, `src/ui/settings/settingsCopy.js`

WHAT DFU DOES. `StartGameBehaviour.ApplyStartSettings` (StartGameBehaviour.cs:244-250): with VSync off a TargetFrameRate
of 30 or more is `Application.targetFrameRate`; under it (the default, 0) the target stays -1 and frames run free.

WHAT THE PORT DID. FPS-VSYNC kept DFU's rule in the desktop app: VSync off lifts Chromium's wait at launch
(`app/lib/frameRate.cjs`) and the pacer holds the frames to the cap - Off handing every request straight through. The
report measured the result: a thousand frames a second and more, about 3,760 garbage collections in ten seconds against
28 capped, the heap's peak 77% higher. Whether it caused the crashes it suspects is not proven; the churn is.

FIXED - A DEPARTURE. Where the shell lifted the wait (`installFramePacer`), Off holds at `LIFTED_OFF_FPS`, the row's own
top, `FRAME_CAP_MAX` (300): never faster than any rate the row offers, past every screen the stops name
(`frameCap.js:"return frameCapRate"`).
A cap the player chose stands; a browser and the app with VSync on are unchanged (the screen paces them, and Off is no
cap). The FPS counter's pace line reads `vsync off  cap 300`. The report's other asks are not done: a warning beside the
two rows (the ceiling takes its case away) and the crash log's lines.

THE WORDS. DFU wrote no tip for the Frame Rate Cap; the row's is the port's own now (`settingsCopy.js` portTip,
`menu.settings.tip.frameCap`): *The most frames a second the game draws. Off lets your screen set the pace. In the desktop
app with Wait For Screen Refresh off, Off still holds the game at 300 frames a second.* Drafted in the thirteen whole
languages, the setting's own label kept in English as the screen shows it.

Port-Ledger A: FPS-CAP1's row narrowed (Off's ceiling where the wait is lifted). `07-Rendering/Rendering-Arc.md`
FPS-VSYNC: "Off lets them run free" narrowed, OFF HAS A CEILING added.

PINS: `test/systems/rpt1026_client_framecap.test.js` (3: the real install on a page whose compositor answers every ask
half a millisecond later - Off draws 300 a second; a chosen 60 draws 60, a browser's Off is no cap; the row's tip).

### RPT1026-CLIENT PEER-SHAKE (96) - `src/scenes/hostMagic.js`, `src/systems/uiPrefs.js`, `src/ui/enhanced/enhancedMenu.js`, `src/ui/settings/settingsMap.js`, `src/ui/settings/settingsCopy.js`, `src/systems/features.js`

WHAT DFU DOES. Nothing to follow: DFU's missiles kick no camera (IMPACTFEEL is the port's), and Camera Recoil Strength
is the shake a hurt player takes.

WHAT THE PORT DID. Every landing missile kicked Better Ambience's camera (`betterAmbience.weaponKick`), 3 for a bolt
and 4.5 for a blast, falling off over 14 m - mine, a foe's, the sun baby's fire, and another player's drawn missile
(SPELLFX1's `visual`, its caster named), whose landing runs the same impact code. FIELD BUGS 2026-10-06b had recorded it as
"a call about the feel, ... open, for Mac". In a crowd that casts the shakes overlapped into a tremor. Screen Shake On
Damage never covered it, and the one dial that could cap it (`Camera Shake.maxShake`) was off the mod's curated tile.

FIXED. Another player's missile kicks at the share the player chooses (`hostMagic.js:"  const peerKickShare = (/** @type {any} */ m) => {"`):
*Shake from other players' spells*, Full, Half (the default, as the report asked) or Off (uiPrefs `peerSpellShake`),
in Settings > Accessibility > Motion beside the recoil. Mine, a foe's and an event's sky fire keep their whole kick. The
recoil's label reads *Screen Shake When Hurt* (DFU's tip already says "when player takes damage"). Better Ambience's
tile carries Camera Shake's ceiling (`features.js` MOD_CURATED).

THE FOUR HOSTS. The kick is the one cast engine's (`hostMagic.js` createPlayerMagic), which `world.js`, `worldModes.js`,
`dungeonContext.js` and `exterior.js` each build - no host line moved. The row is the menu's own (`enhancedMenu.js`
portPool), on both skins' settings screen.

THE WORDS. `menu.motion.peerShake.name`, `.note`, `.full`, `.half`, `.off`, drafted in the thirteen whole languages.

PINS: `test/scenes/rpt1026_client_peershake.test.js` (3: a peer's bolt through the real engine at Half, Full twice
Half, Off none, an area blast too; my own bolt's whole kick whatever the share; the row beside the recoil, the recoil's
label, the tile's ceiling). The L10N4 ratchet's `features.js` count 127 -> 128: the mod key `'Camera Shake.maxShake'`,
which the scan reads as words as it reads its three neighbours. PIN MOVED: `test/ui/settings/settingsUI.test.js` SO1 reads the port pool with the row in it.

AUDIT RPT1026 K3. The pins held two claims above by nothing: an event's sky fire keeping its whole kick (a peer's
share on it survived every pin) and the row's own values (Full 0.75, Half 0.25 or Off 0.1 survived). Pinned now through
the engine's own skyFire at the share Off, and through the menu's own row (portPool) pressed through Off, Full and Half
with the kick each gives: `test/scenes/audit_rpt1026_client.test.js` (K3, 2).

### RPT1026-CLIENT PAD-CAPTURE (178) - `src/ui/pointerCapture.js`, `src/ui/heldMap.js` and ten more

WHAT THE PORT DID. A pad's press is a synthetic pointer (`plusPad.js` domPointer, `enhancedDialog.js` replayClick:
`pointerId: 1`, the mouse's id in Chromium). Firefox numbers its mouse 0 and holds no pointer 1, so
`setPointerCapture(1)` threw NotFoundError, out of the held map stage's `pointerdown` listener (each of its four arms -
the turn, a pinch's second finger, a control's press, the pan) to the page: the crash report.

FIXED. A capture is a drag's comfort, never its law: refused, the press still lands where it was pressed. Every capture
and release in the game's own windows goes through one door that answers a refusal
(`pointerCapture.js:"export function capturePointer("`, releasePointer): the map's four, the Firmament's sky, the
charts, the sky window, the work board, the pack's figure, the deck plan, the family tree, the chat's grip (both) and
the POI editor's. The six that catch their own refusal on their line stand - four captures and two releases, in five files (AUDIT RPT1026 K5: this said four; the door's own line said a missing element answers false, and it answers true - nothing to refuse). The labs under `src/tools` are pages of
their own, mouse alone. Docs: `10-UI/Held-Map-Arc.md` PAD-CAPTURE; `10-UI/UI.md` counts the module (420).

PINS: `test/ui/rpt1026_client_capture.test.js` (3: the press through the pad's own dispatch on a held map whose stage
refuses as Firefox does; the door; a sweep of `src/` for a capture outside it). `chatsize.json` CZ-capture-dropped
re-aimed by content (dead). PIN MOVED: `test/systems/legacy/auditlegacy.test.js` U2/U6/U10 reads the family tree's capture through the door (and refuses one at the press either way).

### RPT1026-CLIENT GL-SAID (85) - `src/main.js`

WHAT THE PORT DID. A lost WebGL context put up "the graphics stopped (often low memory on a phone)" - written for a phone
report in August. The browser says only THAT the context is gone: a phone short of memory, or on any machine the
graphics driver resetting the card (a long GPU stall, a driver update, the card's own memory). Nothing in the game lets
the main context go but the page's going (GL-LEAK, `main.js` onPageGone); the gate's veil holds a context of its own,
let go with it.

DONE. The line names both and blames neither: *the graphics stopped: the graphics card was reset, or ran short of memory*
- then *click or tap here to reload*. The loss itself is NEEDS DATA (below).

PINS: in `test/scenes/rpt1026_client_crashdismiss.test.js` (1: the handler's own line, no phone in it).

### The Firmament and the spell points (2, 97, 134, 243, 146, 186) - already fixed, one not reproduced

WHAT THE PORT DOES. The tree in force is the service's, read by the book (`firmamentBook.js`), and in force online alone
(`firmamentLive.js` firmamentInForce). The combat channels - the attributes, hpRegen, killHeal, mpRegen, killMana among
them - sleep (`firmamentPowers.js` firmamentAwake) in a duel or an Arena bout, while mentoring (automatic in a party
whose level is MENTOR_MIN_GAP or more below), and offline (the seat in another tab, window or device). Bodies the relay
runs report no kill (FIELD BUGS 2026-10-26 #3). No natural magicka regeneration exists: DFU's comes only from rest, and
the port's from the stars, Soul Siphon, the wellspring and the Arcane paths. The magic rounds run on the character's
own clock in every host, the Overworld's journey included (`worldTick.js` runMagicRoundsFor and its round hooks).

THE BUG, ALREADY FIXED. FIRM-RETRY (`98930c243`, 2026-10-25, in THE FOLD #1280): the world host read the tree once, at
the first Renown; a read the service never answered left a classic-HUD character with no stars - no stats, no
regeneration, no kill heal - until a Renown rise or the Growth tab. The book now reads again by itself. FIRM-STATUS
(the same commit) puts the reason the stars sleep in the Firmament window's side panel. #243 is FIRM-RETRY's case, sent an hour
before it was written from a report of the same failure; #2, #97, #146 and #186 have its shape (the stars wholly off, or off and back for a while). What a player sees now: the side panel's line - "Your accepted stars are active", or why not.

#134, NOT REPRODUCED. `firmamentPowers.js` attributeGain lays a small star's share of the permanent value on top of a
maxed attribute, FIRM-MAX lifting its ceiling (`test/systems/firm1_powers.test.js` FIRM-MAX: 100 Speed, the Steed's +2
and the Path's +2%, reads 104 - and the motor reads a live Speed past 100, `motor.js` walkSpeed). Two laws make a share
look dead: it is floored (`pctOf`: 1% of a Speed of 99 is 0), and the key stars' raw points and the small stars' share
hold ONE budget, +15 (AUDIT UICALM-FIRM1 L1 H1) - a Speed already +15 from key stars takes nothing from a percent star.
Tell the player: the window's sums show what each channel holds against its cap.

### Maximum health (52, 147, 155, 160, 188) - traced; one already fixed, one not reproduced, three need the character's data

WHAT LOWERS OR HOLDS THE MAXIMUM. `chargen.js` defineLiveMaxHealth: the stored maximum (`rawMaxHealth`, saved), held
under a lycanthrope's limiter while the urge rises (`lycanthropy.js`, DFU's: 24 a day down to 4, "You need to hunt"),
plus the ONLINE LAYER (`renownLayer.js`: Renown's health, LEVEL-EVEN's floor, the Firmament's health - never saved), plus
the Spire's Stoneskin inside a breach. A level-up adds DFU's roll to the stored maximum (`advancement.js`,
`oblivionLeveling.js`: at least 1). Mentoring never lowers it (blows are scaled instead). The whole online layer leaves
at once when the seat goes to another tab, window or device (`world.js` leaveSeat: `setRenownLayer(playerEntity, null)`
- said in chat and over the screen, "Play online here" under the chat), and is not on until the page hears its Renown.

#160, ALREADY FIXED, and #155, NOT REPRODUCED. On their build (0.0.241) a small class's roll under a low Endurance takes DFU's floor,
+1 a level - the maximum barely moves. LEVEL-EVEN (`Field-Bugs-2026-10-19b.md`) floors the online maximum at the class's
average roll with the Endurance held now. A level-up moves no current health (AUDIT LEVEL-EVEN L2-1 took out the one way an
online level-up did, after their build). Their build is four days behind the report: their desktop app had not updated.

#52, #147, #188, NEEDS DATA. A 100-point fall to a level-one body (#52), a maximum that stays low (#147), and stats
down with the spell points (#188 with #186) are the online layer off - the seat out, or the Renown not heard - or a
lycanthrope's urge (#52 names no disease - a curse is none). Which, is in the character: staff, read its realm record
(level, career's HitPointsPerLevel, `maxHealth` stored against LEVEL-EVEN's floor for its level, Renown, lycanthropy) and
ask whether "Online in another tab or device. This one is offline." showed.

### The crashes on interact (114, 115, 116) - already fixed

OFFERING-RAY (`Field-Bugs-2026-10-20e.md`, the same day): the Hearth Offering's target (WITCH1, #1079) handed the
street's ray a culling 6-array where it reads `{ min, max }`, so every press in a street where one stood threw out of
`rayAabb` - at a body, a person, a door, the fast-travel clerk. #116's stack is that record's, frame for frame (`bye`,
the worldTick chunk); the Morrowind folder was the day's coincidence. Pinned by `test/scenes/fb1020e_offeringray.test.js`.

### Performance and the Linux temp folder (81, 82, 129, 184, 260, 164)

#81 is OW-HITCH's case (`e394529e8`, the day after: an Overworld journey profiled frame by frame, its hitches taken
out). #129, NOT REPRODUCED: a Cast When Held item's work is the magic round's (once a game minute: its wear, its reroll
every six hours - `enchantments.js` enchantmentMagicRound), and Comprehend Languages' bonus is read by one pacification
roll a foe at first sight (`hostCombat.js` tryLanguagePacification) - nothing of either runs a frame. #82, #184, #260
NEED DATA: the FPS counter's lines (Settings > Graphics > Display, FPS counter: the worst frame of the minute and its script, the
pace, the GPU) where it drops, and the place (#260: the Flying Scorpion is a tavern in Magor). #164 NEEDS DATA: nothing
the app writes goes to the temp folder during play (its one `os.tmpdir()` write is Windows' registry probe); the game's
files, the GPU cache (capped at 128 MiB, GPU-CACHE) and the updater's download live under the app's own folders. Ask for
the folder that grew and what fills it (`du -sh /tmp/* | sort -h | tail`), and how the AppImage is started: one run with
`--appimage-extract-and-run` unpacks the whole app into /tmp, a folder for each new update, and can leave it there when the app is killed.

Mutants: `tools/mutants/rpt1026_client.json` (27, all dead: SPARKS 2, DISMISS 5 with GL-SAID's 1, WEIR-FACE 6,
LIFTED-CEILING 5, PEER-SHAKE 5, PAD-CAPTURE 4). Re-aimed by content and judged again, dead: `auditretro1.json`
AUDITRETRO1-C7-no-tip (the tip's door now ends in portTip), `chatsize.json` CZ-capture-dropped, `egeco_relay.json`
EGECO3-the-pack-the-whole-balance and EGECO3-PL-pack-short, `egaudit5_c.json` AUDIT-EG-V-c-L8-6-line-unshown.
AUDIT RPT1026 (lane K): `tools/mutants/audit_rpt1026_client.json` (11, all dead - K1 5, K2 2, K3 4); re-aimed by content
and judged again, dead: `egeco_relay.json` EGECO3-the-key-not-thrown and EGECO3-PL-key-on-the-copy (the throw's line as
it reads now); `rpt1026_client.json` RPT1026-WEIR-away-not-folded names K1's pin beside its own (the visit's fold covers
every face but one laid while away, which K1's fifth pin lays).

## Screens, phones, PvP loot and legacy (RPT1026-MISC)

Fifty private reports, read on main's `d5a4c9c6a` with the freeware's data (`/home/claude/dfdata/arena2`). Fourteen
fixes; the pins are named under each, the mutants in `tools/mutants/rpt1026_misc.json` (31, all dead), and four older
records re-aimed by content (`freemouse1.json`, `menurelock1.json`, `questshelffaces.json`, `survtiers.json`, each
dead). Branch `worktree-agent-aa6f4b58488dcd75f`.

AUDIT RPT1026 (lane L, read cold with the real modules driven - the two phone screens in Playwright's Chromium, the
bed through the real interior host): three fixes did not reach the case they were for - TOUCH-FIELD's entry stood under
the Bank it typed for (L1), TALK-SIDEWAYS left a phone narrower than 720 pixels on its side with a topic list under two
rows (L2), and BED-PRESS-INDOOR's press was over before a rest that asks first opened (L3); each fixed and pinned
(`test/ui/audit_rpt1026_l.test.js`, `test/scenes/audit_rpt1026_l_bed.test.js`, every pin failing on the batch's head),
mutants `tools/mutants/audit_rpt1026_l.json` (14, all dead). HEIR-WAITS' pin had named its fallen after the report's own
character (L4, renamed), and two lines below said what the code does not (L5, L6, corrected). Each fix in code carries
an `AUDIT RPT1026 L<n>` comment.

| | Report | What it was | Done |
|---|---|---|---|
| 204 | Holding Tab a little over half a second makes the quick menu vanish | The overlay stack's Tab listener closed the top overlay - the dial - on the key's auto-repeat, though its comment said a repeat closes nothing | TAB-REPEAT |
| 153 | More than three notifications at once all stick on the HUD | The HUD text keeps PopupText's one timer (the front row's); a repeat of the BACK row put it back, so a line said again and again held every row up | TOAST-STALL |
| 191 | On a phone, HUD lines linger far too long | The same | TOAST-STALL |
| 73 | An NPC asked for news answered with a quest's words and its macros raw | The quest's progress rumor outlived the quest's removal; its telling asked for a quest the machine no longer held | RUMOR-ORPHAN |
| 172 | Three escort faces stuck on screen; turning in and abandoning quests does not clear them | A face whose quest left the machine without ending (a quest a load could not restore) had no door out, and rode every save | FACE-ORPHAN |
| 90 | A rest in a Fighters Guild hall is the rough night, a bed clicked or not | The interior host's rest kind never read the bed's press | BED-PRESS-INDOOR; through a rest that asks first too, AUDIT RPT1026 L3 |
| 192 | On a phone, Chrome's pointer-lock banner at every menu | Every relock door asked for the pointer lock on a touch screen, and Chrome granted it | TOUCH-NO-LOCK |
| 179 | The Morrowind card's Remove data seems dead, with no word | The Settings confirm was drawn into a sheet that was shut | CONFIRM-SHEET |
| 94 | Charged with Assault for a mounted Overworld journey through a town | Enhanced Riding's trample ran under a journey's gallop, unsteered | JOURNEY-TRAMPLE |
| 110 | The heritage system's heir choice went back to the menu before an heir was picked; the parent is gone from the server | The parent's tombstone is Bloodline's law at the death; the Online page's door to a waiting Succession named living kin only, never the newborn the fall offers | HEIR-WAITS; the parent: staff (notes) |
| 190 | On a phone the Bank's amount cannot be typed (the map's name field can) | The port draws a window's typed field as words, which no phone keyboard reaches | TOUCH-FIELD; its entry raised over the window, AUDIT RPT1026 L1 |
| 214 | Giants spawn inside rocks in the open zone (seen twice) | GIANT-FIELDS chose the giant's ground by the height map alone | GIANT-ROCK |
| 71 | Spells leave later with the Morrowind look than with the Daggerfall one | The classic hands release on frame 5 (0.2 s); the Morrowind arm waited for its own release key, played at the cast's rate | CAST-PACE |
| 57 | One third-person skin (set 10, a woman) shrinks while casting | The mod's own spell sheets for that set draw her a quarter smaller, at the XML's scale 1 | SPELL-SHORT |
| 159 | The talk window on a phone is off screen and cannot be used | Held sideways, the panel stood 52dvh and its topic list had no height | TALK-SIDEWAYS; narrower than 720 pixels too, AUDIT RPT1026 L2 |
| 4 | A companion's bag shelters gear from a death in the open zone | COMPANION-DROP (`Field-Bugs-2026-10-19f.md`, the owner's call) | already fixed |
| 36 | The town map's Find me goes to the town's lower right | FINDME-TOWN (`Field-Bugs-2026-10-19f.md`) | already fixed |
| 5 | A horse gone after a death in a dungeon | STEED-KEPT (`Field-Bugs-2026-10-19f.md`, the owner's call) | already fixed |
| 21 | The spell purchase confirm never appears | SPELLSHOP-SAID (`Field-Bugs-2026-10-19f.md`) | already fixed |
| 25 | Can't buy spells at the Mages Guild for three days | SPELLSHOP-SAID | already fixed |
| 29 | An item's invisibility stops after travel until re-equipped | HELD-CONCEAL (`Field-Bugs-2026-10-19f.md`) | already fixed |
| 50 | A disease warned of at rest, with no tile or name until death (Enduring) | DISEASE-UNWELL (`Field-Bugs-2026-10-19f.md`, the owner's call) | already fixed |
| 35 | An ancestor's inheritance missing where they died, in another player's dungeon; the bank's share not passed on | HEIR-WHOLE (`Field-Bugs-2026-10-19f.md`); the bank's share is ESTATE-WIDER, the owner's open call | already fixed (the remains); the bank: owner's call |
| 234 | A bought horse in the pack can't be used after logging back in | HORSE-WAKE (`Field-Bugs-2026-10-25e.md`, committed after this report) | already fixed |
| 24 | Remains gone after a death to monsters in the zone | Not proven in 10-19f (three candidates); FOE-KEEPS (2026-10-24) has since made a death to a foe drop nothing | already fixed (FOE-KEEPS) |
| 10 | A poison that will not end leaves the character overloaded | Drothweed's poison (DFU's CompletePoison) takes Strength until cured - the carry limit falls with it | as designed |
| 124 | Jail makes the horse eat oats though no time seems to pass | LIVED1: the sentence is served on the character's own clock, and horse care reads it | as designed |
| 149 | Criminal status not cleared after six arrests | REP1-REP4: legal standing below -10 is a criminal's; a sentence clears the crime's charge only, a temple's penance buys five points | as designed |
| 180 | Drowned, offered an heir at level 1: intended? | The Bloodline rules: the heir is a new character at level 1 | as designed |
| 285 | The Sigil Broker answers only with her watching line, and will not trade | The reply to a Steal-mode press (MODE-WHEEL, Left Alt); Grab or Talk mode trades | as designed |
| 239 | Cured poison, rest still says poisoned, then death | A poison that has not yet taken effect shows no tile (DFU's law; `ui3_status`, `bookshelf` pins); the rest warned; Cure Poison ended the one shown | as designed; a poison twin of DISEASE-UNWELL is the owner's call |
| 276 | After a kill and the pick of one item, the rest of the victim's goods lay on the ground; a wagon's drop came minutes late | The kill drops the remains; the killer's pick is within its 60 s with 30 s grace, then what is left lies for anyone | as designed |
| 278 | A backpack marker with nothing in it after PvP | The killer took it; the device's mark stays until the room says it is gone, or 12 minutes | as designed |
| 70 | No third person while riding with Morrowind models - the cart shows, not the body | RIDE-POV: on the cart's seat (or a horse the 3D rig cannot draw) the Morrowind body has no saddle and the view is held in the head; COATS3D gives a horse one | as designed |
| 144 | With the Morrowind look the barkeep is a generic Morrowind person | MWNPC17's wardrobe dresses him by his faction's role; Morrowind has no publican's dress | as designed; owner's option (notes) |
| 11 | Firefox mouse look in steps | Not proven (`Field-Bugs-2026-10-19f.md`: raw input a hypothesis) | not reproduced |
| 39 | Right-click at the desktop window's edge opens a menu (Linux, GNOME) | Not proven (`Field-Bugs-2026-10-19f.md`) | not reproduced |
| 7 | The holy-places damage disadvantage never bites | Not proven (`Field-Bugs-2026-10-19f.md`: both drawbacks bite in a registered temple) | not reproduced |
| 56 | An empty dungeon, nothing activates | Not proven (`Field-Bugs-2026-10-19f.md`: DUNGEON-RESPAWN empties by design) | not reproduced |
| 135 | The Mages Guild salvage menu jumps to the top on each salvage | Measured holding in FIELD BUGS 2026-10-18 | not reproduced |
| 63 | (Portuguese) My character doesn't show and the camera spins oddly | No view, look or build named; nothing to follow | needs data |
| 123 | After 43 days in prison, T offers no horse | A ridden horse goes through the court with its rider (neither DFU nor the port dismounts); a horse left standing stays where it was left, and the release puts the player at the town's entrance (DFU's) | needs data |
| 152 | A temple door in one town leaves the character running and adrift, the world unusable | A transition that never finished; one door, unreproduced here | needs data |
| 255 | Twenty tries at the Arena's first tier, nothing happens, twenty losses | A loss is recorded only at a verdict - so bouts were run and judged; cross-group with the Arena questline's report of a foe that never appears | needs data |
| 189 | Two guild members listed twice, a third missing | Needs the guild's member rows | needs data |
| 253 | The notice board says the note limit is reached, though every note has expired | The cap spans every town's board; needs the board's rows | needs data |
| 258 | The nudity filter covers taverns, not the pictures in players' homes | Needs the house's pieces | needs data |
| 76 | Died instantly while fast travelling on permadeath, no popup | Needs the death's cause (`dead_why`) | needs data / staff |
| 108 | Repeated deaths around signing in on an Enduring line, each costing years | Needs each death's cause; the years are each rise's toll in the line's record, which no tool gives back | needs data / staff |
| 23 | Lost the last character on a death without permadeath | Needs the character's record | needs data / staff |

### TAB-REPEAT (204) - `src/ui/enhanced/enhancedOverlays.js`

WHAT THE PORT DID. The dial is raised on the QuickDial key's press, and the key is still down when the system's
auto-repeat begins (about half a second). Every repeat reached the overlay stack's own Tab listener
(`enhancedOverlays.js:"function onTab(e) {"`), which put the top overlay - the dial itself - away. The dial's own
listener lets a repeat go, but its stopPropagation leaves the stack's listener on the same window to run, and that
listener's comment said "the auto-repeat of the held key is swallowed below and closes nothing" - it was not.

FIXED. onTab returns on `e.repeat` before it closes anything.

PINS. `test/ui/enhanced/rpt1026_misc_tab.test.js` (1: the real dial door, registry and key table). Mutants (1):
`rpt1026-misc-tab-repeat-closes`.

### TOAST-STALL (153, 191) - `src/ui/hud/hudText.js`

WHAT DFU DOES. PopupText keeps one timer, the front row's; AddText adds every line (PopupText.cs:106-124), so a busy
queue grows past its rows and the rubberband drains it.

WHAT THE PORT DID. NOTICE-SPAM collapses a repeat of the back line into it and puts the timer back. With other rows
queued ahead of the repeated one, that timer was the FRONT row's: a line said again inside every second held every row
on screen for as long as it went on.

FIXED. A repeat behind other rows is dropped - its row is already on screen at the back, with its own dwell to come; a
repeat of the only row still refreshes it.

PINS. `test/ui/hud/rpt1026_misc_toasts.test.js` (2, the real model at the hosts' tick). Mutants (1):
`rpt1026-misc-toast-repeat-refreshes-front`.

### RUMOR-ORPHAN (73) - `src/systems/quest/machine.js`

WHAT DFU DOES. The tombstone files a quest's RumorsPostSuccess / RumorsPostFailure as its progress rumor
(Quest.cs:637-640). QuestMachine.RemoveQuest leaves it in the mill; the next load's RestoreConversationData sweep
(TalkManager.cs:2522-2533) drops the orphan.

WHAT THE PORT DID. The same: a week of the quest's clock after its end the machine removed it, and the rumor stayed -
its telling asked for a quest the machine no longer held, and the expansion's null-parent bail handed the words over
raw (A0C01Y09's "_sister_ was found dead! And on the eve of %g3 wedding day too."). Online a session is days of a
character's clock, and the next load is far.

FIXED. removeQuest drops the quest's progress rumor with it
(`machine.js:"this.deps.removeProgressRumors?.(quest.uid)"`). A departure in WHEN (Port-Ledger A, RUMOR-ORPHAN;
`06-Systems/Quest-Arc.md`).

PINS. `test/systems/quest/rpt1026_misc_rumor.test.js` (1: the real machine and mill, wired as the world host wires
them). Mutants (1): `rpt1026-misc-rumor-orphan-kept`.

### FACE-ORPHAN (172) - `src/ui/hud/hudEscortFaces.js`, `src/scenes/quest/questBridge.js`

WHAT DFU DOES. A face leaves by DropFace or the quest-end sweep (QuestMachine_OnQuestEnded) and nothing else.

WHAT THE PORT DID. The same, with QUEST-SHELF-FACES hiding a face whose quest is set aside. A face whose quest left
the machine WITHOUT ending - a quest a load could not restore (restoreSaveData skips it and restores its faces all the
same) - had no door out: nothing left to turn in or abandon, and the save carried it every time.

FIXED. The bridge hands the panel the machine's word (`setEscortQuestGone`, beside `setEscortQuestAway`); `shownColumn`
leaves such a face out and `getEscortFacesSaveData` drops it, so the next save is clean. Port-Ledger A, FACE-ORPHAN;
`06-Systems/Quest-Arc.md`.

PINS. `test/systems/quest/rpt1026_misc_faces.test.js` (1); `escortfaces.test.js` resets the new seam the real bridge
sets (pin moved). Mutants (3): `rpt1026-misc-face-gone-drawn`, `-face-gone-saved`, `-face-gone-unwired`;
`questshelffaces.json`'s `QSF-the-face-of-a-quest-away-shown` re-aimed by content.

### BED-PRESS-INDOOR (90) - `src/systems/rest/restSession.js`, `src/scenes/worldModes.js`

WHAT THE PORT DID. SURV4 prices a rest by where it lies; a guild hall's floor is a rough night (its own law), and a
bed's press (`_restFromBed`) is a bed in the world and dungeon hosts. The interior host's `restKind` and `restPoint`
never read the press: a Fighters Guild bed pressed priced as its boards.

FIXED. Both ask `restSession.js:"export function interiorRestSpot"`, handed the press and the hearth. The R key on a
hall's floor stays rough.

THE FOUR HOSTS. worldModes.js's two entries became expressions over the module's law (the host shrinks); world.js and
dungeonContext.js already read the press; exterior.js stands no bed.

PINS. `test/systems/rest/rpt1026_misc_rest.test.js` (2); `rest1_act.test.js`, `surv4_rest.test.js` (pins moved).
Mutants (2): `rpt1026-misc-bed-press-ignored`, `-bed-press-unwired`; `survtiers.json`'s
`SURVTIERS-the-interiors-hearth-is-bare-ground` re-aimed to the module.

AUDIT RPT1026 L3 - THE PRESS ENDED BEFORE A REST THAT ASKS FIRST. `_restFromBed` stands for the press alone
(`restFromInteriorBed`'s `finally`), and poisoned or diseased the rest asks first (REST-WARN): the window opens on the
box's Yes, after the press. Driven through the real interior host (the mode machine over a stub host, a house stood by
`restoreInterior`): a bed pressed opened a bed's rest; a bed pressed while poisoned, answered Yes, opened a rough one.
The press is the window's own now - `createRestWindow`'s second argument is DaggerfallRestWindow's
`ignoreAllocatedBed`, passed by a bed's press alone, and the door marks the bag for the open
(`restDoor.js:"if (mark) deps.bedPressed = !!ignoreAllocatedBed;"`), where `setResting` and `restAct` read the place
and the point (`shared.js:"const pressedBedKind = () => REST_KIND.Bed;"`). THE FOUR HOSTS: worldModes.js unchanged (its
press already rides the door); world.js's ship bed hands its press through it, read as the toggle runs (no logical line
added); dungeonContext.js's bed is in reach whatever the box (`bedInReach`); exterior.js stands no bed. Pinned by
`test/scenes/audit_rpt1026_l_bed.test.js` (2: the host driven, the door and the bag); `partyrest1.test.js`,
`surv4_rest.test.js`, `restlodging.test.js`, `pvpdungeons_game.test.js` (pins moved) and `11-Multiplayer/Wild-Zone.md`'s
REST-WARN anchor (moved), `auditdrops.json`'s `AD-D1-vote-not-spent-on-a-granted-rest` and `surv4.json`'s
`SURV4-the-kind-is-read-every-hour` re-aimed by content.

### TOUCH-NO-LOCK (192) - `src/player/pointerLock.js`

WHAT THE PORT DID. A phone's look is the touch layer's drag, and the canvas's click net already let a finger go by -
but every relock door (a window's close, the look gate's close edge, a dial's goodbye) asked for the lock on a phone
too. Chrome for Android granted it to the tap that closed the window, and its banner said how to give back a cursor the
phone does not have.

FIXED. `requestLook`, the one door the others go through, returns on a touch device (`isTouchDevice`).
`10-UI/UI-Arc.md` beside TOUCH-UNLOCK.

PINS. `test/player/rpt1026_misc_lock.test.js` (1). Mutants (1): `rpt1026-misc-touch-lock-asked`; `freemouse1.json` and
`menurelock1.json`'s cursor records re-aimed by content.

### CONFIRM-SHEET (179) - `src/ui/enhanced/enhancedMenu.js`

WHAT THE PORT DID. Every destructive press on the Settings screen asks first (the Morrowind card's Remove data, a pack's
remove, All off, Reset everything, Restore defaults), its question a card in the detail pane - which, in the pause
menu's Settings and on a narrow or touch screen, is a sheet below the screen until opened. The ask set the card
without opening it.

FIXED. The ask opens the sheet it draws in, and shuts it again when answered if it was the one that opened it.

PINS. `test/ui/enhanced/rpt1026_misc_confirm.test.js` (1, the mounted pause screen); `fieldbugs_x.test.js` MENU-EXIT1 (pin
moved: the yes still runs its action before the repaint). Mutants (2):
`rpt1026-misc-confirm-sheet-shut`, `-confirm-sheet-stays`.

### JOURNEY-TRAMPLE (94) - `src/scenes/world.js`

WHAT DFU DOES. Roleplay Realism's EnhancedRiding tramples whom a galloping rider meets (OnTriggerEnter) - under
TravelOptions' journey too, its clip muted there (RidingVolumeScale 0).

WHAT THE PORT DID. A journey - the Overworld's view or a Travel Options autopilot - drives the same motor at sixty or a
hundred times the pace with the player's Run and AutoRun in its input, so a journey taken with AutoRun on rode through a
town's people at a gallop, unsteered, and charged Assault.

FIXED. The world host's frame asks the trample only off the road (`!rideOnTheRoad()` in the condition that stood). A
departure from the mod (Port-Ledger A, JOURNEY-TRAMPLE; `06-Systems/Roleplay-Realism.md`).

THE FOUR HOSTS. world.js runs the riding contacts and every journey; exterior.js runs them too (AUDIT-RR F15, its own
`rrRiding.contacts()`) but stands no journey - no Overworld view, no Travel Options - so its gate is unchanged
(AUDIT RPT1026 L5: this line had said world.js alone); no logical line added.

PINS. `test/scenes/rpt1026_misc_trample.test.js` (1); `rr2_realism.test.js` (pin moved). Mutants (1):
`rpt1026-misc-trample-on-journey`.

### HEIR-WAITS (110) - `src/systems/legacy/waitingHouses.js`, `src/ui/enhanced/enhancedMenu.js`

WHAT THE PORT DID. A Bloodline's fall is the realm's tombstone at the death door, before the Succession - the parent
leaves the roster by design. The page that went back to the title left the Succession waiting on the line's record.
HOUSE-WAITS (FIELD BUGS 2026-10-09f) is the Online page's door to such a line, and it named the line's LIVING members
alone, where the fall's own Succession also offers a newborn heir of the fallen (legacyHost.js fallOutcome). A fallen
with no sibling or child - the report's case - left the house with no card and nothing to press.

FIXED. The card offers the newborn where the fall may raise one (the heir answer rolled at the fallen's birth, the
Descendants dial at Always, or an elder retired), made as the Succession makes one (addChild, then rollSiblings) and born at the boot - born at the fall's own minute,
where the in-world Succession bears its newborn at its choice's minute, a breath after the fall (AUDIT RPT1026 L6: this
line had said the two were one). The parent stays fallen (Bloodline's law); the heir starts at level 1.

THE WORDS. `legacy.houseWaits.newborn` "Raise a child of {name} as your heir"; `legacy.houseWaits.noNewborn` "No heir
can be raised for that house." Drafted in every language (`SCRATCH/drafts/misc.json`).

PINS. `test/systems/legacy/rpt1026_misc_heir.test.js` (2: the real family law, store and door). Mutants (3):
`rpt1026-misc-heir-newborn-unoffered`, `-heir-newborn-refused`, `-heir-newborn-born-now`. `06-Systems/Legacy-Arc.md`
HEIR-WAITS; the HOUSE-WAITS ledger row narrowed.

### TOUCH-FIELD (190) - `src/ui/touch/touch.js`, `src/ui/enhanced/enhancedPort.js`, `src/ui/enhanced/enhancedPorts.js`

WHAT THE PORT DID. The Bank's amount is the classic window's own typed field (DFU's TextBox: the window takes its
keys), drawn by the enhanced port as words - nothing a phone can focus, so a finger on it raised no keyboard. The held
map's name field is a real input, which is why that one worked.

FIXED. The touch layer's own entry (TI2's "abc", which types into exactly such a window) is opened by a press on the
port's live field (`openTouchEntry`), with the number pad for an amount (the bank's field marked `numeric`).

PINS. `test/ui/enhanced/rpt1026_misc_field.test.js` (1: a deposit typed by finger through the real Bank window, its port
view and the touch layer). Mutants (3): `rpt1026-misc-touch-field-unmarked`, `-touch-entry-unhooked`,
`-touch-field-press-unread`.

AUDIT RPT1026 L1 - THE ENTRY STOOD UNDER THE BANK. Mounted in Chromium at 390 x 844 and 844 x 390 (the real Bank window,
its port view and the touch layer over Vite's dev server), the field's press raised and focused the entry - but as the
layer's child, one stacking context at z-index 5, under the port's host (`.port-host`, z-index 13, the whole screen): the
topmost thing at the entry's centre was the Bank's own stat row and columns. The amount a finger typed showed nowhere
until the keyboard's Enter sent it. The entry is the page's own now (`touch.js:"export const TOUCH_ENTRY_Z = 39;"`, on
`document.body`), over the window that raised it and under the asset picker; re-probed, it is the topmost thing at its
centre and 250 typed there is the Bank's 250 on Enter. Pinned by `test/ui/audit_rpt1026_l.test.js` L1 (mutants
`auditl-entry-in-layer`, `-entry-under-port`, `-entry-left-behind`); `audit62_touch.test.js` AUDIT FONT F6 reads the
field where it stands now (pin moved).

### GIANT-ROCK (214) - `src/systems/wild/wildGiants.js`, `src/scenes/world.js`

WHAT THE PORT DID. GIANT-FIELDS stood a giant on the flattest open spot near its place by the height map alone, and the
mountains' rocks (World of Daggerfall's landform pieces, a mesh each in the collider) stand on flat ground too: a
Greater Giant, four times a man, and the ten its call brings were stood inside them.

FIXED. A spot is refused where a solid's face lies within 2.5 m of the giant's lower body (3 m over its feet - the
collider's `sphereOverlaps`, the free placement's test) or the body is inside a solid (`insideSolid`)
(`wildGiants.js:"export function giantGroundBlocked"`), asked by both doors that stand a giant (`giantFieldSpot` and
`greaterGiantCall`). `11-Multiplayer/Wild-Zone.md` section 15.

THE FOUR HOSTS. world.js alone stands the zone's giants; the test joins the two conditions that stood (no logical line).

PINS. `test/systems/wild/rpt1026_misc_giants.test.js` (2: the real Collider with a rock filed as the pixel build files
one). Mutants (3): `rpt1026-misc-giant-rock-unasked`, `-giant-rock-inside-unseen`, `-giant-rock-face-unseen`.

### CAST-PACE (71) - `src/combat/fpsSpellCasting.js`, `src/combat/fpArm.js`, `src/combat/weapon/weaponRig.js`

WHAT DFU DOES. FPSSpellCasting releases on frame 5 at animSpeed 0.04 s - 0.2 s (CAST-QUICK put the port back on it).
OpenMW plays the spellcast group at 1 and casts on "<type> release" (character.cpp handleTextKey).

WHAT THE PORT DID. With the Morrowind arm on screen the spell waited for the arm's "<type> release" (MW-CAST1), the group
played at the cast's rate: the section's own lead, longer than 0.2 s, so the same caster's spell left later and the next
cast (castBusy reads the held release) waited on it.

FIXED. `castReleaseS(rate)` is frame 5 at the cast's rate; castSpellAnim hands it to `fpArm.castSpell`, which plays the
section at the pace that brings its release key there (MW-PACE1's `blowRate`), and a paced arm's spell leaves on frame 5
(`armHolds`) - the same moment on either look. An arm with no release key to pace keeps MW-CAST1's hold. A departure
from OpenMW (Port-Ledger A, CAST-PACE; `02-Formats/Morrowind-Rules.md`, where CAST-SPEED's stale 0.1 s is narrowed).

PINS. `test/combat/rpt1026_misc_cast.test.js` (2: the real arm on MW-CAST1's fixture within one step of the classic hands
at rate 1 and 1.25; the real rig). `fparm.test.js`, `mac7.test.js` and `mwcast1.json` (pins moved by content). Mutants (5):
`rpt1026-misc-cast-pace-unfit`, `-cast-pace-unsaid`, `-cast-pace-rateless`, `-cast-pace-unasked`, `-cast-pace-held`.

### SPELL-SHORT (57) - `src/player/eyeOfTheBeholder/eotbSprite.js`

WHAT THE MOD DOES. Eye of the Beholder's set 10 (Fighter Mage, female) draws its spell sheets (archive 112374, records
45-59) with the woman 77-81 pixels hood to boot against 107-112 on every other sheet, and its XML scales them 1.0: she
shrinks by a quarter as a spell comes up, in Daggerfall Unity too. Every other set's spell sheets stand as tall as its
idle or taller.

FIXED. Those records carry the scale they were drawn at, 80/110 (`EOTB_RECORD_SCALE`), read by `spriteOffset` beside
ACRO-SHORT's class scale - the body, its placement and the peers. A departure from the mod's XML (Port-Ledger A,
SPELL-SHORT; `06-Systems/Eye-Of-The-Beholder.md`).

PINS. `test/player/eyeOfTheBeholder/rpt1026_misc_eotb.test.js` (1: the vendored PNGs measured). Mutants (3):
`rpt1026-misc-spell-short-unscaled`, `-spell-short-unread`, `-spell-short-xml-lost`.

### TALK-SIDEWAYS (159) - `src/ui/enhanced/enhancedStyle.js`

WHAT THE PORT DID. Drawn in Chromium at a phone's sizes (the enhanced talk panel mounted alone on Vite's dev server):
held sideways, 844 x 390, the panel stood 52dvh - 203 pixels - and the head, the foot and the topics' two strips took
all of it: the topic list 12 pixels tall and drawn under the foot; at 740 x 360 the category buttons under it.

FIXED. On a screen 500 pixels high or less the panel stands the height less a margin and keeps its two columns. After
it: the panel 378 pixels, the list 166, every button the topmost thing at its centre; upright phones and the desktop
unchanged. `10-UI/UI-Arc.md`.

PINS. `test/ui/enhanced/rpt1026_misc_talk.test.js` (1: the sheet's cascade read at each size). Mutants (2):
`rpt1026-misc-talk-sideways-short`, `-talk-sideways-stacked`.

AUDIT RPT1026 L2 - AND NARROWER THAN 720. The fix's sizes were all wider than the phone rule's 720 pixels. Under it (a
360-wide phone on its side, 640 x 360; an iPhone SE's 667 x 375 and 568 x 320) the phone rule still stacked the name over
the tones and the question over Note and Ask, and the two columns put the categories in 40% of the width: measured in
Chromium, the topic list stood 66 pixels at 640 x 360 and 26 at 568 x 320 - under one row - and Work was cut at the
panel's edge at 640, wholly off the screen at 568. Under 500 pixels high the head and the foot are one row each now and
the categories shrink to their strip: the list 152, 167 and 112 pixels, every press the topmost thing at its centre and
none overflowing; 844 x 390, 740 x 360, 915 x 412, upright and desktop sizes measured unchanged. Pinned by
`test/ui/audit_rpt1026_l.test.js` L2 (six mutants, `auditl-talk-*`).

### Already fixed

- **COMPANION-DROP (4), FINDME-TOWN (36), STEED-KEPT (5), SPELLSHOP-SAID (21, 25), HELD-CONCEAL (29), DISEASE-UNWELL
  (50), HEIR-WHOLE (35)** - each answered in `01-Overview/bugs/Field-Bugs-2026-10-19f.md` by its own row; all reported
  on builds before it. #5's horse comes home on the next load (STEED-KEPT); #35's bank share is ESTATE-WIDER, the owner's
  open call there.
- **HORSE-WAKE (234)** - `Field-Bugs-2026-10-25e.md`: a load that lands away from its save (the online wake from a
  dungeon) calls the horse and team to the player; committed hours after this report, on a later build than its 0.0.392.
- **FOE-KEEPS (24)** - 10-19f could not prove why the remains went; since 2026-10-24 a death to a foe drops nothing.

### As designed

- **The poison that weighs (10)** - Drothweed's poison is DFU's CompletePoison of Strength, held until cured: the carry
  limit falls with Strength, so the character is overloaded.
- **Jail and the oats (124)** - LIVED1: a sentence is served on the character's own clock, and horse care reads that
  clock. Feeding the horse nothing in jail would be the owner's call.
- **The criminal status (149)** - REP1-REP4: legal standing below -10 reads as a criminal's. A sentence clears the
  crime's own charge, and a temple's penance buys five points a time; a quest's lost legal repute is not refunded by
  serving time.
- **The heir at level 1 (180)** - the Bloodline rules: an heir is a new character.
- **The Sigil Broker's eyes (285)** - the line answers a press in Steal mode (MODE-WHEEL, Left Alt); Grab or Talk
  trades.
- **The poison not shown (239)** - a poison that has not yet taken effect shows no tile (DFU's law, held by the
  `ui3_status` and `bookshelf` pins); the rest warned; Cure Poison ended the one that showed. A poison twin of
  DISEASE-UNWELL (warn with a tile while waiting) is the owner's call.
- **The killer's pick and the floor (276)** - the kill drops the remains; the killer's pick runs its 60 s with 30 s of
  grace, and what is left lies for anyone. Wagons drop as their own timer says.
- **The empty backpack (278)** - the killer took it; a device keeps the mark until the room says the remains are gone,
  or 12 minutes.
- **No third person on the cart (70)** - RIDE-POV (Mac, 2026-09-20): the Morrowind body has no seat on Daggerfall's
  cart (or on a horse the 3D rig cannot draw yet), so the view is held in the head and the cart's riding picture shows;
  COATS3D (2026-10-11) gave a horse a saddle. A seat on the cart would be new work.
- **The generic barkeep (144)** - MWNPC17's wardrobe dresses a standing person by their faction's role; Morrowind has no
  publican's dress, and the tavern's other people are flats no body is stood for. Keeping the barkeep's sprite, or a
  merchant's dress for him, is the owner's call.

### Not reproduced, and needs data

- **Firefox's stepped mouse look (11), the GNOME window-edge menu (39), holy places (7), the empty dungeon (56)** - the
  10-19f entries stand: each names its ask. **The salvage menu (135)** measured holding in FIELD BUGS 2026-10-18.
- **The character not shown, the camera spinning (63)** - no view, look or build named. Ask: the skin (Daggerfall or
  Morrowind), first or third person, a screenshot.
- **The horse after prison (123)** - a ridden horse goes through the court with its rider (neither DFU's court nor the
  port's dismounts); a horse left standing stays where it was left, and the release stands the player at the town's
  entrance (DFU's PositionPlayerAtLocationEntrance), often far from it, where the Transport window's horse row is dark
  ("not close enough"). Ask: mounted when taken, and whether the horse was found where the arrest happened. Calling a
  waiting horse to the release, as HORSE-WAKE calls it to a load, would be the owner's call.
- **The temple door (152)** - a transition that never finished, at one door of one town; the plague deaths at each login
  are the disease's own course. Ask: the client's console at the press, and the building.
- **The Arena's first tier (255)** - a loss is written only at a bout's verdict (`ladderAfter`), a draw at the judges
  counted as one: twenty losses mean twenty bouts run and judged, so the opponent stood but never closed, or stood out
  of sight. G9's Arena questline report (a foe that never appears) reads the same lane - the lead should read both
  together. Ask: whether a foe was seen at all, and the Records page.
- **The guild list (189), the board's cap (253), the house's nudity (258)** - each needs its rows: the guild's members,
  the account's notes on every board (the cap spans every town), the house's placed pieces.
- **The death in transit (76), the lost character (23)** - each needs the death's cause (`realm_characters.dead_at` and
  `dead_why`); a final death a bug caused can be taken back by staff (`tools/reviveRealmCharacter.mjs`, REVIVE).
- **The deaths at login (108)** - an Enduring death that is not final is a rise that adds its toll of years to the
  person (`systems/legacy/age.js`, `person.toll`); REVIVE takes back a FINAL death, not a toll. Each death's cause is
  needed to find the bug; giving the years back is an edit of the line's record no tool makes - staff's, at the owner's
  word.

### Server

No change to the account service or the relay: no version bump, no migration.

## Staff, moderation and the withdrawn (the lead's own rows)

| | Report | What it was | Done |
|---|---|---|---|
| 16 | A character's name carries a number its player never typed | The handle law adds a suffix to a name already held (`net/handleShape.js`); a rename is a staff act | STAFF |
| 80 | A guild's members report another member who filled the guild's treasury with gold they believe exploited, then bought homes with it | A moderation call on the account's records (`guild_ledger`, the realm findings, the homes' deeds) | STAFF |
| 118 | A newer character's pace in the Abyss Dungeons reported as impossible | The shape RPT1026-FIGHTS RETIRED-BLOW closes; whether that account used it is in the fight records | STAFF |
| 131 | A crowd's arrival at an Abyss portal reported as impossibly fast | As 118 | STAFF |
| 143 | A player in the open zone reported as knowing more than they should | A moderation call | STAFF |
| 210 | A turn-in refused by the shop's keeper | Withdrawn by its reporter (211): the reporter's own standing | WITHDRAWN |
| 211 | The withdrawal of 210, and the ask for a way to withdraw a report | WITHDRAWN; a report's sender cannot yet cancel one (`reports.js` has no such route) | WITHDRAWN |
| 225 | Players sharing their cards over a voice chat at the card tables | No code can see another program; the tables' design call | AS DESIGNED |
| 227 | The withdrawal of 222 (the revenant's take, said at the respawn) | WITHDRAWN | WITHDRAWN |
| 241 | Filed as security: a player asks to lift an armour restriction chosen at character creation | A staff act on the character, at the owner's word | STAFF |

The NEEDS DATA rows name what to read in each lane above. The restorations the reports ask for - gold, keys, items,
years of life - are the Staff Panel's (`/v1/staff/fix/*`, the rollback workflows); none is made by this change.

## For the owner

The calls this batch left to the owner, each written up in its lane:

- **The item law's repeated side effect** (RPT1026-LEDGERLAW, Integrity-Arc "What lane 1 leaves open"): the service
  still takes a setting laid twice, as a piece made before SIDE-ONCE must; the three designs that tell the two apart each
  carry a trap.
- **A fallen fighter's share in the Hour** (RPT1026-FIGHTS, #106): kept as the Elite Breach's lords keep it
  (LORD-SHARES), or retired as now.
- **The wards in PvP** (RPT1026-FIGHTS, #233): the referee counts a spell between players on a neutral stand-in, so the
  target's Absorb, Reflect and Resist are not read; reading them needs the referee's own record of them.
- **The frame ceiling and the peers' shake** (RPT1026-CLIENT): 300 frames a second with the limit lifted, and Half as
  the default for other players' spells.
- **The open-world travel rules** (RPT1026-WORLD): ships at sea meet the traveller by the real minute (TRAFFIC-REAL),
  and the player stays crouched under a low face (STAND-THROUGH).
- **The rest** - an estate's bank share (#35), a poison's tile before it acts (#239), the jail's horse (#123, #124), a
  publican's Morrowind clothes (#144), the Morrowind rider's seat (#70), the bow's element colours (#33), a Renown
  label (#125) - are in their lanes' rows.
