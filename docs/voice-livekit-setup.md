# Voice chat setup: LiveKit server and how it connects to the game's JS

This explains the moving pieces for self-hosted voice chat (proximity + party) and exactly how a browser tab's
JavaScript ends up exchanging live audio with other players through them.

**Validated live (2026-10-13):** two independent browser instances joined the same proximity room through this
exact stack (podman LiveKit + the voice service) and exchanged real WebRTC audio - confirmed via
`RTCPeerConnection.getStats()` showing inbound RTP packets actually received, not just a subscription flag.

## The three pieces

```
┌─────────────────┐  HTTPS (JSON)   ┌──────────────────┐  HTTPS (Twirp)   ┌──────────────────┐
│  Game client     │ ───────────────▶│  voice service   │ ───────────────▶│  LiveKit server  │
│  (src/voice/)    │                 │  (server-voice/) │   admin API      │  (its own process)│
│  browser/Electron│ ◀───────────────│  Node or Worker  │                  │  Go binary        │
└────────┬─────────┘   credential    └──────────────────┘                  └────────┬─────────┘
         │                                                                           │
         └──────────────────────── WebSocket + WebRTC (audio) ───────────────────────┘
                                   wss://voice.example.com:7880
```

1. **LiveKit server** - a real, always-running process (not JS). It is the SFU: it receives every speaker's audio
   over WebRTC and forwards it to whoever is allowed to hear them. This is the piece that needs a real host.
2. **`server-voice/`** - our small Node/Worker service. It never touches audio; it only checks who a player is and
   hands back a short-lived credential for LiveKit.
3. **`src/voice/`** - the browser/Electron client. It talks to #2 over plain HTTPS, then opens a WebRTC connection
   straight to #1 to actually send/receive audio.

Only #1 needs a public IP and open UDP ports. #2 is a cheap stateless service (it can sit on the same box, or on
Cloudflare Workers). #3 ships inside the game bundle and needs nothing special to run.

## Setting up the LiveKit server

LiveKit is a compiled Go server, distributed as a Docker/Podman image - there's no npm package to install it.

### 1. Generate a real key pair (production)

The `devkey` / `devsecret...` pair in `deploy/voice/livekit.yaml` is for local testing only. For anything players
will actually use, generate a real pair:

```bash
docker run --rm livekit/livekit-server generate-keys
```

Put the printed `API Key` / `API Secret` into `deploy/voice/livekit.yaml` under `keys:`, and the same two values
into `deploy/voice/voice.env` (copied from `voice.env.example`) as `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`. Both
sides must share this pair - it's how the voice service's credentials are trusted by LiveKit.

### 2. Start the stack

```bash
cd deploy/voice
cp voice.env.example voice.env     # fill in the key pair, IDENTITY_PUBLIC_KEY, LIVEKIT_URL, CORS_ORIGIN
podman compose -f compose.yaml --env-file voice.env up -d     # or: docker compose
```

This starts two containers: `livekit` (the SFU, ports 7880/7881/50000-50100) and `voice` (our service, port 7890,
already pointed at `livekit:7880` for its admin calls).

### 3. Confirm it's alive

```bash
curl http://localhost:7890/health          # the voice service
curl -o /dev/null -w '%{http_code}\n' http://localhost:7880/     # the SFU (expect 200)
```

### 4. Local-only gotcha: `node_ip`

Running under Docker/Podman on the same machine your browser is on, `livekit.yaml` must set `rtc.node_ip: 127.0.0.1`.
Without it the server advertises its **container-internal** IP (e.g. `10.89.0.2`) as its ICE candidate - the browser
can never reach that address, so the WebSocket signalling connects fine but **media never does** ("could not
establish pc connection"). For a real deployment remove this line and set `use_external_ip: true` instead.

### 5. Going public

For real players, LiveKit needs:
- A public IP / domain, with a reverse proxy (Caddy, nginx) terminating TLS in front of port 7880 so the client
  can open `wss://voice.example.com` instead of plaintext `ws://`.
- UDP 50000-50100 and TCP 7881 forwarded straight through to the LiveKit container - this is the actual audio
  path and can't go through a reverse proxy.
- `rtc.use_external_ip: true` in `livekit.yaml` if the host is behind NAT, or a TURN relay for players on
  restrictive networks.

This is the part described in the original plan's section 7/8 - a small VPS ($25-75/mo) is the realistic minimum,
the same category of commitment as running any dedicated voice server.

## How the JS connects to it

Nothing in `src/voice/` ever holds a LiveKit API key - only the service does. The flow on every connect:

1. **`voiceClient.js`** asks the game's own relay identity-token minter for a signed token (who the player already
   is to the game - no separate voice login).
2. It POSTs that token to **`server-voice/`**'s `/v1/voice/token`, naming the room (or party) it wants to join.
3. The service verifies the token's signature (`roomAuthorizer.js`), derives a safe SFU room name from the game's
   own room key (`voiceWire.js voiceRoomName` - a client can never choose the raw room name), and mints a
   short-lived LiveKit JWT (`livekitToken.js`, HS256, signed with the shared secret). It also tells LiveKit's
   admin API to create that room if it doesn't exist yet (`ensureRoom` - `auto_create: false` in `livekit.yaml`
   would otherwise refuse the very first player into a room).
4. The service answers with `{ url, token }` - the public `wss://` address and the JWT.
5. **`voiceTransport.js`** (the one file that imports the `livekit-client` SDK, loaded lazily on first use) opens
   a WebSocket to that `url` with that `token`, which LiveKit verifies against the shared secret from step 3.
   From here it's real WebRTC: the browser's own audio stack does the encoding and the peer connection: LiveKit's
   job is just routing streams to the right subscribers.
6. Every 500 ms, the client also tells the service which peers it's near (`/v1/voice/place`); the service's
   `proximityPolicy.js` turns that into actual subscribe/unsubscribe calls so a player far away is never sent
   audio they shouldn't hear, not just muted client-side.

No JS code anywhere holds the LiveKit server's secret except `server-voice/`, and no JS except `voiceTransport.js`
knows LiveKit's SDK shape - swapping media servers later only touches that one file plus `livekitToken.js`.
