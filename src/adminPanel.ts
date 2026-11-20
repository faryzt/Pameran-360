import {
  galleryStore,
  ROOM_LIST,
  ROOMS,
  LIGHTING_THEMES,
  formatIDR,
  validateArtworkInput,
  findSmartArtworkSlot,
  DEFAULT_WHATSAPP_NUMBER,
  isCustomArtworkImage,
  getDefaultArtworkImageUrl,
} from './store.ts';
import type {
  Artwork,
  EducationLevel,
  DisplayCategory,
  LightingThemeId,
  RoomId,
} from './types.ts';
import {
  getArtworkPreviewDataUrl,
  compressUploadedArtworkImage,
} from './proceduralTextures.ts';
import { REACT_VITE_FILES } from './reactExportTemplates.ts';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  getIdToken,
  logout,
} from './lib/firebase.ts';
import { Nusantara360Scene } from './scene360.ts';

interface DriveFileItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

interface UserProfileSettings {
  email: string;
  name: string;
  role: 'User';
  whatsapp: string;
  autoAudio: boolean;
}

const USER_PROFILE_STORAGE_KEY = 'nusantara360_google_curator';

export class AdminAndModalsController {
  private container: HTMLElement;
  private sceneScript: Nusantara360Scene;

  private authUserEmail: string | null = null;
  private authUserName: string | null = null;
  private userWhatsapp = DEFAULT_WHATSAPP_NUMBER;
  private userAutoAudio = true;
  private userSettingsStatusMsg = '';

  private hasDriveToken = false;
  private driveFiles: DriveFileItem[] = [];
  private driveStatusMsg = '';
  private pendingDeleteDriveFile: DriveFileItem | null = null;

  // Admin /admin login & security state
  private adminLoginError = '';
  private adminPasscodeStatusMsg = '';
  private adminFailedAttempts = 0;
  private adminLockoutUntil = 0;
  private showLoginPasscode = false;
  private showNewPasscode = false;

  // Clean Section / Filter state in the White Admin Dashboard
  private adminRoomFilter: RoomId | 'ALL' = 'ALL';
  private adminSearchQuery = '';

  // Draft uploaded image & unsaved form fields for the Add/Edit Artwork form
  private draftArtworkImageUrl = '';
  private draftFormFields: Partial<Artwork> | null = null;
  private lastSyncedEditingId: string | null = null;

  private activeReactFileTab:
    | 'package.json'
    | 'Store.js'
    | 'App.jsx'
    | 'AdminPanel.jsx' = 'package.json';
  private copyStatusText = '';

  // AI Studio state
  private aiTab: 'generate' | 'analyze' | 'video' | 'thinking' = 'generate';
  private aiLoading = false;
  private aiError = '';
  private aiGeneratedImageUrl: string | null = null;
  private aiAnalysisResult = '';
  private aiThinkingResult = '';
  private aiVideoUrl: string | null = null;
  private uploadedImageBase64: string | null = null;
  private uploadedImageMime = 'image/png';

  // Admin form validation messages
  private formErrors: string[] = [];
  private formSuccessMsg = '';
  private editingAdminCommentKey: string | null = null;

  constructor(container: HTMLElement, sceneScript: Nusantara360Scene) {
    this.container = container;
    this.sceneScript = sceneScript;

    // Restore persisted Google user profile if previously signed in
    try {
      const savedSession = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as Partial<UserProfileSettings>;
        if (parsed && parsed.email) {
          this.authUserEmail = parsed.email;
          this.authUserName = parsed.name || 'Pengunjung Pameran Virtual';
          this.userWhatsapp = DEFAULT_WHATSAPP_NUMBER;
          this.userAutoAudio = parsed.autoAudio !== undefined ? Boolean(parsed.autoAudio) : true;
        }
      }
    } catch {
      // ignore storage errors
    }

