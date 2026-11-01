# Server Update Notice

When we push an update, an online player is told in chat. There are two kinds of update. The relay (`server/`, the
Cloudflare Worker) restarts when its version changes, which drops every socket at once. The build (the client on
GitHub Pages) changes on every merge to main, and a tab left open keeps running replaced code until a deleted chunk
breaks it. The player meets a system line in every chat tab, and with **Automatic updates** on, a one-minute warning
and then a reload screen.

## How it works

### The relay

`.github/workflows/relay-deploy.yml` runs on every push to main: it reads `RELAY_VERSION` from `src/net/wire.js`, asks
the live `/health`, and deploys only when they differ. The relay puts its version (`v`) on both welcomes, the place
room's and the chat channel's, so every socket hears it.

`relayVersionSeen` (`src/net/updateNotice.js`) remembers the versions heard in a set (`RELAY_SEEN_MAX`). The first
version a page hears is a baseline; only a later, different one is news. A set means several sockets re-welcomed by
one deploy, or an edge still serving the old Worker, never notify twice. The line is `relayRestartText`.

### The build

`BUILD_TAG` is stamped into the bundle and into every built page's `<meta name="build-tag">`. While online, the client
polls the live page every `BUILD_POLL_MS` (`fetchLiveBuildTag`, `buildTagOf`) and compares it directly
(`buildUpdateSeen`). `tools/verify-deploy.mjs` reads the tag with the same `buildTagOf`.

- **Automatic updates off** (the default; `uiPrefs` `autoUpdates`): a new build is said once in chat and nothing
  reloads.
- **Automatic updates on**: `src/ui/updateScreen.js` gives a chat line and a banner for `UPDATE_WARN_MS`, then a screen
  that cannot be closed covers the game, the character is checkpointed, and the page reloads after `UPDATE_SCREEN_MS`.
  A death screen or a duel holds it for at most `UPDATE_HOLD_MAX_MS`.

The desktop app plays its own copy and updates through its launcher or File > Restart to Update. A lazy chunk deleted
by a deploy still reloads the page (`src/systems/staleChunk.js`).

### A notice is a line nobody sent

A notice is pushed with `system: true` and drawn with no name and no tag. The flag never travels on the wire: the
session builds each chat line field by field, so a relay or a player cannot forge a notice. A name like "Server" could
be forged; a flag cannot. The notice goes to every chat tab.

### The chat's receiving gate

A client also gates the chat lines it receives, at the rate an honest relay spends on one room (`CHAT_ROOM_HZ_MAX`), so
a hostile relay cannot flood away the chat history (`CHAT_KEEP` lines).

## Rules

- A server restart notice in chat whenever we push server updates (Mac).
- Automatic updates are off by default; players are not forced out of the game (the owner).
- A version first heard is a baseline, never news.
- Pins about the relay's version ask `relayVersionAtLeast(n)` (`test/relayVersion.mjs`), never an exact version, so a
  later bump does not break them.

## Code and tests

- `src/net/updateNotice.js` - both detectors and the notice text
- `src/ui/updateScreen.js` - the warning and the reload screen
- `src/systems/staleChunk.js` - reload on a deleted chunk
- `.github/workflows/relay-deploy.yml` - the relay's deploy on a version change
- `test/net/srvn_updatenotice.test.js` - the detectors, the system line, the receiving gate
- `test/ui/updatescreen.test.js` - the update screen and the switch
- `test/relayVersion.mjs` - the monotonic version check
