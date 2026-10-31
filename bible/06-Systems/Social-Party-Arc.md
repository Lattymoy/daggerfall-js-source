# Friends and Parties

Online players can friend each other, see who is online or when they were last seen, and form a party of up to eight.
The player meets it through the social button beside the chat, which opens the friends and party panel; by pressing F
on another player's body to friend or invite them; through green names and the party HUD (portraits, health,
stamina, magicka); and through party members marked on the world map and the compass. Daggerfall Unity has no
counterpart.

## How it works

### The hub holds the state

Every player online holds one socket in the World channel, so that room's Durable Object is the hub
(`SOCIAL_ROOM` in `src/net/wire.js`; `server/src/index.js`). It keeps each account's record (last name, last seen,
friends, requests each way, invites, party) and each party (leader, members in join order, invites out, seats away) in
its own storage. Presence rooms (cells, dungeons, buildings) learn nothing of it. A name turns green because the hub
told the client which peer ids are its party's, never because a peer claimed it.

The hub speaks in social frames (`validSocialFrame`: state, presence, party, invite, note, error) and party poses
(`{t:'party', acct, p}`: where a member stands and how they fare). Notes are codes the client words; the relay
composes no English. `src/net/social.js` is the client's picture: the last state, the questions the panels ask (is
this peer my party's, a friend, what does the badge count).

### Identity

A peer id is a tab's; a friend is a person. Friends and party seats are keyed by the signed-in player, and the hub
verifies each tab's peer id and its account together. One player is online in one tab at a time (ONE-SEAT,
`bible/06-Systems/Online-Arc.md`).

### Surfaces

- `src/ui/socialPanel.js`, `src/ui/socialMenu.js` - the social button, the friends list and requests.
- `src/ui/partyPanel.js` - the party HUD and its actions: invite, leave, kick, hand the lead to a member
  (`party.lead`), and choose not to rest with the party.
- `src/ui/partyMapMarks.js` - party members on the world map wherever they are; the compass marks them in
  `PARTY_GREEN` (`src/ui/hud/hud.js`).

### What a party shares

- **Quests**: a member's shared quest goes to the party through the hub, at most one every `QUEST_SEND_MS`, and its
  foes ride to the party (`bible/06-Systems/Online-Arc.md`).
- **The map**: automap rows revealed under Shared Cartography (`{t:'amap'}`, every `AMAP_SEND_MS`).
- **Buffs**: a member's effects show on their party portrait, said by the member's own client
  (`src/net/partyBuffs.js`).
- **Spells**: a friendly spell (a heal, a buff) can be cast on a party member (`src/systems/allyCast.js`); no target's
  machine applies a peer's harm.
- **Travel**: a journey to the leader, or together, priced through the travel map's own popup
  (`src/systems/party/partyTravel.js`, `src/systems/party/partyTravelLaw.js`).
- **Loot**: a room's container is one shared base plus each player's own bonus (`bible/06-Systems/Online-Arc.md`).

## Rules

- A party has `PARTY_MAX` seats, eight (Mac).
- The bounds are the wire's: `FRIENDS_MAX` friends, `PENDING_MAX` requests each way, `PARTY_INVITES_MAX` invites out,
  an invite lasting `INVITE_TTL_MS`, a seat kept `PARTY_OFFLINE_MS` for a member who went offline.
- A friend is added from a body in the world or a roster row, by peer id, never by name: names are forgeable.
- A party is a formation for a session, not a guild: it is forgotten when the hub drains, and a seat lapses after five
  minutes offline.
- An account no friend list names is swept after thirty idle days; one a list names is never swept.
- Online forces the enhanced skin, so every surface is the enhanced skin's.

## Code and tests

- `src/net/wire.js` - social frames, party poses, the bounds
- `server/src/index.js` - the hub
- `src/net/social.js` - the client's picture
- `src/ui/socialPanel.js`, `src/ui/partyPanel.js`, `src/ui/partyMapMarks.js` - the surfaces
- `test/net/soc1_hub.test.js` - the hub
- `test/net/soc2_session.test.js` - the client's picture
- `test/net/soc3_socialpanel.test.js`, `test/net/soc4_partyhud.test.js` - the panel and the HUD
- `test/net/party8b.test.js` - eight seats
- `test/net/partylead.test.js` - handing the lead
