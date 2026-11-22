import {
  galleryStore,
  ROOMS,
  ROOM_LIST,
  formatIDR,
  buildWhatsAppUrl,
  filterArtworks,
  calculateCartTotals,
  getArtworkComments,
  validateCommentInput,
  getRepositoryList,
  resolveGalleryArtwork,
  shortPinTitle,
  getAdjacentArtworkInRoom,
  getDefaultArtworkImageUrl,
} from './store.ts';
import { getArtworkPreviewDataUrl } from './proceduralTextures.ts';
import {
  BackgroundAudioManager,
  getRoomAudioProfile,
} from './audioManager.ts';
import type {
  Nusantara360Scene,
  PinScreenPosition,
  HotspotScreenPosition,
  RepositoryPinScreenPosition,
} from './scene360.ts';
import type {
  Artwork,
  RoomId,
} from './types.ts';

export class UIOverlayController {
  private root: HTMLElement;
  private sceneScript: Nusantara360Scene;
  private audioManager: BackgroundAudioManager;

  // Dedicated DOM sub-containers for the 4-Corner Transparent HUD + Street-View Pins + Loading Screen
  private pinsLayer!: HTMLElement;
  private topLeftLayer!: HTMLElement;
  private topRightLayer!: HTMLElement;
  private bottomLeftAnalogLayer!: HTMLElement;
  private bottomRightInfoLayer!: HTMLElement;
  private modalLayer!: HTMLElement;
  private toastLayer!: HTMLElement;
  private loadingLayer!: HTMLElement;

  // Fade-In / Fade-Out Exhibition Loading Screen State
  private isLoadingVisible = true;
  private loadingProgress = 24;
  private loadingTitle = 'Memuat Data Pameran 360°...';
  private loadingSubtitle = 'Menyiapkan ruang galeri interaktif & koleksi karya pelajar Nusantara';
  private loadingFadeOutTimer?: number;
  private loadingProgressTimer?: number;

  private pinElements = new Map<string, HTMLButtonElement>();
  private hotspotElements = new Map<RoomId, HTMLButtonElement>();
  private repositoryPinBtn: HTMLButtonElement | null = null;

  // Volume Popover toggle state in Top-Right UI
  private isVolumePopoverOpen = false;

  // Mobile Legends Analog Joystick State
  private analogActive = false;
  private analogPointerId: number | null = null;
  private analogCenterX = 0;
  private analogCenterY = 0;
  private analogMaxRadius = 42;

  // Live Camera Telemetry for Bottom-Right Labyrinth Radar & Info Panel
  private liveYaw = 0;
  private livePitch = 0;
  private liveBloom = 0.16;

  // Visitor Comment Form Draft State inside Artwork Modal (Minimalist: Only Name & Message)
  private draftVisitorName = '';
  private editingCommentId: string | null = null;

  // Cart Checkout State
  private checkoutName = '';
  private checkoutWhatsApp = '';
  private checkoutStatusMsg = '';

  // Toast notification state
  private toastMessage = '';
  private toastTimer?: number;

  constructor(root: HTMLElement, sceneScript: Nusantara360Scene) {
    this.root = root;
    this.sceneScript = sceneScript;
    const initState = galleryStore.getState();

    // Auto-collapse Denah HUD on narrow portrait smartphones so the 360° canvas & pins stay uncluttered
    if (typeof window !== 'undefined' && window.innerWidth < 640 && !initState.hudCollapsed) {
      initState.setHudCollapsed(true);
    }

    this.audioManager = new BackgroundAudioManager(
      initState.currentRoom,
      initState.audioMuted,
      undefined,
      initState.audioVolume,
    );
    this.initDOMStructure();
    this.renderAll();
    this.setupInitialAndSceneLoadingHooks();

    window.addEventListener('resize', () => {
      this.renderBottomRightInfo();
    });

    galleryStore.subscribe((state, prevState) => {
      if (state.currentRoom !== prevState.currentRoom) {
        this.audioManager.setRoom(state.currentRoom);
      }
      if (state.transitioningRoom !== prevState.transitioningRoom) {
        const roomSpec = ROOMS[state.currentRoom] || ROOMS.ruang_1;
        if (!state.transitioningRoom) {
          this.setLoadingScreenState(
            false,
            100,
            roomSpec.name,
            roomSpec.subtitle,
          );
        }
      }
      if (state.audioMuted !== prevState.audioMuted) {
        this.audioManager.setMuted(state.audioMuted);
        this.renderTopRightCorner();
        this.renderBottomRightInfo();
      }
      if (state.audioVolume !== prevState.audioVolume) {
        this.audioManager.setVolume(state.audioVolume);
        const volSlider = this.topRightLayer.querySelector(
          '#inp-audio-volume',
        ) as HTMLInputElement | null;
        const volLabel = this.topRightLayer.querySelector('#lbl-audio-volume');
        if (volSlider && Number(volSlider.value) !== state.audioVolume) {
          volSlider.value = String(state.audioVolume);
        }
        if (volLabel) {
          volLabel.textContent = state.audioMuted || state.audioVolume === 0 ? 'Mati (0%)' : `${state.audioVolume}%`;
        }
        this.updateVolumeButtonIcon(state.audioMuted, state.audioVolume);
      }
      if (
        state.currentRoom !== prevState.currentRoom ||
        state.levelFilter !== prevState.levelFilter ||
        state.categoryFilter !== prevState.categoryFilter ||
        state.searchQuery !== prevState.searchQuery ||
        state.artworks !== prevState.artworks
      ) {
        this.syncPinButtonsPool();
        this.renderTopLeftCorner();
        this.renderBottomRightInfo();
      }
      if (
        state.cart !== prevState.cart ||
        state.isRepositoryOpen !== prevState.isRepositoryOpen
      ) {
        this.renderTopRightCorner();
      }
      if (state.hudCollapsed !== prevState.hudCollapsed) {
        this.renderBottomRightInfo();
      }
      if (state.selectedArtworkId !== prevState.selectedArtworkId) {
        this.editingCommentId = null;
        if (state.selectedArtworkId) {
          this.audioManager.playInteractionChime('modalOpen');
        } else if (prevState.selectedArtworkId) {
          this.audioManager.playInteractionChime('modalClose');
        }
        this.renderModals();
      }
      if (
        state.isCartOpen !== prevState.isCartOpen ||
        state.isRepositoryOpen !== prevState.isRepositoryOpen ||
        (state.artworks !== prevState.artworks &&
          (state.selectedArtworkId || state.isCartOpen || state.isRepositoryOpen))
      ) {
        this.renderModals();
      }
    });
  }