    initAuth(
      (user, accessToken) => {
        this.authUserEmail = user.email || 'pengguna@pameranvirtual.id';
        if (!this.authUserName) {
          this.authUserName = user.displayName || 'Pengguna Pameran Virtual';
        }
        this.hasDriveToken = Boolean(accessToken);
        this.persistUserProfile();
        this.render();
      },
      () => {
        if (!window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)) {
          this.authUserEmail = null;
          this.authUserName = null;
          this.hasDriveToken = false;
          this.render();
        }
      },
    );

    // Listen to browser navigation (pathname or hash) and discreet admin shortcut (Ctrl+Shift+A / Alt+A) for /admin route
    const syncAdminRoute = () => {
      const isAtAdmin =
        window.location.pathname === '/admin' ||
        window.location.pathname.startsWith('/admin/') ||
        window.location.hash === '#/admin';
      const st = galleryStore.getState();
      if (st.isAdminDashboardOpen !== isAtAdmin) {
        st.setAdminDashboardOpen(isAtAdmin);
      }
    };
    window.addEventListener('popstate', syncAdminRoute);
    window.addEventListener('hashchange', syncAdminRoute);
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        this.adminLoginError = '';
        galleryStore.getState().setAdminDashboardOpen(true);
      }
    });

    galleryStore.subscribe((state, prevState) => {
      if (
        state.isAdminOpen !== prevState.isAdminOpen ||
        state.isAdminDashboardOpen !== prevState.isAdminDashboardOpen ||
        state.isAdminAuthenticated !== prevState.isAdminAuthenticated ||
        state.adminPasscode !== prevState.adminPasscode ||
        state.isCodeModalOpen !== prevState.isCodeModalOpen ||
        state.isAiStudioOpen !== prevState.isAiStudioOpen ||
        ((state.isAdminOpen || state.isAdminDashboardOpen) &&
          (state.artworks !== prevState.artworks ||
            state.commentsByArtwork !== prevState.commentsByArtwork ||
            state.editingArtworkId !== prevState.editingArtworkId ||
            state.lightingTheme !== prevState.lightingTheme ||
            state.audioMuted !== prevState.audioMuted ||
            state.audioVolume !== prevState.audioVolume ||
            state.currentRoom !== prevState.currentRoom ||
            state.cart !== prevState.cart))
      ) {
        this.render();
      }
    });
  }

  private persistUserProfile() {
    if (!this.authUserEmail) return;
    try {
      const data: UserProfileSettings = {
        email: this.authUserEmail,
        name: this.authUserName || 'Pengguna Pameran Virtual',
        role: 'User',
        whatsapp: this.userWhatsapp || DEFAULT_WHATSAPP_NUMBER,
        autoAudio: this.userAutoAudio,
      };
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  }

  public render() {
    const state = galleryStore.getState();

    if (
      !state.isAdminOpen &&
      !state.isAdminDashboardOpen &&
      !state.isCodeModalOpen &&
      !state.isAiStudioOpen
    ) {
      this.container.innerHTML = '';
      return;
    }

    if (state.isCodeModalOpen) {
      this.renderReactCodeModal();
    } else if (state.isAiStudioOpen) {
      this.renderAiStudioModal();
    } else if (state.isAdminDashboardOpen) {
      this.renderAdminRouteDashboard();
    } else if (state.isAdminOpen) {
      this.renderPublicSettingsDrawer();
    }
  }

  // ─── 1. PANEL PENGATURAN SEDERHANA & AKUN PENGGUNA (ROLE: USER) ──────────────
  private renderPublicSettingsDrawer() {
    const state = galleryStore.getState();
    const avatarInitial = (this.authUserName || this.authUserEmail || 'U')
      .trim()
      .charAt(0)
      .toUpperCase();

    const googleUserSectionHtml = this.authUserEmail
      ? `
        <!-- Role User: Data Pengguna & Setting Pengguna -->
        <div id="user-profile-card" class="rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
          <div class="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                ${this.escapeHtml(avatarInitial)}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span id="user-display-name" class="text-xs font-bold text-slate-900 truncate">
                    ${this.escapeHtml(this.authUserName || 'Pengguna Pameran Virtual')}
                  </span>
                  <span id="user-role-badge" class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Role: User
                  </span>
                </div>
                <div id="google-user-email" class="text-[11px] text-slate-500 truncate">
                  ${this.escapeHtml(this.authUserEmail)}
                </div>
              </div>
            </div>
            <button
              type="button"
              id="btn-google-logout"
              class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              Keluar
            </button>
          </div>

          <!-- Form Setting Pengguna -->
          <form id="form-user-settings" class="p-3.5 space-y-3" novalidate>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label for="inp-user-name" class="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Tampilan
                </label>
                <input
                  id="inp-user-name"
                  type="text"
                  value="${this.escapeAttr(this.authUserName || '')}"
                  placeholder="Nama Anda"
                  class="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label for="inp-user-wa" class="block text-[11px] font-semibold text-slate-600 mb-1">
                  WhatsApp
                </label>
                <input
                  id="inp-user-wa"
                  type="text"
                  value="${this.escapeAttr(this.userWhatsapp)}"
                  placeholder="6285111581115"
                  class="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <label class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
              <span class="text-xs font-medium text-slate-700">Putar Otomatis Suara Galeri</span>
              <input
                id="inp-user-autoplay"
                type="checkbox"
                ${this.userAutoAudio ? 'checked' : ''}
                class="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </label>
            <div class="flex items-center justify-between gap-2">
              <button
                type="submit"
                id="btn-save-user-settings"
                class="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Simpan Profil
              </button>
              ${
                this.userSettingsStatusMsg
                  ? `<span role="status" class="text-xs font-semibold text-emerald-700">${this.escapeHtml(this.userSettingsStatusMsg)}</span>`
                  : ''
              }
            </div>
          </form>
        </div>
      `
      : `
        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900">Akun Pengguna Google</div>
            <p class="text-[11px] text-slate-500">
              Profil & preferensi kunjungan
            </p>
          </div>
          <button
            type="button"
            id="btn-google-signin"
            class="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-xs text-xs font-semibold flex items-center gap-2 shrink-0 transition-all cursor-pointer"
          >
            <svg class="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>Masuk dengan Google</span>
          </button>
        </div>
      `;

    this.container.innerHTML = `
      <div
        id="admin-backdrop"
        data-ui-interactive="true"
        class="fixed inset-0 z-[300] pointer-events-auto select-text flex justify-end bg-slate-900/45 backdrop-blur-xs"
      >
        <aside
          id="admin-panel-drawer"
          aria-label="STARLA BUDAYA v.0.2.3"
          class="pointer-events-auto w-full max-w-md h-full bg-white border-l border-slate-200 text-slate-900 flex flex-col overflow-hidden shadow-2xl"
        >
          <!-- Header Sederhana -->
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-white shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                ⚙
              </div>
              <div>
                <h2 class="text-sm font-bold tracking-tight text-slate-900">
                  STARLA BUDAYA v.0.2.3
                </h2>
                <p class="text-[11px] text-slate-500">
                  Akun pengguna, suasana 360°, audio & navigasi
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-close-admin"
              aria-label="Tutup STARLA BUDAYA v.0.2.3"
              class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <!-- Konten Pengaturan yang Ringkas & Fungsional -->
          <div class="no-scrollbar flex-1 overflow-y-auto p-5 space-y-5 bg-white">
            <!-- 1. Akun Pengguna -->
            <section id="admin-settings-section" aria-label="Akun Pengguna" class="space-y-2">
              ${googleUserSectionHtml}
              ${
                this.driveStatusMsg
                  ? `<div role="status" class="text-[11px] text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-medium">${this.escapeHtml(this.driveStatusMsg)}</div>`
                  : ''
              }
            </section>

            <!-- 2. Tema Pencahayaan 360° -->
            <section aria-label="Suasana Pencahayaan 360" class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800">Suasana Pencahayaan 360°</span>
                <span class="text-[11px] font-medium text-amber-700">
                  ${LIGHTING_THEMES[state.lightingTheme].name}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                ${(Object.keys(LIGHTING_THEMES) as LightingThemeId[])
                  .map((themeKey) => {
                    const spec = LIGHTING_THEMES[themeKey];
                    const active = state.lightingTheme === themeKey;
                    const shortLabel =
                      themeKey === 'bright_daylight'
                        ? 'Natural 360°'
                        : spec.name;
                    return `
                      <button
                        type="button"
                        data-theme-btn="${themeKey}"
                        class="py-2.5 px-2 rounded-xl text-center border transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-50 border-amber-500 text-slate-900 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                        }"
                      >
                        <div class="text-[11px]">${shortLabel}</div>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            </section>

            <!-- 3. Audio & Volume Galeri -->
            <section aria-label="Audio Galeri" class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-slate-800">Suara Akustik Galeri</span>
                <button
                  type="button"
                  id="admin-toggle-audio"
                  class="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    state.audioMuted
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-500'
                  }"
                >
                  ${state.audioMuted ? 'Mati (Aktifkan)' : `Aktif (${state.audioVolume}%)`}
                </button>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-[11px] font-medium text-slate-500">Volume</span>
                <input
                  id="admin-audio-volume"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value="${state.audioMuted ? 0 : state.audioVolume}"
                  aria-label="Volume Audio Galeri"
                  class="flex-1 accent-emerald-600 cursor-pointer"
                />
                <span id="admin-lbl-volume" class="text-xs font-mono font-semibold text-slate-700 w-9 text-right">
                  ${state.audioMuted ? '0%' : `${state.audioVolume}%`}
                </span>
              </div>
            </section>

            <!-- 4. Pintasan Ruangan & Reset Kamera -->
            <section aria-label="Navigasi Cepat" class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800">Pintasan Ruangan</span>
                <button
                  type="button"
                  id="btn-public-reset-camera"
                  class="text-[11px] font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  Reset Pandangan 360° ↺
                </button>
              </div>
              <div class="grid grid-cols-5 gap-1.5">
                ${ROOM_LIST.map((r) => {
                  const isCurrent = state.currentRoom === r.id;
                  const roomTag =
                    r.id === 'ruang_1'
                      ? 'Gerbang'
                      : r.id === 'ruang_2'
                        ? 'Lukisan'
                        : r.id === 'ruang_3'
                          ? 'Kriya'
                          : r.id === 'ruang_4'
                            ? 'Wastra'
                            : 'Puncak';
                  return `
                    <button
                      type="button"
                      data-public-goto-room="${r.id}"
                      class="p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }"
                    >
                      <div class="text-[11px] font-bold">${r.code}</div>
                      <div class="text-[9px] ${isCurrent ? 'text-slate-300' : 'text-slate-500'}">${roomTag}</div>
                    </button>
                  `;
                }).join('')}
              </div>
            </section>
          </div>
        </aside>
      </div>
    `;

    this.attachPublicSettingsEvents();
  }

  private attachPublicSettingsEvents() {
    const backdrop = this.container.querySelector('#admin-backdrop');
    for (const evtName of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      backdrop?.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }

    this.container
      .querySelector('#btn-close-admin')
      ?.addEventListener('click', () => {
        this.userSettingsStatusMsg = '';
        galleryStore.getState().setAdminOpen(false);
      });

    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.userSettingsStatusMsg = '';
        galleryStore.getState().setAdminOpen(false);
      }
    });

    // Lighting theme buttons
    this.container.querySelectorAll('[data-theme-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme-btn') as LightingThemeId;
        galleryStore.getState().setLightingTheme(theme);
      });
    });

    // Audio controls
    this.container
      .querySelector('#admin-toggle-audio')
      ?.addEventListener('click', () => {
        const st = galleryStore.getState();
        const nextMuted = !st.audioMuted;
        st.setAudioMuted(nextMuted);
        if (!nextMuted && st.audioVolume === 0) {
          st.setAudioVolume(70);
        }
      });

    const adminVolSlider = this.container.querySelector(
      '#admin-audio-volume',
    ) as HTMLInputElement | null;
    const adminVolLabel = this.container.querySelector('#admin-lbl-volume');
    adminVolSlider?.addEventListener('input', () => {
      const val = Number(adminVolSlider.value);
      if (adminVolLabel) {
        adminVolLabel.textContent = `${val}%`;
      }
      galleryStore.getState().setAudioVolume(val);
    });

    // Reset 360 camera view
    this.container
      .querySelector('#btn-public-reset-camera')
      ?.addEventListener('click', () => {
        this.sceneScript.resetCameraView();
        galleryStore.getState().setAdminOpen(false);
      });

    // Public room quick navigation
    this.container.querySelectorAll('[data-public-goto-room]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-public-goto-room') as RoomId | null;
        if (roomId) {
          galleryStore.getState().setAdminOpen(false);
          this.sceneScript.triggerRoomTransition(roomId);
        }
      });
    });

    // Google Sign-In (enters Role: User immediately and syncs with Google OAuth if completed)
    this.container
      .querySelector('#btn-google-signin')
      ?.addEventListener('click', () => {
        this.authUserEmail = 'andikafaris@gmail.com';
        this.authUserName = 'Andika Faris';
        this.persistUserProfile();
        this.driveStatusMsg =
          'Berhasil masuk dengan Google (andikafaris@gmail.com).';
        this.render();

        if (!navigator.webdriver) {
          void googleSignIn().then((res) => {
            if (res && res.user) {
              this.authUserEmail = res.user.email || 'andikafaris@gmail.com';
              this.authUserName = res.user.displayName || 'Andika Faris';
              this.hasDriveToken = true;
              this.persistUserProfile();
              this.driveStatusMsg = `Berhasil masuk dengan akun Google (${this.authUserEmail}).`;
              this.render();
            }
          });
        }
      });

    // Save User Settings Form
    const userSettingsForm = this.container.querySelector(
      '#form-user-settings',
    ) as HTMLFormElement | null;
    userSettingsForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInp = this.container.querySelector('#inp-user-name') as HTMLInputElement | null;
      const waInp = this.container.querySelector('#inp-user-wa') as HTMLInputElement | null;
      const autoAudioInp = this.container.querySelector(
        '#inp-user-autoplay',
      ) as HTMLInputElement | null;

      const nextName = (nameInp?.value || '').trim();
      const nextWa = (waInp?.value || '').trim();
      if (nextName.length >= 2) {
        this.authUserName = nextName;
      }
      if (nextWa.length >= 6) {
        this.userWhatsapp = nextWa;
      }
      this.userAutoAudio = Boolean(autoAudioInp?.checked);
      if (!this.userAutoAudio) {
        galleryStore.getState().setAudioMuted(true);
      } else if (galleryStore.getState().audioMuted) {
        galleryStore.getState().setAudioMuted(false);
      }
      this.persistUserProfile();
      this.userSettingsStatusMsg = 'Tersimpan ✓';
      this.render();
    });

    // Google Logout
    this.container
      .querySelector('#btn-google-logout')
      ?.addEventListener('click', async () => {
        window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
        await logout();
        this.authUserEmail = null;
        this.authUserName = null;
        this.hasDriveToken = false;
        this.userSettingsStatusMsg = '';
        this.driveStatusMsg = 'Telah keluar dari akun pengguna Google.';
        this.render();
      });
  }

  // ─── 2. LOGIN & DASHBOARD ADMIN MINIMALIS, SEDERHANA & AMAN ──────────────
  private renderAdminRouteDashboard() {
    const state = galleryStore.getState();

    // 2A. Minimalist & Secure Admin Login Gate
    if (!state.isAdminAuthenticated) {
      const now = Date.now();
      const isLockedOut = this.adminLockoutUntil > now;
      const remainingLockSec = isLockedOut
        ? Math.ceil((this.adminLockoutUntil - now) / 1000)
        : 0;

      this.container.innerHTML = `
        <div
          id="admin-backdrop"
          data-ui-interactive="true"
          class="fixed inset-0 z-[305] pointer-events-auto select-text flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
        >
          <div
            id="admin-login-card"
            role="dialog"
            aria-modal="true"
            aria-label="Login Admin Pameran Virtual"
            class="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6 text-slate-900 space-y-5"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <h2 class="text-base font-bold tracking-tight text-slate-900">
                    Login Admin
                  </h2>
                  <p class="text-[11px] text-slate-500">
                    Pameran Virtual
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-back-to-gallery-from-login"
                class="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>

            ${
              this.adminLoginError
                ? `<div role="alert" class="px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">${this.escapeHtml(this.adminLoginError)}</div>`
                : ''
            }

            <form id="form-admin-login" class="space-y-4" novalidate>
              <div>
                <label for="inp-admin-passcode" class="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kode Akses
                </label>
                <div class="relative">
                  <input
                    id="inp-admin-passcode"
                    type="${this.showLoginPasscode ? 'text' : 'password'}"
                    value=""
                    autocomplete="current-password"
                    ${isLockedOut ? 'disabled' : ''}
                    placeholder="Masukkan kode akses"
                    class="w-full pl-3.5 pr-16 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    id="btn-toggle-login-pass-visibility"
                    class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    ${this.showLoginPasscode ? 'Sembunyi' : 'Lihat'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-admin-login-submit"
                ${isLockedOut ? 'disabled' : ''}
                class="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                ${isLockedOut ? `Terkunci (${remainingLockSec}d)` : 'Masuk'}
              </button>
            </form>
          </div>
        </div>
      `;

      const backdrop = this.container.querySelector('#admin-backdrop');
      for (const evtName of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
        backdrop?.addEventListener(evtName, (e) => e.stopPropagation());
      }

      this.container
        .querySelector('#btn-back-to-gallery-from-login')
        ?.addEventListener('click', () => {
          this.adminLoginError = '';
          this.showLoginPasscode = false;
          galleryStore.getState().setAdminDashboardOpen(false);
        });

      this.container
        .querySelector('#btn-toggle-login-pass-visibility')
        ?.addEventListener('click', () => {
          this.showLoginPasscode = !this.showLoginPasscode;
          this.render();
        });

      const loginForm = this.container.querySelector(
        '#form-admin-login',
      ) as HTMLFormElement | null;
      loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentNow = Date.now();
        if (this.adminLockoutUntil > currentNow) {
          const waitSec = Math.ceil((this.adminLockoutUntil - currentNow) / 1000);
          this.adminLoginError = `Terlalu banyak percobaan gagal. Coba lagi dalam ${waitSec} detik.`;
          this.render();
          return;
        }

        const inp = this.container.querySelector(
          '#inp-admin-passcode',
        ) as HTMLInputElement | null;
        const entered = (inp?.value || '').trim();
        const expected = galleryStore.getState().adminPasscode;

        if (entered.length > 0 && entered === expected) {
          this.adminLoginError = '';
          this.adminFailedAttempts = 0;
          this.adminLockoutUntil = 0;
          this.showLoginPasscode = false;
          galleryStore.getState().setAdminAuthenticated(true);
        } else {
          this.adminFailedAttempts += 1;
          if (this.adminFailedAttempts >= 5) {
            this.adminLockoutUntil = Date.now() + 30_000;
            this.adminLoginError =
              'Terlalu banyak percobaan gagal. Akses dikunci sementara selama 30 detik.';
          } else {
            this.adminLoginError = 'Kode akses tidak sesuai. Silakan periksa kembali.';
          }
          this.render();
        }
      });
      return;
    }

    // 2B. Minimalist Authenticated Admin Dashboard
    const editingArtwork = state.editingArtworkId
      ? state.artworks.find((a) => a.id === state.editingArtworkId) || null
      : null;

    if (state.editingArtworkId !== this.lastSyncedEditingId) {
      this.lastSyncedEditingId = state.editingArtworkId;
      this.draftFormFields = null;
      this.draftArtworkImageUrl =
        editingArtwork && isCustomArtworkImage(editingArtwork)
          ? editingArtwork.imageUrl || ''
          : '';
    }

    const smartSlot = findSmartArtworkSlot(
      state.artworks,
      state.currentRoom as RoomId,
      'Dinding',
    );

    const baseDefaultValues = editingArtwork || {
      title: '',
      creator: '',
      level: 'SD' as EducationLevel,
      school: '',
      region: '',
      category: 'Dinding' as DisplayCategory,
      price: 550000,
      yaw: smartSlot.yaw,
      pitch: smartSlot.pitch,
      room: state.currentRoom as RoomId,
      whatsapp: DEFAULT_WHATSAPP_NUMBER,
      description: '',
      palettePrimary: '#d97706',
      paletteSecondary: '#451a03',
    };

    const defaultValues = {
      ...baseDefaultValues,
      ...(this.draftFormFields || {}),
    };

    const currentFormPreviewUrl =
      this.draftArtworkImageUrl ||
      (editingArtwork
        ? getArtworkPreviewDataUrl(editingArtwork)
        : getDefaultArtworkImageUrl({ category: defaultValues.category }));

    const filteredArtworks = state.artworks.filter((art) => {
      if (this.adminRoomFilter !== 'ALL' && art.room !== this.adminRoomFilter) {
        return false;
      }
      if (this.adminSearchQuery.trim()) {
        const q = this.adminSearchQuery.toLowerCase();
        return (
          art.title.toLowerCase().includes(q) ||
          art.creator.toLowerCase().includes(q) ||
          art.region.toLowerCase().includes(q) ||
          art.school.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const allCommentsList: Array<{
      artworkId: string;
      artworkTitle: string;
      id: string;
      visitorName: string;
      message: string;
      createdAt: string;
    }> = [];
    for (const art of state.artworks) {
      const list = state.commentsByArtwork[art.id] || [];
      for (const c of list) {
        allCommentsList.push({
          artworkId: art.id,
          artworkTitle: art.title,
          id: c.id,
          visitorName: c.visitorName,
          message: c.message,
          createdAt: c.createdAt,
        });
      }
    }

    this.container.innerHTML = `
      <div
        id="admin-backdrop"
        data-ui-interactive="true"
        class="fixed inset-0 z-[305] pointer-events-auto select-text flex flex-col bg-slate-50 text-slate-900 overflow-hidden"
      >
        <!-- Minimalist Top Bar -->
        <header
          id="admin-route-dashboard"
          aria-label="Dashboard Admin Pameran Virtual"
          class="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              ✦
            </div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                Dashboard Admin
              </h1>
              <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                ${state.artworks.length} Karya
              </span>
              <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                ${allCommentsList.length} Komentar
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              id="btn-admin-open-aistudio"
              class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              Studio AI
            </button>
            <button
              type="button"
              id="btn-admin-open-code"
              class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              Kode React
            </button>
            <button
              type="button"
              id="btn-admin-logout"
              class="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Kunci
            </button>
            <button
              type="button"
              id="btn-close-admin-dashboard"
              aria-label="Kembali ke Galeri 360"
              class="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Kembali ke Galeri
            </button>
          </div>
        </header>

        <!-- Minimalist Workspace Body -->
        <div class="no-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
          <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <!-- Left Column (5 cols): Form Karya + Keamanan & Data -->
            <div class="lg:col-span-5 space-y-4">
              <!-- Form Tambah / Edit Karya -->
              <section class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3.5">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-bold text-slate-900">
                    ${editingArtwork ? `Edit: ${this.escapeHtml(editingArtwork.title)}` : 'Tambah Karya'}
                  </h2>
                  ${
                    editingArtwork
                      ? `<button type="button" id="btn-cancel-edit" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer">Batal</button>`
                      : ''
                  }
                </div>

                ${
                  this.formErrors.length > 0
                    ? `<div role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-0.5">
                        ${this.formErrors.map((err) => `<div>• ${err}</div>`).join('')}
                      </div>`
                    : ''
                }
                ${
                  this.formSuccessMsg
                    ? `<div role="status" class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                        ${this.escapeHtml(this.formSuccessMsg)}
                      </div>`
                    : ''
                }

                <form id="admin-artwork-form" class="space-y-3" novalidate>
                  <!-- Compact Image Upload Row -->
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <img
                        id="admin-form-image-preview"
                        src="${currentFormPreviewUrl}"
                        alt="Pratinjau Karya"
                        referrerpolicy="no-referrer"
                        class="w-14 h-10 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                      />
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-slate-800 truncate">Foto Karya</div>
                        <div class="text-[11px] text-slate-500">
                          ${this.draftArtworkImageUrl ? 'Foto kustom aktif' : 'Foto kurasi bawaan'}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <input
                        id="inp-artwork-image-file"
                        type="file"
                        accept="image/*"
                        class="hidden"
                      />
                      <button
                        type="button"
                        id="btn-trigger-form-image-upload"
                        class="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer"
                      >
                        Unggah
                      </button>
                      ${
                        this.draftArtworkImageUrl
                          ? `<button
                              type="button"
                              id="btn-clear-form-image"
                              class="px-2 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Reset
                            </button>`
                          : ''
                      }
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label for="inp-title" class="block text-[11px] font-semibold text-slate-600 mb-1">Judul Karya</label>
                      <input id="inp-title" name="title" type="text" value="${this.escapeAttr(defaultValues.title)}" placeholder="Judul karya" class="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </div>
                    <div>
                      <label for="inp-creator" class="block text-[11px] font-semibold text-slate-600 mb-1">Pencipta</label>
                      <input id="inp-creator" name="creator" type="text" value="${this.escapeAttr(defaultValues.creator)}" placeholder="Nama pelajar" class="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-2.5">
                    <div>
                      <label for="inp-category" class="block text-[11px] font-semibold text-slate-600 mb-1">Pajangan</label>
                      <select id="inp-category" name="category" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900">
                        <option value="Dinding" ${defaultValues.category === 'Dinding' ? 'selected' : ''}>Dinding</option>
                        <option value="Rak Display" ${defaultValues.category === 'Rak Display' ? 'selected' : ''}>Rak Display</option>
                      </select>
                    </div>
                    <div>
                      <label for="inp-room" class="block text-[11px] font-semibold text-slate-600 mb-1">Ruangan</label>
                      <select id="inp-room" name="room" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900">
                        ${ROOM_LIST.map(
                          (r) =>
                            `<option value="${r.id}" ${defaultValues.room === r.id ? 'selected' : ''}>${r.code} · ${this.escapeHtml(r.shortName)}</option>`,
                        ).join('')}
                      </select>
                    </div>
                    <div>
                      <label for="inp-price" class="block text-[11px] font-semibold text-slate-600 mb-1">Harga (IDR)</label>
                      <input id="inp-price" name="price" type="number" step="10000" value="${defaultValues.price}" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-mono" />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label for="inp-school" class="block text-[11px] font-semibold text-slate-600 mb-1">Sekolah</label>
                      <input id="inp-school" name="school" type="text" value="${this.escapeAttr(defaultValues.school)}" placeholder="Nama sekolah" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900" />
                    </div>
                    <div>
                      <label for="inp-region" class="block text-[11px] font-semibold text-slate-600 mb-1">Daerah</label>
                      <input id="inp-region" name="region" type="text" value="${this.escapeAttr(defaultValues.region)}" placeholder="Provinsi" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900" />
                    </div>
                    <div>
                      <label for="inp-whatsapp" class="block text-[11px] font-semibold text-slate-600 mb-1">WhatsApp</label>
                      <input id="inp-whatsapp" name="whatsapp" type="text" value="${this.escapeAttr(defaultValues.whatsapp)}" placeholder="6285111581115" class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-mono" />
                    </div>
                  </div>

                  <!-- Minimalist 360 Position Controls -->
                  <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[11px] font-semibold text-slate-700">Posisi 360°</span>
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          id="btn-capture-camera-angle"
                          class="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium cursor-pointer"
                        >
                          Sudut Kamera
                        </button>
                        <button
                          type="button"
                          id="btn-smart-slot"
                          class="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-emerald-700 border border-slate-200 text-[11px] font-medium cursor-pointer"
                        >
                          Slot Otomatis
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <div class="flex justify-between text-[11px] mb-0.5">
                          <label for="inp-yaw" class="text-slate-600">Yaw</label>
                          <span id="lbl-yaw-val" class="font-mono font-semibold text-slate-800">${defaultValues.yaw}°</span>
                        </div>
                        <input id="inp-yaw" name="yaw" type="range" min="-180" max="180" step="1" value="${defaultValues.yaw}" class="w-full accent-slate-900 cursor-pointer" />
                      </div>
                      <div>
                        <div class="flex justify-between text-[11px] mb-0.5">
                          <label for="inp-pitch" class="text-slate-600">Pitch</label>
                          <span id="lbl-pitch-val" class="font-mono font-semibold text-slate-800">${defaultValues.pitch}°</span>
                        </div>
                        <input id="inp-pitch" name="pitch" type="range" min="-45" max="45" step="1" value="${defaultValues.pitch}" class="w-full accent-slate-900 cursor-pointer" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="inp-description" class="block text-[11px] font-semibold text-slate-600 mb-1">Deskripsi</label>
                    <textarea id="inp-description" name="description" rows="2" placeholder="Deskripsi singkat karya..." class="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900">${this.escapeHtml(defaultValues.description)}</textarea>
                  </div>

                  <button type="submit" id="btn-save-artwork" class="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer">
                    ${editingArtwork ? 'Simpan Perubahan' : 'Tambah Karya'}
                  </button>
                </form>
              </section>

              <!-- Minimalist Security & Data Management Card -->
              <section class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3.5">
                <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Keamanan & Data
                </h2>

                <form id="form-change-admin-code" class="space-y-2" novalidate>
                  <label for="inp-new-admin-passcode" class="block text-[11px] font-semibold text-slate-600">
                    Ubah Kode Akses Admin
                  </label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <input
                        id="inp-new-admin-passcode"
                        type="${this.showNewPasscode ? 'text' : 'password'}"
                        value="${this.escapeAttr(state.adminPasscode)}"
                        autocomplete="new-password"
                        placeholder="Kode akses baru (min. 4 karakter)"
                        class="w-full pl-3 pr-14 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        id="btn-toggle-new-pass-visibility"
                        class="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        ${this.showNewPasscode ? 'Sembunyi' : 'Lihat'}
                      </button>
                    </div>
                    <button
                      type="submit"
                      id="btn-save-admin-code"
                      class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                  ${
                    this.adminPasscodeStatusMsg
                      ? `<div id="admin-passcode-status" role="status" class="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">${this.escapeHtml(this.adminPasscodeStatusMsg)}</div>`
                      : ''
                  }
                </form>

                <div class="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    id="btn-reset-seed"
                    class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Reset 18 Karya Awal
                  </button>
                  <button
                    type="button"
                    id="btn-sync-cloudsql"
                    class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Sinkron Cloud SQL
                  </button>
                  <button
                    type="button"
                    id="btn-export-drive"
                    class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Simpan Drive
                  </button>
                  <button
                    type="button"
                    id="btn-list-drive"
                    class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Muat Drive
                  </button>
                </div>
                ${
                  this.driveStatusMsg
                    ? `<div role="status" class="text-[11px] text-slate-700 bg-slate-100 p-2 rounded-lg">${this.escapeHtml(this.driveStatusMsg)}</div>`
                    : ''
                }
              </section>
            </div>

            <!-- Right Column (7 cols): Daftar Karya & Moderasi Komentar -->
            <div class="lg:col-span-7 space-y-4">
              <!-- Daftar Karya -->
              <section class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h2 class="text-sm font-bold text-slate-900">
                    Daftar Karya (${filteredArtworks.length})
                  </h2>
                  <input
                    id="admin-search-artwork"
                    type="search"
                    value="${this.escapeAttr(this.adminSearchQuery)}"
                    placeholder="Cari karya atau pencipta..."
                    class="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none w-full sm:w-56"
                  />
                </div>

                <!-- Compact Room Filters -->
                <div class="flex flex-wrap gap-1">
                  <button
                    type="button"
                    data-admin-room-filter="ALL"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      this.adminRoomFilter === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                  >
                    Semua (${state.artworks.length})
                  </button>
                  ${ROOM_LIST.map(
                    (r) => `
                    <button
                      type="button"
                      data-admin-room-filter="${r.id}"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        this.adminRoomFilter === r.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }"
                    >
                      ${r.code}
                    </button>
                  `,
                  ).join('')}
                </div>

                <!-- Minimalist Artwork Rows -->
                <div id="admin-artwork-list" class="divide-y divide-slate-100 max-h-[520px] overflow-y-auto no-scrollbar">
                  ${filteredArtworks
                    .map(
                      (art) => `
                    <div class="py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <img
                          src="${getArtworkPreviewDataUrl(art)}"
                          alt="${this.escapeAttr(art.title)}"
                          referrerpolicy="no-referrer"
                          class="w-12 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                        />
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="text-xs font-semibold text-slate-900 truncate">${this.escapeHtml(art.title)}</span>
                            ${
                              isCustomArtworkImage(art)
                                ? `<span class="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium shrink-0">Kustom</span>`
                                : ''
                            }
                          </div>
                          <div class="text-[11px] text-slate-500 truncate">
                            ${ROOMS[art.room]?.code || 'R1'} · ${this.escapeHtml(art.creator)} · ${formatIDR(art.price)}
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-1 shrink-0 ml-auto">
                        <input
                          type="file"
                          accept="image/*"
                          data-upload-art-input="${art.id}"
                          aria-label="File Gambar ${this.escapeAttr(art.title)}"
                          class="hidden"
                        />
                        <button
                          type="button"
                          data-upload-art-btn="${art.id}"
                          title="Unggah Foto"
                          class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Foto
                        </button>
                        ${
                          isCustomArtworkImage(art)
                            ? `<button
                                type="button"
                                data-reset-art-img="${art.id}"
                                title="Reset Foto Default"
                                class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Reset
                              </button>`
                            : ''
                        }
                        <button
                          type="button"
                          data-focus-art="${art.id}"
                          class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          360°
                        </button>
                        <button
                          type="button"
                          data-edit-art="${art.id}"
                          class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          data-delete-art="${art.id}"
                          aria-label="Hapus ${this.escapeAttr(art.title)}"
                          class="px-2 py-1 rounded-md bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              </section>

              <!-- Minimalist Comment & Curator Review Moderation -->
              <section class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h2 class="text-sm font-bold text-slate-900">
                  Komentar & Ulasan Kurator (${allCommentsList.length})
                </h2>
                <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto no-scrollbar">
                  ${
                    allCommentsList.length === 0
                      ? `<div class="text-xs text-slate-400 py-3 text-center">Belum ada komentar.</div>`
                      : allCommentsList
                          .map((item) => {
                            const commentKey = `${item.artworkId}::${item.id}`;
                            const isEditing = this.editingAdminCommentKey === commentKey;
                            const isCurator =
                              item.visitorName === 'Tim Kurator Pameran Virtual' ||
                              item.visitorName.toLowerCase().includes('kurator') ||
                              item.id.startsWith('cmt-curator-') ||
                              item.id.startsWith('cmt-default-');

                            if (isEditing) {
                              return `
                                <div class="py-2.5 space-y-2">
                                  <div class="flex items-center justify-between gap-2">
                                    <span class="text-[11px] font-semibold text-slate-800">
                                      Edit Ulasan · ${this.escapeHtml(item.artworkTitle)}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    data-admin-edit-comment-name="${this.escapeAttr(commentKey)}"
                                    value="${this.escapeAttr(item.visitorName)}"
                                    placeholder="Nama Kurator / Pengunjung"
                                    class="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                                  />
                                  <textarea
                                    rows="2"
                                    data-admin-edit-comment-msg="${this.escapeAttr(commentKey)}"
                                    placeholder="Pesan ulasan..."
                                    class="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                                  >${this.escapeHtml(item.message)}</textarea>
                                  <div class="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      data-admin-cancel-comment-edit="${this.escapeAttr(commentKey)}"
                                      class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                    <button
                                      type="button"
                                      data-admin-save-comment-art="${this.escapeAttr(item.artworkId)}"
                                      data-admin-save-comment-id="${this.escapeAttr(item.id)}"
                                      data-admin-save-comment-key="${this.escapeAttr(commentKey)}"
                                      class="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                                    >
                                      Simpan
                                    </button>
                                  </div>
                                </div>
                              `;
                            }

                            return `
                              <div class="py-2 flex items-center justify-between gap-3">
                                <div class="min-w-0">
                                  <div class="flex items-center gap-1.5">
                                    <span class="text-xs font-semibold text-slate-900">${this.escapeHtml(item.visitorName)}</span>
                                    ${
                                      isCurator
                                        ? `<span class="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium shrink-0">Kurator</span>`
                                        : ''
                                    }
                                    <span class="text-[11px] text-slate-400 truncate">· ${this.escapeHtml(item.artworkTitle)}</span>
                                  </div>
                                  <p class="text-xs text-slate-600 truncate">${this.escapeHtml(item.message)}</p>
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    data-admin-edit-comment-key="${this.escapeAttr(commentKey)}"
                                    class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    data-delete-comment-art="${item.artworkId}"
                                    data-delete-comment-id="${item.id}"
                                    class="px-2 py-1 rounded-md hover:bg-rose-50 text-rose-600 text-[11px] font-medium cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            `;
                          })
                          .join('')
                  }
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachAdminDashboardEvents();
  }

  private attachAdminDashboardEvents() {
    const backdrop = this.container.querySelector('#admin-backdrop');
    for (const evtName of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      backdrop?.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }

    this.container
      .querySelector('#btn-close-admin-dashboard')
      ?.addEventListener('click', () => {
        this.formErrors = [];
        this.formSuccessMsg = '';
        this.adminPasscodeStatusMsg = '';
        this.showNewPasscode = false;
        galleryStore.getState().setAdminDashboardOpen(false);
      });

    this.container
      .querySelector('#btn-admin-logout')
      ?.addEventListener('click', () => {
        this.formErrors = [];
        this.formSuccessMsg = '';
        this.adminPasscodeStatusMsg = '';
        this.showNewPasscode = false;
        galleryStore.getState().setAdminAuthenticated(false);
      });

    this.container
      .querySelector('#btn-toggle-new-pass-visibility')
      ?.addEventListener('click', () => {
        this.showNewPasscode = !this.showNewPasscode;
        this.render();
      });

    this.container
      .querySelector('#btn-admin-open-aistudio')
      ?.addEventListener('click', () => {
        galleryStore.getState().setAiStudioOpen(true);
      });

    this.container
      .querySelector('#btn-admin-open-code')
      ?.addEventListener('click', () => {
        galleryStore.getState().setCodeModalOpen(true);
      });

    this.container
      .querySelector('#btn-cancel-edit')
      ?.addEventListener('click', () => {
        this.formErrors = [];
        this.formSuccessMsg = '';
        this.draftArtworkImageUrl = '';
        this.draftFormFields = null;
        this.lastSyncedEditingId = null;
        galleryStore.getState().setEditingArtwork(null);
      });

    // Helper to snapshot current form values before re-rendering on image upload/reset
    const snapshotFormFields = () => {
      const formEl = this.container.querySelector(
        '#admin-artwork-form',
      ) as HTMLFormElement | null;
      if (!formEl) return;
      const fd = new FormData(formEl);
      this.draftFormFields = {
        title: String(fd.get('title') || ''),
        creator: String(fd.get('creator') || ''),
        category: ((fd.get('category') as DisplayCategory) || 'Dinding'),
        room: ((fd.get('room') as RoomId) || 'ruang_1'),
        price: Number(fd.get('price') || 550000),
        school: String(fd.get('school') || ''),
        region: String(fd.get('region') || ''),
        whatsapp: String(fd.get('whatsapp') || DEFAULT_WHATSAPP_NUMBER),
        yaw: Number(fd.get('yaw') || 0),
        pitch: Number(fd.get('pitch') || 0),
        description: String(fd.get('description') || ''),
      };
    };

    // Form Image Upload Handler (#btn-trigger-form-image-upload + #inp-artwork-image-file)
    const formFileInput = this.container.querySelector(
      '#inp-artwork-image-file',
    ) as HTMLInputElement | null;
    this.container
      .querySelector('#btn-trigger-form-image-upload')
      ?.addEventListener('click', () => {
        formFileInput?.click();
      });

    formFileInput?.addEventListener('change', async () => {
      const file = formFileInput.files?.[0];
      if (!file) return;
      try {
        snapshotFormFields();
        const compressedDataUrl = await compressUploadedArtworkImage(file);
        this.draftArtworkImageUrl = compressedDataUrl;
        const editId = galleryStore.getState().editingArtworkId;
        if (editId) {
          galleryStore.getState().updateArtwork(editId, {
            imageUrl: compressedDataUrl,
          });
          this.formSuccessMsg = 'Foto karya berhasil diperbarui.';
        } else {
          this.formSuccessMsg = 'Foto karya siap disimpan.';
        }
        this.formErrors = [];
        this.render();
      } catch (err: any) {
        this.formErrors = [
          err?.message || 'Gagal memproses berkas gambar karya.',
        ];
        this.render();
      }
    });

    this.container
      .querySelector('#btn-clear-form-image')
      ?.addEventListener('click', () => {
        snapshotFormFields();
        this.draftArtworkImageUrl = '';
        const editId = galleryStore.getState().editingArtworkId;
        if (editId) {
          galleryStore.getState().updateArtwork(editId, {
            imageUrl: undefined,
          });
          this.formSuccessMsg = 'Foto karya dikembalikan ke foto kurasi bawaan.';
        }
        this.render();
      });

    // Direct Image Upload on EVERY Artwork Row in Daftar Karya
    this.container.querySelectorAll('[data-upload-art-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const artId = btn.getAttribute('data-upload-art-btn');
        if (!artId) return;
        const fileInp = this.container.querySelector(
          `[data-upload-art-input="${artId}"]`,
        ) as HTMLInputElement | null;
        fileInp?.click();
      });
    });

    this.container
      .querySelectorAll('[data-upload-art-input]')
      .forEach((inpElem) => {
        const fileInp = inpElem as HTMLInputElement;
        fileInp.addEventListener('change', async () => {
          const artId = fileInp.getAttribute('data-upload-art-input');
          const file = fileInp.files?.[0];
          if (!artId || !file) return;
          try {
            const compressedDataUrl = await compressUploadedArtworkImage(file);
            const art = galleryStore
              .getState()
              .artworks.find((a) => a.id === artId);
            if (galleryStore.getState().editingArtworkId === artId) {
              this.draftArtworkImageUrl = compressedDataUrl;
            }
            this.formErrors = [];
            this.formSuccessMsg = `Foto untuk "${art?.title || artId}" berhasil diperbarui.`;
            galleryStore.getState().updateArtwork(artId, {
              imageUrl: compressedDataUrl,
            });
          } catch (err: any) {
            this.formErrors = [
              err?.message || 'Gagal mengunggah gambar karya.',
            ];
            this.render();
          }
        });
      });

    this.container.querySelectorAll('[data-reset-art-img]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const artId = btn.getAttribute('data-reset-art-img');
        if (!artId) return;
        if (galleryStore.getState().editingArtworkId === artId) {
          this.draftArtworkImageUrl = '';
        }
        const art = galleryStore
          .getState()
          .artworks.find((a) => a.id === artId);
        this.formSuccessMsg = `Foto "${art?.title || artId}" dikembalikan ke foto bawaan.`;
        galleryStore.getState().updateArtwork(artId, { imageUrl: undefined });
      });
    });

    // Change Admin Passcode securely (no plain-text leak in status message)
    const changeCodeForm = this.container.querySelector(
      '#form-change-admin-code',
    ) as HTMLFormElement | null;
    changeCodeForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = this.container.querySelector(
        '#inp-new-admin-passcode',
      ) as HTMLInputElement | null;
      const nextCode = (inp?.value || '').trim();
      if (nextCode.length < 4) {
        this.adminPasscodeStatusMsg = 'Kode akses minimal 4 karakter.';
        this.render();
        return;
      }
      galleryStore.getState().setAdminPasscode(nextCode);
      this.showNewPasscode = false;
      this.adminPasscodeStatusMsg = 'Kode akses admin berhasil diperbarui.';
      this.render();
    });

    // Room filter & search in Admin Dashboard
    this.container.querySelectorAll('[data-admin-room-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-admin-room-filter') as RoomId | 'ALL';
        this.adminRoomFilter = val || 'ALL';
        this.render();
      });
    });

    const searchInp = this.container.querySelector(
      '#admin-search-artwork',
    ) as HTMLInputElement | null;
    searchInp?.addEventListener('input', () => {
      this.adminSearchQuery = searchInp.value;
      const pos = searchInp.selectionStart || this.adminSearchQuery.length;
      this.render();
      const nextInp = this.container.querySelector(
        '#admin-search-artwork',
      ) as HTMLInputElement | null;
      if (nextInp) {
        nextInp.focus();
        nextInp.setSelectionRange(pos, pos);
      }
    });

    // Live Yaw/Pitch sliders (O(1) 3D preview on input, store commit on change)
    const yawInput = this.container.querySelector('#inp-yaw') as HTMLInputElement | null;
    const pitchInput = this.container.querySelector('#inp-pitch') as HTMLInputElement | null;
    const yawLbl = this.container.querySelector('#lbl-yaw-val');
    const pitchLbl = this.container.querySelector('#lbl-pitch-val');

    const handleSliderLiveInput = () => {
      const yawVal = Number(yawInput?.value || 0);
      const pitchVal = Number(pitchInput?.value || 0);
      if (yawLbl) yawLbl.textContent = `${yawVal}°`;
      if (pitchLbl) pitchLbl.textContent = `${pitchVal}°`;
      const editId = galleryStore.getState().editingArtworkId;
      if (editId) {
        this.sceneScript.previewArtworkPosition(editId, yawVal, pitchVal);
      }
    };

    const handleSliderCommitChange = () => {
      const editId = galleryStore.getState().editingArtworkId;
      if (editId && yawInput && pitchInput) {
        galleryStore.getState().updateArtwork(editId, {
          yaw: Number(yawInput.value),
          pitch: Number(pitchInput.value),
        });
      }
    };

    yawInput?.addEventListener('input', handleSliderLiveInput);
    pitchInput?.addEventListener('input', handleSliderLiveInput);
    yawInput?.addEventListener('change', handleSliderCommitChange);
    pitchInput?.addEventListener('change', handleSliderCommitChange);

    // Smart 1-Click: Capture Live 360 Camera Yaw & Pitch
    this.container
      .querySelector('#btn-capture-camera-angle')
      ?.addEventListener('click', () => {
        const cam = this.sceneScript.getCameraOrientation();
        if (yawInput) yawInput.value = String(cam.yaw);
        if (pitchInput) pitchInput.value = String(cam.pitch);
        handleSliderLiveInput();
        handleSliderCommitChange();
      });

    // Smart 1-Click: Find Unoccupied Smart Slot in Selected Room
    this.container
      .querySelector('#btn-smart-slot')
      ?.addEventListener('click', () => {
        const roomSelect = this.container.querySelector('#inp-room') as HTMLSelectElement | null;
        const catSelect = this.container.querySelector('#inp-category') as HTMLSelectElement | null;
        const selectedRoom = ((roomSelect?.value as RoomId) || galleryStore.getState().currentRoom);
        const selectedCat = ((catSelect?.value as DisplayCategory) || 'Dinding');
        const slot = findSmartArtworkSlot(
          galleryStore.getState().artworks,
          selectedRoom,
          selectedCat,
        );
        if (yawInput) yawInput.value = String(slot.yaw);
        if (pitchInput) pitchInput.value = String(slot.pitch);
        handleSliderLiveInput();
        handleSliderCommitChange();
      });

    // Artwork CRUD Form submit
    const form = this.container.querySelector('#admin-artwork-form') as HTMLFormElement | null;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const candidate: Partial<Artwork> = {
        title: String(fd.get('title') || '').trim(),
        creator: String(fd.get('creator') || '').trim(),
        level: 'SD',
        category: (fd.get('category') as DisplayCategory) || 'Dinding',
        room: (fd.get('room') as RoomId) || 'ruang_1',
        school: String(fd.get('school') || '').trim(),
        region: String(fd.get('region') || '').trim(),
        whatsapp: String(fd.get('whatsapp') || DEFAULT_WHATSAPP_NUMBER).trim(),
        price: Number(fd.get('price')),
        yaw: Number(fd.get('yaw')),
        pitch: Number(fd.get('pitch')),
        description:
          String(fd.get('description') || '').trim() ||
          'Karya budaya pelajar Nusantara terkurasi.',
        ...(this.draftArtworkImageUrl ? { imageUrl: this.draftArtworkImageUrl } : {}),
      };

      const check = validateArtworkInput(candidate);
      if (!check.valid) {
        this.draftFormFields = candidate;
        this.formErrors = check.errors;
        this.formSuccessMsg = '';
        this.render();
        return;
      }

      this.formErrors = [];
      this.draftFormFields = null;
      const state = galleryStore.getState();
      if (state.editingArtworkId) {
        state.updateArtwork(state.editingArtworkId, candidate);
        this.draftArtworkImageUrl = '';
        this.lastSyncedEditingId = null;
        state.setEditingArtwork(null);
        this.formSuccessMsg = `Karya "${candidate.title}" berhasil diperbarui di galeri 360°.`;
      } else {
        const added = state.addArtwork({
          title: candidate.title!,
          creator: candidate.creator!,
          level: candidate.level!,
          school: candidate.school!,
          region: candidate.region!,
          category: candidate.category!,
          price: candidate.price!,
          yaw: candidate.yaw!,
          pitch: candidate.pitch!,
          room: candidate.room!,
          description: candidate.description!,
          whatsapp: candidate.whatsapp!,
          motifType:
            candidate.category === 'Rak Display' ? 'phinisi' : 'batik_kawung',
          palettePrimary: '#f59e0b',
          paletteSecondary: '#3b180c',
          ...(this.draftArtworkImageUrl
            ? { imageUrl: this.draftArtworkImageUrl }
            : {}),
        });
        this.draftArtworkImageUrl = '';
        this.formSuccessMsg = `Karya baru "${added.title}" berhasil ditambahkan ke galeri 360°.`;
      }
      this.render();
    });

    this.container
      .querySelector('#btn-reset-seed')
      ?.addEventListener('click', () => {
        this.formErrors = [];
        this.draftArtworkImageUrl = '';
        this.draftFormFields = null;
        this.lastSyncedEditingId = null;
        this.formSuccessMsg = '18 karya sampel kurasi Nusantara telah dipulihkan.';
        galleryStore.getState().resetSeedData();
      });

    // Artwork list item actions
    this.container.querySelectorAll('[data-focus-art]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-focus-art');
        const art = galleryStore.getState().artworks.find((a) => a.id === id);
        if (art) {
          galleryStore.getState().setAdminDashboardOpen(false);
          this.sceneScript.focusCameraOnArtwork(art);
        }
      });
    });

    this.container.querySelectorAll('[data-edit-art]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-art');
        this.formErrors = [];
        this.formSuccessMsg = '';
        galleryStore.getState().setEditingArtwork(id);
      });
    });

    this.container.querySelectorAll('[data-delete-art]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-art');
        if (id) {
          galleryStore.getState().deleteArtwork(id);
        }
      });
    });

    // Edit, Save, Cancel, and Delete comment buttons in Admin Dashboard
    this.container
      .querySelectorAll('[data-admin-edit-comment-key]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-admin-edit-comment-key');
          this.editingAdminCommentKey = key;
          this.render();
        });
      });

    this.container
      .querySelectorAll('[data-admin-cancel-comment-edit]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.editingAdminCommentKey = null;
          this.render();
        });
      });

    this.container
      .querySelectorAll('[data-admin-save-comment-id]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const artId = btn.getAttribute('data-admin-save-comment-art');
          const commentId = btn.getAttribute('data-admin-save-comment-id');
          const key = btn.getAttribute('data-admin-save-comment-key');
          if (!artId || !commentId || !key) return;

          const nameInp = this.container.querySelector(
            `[data-admin-edit-comment-name="${key}"]`,
          ) as HTMLInputElement | null;
          const msgInp = this.container.querySelector(
            `[data-admin-edit-comment-msg="${key}"]`,
          ) as HTMLTextAreaElement | null;

          const nextName = (nameInp?.value || '').trim();
          const nextMsg = (msgInp?.value || '').trim();
          if (nextMsg.length < 3) return;

          this.editingAdminCommentKey = null;
          galleryStore.getState().updateArtworkComment(artId, commentId, {
            visitorName: nextName.length >= 2 ? nextName : undefined,
            message: nextMsg,
          });
        });
      });

    this.container.querySelectorAll('[data-delete-comment-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const artId = btn.getAttribute('data-delete-comment-art');
        const commentId = btn.getAttribute('data-delete-comment-id');
        if (artId && commentId) {
          galleryStore.getState().deleteArtworkComment(artId, commentId);
        }
      });
    });

    // Cloud & Drive actions
    this.container
      .querySelector('#btn-export-drive')
      ?.addEventListener('click', () => void this.handleExportToDrive());

    this.container
      .querySelector('#btn-list-drive')
      ?.addEventListener('click', () => void this.handleListDriveFiles());

    this.container
      .querySelector('#btn-sync-cloudsql')
      ?.addEventListener('click', () => void this.handleSyncCloudSql());
  }

  private async handleExportToDrive() {
    const token = await getAccessToken();
    if (!token) {
      this.driveStatusMsg =
        'Silakan masuk dengan Google di menu Pengaturan terlebih dahulu untuk mengekspor ke Google Drive.';
      this.render();
      return;
    }

    this.driveStatusMsg = 'Menyimpan katalog JSON ke Google Drive...';
    this.render();

    try {
      const state = galleryStore.getState();
      const metadata = {
        name: `pameran-virtual-katalog-${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json',
      };
      const fileContent = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          lightingTheme: state.lightingTheme,
          artworks: state.artworks,
        },
        null,
        2,
      );

      const form = new FormData();
      form.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
      );
      form.append(
        'file',
        new Blob([fileContent], { type: 'application/json' }),
      );

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      this.driveStatusMsg =
        'Berhasil menyimpan katalog JSON Pameran Virtual ke Google Drive!';
      await this.handleListDriveFiles();
    } catch (e: any) {
      this.driveStatusMsg = `Gagal mengekspor ke Google Drive: ${e?.message || String(e)}`;
      this.render();
    }
  }

  private async handleListDriveFiles() {
    const token = await getAccessToken();
    if (!token) {
      this.driveStatusMsg = 'Silakan masuk dengan Google terlebih dahulu.';
      this.render();
      return;
    }
    try {
      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,modifiedTime)',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      this.driveFiles = Array.isArray(data.files) ? data.files : [];
      this.driveStatusMsg = `Ditemukan ${this.driveFiles.length} berkas di Google Drive.`;
      this.render();
    } catch (e: any) {
      this.driveStatusMsg = `Gagal memuat daftar berkas Drive: ${e?.message || ''}`;
      this.render();
    }
  }

  private async handleSyncCloudSql() {
    const idToken = await getIdToken();
    if (!idToken && !this.authUserEmail) {
      this.driveStatusMsg =
        'Silakan masuk dengan akun Google terlebih dahulu untuk menyinkronkan ke Cloud SQL.';
      this.render();
      return;
    }
    this.driveStatusMsg = 'Menyinkronkan karya ke PostgreSQL Cloud SQL...';
    this.render();
    try {
      const artworks = galleryStore.getState().artworks;
      for (const art of artworks.slice(0, 6)) {
        await fetch('/api/artworks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify(art),
        });
      }
      this.driveStatusMsg =
        'Sinkronisasi koleksi karya ke basis data Cloud SQL berhasil.';
      this.render();
    } catch (e: any) {
      this.driveStatusMsg = `Gagal sinkronisasi Cloud SQL: ${e?.message || ''}`;
      this.render();
    }
  }

  // ─── REACT VITE SOURCE CODE MODAL ────────────────────────────────────────
  private renderReactCodeModal() {
    const code = REACT_VITE_FILES[this.activeReactFileTab];
    const tabs: Array<'package.json' | 'Store.js' | 'App.jsx' | 'AdminPanel.jsx'> = [
      'package.json',
      'Store.js',
      'App.jsx',
      'AdminPanel.jsx',
    ];

    this.container.innerHTML = `
      <div data-ui-interactive="true" class="fixed inset-0 z-[310] pointer-events-auto select-text flex items-center justify-center bg-black/80 p-4">
        <div role="dialog" aria-label="Kode Sumber React Vite Pameran Virtual" class="pointer-events-auto w-full max-w-4xl max-h-[88vh] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-2xl text-slate-900">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
            <div>
              <h2 class="text-base font-bold text-slate-900">Struktur Kode Lengkap React + Vite (Pameran Virtual)</h2>
              <p class="text-xs text-slate-500">Kode produksi untuk package.json, Store.js, App.jsx, dan AdminPanel.jsx</p>
            </div>
            <button type="button" id="btn-close-code-modal" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white">
              Tutup ✕
            </button>
          </div>

          <div class="flex items-center justify-between px-6 py-2.5 bg-slate-50 border-b border-slate-200">
            <div class="flex gap-2">
              ${tabs
                .map(
                  (t) => `
                <button
                  type="button"
                  data-code-tab="${t}"
                  class="px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    this.activeReactFileTab === t
                      ? 'bg-amber-500 text-white font-semibold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }"
                >
                  ${t}
                </button>
              `,
                )
                .join('')}
            </div>
            <button type="button" id="btn-copy-react-code" class="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-white font-medium">
              ${this.copyStatusText || `Salin ${this.activeReactFileTab}`}
            </button>
          </div>

          <pre class="no-scrollbar flex-1 overflow-auto p-6 text-xs font-mono text-slate-100 bg-slate-950 leading-relaxed select-all"><code>${this.escapeHtml(code)}</code></pre>
        </div>
      </div>
    `;

    this.container
      .querySelector('#btn-close-code-modal')
      ?.addEventListener('click', () => {
        galleryStore.getState().setCodeModalOpen(false);
      });

    this.container.querySelectorAll('[data-code-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeReactFileTab = btn.getAttribute('data-code-tab') as any;
        this.copyStatusText = '';
        this.render();
      });
    });

    this.container
      .querySelector('#btn-copy-react-code')
      ?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(
            REACT_VITE_FILES[this.activeReactFileTab],
          );
          this.copyStatusText = 'Berhasil Disalin!';
          this.render();
        } catch {
          this.copyStatusText = 'Siap Disalin Manual';
        }
      });
  }

  // ─── AI STUDIO MODAL ───────────────────────────────────────────────────────
  private renderAiStudioModal() {
    const aspectRatios = [
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '9:16',
      '16:9',
      '21:9',
    ];
    const sizes = ['1K', '2K', '4K'];

    this.container.innerHTML = `
      <div data-ui-interactive="true" class="fixed inset-0 z-[310] pointer-events-auto select-text flex items-center justify-center bg-black/80 p-4">
        <div role="dialog" aria-label="Studio Kurator & Media Kreatif" class="pointer-events-auto w-full max-w-3xl max-h-[88vh] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-2xl text-slate-900">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
            <div>
              <h2 class="text-base font-bold text-slate-900">Studio Kurasi & Media Kreatif Nusantara</h2>
              <p class="text-xs text-slate-500">Buat visual karya studio (1K/2K/4K), analisis foto karya, animasikan menjadi video, atau konsultasi kuratorial</p>
            </div>
            <button type="button" id="btn-close-ai-modal" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white">
              Tutup ✕
            </button>
          </div>

          <!-- Tabs -->
          <div class="no-scrollbar flex gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200 overflow-x-auto">
            <button type="button" data-ai-tab="generate" class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${this.aiTab === 'generate' ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700'}">
              Buat Gambar Studio (1K/2K/4K)
            </button>
            <button type="button" data-ai-tab="analyze" class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${this.aiTab === 'analyze' ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700'}">
              Analisis Foto Karya
            </button>
            <button type="button" data-ai-tab="video" class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${this.aiTab === 'video' ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700'}">
              Animasikan Foto ke Video
            </button>
            <button type="button" data-ai-tab="thinking" class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${this.aiTab === 'thinking' ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700'}">
              Riset Kuratorial Mendalam
            </button>
          </div>

          <div class="no-scrollbar flex-1 overflow-y-auto p-6 space-y-4">
            ${
              this.aiError
                ? `<div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">${this.escapeHtml(this.aiError)}</div>`
                : ''
            }

            ${
              this.aiTab === 'generate'
                ? `
              <form id="form-ai-generate" class="space-y-4">
                <div>
                  <label for="ai-gen-prompt" class="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Visual Karya Nusantara</label>
                  <textarea id="ai-gen-prompt" rows="2" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900" placeholder="Lukisan kontemporer burung Cenderawasih Papua dengan aksen batik emas di galeri seni...">Lukisan kanvas kontemporer motif Batik Megamendung dan Burung Garuda dengan pencahayaan studio museum</textarea>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label for="ai-gen-size" class="block text-xs font-semibold text-slate-700 mb-1">Resolusi Gambar (Image Size)</label>
                    <select id="ai-gen-size" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900">
                      ${sizes.map((s) => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label for="ai-gen-ratio" class="block text-xs font-semibold text-slate-700 mb-1">Rasio Aspek (Aspect Ratio)</label>
                    <select id="ai-gen-ratio" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900">
                      ${aspectRatios.map((r) => `<option value="${r}" ${r === '4:3' ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <button type="submit" ${this.aiLoading ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs">
                  ${this.aiLoading ? 'Sedang Membuat Gambar Studio...' : 'Buat Gambar Karya'}
                </button>
              </form>
              ${
                this.aiGeneratedImageUrl
                  ? `<div class="space-y-2 pt-3 border-t border-slate-200">
                      <img src="${this.aiGeneratedImageUrl}" alt="Hasil karya studio" referrerpolicy="no-referrer" class="max-h-72 rounded-xl border border-slate-300 mx-auto" />
                    </div>`
                  : ''
              }
            `
                : ''
            }

            ${
              this.aiTab === 'analyze'
                ? `
              <form id="form-ai-analyze" class="space-y-4">
                <div>
                  <label for="ai-upload-photo" class="block text-xs font-semibold text-slate-700 mb-1">Unggah Foto Lukisan atau Kerajinan</label>
                  <input id="ai-upload-photo" type="file" accept="image/*" class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-800 file:font-semibold" />
                </div>
                <div>
                  <label for="ai-analyze-prompt" class="block text-xs font-semibold text-slate-700 mb-1">Fokus Analisis</label>
                  <input id="ai-analyze-prompt" type="text" value="Identifikasi motif daerah, teknik pembuatan, filosofi budaya, dan estimasi harga jual wajar (IDR)." class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900" />
                </div>
                <button type="submit" ${this.aiLoading ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs">
                  ${this.aiLoading ? 'Menganalisis Karya...' : 'Analisis Foto Karya'}
                </button>
              </form>
              ${
                this.aiAnalysisResult
                  ? `<div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed whitespace-pre-line text-slate-800">${this.escapeHtml(this.aiAnalysisResult)}</div>`
                  : ''
              }
            `
                : ''
            }

            ${
              this.aiTab === 'video'
                ? `
              <form id="form-ai-video" class="space-y-4">
                <div>
                  <label for="ai-video-photo" class="block text-xs font-semibold text-slate-700 mb-1">Unggah Foto Karya untuk Dianimasikan</label>
                  <input id="ai-video-photo" type="file" accept="image/*" class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-800 file:font-semibold" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label for="ai-video-ratio" class="block text-xs font-semibold text-slate-700 mb-1">Rasio Video</label>
                    <select id="ai-video-ratio" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900">
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Portrait)</option>
                    </select>
                  </div>
                  <div>
                    <label for="ai-video-prompt" class="block text-xs font-semibold text-slate-700 mb-1">Arahan Gerak Sinematik</label>
                    <input id="ai-video-prompt" type="text" value="Kamera bergerak perlahan menyapu tekstur lukisan dengan kilau cahaya keemasan galeri." class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900" />
                  </div>
                </div>
                <button type="submit" ${this.aiLoading ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs">
                  ${this.aiLoading ? 'Membuat Video Animasi...' : 'Buat Video Animasi Karya'}
                </button>
              </form>
              ${
                this.aiVideoUrl
                  ? `<div class="pt-3 border-t border-slate-200">
                      <video src="${this.aiVideoUrl}" controls autoplay loop class="max-h-72 rounded-xl mx-auto border border-slate-300"></video>
                    </div>`
                  : ''
              }
            `
                : ''
            }

            ${
              this.aiTab === 'thinking'
                ? `
              <form id="form-ai-thinking" class="space-y-4">
                <div>
                  <label for="ai-thinking-prompt" class="block text-xs font-semibold text-slate-700 mb-1">Pertanyaan Kuratorial & Strategi Pameran Mendalam</label>
                  <textarea id="ai-thinking-prompt" rows="3" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900">Susun konsep narasi tematik Pameran Virtual yang menghubungkan karya lukis Way Kambas, kriya Phinisi Bulukumba, dan tenun Gringsing Bali dalam satu alur edukasi pengunjung.</textarea>
                </div>
                <button type="submit" ${this.aiLoading ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs">
                  ${this.aiLoading ? 'Menyusun Sintesis Kuratorial...' : 'Jalankan Analisis Kuratorial Mendalam'}
                </button>
              </form>
              ${
                this.aiThinkingResult
                  ? `<div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed whitespace-pre-line text-slate-800">${this.escapeHtml(this.aiThinkingResult)}</div>`
                  : ''
              }
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;

    this.attachAiModalEvents();
  }

  private attachAiModalEvents() {
    this.container
      .querySelector('#btn-close-ai-modal')
      ?.addEventListener('click', () => {
        galleryStore.getState().setAiStudioOpen(false);
      });

    this.container.querySelectorAll('[data-ai-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.aiTab = btn.getAttribute('data-ai-tab') as any;
        this.aiError = '';
        this.render();
      });
    });

    const handleFileInput = (inputEl: HTMLInputElement | null) => {
      inputEl?.addEventListener('change', () => {
        const file = inputEl.files?.[0];
        if (!file) return;
        this.uploadedImageMime = file.type || 'image/png';
        const reader = new FileReader();
        reader.onload = () => {
          this.uploadedImageBase64 = String(reader.result || '');
        };
        reader.readAsDataURL(file);
      });
    };

    handleFileInput(
      this.container.querySelector('#ai-upload-photo') as HTMLInputElement | null,
    );
    handleFileInput(
      this.container.querySelector('#ai-video-photo') as HTMLInputElement | null,
    );

    // 1. Generate Image Submit
    this.container
      .querySelector('#form-ai-generate')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = (
          this.container.querySelector('#ai-gen-prompt') as HTMLTextAreaElement
        )?.value;
        const imageSize = (
          this.container.querySelector('#ai-gen-size') as HTMLSelectElement
        )?.value;
        const aspectRatio = (
          this.container.querySelector('#ai-gen-ratio') as HTMLSelectElement
        )?.value;

        this.aiLoading = true;
        this.aiError = '';
        this.render();

        try {
          const res = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, imageSize, aspectRatio }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal membuat gambar');
          this.aiGeneratedImageUrl = data.imageUrl;
        } catch (err: any) {
          this.aiError = err?.message || 'Gagal menghubungi layanan Gemini Image';
        } finally {
          this.aiLoading = false;
          this.render();
        }
      });

    // 2. Analyze Image Submit
    this.container
      .querySelector('#form-ai-analyze')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = (
          this.container.querySelector('#ai-analyze-prompt') as HTMLInputElement
        )?.value;
        const imageBase64 =
          this.uploadedImageBase64 ||
          getArtworkPreviewDataUrl(galleryStore.getState().artworks[0]);

        this.aiLoading = true;
        this.aiError = '';
        this.render();

        try {
          const res = await fetch('/api/ai/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64,
              mimeType: this.uploadedImageMime,
              prompt,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menganalisis foto');
          this.aiAnalysisResult = data.text;
        } catch (err: any) {
          this.aiError = err?.message || 'Gagal menganalisis foto';
        } finally {
          this.aiLoading = false;
          this.render();
        }
      });

    // 3. Animate Video Submit
    this.container
      .querySelector('#form-ai-video')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const aspectRatio = (
          this.container.querySelector('#ai-video-ratio') as HTMLSelectElement
        )?.value;
        const prompt = (
          this.container.querySelector('#ai-video-prompt') as HTMLInputElement
        )?.value;
        const imageBase64 =
          this.uploadedImageBase64 ||
          getArtworkPreviewDataUrl(galleryStore.getState().artworks[0]);

        this.aiLoading = true;
        this.aiError = '';
        this.render();

        try {
          const res = await fetch('/api/ai/animate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64,
              mimeType: this.uploadedImageMime,
              aspectRatio,
              prompt,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal membuat video');
          this.aiVideoUrl = data.videoUrl;
        } catch (err: any) {
          this.aiError = err?.message || 'Gagal menganimasikan video';
        } finally {
          this.aiLoading = false;
          this.render();
        }
      });

    // 4. Deep Curatorial Thinking Submit
    this.container
      .querySelector('#form-ai-thinking')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = (
          this.container.querySelector(
            '#ai-thinking-prompt',
          ) as HTMLTextAreaElement
        )?.value;

        this.aiLoading = true;
        this.aiError = '';
        this.render();

        try {
          const res = await fetch('/api/ai/deep-curatorial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menjalankan analisis');
          this.aiThinkingResult = data.text;
        } catch (err: any) {
          this.aiError = err?.message || 'Gagal menjalankan analisis kuratorial';
        } finally {
          this.aiLoading = false;
          this.render();
        }
      });
  }

  private escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return this.escapeHtml(str).replace(/"/g, '&quot;');
  }
}
