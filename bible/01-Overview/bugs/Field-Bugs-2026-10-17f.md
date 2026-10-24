# FIELD BUGS 2026-10-17f - The key's week, and the peers in the air

Two threads Mac handed over as screenshots on the evening of 2026-10-17: a direct message, and a picture from the
Oblivion Gate. Read on the code at main's `81710c3a7`. (Main took `-17e` for ORRERY-SIGHT, migration 0129 for PRIVATE-REPORT and
relay `world216` for PROX-VOICE, reverted with its row kept, so this record is `-17f`, its pins `fb1017f_*`, its
migration 0130 and its relay `world217`.)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | A player, by direct message, the evening after KEY-LAW shipped: "bruhhhh it was that keyyyyy", over the notice "The realm's law has held this character three times. Its trading is frozen until October 24 at 3:21 AM, then opens on its own." - then "like 5 other people in reporting same thing" | Law 6 struck every Weir Key (KEY-LAW), and three keys taken up one after another made AUTO-HOLD's week. Migration 0125 lifted that week only for a character whose every law finding, ever, was the key's. A finding already judged and cleared (0123's Aetheric pieces, which the gate's own farmers wear) or one an older law laid stood in that history, so the week stood | fixed (KEY-LIFT) |
| 2 | "People floating in mid air for some users", with a screenshot from the Oblivion Gate in the Alik'r before Dagon's Breach opened: the crowd's bodies, names and health bars hanging tens of metres over the sand, scattered up and down, and the reporter's own body on the ground | A pose's height is the sender's own ground's, and nothing kept two builds apart online (`03-World/Landforms.md` C2): a copy on an older ground - a macOS or portable desktop copy never updates itself - drew every peer on the current ground in the air, and was drawn under it | fixed (GROUND-GATE), Mac's call: the relay turns an old build away while `groundGate` is on |

## KEY-LIFT: the key's week, lifted where the key made it

`server-account/migrations/0130_key_lift.sql` (new). No Worker, law, relay or client file moves.

FOUND. KEY-LAW (`Field-Bugs-2026-10-17.md`) found that law 6 held every Weir Key as a template no honest client mints. The
key is account-held and the pack is its face (`systems/eliteGates/weirKey.js` restackWeirKeys): a key spent leaves the
pack empty and the next checkpoint clean, and the next key rolled is a new hold - a strike (`server-account/src/verdict.js`
lawCountOf: a strike a hold, from a clean record). Three keys between the Breach going live and KEY-LAW's deploy were the
third strike, and the third strike is a week's hold whatever the next checkpoint says (AUTO-HOLD, LAW_HOLD_S). The
notice in the report is that hold with no piece named: law 7 finds nothing on the character now, and the week stands.

Migration 0125 lifted the week, the strikes and the hold for a character whose law findings were ONLY `template` on 575 -
every `law` row it had, from the INTEGRITY arc's cutover on. Two kinds of history stood in the way:

- a finding a staff act or a lift migration had already judged wrong and cleared. MAKER-KEPT's 0123 cleared every
  character held over Ruhn's Regalia enchanted before AETHERIC-MAKER (`Field-Bugs-2026-10-16c.md`), and left the findings
  in place, as every staff act does. Ruhn's Regalia is the gate boss's set, and its wearers are the players who farm the
  gate, which drops the keys;
- a finding an older law laid that a later law no longer makes, where no lift came with the move. It stood as a strike
  until it faded, so one of those and two keys were a week as well.

The report's timing fits the first: a week from 3:21 AM on 2026-10-17 in any American zone is after the Breach went live
(`399fe1605`, 03:50 UTC) and before KEY-LAW's account deploy (run 272, 12:49 UTC), so law 6 laid it and 0125 passed over
it.

Why no test saw it: `test/server/fb1017_keylaw_lift.test.js` built every character with no finding before the key's, and
pinned "a hold with any other finding untouched" as the conservative half - true of a finding that could still be
holding, not of one already cleared.

