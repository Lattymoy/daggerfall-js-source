# Keta's Death Markers

Optional native settings under World > Death markers. The main switch defaults off. The current character keeps five death locations by default, adjustable from one to ten. Individual removal and confirmed clear-all are available in the same settings section. Local history is bounded to sixteen character entries.

In the world, small opaque skulls remain visible while a short caption appears after looking near one. Deaths sharing a dungeon entrance share one world marker. Depth-tested procedural beams follow the camp-style distance, height and opacity rules, with asynchronous shader preparation and cleanup on disable or disposal. No combat or detection behavior changes.

On the Overworld, skull icons have static fading map beams above and short captions plus measured distance below. The existing map canvas is reused and does not redraw while its marker state is unchanged. Marker metadata survives camera projection. Native traveller skulls and settlement filters retain their original behavior. Unknown dungeon entrances are not guessed.

This native proposal covers world and Overworld markers; the local mod kit's other map-skin integrations are separate work. The shared Canvas2D beacon helper is identical to the campfire PR's helper. No camp tracking, party/combat changes, patch kit, API proposal, account artifacts or external telemetry are included.

Validation: 41 targeted history, projection, feature-registry and native-menu tests; ESLint; an in-memory world bundle; 14 isolated headless DOM/WebGL checks. The shared Overworld renderer also passed six headless checks including stationary caching, beam-switch invalidation and marker removal. On Windows the existing menu regression's Git grep command requires host access and Git's usr/bin in PATH. No live client or gameplay FPS claim.
