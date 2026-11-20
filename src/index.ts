import * as xb from 'xrblocks';
import { Nusantara360Scene } from './scene360.ts';
import { UIOverlayController } from './uiOverlay.ts';
import { AdminAndModalsController } from './adminPanel.ts';
import { galleryStore, normalizeRoomId } from './store.ts';

async function bootstrapNusantara360() {
  const uiRoot =
    document.getElementById('app-ui') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'app-ui';
      document.body.appendChild(el);
      return el;
    })();

  const adminModalsRoot =
    document.getElementById('admin-modals-root') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'admin-modals-root';
      document.body.appendChild(el);
      return el;
    })();

  let overlayController: UIOverlayController | null = null;

  const sceneScript = new Nusantara360Scene(
    (artworkPins, hotspotPins, cameraTelemetry) => {
      overlayController?.updatePins(artworkPins, hotspotPins, cameraTelemetry);
    },
  );

  overlayController = new UIOverlayController(uiRoot, sceneScript);
  new AdminAndModalsController(adminModalsRoot, sceneScript);

  // Support ?room=ruang_1..ruang_5 query parameters for direct inspection
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    galleryStore.getState().setRoom(normalizeRoomId(roomParam));
  }

  const options = new xb.Options();
  options.setAppTitle('Pameran Virtual');
  options.setAppDescription(
    'Pameran Virtual 360° — Galeri Karya Pelajar Indonesia',
  );
  if ((options as any).simulator?.instructions) {
    (options as any).simulator.instructions.enabled = false;
  }

  xb.add(sceneScript);
  await xb.init(options);

  // Clean up any default simulator keyboard overlay elements injected into body so they never overlap the 360° HUD
  const hideSimOverlays = () => {
    for (const el of Array.from(document.body.children)) {
      const tag = el.tagName.toLowerCase();
      if (tag.includes('-') && (tag.includes('simulator') || tag.includes('instruction'))) {
        (el as HTMLElement).style.display = 'none';
      }
    }
  };
  hideSimOverlays();
  window.setTimeout(hideSimOverlays, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void bootstrapNusantara360();
  });
} else {
  void bootstrapNusantara360();
}
