import * as xb from 'xrblocks';
import { Nusantara360Scene } from './scene360.ts';
import { UIOverlayController } from './uiOverlay.ts';
import type { AdminAndModalsController } from './adminPanel.ts';
import { galleryStore, normalizeRoomId } from './store.ts';

function isAtAdminRoute(): boolean {
  const cleanPath = window.location.pathname.replace(/\/+$/, '');
  return (
    cleanPath === '/admin' ||
    cleanPath.endsWith('/admin') ||
    window.location.hash === '#/admin'
  );
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const narrowViewport = window.matchMedia?.('(max-width: 767px)')?.matches ?? false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || '',
  );
  return narrowViewport || coarsePointer || mobileUa;
}

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

  // Lazy-load Admin & Settings controller (includes Firebase & export templates)
  // so regular visitors load a much smaller, faster initial bundle.
  let adminController: AdminAndModalsController | null = null;
  let adminLoadPromise: Promise<AdminAndModalsController | null> | null = null;

  const ensureAdminController = async (): Promise<AdminAndModalsController | null> => {
    if (adminController) {
      adminController.render();
      return adminController;
    }
    if (!adminLoadPromise) {
      adminLoadPromise = import('./adminPanel.ts')
        .then(({ AdminAndModalsController: Controller }) => {
          adminController = new Controller(adminModalsRoot, sceneScript);
          adminController.render();
          return adminController;
        })
        .catch((err) => {
          console.error('Gagal memuat modul panel pengaturan/admin:', err);
          adminLoadPromise = null;
          return null;
        });
    }
    return adminLoadPromise;
  };

  const needsAdminPanel = () => {
    const s = galleryStore.getState();
    return Boolean(
      s.isAdminOpen ||
        s.isAdminDashboardOpen ||
        s.isCodeModalOpen ||
        s.isAiStudioOpen,
    );
  };

  if (needsAdminPanel() || isAtAdminRoute()) {
    void ensureAdminController();
  }

  galleryStore.subscribe((state) => {
    if (
      !adminController &&
      (state.isAdminOpen ||
        state.isAdminDashboardOpen ||
        state.isCodeModalOpen ||
        state.isAiStudioOpen)
    ) {
      void ensureAdminController();
    }
  });

  const handleRouteCheck = () => {
    if (isAtAdminRoute()) {
      galleryStore.getState().setAdminDashboardOpen(true);
      void ensureAdminController();
    }
  };
  window.addEventListener('popstate', handleRouteCheck);
  window.addEventListener('hashchange', handleRouteCheck);
  window.addEventListener('keydown', (e) => {
    if (
      !adminController &&
      ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) ||
        (e.altKey && (e.key === 'a' || e.key === 'A')))
    ) {
      e.preventDefault();
      galleryStore.getState().setAdminDashboardOpen(true);
      void ensureAdminController();
    }
  });

  // Support ?room=ruang_1..ruang_5 query parameters for direct inspection
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    galleryStore.getState().setRoom(normalizeRoomId(roomParam));
  }

  const mobile = isMobileDevice();
  const options = new xb.Options();
  options.setAppTitle('');
  options.setAppDescription('');

  if (mobile) {
    options.enableSimulator = false;
    if (options.xrButton) {
      options.xrButton.enabled = false;
      options.xrButton.showEnterSimulatorButton = false;
      (options.xrButton as any).showStartArButton = false;
      (options.xrButton as any).showStartVrButton = false;
    }
  } else if ((options as any).simulator?.instructions) {
    (options as any).simulator.instructions.enabled = false;
  }

  xb.add(sceneScript);
  await xb.init(options);

  // Clean up any default simulator keyboard overlay elements (and VR button on mobile)
  const hideSimOverlays = () => {
    for (const el of Array.from(document.body.children)) {
      const tag = el.tagName.toLowerCase();
      if (tag.includes('-') && (tag.includes('simulator') || tag.includes('instruction'))) {
        (el as HTMLElement).style.display = 'none';
      }
    }
    if (mobile || window.innerWidth < 768) {
      document.getElementById('XRButtonWrapper')?.remove();
      document
        .querySelectorAll('.XRButton, #VRButton, #ARButton')
        .forEach((btn) => btn.remove());
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
