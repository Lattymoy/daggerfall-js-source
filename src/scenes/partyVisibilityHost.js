import { getPref } from '../systems/uiPrefs.js';
import { partyVisibilityOptions, partyVisibilityMembers, partyVisibilityAlpha, partyDistanceAlpha, projectPartyMarker, partyOutlineBounds } from '../systems/party/partyVisibility.js';
import { createPartyVisibilityLabels } from '../ui/partyVisibilityLabels.js';
import { PartyOutline } from '../render/partyOutline.js';
import { createBillboardReplay } from '../render/billboardReplay.js';
import { partySlotStyle } from '../systems/party/partySlots.js';
import { createPartySlotUi } from '../ui/partySlotUi.js';
import { createLeaderTrailHost } from './leaderTrailHost.js';
import { leaderTrailTarget } from '../systems/party/leaderTrail.js';

export function createPartyVisibilityHost(deps) {
  let labels = null, outline = null, failed = false;
  const trail = createLeaderTrailHost({ route: deps.trailRoute });
  const release = () => { labels?.dispose(); outline?.dispose(); labels = null; outline = null; failed = false; trail.clear(); };
  const lost = () => { outline = null; failed = false; labels?.hide(); trail.lost(); };
  deps.canvas.addEventListener('webglcontextlost', lost);
  return {
    hide() { labels?.hide(); },
    frame(proj, view, eye, covered) {
      const social = deps.social();
      if (!getPref('partyVisibility') || covered || !social?.party || !deps.connected()) { release(); return; }
      const o = partyVisibilityOptions({diamondDistance:getPref('ketaPartyRange'),nearAlpha:getPref('ketaPartyOpacity'),outline:getPref('ketaPartyOutline'),throughWalls:getPref('ketaPartyThroughWalls'),leaderTrail:getPref('ketaPartyTrail'),entrances:getPref('ketaPartyEntrances')});
      const feet = deps.feet();
      if (!feet) { release(); return; }
      // Presence is owned by the relay roster. Idle peers heartbeat every 20 seconds,
      // and unchanged party poses may not be resent at all; age is not a departure.
      const members = [...partyVisibilityMembers({ others: social.others(), bodies: deps.bodies(), hidden: deps.hidden,
        fresh: deps.fresh, here: deps.here(), fromWorld: deps.fromWorld, pixelCentre: deps.pixelCentre, regionAt: deps.regionAt }), ...(deps.entrances?.() ?? [])];
      const canvas = deps.canvas, bounds = canvas.getBoundingClientRect(), v = deps.viewport();
      const rect = v ? { left: bounds.left + v.x * bounds.width, top: bounds.top + (1 - v.y - v.h) * bounds.height,
        width: v.w * bounds.width, height: v.h * bounds.height } : bounds;
      const markers = [], outlines = [];
      const place = deps.trailPlace?.();
      trail.frame(deps.renderer, place && o.leaderTrail ? leaderTrailTarget({ social, members, entrances: deps.leaderEntrances, mode: deps.mode?.(), feet }) : null,
        feet, place?.k, deps.origin?.(), place?.space === 'world', o);
      for (const m of members) {
        const account=m.memberAccts?.length===1?m.memberAccts[0]:m.acct;
        const paint=partySlotStyle(social.party,account);
        m.slot=paint?.slot;m.color=getPref('partySlotColors')!==false?(paint?.color??(m.memberAccts?.length>1?'#e6e0d2':undefined)):undefined;
        if (!m.exact && !o.approximate) continue;
        const d = Math.hypot(m.at[0] - feet[0], m.at[1] - feet[1], m.at[2] - feet[2]);
        if (o.maxDistance > 0 && d > o.maxDistance) continue;
        const alpha = partyVisibilityAlpha(d, o);
        const hasBody = m.id && deps.hasBody(m.id);
        const head = [m.at[0], m.at[1] + (m.entrance ? m.rise : m.exact ? deps.height(m.id) : 0), m.at[2]];
        const p = projectPartyMarker(head, proj, view, rect, Math.max(64, o.size * 2));
        if (!p) continue;
        if (hasBody && alpha.outline > 0.001) {
          const vp = deps.renderer._worldViewportPx || [0, 0, canvas.width, canvas.height];
          outlines.push({ id: m.id, alpha: alpha.outline, bounds: partyOutlineBounds(m.at, deps.height(m.id), proj, view, vp) });
        }
        const markerAlpha = !hasBody || p.edge || !m.exact ? o.markerAlpha : alpha.marker;
        if ((m.entrance || o.diamonds) && markerAlpha > 0.001 && (!p.edge || o.offscreen)) markers.push({ ...m, ...p, edgeLabelAlignment: p.x < rect.left + 100 ? 'left' : p.x > rect.left + rect.width - 100 ? 'right' : null, alpha: markerAlpha, distanceAlpha: partyDistanceAlpha(p, rect, o), metres: d, dy: m.at[1] - feet[1] });
      }
      if (typeof document !== 'undefined') { labels ??= createPartyVisibilityLabels(); labels.sync(markers, { ...o, rect }); }
      if (!outlines.length) return;
      const r = deps.renderer;
      if (r.gl.isContextLost()) { outline = null; failed = false; return; }
      if (failed) return;
      try {
        outline ??= new PartyOutline(r.gl);
        outline.draw(r, outlines, { ...o, pixelRatio: canvas.width / Math.max(1, bounds.width) }, deps.drawMember);
      } catch (error) {
        failed = true; outline?.dispose(); outline = null;
        console.warn('[party visibility] Outline unavailable; direction markers remain available.', error);
      }
    },
    dispose() { release(); trail.dispose(); deps.canvas.removeEventListener('webglcontextlost', lost); },
  };
}