  private initDOMStructure() {
    this.root.innerHTML = '';
    this.root.className =
      'fixed inset-0 pointer-events-none z-[120] select-none overflow-hidden font-sans';

    // 1. Projected 3D Artwork Pins, Galeri Pin & Street-View Floor Chevrons Layer
    this.pinsLayer = document.createElement('div');
    this.pinsLayer.id = 'layer-3d-pins';
    this.pinsLayer.className = 'fixed inset-0 pointer-events-none z-[125]';

    // 2. Pojok Kiri Atas (Kosong — judul atas "Pameran Virtual" dihapus sesuai permintaan)
    this.topLeftLayer = document.createElement('div');
    this.topLeftLayer.id = 'corner-top-left';
    this.topLeftLayer.className = 'hidden';

    // 3. Pojok Kanan Atas (Icon-Only Controls: Galeri, Suara & Volume, Keranjang, STARLA BUDAYA v.0.2.3)
    this.topRightLayer = document.createElement('nav');
    this.topRightLayer.id = 'corner-top-right';
    this.topRightLayer.setAttribute('aria-label', 'Aksi Pojok Kanan Atas');
    this.topRightLayer.setAttribute('data-ui-interactive', 'true');
    this.topRightLayer.className =
      'fixed top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-[150] pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2';

    // 4. Pojok Kiri Bawah (Bottom-Left: Clean & Professional 360° Analog Navigation)
    this.bottomLeftAnalogLayer = document.createElement('div');
    this.bottomLeftAnalogLayer.id = 'corner-bottom-left';
    this.bottomLeftAnalogLayer.setAttribute('data-ui-interactive', 'true');
    this.bottomLeftAnalogLayer.className =
      'fixed bottom-2.5 left-2.5 sm:bottom-3.5 sm:left-3.5 z-[150] pointer-events-auto flex items-end gap-2';

    // 5. Pojok Kanan Bawah (Bottom-Right: Icon-Only Denah Button & Popover with R1-R5)
    this.bottomRightInfoLayer = document.createElement('aside');
    this.bottomRightInfoLayer.id = 'corner-bottom-right';
    this.bottomRightInfoLayer.setAttribute('aria-label', 'Denah Ruangan & Navigasi R1-R5');
    this.bottomRightInfoLayer.setAttribute('data-ui-interactive', 'true');
    this.bottomRightInfoLayer.className =
      'fixed bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5 z-[150] pointer-events-auto';

    // 6. Artwork Detail, Galeri & Shopping Cart Modal Layer
    this.modalLayer = document.createElement('div');
    this.modalLayer.id = 'layer-modals';
    this.modalLayer.className = 'relative z-[250] pointer-events-auto';

    // 7. Toast feedback Layer
    this.toastLayer = document.createElement('div');
    this.toastLayer.id = 'layer-toast';
    this.toastLayer.className =
      'fixed top-14 sm:top-16 right-3 sm:right-4 z-[350] pointer-events-none transition-opacity duration-200 max-w-[calc(100vw-24px)]';

    // 8. Smooth Fade-In / Fade-Out Exhibition Loading Screen Layer
    this.loadingLayer = document.createElement('div');
    this.loadingLayer.id = 'exhibition-loading-screen';
    this.loadingLayer.setAttribute('role', 'status');
    this.loadingLayer.setAttribute('aria-live', 'polite');
    this.loadingLayer.setAttribute('aria-label', 'Memuat Data Pameran');
    this.loadingLayer.className =
      'exhibition-loader-overlay is-visible fixed inset-0 z-[380] flex items-center justify-center bg-stone-950/90 backdrop-blur-xl p-4';

    this.root.append(
      this.pinsLayer,
      this.topLeftLayer,
      this.topRightLayer,
      this.bottomLeftAnalogLayer,
      this.bottomRightInfoLayer,
      this.modalLayer,
      this.toastLayer,
      this.loadingLayer,
    );

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const st = galleryStore.getState();
        if (st.selectedArtworkId) {
          st.selectArtwork(null);
        } else if (st.isRepositoryOpen) {
          st.setRepositoryOpen(false);
        } else if (st.isCartOpen) {
          st.setCartOpen(false);
        } else if (this.isVolumePopoverOpen) {
          this.isVolumePopoverOpen = false;
          this.renderTopRightCorner();
        } else if (!st.hudCollapsed) {
          st.setHudCollapsed(true);
        }
      }
    });

    this.syncPinButtonsPool();
  }

  private renderLoadingScreen() {
    if (!this.loadingLayer) return;
    const state = galleryStore.getState();
    const activeRoom = ROOMS[state.currentRoom] || ROOMS.ruang_1;
    const totalArtworks = state.artworks.length;

    this.loadingLayer.innerHTML = `
      <div class="exhibition-loader-card w-full max-w-xs sm:max-w-sm rounded-3xl bg-stone-900/90 border border-white/15 px-6 py-7 shadow-[0_24px_64px_rgba(0,0,0,0.75)] flex flex-col items-center text-center space-y-4">
        <!-- Dual Orbital 360° Spinner -->
        <div class="relative w-14 h-14 flex items-center justify-center">
          <div class="loader-ring-outer absolute inset-0 rounded-full border-2 border-amber-400/20 border-t-amber-400 border-r-emerald-400/70"></div>
          <div class="loader-ring-inner absolute inset-2 rounded-full border border-dashed border-white/25 border-b-emerald-300"></div>
          <div class="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.95)]"></div>
        </div>

        <div class="space-y-1 max-w-full">
          <div id="loading-screen-title" class="text-sm sm:text-base font-bold text-white tracking-tight truncate">
            ${this.escapeHtml(this.loadingTitle)}
          </div>
          <p id="loading-screen-subtitle" class="text-[11px] sm:text-xs text-stone-400 leading-relaxed line-clamp-2">
            ${this.escapeHtml(this.loadingSubtitle)}
          </p>
        </div>

        <!-- Smooth Progress Bar -->
        <div class="w-full space-y-1.5 pt-1">
          <div class="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden border border-white/10">
            <div
              id="loading-screen-progress-bar"
              style="width: ${Math.min(100, Math.max(8, this.loadingProgress))}%"
              class="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 transition-all duration-300 ease-out"
            ></div>
          </div>
          <div class="flex items-center justify-between text-[10px] font-mono text-stone-400">
            <span id="loading-screen-room-badge" class="text-amber-300/90 font-semibold">${this.escapeHtml(activeRoom.code)} · ${totalArtworks} Karya</span>
            <span id="loading-screen-percent" class="tabular-nums text-emerald-300 font-bold">${Math.round(this.loadingProgress)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  public setLoadingScreenState(
    visible: boolean,
    progress?: number,
    title?: string,
    subtitle?: string,
  ) {
    if (!this.loadingLayer) return;
    if (typeof progress === 'number') {
      this.loadingProgress = Math.min(100, Math.max(0, progress));
    }
    if (title) this.loadingTitle = title;
    if (subtitle) this.loadingSubtitle = subtitle;

    const titleEl = this.loadingLayer.querySelector('#loading-screen-title');
    const subEl = this.loadingLayer.querySelector('#loading-screen-subtitle');
    const barEl = this.loadingLayer.querySelector(
      '#loading-screen-progress-bar',
    ) as HTMLElement | null;
    const pctEl = this.loadingLayer.querySelector('#loading-screen-percent');
    const roomBadgeEl = this.loadingLayer.querySelector('#loading-screen-room-badge');

    const st = galleryStore.getState();
    const room = ROOMS[st.currentRoom] || ROOMS.ruang_1;

    if (titleEl) titleEl.textContent = this.loadingTitle;
    if (subEl) subEl.textContent = this.loadingSubtitle;
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(8, this.loadingProgress))}%`;
    if (pctEl) pctEl.textContent = `${Math.round(this.loadingProgress)}%`;
    if (roomBadgeEl) roomBadgeEl.textContent = `${room.code} · ${st.artworks.length} Karya`;

    if (visible) {
      if (this.loadingFadeOutTimer) {
        window.clearTimeout(this.loadingFadeOutTimer);
        this.loadingFadeOutTimer = undefined;
      }
      this.isLoadingVisible = true;
      this.loadingLayer.classList.remove('is-hidden');
      this.loadingLayer.classList.add('is-visible');
      this.loadingLayer.setAttribute('aria-hidden', 'false');
    } else {
      this.loadingProgress = 100;
      if (barEl) barEl.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
      if (this.loadingFadeOutTimer) {
        window.clearTimeout(this.loadingFadeOutTimer);
      }
      this.loadingFadeOutTimer = window.setTimeout(() => {
        this.isLoadingVisible = false;
        this.loadingLayer.classList.remove('is-visible');
        this.loadingLayer.classList.add('is-hidden');
        this.loadingLayer.setAttribute('aria-hidden', 'true');
      }, 160);
    }
  }

  private setupInitialAndSceneLoadingHooks() {
    const st = galleryStore.getState();
    const initialRoom = ROOMS[st.currentRoom] || ROOMS.ruang_1;
    this.setLoadingScreenState(
      true,
      32,
      `Memuat ${initialRoom.name}...`,
      initialRoom.subtitle,
    );

    // Smooth incremental progress while 360° texture & exhibition data initialize
    this.loadingProgressTimer = window.setInterval(() => {
      if (!this.isLoadingVisible) return;
      if (this.loadingProgress < 86) {
        this.setLoadingScreenState(true, this.loadingProgress + 14);
      }
    }, 140);

    this.sceneScript.onLoadingStateChange = (isLoading, progress, roomName, roomSubtitle) => {
      if (isLoading) {
        this.setLoadingScreenState(
          true,
          Math.max(this.loadingProgress, progress),
          `Memuat ${roomName}...`,
          roomSubtitle,
        );
      } else {
        if (this.loadingProgressTimer) {
          window.clearInterval(this.loadingProgressTimer);
          this.loadingProgressTimer = undefined;
        }
        this.setLoadingScreenState(false, 100, roomName, roomSubtitle);
      }
    };

    // Safety fallback so initial loading screen always fades out smoothly within 900ms even if texture is cached
    window.setTimeout(() => {
      if (this.loadingProgressTimer) {
        window.clearInterval(this.loadingProgressTimer);
        this.loadingProgressTimer = undefined;
      }
      if (!galleryStore.getState().transitioningRoom) {
        const room = ROOMS[galleryStore.getState().currentRoom] || ROOMS.ruang_1;
        this.setLoadingScreenState(false, 100, room.name, room.subtitle);
      }
    }, 680);
  }

  public showToast(msg: string) {
    this.toastMessage = msg;
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastLayer.innerHTML = `
      <div role="status" class="px-4 py-2.5 rounded-xl bg-stone-950/90 border border-amber-400/50 text-amber-200 text-xs font-medium shadow-xl">
        ${this.escapeHtml(this.toastMessage)}
      </div>
    `;
    this.toastTimer = window.setTimeout(() => {
      this.toastLayer.innerHTML = '';
    }, 2800);
  }

  private renderAll() {
    this.renderLoadingScreen();
    this.renderTopLeftCorner();
    this.renderTopRightCorner();
    this.renderBottomLeftAnalog();
    this.renderBottomRightInfo();
    this.renderModals();
  }

  // ─── 1. PROJECTED PINS, GALERI PIN & STREET-VIEW FLOOR HOTSPOTS ────────────
  // Nama pada hotspot singkat hanya 1-2 kata, dengan efek motion modern & ringan
  private syncPinButtonsPool() {
    const state = galleryStore.getState();
    const visibleArtworks = filterArtworks(
      state.artworks,
      state.currentRoom,
      state.levelFilter,
      state.categoryFilter,
      state.searchQuery,
    );

    const validIds = new Set(visibleArtworks.map((a) => a.id));

    for (const [id, el] of this.pinElements.entries()) {
      if (!validIds.has(id)) {
        el.remove();
        this.pinElements.delete(id);
      }
    }

    for (const art of visibleArtworks) {
      let btn = this.pinElements.get(art.id);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = `pin-btn-${art.id}`;
        btn.setAttribute('data-ui-interactive', 'true');
        btn.setAttribute('data-artwork-pin', art.id);
        btn.className =
          'pointer-events-auto absolute left-0 top-0 will-change-transform group';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.audioManager.playInteractionChime('focus');
          this.sceneScript.focusCameraOnArtwork(art, {
            durationMs: 520,
          });
          galleryStore.getState().selectArtwork(art.id);
        });
        this.pinsLayer.appendChild(btn);
        this.pinElements.set(art.id, btn);
      }

      const shortTitle = shortPinTitle(art);

      btn.setAttribute('aria-label', `${shortTitle} — ${art.title}`);
      btn.title = `${art.title} (${formatIDR(art.price)})`;
      btn.innerHTML = `
        <span class="pin-motion-inner px-2.5 py-1 rounded-full bg-stone-950/85 hover:bg-stone-900 border border-white/30 hover:border-emerald-300/90 shadow-lg flex items-center gap-1.5 transition-colors">
          <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.9)]"></span>
          <span class="text-[11px] font-semibold text-white group-hover:text-emerald-200 whitespace-nowrap leading-tight">
            ${this.escapeHtml(shortTitle)}
          </span>
        </span>
      `;
    }

    // Create or update 3D "Galeri" Pin Button (Changed from "Lemari Repositori" -> "Galeri")
    if (!this.repositoryPinBtn) {
      const repoBtn = document.createElement('button');
      repoBtn.type = 'button';
      repoBtn.id = 'pin-btn-repository';
      repoBtn.setAttribute('data-ui-interactive', 'true');
      repoBtn.setAttribute('aria-label', 'Galeri');
      repoBtn.title = 'Galeri';
      repoBtn.className =
        'pointer-events-auto absolute left-0 top-0 will-change-transform group';
      repoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sceneScript.focusCameraOnRepository();
        this.audioManager.playInteractionChime('artwork');
        galleryStore.getState().setRepositoryOpen(true);
      });
      this.pinsLayer.appendChild(repoBtn);
      this.repositoryPinBtn = repoBtn;
    }

    this.repositoryPinBtn.innerHTML = `
      <span class="pin-motion-inner px-3 py-1 rounded-full bg-amber-950/90 hover:bg-amber-500 text-amber-100 hover:text-stone-950 border border-amber-400/80 shadow-xl flex items-center gap-1.5 transition-colors">
        <span class="w-2 h-2 rounded-full bg-amber-400 group-hover:bg-stone-950 shrink-0"></span>
        <span class="text-[11px] font-bold tracking-tight whitespace-nowrap">Galeri</span>
      </span>
    `;

    // Sync Street-View Floor Portal Hotspots (1-2 word label + modern lightweight motion)
    const roomSpec = ROOMS[state.currentRoom] || ROOMS.ruang_1;
    const validTargets = new Set(roomSpec.portals.map((p) => p.targetRoom));

    for (const [targetRoom, el] of this.hotspotElements.entries()) {
      if (!validTargets.has(targetRoom)) {
        el.remove();
        this.hotspotElements.delete(targetRoom);
      }
    }

    for (const portal of roomSpec.portals) {
      let hsBtn = this.hotspotElements.get(portal.targetRoom);
      if (!hsBtn) {
        hsBtn = document.createElement('button');
        hsBtn.type = 'button';
        hsBtn.setAttribute('data-ui-interactive', 'true');
        hsBtn.setAttribute('data-floor-portal', portal.targetRoom);
        hsBtn.className =
          'pointer-events-auto absolute left-0 top-0 will-change-transform group';
        this.pinsLayer.appendChild(hsBtn);
        this.hotspotElements.set(portal.targetRoom, hsBtn);
      }
      hsBtn.setAttribute('aria-label', portal.shortLabel);
      hsBtn.title = portal.shortLabel;
      hsBtn.innerHTML = `
        <span class="hotspot-motion-inner px-3 py-1.5 rounded-full bg-stone-950/85 hover:bg-amber-500 text-white hover:text-stone-950 font-semibold text-xs shadow-xl border border-amber-300/60 hover:border-amber-200 flex items-center gap-1.5 transition-colors">
          <span class="hotspot-chevron-anim text-amber-300 group-hover:text-stone-950 text-[10px]">▲</span>
          <span class="whitespace-nowrap">${this.escapeHtml(portal.shortLabel)}</span>
        </span>
      `;
      hsBtn.onclick = (e) => {
        e.stopPropagation();
        this.audioManager.playInteractionChime('portal');
        this.sceneScript.triggerRoomTransition(
          portal.targetRoom,
          portal.yaw,
          portal.entryYaw,
        );
      };
    }
  }

  public updatePins(
    artworkPins: PinScreenPosition[],
    hotspotPins: HotspotScreenPosition[],
    cameraTelemetry?: {
      yaw: number;
      pitch: number;
      bloomStrength: number;
      repositoryPin?: RepositoryPinScreenPosition;
    },
  ) {
    const state = galleryStore.getState();

    if (cameraTelemetry && cameraTelemetry.yaw !== this.liveYaw) {
      this.liveYaw = cameraTelemetry.yaw;
      this.livePitch = cameraTelemetry.pitch;
      this.liveBloom = cameraTelemetry.bloomStrength;
      const compassEl = this.bottomRightInfoLayer.querySelector('#live-compass-readout');
      if (compassEl) {
        compassEl.textContent = `${this.liveYaw}°`;
      }
      if (!state.hudCollapsed) {
        const radarCone = this.bottomRightInfoLayer.querySelector(
          '#labyrinth-radar-cone',
        ) as SVGElement | null;
        if (radarCone) {
          radarCone.style.transform = `rotate(${this.liveYaw}deg)`;
        }
      }
    }

    const anyModalOpen =
      Boolean(state.selectedArtworkId) ||
      state.isRepositoryOpen ||
      state.isCartOpen ||
      state.isAdminOpen ||
      state.isAdminDashboardOpen ||
      state.isCodeModalOpen ||
      state.isAiStudioOpen;

    if (anyModalOpen) {
      if (this.pinsLayer.style.display !== 'none') {
        this.pinsLayer.style.display = 'none';
      }
      return;
    } else if (this.pinsLayer.style.display === 'none') {
      this.pinsLayer.style.display = 'block';
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobile = w < 640;
    const isTablet = w >= 640 && w < 1024;
    const pinScale = w < 380 ? 0.82 : isMobile ? 0.88 : isTablet ? 0.94 : 1.0;

    const analogSafeW = isMobile ? 116 : 155;
    const analogSafeH = isMobile ? 116 : 160;
    const brWidth = state.hudCollapsed ? (isMobile ? 54 : 68) : (isMobile ? 240 : 300);
    const brHeight = state.hudCollapsed ? (isMobile ? 54 : 68) : (isMobile ? 268 : 310);
    const topRightSafeW = isMobile ? 185 : 225;
    const topRightSafeH = isMobile ? 54 : 64;

    for (const pin of artworkPins) {
      const el = this.pinElements.get(pin.id);
      if (!el) continue;

      const inBottomLeftAnalog = pin.x < analogSafeW && pin.y > h - analogSafeH;
      const inBottomRightInfo = pin.x > w - brWidth && pin.y > h - brHeight;
      const inTopCorners = pin.y < topRightSafeH && pin.x > w - topRightSafeW;

      if (
        !pin.visible ||
        anyModalOpen ||
        inBottomLeftAnalog ||
        inBottomRightInfo ||
        inTopCorners
      ) {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
        }
      } else {
        if (el.style.display !== 'flex') {
          el.style.display = 'flex';
        }
        el.style.transform = `translate3d(${Math.round(pin.x)}px, ${Math.round(pin.y)}px, 0) translate(-50%, -50%) scale(${pinScale})`;
      }
    }

    // Position the Galeri 3D Pin Button
    if (this.repositoryPinBtn) {
      const rp = cameraTelemetry?.repositoryPin;
      if (!rp) {
        this.repositoryPinBtn.style.display = 'none';
      } else {
        const inBottomLeftAnalog = rp.x < analogSafeW && rp.y > h - analogSafeH;
        const inBottomRightInfo = rp.x > w - brWidth && rp.y > h - brHeight;
        const inTopCorners = rp.y < topRightSafeH && rp.x > w - topRightSafeW;
        if (
          !rp.visible ||
          anyModalOpen ||
          inBottomLeftAnalog ||
          inBottomRightInfo ||
          inTopCorners
        ) {
          if (this.repositoryPinBtn.style.display !== 'none') {
            this.repositoryPinBtn.style.display = 'none';
          }
        } else {
          if (this.repositoryPinBtn.style.display !== 'flex') {
            this.repositoryPinBtn.style.display = 'flex';
          }
          this.repositoryPinBtn.style.transform = `translate3d(${Math.round(rp.x)}px, ${Math.round(rp.y)}px, 0) translate(-50%, -50%) scale(${pinScale})`;
        }
      }
    }

    // Update all Street-View floor portal buttons via GPU translate3d
    const activePortalTargets = new Set<RoomId>();
    for (const hp of hotspotPins) {
      activePortalTargets.add(hp.targetRoom);
      const hsBtn = this.hotspotElements.get(hp.targetRoom);
      if (!hsBtn) continue;

      const inBottomLeftHud = hp.x < analogSafeW + 30 && hp.y > h - (analogSafeH + 25);
      const inBottomRightHud = hp.x > w - (brWidth + 35) && hp.y > h - (brHeight + 20);
      const marginX = isMobile ? 38 : 60;
      const outOfBounds = hp.x < marginX || hp.x > w - marginX || hp.y < 60 || hp.y > h - 30;

      if (!hp.visible || anyModalOpen || inBottomLeftHud || inBottomRightHud || outOfBounds) {
        if (hsBtn.style.display !== 'none') {
          hsBtn.style.display = 'none';
        }
      } else {
        if (hsBtn.style.display !== 'flex') {
          hsBtn.style.display = 'flex';
        }
        hsBtn.style.transform = `translate3d(${Math.round(hp.x)}px, ${Math.round(hp.y - 24)}px, 0) translate(-50%, -50%) scale(${pinScale})`;
      }
    }

    for (const [targetRoom, hsBtn] of this.hotspotElements.entries()) {
      if (!activePortalTargets.has(targetRoom) && hsBtn.style.display !== 'none') {
        hsBtn.style.display = 'none';
      }
    }
  }

  // ─── 2. POJOK KIRI ATAS (KOSONG — JUDUL ATAS "PAMERAN VIRTUAL" DIHAPUS) ────
  private renderTopLeftCorner() {
    this.topLeftLayer.innerHTML = '';
    this.topLeftLayer.className = 'hidden';
  }

  private getVolumeIconSvg(isMuted: boolean, volume: number): string {
    if (isMuted || volume === 0) {
      return `
        <svg class="w-4 h-4 shrink-0 text-white/75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6" />
        </svg>
      `;
    }
    if (volume <= 50) {
      return `
        <svg class="w-4 h-4 shrink-0 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07" />
        </svg>
      `;
    }
    return `
      <svg class="w-4 h-4 shrink-0 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
      </svg>
    `;
  }

  private updateVolumeButtonIcon(isMuted: boolean, volume: number) {
    const btn = this.topRightLayer.querySelector('#btn-volume-popover');
    const iconHolder = this.topRightLayer.querySelector('#vol-btn-icon-holder');
    const tooltipHolder = this.topRightLayer.querySelector('#vol-btn-tooltip');
    const muteBtn = this.topRightLayer.querySelector('#btn-popover-mute-toggle');
    if (iconHolder) {
      iconHolder.innerHTML = this.getVolumeIconSvg(isMuted, volume);
    }
    if (tooltipHolder) {
      tooltipHolder.textContent =
        isMuted || volume === 0 ? 'Volume (Mati)' : `Volume (${volume}%)`;
    }
    if (muteBtn) {
      muteBtn.textContent = isMuted || volume === 0 ? 'Aktifkan' : 'Bisukan';
    }
    if (btn) {
      btn.className = `relative group w-9 h-9 sm:w-10 sm:h-10 rounded-2xl backdrop-blur-md border flex items-center justify-center transition-all shadow-lg cursor-pointer ${
        isMuted || volume === 0
          ? 'bg-black/45 hover:bg-black/70 border-white/25 text-white/75'
          : 'bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-300/75 text-emerald-200'
      }`;
    }
  }

  // ─── 3. POJOK KANAN ATAS (ICON-ONLY BUTTONS + UNIFIED VOLUME CONTROL) ──────
  private renderTopRightCorner() {
    const state = galleryStore.getState();
    const { totalItems } = calculateCartTotals(state.cart);
    const audioProfile = getRoomAudioProfile(state.currentRoom);
    const isMuted = state.audioMuted;
    const volume = state.audioVolume;
    const volumeHoverLabel =
      isMuted || volume === 0 ? 'Volume (Mati)' : `Volume (${volume}%)`;

    this.topRightLayer.innerHTML = `
      <!-- Tombol Icon Galeri -->
      <button
        type="button"
        id="btn-open-repository"
        aria-label="Galeri"
        title="Galeri"
        class="relative group w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-black/45 hover:bg-amber-500/35 backdrop-blur-md border border-white/25 hover:border-amber-300/80 text-amber-200 flex items-center justify-center transition-all shadow-lg cursor-pointer"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <span class="pointer-events-none absolute top-full mt-1.5 right-0 px-2.5 py-1 rounded-lg bg-stone-950/95 border border-white/20 text-[11px] font-medium text-amber-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
          Galeri
        </span>
      </button>

      <!-- Tombol Icon Volume Tunggal (Mengatur Musik Latar & Ambient Sound dengan Volume Slider) -->
      <div class="relative flex items-center">
        <button
          type="button"
          id="btn-volume-popover"
          aria-label="Pengatur Volume Suara"
          aria-expanded="${this.isVolumePopoverOpen ? 'true' : 'false'}"
          title="${this.escapeAttr(`${volumeHoverLabel} — ${audioProfile.title}`)}"
          class="relative group w-9 h-9 sm:w-10 sm:h-10 rounded-2xl backdrop-blur-md border flex items-center justify-center transition-all shadow-lg cursor-pointer ${
            isMuted || volume === 0
              ? 'bg-black/45 hover:bg-black/70 border-white/25 text-white/75'
              : 'bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-300/75 text-emerald-200'
          }"
        >
          <span id="vol-btn-icon-holder" class="flex items-center justify-center">
            ${this.getVolumeIconSvg(isMuted, volume)}
          </span>
          <span id="vol-btn-tooltip" class="pointer-events-none absolute top-full mt-1.5 right-0 px-2.5 py-1 rounded-lg bg-stone-950/95 border border-white/20 text-[11px] font-medium text-emerald-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
            ${this.escapeHtml(volumeHoverLabel)}
          </span>
        </button>

        ${
          this.isVolumePopoverOpen
            ? `
          <div
            id="volume-popover-card"
            class="absolute top-12 right-0 w-56 sm:w-60 p-3.5 rounded-2xl bg-stone-950/95 backdrop-blur-md border border-white/25 text-white shadow-2xl space-y-2.5 z-30"
          >
            <div class="flex items-center justify-between gap-2 text-[11px]">
              <span class="font-semibold text-emerald-300">Volume Musik & Ambient</span>
              <div class="flex items-center gap-1.5">
                <span id="lbl-audio-volume" class="font-mono font-bold tabular-nums text-amber-200">${isMuted || volume === 0 ? 'Mati (0%)' : `${volume}%`}</span>
                <button
                  type="button"
                  id="btn-popover-mute-toggle"
                  class="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-white/90 transition-colors cursor-pointer"
                >
                  ${isMuted || volume === 0 ? 'Aktifkan' : 'Bisukan'}
                </button>
              </div>
            </div>
            <input
              id="inp-audio-volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value="${isMuted ? 0 : volume}"
              aria-label="Volume Akustik Galeri"
              class="w-full accent-emerald-400 cursor-pointer"
            />
            <div class="flex items-center justify-between text-[10px] text-white/70">
              <span class="truncate">♪ ${this.escapeHtml(audioProfile.title)}</span>
              <span class="text-emerald-300/80 shrink-0 ml-1">360° Spatial</span>
            </div>
          </div>
        `
            : ''
        }
      </div>

      <!-- Tombol Icon Keranjang (Hanya Icon + Badge + Hover Nama Tombol) -->
      <button
        type="button"
        id="nav-open-cart"
        aria-label="Keranjang (${totalItems})"
        title="Keranjang (${totalItems})"
        class="relative group w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/30 hover:bg-amber-500/50 backdrop-blur-md border border-amber-300/80 text-amber-100 flex items-center justify-center transition-all shadow-lg cursor-pointer"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
          <circle cx="9" cy="21" r="1.5" />
          <circle cx="19" cy="21" r="1.5" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
        </svg>
        ${
          totalItems > 0
            ? `<span id="cart-icon-badge" class="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-stone-950 font-mono font-bold text-[10px] flex items-center justify-center shadow">
                ${totalItems}
              </span>`
            : ''
        }
        <span class="pointer-events-none absolute top-full mt-1.5 right-0 px-2.5 py-1 rounded-lg bg-stone-950/95 border border-white/20 text-[11px] font-medium text-amber-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
          Keranjang (${totalItems})
        </span>
      </button>

      <!-- Tombol Icon STARLA BUDAYA v.0.2.3 (Berisi Pengaturan Publik & Masuk dengan Google) -->
      <button
        type="button"
        id="nav-open-admin"
        aria-label="STARLA BUDAYA v.0.2.3"
        title="STARLA BUDAYA v.0.2.3"
        class="relative group w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/25 hover:border-amber-300/70 text-white/95 flex items-center justify-center transition-all shadow-lg cursor-pointer"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span class="pointer-events-none absolute top-full mt-1.5 right-0 px-2.5 py-1 rounded-lg bg-stone-950/95 border border-white/20 text-[11px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
          STARLA BUDAYA v.0.2.3
        </span>
      </button>
    `;

    this.topRightLayer
      .querySelector('#btn-open-repository')
      ?.addEventListener('click', () => {
        this.audioManager.playInteractionChime('modalOpen');
        galleryStore.getState().setRepositoryOpen(true);
      });

    this.topRightLayer
      .querySelector('#btn-volume-popover')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioManager.playInteractionChime('click');
        this.isVolumePopoverOpen = !this.isVolumePopoverOpen;
        this.renderTopRightCorner();
      });

    this.topRightLayer
      .querySelector('#btn-popover-mute-toggle')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        const st = galleryStore.getState();
        const nextMuted = !st.audioMuted && st.audioVolume > 0;
        if (nextMuted) {
          st.setAudioMuted(true);
        } else {
          st.setAudioMuted(false);
          if (st.audioVolume === 0) {
            st.setAudioVolume(70);
          }
          this.audioManager.playInteractionChime('click');
        }
      });

    const volInput = this.topRightLayer.querySelector(
      '#inp-audio-volume',
    ) as HTMLInputElement | null;
    volInput?.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = Number(volInput.value);
      galleryStore.getState().setAudioVolume(val);
    });

    this.topRightLayer
      .querySelector('#nav-open-admin')
      ?.addEventListener('click', () => {
        this.audioManager.playInteractionChime('click');
        galleryStore.getState().setAdminOpen(true);
      });

    this.topRightLayer
      .querySelector('#nav-open-cart')
      ?.addEventListener('click', () => {
        this.audioManager.playInteractionChime('modalOpen');
        galleryStore.getState().setCartOpen(true);
      });
  }

  // ─── 4. POJOK KIRI BAWAH (CLEAN & PROFESSIONAL 360° ANALOG CONTROLLER) ─────
  private renderBottomLeftAnalog() {
    this.bottomLeftAnalogLayer.innerHTML = `
      <div class="flex flex-col items-center">
        <div
          id="ml-analog-pad"
          role="application"
          aria-label="Analog Navigasi Kamera 360 Derajat"
          class="group relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-stone-950/60 hover:bg-stone-950/75 backdrop-blur-xl border border-white/15 hover:border-white/25 shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center touch-none cursor-grab active:cursor-grabbing transition-colors"
        >
          <!-- Subtle Precision Orbit Track & Axis Ticks -->
          <div class="pointer-events-none absolute inset-2.5 sm:inset-3 rounded-full border border-white/[0.08]"></div>
          <div class="pointer-events-none absolute inset-6 sm:inset-8 rounded-full border border-dashed border-white/[0.06]"></div>
          <div class="pointer-events-none absolute inset-x-3.5 sm:inset-x-4 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"></div>
          <div class="pointer-events-none absolute inset-y-3.5 sm:inset-y-4 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent"></div>

          <!-- Clean SVG Cardinal Directional Buttons -->
          <button
            type="button"
            id="analog-tap-up"
            aria-label="Arahkan Pandangan ke Atas"
            title="Pandangan Atas"
            class="absolute top-1 sm:top-1.5 left-1/2 -translate-x-1/2 w-6 h-5 sm:w-7 sm:h-6 rounded-full flex items-center justify-center text-white/55 hover:text-amber-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            id="analog-tap-down"
            aria-label="Arahkan Pandangan ke Bawah"
            title="Pandangan Bawah"
            class="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-5 sm:w-7 sm:h-6 rounded-full flex items-center justify-center text-white/55 hover:text-amber-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            id="analog-tap-left"
            aria-label="Putar Kamera ke Kiri"
            title="Putar Kiri"
            class="absolute left-1 sm:left-1.5 top-1/2 -translate-y-1/2 w-5 h-6 sm:w-6 sm:h-7 rounded-full flex items-center justify-center text-white/55 hover:text-amber-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            id="analog-tap-right"
            aria-label="Putar Kamera ke Kanan"
            title="Putar Kanan"
            class="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 w-5 h-6 sm:w-6 sm:h-7 rounded-full flex items-center justify-center text-white/55 hover:text-amber-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <!-- Tactile Floating Center Puck -->
          <div
            id="ml-analog-knob"
            class="pointer-events-none w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-full bg-gradient-to-b from-stone-800/95 to-stone-950/95 border border-white/25 group-hover:border-amber-300/60 shadow-[0_6px_16px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.25)] flex items-center justify-center transition-transform duration-75"
          >
            <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/15 flex items-center justify-center bg-stone-900/80">
              <div class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachAnalogJoystickEvents();
  }

  private attachAnalogJoystickEvents() {
    const pad = this.bottomLeftAnalogLayer.querySelector(
      '#ml-analog-pad',
    ) as HTMLElement | null;
    const knob = this.bottomLeftAnalogLayer.querySelector(
      '#ml-analog-knob',
    ) as HTMLElement | null;

    if (pad && knob) {
      const updateStickFromPointer = (clientX: number, clientY: number) => {
        const dx = clientX - this.analogCenterX;
        const dy = clientY - this.analogCenterY;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, this.analogMaxRadius);
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * clampedDist;
        const ky = Math.sin(angle) * clampedDist;

        knob.style.transition = 'none';
        knob.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;

        const normX = kx / this.analogMaxRadius;
        const normY = ky / this.analogMaxRadius;
        this.sceneScript.setAnalogInput(normX, normY);
      };

      const resetStick = () => {
        this.analogActive = false;
        this.analogPointerId = null;
        knob.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)';
        knob.style.transform = 'translate3d(0px, 0px, 0)';
        this.sceneScript.setAnalogInput(0, 0);
      };

      pad.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('button')) return;
        e.stopPropagation();
        const rect = pad.getBoundingClientRect();
        this.analogCenterX = rect.left + rect.width / 2;
        this.analogCenterY = rect.top + rect.height / 2;
        this.analogMaxRadius = Math.max(24, Math.round(rect.width * 0.33));
        this.analogActive = true;
        this.analogPointerId = e.pointerId;
        pad.setPointerCapture?.(e.pointerId);
        updateStickFromPointer(e.clientX, e.clientY);
      });

      pad.addEventListener('pointermove', (e) => {
        if (!this.analogActive || e.pointerId !== this.analogPointerId) return;
        e.stopPropagation();
        updateStickFromPointer(e.clientX, e.clientY);
      });

      pad.addEventListener('pointerup', (e) => {
        if (e.pointerId !== this.analogPointerId) return;
        e.stopPropagation();
        resetStick();
      });

      pad.addEventListener('pointercancel', () => {
        resetStick();
      });
    }

    this.bottomLeftAnalogLayer
      .querySelector('#analog-tap-left')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sceneScript.adjustCameraYaw(-28);
      });
    this.bottomLeftAnalogLayer
      .querySelector('#analog-tap-right')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sceneScript.adjustCameraYaw(28);
      });
    this.bottomLeftAnalogLayer
      .querySelector('#analog-tap-up')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sceneScript.adjustCameraPitch(12);
      });
    this.bottomLeftAnalogLayer
      .querySelector('#analog-tap-down')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sceneScript.adjustCameraPitch(-12);
      });
  }

  // ─── 5. POJOK KANAN BAWAH (DENAH HANYA ICON + R1-R5 DI DALAM POP-UP DENAH) ──
  private renderBottomRightInfo() {
    const state = galleryStore.getState();
    const activeRoom = ROOMS[state.currentRoom] || ROOMS.ruang_1;
    const audioProfile = getRoomAudioProfile(state.currentRoom);
    const roomArtworks = filterArtworks(
      state.artworks,
      state.currentRoom,
      state.levelFilter,
      state.categoryFilter,
      state.searchQuery,
    );

    if (state.hudCollapsed) {
      this.bottomRightInfoLayer.innerHTML = `
        <button
          type="button"
          id="btn-toggle-dock"
          aria-expanded="false"
          aria-label="Denah Ruangan (${activeRoom.code})"
          title="Denah Ruangan (${activeRoom.code} · ${this.escapeAttr(activeRoom.shortName)})"
          class="relative group w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-black/45 hover:bg-amber-500/35 backdrop-blur-md border border-white/25 hover:border-amber-300/80 text-amber-300 flex items-center justify-center transition-all shadow-xl cursor-pointer"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <span class="pointer-events-none absolute bottom-full mb-1.5 right-0 px-2.5 py-1 rounded-lg bg-stone-950/95 border border-white/20 text-[11px] font-medium text-amber-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
            Denah (${activeRoom.code})
          </span>
        </button>
      `;
      this.bottomRightInfoLayer
        .querySelector('#btn-toggle-dock')
        ?.addEventListener('click', () => {
          galleryStore.getState().setHudCollapsed(false);
        });
      return;
    }

    this.bottomRightInfoLayer.innerHTML = `
      <div class="flex flex-col items-end gap-2">
        <!-- Pop-Up Denah Ruangan (Berisi R1-R5, Denah Interaktif & Daftar Karya Ruangan) -->
        <div
          id="labyrinth-popover-card"
          class="w-[232px] sm:w-[288px] max-w-[calc(100vw-124px)] p-3 sm:p-3.5 rounded-2xl bg-stone-950/95 backdrop-blur-md border border-white/25 text-white/95 shadow-2xl space-y-2.5"
        >
          <!-- Header: Active Room + Compass + Close -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-amber-300 truncate">
                ${this.escapeHtml(activeRoom.name)}
              </div>
              <div class="text-[10px] text-white/75 flex items-center gap-1.5">
                <span>Denah 5 Ruang</span>
                <span>·</span>
                <span id="live-compass-readout" class="font-mono tabular-nums text-amber-200">${this.liveYaw}°</span>
              </div>
              <div id="room-audio-indicator" class="text-[9px] text-emerald-300/90 truncate mt-0.5">
                ♪ ${this.escapeHtml(audioProfile.title)}
              </div>
            </div>
            <button
              type="button"
              id="btn-close-dock"
              aria-label="Tutup Denah"
              class="w-7 h-7 rounded-lg bg-white/10 hover:bg-rose-600/80 border border-white/20 text-xs text-white/90 flex items-center justify-center shrink-0 transition-colors"
            >
              ✕
            </button>
          </div>

          <!-- Bar Pilihan Ruangan R1 - R5 (Dipindahkan ke Dalam Pop-Up Denah) -->
          <div
            class="grid grid-cols-5 gap-1 p-1 rounded-xl bg-stone-900/95 border border-white/15"
            role="navigation"
            aria-label="Pilih Ruangan R1 sampai R5"
          >
            ${ROOM_LIST.map((r) => {
              const active = state.currentRoom === r.id;
              return `
                <button
                  type="button"
                  data-room-switch="${r.id}"
                  title="${this.escapeAttr(r.name)}"
                  class="py-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
                    active
                      ? 'bg-amber-400 text-stone-950 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }"
                >
                  ${r.code}
                </button>
              `;
            }).join('')}
          </div>

          <!-- Architectural Labyrinth Floorplan SVG + Clickable Room Nodes -->
          <div
            id="labyrinth-floorplan"
            class="relative w-full h-[136px] rounded-xl bg-stone-900/90 border border-white/15 overflow-hidden"
          >
            <svg viewBox="0 0 100 100" class="w-full h-full">
              <rect x="4" y="4" width="92" height="92" rx="6" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
              <path
                d="M 4 32 L 34 32 M 66 32 L 96 32 M 32 4 L 32 22 M 68 4 L 68 22 M 32 68 L 32 96 M 68 68 L 68 96 M 28 68 L 42 68 M 58 68 L 72 68"
                stroke="rgba(255,255,255,0.18)"
                stroke-width="1.4"
                stroke-linecap="round"
              />
              <path
                d="M 50 84 L 50 50 M 50 84 L 16 66 L 16 50 M 50 84 L 84 66 L 84 50"
                fill="none"
                stroke="rgba(251,191,36,0.35)"
                stroke-width="1.6"
                stroke-dasharray="2.5 2"
              />
              <path
                d="M 16 50 L 50 50 L 84 50 M 50 50 L 50 16 M 16 50 L 16 16 L 50 16 M 84 50 L 84 16 L 50 16"
                fill="none"
                stroke="rgba(251,191,36,0.42)"
                stroke-width="1.6"
              />
              <g transform="translate(${activeRoom.mapX}, ${activeRoom.mapY})">
                <g id="labyrinth-radar-cone" style="transform: rotate(${this.liveYaw}deg); transform-origin: 0px 0px;">
                  <polygon
                    points="0,0 -12,-22 12,-22"
                    fill="rgba(251,191,36,0.32)"
                    stroke="rgba(251,191,36,0.75)"
                    stroke-width="0.6"
                  />
                </g>
              </g>
            </svg>

            ${ROOM_LIST.map((r) => {
              const isCurr = r.id === state.currentRoom;
              return `
                <button
                  type="button"
                  id="minimap-node-${r.id}"
                  data-labyrinth-room="${r.id}"
                  title="Pindah ke ${this.escapeAttr(r.name)}"
                  style="left: ${r.mapX}%; top: ${r.mapY}%;"
                  class="-translate-x-1/2 -translate-y-1/2 absolute px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    isCurr
                      ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)] scale-110 z-10'
                      : 'bg-stone-900/90 hover:bg-stone-800 text-white/90 border border-white/30 hover:border-amber-300'
                  }"
                >
                  ${r.code}
                </button>
              `;
            }).join('')}
          </div>

          <!-- Quick Artwork Pills in Current Room (Scrollable without visible scrollbar) -->
          <div class="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            ${roomArtworks
              .map(
                (art) => `
              <button
                type="button"
                data-quick-artwork="${art.id}"
                class="shrink-0 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 hover:border-emerald-300/70 text-[10px] text-white truncate max-w-[130px] transition-all"
              >
                ${this.escapeHtml(shortPinTitle(art))}
              </button>
            `,
              )
              .join('')}
          </div>
        </div>

        <!-- Tombol Denah Hanya Icon (Saat Pop-up Terbuka) -->
        <button
          type="button"
          id="btn-toggle-dock"
          aria-expanded="true"
          aria-label="Tutup Denah Ruangan"
          title="Tutup Denah Ruangan"
          class="relative group w-10 h-10 rounded-2xl bg-amber-500/35 hover:bg-amber-500/50 backdrop-blur-md border border-amber-300/80 text-amber-100 flex items-center justify-center transition-all shadow-xl"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </button>
      </div>
    `;

    const collapseFn = () => {
      galleryStore.getState().setHudCollapsed(true);
    };

    this.bottomRightInfoLayer
      .querySelector('#btn-toggle-dock')
      ?.addEventListener('click', collapseFn);

    this.bottomRightInfoLayer
      .querySelector('#btn-close-dock')
      ?.addEventListener('click', collapseFn);

    this.bottomRightInfoLayer
      .querySelectorAll('[data-room-switch]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-room-switch') as RoomId | null;
          if (target) {
            this.audioManager.playInteractionChime('portal');
            this.sceneScript.triggerRoomTransition(target);
          }
        });
      });

    this.bottomRightInfoLayer
      .querySelectorAll('[data-labyrinth-room]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-labyrinth-room') as RoomId | null;
          if (target) {
            this.audioManager.playInteractionChime('portal');
            this.sceneScript.triggerRoomTransition(target);
          }
        });
      });

    this.bottomRightInfoLayer
      .querySelectorAll('[data-quick-artwork]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-quick-artwork');
          const art = galleryStore.getState().artworks.find((a) => a.id === id);
          if (art) {
            galleryStore.getState().setHudCollapsed(true);
            this.audioManager.playInteractionChime('focus');
            this.showToast(`Memfokuskan kamera ke "${art.title}"...`);
            this.sceneScript.focusCameraOnArtwork(art, {
              durationMs: 560,
              onComplete: () => {
                galleryStore.getState().selectArtwork(art.id);
              },
            });
          }
        });
      });
  }

  // ─── 6. ARTWORK DETAIL MODAL, GALERI MODAL & CART DRAWER ───────────────────
  private renderModals() {
    const state = galleryStore.getState();
    const selectedArt = state.selectedArtworkId
      ? resolveGalleryArtwork(state.selectedArtworkId, state.artworks)
      : null;

    if (selectedArt) {
      this.renderArtworkDetailModal(selectedArt);
    } else if (state.isRepositoryOpen) {
      this.renderRepositoryModal();
    } else if (state.isCartOpen) {
      this.renderCartDrawer();
    } else {
      this.modalLayer.innerHTML = '';
    }
  }

  // ─── MODAL GALERI (DENGAN TOMBOL KARYA UNTUK MEMBUKA POP-UP KARYA) ─────────
  private renderRepositoryModal() {
    const state = galleryStore.getState();
    const repoItems = getRepositoryList(state.artworks);

    this.modalLayer.innerHTML = `
      <div
        data-ui-interactive="true"
        id="repository-modal-backdrop"
        class="fixed inset-0 z-[260] pointer-events-auto flex items-center justify-center bg-black/80 p-3 sm:p-4 select-text"
      >
        <article
          id="repository-modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Galeri Daftar Karya"
          class="pointer-events-auto w-full max-w-2xl max-h-[88vh] rounded-2xl bg-stone-950 border border-white/20 text-stone-100 shadow-2xl overflow-hidden flex flex-col"
        >
          <!-- Header Galeri -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/95">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <div>
                <h2 class="text-base font-bold text-white tracking-tight">
                  Galeri
                </h2>
                <p class="text-xs text-stone-400">
                  Koleksi Karya Nusantara (${repoItems.length} Karya) — Klik tombol Karya untuk membuka detail
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-close-repository"
              aria-label="Tutup Galeri"
              title="Tutup"
              class="w-9 h-9 rounded-full bg-stone-800 hover:bg-rose-600/90 border border-white/20 text-white flex items-center justify-center transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          <!-- Header Kolom Tabel: Nama Karya | Jenis Karya | Nama Pencipta | Karya & Tautan -->
          <div class="grid grid-cols-12 gap-2 px-5 py-2.5 bg-stone-900/70 border-b border-stone-800 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            <div class="col-span-4">Nama Karya</div>
            <div class="col-span-3">Jenis Karya</div>
            <div class="col-span-3">Nama Pencipta</div>
            <div class="col-span-2 text-right">Aksi</div>
          </div>

          <!-- Daftar Isi Galeri (Scrollable tanpa tanda scroll, dengan Tombol Karya & Tautan Icon) -->
          <div id="repository-items-list" class="no-scrollbar flex-1 overflow-y-auto divide-y divide-stone-800/80">
            ${repoItems
              .map(
                (item) => `
              <div
                data-repo-row="${this.escapeAttr(item.id)}"
                class="grid grid-cols-12 gap-2 items-center px-5 py-3 hover:bg-stone-900/80 transition-colors"
              >
                <div class="col-span-4 text-xs sm:text-sm font-semibold text-white truncate" title="${this.escapeAttr(item.title)}">
                  ${this.escapeHtml(item.title)}
                </div>
                <div class="col-span-3 text-xs text-emerald-300 truncate" title="${this.escapeAttr(item.kind)}">
                  ${this.escapeHtml(item.kind)}
                </div>
                <div class="col-span-3 text-xs text-stone-300 truncate" title="${this.escapeAttr(item.creator)}">
                  ${this.escapeHtml(item.creator)}
                </div>
                <div class="col-span-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    data-open-repo-artwork="${this.escapeAttr(item.linkedArtworkId || item.id)}"
                    aria-label="Lihat Karya ${this.escapeAttr(item.title)}"
                    title="Buka Pop-Up Karya"
                    class="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] flex items-center gap-1 transition-all shadow-sm shrink-0"
                  >
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Karya</span>
                  </button>
                  <a
                    href="${this.escapeAttr(item.linkUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-repo-link="${this.escapeAttr(item.id)}"
                    aria-label="Tautan Karya ${this.escapeAttr(item.title)}"
                    title="Buka Tautan Karya"
                    class="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-amber-200 flex items-center justify-center transition-all shrink-0"
                  >
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                  </a>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        </article>
      </div>
    `;

    const backdropEl = this.modalLayer.querySelector(
      '#repository-modal-backdrop',
    ) as HTMLElement | null;
    const dialogEl = this.modalLayer.querySelector(
      '#repository-modal-dialog',
    ) as HTMLElement | null;

    for (const evtName of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      backdropEl?.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }
    dialogEl?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const closeRepo = (e?: Event) => {
      e?.preventDefault();
      e?.stopPropagation();
      galleryStore.getState().setRepositoryOpen(false);
    };

    this.modalLayer
      .querySelector('#btn-close-repository')
      ?.addEventListener('click', closeRepo);

    backdropEl?.addEventListener('click', (e) => {
      if (e.target === backdropEl) {
        closeRepo(e);
      }
    });

    // Click handler for "Karya" button inside Galeri -> Opens Pop-Up Karya
    this.modalLayer
      .querySelectorAll('[data-open-repo-artwork]')
      .forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetId = btn.getAttribute('data-open-repo-artwork');
          if (!targetId) return;
          const st = galleryStore.getState();
          const resolved = resolveGalleryArtwork(targetId, st.artworks);
          if (resolved) {
            const existsInScene = st.artworks.some((a) => a.id === resolved.id);
            if (existsInScene) {
              this.sceneScript.focusCameraOnArtwork(resolved);
            }
            st.selectArtwork(resolved.id);
          }
        });
      });
  }

  // ─── REDESIGNED MINIMALIST MODERN POP-UP KARYA ─────────────────────────────
  // Gambar lebih besar agar fokus, tanpa badge "★ Rak Display · ...",
  // tombol keranjang & whatsapp hanya icon, komentar hanya nama dan pesan,
  // ditambah navigasi smooth transition antar karya di ruang 360°.
  private renderArtworkDetailModal(art: Artwork) {
    const state = galleryStore.getState();
    const previewSrc = getArtworkPreviewDataUrl(art);
    const waUrl = buildWhatsAppUrl(art);
    const comments = getArtworkComments(state.commentsByArtwork, art.id);
    const prevArt = getAdjacentArtworkInRoom(state.artworks, art.id, -1);
    const nextArt = getAdjacentArtworkInRoom(state.artworks, art.id, 1);

    // Pre-fill visitor name from saved Google user profile if available
    if (!this.draftVisitorName) {
      try {
        const savedUser = window.localStorage.getItem('nusantara360_google_curator');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed?.name) this.draftVisitorName = parsed.name;
        }
      } catch {
        // ignore
      }
    }

    const isCuratorComment = (c: ReturnType<typeof getArtworkComments>[number]) =>
      c.visitorName === 'Tim Kurator Pameran Virtual' ||
      c.visitorName.toLowerCase().includes('kurator') ||
      c.id.startsWith('cmt-curator-') ||
      c.id.startsWith('cmt-default-');

    const renderCommentsHtml = (items: ReturnType<typeof getArtworkComments>) =>
      items
        .map((c) => {
          const isCurator = isCuratorComment(c);
          const isEditingThis = this.editingCommentId === c.id;

          if (isEditingThis) {
            return `
              <div
                data-curator-edit-box="${this.escapeAttr(c.id)}"
                class="p-3.5 rounded-xl bg-stone-900/95 border border-amber-400/50 space-y-2.5"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                    <span>✦</span>
                    <span>Edit Ulasan Kurator</span>
                  </span>
                  <span class="text-[10px] text-stone-400">${this.escapeHtml(c.createdAt)}</span>
                </div>
                <div class="space-y-2">
                  <input
                    type="text"
                    data-edit-curator-name="${this.escapeAttr(c.id)}"
                    value="${this.escapeAttr(c.visitorName)}"
                    placeholder="Nama Kurator"
                    class="w-full px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                  <textarea
                    rows="3"
                    data-edit-curator-message="${this.escapeAttr(c.id)}"
                    placeholder="Tulis ulasan kuratorial..."
                    class="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 leading-relaxed focus:border-amber-400 focus:outline-none"
                  >${this.escapeHtml(c.message)}</textarea>
                </div>
                <div class="flex items-center justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    data-cancel-edit-comment="${this.escapeAttr(c.id)}"
                    class="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    data-save-edit-comment="${this.escapeAttr(c.id)}"
                    class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            `;
          }

          return `
            <div class="p-3 rounded-xl ${
              isCurator
                ? 'bg-amber-500/[0.07] border border-amber-400/25'
                : 'bg-stone-900/70 border border-stone-800/80'
            } flex items-start gap-3">
              <div class="w-7 h-7 rounded-full ${
                isCurator
                  ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                  : 'bg-stone-800 border border-stone-700 text-amber-300'
              } text-xs font-bold flex items-center justify-center shrink-0">
                ${this.escapeHtml((c.visitorName || 'P').charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-xs font-semibold text-white truncate">${this.escapeHtml(c.visitorName)}</span>
                    ${
                      isCurator
                        ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-[9px] font-semibold text-amber-300 shrink-0">Kurator</span>`
                        : ''
                    }
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[10px] text-stone-500">${this.escapeHtml(c.createdAt)}</span>
                    ${
                      isCurator
                        ? `<button
                            type="button"
                            data-edit-curator-comment="${this.escapeAttr(c.id)}"
                            aria-label="Edit Ulasan Kurator"
                            title="Edit Ulasan Kurator"
                            class="px-2 py-0.5 rounded-md bg-stone-800/90 hover:bg-amber-500/20 border border-stone-700 hover:border-amber-400/50 text-[10px] font-medium text-stone-300 hover:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Edit</span>
                          </button>`
                        : ''
                    }
                  </div>
                </div>
                <p class="text-xs text-stone-300 leading-relaxed">${this.escapeHtml(c.message)}</p>
              </div>
            </div>
          `;
        })
        .join('');

    this.modalLayer.innerHTML = `
      <div
        data-ui-interactive="true"
        id="artwork-modal-backdrop"
        class="fixed inset-0 z-[260] pointer-events-auto flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 select-text"
      >
        <article
          id="artwork-modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Detail Karya ${this.escapeAttr(art.title)}"
          class="pointer-events-auto w-full max-w-2xl max-h-[92vh] rounded-3xl bg-stone-950 border border-white/15 text-stone-100 shadow-2xl overflow-hidden flex flex-col"
        >
          <!-- Gambar Karya Ukuran Besar agar Fokus (Tanpa teks badge di atas gambar) -->
          <div class="relative w-full h-64 sm:h-80 shrink-0 bg-stone-900 overflow-hidden border-b border-stone-800/80">
            <img
              id="modal-artwork-image"
              src="${previewSrc}"
              alt="Foto Karya ${this.escapeAttr(art.title)}"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent pointer-events-none"></div>

            ${
              prevArt && prevArt.id !== art.id
                ? `
              <button
                type="button"
                id="btn-prev-artwork"
                aria-label="Fokus ke Karya Sebelumnya (${this.escapeAttr(prevArt.title)})"
                title="Transisi Kamera ke ${this.escapeAttr(prevArt.title)}"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 hover:bg-amber-500 backdrop-blur-md border border-white/25 hover:border-amber-300 text-white hover:text-stone-950 flex items-center justify-center transition-all shadow-lg cursor-pointer"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            `
                : ''
            }

            ${
              nextArt && nextArt.id !== art.id
                ? `
              <button
                type="button"
                id="btn-next-artwork"
                aria-label="Fokus ke Karya Berikutnya (${this.escapeAttr(nextArt.title)})"
                title="Transisi Kamera ke ${this.escapeAttr(nextArt.title)}"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 hover:bg-amber-500 backdrop-blur-md border border-white/25 hover:border-amber-300 text-white hover:text-stone-950 flex items-center justify-center transition-all shadow-lg cursor-pointer"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
                </svg>
              </button>
            `
                : ''
            }

            <!-- Tombol Tutup Minimalis (Close Icon Button) -->
            <button
              type="button"
              id="btn-close-artwork-modal"
              aria-label="Tutup Pop Up Karya"
              title="Tutup"
              class="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/65 hover:bg-rose-600/90 backdrop-blur-md border border-white/25 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          <!-- Area Scrollable Minimalis & Profesional (Tanpa Tanda Scrollbar) -->
          <div class="no-scrollbar flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <!-- Baris Header Karya + Tombol Keranjang & WhatsApp Hanya Icon -->
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 space-y-1">
                <h2 id="modal-artwork-title" class="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
                  ${this.escapeHtml(art.title)}
                </h2>
                <div class="text-xs text-stone-400">
                  <span class="text-stone-200 font-medium">${this.escapeHtml(art.creator)}</span> · ${this.escapeHtml(art.school)}
                </div>
                <div class="text-sm font-bold font-mono tabular-nums text-amber-400 pt-0.5">
                  ${formatIDR(art.price)}
                </div>
              </div>

              <!-- Tombol Aksi Hanya Icon (Keranjang & WhatsApp) -->
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-modal-add-cart"
                  aria-label="Tambah ke Keranjang"
                  title="Tambah ke Keranjang"
                  class="relative group w-11 h-11 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center transition-all shadow-md cursor-pointer"
                >
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="9" cy="21" r="1.5" />
                    <circle cx="19" cy="21" r="1.5" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                  </svg>
                </button>

                <a
                  href="${waUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  id="btn-modal-whatsapp"
                  aria-label="Hubungi Pencipta via WhatsApp"
                  title="Hubungi via WhatsApp"
                  class="relative group w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md"
                >
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.25-5.01-4.45-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.82 2.01.89 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.72-.17 1.4z"/>
                  </svg>
                </a>
              </div>
            </div>

            <!-- Deskripsi Karya Minimalis -->
            <p id="modal-artwork-description" class="text-xs sm:text-sm text-stone-300 leading-relaxed">
              ${this.escapeHtml(art.description)}
            </p>

            <!-- Komentar Apresiasi Minimalis (Hanya Nama dan Pesan) -->
            <section
              id="artwork-comments-section"
              aria-label="Komentar Apresiasi"
              class="pt-4 border-t border-stone-800/80 space-y-3"
            >
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Komentar Apresiasi
                </h3>
                <span id="comment-count-badge" class="text-[11px] font-mono text-stone-400">
                  ${comments.length} Komentar
                </span>
              </div>

              <!-- Form Komentar Minimalis: Hanya Nama & Pesan -->
              <form id="form-artwork-comment" class="flex flex-col sm:flex-row gap-2">
                <input
                  id="comment-visitor-name"
                  type="text"
                  required
                  value="${this.escapeAttr(this.draftVisitorName)}"
                  placeholder="Nama Anda"
                  class="sm:w-44 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none"
                />
                <div class="flex-1 flex gap-2">
                  <input
                    id="comment-message-input"
                    type="text"
                    required
                    placeholder="Tulis pesan apresiasi..."
                    class="flex-1 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    id="btn-submit-comment"
                    class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shrink-0 transition-colors"
                  >
                    Kirim
                  </button>
                </div>
              </form>

              <!-- Daftar Komentar Minimalis (Hanya Nama & Pesan, Tanpa Tanda Scroll) -->
              <div id="artwork-comments-list" class="no-scrollbar space-y-2 max-h-44 overflow-y-auto">
                ${renderCommentsHtml(comments)}
              </div>
            </section>
          </div>
        </article>
      </div>
    `;

    const backdropEl = this.modalLayer.querySelector(
      '#artwork-modal-backdrop',
    ) as HTMLElement | null;
    const dialogEl = this.modalLayer.querySelector(
      '#artwork-modal-dialog',
    ) as HTMLElement | null;
    const modalImgEl = this.modalLayer.querySelector(
      '#modal-artwork-image',
    ) as HTMLImageElement | null;
    if (modalImgEl) {
      modalImgEl.addEventListener('error', () => {
        const fallbackUrl = getDefaultArtworkImageUrl(art);
        if (modalImgEl.src && !modalImgEl.src.endsWith(fallbackUrl)) {
          modalImgEl.src = fallbackUrl;
        }
      });
    }

    for (const evtName of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      backdropEl?.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }
    dialogEl?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const closeHandler = (e?: Event) => {
      e?.preventDefault();
      e?.stopPropagation();
      galleryStore.getState().selectArtwork(null);
    };

    const triggerSmoothCameraTransitionToArtwork = (targetArt: Artwork) => {
      galleryStore.getState().selectArtwork(null);
      this.audioManager.playInteractionChime('focus');
      this.showToast(`Memindahkan fokus kamera ke "${targetArt.title}"...`);
      this.sceneScript.focusCameraOnArtwork(targetArt, {
        durationMs: 560,
        onComplete: () => {
          galleryStore.getState().selectArtwork(targetArt.id);
        },
      });
    };

    if (prevArt && prevArt.id !== art.id) {
      this.modalLayer
        .querySelector('#btn-prev-artwork')
        ?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerSmoothCameraTransitionToArtwork(prevArt);
        });
    }

    if (nextArt && nextArt.id !== art.id) {
      this.modalLayer
        .querySelector('#btn-next-artwork')
        ?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerSmoothCameraTransitionToArtwork(nextArt);
        });
    }

    this.modalLayer
      .querySelector('#btn-close-artwork-modal')
      ?.addEventListener('click', closeHandler);

    backdropEl?.addEventListener('click', (e) => {
      if (e.target === backdropEl) {
        closeHandler(e);
      }
    });

    this.modalLayer
      .querySelector('#btn-modal-add-cart')
      ?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        galleryStore.getState().addToCart(art);
        this.audioManager.playInteractionChime('cart');
        this.showToast(`"${art.title}" ditambahkan ke Keranjang.`);
      });

    const commentForm = this.modalLayer.querySelector(
      '#form-artwork-comment',
    ) as HTMLFormElement | null;
    commentForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nameEl = this.modalLayer.querySelector(
        '#comment-visitor-name',
      ) as HTMLInputElement | null;
      const msgEl = this.modalLayer.querySelector(
        '#comment-message-input',
      ) as HTMLInputElement | null;

      const visitorName = nameEl?.value.trim() || 'Pengunjung';
      const message = msgEl?.value.trim() || '';

      const check = validateCommentInput(visitorName, message);
      if (!check.valid) {
        this.showToast(check.error || 'Mohon lengkapi nama dan pesan apresiasi.');
        return;
      }

      this.draftVisitorName = visitorName;

      galleryStore.getState().addArtworkComment(art.id, {
        visitorName,
        message,
      });
      this.audioManager.playInteractionChime('cart');
      this.showToast(`Terima kasih ${visitorName}! Komentar Anda telah ditambahkan.`);

      const updatedComments = getArtworkComments(
        galleryStore.getState().commentsByArtwork,
        art.id,
      );
      const listEl = this.modalLayer.querySelector('#artwork-comments-list');
      if (listEl) {
        listEl.innerHTML = renderCommentsHtml(updatedComments);
        listEl.scrollTop = 0;
      }
      const badgeCountEl = this.modalLayer.querySelector('#comment-count-badge');
      if (badgeCountEl) {
        badgeCountEl.textContent = `${updatedComments.length} Komentar`;
      }
      if (msgEl) {
        msgEl.value = '';
        msgEl.focus();
      }
    });

    const commentsListEl = this.modalLayer.querySelector(
      '#artwork-comments-list',
    ) as HTMLElement | null;
    const refreshCommentsList = () => {
      if (!commentsListEl) return;
      const updated = getArtworkComments(
        galleryStore.getState().commentsByArtwork,
        art.id,
      );
      commentsListEl.innerHTML = renderCommentsHtml(updated);
      const badgeCountEl = this.modalLayer.querySelector('#comment-count-badge');
      if (badgeCountEl) {
        badgeCountEl.textContent = `${updated.length} Komentar`;
      }
    };

    commentsListEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const editBtn = target.closest(
        '[data-edit-curator-comment]',
      ) as HTMLElement | null;
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        const commentId = editBtn.getAttribute('data-edit-curator-comment');
        if (commentId) {
          this.editingCommentId = commentId;
          this.audioManager.playInteractionChime('click');
          refreshCommentsList();
        }
        return;
      }

      const cancelBtn = target.closest(
        '[data-cancel-edit-comment]',
      ) as HTMLElement | null;
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.editingCommentId = null;
        this.audioManager.playInteractionChime('click');
        refreshCommentsList();
        return;
      }

      const saveBtn = target.closest(
        '[data-save-edit-comment]',
      ) as HTMLElement | null;
      if (saveBtn) {
        e.preventDefault();
        e.stopPropagation();
        const commentId = saveBtn.getAttribute('data-save-edit-comment');
        if (!commentId) return;

        const nameInput = commentsListEl.querySelector(
          `[data-edit-curator-name="${commentId}"]`,
        ) as HTMLInputElement | null;
        const msgInput = commentsListEl.querySelector(
          `[data-edit-curator-message="${commentId}"]`,
        ) as HTMLTextAreaElement | null;

        const nextName = nameInput?.value.trim() || 'Tim Kurator Pameran Virtual';
        const nextMsg = msgInput?.value.trim() || '';

        const check = validateCommentInput(nextName, nextMsg);
        if (!check.valid) {
          this.showToast(check.error || 'Ulasan kurator minimal 3 karakter.');
          return;
        }

        galleryStore.getState().updateArtworkComment(art.id, commentId, {
          visitorName: nextName,
          message: nextMsg,
        });
        this.editingCommentId = null;
        this.audioManager.playInteractionChime('cart');
        this.showToast('Ulasan kurator berhasil diperbarui.');
        refreshCommentsList();
      }
    });
  }

  // ─── SHOPPING CART DRAWER ──────────────────────────────────────────────────
  private renderCartDrawer() {
    const state = galleryStore.getState();
    const { totalItems, totalPrice } = calculateCartTotals(state.cart);

    const cartRows = state.cart
      .map((item) => {
        const art = item.artwork;
        return `
          <div class="p-3.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <img
                src="${getArtworkPreviewDataUrl(art)}"
                alt="${this.escapeAttr(art.title)}"
                referrerpolicy="no-referrer"
                class="w-14 h-11 rounded-lg object-cover border border-stone-700 shrink-0"
              />
              <div class="min-w-0">
                <div class="text-[11px] text-emerald-400 truncate">
                  ${this.escapeHtml(art.school)} · ${this.escapeHtml(art.region)}
                </div>
                <div class="text-xs font-semibold text-white truncate">${this.escapeHtml(art.title)}</div>
                <div class="text-xs font-mono tabular-nums text-stone-300">
                  ${formatIDR(art.price)} × ${item.quantity} = <strong class="text-amber-300">${formatIDR(art.price * item.quantity)}</strong>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-cart-dec="${art.id}"
                aria-label="Kurangi jumlah ${this.escapeAttr(art.title)}"
                class="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200"
              >
                −
              </button>
              <span class="w-6 text-center text-xs font-mono tabular-nums">${item.quantity}</span>
              <button
                type="button"
                data-cart-inc="${art.id}"
                aria-label="Tambah jumlah ${this.escapeAttr(art.title)}"
                class="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200"
              >
                +
              </button>
              <button
                type="button"
                data-cart-rm="${art.id}"
                aria-label="Hapus ${this.escapeAttr(art.title)} dari keranjang"
                class="px-2 py-1 rounded-lg bg-stone-800 hover:bg-rose-950 text-xs text-rose-400 ml-1"
              >
                Hapus
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    this.modalLayer.innerHTML = `
      <div
        data-ui-interactive="true"
        id="cart-backdrop"
        class="fixed inset-0 z-[260] pointer-events-auto flex justify-end bg-black/75 select-text"
      >
        <aside
          aria-label="Keranjang Apresiasi"
          class="pointer-events-auto w-full max-w-md h-full bg-stone-950 border-l border-stone-800 text-stone-100 flex flex-col justify-between shadow-2xl"
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900">
            <div>
              <h2 class="text-base font-bold text-amber-400">Keranjang Apresiasi (${totalItems})</h2>
              <p class="text-xs text-stone-400">Dukung langsung karya orisinal pelajar Nusantara</p>
            </div>
            <button
              type="button"
              id="btn-close-cart"
              aria-label="Tutup Keranjang"
              class="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200"
            >
              Tutup ✕
            </button>
          </div>

          <div class="no-scrollbar flex-1 overflow-y-auto p-6 space-y-3">
            ${
              state.cart.length === 0
                ? `<div class="p-8 rounded-2xl bg-stone-900/60 border border-stone-800 text-center space-y-2">
                    <div class="text-sm font-semibold text-stone-200">Keranjang Apresiasi Masih Kosong</div>
                    <p class="text-xs text-stone-400">Klik salah satu pin karya di ruang pameran 360° atau melalui menu Galeri untuk menambahkan karya.</p>
                  </div>`
                : cartRows
            }

            ${
              this.checkoutStatusMsg
                ? `<div role="status" class="p-3 rounded-xl bg-emerald-950 border border-emerald-500/40 text-xs text-emerald-200">
                    ${this.escapeHtml(this.checkoutStatusMsg)}
                  </div>`
                : ''
            }
          </div>

          <div class="p-6 border-t border-stone-800 bg-stone-900/90 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs text-stone-400">Total Apresiasi</span>
              <span class="text-lg font-bold font-mono tabular-nums text-amber-400">${formatIDR(totalPrice)}</span>
            </div>

            ${
              state.cart.length > 0
                ? `
              <form id="form-cart-checkout" class="space-y-2.5">
                <input
                  id="chk-buyer-name"
                  type="text"
                  required
                  value="${this.escapeAttr(this.checkoutName)}"
                  placeholder="Nama Lengkap Kolektor / Apresiator"
                  class="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-700 text-xs text-white"
                />
                <input
                  id="chk-buyer-wa"
                  type="text"
                  required
                  value="${this.escapeAttr(this.checkoutWhatsApp)}"
                  placeholder="Nomor WhatsApp Aktif (Contoh: 08123456789)"
                  class="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-700 text-xs text-white font-mono tabular-nums"
                />
                <div class="flex gap-2 pt-1">
                  <button
                    type="submit"
                    class="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors"
                  >
                    Catat Pesanan & Hubungi via WhatsApp
                  </button>
                  <button
                    type="button"
                    id="btn-clear-cart"
                    class="px-3 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs"
                  >
                    Kosongkan
                  </button>
                </div>
              </form>
            `
                : ''
            }
          </div>
        </aside>
      </div>
    `;

    const cartBackdrop = this.modalLayer.querySelector(
      '#cart-backdrop',
    ) as HTMLElement | null;
    for (const evtName of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      cartBackdrop?.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }

    this.modalLayer
      .querySelector('#btn-close-cart')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.checkoutStatusMsg = '';
        galleryStore.getState().setCartOpen(false);
      });

    cartBackdrop?.addEventListener('click', (e) => {
      if (e.target === cartBackdrop) {
        this.checkoutStatusMsg = '';
        galleryStore.getState().setCartOpen(false);
      }
    });

    this.modalLayer.querySelectorAll('[data-cart-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cart-inc');
        if (id) {
          galleryStore.getState().updateCartQuantity(id, 1);
          this.renderCartDrawer();
        }
      });
    });

    this.modalLayer.querySelectorAll('[data-cart-dec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cart-dec');
        if (id) {
          galleryStore.getState().updateCartQuantity(id, -1);
          this.renderCartDrawer();
        }
      });
    });

    this.modalLayer.querySelectorAll('[data-cart-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cart-rm');
        if (id) {
          galleryStore.getState().removeFromCart(id);
          this.renderCartDrawer();
        }
      });
    });

    this.modalLayer
      .querySelector('#btn-clear-cart')
      ?.addEventListener('click', () => {
        galleryStore.getState().clearCart();
        this.renderCartDrawer();
      });

    const checkoutForm = this.modalLayer.querySelector(
      '#form-cart-checkout',
    ) as HTMLFormElement | null;
    checkoutForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nameInp = this.modalLayer.querySelector(
        '#chk-buyer-name',
      ) as HTMLInputElement | null;
      const waInp = this.modalLayer.querySelector(
        '#chk-buyer-wa',
      ) as HTMLInputElement | null;
      this.checkoutName = nameInp?.value.trim() || 'Kolektor Nusantara';
      this.checkoutWhatsApp = waInp?.value.trim() || '-';

      const st = galleryStore.getState();
      const itemsSummary = st.cart.map(
        (c) => `${c.artwork.title} (${c.quantity}x)`,
      );

      const isStaticHost =
        window.location.hostname.endsWith('.github.io') ||
        window.location.protocol === 'file:';
      if (!isStaticHost) {
        try {
          await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buyerName: this.checkoutName,
              buyerWhatsapp: this.checkoutWhatsApp,
              itemsJson: JSON.stringify(st.cart),
              totalPrice,
            }),
          });
        } catch {
          // Fallback smoothly if offline
        }
      }

      this.checkoutStatusMsg = `Terima kasih ${this.checkoutName}! Pesanan apresiasi (${itemsSummary.join(', ')}) sebesar ${formatIDR(totalPrice)} telah tercatat.`;
      galleryStore.getState().clearCart();
      this.renderCartDrawer();
    });
  }

  private escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(str: string): string {
    return this.escapeHtml(str).replace(/'/g, '&#39;');
  }
}
