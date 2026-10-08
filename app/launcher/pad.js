// DA12 (2026-10-08, Mac: "I can't control the Launcher with a controller"): THE LAUNCHER ANSWERS A PAD.
// The game's own front-door loop (src/ui/menuPad.js, PAD-DOOR), over this page's own controls: the d-pad or the
// left stick moves the focus, A (or Start) presses it, B is Escape. The shell serves the one module at
// dagger://launcher/menuPad.js (app/main.cjs MENU_PAD) - never a copy of its law. The focus is the page's own
// :focus-visible (launcher.css); a style written by script is one this page's CSP refuses.
import { attachMenuPad } from './menuPad.js';

attachMenuPad({ focusStyle: false });
