// MW-D38 / QS3 - AN ITEM'S MORROWIND ICON, AS A DATA URL.
//
// This was private to ui/enhancedInventory.js, which is the only thing
// that had ever wanted it. QS3's quickslot diamond wants the same
// picture of the same item, and the inventory window is a 2200-line
// screen with its own drag state, its own paper doll and its own
// deps - importing it into the HUD to reach twenty lines would drag
// all of that into every frame drawHud makes. So the twenty lines
// moved here, and both import them.
//
// THE ARM MODULE IS AN ARGUMENT, not an import. The inventory takes
// its rig through the deps bag it is mounted with (`deps.fpArm`) and
// answers null when the host handed none - a page with no Morrowind
// data behind it draws the classic icon and says nothing about it.
// Defaulting to the singleton here would quietly change that, so this
// takes what it is given and nothing more.
//
// The rig caches the pixels per record; this caches the ENCODING,
// keyed by the ImageData object the rig hands back, so the same icon
// is turned into a PNG once however many times it is asked for.
const _iconUrls = new Map();

export function modelIconUrl(item, size, armMod) {
  if (!armMod || typeof armMod.itemIcon !== 'function' || !item) return null;
  let img = null;
  try { img = armMod.itemIcon(item, { size }); } catch { img = null; }
  if (!img || !img.width) return null;
  if (_iconUrls.has(img)) return _iconUrls.get(img);
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  cv.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  const url = cv.toDataURL('image/png');
  _iconUrls.set(img, url);
  return url;
}
