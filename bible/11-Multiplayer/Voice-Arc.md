# VOICE - proximity and party voice chat

The record of the voice arc: players heard by the players near them (proximity) and by their party wherever it
stands (party), over a media server of our own. Built by Betawolf1213 (VOICE1 and VOICE2, 2026-10-09 to 10-13 - pull
request #871; VOICE-RELAY-DOOR, 2026-10-16 - #967), taken over and brought onto main at world216 (2026-10-17; world181 on #967's branch, then world213, world214 and world215, renumbered past main's, Elite Gates', WIKIMAID's and SAFE's at the merges), with
the three holds its security review found open closed the same day (VOICE-HEAR, VOICE-ROOMS, VOICE-REVOKE - section 4).

Daggerfall has no voice; DFU has none either. Nothing here departs from a DFU member - it is the online game's own.

**Not the first voice.** An earlier VOICE1 - proximity voice over peer-to-peer WebRTC (STUN only, the relay's `rtc`
frame, world125; PR #427) - was merged and then reverted whole on Mac's word, 2026-09-28: "Do not merge voice chat.
Please revert voice chat but keep other changes" (`06-Systems/Online-Arc.md`, VOICE1 reverted). This arc is another
design (a media server of our own, the relay asked only to vouch), and it shares that one's name by coincidence alone.
Whether voice merges at all is Mac's call, as it was then.

## 1. Status

- **Built and pinned:** the client's law (`src/net/voice/`), the voice service (`server-voice/`), the self-hosted media
  stack (`deploy/voice/`) and the relay's two doors (section 6).
- **Not wired:** no host mounts voice yet - `scenes/world.js` never calls `initVoiceNet`/`frameVoiceNet`. A player sees
  nothing of this arc until that slice lands (section 5 says what it must not reopen). THE FOUR HOSTS RULE binds it: the slice names
  all four hosts, and the wiring goes into a module the host wires (`Host-Split.md`), never into `bootWorld`.
- **Not deployed:** neither Worker is deployed and `VOICE_RELAY_SECRET` is set nowhere. Validated live once, by its
  author (2026-10-13): two browsers joined one proximity room through the podman stack and exchanged real WebRTC
  audio (`RTCPeerConnection.getStats()` showing inbound RTP). Not yet: two real browsers through the relay's presence
  door, a sixteen-player room, a multi-isolate Worker (section 4).

## 2. The three pieces

```
  game client  --HTTPS (JSON)-->  voice service  --HTTPS (Twirp admin)-->  LiveKit (the SFU)
  src/net/voice/  <--credential--  server-voice/                             its own process
        |                               |  presence, party-of (secret-gated)
        |                               v
        |                            the relay (server/, voiceDoor.js)
        +-------------- WebSocket + WebRTC audio, wss://voice.example.com ------------+
```

1. **LiveKit** - a compiled Go server, the SFU: it receives every speaker's audio over WebRTC and forwards it to
   whoever is allowed to hear. The one piece that needs a real host with UDP open; it cannot run on Cloudflare.
2. **`server-voice/`** - the third Worker, beside the relay and the account service: it never touches audio, it
   checks who a player is and where they stand, hands back a short-lived LiveKit credential, and takes a seat back
   once its holder no longer qualifies (the sweep, section 4). The only holder of
   the media server's secret - a different trust from the relay's (whose deploy drops every player) and the account
   service's (the one private key), so a Worker of its own (`server-voice/wrangler.toml`). The same `handle` runs
   under node (`server-voice/src/node.js`) for a fully self-hosted stack.
3. **`src/net/voice/`** - the client: it asks the service over HTTPS, then opens WebRTC straight to LiveKit. No module
   but `voiceTransport.js` knows the LiveKit SDK, which loads lazily on the first connect (`import('livekit-client')`,
   a dev dependency Vite bundles into its own chunk), so a player who never turns voice on never fetches it.

## 3. The media server

`deploy/voice/compose.yaml` stands LiveKit (`livekit.yaml`: `auto_create: false`, 16 participants a room) and the
voice service on one host.

1. **A real key pair.** `docker run --rm livekit/livekit-server generate-keys`; the printed pair into
   `livekit.yaml`'s `keys:` and into `deploy/voice/voice.env` (from `voice.env.example`, gitignored) as
   `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`. The `devkey` pair is for a local stack alone.
2. **Start it.** `cd deploy/voice && podman compose -f compose.yaml --env-file voice.env up -d` (or docker): `livekit`
   on 7880 (signalling), 7881/tcp and 50000-50100/udp (media), and `voice` on 7890, pointed at `livekit:7880` for its
   admin calls (`LIVEKIT_ADMIN_URL` - required: a service that cannot reach that door mints nothing, section 4).
   `curl http://localhost:7890/health` answers the service.
3. **Local only: `rtc.node_ip: 127.0.0.1`.** Under a container on the browser's own machine LiveKit otherwise
   advertises its container-internal address as its ICE candidate: signalling connects and media never does
   ("could not establish pc connection"). A real deployment removes it and sets `use_external_ip: true`.
4. **Going public.** A domain with a reverse proxy terminating TLS in front of 7880 (the client opens `wss://` alone -
   `voiceUrlOk`); UDP 50000-50100 and TCP 7881 forwarded straight to the container (the audio path, which no proxy
   carries); a TURN relay for players on restrictive networks. A small VPS is the realistic minimum.

## 4. The voice service

`POST /v1/voice/token { token, room, ly?, channel, party? }` and `POST /v1/voice/place { token, room, ly?, near }`
(`src/net/voice/voiceWire.js`, the one home of both ends' shapes):

- **Who:** the relay's own identity token (`accountClient.js`'s minter) - its verified subject is the voice identity,
  and a body's `playerId` is never read (`roomAuthorizer.js`). A muted account may listen, not publish - muted by its
  token's `mu`, or by the hub's word (a mute order heard after the token was minted, MOD1). A credential never
  outlives the identity token it was minted from.
- **Where:** a proximity ask is admitted only on the relay's word that the subject is hello'd into the room - and the
  layer - it names (section 6); a party ask only on the hub's word that it sits in the party. No relay configured
  (`RELAY_URL`, `VOICE_RELAY_SECRET`), or a relay that did not answer, refuses both: fail closed. The relay's answer
  is kept 5 s per account, room and layer (`/place` arrives up to `VOICE_PLACE_HZ_MAX` a second); its silence is never
  kept.
- **The room (VOICE-ROOMS):** never the client's string - `voiceRoomName` derives the SFU room from the channel, the
  game's key and its layer, and `roomSharder.js` splits a crowded one into shards of `VOICE_ROOM_MAX` (16), first come,
  sticky per identity (`<room>_s<n>`). A party's room is `vp_<party>`, one shape already. A proximity room is
  `vx_` + 128 bits of SHA-256 over `proximity|<key>|<layer>`, never a spelling of the key: #967's
  `vx_<key, [^A-Za-z0-9_-] to _>[_l<ly>]` folded keys the relay routes apart onto one SFU room - an instance
  (`dungeon:m<id>.i<owner>.<epoch>`, its owner and party alone let in, `Instances.md`) and the ungated
  `dungeon:m<id>,i<owner>,<epoch>` beside it, which anyone may hello into and so stand "present" in - and a layer's
  suffix could be spelled inside a key. A digest is one length of hex, so the shard's suffix after it is always the
  shard's.
- **Who hears whom (VOICE-HEAR):** `proximityPolicy.js` - a publisher is heard only by the listeners who named it back
  within the stale window (mutual), so a lie about position can only widen one's own hearing, never another's. The
  SFU enforces it, held by the publisher: LiveKit refuses a listener a track unless its publisher allowed that identity
  (`setTrackSubscriptionPermissions`), and every client allows nobody the moment it joins, before the microphone is
  published (`voiceTransport.js setListeners`), then exactly the identities `/place`'s answer names (`allowFor`, read
  by `validPlaceAnswer`: an answer not whole, or none, allows nobody - never the last list); a party's room allows its
  members, each vouched for at the door. Before this a listener's own `autoSubscribe: false` was the only law - a
  modified client in a crowded town's room could subscribe every voice in it. The place word is said again every
  `VOICE_PLACE_REFRESH_MS` (1.5 s) while the set holds still, inside the policy's 3 s stale window, or a pair that
  never moved would go deaf. The service's unsubscribes on the SFU (`UpdateSubscriptions`) are a second hand. A
  publisher's own client is what sets its list, so a modified one can open its own voice to the room - its own to
  give, never another's.
- **Revocation (VOICE-REVOKE):** LiveKit reads a credential at the join alone - a participant stays until it leaves or
  is removed, and the SFU refreshes a connected client's token itself - so a credential's short life bounded nothing
  once used: a member kicked from the party, a player gone from the room, an account muted would each keep the seat
  for as long as their client chose. Each credential now carries its seat (`{c, k, l}` - channel, key or party, layer)
  as participant metadata a client cannot change (`canUpdateOwnMetadata: false`), and `revoker.js` sweeps: every SFU
  room this service names (`ListRooms`, then `ListParticipants`), every seat judged against the relay's word now -
  removed (`RemoveParticipant`) when the room or the party no longer holds it, or it sits in a room its seat does not
  name, or it carries no seat of ours, or its account is banned (VOICE-BAN: SAFE4's ban, which also refuses the mint
  either channel); its microphone shut (`UpdateParticipant`, `can_publish` off - LiveKit unpublishes the track) while
  the hub mutes it; every seat kept while the relay is silent (an outage must not drop
  every call at once - and the mint refuses on the same silence). The Worker sweeps on its cron, each minute
  (`wrangler.toml [triggers]`); the node service every `VOICE_SWEEP_MS` (20 s). One sweep reads at most
  `VOICE_SWEEP_ROOMS_MAX` (16) rooms - a Worker invocation's 1,000 subrequests at full rooms - and the next starts where
  it stopped, so past 16 rooms a seat waits a sweep for every 16. The service needs the SFU's admin door for this, so
  without `LIVEKIT_ADMIN_URL` it mints nothing (503 `no-media-server`): a seat it could not take back is a seat it does
  not give.
- **Rates:** `VOICE_MINT_PER_MIN` mints a minute and `VOICE_PLACE_HZ_MAX` place frames a second an identity; the node
  door refuses a body past `VOICE_BODY_MAX_BYTES` before reading it.
- **Known limit - one isolate.** The policy and the sharder are memory, per isolate (no Durable Object). A Worker
  deploy that spreads players over isolates splits their words: it fails closed (fewer heard, never more), but at
  any real scale voice would go quiet. The node service beside the SFU is one process and has no such limit; a
  Worker deploy past a handful of players needs the policy in a Durable Object first.

## 5. The client and its seams

`VoiceClient` (`voiceClient.js`) is a null object while voice is off - nothing fetched, no SDK, no microphone - and
catches every failure into its state: a voice outage never stops the game. Its retries wait a jittered, doubling
time (`net/backoff.js jittered`), so a relay deploy or an SFU outage does not have every client ask again at once.
The microphone is asked for only after the player's opt-in; a refused one leaves a listener's session.

`voiceNet.js` (the session's one `VoiceClient`) is the seam the wiring slice mounts. VOICE2 built two more - the HUD's
indicator (`ui/voiceHud.js`) and the settings' Voice rows (`ui/voiceSettings.js`) - and they wait for that slice:
AUDIT UI 2 (`test/ui/enhanced/enhancedPause.test.js`) holds every `src/ui` module reachable from a host, its staging
exemption gone on purpose (PX24: a window built, pinned and opened by nothing), so they come back with their mount -
`git checkout c6fa40ec4 -- src/ui/voiceHud.js src/ui/voiceSettings.js`, then `node tools/moveModule.mjs --fixup` for
the client's paths (`src/voice/` is `src/net/voice/` now), and their words through `t()` (L10N4). What the slice must
not reopen (VOICE2's notes):

- `VoiceState.onChange` is ONE slot, not a list: a second consumer chains it (save the old, call it first) and
  restores it on teardown; past two or three consumers it becomes a listener set in `voiceState.js`.
- `voiceHud.js`'s `update(state)` is pull: the HUD's frame calls it, or the indicator freezes at `off`.
- `initVoiceNet` twice is a no-op that ignores the second options: `destroyVoiceNet` first when the audio context is
  rebuilt.
- `frameVoiceNet` swallows every error into the console (a voice bug never stops the loop) - a wrong `peers` shape
  shows only as a repeating console error, so read the console the first time it is wired.
- `frameVoiceNet` takes the room's `layer` too (online.js's `layer`, said in the room's welcome) - section 6.
- `voiceSettingsRows()` hands back new rows and listeners on each call: its mount replaces `.list`'s children
  wholesale, or rows and listeners pile up across the settings pane's re-renders.

## 6. The relay's doors (VOICE-RELAY-DOOR)

Before these doors a proximity ask's `room` was trusted on the client's word: two strangers naming the same key heard
each other wherever they stood. And the party check called `RELAY_URL/party/<acct>`, which the relay never routed,
so party voice checked nothing. `server/src/voiceDoor.js` answers both (world216):

- **The secret.** `POST /internal/voice/presence` and `/internal/voice/party-of` are the public Worker's, called by
  another Worker over the internet, so each is gated by the Worker SECRET `VOICE_RELAY_SECRET` (`npx wrangler secret
  put VOICE_RELAY_SECRET`, the same value as the service's) in header `x-voice-relay-secret`, compared in constant
  time; unset, missing or wrong all answer 403. A secret is not the bundle's bytes: rotating it moves no
  `RELAY_VERSION` and drops nobody.
- **Presence.** The room's key is the relay's own shape (`voiceRoomKeyOk`: a `kind:` key `roomOf` routes -
  `world:<x>,<y>` the open world's, which the first wire's guessed pattern refused). A crowded place overflows into
  layers (wire.js SCALE5d, `key#n`), each its own object and its own crowd, so the ask names the layer its welcome
  said (`ly`, 0 to `LAYERS_MAX - 1`) and the door asks THAT object - the place's own asked of a layer-1 player would
  answer "not here" in exactly the crowded towns voice is for. A layer is asked only of a room that layers; a gate's
  court answers for its copies itself, holding their sockets (`_courtHello`). The object's own half,
  `Room._voicePresenceInternal`, reads its verified-subject index (`_bySub`), never a body.
- **Party-of.** Always the hub's bus (`SOCIAL_ROOM` - its shards hold sockets, the bus the parties), read as every hub
  reading is (`Room._voicePartyOfInternal` -> `_myParty`: a lapsed seat walked out first, a stale pointer cleared).
  It says the account's mute beside its party (`{ party, mu }`, VOICE-REVOKE): `mu` off its sockets on the bus (each
  shard's player is a virtual socket there), which every signed mute order the bus hears rewrites - the newest order
  over a token minted before it - else the bus's own order for an account with no socket; and the ban it is under
  (`bn`, SAFE4's `_bans` - the hub takes every ban the account service's law door pushes), `{ party, mu, bn }`.
- **Never an exception, never a no.** A room reset or slow is `unavailable` (503), never an error out of the Worker
  (DO-ASK's law) - and never `here: false` / `party: null`, which the service's sweep would read as "gone" and drop
  every call on at once. The service's mint refuses on it, and its sweep leaves every seat be.
- Pinned by `test/server/voicedoor.test.js` through real Rooms and real hellos, each pin killed by its mutant.

## 7. Open

- The wiring slice (section 1), with the HUD's and the settings' mounts.
- Deploy: the voice Worker or the node service with the stack, `VOICE_RELAY_SECRET` on both sides, the relay at
  world216.
- A Durable Object for the policy before a multi-isolate Worker deploy (section 4).
- The sweep's reach: one relay ask a seat for its standing and one for its presence (each kept 5 s), so past
  `VOICE_SWEEP_ROOMS_MAX` rooms revocation waits a sweep per 16 rooms. A batched door on the relay (many accounts one
  ask) would lift both limits.
- Spatial shards: a crowded voice room splits by arrival, so two players side by side can land in different shards
  (`roomSharder.js`'s own note); a layer already splits the game's crowd the same way the voice rooms do.
