# The social arc - friends, presence and the four-seat party (SOC, 2026-09-16)

Mac: "I want to add a new UI for online (classic/enhanced). A social button
next to the chat UI, that when tapped opens the new friends list + party
interface. Players should now be able to friend other users, see if they
are online/last online + be able to invite friends or other individuals to
the new 4 person party system. Party system: Upon joining a party, the
players name who are in a party together should turn green. Theyre
character portrait + health/stamins/magicia stats displayed on a new party
UI element. Players should be able to interact with others in the world
upon encountering them by pressing F on their body, which should show
options to add as a friend or invite to a party. Party members should be
able to be seen on the world map, regardless of their location. Im really
wanting this to be well designed, extremely detailed and perfect. Please
take your time and treat this as your baby."

Not a DFU member: Daggerfall Unity has no friends, no parties and no
online. The port's own, on the ONLINE arc (`06-Systems/Online-Arc.md`)
and its chat (`06-Systems/Chat-Roster-And-Names.md`). Ledger A row
(SOCIAL). Seven slices: SOC1 the wire and the hub, SOC2 the client's
picture, SOC3 the social button and the friends + party panel, SOC4 the
party HUD and the green names, SOC5 the F key on a body, SOC6 the party on
the map, SOC7 the records and the campaign. Every slice landed on 2026-09-16; the
four surfaces were built by four lanes in parallel worktrees over the
SOC1/SOC2 seams and integrated by hand (the chat frame's tail, the
colour's one home, the one SOCIAL Ledger row).

"Classic/enhanced": online forces the enhanced lane (OL1, `systems/
onlineLane.js` - the skin enhanced, every enhancement on), so every surface
below is the enhanced skin's DOM beside the chat; the classic skin never
runs online and gets no social surface. The classic TRAVEL MAP is reached
from the enhanced lane's fork (`ui/travelMapDoor.js`) and gets the party's
dots in its own idiom.

## The two decisions everything else follows from

**Where the state lives: the world channel's object is THE HUB.** Every
player online holds one socket in `chat:world` (ROSTER-G made it "the one
room every player is in", and its welcome already names everyone), so that
room's Durable Object is the one place that can see everyone at once. It
keeps the social state in its own storage - `acct:<id>` an account's
record (its last name, when it was last seen, its friends, its requests
each way, its party invites, its party), `asecret:<id>` the account's
secret, `party:<id>` a party (its leader, its members in join order, its
invites out, its seats gone away). Nothing about a presence room changed:
a cell, a dungeon, a building learns nothing new and is told nothing. A
party member's name is green because the hub told MY client which peer ids
are my party's (every row the hub sends carries the peer ids that
account's tabs stand as), never because a self-declared "I am in a party"
rode a presence hello into a room that could not check it.

**Two identities, both guarded.** A PEER id is a tab's (TABS1: minted per
tab in sessionStorage, so two tabs are two players), which is exactly
wrong for a friend list - a friend is a person, and here a person is a
browser profile. So a hello to the hub may carry an ACCOUNT id and its
secret beside the peer's (`acct`, `asecret`: the same shape and the same
law as the peer's pair - ID_RE, SECRET_RE; the first hello mints the
secret, a later one must match; AUDIT ONLINE A3 again), minted once per
profile in the app's own storage (`net/social.js accountId`,
`systems/appStorage.js` - localStorage in a browser, the shell's file
store on the desktop; NOT beside `peerId`, because TABS1's pin holds
`net/online.js` to the tab's storage and that pin is right about the
peer). The chat link already carries the tab's peer id and secret, so the
hub verifies BOTH ends of the mapping peer -> account. A hello that names
an account with the wrong secret is admitted to the chat and told
`account taken`, with no account on its socket; a hello naming none is a
build before this slice, admitted as it always was. Both halves or
neither: one half is `bad account`, an error like a bad id.

## SOC1 - the wire and the hub (`world78`)

