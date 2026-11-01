// @ts-check
// The texture store's registration under way (scenes/dataSource.js registerTextureStore). The door's ground sets
// (systems/dfmodTextures.js dfmodGroundLayers) wait for it: a set asked before the shipped packs are in the door is
// Daggerfall's own, and a host keeps an uploaded set for the session. A module of its own, so the data source names no
// part of the door when it boots.

/** @type {Promise<any> | null} */
let _registering = null;

/** Note a registration under way; it is forgotten once it settles. @param {Promise<any>} registration */
export function noteTextureStoreRegistering(registration) {
  _registering = registration;
  const done = () => {
    if (_registering === registration) _registering = null;
  };
  registration.then(done, done);
}

/** The registration under way, or null. */
export const textureStoreRegistering = () => _registering;
