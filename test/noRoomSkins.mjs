// PARTY-SKIN (PR B): THE DUNGEON'S SKIN LOCK, OFF. The mounts that slice a door out of src/scenes/dungeonContext.js (the kill door, the record,
// the stream, the hit) meet `roomSkins` - the room block's door to the lock (scenes/roomLootHost.js) - as a name the host constructs
// above them. Those pins judge another law than the skin's, so their scope holds the lock as an offline room has it: it mints nothing,
// keys nothing, hears and claims nothing. test/net/partySkinWire.mjs mounts the real one.
export const NO_ROOM_SKINS = Object.freeze({
  mint() {}, noteBlow() {}, applyHit: () => undefined, hear() {}, attach() {}, attachShared() {}, sizeOf: () => 0, skinOf: () => null,
});
