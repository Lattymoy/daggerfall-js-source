// @ts-check
// VULKAN-FLIP (2026-10-28, a player in #bug-reports: "Screen flips when opening an inventory UI while using the Vulkan"):
// NO CSS BACKDROP FILTER ON THE APP'S VULKAN BACKEND. The pack and the dial blur the world behind them with
// `backdrop-filter`, which Chromium's compositor draws from the WebGL canvas: upright on D3D11, upside down on Vulkan,
// whose switches lifted the GPU sandbox and put that draw on the GPU compositor (app/lib/graphicsBackend.cjs).
// So a desktop page whose WebGL renderer names Vulkan drops every backdrop filter; each window keeps its own dim. Read
// from the page, not the shell, so a game-only update reaches an installed app (bible/01-Overview/Desktop-App.md).

/** The style element's id: one per page. */
export const VULKAN_BACKDROP_STYLE_ID = 'vk-backdrop-css';

/** Every element, its pseudo-elements too. `!important` wins over each window's own rule and an inline style. */
export const VULKAN_BACKDROP_CSS =
  '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';

/**
 * Whether this page's backdrop filters come out flipped: the desktop shell (`daggerShell`) drawing on ANGLE's Vulkan
 * backend. A browser is left alone: it keeps its GPU sandbox, and no report came from one.
 * @param {string|null|undefined} gpuName the WebGL renderer string (render/renderer.js gpuNameOf)
 * @param {unknown} shell `globalThis.daggerShell`
 */
export const backdropFlips = (gpuName, shell) => !!shell && /\bvulkan\b/i.test(String(gpuName ?? ''));

/**
 * Drop every backdrop filter on a page that would draw it flipped. Once a page; true when the rule stands.
 * @param {{ getElementById: (id: string) => any, createElement: (tag: string) => any, head: { append: (n: any) => void } | null } | null | undefined} doc
 * @param {string|null|undefined} gpuName
 * @param {unknown} shell
 */
export function guardBackdrops(doc, gpuName, shell) {
  if (!doc || !backdropFlips(gpuName, shell)) return false;
  if (doc.getElementById(VULKAN_BACKDROP_STYLE_ID)) return true;
  const style = doc.createElement('style');
  style.id = VULKAN_BACKDROP_STYLE_ID;
  style.textContent = VULKAN_BACKDROP_CSS;
  doc.head?.append(style);
  return true;
}
