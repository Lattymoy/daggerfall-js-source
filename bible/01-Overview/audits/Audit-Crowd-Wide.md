# AUDIT CROWD-WIDE (2026-10-23) - the crowd's count everywhere, audited

The owner, of CROWD-WIDE (`11-Multiplayer/World-Bosses.md` section 21; c621205a4 and abbeb8c6a): **"Audit this"**. This
page is the audit of the change and its record. What the audit changed is written into section 21 as it now stands;
this page is the findings, each with its verdict.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at 836650028 - Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), told to trace every finding from a real caller and reproduce it (a script, a lifted
expression evaluated, a surviving mutant) before reporting it. Each finding was then read again against the code before
a line changed.

| Lane | Over | How |
|---|---|---|
| A | the law as a player meets it | every way another player can hurt, rob or contest me (the duel, wild, siege, tourney, arena and sea referees, the gifts, the bounties, the tables), whether each exemption is true when it must be (the zone's dungeons, towns and sea, a siege's enrolment and count, a spectator, a private bout, the Herald's Watch, a duel's count), what breaks outside a fight; the lifted `on` run over the real `gateCrowd.js` |
| B | the host's wiring and its cost | every reader of the drawn list and of the whole one, what of a cut player still draws (teams, wagons, boats, companions, rings, torches), the doors that ask `shows`, the frame's order, the cost at 60-200 players, the churn when the cut turns on and off; scripts over the real `crowdDrawn`, `createGateCrowd`, `createPeerRange` and `SocialState` |
| C | the pins and the mutants | the stubs against what their producers return, the recorded mutants run, 44 mutants of its own, the moved regex pins, the titles' claims |
| D | every word | the code's comments, the row's English, section 21, the Ledger, Active-Arcs, the tests' titles, the commits; older text the change made false; the twenty translations and their records |