DFU has no realm, no law and no Weir Key. This is our own service's record, so no DFU member or ledger row moves.

FIXED. Migration 0130 reads only what still counts. A character's count was zeroed by its last staff `clear` or
`rollback` act (review.js), 0123's and 0125's lifts among them, but not by 0120's copies' `clear`, which zeroed no strike.
Only the law findings since then are read, and an excused finding is not one (it held nothing). A finding is the key's
when every piece it names is a Weir Key's `template` or an id on another piece (`uid`, never a strike - verdict.js). Every
other finding is one that could have struck without the key, including a count past its kept list (FINDINGS_KEPT) and an
unreadable list. Where a key's finding stands among fewer than three of those (judge.js STRIKES_FOR_TIMED), the key made
the week. The migration then lifts the timed hold and every timed hold served. The strikes kept are the most the other
findings could have struck (one each, and never more than the character was counted), and their fade counts from the
last of them. A character whose week an act made since (0120's `timed`) is left as it was, and so are staff's holds. The
hold lifts only where no other finding holds it (`law_sig` none, or the key's alone). A character still carrying another
piece stays held until it is gone, with its signature kept, so that checkpoint is no new strike. The key's own signature
is dropped: law 7 has judged every checkpoint since 0125's deploy and finds no key, so it stood for a clean record, and
kept it would have made the next real finding no strike. Each lift is written among the character's findings as a staff
act (`by: 'key-lift'`) with what it lifted and the strikes it kept.

The migration applies on the account deploy's next run (any change under `server-account/` runs it). It needs no new
Worker, so `ACCOUNT_VERSION` does not move.

`test/server/fb1017f_keylift.test.js` (3), through the real Worker and the real migrations. First, the report: a character
cleared by the real 0123, then held a week by three keys. 0125 leaves it held, 0130 lifts it whole, and its next
checkpoint carrying keys holds nothing. Second, a strike the real verdict laid on a forged piece, then two keys: the week
is lifted, the one strike is kept with its own finding's fade, and the piece taken up again is the second strike, not a
week. Third, what counts and what does not, across twelve characters. A person's clear and a rollback end the count, and
0120's copies' clear does not. An excused finding and an id on another piece strike nothing, and a count past its kept
list could. A carried piece's hold stands. Three other findings, 0120's week, staff's hold, a week with no key in it and
a character 0125 already lifted are all untouched. The first test fails on main: 0130 does not exist, and 0125 leaves the
week standing. `tools/mutants/fb1017f.json`: 15 mutants, all dead (each boundary, each exclusion, the threshold, the cap,
the kept strikes and their fade, the hold another piece makes, the key's signature, staff's).

## GROUND-GATE: a build on an older ground turned away

`src/net/wire.js` GROUND_LAW, GROUND_LAW_WIRE_MAX, groundRoom, GROUND_OLD_REASON and the hello's `gl`, RELAY_VERSION
`world217`; `server/src/index.js` `_groundRefusal` and its call in the hello, GROUND_OLD_WORDS, the setting's refusal;
`src/net/relayCfg.js` `groundGate`; `src/net/online.js` `_helloFrame`; `tools/groundPrint.mjs` and
`test/fixtures/groundPrint.json` (new).

FOUND. The receiver draws a peer where the sender says its feet are: the overworld's pose carries the feet's height
less the floating origin (`scenes/world.js`, the pose's `y`), the relay fans it unchanged (SLIM-FRAME rounds it to the
centimetre), and the bodies stand on it (`net/remotePlayers.js`, `net/peer/peerBodies.js`). No peer layer asks its own
ground. So a peer floats when the sender's ground stands over the receiver's at that spot. The gate's own clearing is
the same on every client (World of Daggerfall is forced on online, and the gate's spot is the day's), and strangers'
Elite Breach arches, whose clearings differ between clients, never stand within 300 m of a Dagon's Breach
(`scenes/eliteGates/egArch.js` EG_ARCH_GATE_NEAR_M). The landforms are forced on online, so two current builds stand
one ground. What remains is two builds: AUDIT LANDFORMS C2 had named it and left it to Mac. A deploy reloads no open
tab, and the macOS and portable desktop copies never update themselves (`01-Overview/Desktop-App.md`, "Which copies").
Measured on the landforms' synthetic world in a desert climate, at three pixels, the landforms' ground stands 60-83 m,
243-264 m and -9 to 1 m over the classic ground, about 20 m apart inside each - a crowd high and scattered, as the
screenshot's (the classic ground is a copy from before the landforms; a copy from between two later ground slices
parts by less).

Not verified here: the reporters' builds. The record asks the players who see it whether theirs is a macOS or portable
desktop copy, or a tab open for days.

Mac's call (2026-10-18, of three: the relay turns old builds away; each client stands peers on its own ground; or ask
the reporters first): "Relay turns old builds away".

