# Field bugs 2026-10-20: IOS-BUDGET - an iPhone's tab killed at 2 GB right after Play; the budget corrected, the kill measured and still open

GitHub issue #1040 (willdelion, 2026-10-19), an iPhone 17 Pro Max on iOS 27.0.1, the game opened from the Home Screen:
a white screen right after Play, then the home screen, at every setting. The reporter read the device log rather than
the console, and it is not a JavaScript error: the WebContent process stood at about 100 MB at Play, about 1492 MB
twenty-five seconds later, and the kernel killed it five seconds after that for passing `ActiveHard 2048 MB (fatal)`.
Every browser on iOS is WebKit and every one of them shares that cap; the player cannot raise it.

The reporter's own diagnosis pointed at `bundleBudgetBytes` and said out loud that it was not instrumented. It is read
here on the code, and it holds as far as it goes: the budget WAS wrong on iOS. It is then measured on an iPhone, and the
kill does not go with it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #1040: the tab grows past 2 GB within thirty seconds of Play | DFMOD3's bundle budget scales with `navigator.deviceMemory` and read "no report" as an 8 GB machine. WebKit never reports it, so every iPhone and iPad took the 8 GB arm: 1536 MB for the texture mods' decoded pictures alone, on a tab that dies at 2048. Corrected to 384 MB - and measured on an iPhone, the kill stands with every pack off: the exterior itself fills the tab | budget fixed (IOS-BUDGET); #1040 OPEN - the engine's exterior on a phone |

## IOS-BUDGET: the budget asks the device when the browser says nothing

`src/systems/textureReplacement.js` (`bundleBudgetGb`, `bundleBudgetBytes`, `IOS_TAB_GB`), reading
`src/ui/touch/touchDevice.js` (`isTouchDevice`, TI3's one home of "is this page pointed at by a finger").

**The cause.** DFMOD3 (2026-09-29) gave the bundle tier a memory budget so an HD mod set's thousands of decoded pictures
could not take the tab down, and DFMOD3b doubled it to 192 MB a GB up to 1536 MB, on the reading that
`navigator.deviceMemory` is capped at 8 by the browser and most players are past 8 GB. Both took the number as given
and fell to 8 when it was missing - `|| 8`. The number is missing on every WebKit browser, desktop and mobile, and on
Firefox. On a Mac that is the right answer. On an iPhone it is the one wrong answer: iOS gives a tab's WebContent
process about 2 GB and kills it past that, so a budget of 1536 MB left some 500 MB for the engine, ARENA2 in IndexedDB,
the WebGL context and the page, and the shipped texture packs (Vanilla Enhanced and its add-ons are worn by default,
VE4) spent it inside half a minute.

**The fix.** `bundleBudgetGb` answers the browser's report when there is one. When there is none it asks the device:
a finger-pointed page (`isTouchDevice`) is read as `IOS_TAB_GB`, 2 - the ceiling iOS gives a tab - and the same
192 MB a GB makes 384 MB (systems/textureReplacement.js:"export const IOS_TAB_GB = 2;"). A mouse-pointed page with no
report keeps the 8 GB reading and its 1536 MB. Android Chrome reports `deviceMemory`, so a phone that says 4 is scaled
as before, 768 MB, and the report wins over the device reading either way. `bundleBudgetBytes` keeps its callers:
both take the navigator and the window as arguments so the law is pinned without a window stub, and the call sites
pass nothing.

**Measured on an iPhone, and the budget is not the cause.** This branch's build, served to an iPhone over https
(Safari, online, an existing character, Privateer's Hold), Safari's Web Inspector on a Mac recording the Memory
timeline - the page's own view of its heap, which does not count the WebGL textures on the GPU that iOS counts against
the same 2 GB:

| Run | Texture Overhaul | Where | Peak the inspector saw | Outcome |
|---|---|---|---|---|
| 1 | Vanilla Enhanced and its add-ons, as shipped (on by default) | the interior | 1.31 GB - JavaScript 1.11 GB, page 232 MB | the page killed ~27 s after Play, before stepping outside; WebKit reloaded it to the front door |
| 2 | Classic - every pack off | the interior, then the street | 1.45 GB - JavaScript 1.25 GB, page 166 MB; already ~1.1 GB when the recording began indoors | killed ~26 s after stepping outside |
| 3 | Classic | the interior only | - | survived the minutes it was watched |

The budget's warning (`[texture] texture mods reached their memory budget (384 MB)`) was not seen in any run. So:
the packs bring the kill forward (run 1 died indoors where run 2 did not), but with every pack off the engine's own
exterior - Daggerfall's 1996 textures and nothing else - fills a 2 GB tab on its own. The heap is not the stored
files either: the lean set the phone ingests is 893 files, 178 MB (`DaggerfallGameFiles.zip`, the KEEP rule), so
`getBytes`'s never-evicted cache is bounded well under that. The 1.25 GB is what the exterior streamer BUILDS - decoded
pictures, terrain, meshes, the navmesh - and sizing that for a phone is an engine question, not a budget constant.

The fix above stands on its own terms: reading an iPhone as an 8 GB machine was wrong, and a mod set the player
attaches on top of the packs is now bounded at 384 MB there instead of 1536. It does not close #1040. What would,
in order of how much it proves: the exterior's own memory read on a phone (which arrays, how big - the inspector's
JavaScript Allocations timeline names them); the reporter's third suggestion, the shipped packs off by default on a
touch device with no `deviceMemory` (buys back run 1's margin, not run 2's); a whole-tab ceiling the streamer honours.
All three are Mac's to choose; none is taken here. The reporter's device (iPhone 17 Pro Max, iOS 27.0.1) and the one
measured here are both current phones; an older iPhone has less.

**Pinned.** `test/systems/dfmod1.test.js` +1 (IOS-BUDGET: no report and a finger is 2 GB and 384 MB; no report and a
mouse, or no window, stays 1536 MB; a report of 4 on a phone is 768 MB; a zero report is no report; 16 is still capped
at 1536), and DFMOD3's own pin re-aimed in its last assertion to say which browser keeps the full 1536 MB.
`tools/mutants/ios_budget.json` +4 (the no-report arm back to 8; the tab read as 4 GB; a report ignored on a phone; a
zero report taken as one), 4/4 dead.

**Verified.** The test file, the mutants, lint, types and the bible's gates, here; the three runs above on an iPhone,
with the branch's build (`npm run build`, `dist/` served by `python3 -m http.server` behind a Cloudflare quick tunnel
for the https WebCrypto wants - `vite preview` answers a missing `./arena2/*` probe with `index.html`, which skips the
picker and feeds HTML to `MAPS.BSA`: "BSA file has an invalid DirectoryType", not a phone bug). Two small things the
run turned up, not fixed here: that probe trusts a 200 without reading the bytes, and `main.js`'s "clear stored data
and pick again" button is offered only for a missing-file message, so a corrupt stored set leaves no way back.