No lane found a way for a player the count leaves undrawn to hurt me: every harm path needs an exemption that turns the
count off, or names the duel's opponent it always draws. The breaks were what goes with a cut player (a wagon rolling
with an empty bench, a boat under way with nobody at the helm, a torch's light walking the walls) and people kept beside
me (the wagon I ride, the boat I stand on, the one I trade with). The HIGH findings are a pin that let "nearest to me"
go unread and a note that told players something false.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | Every fixture stood me at the origin with the crowd on the x axis (`ME = [0, 0, 0]`, the frame's `player: { pos: [0, 0, 0] }`): `f[0] - me[0]` as `f[0] + me[0]`, `f[2] - me[2]` as `f[2] - me[0]`, either read dropped, z ignored, and the frame's `me: player.pos` as the origin all survived - in the game the count would draw the nearest to the wrong place in every town | FIXED: the law, the host's crowd and the frame measured from `[517, 3, -260]`, the crowd on both axes, two standing at the scene's origin and on my x line; six `AUDITCW-C1-*` mutants recorded, dead |
| D1 | HIGH | The note: "nobody is hidden in a PvP zone, a battle or the arena" - read as absolute, while the Draw distance row beside it still hides the far there; "battle" read as any fight (ja 戦闘中, ko 전투); and two translations said nobody can HIDE (cs, hu) | FIXED: "How many other players are drawn at once, the nearest first. Your party, your duel opponent and anyone you trade, ride or sail with always show. The count is off in a PvP zone, a siege, a Royal Tourney and the Arena, but not in the Burning Court." - the count alone, the places by the catalog's own names; twenty languages redrafted in-session in their own words for the siege, the Tourney, the Arena and the court (D3-D5, L8-L12 below); pinned word for word |
| B1 | MEDIUM | What goes with a cut player still drew: their horse team and wagon (`hcc.setPeerLook` answered 'hidden' for the concealed alone), their boat with an empty helm (`csaPeers.setPeerLook`), and a strangers' duel watched in a square with one fighter swinging at air (`duelRingsNow`). PEER-RANGE had the same at 300-400 m (its audit's A4); CROWD-WIDE brought it to arm's length | FIXED: both looks answer 'hidden' for one the count left out (`!gateCrowd.shows(id)`) - their team, wagon and boat kept parked and moored as a hidden owner's are; a duel's two fighters never cut (`_duelRings`, A2). OPEN: their companions - the owner's foe puppets, with no owner-look hook in any pool (a concealed player's stand too) - still stand; a hook in the three foe pools is its own slice |
| A2 | MEDIUM | People beside me could vanish: the owner of the wagon I sit in (lane A's repro: twelve strangers at 1-1.5 m, the driver at 2.5 m - not drawn), my wagon's riders, the captain and crew of the boat I stand on, a trade partner at 4.9 m when twelve came within 0.5 m (`mate` was the party and the duel alone) | FIXED: `crowdKept` (`net/gate/gateCrowd.js`), gathered once a frame - my party, my duel's opponent, my trade's partner (`tradeMgr.session.peer`), those I ride with (`wagonRiders.ridingWithMe`, new) and sail with (`csaAboard.shipmates`, new), a duel's two fighters; it replaced an arrow in `bootWorld`, one logical line lighter |
| C2 | MEDIUM | "a stray value reads as everyone" could not fail: `'junk'` and `undefined` read as everyone through `crowdDrawn`'s own `!(max > 0)`, so `max: getPref('gateCrowd')` (the tier unread) survived - an old or hand-edited shelf of 7, 13 or '12' would cut at that number | FIXED: every stored value that is no tier asserted everyone through the frame (`7, 13, '12', -12` among them); `AUDITCW-C2-frame-tier-unread` dead |
| D2 | MEDIUM | `07-Rendering/Performance-Priority.md`, "The crowds" 5: "within it there is still no cap" - false since a player can set one everywhere | FIXED: no cap by default, unless the player picks a count on Players shown at once, and where it is off |
| D3-D5 | MEDIUM | cs "se nikdo neskryje" and hu "senki sem rejtőzik el" read as "nobody can hide"; ja "戦闘中" as "in any combat" | FIXED in the redraft (D1) |
| B4 | LOW | `shows(id)` answered false for every player not handed to the cut wherever it ran (`!live \|\| held.has(id)`): a struck player below deck went unheard and unsparked everywhere, at Everyone too, and a newcomer lost a frame - before CROWD-WIDE only in a court | FIXED: false only for one the count left out (`gone`, PEER-RANGE's law); `AUDITCW-B4-cut-shown` and the re-aimed shows records dead |
| B3 | LOW | A cut player's torch still lit the street, the dungeon and the interior (`peerTorchLights` read the whole room): a pool of light walking the walls with nobody under it | FIXED: the torch asks the cut; a concealed player's torch, ungated before this change, is left as it was |
| C3 | LOW | No stub stood `social` null, which it is online with no hub or no account (AUDIT SOC B10): `social?.isPartyPeer` as `social.isPartyPeer` survived and would throw in the frame | FIXED: the frame asked with no social state (nobody's party, the duel still kept); `AUDITCW-C3-social-assumed` dead |
| C4 | LOW | The note was matched as `'[^\n]*'` | FIXED: pinned word for word; the court's old note and an empty one recorded, dead |
| A3 | LOW | A cut stranger at a card table holds a seat that shows taken and empty (`seatedPeerFeet` reads the room) | RECORDED: the seat is the room's - drawn free it would seat me on them; at a table I stand beside they are among the nearest unless the tavern is packed |
| B5 | NOTE | `pageReaders` offered a page to a cut player within reach | FIXED: it asks the cut, as the pick and the gift do |
| A4 | NOTE | One way: a cut stranger's gift from within reach lands (`online.onCast` asks the uncut room) and their duel, trade, party or ride asks prompt, while I cannot press or aim at them | RECORDED in section 21: accepting a duel draws its opponent from the count on |
| A5 | NOTE | Stepping out of the zone the cut turns on that frame, while the relay holds my zone word one trip | RECORDED: an attacker that close is among the nearest |
| A6 | NOTE | The count is off in places where nobody can fight me (a building of the zone, the stands, a building entered during a siege) | RECORDED: the conservative rule, and the note says it in the same words |
| D-L1-L14 | LOW | The world.js import comment; the host's crowd test and peerrange.test.js still saying "court"; section 21's "Everyone by default" and its travel-view line; "a Royal Tourney's bout" narrower than `royalSession.active()` (entry to leaving, a spectator too); the PEER-RANGE fix's "before the court's own"; "the arena" where the catalog writes the Arena; bg, ru, el "nobody hides"; ru "on screen", it "together", nl and pt-BR style; a menu comment's "a player" for "a stranger"; the Ledger row's title and source | FIXED, each |
| N1 | NOTE | Patch notes are owed on the pull request (REL6); none is open yet | RECORDED: they go in its description |
| N2 | NOTE | Where the count cuts is written inline in `bootWorld` (HOST-SPLIT) | RECORDED: `bootWorld` stands at its ceiling (36,312); the `on` is one boolean read off the host's own state, and who is kept moved to the module (`crowdKept`) |

Lane B's cost, measured over the real modules: Everyone 3-7 µs a frame at 60-200 players, Nearest 12 or 24 18-68 µs;
`roomIdentity` about 9 ns (the frame already asks it up to five times for its room key). The churn when the cut turns on
or off costs what walking into a crowded room costs (bodies queued eight at most, skinned four a frame). Lane C's
equivalent mutants (`?.` removed on the sessions, `==` for `===`, `<` for `<=` at the count) need no pin.

Found beside the change, not of it: `A0928-R5-flat-scale-walks-again` (`tools/mutants/audit0928_online.json`, a boat
flat's scale in `scenes/comeSailAway/comeSailAwayPool.js`) survives its pins - on the snapshot before any of this audit's
edits too. Left for its own arc.

## What it left

- The companions of a cut player (B1, OPEN above).
- A cut player's card seat (A3, recorded).
- Not yet seen in a browser over a real crowd.

Pins: `test/systems/gatecrowd.test.js` (11), `test/scenes/wagons1_seats.test.js` and `test/net/peer/fbsea_deck.test.js`
(one each, over the real modules). Moved with the fixes: the looks' pins in `test/systems/disc20.test.js` (the team) and
`test/scenes/audit0928_online.test.js` (the boat), the page's in `test/net/invisnet.test.js` (twice), and the torch's
executed list in `test/characters/audit0928_merge.test.js` (a fresh crowd, which cuts nobody). Mutants
`tools/mutants/gatecrowd.json` 83 and `tools/mutants/peerrange.json` 42, all dead (the two PEER-RANGE party and duel
records re-aimed at their own line); A0928-O4-host-unwired, AINV-B-host-hands-no-look, AINV-F-page-to-the-concealed and
CMATE-page-keeps-the-old-law re-aimed by content (`audit0928_online.json`, `auditinvis.json`, `invisnet.json`).
