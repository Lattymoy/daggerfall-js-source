// The PROTOTYPE host for the enhanced main menu, at /menu.html.
//
// It is four lines because it has to be: the screen itself lives in
// src/ui/enhancedMenu.js and the GAME mounts that same module. A
// prototype that carries its own copy of the design is a prototype
// arguing about something the player will never see, which is the one
// thing a prototype must not be.
//
// The only difference is the exit: here an action is logged, where the
// game boots a world.
import { mountEnhancedMenu } from '../ui/enhancedMenu.js';

mountEnhancedMenu(document.getElementById('app'), {
  onAction: (action) => console.log('[menu prototype]', action),
});
