# Local client mod API (proposal, version 1)

This native extension point replaces compiled-bundle patches for the capabilities it implements. It is a new JS design, not a DFU port. It does not load DFU assemblies. The first scope is deliberately small: lifecycle, read-only HUD health, and an enhanced health-label formatter. Party, quest, resource, inventory, renderer, settings and server hooks are not part of version 1.

## Opt in and disable

Desktop packaged builds look for `ClientMods/enabled.json` inside Electron's existing user-data directory. On a default Windows install this is `%APPDATA%/Daggerfall JavaScript/ClientMods/enabled.json`. A `DAGGER_USER_DATA` override uses that profile instead. This loader never reads the profile's login, saves or preferences.

Copy `examples/client-mods/enabled.json` and the `health-numbers` directory into `ClientMods`, then restart the game. The example replaces the enhanced health bar's percentage with current/maximum health, in the native label. It creates no floating panel. Remove the manifest, set `enabled` to `false`, or remove an entry and restart to disable it. An empty or missing directory enables nothing. There is no automatic discovery, download, update or installation. The web game and HTTP desktop dev server do not serve this directory.

**Only enable local JavaScript you trust.** Modules execute in the game renderer and are not sandboxed from it. Capabilities describe API compatibility; they do not restrict JavaScript privileges, network access or the existing shell bridge. This is not an anti-cheat boundary. A hostile or nonterminating module can still disrupt the game. Server rules remain server rules. Do not use this API as permission to change shared gameplay.

The native protocol serves only declared mod directories and a sanitized index. It rejects unsupported file types, traversal and real-path escapes. Limits are 32 mods, a 64 KiB index and 1 MiB per asset. Supported assets are `.js`, `.mjs`, `.json`, and `.css`. Entry modules use relative imports for companion files. Mod IDs contain lowercase letters, digits and hyphens, at most 64 characters. No absolute paths or remote entrypoints are accepted. Invalid indexes disable the loader; missing assets do not stop normal game startup.

## Contract

Each descriptor has `id`, `entry`, `apiVersion: 1`, and `requires`, an array of capability strings. The renderer rejects unknown API versions or capabilities before it imports that entrypoint. Modules export a synchronous default initializer `initialize(api)`. It may return a cleanup function. The host releases API subscriptions and label ownership after an initializer fails or when the page closes, even if the mod omitted cleanup. Mods must release their own DOM, timers and other resources in their cleanup function. Disabling a manifest entry takes effect on restart, not during a session.

The frozen context supplies:

| Capability | Methods | Contract |
| --- | --- | --- |
| `player.health.read` | `api.player.health()` | Frozen `{ current, maximum }`, or `null` when no HUD health is available. No mutable entity is exposed. |
| `player.health.read` | `api.player.onHealthChange(fn)` | Sends the current snapshot immediately and subsequent changes. Returns an idempotent unsubscribe function. |
| `hud.health-label` | `api.hud.formatHealth(fn)` | Owns the enhanced health bar label. A pure function receives `{ current, maximum }` and returns plain text, 1–64 characters. Returns an idempotent release function. |

`api.apiVersion` is `1`. Methods reject calls without their declared capability or after disposal. Only one mod can own the health label. Manifest order determines that owner; a later conflicting initializer fails and is cleaned up. A throwing subscriber is removed. An invalid or throwing formatter is removed and the normal percentage returns. Callback errors are isolated, with a bounded 16-record diagnostic history on the internal host's `status()` method. This is not a general crash recovery mechanism for arbitrary module code.

Health follows `hudHealth`, including the native duel vitality override. It describes the displayed bar, not a promise of authoritative combat state. Covered/hidden HUDs publish `null`; the next visible HUD draw restores the snapshot. Fractional health is preserved for API consumers. The example rounds upward for readable numbers. Classic HUD health is available to subscribers, but the formatter changes only the enhanced label.

## Performance and host coverage

There is no extra animation loop, polling interval or renderer pass. Health publication uses the existing shared `drawHud` call. No snapshot is allocated when there are no active mods or the values have not changed. Formatter results are cached until health, maximum or fallback text changes. Mods must keep callbacks short; this boundary cannot stop a slow callback from using frame time.

The four hosts use the shared HUD seam: `scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js` (interiors), and `scenes/dungeonContext.js`. `hideHudTextSurfaces` clears the snapshot at the shared hide boundary. No per-host entity bridge is added. This works in all provinces because it has no location or province assumptions. Menu health is not synthesized. The loader imports asynchronously off the static boot graph, and does not delay the main menu.

## Review and verification

`test/systems/clientMods.test.js` covers versions/capabilities, immutable snapshots, unchanged frames, formatter ownership/caching/fallback, disposal and asynchronous load cancellation. `test/app/clientMods.test.js` exercises the native file route, explicit enablement, limits, invalid manifests, path and symlink escapes, and the example module through the loader. `test/ui/clientModsHud.test.js` drives the native HUD hide/duel paths and verifies reuse and restoration of its actual health label. A live gameplay check remains necessary before release; tests do not measure GPU performance or multiplayer behavior.

Future extensions should add explicit capabilities, immutable snapshots and native UI hooks, with their own lifecycle/performance tests. Existing external patch kits still need their reviewed adapters for features outside this API. Acceptance of this proposal does not make those patches automatically compatible with future releases.
