import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import * as xb from 'xrblocks';
import {
  galleryStore,
  ROOMS,
  LIGHTING_THEMES,
  sphericalToCartesian,
  formatIDR,
  shortestAngleDeltaDeg,
} from './store.ts';
import { createSeamlessPanoramaTexture } from './proceduralTextures.ts';
import {
  createArtwork3DNode,
  createRepositoryCabinet3DNode,
  createDirectionalHotspot3D,
} from './proceduralModels.ts';
import type { Artwork, RoomId, LightingThemeId } from './types.ts';

// Pre-allocated scratch math objects (Zero GC in update loop)
const _projVec = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _targetEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export interface PinScreenPosition {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface HotspotScreenPosition {
  targetRoom: RoomId;
  label: string;
  shortLabel: string;
  yaw: number;
  entryYaw: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface RepositoryPinScreenPosition {
  x: number;
  y: number;
  visible: boolean;
}

const photoTextureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

export class Nusantara360Scene extends xb.Script {
  private sphereMesh!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private transitionSphereMesh!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;

  // Optional post-processing pipeline (only allocated when ?postbloom=1 is enabled)
  private composer?: EffectComposer;
  private bloomPass?: UnrealBloomPass;
  private isRenderingComposer = false;
  private resizeListener?: () => void;
  private preloadTimers: number[] = [];

  private artworksGroup = new THREE.Group();
  private hotspotsGroup = new THREE.Group();
  private artworkMeshesMap = new Map<string, THREE.Group>();
  private repositoryNode: THREE.Group | null = null;
  private interactables: THREE.Object3D[] = [];

  // Spatial UI Card inside 3D world (only created when an actual XR headset session starts)
  private spatialCard?: any;
  private spatialTitleText?: any;
  private spatialSubText?: any;
  private spatialStatusText?: any;

  // Camera look, Mobile Legends Analog Joystick & Google Street View FOV transition state
  private cameraYawDeg = ROOMS.ruang_1.defaultYawDeg;
  private cameraPitchDeg = 0;
  private targetYawDeg = ROOMS.ruang_1.defaultYawDeg;
  private targetPitchDeg = 0;
  private currentFov = 70;
  private targetFov = 70;

  // Multi-touch pinch-to-zoom state for mobile & tablet devices
  private activeTouchPoints = new Map<number, { x: number; y: number }>();
  private lastPinchDistance = 0;

  // Smooth walking room-to-room transition (dual-sphere optical crossfade + stride dolly + subtle step bob)
  private walkTransition: {
    targetRoom: RoomId;
    startYaw: number;
    portalYaw: number;
    entryYaw: number;
    startPitch: number;
    baseFov: number;
    startTime: number;
    durationMs: number;
    crossfadeStartedAt: number | null;
    targetTexture: THREE.Texture;
    textureReady: boolean;
    targetYawOffsetDeg: number;
    targetTintHex: number;
  } | null = null;

  // Smooth cubic ease-in-out focus transition when moving focus between artworks
  private focusTransition: {
    startYaw: number;
    endYaw: number;
    startPitch: number;
    endPitch: number;
    startFov: number;
    midFov: number;
    endFov: number;
    startTime: number;
    durationMs: number;
    onComplete?: () => void;
  } | null = null;

  // Dirty-checking state so idle frames do 0 DOM/projection work
  private lastProjectedYaw = NaN;
  private lastProjectedPitch = NaN;
  private lastProjectedFov = NaN;
  private pinsDirty = true;
  private reusablePins: PinScreenPosition[] = [];
  private reusableHotspots: HotspotScreenPosition[] = [];

  // Mobile Legends Analog Joystick normalized vector (-1..1)
  private analogX = 0;
  private analogY = 0;

  // High-sensitivity 360° drag & kinetic inertia state
  private isDragging = false;
  private activePointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastPointerMoveTime = 0;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private dragTotalDist = 0;

  private currentRoomRendered: RoomId | null = null;
  private currentThemeRendered: LightingThemeId | null = null;
  private unsubscribeStore?: () => void;

  private onPinPositionsUpdated?: (
    artworkPins: PinScreenPosition[],
    hotspotPins: HotspotScreenPosition[],
    cameraTelemetry: {
      yaw: number;
      pitch: number;
      bloomStrength: number;
      repositoryPin?: RepositoryPinScreenPosition;
    },
  ) => void;

  constructor(
    onPinPositionsUpdated?: (
      artworkPins: PinScreenPosition[],
      hotspotPins: HotspotScreenPosition[],
      cameraTelemetry: {
        yaw: number;
        pitch: number;
        bloomStrength: number;
        repositoryPin?: RepositoryPinScreenPosition;
      },
    ) => void,
  ) {
    super();
    this.onPinPositionsUpdated = onPinPositionsUpdated;
    const initialFov = this.getResponsiveBaseFov();
    this.currentFov = initialFov;
    this.targetFov = initialFov;
  }

  /**
   * Smart auto-scaling FOV across Mobile Portrait, Tablet, and Desktop PC
   * so portrait screens never feel cramped or over-zoomed.
   */
  public getResponsiveBaseFov(): number {
    if (typeof window === 'undefined') return 70;
    const w = Math.max(window.innerWidth || 1024, 1);
    const h = Math.max(window.innerHeight || 768, 1);
    const aspect = w / h;
    if (aspect < 0.68) return 82; // Smartphone portrait
    if (aspect < 0.98) return 75; // Tablet portrait / foldable
    if (aspect > 2.0) return 66;  // Ultrawide desktop
    return 70;                    // Standard desktop & landscape tablet
  }

  init() {
    const baseFov = this.getResponsiveBaseFov();
    this.currentFov = baseFov;
    this.targetFov = baseFov;

    this.setupRendererAndPostProcessing();
    this.setupLighting();
    this.setupPanoramaSphere();
    this.hideDefaultSimulatorEnvironment();
    this.scheduleBackgroundRoomPreload();

    this.artworksGroup.name = 'ArtworksGroup';
    this.hotspotsGroup.name = 'HotspotsGroup';
    this.artworksGroup.renderOrder = 10;
    this.hotspotsGroup.renderOrder = 10;
    // Prevent XRBlocks internal pointermove raycaster from raycasting scene groups on every mouse move
    (this.artworksGroup as any).xb = { pointerEvents: 'none' };
    (this.hotspotsGroup as any).xb = { pointerEvents: 'none' };
    this.add(this.artworksGroup);
    this.add(this.hotspotsGroup);

    this.setupDesktopPointerControls();

    const state = galleryStore.getState();
    const initialRoom = ROOMS[state.currentRoom] || ROOMS.ruang_1;
    this.cameraYawDeg = initialRoom.defaultYawDeg;
    this.targetYawDeg = initialRoom.defaultYawDeg;

    this.applyThemeAndPanorama(state.currentRoom, state.lightingTheme);
    this.rebuildRoomObjects(state.currentRoom, state.artworks);

    this.unsubscribeStore = galleryStore.subscribe((newState, prevState) => {
      if (
        newState.currentRoom !== prevState.currentRoom ||
        newState.lightingTheme !== prevState.lightingTheme
      ) {
        this.applyThemeAndPanorama(newState.currentRoom, newState.lightingTheme);
        this.pinsDirty = true;
      }
      if (
        newState.currentRoom !== prevState.currentRoom ||
        newState.artworks !== prevState.artworks ||
        newState.levelFilter !== prevState.levelFilter ||
        newState.categoryFilter !== prevState.categoryFilter ||
        newState.searchQuery !== prevState.searchQuery
      ) {
        this.rebuildRoomObjects(newState.currentRoom, newState.artworks);
        this.pinsDirty = true;
      }
      if (
        newState.selectedArtworkId !== prevState.selectedArtworkId ||
        newState.isRepositoryOpen !== prevState.isRepositoryOpen ||
        newState.isCartOpen !== prevState.isCartOpen ||
        newState.isAdminOpen !== prevState.isAdminOpen ||
        newState.isAdminDashboardOpen !== prevState.isAdminDashboardOpen ||
        newState.isCodeModalOpen !== prevState.isCodeModalOpen ||
        newState.isAiStudioOpen !== prevState.isAiStudioOpen ||
        newState.hudCollapsed !== prevState.hudCollapsed
      ) {
        this.updateSpatialCardForSelection(newState.selectedArtworkId);
        this.pinsDirty = true;
      }
    });
  }

  onSimulatorStarted() {
    this.hideDefaultSimulatorEnvironment();
  }

  onXRSessionStarted() {
    // Only instantiate the 3D Spatial UICard when entering an actual XR headset session
    if (!this.spatialCard) {
      this.setupSpatialUI();
      this.updateSpatialCardForSelection(galleryStore.getState().selectedArtworkId);
    }
    if (this.spatialCard) {
      this.spatialCard.visible = true;
    }
    (this.artworksGroup as any).xb = {};
    (this.hotspotsGroup as any).xb = {};
  }

  /**
   * Hides the default XRBlocks desktop simulator 3D living-room environment mesh
   * so that our 5 hyper-realistic 360° equirectangular gallery room panoramas are
   * never occluded by the simulator's living room walls/TV/furniture and zero GPU
   * draw calls are wasted on the simulator room.
   */
  private hideDefaultSimulatorEnvironment() {
    const scene = (xb as any).core?.scene as THREE.Scene | undefined;
    const camera = (xb as any).core?.camera as THREE.Object3D | undefined;
    const user = (xb as any).core?.user as THREE.Object3D | undefined;
    if (!scene) return;

    const containsObject = (root: THREE.Object3D, target?: THREE.Object3D | null): boolean => {
      if (!target) return false;
      let curr: THREE.Object3D | null = target;
      while (curr) {
        if (curr === root) return true;
        curr = curr.parent;
      }
      return false;
    };

    for (const child of scene.children) {
      if (
        child === this ||
        containsObject(child, this) ||
        containsObject(child, camera) ||
        containsObject(child, user)
      ) {
        continue;
      }
      if (child.visible) {
        child.visible = false;
      }
    }
  }

  /**
   * Staggers background preloading of the remaining 360° room panorama JPEGs one by one
   * after the initial room is interactive, avoiding any startup or GPU upload stutter.
   */
  private scheduleBackgroundRoomPreload() {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (conn?.saveData) {
      return;
    }

    const renderer = (xb as any).core?.renderer as THREE.WebGLRenderer | undefined;
    const maxAniso = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 4, 4);

    const activeUrl = ROOMS[galleryStore.getState().currentRoom]?.panoramaUrl;
    const urls = Array.from(
      new Set(Object.values(ROOMS).map((r) => r.panoramaUrl)),
    ).filter((u) => u !== activeUrl);

    const isMobileViewport = window.innerWidth < 768;
    const baseDelayMs = isMobileViewport ? 2400 : 1600;
    const stepDelayMs = isMobileViewport ? 1400 : 1100;

    urls.forEach((url, idx) => {
      const timerId = window.setTimeout(() => {
        if (!photoTextureCache.has(url)) {
          const tex = textureLoader.load(url, (loaded) => {
            loaded.colorSpace = THREE.SRGBColorSpace;
            loaded.minFilter = THREE.LinearFilter;
            loaded.magFilter = THREE.LinearFilter;
            loaded.generateMipmaps = false;
            loaded.anisotropy = maxAniso;
            loaded.needsUpdate = true;
          });
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.anisotropy = maxAniso;
          photoTextureCache.set(url, tex);
        }
      }, baseDelayMs + idx * stepDelayMs);
      this.preloadTimers.push(timerId);
    });
  }

  private getRoomPanoramaTexture(
    room: RoomId,
    themeId: LightingThemeId,
    onReady?: (tex: THREE.Texture) => void,
  ): THREE.Texture {
    const roomSpec = ROOMS[room] || ROOMS.ruang_1;
    const url = roomSpec.panoramaUrl;
    const cached = photoTextureCache.get(url);
    if (cached) {
      if ((cached as any).image) {
        onReady?.(cached);
      } else if (onReady) {
        // Already loading in background: poll lightly until decoded
        const checkReady = () => {
          if ((cached as any).image) {
            onReady(cached);
          } else {
            window.setTimeout(checkReady, 30);
          }
        };
        window.setTimeout(checkReady, 30);
      }
      return cached;
    }

    try {
      const renderer = (xb as any).core?.renderer as THREE.WebGLRenderer | undefined;
      const maxAniso = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 4, 4);
      const tex = textureLoader.load(
        url,
        (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.minFilter = THREE.LinearFilter;
          loaded.magFilter = THREE.LinearFilter;
          loaded.generateMipmaps = false;
          loaded.anisotropy = maxAniso;
          loaded.needsUpdate = true;
          if (this.sphereMesh && this.currentRoomRendered === room) {
            this.sphereMesh.material.map = loaded;
            this.sphereMesh.material.needsUpdate = true;
          }
          this.pinsDirty = true;
          onReady?.(loaded);
        },
        undefined,
        () => {
          const fallbackTex = createSeamlessPanoramaTexture('foyer', themeId);
          photoTextureCache.set(url, fallbackTex);
          if (this.sphereMesh && this.currentRoomRendered === room) {
            this.sphereMesh.material.map = fallbackTex;
            this.sphereMesh.material.needsUpdate = true;
          }
          this.pinsDirty = true;
          onReady?.(fallbackTex);
        },
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.anisotropy = maxAniso;
      photoTextureCache.set(url, tex);
      return tex;
    } catch {
      const fallback = createSeamlessPanoramaTexture('foyer', themeId);
      onReady?.(fallback);
      return fallback;
    }
  }

  private setupRendererAndPostProcessing() {
    const renderer = (xb as any).core?.renderer as THREE.WebGLRenderer | undefined;
    const scene = (xb as any).core?.scene as THREE.Scene | undefined;
    const camera = (xb as any).core?.camera as THREE.PerspectiveCamera | undefined;

    if (renderer) {
      // Lighter pixel ratio cap on mobile for ultra-smooth, fast initial rendering
      const maxDpr = window.innerWidth < 768 ? 1.15 : 1.35;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      const enableHeavyPostBloom = new URLSearchParams(
        window.location.search,
      ).has('postbloom');

      if (enableHeavyPostBloom && scene && camera) {
        try {
          const width = window.innerWidth;
          const height = window.innerHeight;

          const composer = new EffectComposer(renderer);
          const renderPass = new RenderPass(scene, camera);
          composer.addPass(renderPass);

          const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(
              Math.max(1, Math.floor(width * 0.25)),
              Math.max(1, Math.floor(height * 0.25)),
            ),
            0.16,
            0.3,
            0.92,
          );
          composer.addPass(bloomPass);

          const copyPass = new ShaderPass(CopyShader);
          copyPass.needsSwap = false;
          composer.addPass(copyPass);

          this.composer = composer;
          this.bloomPass = bloomPass;

          const originalRender = renderer.render.bind(renderer);
          renderer.render = (renderScene: THREE.Scene, renderCam: THREE.Camera) => {
            if (
              !this.isRenderingComposer &&
              this.composer &&
              !renderer.xr.isPresenting &&
              renderScene === scene
            ) {
              this.isRenderingComposer = true;
              try {
                renderPass.camera = renderCam;
                this.composer.render();
              } finally {
                this.isRenderingComposer = false;
              }
            } else {
              originalRender(renderScene, renderCam);
            }
          };
        } catch (err) {
          console.warn('EffectComposer fallback to standard render:', err);
        }
      }

      this.resizeListener = () => {
        const w = Math.max(window.innerWidth, 1);
        const h = Math.max(window.innerHeight, 1);
        const maxResizeDpr = w < 768 ? 1.15 : 1.25;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxResizeDpr));
        if (!renderer.xr?.isPresenting) {
          renderer.setSize(w, h, false);
        }
        const activeCam = (xb as any).core?.camera as THREE.PerspectiveCamera | undefined;
        if (activeCam && !renderer.xr?.isPresenting) {
          activeCam.aspect = w / h;
          activeCam.updateProjectionMatrix();
        }
        if (!this.focusTransition && !galleryStore.getState().transitioningRoom) {
          this.targetFov = this.getResponsiveBaseFov();
        }
        this.composer?.setSize(w, h);
        this.bloomPass?.resolution.set(
          Math.max(1, Math.floor(w * 0.25)),
          Math.max(1, Math.floor(h * 0.25)),
        );
        this.pinsDirty = true;
      };
      window.addEventListener('resize', this.resizeListener);
      window.addEventListener('orientationchange', this.resizeListener);
      window.visualViewport?.addEventListener('resize', this.resizeListener);
    }
  }

  public setAnalogInput(normX: number, normY: number) {
    this.analogX = THREE.MathUtils.clamp(normX, -1, 1);
    this.analogY = THREE.MathUtils.clamp(normY, -1, 1);
  }

  public getBloomStrength(): number {
    return this.bloomPass ? this.bloomPass.strength : 0.16;
  }

  private setupLighting() {
    const theme = LIGHTING_THEMES[galleryStore.getState().lightingTheme];

    this.hemiLight = new THREE.HemisphereLight(
      theme.ambientColor,
      theme.groundColor,
      theme.ambientIntensity,
    );
    this.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(
      theme.keyLightColor,
      theme.keyLightIntensity,
    );
    this.keyLight.position.set(2, 5, 2);
    this.add(this.keyLight);
  }

  private setupPanoramaSphere() {
    // 48x32 sphere segments give mathematically smooth equirectangular projection with minimal vertex count
    const sphereGeo = new THREE.SphereGeometry(28, 48, 32);
    const state = galleryStore.getState();
    const initialTex = this.getRoomPanoramaTexture(
      state.currentRoom,
      state.lightingTheme,
    );
    const sphereMat = new THREE.MeshBasicMaterial({
      map: initialTex,
      color: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.sphereMesh.scale.set(-1, 1, 1);
    this.sphereMesh.position.set(0, 1.6, 0);
    // Align equirectangular u=0.5 with forward -Z (yaw = 0°)
    const roomSpec = ROOMS[state.currentRoom] || ROOMS.ruang_1;
    this.sphereMesh.rotation.y =
      -Math.PI / 2 + THREE.MathUtils.degToRad(roomSpec.yawOffsetDeg);
    this.sphereMesh.renderOrder = -1000;
    (this.sphereMesh as any).xb = { pointerEvents: 'none' };
    this.add(this.sphereMesh);

    // Secondary concentric panorama sphere (reuses same geometry -> zero extra VRAM)
    // for silky optical crossfade while walking smoothly between rooms.
    const transitionMat = new THREE.MeshBasicMaterial({
      map: initialTex,
      color: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.transitionSphereMesh = new THREE.Mesh(sphereGeo, transitionMat);
    this.transitionSphereMesh.scale.set(-0.985, 0.985, 0.985);
    this.transitionSphereMesh.position.set(0, 1.6, 0);
    this.transitionSphereMesh.renderOrder = -999;
    this.transitionSphereMesh.visible = false;
    (this.transitionSphereMesh as any).xb = { pointerEvents: 'none' };
    this.add(this.transitionSphereMesh);
  }

  private setupSpatialUI() {
    try {
      this.spatialTitleText = new xb.UIText({
        text: 'Galeri Karya Nusantara',
        style: { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
      });
      this.spatialSubText = new xb.UIText({
        text: 'Jelajahi 5 ruangan pameran karya pelajar Indonesia.',
        style: { fontSize: 16, lineHeight: 1.35, opacity: 0.85, textAlign: 'center' },
      });
      this.spatialStatusText = new xb.UIText({
        text: '18 Karya + Galeri Nusantara',
        style: { fontSize: 15, opacity: 0.75, textAlign: 'center' },
      });

      this.spatialCard = new xb.UICard({
        size: { width: 0.64, height: 'auto' },
        manipulation: true,
        edge: true,
        style: { flexDirection: 'column', gap: 12, padding: 18 },
        children: [
          this.spatialTitleText,
          this.spatialSubText,
          this.spatialStatusText,
        ],
      });
      this.spatialCard.position.set(0, 2.35, -3.2);
      this.add(this.spatialCard);
    } catch (e) {
      console.warn('Spatial UICard initialization skipped:', e);
    }
  }

  private updateSpatialCardForSelection(artworkId: string | null) {
    if (!this.spatialTitleText || !this.spatialSubText || !this.spatialStatusText) {
      return;
    }
    if (!artworkId) {
      const room = ROOMS[galleryStore.getState().currentRoom] || ROOMS.ruang_1;
      this.spatialTitleText.text = room.name;
      this.spatialSubText.text = room.subtitle;
      return;
    }
    const art = galleryStore
      .getState()
      .artworks.find((a) => a.id === artworkId);
    if (art) {
      this.spatialTitleText.text = art.title;
      this.spatialSubText.text = `${art.creator} (${art.school}, ${art.region})`;
      this.spatialStatusText.text = `${art.category} · ${formatIDR(art.price)}`;
    }
  }

  private applyThemeAndPanorama(room: RoomId, themeId: LightingThemeId) {
    if (
      this.currentRoomRendered === room &&
      this.currentThemeRendered === themeId
    ) {
      return;
    }
    this.currentRoomRendered = room;
    this.currentThemeRendered = themeId;

    const theme = LIGHTING_THEMES[themeId] || LIGHTING_THEMES.bright_daylight;
    this.hemiLight.color.setHex(theme.ambientColor);
    this.hemiLight.groundColor.setHex(theme.groundColor);
    this.hemiLight.intensity = theme.ambientIntensity;

    this.keyLight.color.setHex(theme.keyLightColor);
    this.keyLight.intensity = theme.keyLightIntensity;

    if (this.bloomPass) {
      this.bloomPass.strength =
        themeId === 'golden_nusantara'
          ? 0.24
          : themeId === 'warm_museum'
            ? 0.2
            : 0.16;
    }

    const renderer = (xb as any).core?.renderer as THREE.WebGLRenderer | undefined;
    if (renderer) {
      renderer.toneMappingExposure = theme.exposure;
    }

    const roomSpec = ROOMS[room] || ROOMS.ruang_1;
    const newPanoTex = this.getRoomPanoramaTexture(room, themeId);
    this.sphereMesh.material.map = newPanoTex;
    this.sphereMesh.material.color.setHex(theme.sphereTintHex);
    this.sphereMesh.rotation.y =
      -Math.PI / 2 + THREE.MathUtils.degToRad(roomSpec.yawOffsetDeg);
    this.sphereMesh.material.needsUpdate = true;

    this.updateSpatialCardForSelection(galleryStore.getState().selectedArtworkId);
  }

  /**
   * Fast O(1) transform update for a single artwork node while dragging Yaw/Pitch sliders in /admin
   * without rebuilding the entire room scene graph or re-rendering all DOM lists.
   */
  public previewArtworkPosition(artworkId: string, yaw: number, pitch: number) {
    const node = this.artworkMeshesMap.get(artworkId);
    if (!node) return;
    const eyeHeight = 1.6;
    const radius = 5.4;
    const pos = sphericalToCartesian(yaw, pitch, radius);
    node.position.set(pos.x, eyeHeight + pos.y, pos.z);
    node.lookAt(0, eyeHeight + pos.y, 0);
    this.pinsDirty = true;
  }

  private rebuildRoomObjects(room: RoomId, allArtworks: Artwork[]) {
    while (this.artworksGroup.children.length > 0) {
      this.artworksGroup.remove(this.artworksGroup.children[0]);
    }
    while (this.hotspotsGroup.children.length > 0) {
      this.hotspotsGroup.remove(this.hotspotsGroup.children[0]);
    }
    this.artworkMeshesMap.clear();
    this.repositoryNode = null;
    this.interactables = [];

    const state = galleryStore.getState();
    const visibleArtworks = allArtworks.filter((art) => {
      if (art.room !== room) return false;
      if (state.levelFilter !== 'ALL' && art.level !== state.levelFilter) {
        return false;
      }
      if (
        state.categoryFilter !== 'ALL' &&
        art.category !== state.categoryFilter
      ) {
        return false;
      }
      if (state.searchQuery.trim() !== '') {
        const q = state.searchQuery.toLowerCase();
        const match =
          art.title.toLowerCase().includes(q) ||
          art.creator.toLowerCase().includes(q) ||
          art.region.toLowerCase().includes(q) ||
          art.school.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const eyeHeight = 1.6;
    const radius = 5.4;

    for (const art of visibleArtworks) {
      const node = createArtwork3DNode(art);
      const pos = sphericalToCartesian(art.yaw, art.pitch, radius);
      node.position.set(pos.x, eyeHeight + pos.y, pos.z);
      node.lookAt(0, eyeHeight + pos.y, 0);
      this.artworksGroup.add(node);
      this.artworkMeshesMap.set(art.id, node);
      this.interactables.push(node);
    }

    // Place 3D interactive marker on the room's physical Galeri cabinet
    const roomSpec = ROOMS[room] || ROOMS.ruang_1;
    const repoNode = createRepositoryCabinet3DNode(roomSpec.code);
    const repoPos = sphericalToCartesian(
      roomSpec.repositoryYawDeg,
      roomSpec.repositoryPitchDeg,
      radius,
    );
    repoNode.position.set(repoPos.x, eyeHeight + repoPos.y, repoPos.z);
    repoNode.lookAt(0, eyeHeight + repoPos.y, 0);
    this.artworksGroup.add(repoNode);
    this.repositoryNode = repoNode;
    this.interactables.push(repoNode);

    // Build Street-View Directional Floor Chevrons for all portals in the current room
    for (const portal of roomSpec.portals) {
      const dist = portal.distance || 3.4;
      const rad = THREE.MathUtils.degToRad(portal.yaw);
      const hx = Math.sin(rad) * dist;
      const hz = -Math.cos(rad) * dist;

      const hotspotNode = createDirectionalHotspot3D(
        portal.targetRoom,
        portal.label,
        portal.shortLabel,
      );
      hotspotNode.userData.portalYaw = portal.yaw;
      hotspotNode.userData.entryYaw = portal.entryYaw;
      hotspotNode.position.set(hx, 0.12, hz);
      // Point the floor chevron in the direction of portal.yaw
      hotspotNode.rotation.y = -rad;

      this.hotspotsGroup.add(hotspotNode);
      this.interactables.push(hotspotNode);
    }
  }

  /**
   * Google Street View style room transition:
   * Smoothly faces the portal direction, zooms in FOV, switches to the target 360° room,
   * and settles at the target room's entryYaw.
   */
  public getCameraOrientation(): { yaw: number; pitch: number } {
    const normYaw = ((((Math.round(this.cameraYawDeg) % 360) + 540) % 360) - 180);
    const normPitch = THREE.MathUtils.clamp(Math.round(this.cameraPitchDeg), -45, 45);
    return { yaw: normYaw, pitch: normPitch };
  }

  public triggerRoomTransition(
    targetRoom: RoomId,
    portalYaw?: number,
    entryYaw?: number,
  ) {
    const state = galleryStore.getState();
    if (state.transitioningRoom || state.currentRoom === targetRoom) return;

    this.focusTransition = null;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.isDragging = false;
    this.activePointerId = null;

    state.setTransitioningRoom(true);
    const nextRoomSpec = ROOMS[targetRoom] || ROOMS.ruang_1;
    const theme = LIGHTING_THEMES[state.lightingTheme] || LIGHTING_THEMES.bright_daylight;

    const resolvedPortalYaw =
      typeof portalYaw === 'number'
        ? this.cameraYawDeg + shortestAngleDeltaDeg(this.cameraYawDeg, portalYaw)
        : this.cameraYawDeg;
    const resolvedEntryYaw =
      typeof entryYaw === 'number' ? entryYaw : nextRoomSpec.defaultYawDeg;

    const walkState = {
      targetRoom,
      startYaw: this.cameraYawDeg,
      portalYaw: resolvedPortalYaw,
      entryYaw: resolvedEntryYaw,
      startPitch: this.cameraPitchDeg,
      baseFov: this.getResponsiveBaseFov(),
      startTime: performance.now(),
      durationMs: 760,
      crossfadeStartedAt: null as number | null,
      targetTexture: null as unknown as THREE.Texture,
      textureReady: false,
      targetYawOffsetDeg: nextRoomSpec.yawOffsetDeg,
      targetTintHex: theme.sphereTintHex,
    };

    const tex = this.getRoomPanoramaTexture(targetRoom, state.lightingTheme, (loadedTex) => {
      walkState.targetTexture = loadedTex;
      walkState.textureReady = true;
      if (this.walkTransition === walkState && this.transitionSphereMesh) {
        this.transitionSphereMesh.material.map = loadedTex;
        this.transitionSphereMesh.material.needsUpdate = true;
      }
    });
    walkState.targetTexture = tex;
    if ((tex as any).image) {
      walkState.textureReady = true;
    }

    if (this.transitionSphereMesh) {
      this.transitionSphereMesh.material.map = walkState.targetTexture;
      this.transitionSphereMesh.material.color.setHex(theme.sphereTintHex);
      this.transitionSphereMesh.material.opacity = 0;
      this.transitionSphereMesh.material.needsUpdate = true;
      this.transitionSphereMesh.visible = false;
    }

    this.walkTransition = walkState;
    this.pinsDirty = true;
  }

  /**
   * Smoothly glides the 360° camera focus from its current orientation (or previous artwork)
   * to the target artwork using shortest-angle cubic ease-in-out interpolation and a subtle
   * cinematic FOV arc.
   */
  public focusCameraOnArtwork(
    artwork: Artwork,
    options?: { durationMs?: number; onComplete?: () => void },
  ) {
    if (galleryStore.getState().currentRoom !== artwork.room) {
      galleryStore.getState().setRoom(artwork.room);
    }
    this.velocityYaw = 0;
    this.velocityPitch = 0;

    const deltaYaw = shortestAngleDeltaDeg(this.cameraYawDeg, artwork.yaw);
    const endYaw = this.cameraYawDeg + deltaYaw;
    const endPitch = THREE.MathUtils.clamp(artwork.pitch, -35, 35);
    const angularDistance = Math.hypot(
      deltaYaw,
      endPitch - this.cameraPitchDeg,
    );

    const durationMs =
      options?.durationMs ??
      THREE.MathUtils.clamp(380 + angularDistance * 2.1, 420, 760);

    const baseFov = this.getResponsiveBaseFov();
    const settleFov = Math.max(62, baseFov - 4);
    const midFov = angularDistance > 35 ? Math.min(86, baseFov + 4) : baseFov - 1;

    this.targetYawDeg = endYaw;
    this.targetPitchDeg = endPitch;
    this.targetFov = settleFov;

    const transitionObj = {
      startYaw: this.cameraYawDeg,
      endYaw,
      startPitch: this.cameraPitchDeg,
      endPitch,
      startFov: this.currentFov,
      midFov,
      endFov: settleFov,
      startTime: performance.now(),
      durationMs,
      onComplete: options?.onComplete,
    };
    this.focusTransition = transitionObj;
    this.pinsDirty = true;

    if (options?.onComplete) {
      window.setTimeout(() => {
        if (this.focusTransition === transitionObj) {
          const cb = transitionObj.onComplete;
          this.focusTransition = null;
          this.cameraYawDeg = transitionObj.endYaw;
          this.targetYawDeg = transitionObj.endYaw;
          this.cameraPitchDeg = transitionObj.endPitch;
          this.targetPitchDeg = transitionObj.endPitch;
          this.currentFov = transitionObj.endFov;
          this.targetFov = transitionObj.endFov;
          this.pinsDirty = true;
          cb?.();
        }
      }, durationMs + 60);
    }
  }

  public focusCameraOnRepository() {
    const roomSpec = ROOMS[galleryStore.getState().currentRoom] || ROOMS.ruang_1;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    const deltaYaw = shortestAngleDeltaDeg(
      this.cameraYawDeg,
      roomSpec.repositoryYawDeg,
    );
    const endYaw = this.cameraYawDeg + deltaYaw;
    const endPitch = THREE.MathUtils.clamp(roomSpec.repositoryPitchDeg, -35, 35);
    const baseFov = this.getResponsiveBaseFov();
    this.targetYawDeg = endYaw;
    this.targetPitchDeg = endPitch;
    this.focusTransition = {
      startYaw: this.cameraYawDeg,
      endYaw,
      startPitch: this.cameraPitchDeg,
      endPitch,
      startFov: this.currentFov,
      midFov: Math.min(86, baseFov + 2),
      endFov: Math.max(64, baseFov - 2),
      startTime: performance.now(),
      durationMs: 520,
    };
  }

  public adjustCameraYaw(deltaDeg: number) {
    this.focusTransition = null;
    this.velocityYaw = 0;
    this.targetYawDeg += deltaDeg;
  }

  public adjustCameraPitch(deltaDeg: number) {
    this.focusTransition = null;
    this.velocityPitch = 0;
    this.targetPitchDeg = THREE.MathUtils.clamp(
      this.targetPitchDeg + deltaDeg,
      -45,
      45,
    );
  }

  public resetCameraView() {
    const roomSpec = ROOMS[galleryStore.getState().currentRoom] || ROOMS.ruang_1;
    const baseFov = this.getResponsiveBaseFov();
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    const endYaw =
      this.cameraYawDeg +
      shortestAngleDeltaDeg(this.cameraYawDeg, roomSpec.defaultYawDeg);
    this.targetYawDeg = endYaw;
    this.targetPitchDeg = 0;
    this.targetFov = baseFov;
    this.focusTransition = {
      startYaw: this.cameraYawDeg,
      endYaw,
      startPitch: this.cameraPitchDeg,
      endPitch: 0,
      startFov: this.currentFov,
      midFov: Math.min(86, baseFov + 2),
      endFov: baseFov,
      startTime: performance.now(),
      durationMs: 480,
    };
  }

  private isAnyModalOpen(): boolean {
    const st = galleryStore.getState();
    return Boolean(
      st.selectedArtworkId ||
        st.isRepositoryOpen ||
        st.isCartOpen ||
        st.isAdminOpen ||
        st.isAdminDashboardOpen ||
        st.isCodeModalOpen ||
        st.isAiStudioOpen,
    );
  }

  private setupDesktopPointerControls() {
    window.addEventListener('pointerdown', (e) => {
      if (this.isAnyModalOpen() || this.walkTransition) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('[data-ui-interactive="true"]') ||
          target.closest('button, a, input, select, textarea, aside, nav'))
      ) {
        return;
      }

      if (e.pointerType === 'touch') {
        this.activeTouchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.activeTouchPoints.size === 2) {
          const pts = Array.from(this.activeTouchPoints.values());
          this.lastPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          this.isDragging = false;
          this.activePointerId = null;
          return;
        }
      }

      this.isDragging = true;
      this.activePointerId = e.pointerId;
      this.dragTotalDist = 0;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.lastPointerMoveTime = performance.now();
      this.velocityYaw = 0;
      this.velocityPitch = 0;
      this.focusTransition = null;
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && this.activeTouchPoints.has(e.pointerId)) {
        this.activeTouchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.activeTouchPoints.size === 2 && !this.isAnyModalOpen()) {
          const pts = Array.from(this.activeTouchPoints.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (this.lastPinchDistance > 0) {
            const deltaDist = this.lastPinchDistance - dist;
            this.targetFov = THREE.MathUtils.clamp(
              this.targetFov + deltaDist * 0.14,
              38,
              90,
            );
            this.pinsDirty = true;
          }
          this.lastPinchDistance = dist;
          return;
        }
      }

      if (!this.isDragging) return;
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
        return;
      }
      if (this.isAnyModalOpen()) {
        this.isDragging = false;
        this.activePointerId = null;
        return;
      }

      const now = performance.now();
      const dtMs = Math.max(now - this.lastPointerMoveTime, 4);
      this.lastPointerMoveTime = now;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.dragTotalDist += Math.hypot(dx, dy);
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      // Responsive & sensitive Street-View 360° pan (scales with current FOV for natural precision)
      const fovScale = this.currentFov / 70;
      const isTouch = e.pointerType === 'touch' || window.innerWidth < 768;
      const yawSens = (isTouch ? 0.48 : 0.40) * fovScale;
      const pitchSens = (isTouch ? 0.36 : 0.30) * fovScale;

      const deltaYaw = -dx * yawSens;
      const deltaPitch = dy * pitchSens;

      this.targetYawDeg += deltaYaw;
      this.targetPitchDeg = THREE.MathUtils.clamp(
        this.targetPitchDeg + deltaPitch,
        -45,
        45,
      );

      // Update instantaneous angular velocity (degrees/sec) for smooth coasting inertia on release
      const instVelYaw = (deltaYaw / dtMs) * 1000;
      const instVelPitch = (deltaPitch / dtMs) * 1000;
      this.velocityYaw = THREE.MathUtils.lerp(this.velocityYaw, instVelYaw, 0.55);
      this.velocityPitch = THREE.MathUtils.lerp(
        this.velocityPitch,
        instVelPitch,
        0.55,
      );
    });

    const endDrag = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        this.activeTouchPoints.delete(e.pointerId);
        if (this.activeTouchPoints.size < 2) {
          this.lastPinchDistance = 0;
        }
      }
      if (!this.isDragging) return;
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
        return;
      }
      this.isDragging = false;
      this.activePointerId = null;

      // If the user held still before releasing (>90ms), zero out coasting velocity
      if (performance.now() - this.lastPointerMoveTime > 90) {
        this.velocityYaw = 0;
        this.velocityPitch = 0;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('[data-ui-interactive="true"]') ||
          target.closest('button, a, input, select, textarea, aside, nav'))
      ) {
        return;
      }
      if (this.dragTotalDist < 6 && !this.isAnyModalOpen()) {
        this.handleCanvasTapRaycast(e.clientX, e.clientY);
      }
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    window.addEventListener(
      'wheel',
      (e) => {
        if (this.isAnyModalOpen()) return;
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-ui-interactive="true"]')) {
          return;
        }
        this.targetFov = THREE.MathUtils.clamp(
          this.targetFov + e.deltaY * 0.035,
          38,
          90,
        );
      },
      { passive: true },
    );

    window.addEventListener('keydown', (e) => {
      if (this.isAnyModalOpen()) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.focusTransition = null;
        this.velocityYaw = 0;
        this.targetYawDeg -= 22;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.focusTransition = null;
        this.velocityYaw = 0;
        this.targetYawDeg += 22;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.focusTransition = null;
        this.velocityPitch = 0;
        this.targetPitchDeg = THREE.MathUtils.clamp(this.targetPitchDeg + 12, -45, 45);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.focusTransition = null;
        this.velocityPitch = 0;
        this.targetPitchDeg = THREE.MathUtils.clamp(this.targetPitchDeg - 12, -45, 45);
      }
    });
  }

  private handleCanvasTapRaycast(clientX: number, clientY: number) {
    const camera = (xb as any).core?.camera as THREE.PerspectiveCamera | undefined;
    if (!camera) return;

    _pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
    _pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;

    _raycaster.setFromCamera(_pointerNdc, camera);
    const hits = _raycaster.intersectObjects(this.interactables, true);
    if (hits.length === 0) return;

    const hitObj = hits[0].object;
    let curr: THREE.Object3D | null = hitObj;
    while (curr) {
      if (curr.userData?.artworkId) {
        const art = galleryStore
          .getState()
          .artworks.find((a) => a.id === curr?.userData?.artworkId);
        if (art) {
          this.focusCameraOnArtwork(art);
        }
        galleryStore.getState().selectArtwork(curr.userData.artworkId);
        return;
      }
      if (curr.userData?.type === 'repository') {
        this.focusCameraOnRepository();
        galleryStore.getState().setRepositoryOpen(true);
        return;
      }
      if (curr.userData?.type === 'hotspot' && curr.userData?.targetRoom) {
        this.triggerRoomTransition(
          curr.userData.targetRoom,
          curr.userData.portalYaw,
          curr.userData.entryYaw,
        );
        return;
      }
      curr = curr.parent;
    }
  }

  onSelectEnd(event: xb.SelectEvent) {
    const target = (event as any)?.target as THREE.Object3D | undefined;
    let curr: THREE.Object3D | null = target || null;
    while (curr) {
      if (curr.userData?.artworkId) {
        galleryStore.getState().selectArtwork(curr.userData.artworkId);
        return;
      }
      if (curr.userData?.type === 'repository') {
        this.focusCameraOnRepository();
        galleryStore.getState().setRepositoryOpen(true);
        return;
      }
      if (curr.userData?.type === 'hotspot' && curr.userData?.targetRoom) {
        this.triggerRoomTransition(
          curr.userData.targetRoom,
          curr.userData.portalYaw,
          curr.userData.entryYaw,
        );
        return;
      }
      curr = curr.parent;
    }
  }

  update() {
    const dt = Math.min((xb as any).getDeltaTime?.() || 0.016, 0.06);
    let walkOffsetX = 0;
    let walkOffsetY = 0;
    let walkOffsetZ = 0;

    if (this.walkTransition) {
      const wt = this.walkTransition;
      const now = performance.now();
      const elapsed = now - wt.startTime;
      const rawT = THREE.MathUtils.clamp(elapsed / wt.durationMs, 0, 1);

      // Phase 1 (0..0.46): smoothly turn to face portal & level gaze while stepping forward
      const turnT = THREE.MathUtils.clamp(rawT / 0.46, 0, 1);
      const turnEase =
        turnT < 0.5
          ? 4 * turnT * turnT * turnT
          : 1 - Math.pow(-2 * turnT + 2, 3) / 2;

      this.cameraYawDeg = THREE.MathUtils.lerp(wt.startYaw, wt.portalYaw, turnEase);
      this.cameraPitchDeg = THREE.MathUtils.lerp(wt.startPitch, 0, turnEase);
      this.targetYawDeg = this.cameraYawDeg;
      this.targetPitchDeg = this.cameraPitchDeg;

      // Optical crossfade begins smoothly at ~22% into the step once the target texture is decoded
      let crossfadeAlpha = 0;
      if (rawT >= 0.22 && wt.textureReady) {
        if (wt.crossfadeStartedAt === null) {
          wt.crossfadeStartedAt = now;
        }
        const cfT = THREE.MathUtils.clamp((now - wt.crossfadeStartedAt) / 430, 0, 1);
        // Quintic smoothstep for cinema-grade optical dissolve
        crossfadeAlpha = cfT * cfT * cfT * (cfT * (cfT * 6 - 15) + 10);

        if (this.transitionSphereMesh) {
          this.transitionSphereMesh.visible = true;
          this.transitionSphereMesh.material.opacity = crossfadeAlpha;
          // Mathematically align incoming room's entryYaw to current cameraYawDeg so swap is 100% seamless
          this.transitionSphereMesh.rotation.y =
            -Math.PI / 2 +
            THREE.MathUtils.degToRad(wt.targetYawOffsetDeg) -
            THREE.MathUtils.degToRad(this.cameraYawDeg - wt.entryYaw);
        }
      }

      // Hide old room 3D props cleanly once halfway through the doorway
      const hideProps = crossfadeAlpha > 0.35;
      this.artworksGroup.visible = !hideProps;
      this.hotspotsGroup.visible = !hideProps;

      // Natural walking stride dolly + subtle two-step footstep bob (smoothly zeroed at start & end)
      const strideWindow = Math.sin(rawT * Math.PI);
      const strideForward = strideWindow * 0.9;
      const yawRad = THREE.MathUtils.degToRad(this.cameraYawDeg);
      walkOffsetX = Math.sin(yawRad) * strideForward;
      walkOffsetZ = -Math.cos(yawRad) * strideForward;
      walkOffsetY = Math.sin(rawT * Math.PI * 2) * 0.03 * strideWindow;

      // Street-View forward-glide FOV arc: glides inward toward doorway, then opens smoothly into new room
      const zoomFov = Math.max(46, wt.baseFov - 15);
      if (rawT < 0.44) {
        const zT = rawT / 0.44;
        const zEase = zT * zT * (3 - 2 * zT);
        this.currentFov = THREE.MathUtils.lerp(wt.baseFov, zoomFov, zEase);
      } else {
        const oT = (rawT - 0.44) / 0.56;
        const oEase = 1 - Math.pow(1 - oT, 3);
        this.currentFov = THREE.MathUtils.lerp(zoomFov, wt.baseFov, oEase);
      }
      this.targetFov = wt.baseFov;
      this.pinsDirty = true;

      // Finish atomically once both the walking arc and optical dissolve reach 100% (or fallback after 2.4s max)
      const crossfadeDone =
        (wt.crossfadeStartedAt !== null && crossfadeAlpha >= 0.999) ||
        elapsed > 2400;
      if (rawT >= 1 && crossfadeDone) {
        const finishedRoom = wt.targetRoom;
        const finishedEntryYaw = wt.entryYaw;
        const finishedBaseFov = wt.baseFov;
        this.walkTransition = null;

        galleryStore.getState().setRoom(finishedRoom);
        this.cameraYawDeg = finishedEntryYaw;
        this.targetYawDeg = finishedEntryYaw;
        this.cameraPitchDeg = 0;
        this.targetPitchDeg = 0;
        this.currentFov = finishedBaseFov;
        this.targetFov = finishedBaseFov;

        if (this.transitionSphereMesh) {
          this.transitionSphereMesh.visible = false;
          this.transitionSphereMesh.material.opacity = 0;
        }
        this.artworksGroup.visible = true;
        this.hotspotsGroup.visible = true;
        walkOffsetX = 0;
        walkOffsetY = 0;
        walkOffsetZ = 0;
        this.pinsDirty = true;
        galleryStore.getState().setTransitioningRoom(false);
      }
    } else if (Math.abs(this.analogX) > 0.01 || Math.abs(this.analogY) > 0.01) {
      // Apply Mobile Legends Virtual Analog Joystick continuous rotation
      this.focusTransition = null;
      const yawSpeed = 120;
      const pitchSpeed = 72;
      this.velocityYaw = 0;
      this.velocityPitch = 0;
      this.targetYawDeg += this.analogX * yawSpeed * dt;
      this.targetPitchDeg = THREE.MathUtils.clamp(
        this.targetPitchDeg - this.analogY * pitchSpeed * dt,
        -45,
        45,
      );
    } else if (this.focusTransition) {
      const tr = this.focusTransition;
      const elapsed = performance.now() - tr.startTime;
      const t = THREE.MathUtils.clamp(
        elapsed / Math.max(tr.durationMs, 1),
        0,
        1,
      );
      // Cubic ease-in-out for silky camera focus transition between artworks
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.cameraYawDeg = THREE.MathUtils.lerp(tr.startYaw, tr.endYaw, ease);
      this.cameraPitchDeg = THREE.MathUtils.lerp(
        tr.startPitch,
        tr.endPitch,
        ease,
      );
      this.targetYawDeg = this.cameraYawDeg;
      this.targetPitchDeg = this.cameraPitchDeg;

      // Quadratic Bezier dolly arc for FOV (widens slightly mid-flight, settles on target)
      const inv = 1 - ease;
      this.currentFov =
        inv * inv * tr.startFov +
        2 * inv * ease * tr.midFov +
        ease * ease * tr.endFov;
      this.targetFov = tr.endFov;
      this.pinsDirty = true;

      if (t >= 1) {
        const doneCb = tr.onComplete;
        this.focusTransition = null;
        this.cameraYawDeg = tr.endYaw;
        this.targetYawDeg = tr.endYaw;
        this.cameraPitchDeg = tr.endPitch;
        this.targetPitchDeg = tr.endPitch;
        this.currentFov = tr.endFov;
        this.targetFov = tr.endFov;
        doneCb?.();
      }
    } else if (!this.isDragging) {
      // Apply smooth Street-View kinetic inertia coasting after releasing a flick/drag
      if (Math.abs(this.velocityYaw) > 0.15 || Math.abs(this.velocityPitch) > 0.15) {
        this.targetYawDeg += this.velocityYaw * dt;
        this.targetPitchDeg = THREE.MathUtils.clamp(
          this.targetPitchDeg + this.velocityPitch * dt,
          -45,
          45,
        );
        const friction = Math.exp(-6.5 * dt);
        this.velocityYaw *= friction;
        this.velocityPitch *= friction;
      } else {
        this.velocityYaw = 0;
        this.velocityPitch = 0;
      }
    }

    if (!this.focusTransition && !this.walkTransition) {
      // Instant tracking while dragging (zero input lag), smooth damping during normal view
      const dampFactor = this.isDragging
        ? 1 - Math.exp(-42 * dt)
        : 1 - Math.exp(-18 * dt);

      this.cameraYawDeg = THREE.MathUtils.lerp(
        this.cameraYawDeg,
        this.targetYawDeg,
        dampFactor,
      );
      this.cameraPitchDeg = THREE.MathUtils.lerp(
        this.cameraPitchDeg,
        this.targetPitchDeg,
        dampFactor,
      );
      this.currentFov = THREE.MathUtils.lerp(
        this.currentFov,
        this.targetFov,
        1 - Math.exp(-18 * dt),
      );
    }

    const camera = (xb as any).core?.camera as THREE.PerspectiveCamera | undefined;
    const renderer = (xb as any).core?.renderer as THREE.WebGLRenderer | undefined;
    const isPresentingXr = Boolean(renderer?.xr?.isPresenting);

    this.hideDefaultSimulatorEnvironment();

    if (this.spatialCard) {
      this.spatialCard.visible = isPresentingXr;
    }

    if (camera && !isPresentingXr) {
      camera.position.set(walkOffsetX, 1.6 + walkOffsetY, walkOffsetZ);
      _targetEuler.set(
        THREE.MathUtils.degToRad(this.cameraPitchDeg),
        THREE.MathUtils.degToRad(-this.cameraYawDeg),
        0,
        'YXZ',
      );
      camera.quaternion.setFromEuler(_targetEuler);
      if (Math.abs(camera.fov - this.currentFov) > 0.05) {
        camera.fov = this.currentFov;
        camera.updateProjectionMatrix();
      }
    }

    // Project 3D artwork pins, Galeri pin & Street-View floor portals to 2D viewport coordinates
    // Only project and touch DOM when camera has moved or scene pins changed
    const cameraMoved =
      Math.abs(this.cameraYawDeg - this.lastProjectedYaw) > 0.025 ||
      Math.abs(this.cameraPitchDeg - this.lastProjectedPitch) > 0.025 ||
      Math.abs(this.currentFov - this.lastProjectedFov) > 0.025;

    if (camera && this.onPinPositionsUpdated && (cameraMoved || this.pinsDirty || isPresentingXr)) {
      this.lastProjectedYaw = this.cameraYawDeg;
      this.lastProjectedPitch = this.cameraPitchDeg;
      this.lastProjectedFov = this.currentFov;
      this.pinsDirty = false;

      camera.updateMatrixWorld();

      const w = window.innerWidth;
      const h = window.innerHeight;
      this.reusablePins.length = 0;

      for (const [id, group] of this.artworkMeshesMap.entries()) {
        _projVec.copy(group.position).project(camera);
        const visible =
          _projVec.z <= 1.0 &&
          _projVec.x >= -1.02 &&
          _projVec.x <= 1.02 &&
          _projVec.y >= -1.02 &&
          _projVec.y <= 1.02;
        const sx = (_projVec.x * 0.5 + 0.5) * w;
        const sy = (-(_projVec.y * 0.5) + 0.5) * h;
        this.reusablePins.push({ id, x: sx, y: sy, visible });
      }

      let repositoryPin: RepositoryPinScreenPosition | undefined;
      if (this.repositoryNode) {
        _projVec.copy(this.repositoryNode.position).project(camera);
        const repoVisible =
          _projVec.z <= 1.0 &&
          _projVec.x >= -1.02 &&
          _projVec.x <= 1.02 &&
          _projVec.y >= -1.02 &&
          _projVec.y <= 1.02;
        repositoryPin = {
          x: (_projVec.x * 0.5 + 0.5) * w,
          y: (-(_projVec.y * 0.5) + 0.5) * h,
          visible: repoVisible,
        };
      }

      this.reusableHotspots.length = 0;
      for (const hs of this.hotspotsGroup.children) {
        _worldPos.copy(hs.position);
        _worldPos.y += 0.12;
        _projVec.copy(_worldPos).project(camera);
        const visible =
          _projVec.z <= 1.0 &&
          _projVec.x >= -1.05 &&
          _projVec.x <= 1.05 &&
          _projVec.y >= -1.05 &&
          _projVec.y <= 1.05;
        this.reusableHotspots.push({
          targetRoom: hs.userData.targetRoom,
          label: hs.userData.label,
          shortLabel: hs.userData.shortLabel || hs.userData.label,
          yaw: hs.userData.portalYaw ?? 0,
          entryYaw: hs.userData.entryYaw ?? 0,
          x: (_projVec.x * 0.5 + 0.5) * w,
          y: (-(_projVec.y * 0.5) + 0.5) * h,
          visible,
        });
      }

      const normYaw = ((((Math.round(this.cameraYawDeg) % 360) + 540) % 360) - 180);
      this.onPinPositionsUpdated(this.reusablePins, this.reusableHotspots, {
        yaw: normYaw,
        pitch: Math.round(this.cameraPitchDeg),
        bloomStrength: Number(this.getBloomStrength().toFixed(2)),
        repositoryPin,
      });
    }
  }

  dispose() {
    this.unsubscribeStore?.();
    for (const t of this.preloadTimers) {
      window.clearTimeout(t);
    }
    this.preloadTimers = [];
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    this.composer?.dispose();
    this.sphereMesh?.geometry.dispose();
    this.sphereMesh?.material.dispose();
    this.transitionSphereMesh?.material.dispose();
  }
}