export function createWorldPartyVisibility(host) {
  const slotUi=createPartySlotUi(()=>host.social);
  const replay=createBillboardReplay(host.renderer);
  const batch = (id) => host.peerRiders?.batchOf(id) || host.peerWalkers?.batchOf(id) || host.remotePlayers?.batchOf(id);
  const party = createPartyVisibilityHost({
    renderer: host.renderer, canvas: host.canvas,
    trailRoute: host.partyPing?.routeTo, trailPlace: host.partyPing?.place, leaderEntrances: host.entrances?.forMember,
    mode: host.mode, origin: () => host.state?.compensation,
    social: () => host.social, connected: () => host.online?.status === 'open',
    bodies: host.partyNear, entrances: host.entrances?.world, feet: () => host.player.feetAt(), hidden: (id) => host.hidden.has(id),
    fresh: (id) => host.online?.peers.has(id) === true,
    here: () => host.mode() === 'exterior' ? host.pixel() : null,
    regionAt: host.regionAt,
    fromWorld: (p) => { const f = host.state.localFromWorld(p.wx, p.wz); return [f[0], p.wy + host.state.compensation[1], f[1]]; },
    pixelCentre: (x, y) => { const t = host.state.pixelTranslation(x, y); return [t[0] + host.terrainSize / 2, t[1], t[2] + host.terrainSize / 2]; },
    viewport: () => host.viewport(host.canvas.clientWidth, host.canvas.clientHeight),
    hasBody: (id) => host.peerBodies?.has(id) || !!batch(id),
    height: (id) => host.peerBodies?.heightOf(id) || batch(id)?.size?.h || 1.8,
    drawMember: (id) => replayPartyMember(host, id, replay.draw),
  });
  return {
    frame(...args) { slotUi.frame();replay.setEnabled(getPref('partyVisibility')===true&&!args[3]);party.frame(...args); },
    hide() { replay.setEnabled(false);party.hide(); },
    dispose() { slotUi.dispose();replay.dispose();party.dispose(); },
  };
}

export function replayPartyMember(host, id, drawSprite) {
  if (host.peerBodies?.has(id)) return host.peerBodies.drawSelected(id);
  const b = host.peerRiders?.batchOf(id) || host.peerWalkers?.batchOf(id) || host.remotePlayers?.batchOf(id);
  if (!b) return;
  return drawSprite(b);
}
