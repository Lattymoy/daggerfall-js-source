// @ts-check
// Keep the existing exterior boat stream while the primary session occupies the
// cabin. Both lanes use OnlineSession; neither owns another boat or scene cache.
import { OnlineSession, roomKeyFor } from './online.js';
import { cellHaloFor } from './wire.js';

export function createSailingCabinLink({ frame, receive, sweep, Session = OnlineSession }) {
  let link = null, source = null, sentAt = -Infinity, welcome = -1;
  function close() {
    link?.leave(); link = null; source = null; sentAt = -Infinity; welcome = -1;
  }
  return {
    close,
    tick(main, cabin, pixel, now) {
      if (!main || !cabin || main.terminal) { close(); return; }
      const room = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: pixel });
      // Never take over the main session's socket during the entry/exit handoff.
      if (!room || main.room === room || main.inRoom(room)) { close(); return; }
      if (source !== main) {
        close(); source = main;
        link = new Session({ url: main.url, id: main.id, secret: main.secret, name: main.name,
          look: main.look, mintToken: main.mintToken });
        link.onSuperseded = () => main.onSuperseded?.();
        link.onFoes = (id, data) => {
          if (data && (!data.k || link?.inRoom(data.k))) receive(id, data);
        };
      }
      link.leaseFrom?.(main);   // LEASE1: the page's lease rides this lane's frames too (net/roomLease.js)
      const pose = { x: cabin.origin[0], y: cabin.origin[1], z: cabin.origin[2], yaw: cabin.yaw, pitch: 0, mv: 0 };
      if (link.room !== room) { link.join(room, pose); sentAt = -Infinity; }
      else link.sendPose(pose);
      link.setHalo(cellHaloFor(pixel.x, pixel.y, { current: link.haloRooms() }));
      link.tick();
      if (link.status !== 'open') return;
      // Full records only on this stationary lane, so a reconnect or failed send
      // cannot lose the boat. The normal exterior frame counter remains shared.
      // SCALE2b: and only while someone is in that cell to see the boat - the full record every second woke a room
      // with nobody in it; the first welcome after a joiner (or after the lane comes back) says it at once
      if (link.othersHere === 0) { sentAt = -Infinity; welcome = -1; }
      else if (link.welcomes !== welcome || now - sentAt >= 1000) {
        if (link.sendFoes({ ...frame(), k: room })) { welcome = link.welcomes; sentAt = now; }
      }
      sweep(new Set(link.drawable().map((p) => p.id)), now);
    },
  };
}
