# VOICE2 integration notes

VOICE2 built the seams (`src/net/voiceNet.js`, `src/ui/voiceHud.js`, `src/ui/voiceSettings.js`) but did not mount
them into `scenes/world.js` or `src/ui/enhancedHud.js` - that's the remaining work. This doc is the pitfalls found
while building the seams, so wiring them in doesn't silently reopen them.

## `VoiceState.onChange` is ONE slot, not an event list

`src/voice/voiceState.js` holds exactly one `onChange` callback (`this.onChange = null`), fired on every state
change. It is **not** an `EventTarget` - there is no `addEventListener`, no list, no way to have two independent
listeners both fire. Setting `state.onChange = fn` **replaces** whatever was there before.

`voiceSettings.js` already has to work around this - see its `voiceSettingsRows()`:

```js
const priorOnChange = state.onChange;
state.onChange = (kind) => {
  priorOnChange?.(kind);
  // ...this row's own update...
};
```

**If you wire anything else into `onChange`** (the HUD, a debug overlay, the eventual peer-mute list), chain it
the same way - save the existing value, call it first, then do your own work. Don't just assign over it, or
whichever assignment runs last silently kills everyone before it.

This chain has no "unsubscribe": it's a fixed linear chain built once when each piece mounts, not a dynamic
listener list. That's fine for singletons that live for the whole session (the HUD indicator, the settings panel),
but don't reach for `onChange` for anything that mounts and unmounts repeatedly (e.g. a window that opens and
closes) without also restoring the previous value on teardown - otherwise closed UI keeps eating CPU on every
voice state change, or worse, you leak the chain across a destroy/recreate cycle and end up with two copies of
the same handler.

If you need more than two or three consumers of voice state changes, it's worth promoting `onChange` to a real
listener set (`Set<fn>` + `addListener`/`removeListener`) in `voiceState.js` rather than extending the chain
pattern further - this was left as a single slot because VOICE1/VOICE2 only ever needed one or two callers at a
time, not because a list would be wrong.

## `voiceHud.js`'s `update()` is pull, not push

Unlike `onChange`, the HUD indicator does **not** subscribe to anything - `update(state)` is a plain function you
must call yourself, every frame, with the live `voiceNet.state`. There's no internal timer and no listener. If
you forget to call `update()` in the HUD's own per-frame pass, the indicator will silently freeze on whatever
status it last saw (most likely `off`, since that's its construction-time default) instead of erroring.

## `voiceNet.js` is a true singleton - `initVoiceNet()` twice is a silent no-op

```js
export function initVoiceNet(o) {
  if (voiceNet) return voiceNet;   // <- already-initialized options are IGNORED
  ...
}
```

Calling `initVoiceNet()` a second time with different `mintToken`/`audioContext`/`destination` does **not**
re-configure the existing client - it just hands back the first one, untouched. This matters if the game ever
tears down and rebuilds its audio context (e.g. on a device change) without first calling `destroyVoiceNet()`:
the voice client would keep using the stale, possibly-dead audio context. Call `destroyVoiceNet()` before any
`initVoiceNet()` that should actually take effect with new options.

## `frameVoiceNet()` swallows every error by design - don't let that hide a wiring bug

```js
export function frameVoiceNet(o) {
  if (!voiceNet) return;
  try { ... } catch (e) { console.error('[voice] frame error:', e.message); }
}
```

This is intentional (VOICE1's own law: a voice bug must never stop the game loop), but it means a wiring mistake
- wrong shape for `peers`, a `position` that isn't a 3-tuple, `room`/`party` the wrong type - will show up ONLY
as a repeating console error, never a thrown exception you'd notice in a debugger. Worth a quick manual check of
the browser console the first time this is wired in, rather than assuming silence means success.

## Settings rows own their own DOM and listeners - no cleanup method yet

`voiceSettingsRows()` builds plain `HTMLElement`s with `addEventListener` calls baked in and no corresponding
`removeEventListener` / teardown function. If the enhanced menu's Voice category is torn down and rebuilt
repeatedly (e.g. every time the pane re-renders, which `enhancedMenu.js`'s `paneSettings()` does on most state
changes - see its own `render()` calls), calling `voiceSettingsRows()` again each time will keep handing back a
*new* set of rows and listeners rather than reusing the old one, which should be fine as long as the old DOM
nodes are actually discarded by whatever replaces `.list`'s children - but it's worth confirming the mount point
replaces children wholesale rather than appending, or you'll accumulate duplicate rows and orphaned listeners
across settings panel re-renders.
