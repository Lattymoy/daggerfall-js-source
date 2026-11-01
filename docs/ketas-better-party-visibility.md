# Keta's Better Party Visibility

Optional native client feature; master switch defaults off. Controls: Settings -> Interface -> HUD, or search "party" with the Mods filter. It uses the existing party roster and reported poses without adding network messages or changing combat/stealth rules.

- Current character poses receive fading outlines within 60 metres by default (20/40/60/80 m tiers). Through-wall visibility and near opacity have separate controls.
- Filled vertical diamonds carry plate-free names above, compact distances below, and small up/down arrows outside a three-metre elevation band. Approximate distances retain a tilde and place/region names. They never become exact destinations.
- Offscreen teammates use directional arrows with player icons and slot numbers. Eight slot colors include self and offline members; leadership changes do not reshuffle them.
- Optional HP values and a companion divider augment the existing party rows. Disabling the master switch removes the decorations.
- A dotted leader trail reuses terrain/navmesh routing and refuses blocked or unknown routes. Known entrances may be marked independently in the world and town map. A pose alone does not reveal an unknown door or a route through another instance.

## Rendering

Flat-sprite replay records the actual camera-facing basis per requested batch and refuses mismatched cameras. Lantern draws cannot supply a character's basis. Rig replay selects an existing body without another shadow cast. One reusable color/depth framebuffer uses bounded clears and sampling/compositing. Shader compilation is polled before the first draw. World coverage, disable, context loss and scene replacement hide or release presentation. DOM writes are cached and party-panel decoration polls at most four times per second.

The framebuffer remains screen-sized (roughly eight bytes per pixel for its attachments). Character replay and outline sampling still cost GPU time, especially at high resolutions. This is not a claim of zero overhead or a confirmed live-combat FPS fix.

## Validation

55 Node tests cover membership, idle poses, distance/viewport bounds, entrance identity/rebases, safe leader routes, ping behavior, slot colors, arrows, billboard basis, feature registry and settings placement. Changed JavaScript passes ESLint; the full world module bundles in memory.

`node tools/betterPartyVisibilityProbe.mjs` uses headless Playwright Chromium (or `PLAYWRIGHT_CHANNEL=msedge`) with synthetic WebGL sprites and DOM panels. It verifies alignment, raised/offset views, bounded clears, stale-mask rejection, arrows, edge icons, slot colors, HP, companions and disable cleanup. No live game, account data or personal browser profile is used.

Live multiplayer, real dungeon routing and hardware FPS acceptance remain to be tested before leaving draft status. This contribution contains neither the patch kit, API proposal, campfire feature nor custom combat mods.