DFU has no multiplayer. This is our own relay's law, so no DFU member or ledger row moves.

FIXED. A hello to a ground room (`groundRoom`: a cell, a building's or a dungeon's place, a battle, an owned room - the
rooms whose peers stand on each client's own ground) says the ground its build stands on, `gl` (GROUND_LAW, 1 for the
ground at this merge). Any other value is read as none, the `w2` law, never refused at the parse. While the relay
setting `groundGate` is on, such a room refuses a hello that says less or none before anything is written. The error
frame carries the relay's words ("This copy of the game is older than the world online. Update it to play online:
reload the page, or download the latest desktop release."), which every build shows as its own error, and the close
carries a reason of its own (`old ground`), because a WebSocket close reason is at most 123 bytes. A refused session goes
terminal and does not loop. The hub and every social room let an old build in, so its friends and chat stand.

A hello on the ground asks nothing. An old one asks the hub's settings at most every RELAY_CFG_TTL_MS, and waits for the
answer while the room has never had one, so a cold cell's first hello is not the one let through.

THE SWITCH STARTS OFF. The relay deploys first and the site last (the account service waits on the relay, and the site
on the service), so a gate in force at the relay's deploy would refuse every player, a reload included, until the site
served this build. Once it does: `/relay groundGate on` (a developer's command). Every copy from before this merge says
no `gl`, so turning it on turns away every tab not reloaded since and every desktop copy not updated since - the price
of the choice, paid once.

THE LAW MOVES WITH THE GROUND. `test/net/fb1017f_groundgate.test.js` holds the shaped ground (`generatePixelTerrain`,
landforms on, over the landforms' synthetic world: a pixel by the network's road and river and one on the mountain's
flank, in each of CLIMATE.PAK's ten lands, read every 8 samples) to the print recorded under GROUND_LAW
(`test/fixtures/groundPrint.json`). A move past half a metre anywhere fails until GROUND_LAW moves, RELAY_VERSION with
it, and the print is recorded again (`node tools/groundPrint.mjs --write`); inside it is a float's noise, which no peer
is seen to float by. The print does not read the real data: a ground that moves only there (a World of Daggerfall
site, a location's blend) names its bump in its own slice.

`test/net/fb1017f_groundgate.test.js` (4): the ground is the print recorded under its law; the wire's `gl` and the ground
rooms; the relay's door through a real Room - off, an old build let in; on at the hub, a cold cell's first old hello
asked of the hub and refused with the words and the close, nothing written, the current build let in without an ask,
the hub itself open to an old build, the setting on and off alone, and off again inside a TTL; the client's hello says
the ground to the room it goes to, a halo cell's included, and a refused session stops. Pins moved: RELAY_VERSION's
(`world217`, 43 files), the settings' names and vars (`test/net/scale5b.test.js`). `tools/mutants/fb1017f.json`: 13 more
mutants, all dead (the room's test, the law's, the cold ask unawaited, the setting unread or any value taken, the door
dropped, the close reason whole, the wire's bound and rooms, the client's room and field, and the print against
MOUNTAINS-SHARP's peaks halved and the Alik'r's dunes lowered).

