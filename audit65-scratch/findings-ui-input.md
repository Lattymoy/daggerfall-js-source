I have enough verified material. Here are the findings.

```json
[
  {
    "id": "UI-1",
    "lens": "ui-input",
    "title": "OT1's spellbook double-click reads the host's RIGHT-BUTTON boolean as its clock, so every second click in the spell list casts/buys — with no time bound at all",
    "severity": "high",
    "files": [
      "/home/user/daggerfall-js-source/src/ui/spellbookWindow.js",
      "/home/user/daggerfall-js-source/src/scenes/townTalk.js",
      "/home/user/daggerfall-js-source/src/scenes/worldModes.js",
      "/home/user/daggerfall-js-source/src/scenes/dungeonContext.js",
      "/home/user/daggerfall-js-source/src/ui/listPicker.js",
      "/home/user/daggerfall-js-source/src/ui/nativeTalk.js",
      "/home/user/daggerfall-js-source/test/spellbookwindow.test.js"
    ],
    "claim": "OT1 gave SpellbookWindow the ListBox MouseClick/MouseDoubleClick gesture and widened its signature to `click(vx, vy, now)`. But every host that owns an overlay slot dispatches `click(vx, vy, right, middle)` — the third positional is `e.button === 2`, a BOOLEAN. So `now` is `false` on every real click, `t = false ?? Date.now()` keeps the `false`, `this._lastRowClick` is set to `false` (which is `!= null`), and the second click computes `false - false === 0 < 300` — a double-click. The result is the exact behaviour OT1 was written to remove, made worse: a click, then ANY later click anywhere in the list (a different row, ten seconds later) fires `useSelected()` / `buyButton()`. The nested path proves the diagnosis: `charsheet.js` forwards `this.child.click?.(vx, vy)` with no third argument, so `now` is `undefined`, `??` falls through to `Date.now()`, and the spellbook opened FROM the character sheet times correctly while the same window opened from CastSpell/the dial/the pause rail does not. The identical positional mismatch is already live in two siblings this arm cites as its precedent — `listPicker.click(vx, vy, font, now)` takes `middle` in the `now` slot (and its own header records that the `font` slot was bitten by this same shape once already, ROAD-U/AUDIT 58), and `nativeTalk.click(vx, vy, rightButton, now)` likewise — so a rebuilt spell-bundle picker or a talk topic list picks on the second click too. The pin passes because it hand-calls `w.click(x, y, 1000)` with a number: the test does not mint the shape the producer mints (Home.md's own law).",
    "evidence": {
      "port": [
        "/home/user/daggerfall-js-source/src/ui/spellbookWindow.js:777 — `click(vx, vy, now) {`",
        "/home/user/daggerfall-js-source/src/ui/spellbookWindow.js:862-868 — `const t = now ?? Date.now(); const wasDouble = this._lastRowClick != null && (t - this._lastRowClick) < DOUBLE_CLICK_DELAY_MS;`",
        "/home/user/daggerfall-js-source/src/scenes/townTalk.js:1123 — `overlay.click?.(v[0], v[1], e.button === 2, e.button === 1)`",
        "/home/user/daggerfall-js-source/src/scenes/worldModes.js:7090 — same four-argument call into `interiorOverlay`",
        "/home/user/daggerfall-js-source/src/scenes/dungeonContext.js:4867 — `activeOverlay.click(vx, vy, right, middle)`",
        "/home/user/daggerfall-js-source/src/scenes/world.js:2951-2956 — `toggleSpellbook` puts the window in townTalk's slot, i.e. behind the four-arg caller",
        "/home/user/daggerfall-js-source/src/ui/charsheet.js:419 — `this.child.click?.(vx, vy)` (the nested spellbook that still works)",
        "/home/user/daggerfall-js-source/src/ui/listPicker.js:311 and :360-364 — same shape, `now` fed `middle`",
        "/home/user/daggerfall-js-source/src/ui/nativeTalk.js:774 and :851-855 — same shape",
        "/home/user/daggerfall-js-source/test/spellbookwindow.test.js:822 — `w.click(PX + lx + 4, rowY(2), 1000 + DOUBLE_CLICK_DELAY_MS - 1)` (a number where the game passes a boolean)"
      ],
      "dfu": [
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/BaseScreenComponent.cs:54 — `float doubleClickDelay = 0.3f;`",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/BaseScreenComponent.cs:681-692 — `MouseClick(...)` fires first, then `lastLeftClickTime = leftClickTime; leftClickTime = Time.realtimeSinceStartup; if (leftClickTime - lastLeftClickTime < doubleClickDelay) MouseDoubleClick(...)` — the test is on the REAL clock and nothing else"
      ],
      "law": "BaseScreenComponent's double-click is `now - lastClickTime < 0.3s` against realtimeSinceStartup. A clock argument that is never a clock makes the predicate a constant."
    },
    "proposedFix": "Give SpellbookWindow the host's argument order — `click(vx, vy, right = false, middle = false, now = null)` — or, better, stop threading a clock positionally at all: read the clock from an injectable `this._now()` seam the way listPicker already declares one (`listPicker.js:185`), and let tests override the seam rather than occupy a positional slot that the hosts already own. Apply the same correction to `listPicker.click` and `nativeTalk.click` in the same lane (one shape, three files). While there, note the second divergence the arm carries: DFU does NOT clear its stamp on a double (`:689-692` stores `lastLeftClickTime = leftClickTime` unconditionally), so three fast clicks in DFU are click/double/double while the port's `this._lastRowClick = null` makes them click/double/click.",
    "pinShape": "Drive the window through the HOST's call shape, not the window's: `w.click(x, rowY(2), false, false)` twice with a real clock advanced past DOUBLE_CLICK_DELAY_MS between them, and assert `readied.length === 0`. Red today; red under the one-character mutation `now ?? Date.now()` -> `now || Date.now()` only if the fix is the signature (so also assert the signature's argument order directly). Add the mirror pin for listPicker and nativeTalk through townTalk's own four-arg dispatch."
  },
  {
    "id": "UI-2",
    "lens": "ui-input",
    "title": "MAC1 J's in-gesture relock reaches two of the four hosts and one of the two skins — the dungeon's pause door and the classic pause window still cost the player a click",
    "severity": "high",
    "files": [
      "/home/user/daggerfall-js-source/src/ui/pauseDoor.js",
      "/home/user/daggerfall-js-source/src/scenes/dungeonContext.js",
      "/home/user/daggerfall-js-source/src/scenes/exterior.js",
      "/home/user/daggerfall-js-source/src/scenes/dungeon.js",
      "/home/user/daggerfall-js-source/src/ui/pauseWindow.js",
      "/home/user/daggerfall-js-source/test/mac1_playreport.test.js"
    ],
    "claim": "MAC1 J's mechanism is exact: the pause close runs inside the Resume click / Escape keydown, which is the transient activation `requestPointerLock` needs, while the hosts' look gate relocks on the NEXT frame outside any gesture — so the first click after a resume is spent re-grabbing the pointer and takes `SetClickDelay` with it. The fix was wired as `hooks.relock` and only ONE consumer reads it (`pauseDoor.js:165`), which means it lands only where the hook is handed in. Grepping every `openPauseFlow` call site: `world.js:4816` (exterior arm) and `world.js:6721` (the host bag `worldModes.js:6824` passes through) have it; `dungeonContext.js:4339-4395` and `exterior.js:2168-2192` do NOT. The dungeon is the host where a player opens the most windows, and it is untouched. The second half is the skin fork: `hooks.relock` is read only inside `enhancedPauseOverlay`; `openClassicPauseFlow` never reads it (grep for `relock` in `src/ui/` returns pauseDoor.js alone), so a player on the classic skin gets none of MAC1 J in any host. The pin itself encodes the miss — `mac1_playreport.test.js:252-254` asserts exactly the three sites that were wired and names no fourth, so the FOUR HOSTS RULE's 'each either wired or FLAGGED by name' is unmet.",
    "evidence": {
      "port": [
        "/home/user/daggerfall-js-source/src/ui/pauseDoor.js:165 — `if (action !== 'exit') hooks.relock?.();` (the only reader in the tree)",
        "/home/user/daggerfall-js-source/src/scenes/world.js:4816 — `relock: () => requestLook(canvas)`",
        "/home/user/daggerfall-js-source/src/scenes/world.js:6721 — the host bag's copy for the interior arm",
        "/home/user/daggerfall-js-source/src/scenes/worldModes.js:6824 — `relock: host.relock`",
        "/home/user/daggerfall-js-source/src/scenes/dungeonContext.js:4337-4395 — `togglePause` -> `openPauseFlow`, hooks literal carries quickSave/quickLoad/saveAs/loadKey/pushWindow and NO relock",
        "/home/user/daggerfall-js-source/src/scenes/exterior.js:2167-2192 — same, no relock",
        "/home/user/daggerfall-js-source/src/ui/pauseWindow.js:389 — `openClassicPauseFlow(show, hooks)` never reads `hooks.relock`",
        "/home/user/daggerfall-js-source/src/scenes/world.js:5068 — `if (e.pointerType !== 'touch' && document.pointerLockElement !== canvas) setClickDelay(...)` — the arm the re-acquisition click still trips in the unwired hosts",
        "/home/user/daggerfall-js-source/test/mac1_playreport.test.js:249-254 — the pin names pauseDoor + world.js x2 + worldModes and stops"
      ],
      "dfu": [
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/UserInterfaceManager.cs:190-216 — `RemoveWindow()` calls `PauseGame(false); PlayerActivate.SetClickDelay();` on EVERY pop back to the HUD, in one scene-free place",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/PlayerActivate.cs:1050-1054 — `SetClickDelay(float delay = 0.3f)`",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/PlayerActivate.cs:268-277 — the delay's consumer, which returns BEFORE ActionComplete is read"
      ],
      "law": "DFU has ONE window-close seam (RemoveWindow) and it is scene- and skin-free: closing the pause window unpauses and arms the 0.3s click delay identically underground, above ground and in a building. A port fix hung on a per-host hook must therefore be handed in by all four hosts, or DFU's one-place law has become four places with two answers."
    },
    "proposedFix": "Hand `relock` in from the two hosts that mount a dungeon context — `dungeon.js` and `worldModes.js` both own the canvas, so pass `relock: () => requestLook(canvas)` into `buildDungeonContext` and have `dungeonContext.togglePause`'s hooks forward it, exactly as `world.js:6721` -> `worldModes.js:6824` already does for the interior arm. Add the same one line to `exterior.js:2168`'s hooks (or FLAG it by name in the record as the probe host). Then make the fix skin-blind: `openClassicPauseFlow`'s close paths (`pauseWindow.js`'s `_closeWith`) run inside the same click/keydown gesture, so they should call `hooks.relock?.()` at the same point in the same order (close first, then relock, then the hook) rather than leaving the classic skin on the frame-late gate.",
    "pinShape": "A source pin that enumerates ALL FOUR hosts' `openPauseFlow` hook literals and asserts each contains a `relock:` key (red today on dungeonContext and exterior), plus a behavioural pin on `pauseDoor`: drive `openPauseFlow` under `isEnhanced() === false` with a recording `relock` hook and assert it fired on 'resume'/'save'/'load' and not on 'exit'. Both fail under deleting a single `relock:` line."
  },
  {
    "id": "UI-3",
    "lens": "ui-input",
    "title": "FIX-F's enhanced rebinding pane has no waitingForInput guard, so every other control stays live while a capture is armed — the classic grid has the guard and DFU has it on all seven handlers",
    "severity": "medium",
    "files": [
      "/home/user/daggerfall-js-source/src/ui/enhancedControls.js",
      "/home/user/daggerfall-js-source/src/ui/controlsWindow.js",
      "/home/user/daggerfall-js-source/test/enhancedControls.test.js"
    ],
    "claim": "enhancedControls.js opens with 'SO THIS IS A SECOND FACE, NOT A SECOND LAW ... If the classic grid and this pane ever disagree it is because one of them stopped calling these functions'. They disagree on a law that lives in neither shared module: DaggerfallControlsWindow guards EVERY button handler with `if (waitingForInput) return;` — Joystick (:281), Mouse/Advanced (:290), Defaults (:299), Continue (:321), CurrentBindings/dict-switch (:338), the keybind button itself (:361-362) and the right-click remove (:372, which ANDs it with the unbound-slot refusal). The port's classic grid carries it in one line (`controlsWindow.js:298 — if (this.capture) return true;`). The enhanced pane carries none of it: `key.onclick = () => arm(action)` re-arms a different row mid-capture (DFU refuses), `clear.onclick = () => promptRemove(action)` ports only the unbound half of :372, and `which/defaults/cont` are all live. The consequence is not cosmetic — the document capture listener stays armed across those clicks, so clicking CONTINUE while 'PRESS A KEY' is showing applies and saves the staged dicts AND leaves a live capture that silently rebinds the armed action into the freshly re-staged copy on the player's next keystroke anywhere; clicking the Primary/Secondary toggle flips `unsaved.usingPrimary` so the pending capture lands in the OTHER dict than the row the player clicked. That is the 'capture-armed state leaking' shape, reached by ordinary clicks rather than by teardown.",
    "evidence": {
      "port": [
        "/home/user/daggerfall-js-source/src/ui/enhancedControls.js:270-271 — `key.onclick = () => arm(action); key.oncontextmenu = ... promptRemove(action)` (no armed guard)",
        "/home/user/daggerfall-js-source/src/ui/enhancedControls.js:277 — `clear.onclick = () => promptRemove(action)`",
        "/home/user/daggerfall-js-source/src/ui/enhancedControls.js:202-206 — `promptRemove` ports :292's unbound refusal only",
        "/home/user/daggerfall-js-source/src/ui/enhancedControls.js:332-336 — `which.onclick = switchDict; defaults.onclick = ...; cont.onclick = applyAndSave;`",
        "/home/user/daggerfall-js-source/src/ui/enhancedControls.js:226-238 — `applyAndSave` re-stages `unsaved` while `armed`/`armedHandler` are untouched",
        "/home/user/daggerfall-js-source/src/ui/enhancedControls.js:143 — `captureArmed()` exists and only the shell's Escape handler consults it",
        "/home/user/daggerfall-js-source/src/ui/controlsWindow.js:298 — `if (this.capture) return true;   // every tab ignores clicks mid-capture (:283 etc.)`"
      ],
      "dfu": [
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterfaceWindows/DaggerfallControlsWindow.cs:281 / :290 / :299 / :321 / :338 — `if (waitingForInput) return;` heads each tab/action handler",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterfaceWindows/DaggerfallControlsWindow.cs:359-362 — `KeybindButton_OnMouseClick` refuses a second arm while waiting",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterfaceWindows/DaggerfallControlsWindow.cs:370-373 — `if (waitingForInput || ((Button)sender).Label.Text == KeyCode.None.ToString()) return;`",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterfaceWindows/DaggerfallControlsWindow.cs:52, :267-272 — `waitingForInput` and the coroutine's `SetWaitingForInput` writer"
      ],
      "law": "While the window is waiting for a key, DaggerfallControlsWindow's controls are inert — the pending capture is the only live gesture on the screen."
    },
    "proposedFix": "Add one predicate at the top of the pane's click surfaces, the way the classic grid does: in `enhancedControls.js` make every `onclick`/`oncontextmenu` return early when `armed != null` — `key.onclick`, `key.oncontextmenu`, `clear.onclick`, `which.onclick`, `defaults.onclick`, `cont.onclick`, and the prompt card's Yes/No. Prefer a single wrapper (`const act = (fn) => (...a) => { if (armed) return; fn(...a); }`) so a future control cannot be added without it, and cite :281/:290/:299/:321/:338/:361/:372 beside it. `arm()`'s own `disarm()` then becomes unreachable-by-click, which is DFU's shape.",
    "pinShape": "Drive the pane headless: arm a row (`captureArmed() === 'MoveForwards'`), then click Continue / the Primary toggle / Defaults / a second row's key button / its ✕, and assert after each that `captureArmed()` is unchanged, `controlsStaging().usingPrimary` is unchanged and `saveKeyBinds` was not called. Mutation-check by deleting a single `if (armed) return;` — each assertion must go red on its own guard. Mirror the classic grid's existing pin so the two faces are asserted against the same law."
  },
  {
    "id": "UI-4",
    "lens": "ui-input",
    "title": "AUDIT 64 F42 read the large HUD's two-button law and applied it to the SOUND only: a middle (or 4th/5th) button click on the bar still runs the LEFT panel action, which DFU binds to nothing",
    "severity": "medium",
    "files": [
      "/home/user/daggerfall-js-source/src/ui/hudLarge.js",
      "/home/user/daggerfall-js-source/src/scenes/world.js",
      "/home/user/daggerfall-js-source/src/scenes/exterior.js",
      "/home/user/daggerfall-js-source/src/scenes/dungeon.js",
      "/home/user/daggerfall-js-source/src/scenes/worldModes.js"
    ],
    "claim": "F42's own comment states the law it then declines to enforce: 'Only the two DFU binds - OnMouseClick and OnRightMouseClick - make a sound; a middle click reaches no handler at all, and this port's largeHudClick sends every non-right button to the LEFT action, so the sound is asked of the two buttons DFU actually binds.' The sound is gated (`button === 0 || button === 2`) and the ACTION is not: `largeHudClick` computes `action = (button === 2 && panel.right) ? panel.right : panel.action`, so buttons 1, 3 and 4 fall through to the left action and `routeLargeHudClick` runs `routeAction(hit.action, ctx)` for them. A middle-click on the bar therefore opens the pack, opens the spellbook, toggles the sheath, cycles the interaction mode and opens the pause door — silently, because F42 correctly withheld the click sound. In DFU HUDLarge registers only `OnMouseClick` and `OnRightMouseClick` on all eleven panels (HUDLarge.cs:170-232) and BaseScreenComponent dispatches the middle button through `MiddleMouseClick` alone with no fallback to `MouseClick`. This is also a disagreement between two lanes of the same audit: AUDIT 64 F47/F50 applied exactly this law to the inventory window (`if (middle) return this._middleClick(vx, vy);`, and the right-button families gated), so the port now has one door that honours DFU's button binding and one that does not.",
    "evidence": {
      "port": [
        "/home/user/daggerfall-js-source/src/ui/hudLarge.js:314-321 — `largeHudClick(bar, px, py, button = 0)`; `const action = (button === 2 && panel.right) ? panel.right : panel.action;`",
        "/home/user/daggerfall-js-source/src/ui/hudLarge.js:672-692 — `routeLargeHudClick`: the F42 sound gate `if (button === 0 || button === 2)` sits immediately above an ungated `routeAction(hit.action, ctx)`",
        "/home/user/daggerfall-js-source/src/scenes/world.js:5046-5049 and /home/user/daggerfall-js-source/src/scenes/exterior.js:2425-2429 — `routeLargeHudClick(..., e.button, hudCtx, ...)` with the raw DOM button",
        "/home/user/daggerfall-js-source/src/scenes/dungeon.js:323 and /home/user/daggerfall-js-source/src/scenes/worldModes.js:7078-7081 — the same raw-button call in the other two hosts",
        "/home/user/daggerfall-js-source/src/ui/nativeInventory.js:1170-1185 — the sibling lane's correct shape: middle routed to `_middleClick` alone, right narrowed to the four families DFU binds"
      ],
      "dfu": [
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/HUDLarge.cs:170-232 — every panel binds `OnMouseClick` and `OnRightMouseClick`; no `OnMiddleMouseClick` anywhere in the file",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/BaseScreenComponent.cs:679-724 — left -> `MouseClick`, right -> `RightMouseClick`, middle -> `MiddleMouseClick`, three separate blocks with no fallback"
      ],
      "law": "A component acts on a button only if it registered a handler for that button. HUDLarge registers two; the middle button reaches nothing."
    },
    "proposedFix": "Move the button gate into `largeHudClick` where the action is chosen, not into the sound: return `null` for any button other than 0 and 2 (`if (button !== 0 && button !== 2) return null;`), which makes `routeLargeHudClick` answer false and lets the host's pointerdown fall through to its normal relock path — the same posture the inventory's `_middleClick` miss takes. Then the F42 sound gate becomes redundant and can be simplified to an unconditional `playOneShot` on the hit, which is DFU's own order (the sound is the first statement of all thirteen handlers).",
    "pinShape": "`assert.equal(largeHudClick(bar, px, py, 1), null)` for a point inside a known panel (and the same for 3 and 4), plus a `routeLargeHudClick` pin with a recording ctx asserting `toggleInventory` was NOT called for button 1 while it IS called for 0 and 2. Red today; red under the one-character mutation `button !== 0 && button !== 2` -> `button !== 0 || button !== 2`."
  },
  {
    "id": "UI-5",
    "lens": "ui-input",
    "title": "AUDIT 64 F52's inventory wheel is dead until the pointer moves: `_mouse` is seeded with the hosts' pointer-leave sentinel and only `hover` ever writes it",
    "severity": "low",
    "files": [
      "/home/user/daggerfall-js-source/src/ui/nativeInventory.js",
      "/home/user/daggerfall-js-source/src/scenes/townTalk.js",
      "/home/user/daggerfall-js-source/src/scenes/worldModes.js",
      "/home/user/daggerfall-js-source/src/scenes/dungeonContext.js"
    ],
    "claim": "F52 routes the wheel by what the pointer is over, which is right (BaseScreenComponent dispatches per component rect), and records the point in `hover`. But the window's only writer of `_mouse` is `hover`, and its constructor seeds `[-1, -1]` — the hosts' pointer-LEAVE sentinel, which by construction hits no rect. The pointer lock is released when a window opens, so the cursor simply appears where it was and the browser fires no `mousemove`: a player who opens the pack with the Inventory key and turns the wheel without first nudging the mouse gets nothing at all, and the same notch after a one-pixel move works. DFU has no such state — `BaseScreenComponent.Update` recomputes `mouseOverComponent` from the live mouse position every frame before the scroll block, so the wheel is routed by where the cursor IS, never by whether it has moved since the window opened. The same seeded-sentinel shape rides `nativeTalk._mouse` and `itemMakerWindow._mouse`.",
    "evidence": {
      "port": [
        "/home/user/daggerfall-js-source/src/ui/nativeInventory.js:354 — `this._mouse = [-1, -1];`",
        "/home/user/daggerfall-js-source/src/ui/nativeInventory.js:954-975 — `wheel(dir)` reads `const [vx, vy] = this._mouse;` and every `scrollerHit` against (-1,-1) misses",
        "/home/user/daggerfall-js-source/src/ui/nativeInventory.js:1041-1045 — `hover(vx, vy)` is the sole writer, and it is also the path the hosts feed (-1,-1) on a pointer leave",
        "/home/user/daggerfall-js-source/src/scenes/townTalk.js:1176 — `overlay.hover(v ? v[0] : -1, v ? v[1] : -1, e)` (the sentinel's producer)",
        "/home/user/daggerfall-js-source/src/scenes/townTalk.js:1182-1185 — `wheel` carries no position, so the window can only remember one"
      ],
      "dfu": [
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/BaseScreenComponent.cs:724-736 — the scroll block is guarded by `mouseOverComponent`, recomputed each Update from the live scaled mouse position, and ends `hoverTime = 0`",
        "/home/user/daggerfall-js-source/tools/parity/dfu/Assets/Scripts/Game/UserInterface/ItemListScroller.cs:314-316 — the items panel's own scroll handlers, hung on that per-rect dispatch"
      ],
      "law": "The wheel is routed by where the cursor is this frame, not by where it was last seen moving."
    },
    "proposedFix": "Carry the pointer position on the wheel event itself rather than remembering it: the four host wheel seams already have the `WheelEvent` and the canvas rect, so pass the native point through (`overlay.wheel?.(Math.sign(e.deltaY), vx, vy)`) and let `wheel(dir, vx = this._mouse[0], vy = this._mouse[1])` prefer the live point. That also retires the seeded sentinel in nativeTalk and itemMakerWindow. If the seam is not to change this lane, at minimum seed `_mouse` from the host's last known cursor position when the window is mounted rather than from the leave sentinel.",
    "pinShape": "Build the window through its real producer, call `wheel(1)` with no prior `hover`, and assert `scroll` moved when the cursor is over the local list; today it is 0. Mutation-check by reverting `_mouse` to `[-1,-1]` — the assertion must go red."
  }
]
```

**coverage**

```json
{
  "read": {
    "port_input_core": [
      "/home/user/daggerfall-js-source/src/ui/input.js (whole; routeKey/routeKeyUp/routeAction/actionOf/held/codeDown/pollLatch/POLLED_ACTIONS/BROWSER_STEALS/isTextEntryTarget/swingButton/keyboardLook)",
      "/home/user/daggerfall-js-source/src/ui/hudShortcuts.js (whole)",
      "/home/user/daggerfall-js-source/src/systems/dialogShortcuts.js (normalizeCode, hotkeyHit, firstHotkey, checkSetModifiers, keyboardModifiers, BUTTONS)",
      "/home/user/daggerfall-js-source/src/player/pointerLock.js (whole)",
      "/home/user/daggerfall-js-source/src/player/lookFilter.js (PITCH_FLOOR / tick)",
      "/home/user/daggerfall-js-source/src/systems/activateGate.js (setClickDelay / the delay check)",
      "/home/user/daggerfall-js-source/src/systems/settings.js (setValue)"
    ],
    "hosts": [
      "/home/user/daggerfall-js-source/src/scenes/world.js (keydown 4870-5007, keyup 5008, pointerdown 5041-5070, mousemove 5088, mousedown/mouseup 5126-5127, pause hooks 4807-4830, host bag 6700-6725, frame look 7020-7065)",
      "/home/user/daggerfall-js-source/src/scenes/exterior.js (keydown 2269-2382, keyup 2384, pointerdown 2420-2450, pause hooks 2167-2192)",
      "/home/user/daggerfall-js-source/src/scenes/worldModes.js (keydown 6987-7030, pointerdown 7032-7095, keyup 7160-7172, wheel/hover 7174-7196, pause hooks 6809-6840, mouse arms 6574-6600)",
      "/home/user/daggerfall-js-source/src/scenes/dungeonContext.js (pause hooks 4337-4396, overlay click/wheel/hover 4867/4883/4956)",
      "/home/user/daggerfall-js-source/src/scenes/dungeon.js (both keydown ladders, keyup, pointerdown, mouse arms)",
      "/home/user/daggerfall-js-source/src/scenes/townTalk.js (keydown 326-400, pointerdown 1100-1127, pointer/hover/wheel 1150-1190)"
    ],
    "windows_and_ui": [
      "/home/user/daggerfall-js-source/src/ui/enhancedControls.js (whole)",
      "/home/user/daggerfall-js-source/src/ui/enhancedMenu.js (onKey 1900-1942, mount/unmount 2018-2060, pause tabs 1349-1412)",
      "/home/user/daggerfall-js-source/src/ui/enhancedChargen.js (onKey 1329-1345, releaseLock)",
      "/home/user/daggerfall-js-source/src/ui/pauseDoor.js (whole)",
      "/home/user/daggerfall-js-source/src/ui/pauseWindow.js (openClassicPauseFlow head)",
      "/home/user/daggerfall-js-source/src/ui/controlsWindow.js (click/hover/capture)",
      "/home/user/daggerfall-js-source/src/ui/spellbookWindow.js (click/hover, OT1 diff)",
      "/home/user/daggerfall-js-source/src/ui/nativeInventory.js (full delta diff: F47 right-mode, F48 tooltip, F50 middle, F52 wheel/hover)",
      "/home/user/daggerfall-js-source/src/ui/travelMapWindow.js (input ladder 1090-1165, TL3/F23 diff)",
      "/home/user/daggerfall-js-source/src/ui/hudLarge.js (largeHudClick, routeLargeHudClick)",
      "/home/user/daggerfall-js-source/src/ui/touch.js (whole, incl. the ROAD-H H8 tapCodes change)",
      "/home/user/daggerfall-js-source/src/ui/listPicker.js, nativeTalk.js, charsheet.js, windowStack.js, messageBox.js (click/hover signatures and the delta diffs)"
    ],
    "dfu_reference": [
      "Game/InputManager.cs (via the port's cited ranges), Game/PlayerActivate.cs:255-300 & :1050-1054, Game/UserInterface/UserInterfaceManager.cs:176-216, Game/DaggerfallUI.cs:415-440, Game/UserInterfaceWindows/DaggerfallHUD.cs:285-352, Game/UserInterface/BaseScreenComponent.cs:54 & :679-736, Game/UserInterface/HUDLarge.cs:170-232, Game/UserInterfaceWindows/DaggerfallControlsWindow.cs:52-425, Game/UserInterfaceWindows/DaggerfallTravelMapWindow.cs:376-440"
    ],
    "delta": "git log/diff over 0fe2c05b..HEAD (84 commits) restricted to src/ui, src/player, src/scenes; per-slice commit bodies for FIX-F, CG2/TL3, AUDIT 64 HUD + inventory lanes, OT1, MAC1"
  },
  "clean": [
    "AUDIT 64 F36/F37 host placement: hudShortcutKey is reachable in all four hosts (inline in world.js and exterior.js behind the exterior-mode gate; via routeKey in worldModes' interior and dungeon arms and in dungeon.js) and the mode gates are disjoint, so no double-fire — verified against DaggerfallUI.cs:429-433 (TopWindow-only Update) and DaggerfallHUD.cs:308-318. The e.repeat guard is correct for IsDownWith, and setValue('GUI','LargeHUD') genuinely does not persist, as the module claims.",
    "The enhanced pane's document-capture keydown and the shell's window-capture keydown do not fight: window-capture runs first and stands down on captureArmed(), document-capture then stopPropagation()s so no host bubble listener sees a key being bound; both listeners are removed on unmount and on every navigation away (discardControlsStaging at enhancedMenu.js:1230, :1357, :1409, :2018, :2052). No listener outlives its screen.",
    "MAC1 J does not fight the enhanced menu's own pointerlockchange release handler: `close()` unmounts the view (removing the handler) BEFORE `hooks.relock?.()` runs, and 'exit' is correctly excluded.",
    "MAC1's relock is not a new hazard for touch: the hosts' canvas pointerdown already calls requestLook() unconditionally on every finger-down, and requestLook's NotSupportedError-only retry plus the outer try/catch keep a refused lock a no-op.",
    "AUDIT 62 F6's touch carve-out survives MAC1: `e.pointerType !== 'touch'` still gates setClickDelay in world.js, exterior.js and dungeon.js.",
    "TI1/ROAD-H H8's tapCodes is sound: a tap re-presses a code another live control holds (idempotent in the hosts' Set) and withholds only that code's keyup, so the ring is never left with a key down that nothing holds and never has a held key torn out.",
    "The held-keys ring is drained unconditionally on keyup in every host (world.js:5008, exterior.js:2384, dungeon.js:298), including under DOM overlays whose keys the ladder returns above — no keyup is lost by CG2, by the capture listeners, or by the pause overlay.",
    "CG2's text-field bypass is correctly wired at all three routers (input.js:420, townTalk.js:336, enhancedChargen.js:1331) and the capture target in enhancedControls is a <button>, so isTextEntryTarget stays false over the rebinding pane. Its one rough edge — stepping out ABOVE swallowBrowserKey in world.js/exterior.js — is not live, because worldModes' own window listener calls swallowBrowserKey unconditionally at the top of its ladder and dungeon.js's second listener does the same; it is fragile (it depends on a second host's listener) but F5/F6/F11 are still swallowed while a field has focus.",
    "TL3/F23's travel-map hotkeys are correct against DaggerfallTravelMapWindow.cs:418-428: the shortcut table is asked in DFU's if/else-if order, the LocationCount<1 bail is kept, the region branch swallows everything else (matching DFU never reaching :430-434), Shift+F/Ctrl+L are refused by CheckSetModifiers' second clause, and the Escape/toggle-close arm sits above the region branch as at :380. The down-vs-up edge (IsUpWith) is the port's declared window-wide convention, not a per-slice slip.",
    "The delta's windows honour the hosts' (-1,-1) pointer-leave sentinel: listPicker, nativeTrade, potionMaker, exteriorAutomap, spellbook and nativeInventory all guard or miss on it, and both hover routers optional-chain `?.hover` so the DOM pause overlay (which has no hover) cannot throw.",
    "keyboardLook (FIX-F) is applied once per camera in world.js, exterior.js and dungeon.js and is inherited by worldModes' interior and dungeon arms through the outer host's frame (which runs the look before the modal frame) — a delegated fourth host, not a miss.",
    "AUDIT 64 F47/F50's inventory button narrowing is correct against DaggerfallInventoryWindow's registrations and BaseScreenComponent's three-block dispatch: middle never reaches a left body, right reaches only the four bound families, and GetActionModeRightClick feeds all four arms.",
    "Noted but not filed (hygiene, not an input law): PITCH_LIMIT is imported and unused in world.js:119, exterior.js:38, dungeon.js:33 and interior.js:10 — MW-D30 moved the clamp into lookFilter and the imports are vestigial."
  ]
}
```