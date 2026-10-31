// PVP-FLAG-CAPS (the owner, 2026-10-29: "let it work in chat for caps", "yes do that"): Caps Lock in the game does an
// action (PvP's flag by default - scenes/pvpFlagHost.js), and no page can stop the keyboard's own Caps Lock turning on with it. A chat line typed
// while the light is on from that press is typed as if it were off; a Caps Lock pressed in the field is the player's
// own again. Letters only, never with Ctrl, Alt or Meta.

let by = /** @type {'game' | 'field' | null} */ (null);

/** Caps Lock pressed: in the game for an action, or in a text field (null: neither - the light is the player's). */
export function noteCaps(where) { by = where; }

/** The chat field's keydown: a letter typed under the game's Caps Lock goes in as its other case. True if taken. */
export function capsFixKey(e, field) {
  if (e.code === 'CapsLock') { noteCaps('field'); return false; }
  const ch = typeof e.key === 'string' ? e.key : '';
  if (by !== 'game' || ch.length !== 1 || e.ctrlKey || e.altKey || e.metaKey || ch.toLowerCase() === ch.toUpperCase()) return false;
  if (!e.getModifierState?.('CapsLock')) return false;
  const flip = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
  const v = String(field.value ?? ''), a = field.selectionStart ?? v.length, b = field.selectionEnd ?? a;
  e.preventDefault();
  field.value = v.slice(0, a) + flip + v.slice(b);
  field.setSelectionRange?.(a + 1, a + 1);
  if (globalThis.Event) field.dispatchEvent?.(new globalThis.Event('input', { bubbles: true }));   // the field's own listeners (the [ list) hear it
  return true;
}