`src/net/wire.js`, the SOC1 section. The acts a client may send:
`{t:'social', k}` with `k` one of SOCIAL_ACTS and the frame naming
exactly what that kind needs - `friend.request` and `party.invite` a
TARGET (`acct` an account id from my own lists, or `peer` a peer id: the
one thing I can see of a stranger in the world, resolved by the hub to the
account behind that socket; one of the two, never both, never neither),
`friend.accept/decline/cancel/remove` and `party.kick` an `acct`,
`party.accept/decline` a `party`, `party.leave` nothing. `{t:'party', p}`
my party pose - where I stand and how I fare - projected by
`validPartyPose`: `px`,`py` the map pixel clamped to the map (in a dungeon
or a building the pixel of the place, "regardless of their location"),
`in` 0/1/2 (outside, a dungeon, a building), `loc` the place's name as a
label (printable ASCII, collapsed, bounded, and through the NAME FILTER -
a place a modified client writes is shown to that player's party), the six
vitals each finite in [0, FOE_HEALTH_MAX] and rounded (a bar reads no
fraction), the portrait's recipe (`race`, `gender`, `face` by validLook's
own bounds); refused WHOLE when any named field is outside its law.

The hub's six frames, projected at the client's door by
`validSocialFrame` (CHAT-G's law: the relay is the player's choice, so a
frame it shapes is dropped whole, never half applied): `state` my whole
picture (name, friends, in, out, party, invites), `presence` a friend's
row (online, seen, peers), `party` my party as it stands or null,
`invite` a party asks for me (the party, who asked, who is in it, when it
lapses), `note` something happened as a CODE the client puts words to
(NOTE_CODES - the relay writes no chat line), `error` the hub refused ONE
act, in words (a full friend list is not a protocol violation and closes
nothing). A row's list is cut at its bound; a bad row refuses the frame; a
party view whose leader is no member is no party; a note with a code the
client has no words for is nothing. `{t:'party', acct, p}` a member's
pose. The bounds: FRIENDS_MAX 64, PENDING_MAX 32 each way (and invites
held), PARTY_MAX 4 ("the new 4 person party system"), PARTY_INVITES_MAX
8 outstanding from one party, INVITE_TTL_MS two minutes, PARTY_OFFLINE_MS
five minutes for a seat whose member dropped, ACCOUNT_TABS_MAX 8 peer ids
named per account. The gates: SOCIAL_HZ_MAX 2 a socket (the same strikes
as the poses), SOCIAL_ROOM_HZ_MAX 64 the whole hub (over it `busy`, nobody
struck - AUDIT CHAT A2's law, a room-wide bound on every arm),
PARTY_HZ_MAX 2 a socket with PARTY_SEND_MS 1000 the client's own floor.
Every act and every gate is also run at home (`net/online.js`), so an act
the hub would drop without a word is never sent.

`server/src/index.js`, THE HUB. The hello: after the channel's welcome
and its join fan (so a client's session has reset on the welcome before
its picture lands), the account's secret guarded, the record made or
refreshed (the hello's name, seen now), its party's seat taken back (the
`away` stamp cleared) or found gone (a lapse, a drain, a kick while it was
away - the record's stale pointer cleared), the whole picture handed to
THIS socket alone (a second tab has its own), then the friends told
(presence) and the party told - on EVERY hello, a second tab's too,
because the peer ids my tabs stand as are what a friend's client marks me
by in the world. The leave: last seen stamped when the account's LAST tab
goes and not before, the friends told, the seat marked `away`. Friends: a
request by peer or by account (the target must have a record - an account
nobody ever said hello with mints none; `that is you`, `they are not
online`, `they have no account`, `already friends`, `already asked`, the
four caps, all in words), both pictures updated and a note to the
receiver; a request back to someone who asked me first is a yes; accept
makes friends both ways with a note to the asker; decline and cancel are
quiet; remove is mutual. Parties: the first invite MAKES the party with
the inviter in the seat (any member may invite; the leader alone kicks);
the invite goes to the invited alone with its expiry; a yes seats them,
spends the invite, and everyone hears the view; four seats and no fifth; a
lapsed invite is refused and shed from the picture; a no is told to the
asker; a yes to another party is a no to the old; leave passes the seat to
the longest-standing member (members are kept in join order) and the last
one out dissolves the party; the kicked is told (`party: null` and a note
whose subject is themselves). The party pose is kept on the sender's
attachment (`pm` - the seat it may yet take reads it, so a joiner's view
carries the poses from before) and fanned to the party's other members'
sockets alone - never back to the sender, never to the sender's own other
tab, never to a stranger; the next view carries the newest pose among an
account's tabs. A seat is kept PARTY_OFFLINE_MS for a member that dropped
(a page refresh, a blip - the hello brings them straight back); past it
the seat lapses on the next party event (a pose, an act, a hello) with the
rest told and the seat passed if it was the leader's. A hibernation
between acts loses nothing: the records and the parties are storage's
(the instance keeps a party cache while awake), the seat and the pose ride
the attachments. The drain's sweep forgets the parties (nobody is online
to hold one) and never an account or its secret - an account is a
kilobyte, and a friend list that forgets people is worse. Outside the hub
a social act or a party pose is junk (a correct client sends none there),
counted and struck out like every other frame that should not have come.

RELAY_VERSION `world78`; the law's row is in `test/relayversion.test.js`.
`test/soc1_hub.test.js` - 17 pins over the fake Durable Object and the
wire's projections, every frame the hub sends checked through the client's
own door.

## SOC2 - the client's picture

`src/net/social.js`, pure and DOM-free: `accountId`/`accountSecret` (the
profile's pair), `SocialState` - the last state frame kept current by the
smaller ones (`apply(frame)` returns what changed; `applyParty(acct, p)` a
member's pose onto the seat; a party view rides over and KEEPS the poses
already held, since a view says the latest pose the hub holds and a pose
frame in between is newer; presence for someone who is not a friend is
nothing; an invite to the party I sit in is nothing; the seat spends the
invite), the questions the surfaces ask (`partyPeers()` the peer ids to
draw green, `isPartyPeer`, `accountOfPeer` - the bridge from a body in the
world to a person, my own seat's tabs included so `relation` says `me` -
`relation`, `inMyParty`, `actionsFor(peerId)` with the reasons a button is
disabled, `pendingCount` for the badge, `liveInvites` dropping the lapsed
as they are read, `others`, `leads`, `seatsFree`), a version counter that
moves on every change and only then (ChatLog's law: a panel repaints on a
new number, never per frame), the hooks (`onChange`, `onNote` with the
words, `onError`, `onInvite`), `lastOnlineText` ("Online", "Last online
5 min ago", "yesterday", "3 weeks ago", "long ago", "Never online" - on the
RELAY's clock through WORLD5's offset), `noteText` (the words for every
NOTE_CODE; "You lead the party now" when the subject is me), PARTY_GREEN
(the name draw's RGBA) and PARTY_GREEN_CSS / FRIEND_CSS for the DOM.

`src/net/online.js`: `acct`/`asecret` on the session only when the caller
hands BOTH in (the hub link's alone; never defaulted from storage - a
presence room must never be told an account), `_helloFrame` builds the
hello once and adds the pair when held (a session without it sends the
hello every build before SOC1 sent, key for key - every older hello pin
stands), `onSocial`/`onParty` delivered through the wire's door and
contained like every handler (ONCRASH1), `sendSocial` gated at
SOCIAL_HZ_MAX with the token spent only on an act that left, `sendParty`
projected first, floored at PARTY_SEND_MS, sent only when CHANGED (a
member standing still with steady vitals costs the hub nothing), and whole
again after a reopened socket (the hub's attachment is fresh).

`src/scenes/world.js`: the hub tab's link is handed the pair after its
join (a socket opens on a later turn; CHAT1's pin holds the loop's five
lines as they stand); `socialStart()` holds the picture over that link and
puts its notes and refusals on the world tab as system lines (SRV-N's
flag: a line nobody sent); `composePartyPose` reads the travel pixel (the
place's own inside a dungeon), the place's name, the six vitals and the
look; `partyFrame` rides the chat frame once a second while I sit in a
party, composing at most twice a second and leaving the send to the
link's own floor and change check. `test/soc2_session.test.js` - 8 pins
over a fake socket and plain frames.

## SOC3 - the social button and the friends + party panel

**The button is the chat's** (`ui/chatPanel.js`, three new optional
options - a host that passes none gets the chat it had byte for byte).
`dfchat-social` stands in BOTH chat states: beside the Chat button when
the chat is closed, at the far end of the tab bar when it is open, each
with a badge that counts requests to me plus invitations standing (one
law, `social.pendingCount()` - an unread LINE is not one of them) in its
own colour. Drawn on a desktop too, because Enter opens the chat and until
SOC5 nothing else opens this; Hide takes it away with everything else.

**`nameColor`** recolours the author of a chat line (the peek and the open
list) and the roster rows on every frame rather than at build time - a
seat changes with no line said - and it ASKS the picture rather than
deciding: `social.cssColorOf(id)` is PARTY_GREEN_CSS for my party's tabs,
FRIEND_CSS for a friend who is not in my party, null for a stranger, so
the world (`colorOf`, SOC4) and the chat can never disagree about what a
colour means. **`rowActions`** turns a roster row into a door: a click
opens a small menu built from `social.actionsFor(peerId)` - Add friend /
Invite to party / Remove friend - with a disabled action carrying its
reason as the title; my own row is never a door, nor is any row while
there is no picture yet.

**The panel** (`ui/socialPanel.js`, `createSocialPanel({ social, send,
canOpen, onOpen, onClose, overlay, doc, win, touch })`) is a pointer
surface with the chat's own three doors: the host refuses it under a
window, the cursor is freed inside the opening gesture and taken back
inside the closing one, Escape closes it and never reaches the host's
pause door, an enhanced overlay hides it as it hides the chat. Friends
tab: Requests first (Accept / Decline / Cancel, by ACCOUNT - a friend is
a person, not a tab), then the friends ONLINE FIRST then by name, each
row a dot, the name in party green or friend blue, and `lastOnlineText`
on the relay's clock; Invite is live only while the friend has a tab in
the world and a seat is free (the refusal - "offline", "in your party",
"the party is full" - is the button's title, because a control that
quietly vanishes teaches nothing); Remove ARMS on one click and sends on
the second, with no `window.confirm` anywhere. Party tab: "Your party
(n/4)", the leader marked, each member's last pose as "Daggerfall - 50/60
HP" (nothing for a member who has sent none), Leave for everyone, Kick
for the leader alone; invitations with a countdown that runs on the same
node, answered by PARTY id - and a lapsed one is gone even though time
passing moves no version, because the panel raises its own. The invite
TOAST works with the panel shut (over the chat's peek strip), counts down,
and goes away on the answer, on the seat being taken and at expiry; a
rate-gated answer leaves it up with a "try again" note. A send the link
refuses (SOCIAL_HZ_MAX at home) keeps its button exactly as it was; the
hub's own refusal stands under the header until a fresh picture clears
it. No uiPrefs key: the panel does not remember its state across
sessions. `test/soc3_socialpanel.test.js` - 16 pins over a fake document
and window with a REAL SocialState fed real hub frames; 7 mutants walked,
7 killed.

## SOC4 - the party HUD and the green names

**The HUD** (`ui/partyPanel.js`, `createPartyPanel({ social, doc, art: {
fetchBytes, palette }, faceLoader, touch })`): fixed at the top right
below the FPS counter (lower on touch, clear of the top-right button
row), pointer-transparent, one card per OTHER member of my party in the
hub's seat order and never my own (my bars are the HUD's, my face is on
my paper doll). A card: a 72x80 plate holding a canvas PORTRAIT - the
game's own face art, `raceArt(race, gender).heads` -> `CifRciFile` ->
`getDFBitmap(face)` -> `bitmapToColor32` -> `putImageData` at a whole
nearest scale, the same CIF the paper doll and the escort faces read,
cached per race / gender / face, one CIF load per file, loaded off the
frame with the plate standing until it lands and a failure remembered
(warned once, never retried per frame); the name in PARTY_GREEN_CSS
(imported from `net/social.js` - one home, the host names no colour) with
a leader mark; the place line (`p.loc`, "- dungeon" / "- inside" from
`p.in`, "the wilderness" for a nameless exterior); three bars with their
digits, health red, stamina green, magicka blue, from `p.h/hm`, `p.f/fm`,
`p.m/mm`. No pose yet: "- / -" and empty bars, never "0 / 0", which reads
as dying. An away seat is greyed whole with the last-online words. Hidden
out of a party, alone in one, and under a window. **The repaint is a
write, not a rebuild**: `render({ covered })` runs every frame and paints
only when `social.version` moved; a member's pose moves one card through
the same nodes; the cards are re-parented only when the seat order really
changed - and the pins COUNT the writes (sixty quiet frames write
nothing).

**The green names**: `net/remotePlayers.js drawNames` gains a trailing
optional `colorOf` ((id) => rgba or null; the default path - every caller
written before the party existed - is white byte for byte), and
`world.js` hands it `(id) => social?.colorOf(id) ?? null`: my party's
tabs in PARTY_GREEN, a friend who is not in my party white (a friend is a
list, a party is a formation). `test/soc4_partyhud.test.js` - 8 pins,
the portrait proved twice (an injected loader seam, and `createFaceLoader`
over a CIF synthesized byte by byte through the real `CifRciFile` walk and
the real `bitmapToColor32`).

## SOC5 - F on a body

**The action.** `SocialInteract` is APPENDED past DFU's forty-four in
`systems/inputActions.js` - the port's own (Daggerfall Unity has no other
players to stand in front of), appended and never inserted because the
classic controls window indexes ACTIONS by number against fixed pixel
anchors on CNFG00I0.IMG. Defaulted to KeyF (the key Mac named, and one
SetupDefaults leaves free) and autofilled into a bindings file written
before the slice through `loadOrCreateBindings`' own defaults pass - no
reset, nothing else disturbed, and a key the player had already spent on
F left alone (the action waits, unbound and rebindable). The enhanced
controls window shows it in a third group, "Online" (`PORT_ROWS`), because
GRID_ACTIONS is still DFU's Actions[2..40) and ADVANCED_ROWS is still the
mouse window's six, and the coverage rule - every bindable action exactly
one row - is what makes the group compulsory; the classic window cannot
place it (its lowest rows sit at y=181, a button is 7 tall and the tabs
start at y=190), and says so in a comment. `ui/input.js routeAction`
hands it to `ctx.socialInteract` and passes the door's own answer back,
so an offline page's false falls through the host's ladder.

**The reach.** `player/socialPick.js pickPeerInFront(camPos, fwd, peers,
reach, distanceOf)` - pure: the nearest in front wins, behind is not in
the race (the cylinder answers Infinity for t <= 0), past the reach is
nobody rather than the nearest of the far ones; the cylinder is
`scenes/townTalk.js rayPersonDistance`, HANDED IN rather than imported
(no `player/ -> scenes/` import, and no second copy of the radius and
height - HARD2's own defect); SOCIAL_REACH is the game's own
MobileNpcActivationDistance (6.4), so "close enough to talk to" and
"close enough to friend" cannot disagree on one street corner. In
`world.js`, `socialInteract()` sits below the `peersNear` it measures,
composes the camera's forward exactly as the activation site does, and
answers three ways: the menu open - hide it (a second F closes); a peer
under the ray - `socialMenu.show(...)`; nobody - `socialPanel?.toggle?.()`
(F with nobody in front opens the list, the same gesture one step out);
no picture (offline) - false.

**The menu** (`ui/socialMenu.js`, `createSocialMenu({ onAct, canOpen,
onOpen, onClose, doc, win })`): a card near the screen centre with the
peer's name and the rows Add friend / Invite to party (Remove friend for a
friend, and only when the picture holds their account - `friend.remove`
is an account act), each enabled or disabled with `actionsFor`'s reason
on the row and the title; a disabled click sends nothing; the card goes
DOWN before the host is handed the act (the send can answer false, and a
card left standing takes the next press as a second act); the pointer
freed on open and taken back on close (the chat's own doors); Escape
closes it and is stopped before the host's pause door; a covering window
takes it away. Its acts leave through the LIVE `socialLink()` (a
reconnect replaces the session object), and a word lands on the world tab
either way - "Friend request sent to X" / "Party invite sent to X" when it
went, "Try again in a moment" when the gate refused.

**The key it had to move.** Handheld Torches shipped its light toggle on
F, and HT4's gate holds that no vendored mod ships a key the port has
already spent - online forces every vendored mod on, so every online
player would have lit a torch on the press that opened the F-menu. The
toggle's shipped default is **O** now (free in DFU's defaults, unused by
the mod's other two keys and by every other vendored mod), its pins say
so, and a player who rebound it keeps their own. Mac named F for the
social key, so the port's action keeps it. `test/soc5_interact.test.js` -
9 pins; 16 mutants driven, 16 dead.

## SOC6 - the party on the map

**One seam, two drawings.** The travel map's one dep bag (`world.js`
buildTravelMapWindow -> `ui/travelMapDoor.js`) carries `party: () =>
[{acct, name, px, py, in, loc, online, leader}]` - a FUNCTION, read on
each window's own refresh and never snapshot at open, because members
travel, step into a dungeon, drop and join while a map is up.
`world.js partyMarkers()` composes it from `social.others()`, omitting a
seat whose first pose has not landed (`p` is null until then, and a mark
at 0,0 would put a friend in the Iliac Sea off Northmoor).
`ui/partyMapMarks.js` is the ONE reading of that shape for both maps:
validate, drop what cannot be drawn (a row off the bay's edge, a
non-finite pixel, a poseless seat, a non-list answer), never clamp; the
colours derived from `net/social.js`'s PARTY_GREEN / PARTY_GREEN_CSS with
a grey pair for offline; a repaint signature that moves for a pixel, a
floor, a name or a presence and not for a pose that said the same thing.

**The enhanced overworld map** (the one online forces): a green ring per
member pushed into the PLAYER'S OWN ring pass at the pixel's centre, told
from the player's white ring by colour and size, so it rides every pan,
zoom and flight with no code about any of those; the name under it,
placed through `_project` each frame; "Name - place (dungeon)" /
"(inside)" in the window's own hover line, which beats the location under
the same cursor; a legend that opens with the first member and closes
with the last; offline greys and STAYS (where a friend logged out is worth
knowing). The marks never dirty the location-marker buffer; a 0.25 s poll
re-reads the seam. **The classic region page** gets its dots too: a
member is a green dot in the page's own dots buffer, written LAST so it
wins the pixel over the town they stand in, under the page's two
containment laws (the OFFSET_LOOKUP origin rect, and "a pixel belongs to
one province's sheet" through getPoliticIndex), rebuilt only when the
signature changed on a 0.5 s poll placed above the popup returns so a box
on top does not freeze a walking friend. No legend there: TRAV0I00's
bottom bar is baked art with no room for a fifth meaning, so the classic
sheet says the one thing it can (a dot) and the enhanced map, which owns
its chrome, carries the legend and the names. A marker is hover-only;
clicking still picks the nearest location. `test/soc6_partymap.test.js` -
14 pins; 29 mutants driven, 29 dead (the first pass left one survivor -
the classic bounds removed - closed by the two members whose offsets wrap
onto the wrong row).

## What was refused, and why

- **A friend by name.** Names are forgeable and shared (the filter guards
  the words, not the impersonation - SRV-N's own lesson), so a friend is
  added from a body in the world (F) or a roster row, by PEER id, and the
  hub resolves it to the account. There is no "add friend by name" field.
- **A party that outlives everyone.** Parties are forgotten when the hub
  drains and a seat lapses after five minutes offline. A party is a
  formation for a session, not a guild; a persistent group would need a
  roster nobody online can vouch for.
- **Accounts that expire.** An account is a kilobyte; forgetting one
  dangles it in every friend list that names it. Never swept.
- **A relay that composes English.** Notes are codes; the client says
  them. A relay line in the chat would be a relay a modified client could
  make speak.

## The campaign

`tools/mutants/soc1.json`: 38 mutants over the wire and the hub (a fifth
seat, the account secret optional, a target named twice, a vital
unbounded or unrounded, the place unfiltered, a leader who is no member, a
bad row dropped instead of refusing the frame, a note code unchecked, the
wrong secret admitted, the picture sent to every tab, presence to the
whole room, seen stamped on the first of two tabs, a one-sided friendship,
the mutual request left pending, the note to the sender, a cap on one
side, the inbox unbounded, the party unmade by its invite, the invite to
the room, a lapsed invite honoured, the seat passed to the newest, an
empty party kept, anyone kicking, two parties at once, the pose fanned
back, the view without its pose, the seat lost on the drop or kept for
ever, the act ungated, the room budget missing, a cell taking party poses,
the party on the instance alone, accounts swept with the looks, parties
kept past the drain, the picture before the welcome, the version left at
world77) - **38 dead, 0 survived**. `tools/mutants/soc2.json`: 21 over the
session, the picture and the world.js seam (the account in the tab's
storage, one half sent, the account defaulted, the gate off, a made-up
kind sent, an act without an account, an unchanged pose re-sent, a bad
pose sent, the door's memory kept across a reconnect, the social door
skipped, my own pose delivered, presence for a stranger kept, a stale
invite after joining, the version bumped per frame, a pose lost under a
view, my own tab green, a friend friended twice, a fifth invite offered,
"you" said as a name, the account on the presence session) - **20 dead, 0
survived, 1 equivalent as recorded** (the clamp on a stamp ahead of the
clock: every branch below the minute says "just now" either way). The
first run had one survivor, C2 (one half of the pair set on the session
after construction still sent), closed by a pin in the same commit.
Re-runnable with `node tools/mutate.mjs tools/mutants/soc1.json` and
`... soc2.json`.
