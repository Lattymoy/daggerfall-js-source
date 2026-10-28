# Video Surfaces - synchronized screens on home paintings (VIDEO1, 2026-10-28)

**Status: VIDEO1 built.** Owner decisions locked before code: YouTube is an
official DOM panel (not a WebGL texture); only allowlisted HTTPS MP4/WebM
render as in-world textures; first version is existing Paintings items in
interiors only; configured paintings hang as wall canvases with no new 3D frame.

## 1. Why the original brief cannot be literal

A YouTube iframe is a separate DOM surface. The browser will not hand its
pixels to WebGL, and YouTube's required minimum functionality forbids
obscuring the player with game geometry. So "YouTube on an in-world WebGL
surface" is both technically and policy-blocked. Direct video that the client
fetches itself can upload frames to a texture and participate in the depth
pass. The game server never proxies, downloads, decodes or redistributes
streams.

## 2. Decisions

| Topic | Decision |
|---|---|
| YouTube | Official IFrame Player API in a DOM panel after interaction; synchronized state shared; panel keeps required controls and minimum size |
| Direct video | HTML5 video → one owned GL texture → mount quad; audio through Web Audio when CORS allows |
| Object | Existing Paintings template (284) in interiors; unconfigured paintings stay billboards |
| Configured look | Wall-mounted rectangular canvas (`decorMountFrame`); no new models or textures |
| Authority | Account service owns state + CAS revision; relay fans a signed order; clients fetch media from the provider |
| Scope | `worldModes.js` wires the host; `world.js`, `exterior.js`, `dungeonContext.js` are FLAGGED (no home decor video) |
| Future providers | Adapter + one registry line; core surface, sync and permissions stay closed |
| Copy / delete | Copy starts unconfigured; remove/transfer deletes video rows with the piece |
| Local mute | Client-only; never shared |

## 3. State

One row per configured surface, keyed by home + piece id:

```text
mapId, buildingKey, pieceId
provider, sourceId          # canonical, server-validated
status                      # idle | playing | paused | stopped
basePositionSeconds
serverStartedAt             # epoch ms when status became playing
updatedAt, revision
```

Projected position while playing:
`basePositionSeconds + (nowMs - serverStartedAt) / 1000`.
Live / non-seekable providers report `seek: false` and ignore seek commands.
Drift: soft rate nudge under 0.35 s; hard seek at or above 1.0 s; never
per-frame network sync.

## 4. Transport

1. Client POSTs a command to `/v1/homes/video` (list) or `/v1/homes/video/cmd`.
2. Service validates owner/access, piece is a Painting, source allowlist, rate
   and expected revision; writes the row; returns state + signed video order.
3. Client carries `{t:'video', order}` to the social hub.
4. Hub verifies and fans `{t:'video', l:[[mapId, buildingKey, pieceId, revision], ...]}`.
5. Peers apply only a greater revision; late join / reconnect loads the snapshot.
6. Rare poll is the safety net when push is broken.

## 5. Providers

| Provider | Presentation | Sync |
|---|---|---|
| `youtube` | DOM panel | IFrame API seek/play/pause where permitted |
| `direct` | World texture | HTML5 currentTime + drift law |

URL rules (server and client share `videoSurfaceLaw.js`):

- YouTube: `youtube.com/watch`, `youtu.be`, `youtube.com/shorts`, supported live URLs; ID `[A-Za-z0-9_-]{11}`.
- Direct: `https:` only, host on `VIDEO_DIRECT_HOSTS`, no credentials, no fragment, path ends in `.mp4` or `.webm`.
- Reject arbitrary HTML, scripts, `javascript:`, data URLs and unknown hosts.

## 6. Lifecycle and performance

- Activate inside `VIDEO_ACTIVATE_M` when the surface is in the active interior
  and roughly visible; deactivate past `VIDEO_DEACTIVATE_M` (hysteresis).
- Cap simultaneous players at `VIDEO_ACTIVE_MAX` (nearest first).
- Destroy player, texture, iframe, listeners and audio nodes on leave, scene
  change, source change and piece removal.
- Dozens of configured-but-inactive surfaces own no decoder.

## 7. Desktop gate

YouTube needs a usable HTTP Referer. Production HTTPS is the primary path.
Desktop `dagger://` is probed separately; embed error 153 or a blocked
Referer falls back to opening the official YouTube URL outside the game.
Never bypass embedding restrictions.

## 8. Threat model

- Client timestamps, permissions and revisions are never trusted.
- Source changes and commands are rate-limited (`VIDEO_OPS_MAX` / hour).
- Malicious or unavailable URLs fail closed with a player-facing error.
- Stored state holds no HTML and no player instances.

## 9. Pins

- `test/net/videoSurfaceLaw.test.js` - URL, state, drift, revision
- `test/systems/video/` - adapters and cleanup
- `test/scenes/decor/videoSurfaceHost.test.js` - mount follow and teardown
- `test/server/videoSurface.test.js` - authority, rates, cleanup
- `test/net/videoSurfaceRelay.test.js` - order and fanout
- Browser probe (tool): two contexts, direct video drift within 1.0 s

## 10. Versions

Account `acct209`, relay `world278`, migration `0191_video_surface`. Deploy
account and relay before the site.
