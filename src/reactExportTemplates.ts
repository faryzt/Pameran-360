/**
 * Provides the complete, copy-ready React + Vite source files requested by the user:
 * 1. package.json (three, @react-three/fiber, @react-three/drei, zustand, lucide-react, tailwindcss)
 * 2. Store.js (Zustand state & 18 Nusantara SD-SMA artworks)
 * 3. App.jsx (360 Equirectangular Street-View scene, hotspots, pins, detail modal, cart)
 * 4. AdminPanel.jsx (Full CRUD form, live Yaw/Pitch sliders, lighting theme toggle)
 */

export const REACT_VITE_FILES: Record<
  'package.json' | 'Store.js' | 'App.jsx' | 'AdminPanel.jsx',
  string
> = {
  'package.json': `{
  "name": "nusantara-360-galeri-pelajar",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 3000 --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^9.120.4",
    "@react-three/fiber": "^8.17.10",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.170.0",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.3"
  }
}`,

  'Store.js': `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const INITIAL_ARTWORKS = [
  {
    id: 'art-1',
    title: 'Harmoni Gajah & Flora Way Kambas',
    creator: 'Bima Pratama',
    level: 'SD',
    school: 'SDN 1 Metro',
    region: 'Lampung',
    category: 'Dinding',
    price: 450000,
    yaw: -150,
    pitch: 6,
    room: 'interior',
    whatsapp: '6281271001001',
    description: 'Lukisan akrilik kawanan gajah Sumatera di Taman Nasional Way Kambas dengan sentuhan ornamen tapis Lampung.'
  },
  {
    id: 'art-2',
    title: 'Tari Topeng & Semarak Pamekasan',
    creator: 'Aisyah Putri',
    level: 'SD',
    school: 'SDN Gladak Anyar 2',
    region: 'Pamekasan, Madura',
    category: 'Dinding',
    price: 380000,
    yaw: -110,
    pitch: 6,
    room: 'interior',
    whatsapp: '6281271001002',
    description: 'Lukisan ekspresif gerak Tari Topeng Ghettak Pamekasan dengan sapuan warna merah berani dan emas.'
  },
  {
    id: 'art-3',
    title: 'Miniatur Phinisi Penjelajah',
    creator: 'Rafi Alamsyah',
    level: 'SMP',
    school: 'SMPN 2 Bulukumba',
    region: 'Sulawesi Selatan',
    category: 'Rak Display',
    price: 850000,
    yaw: -65,
    pitch: -12,
    room: 'interior',
    whatsapp: '6281271001003',
    description: 'Kriya kayu jati dan mahoni rakitan tangan dengan tujuh layar terkembang warisan kapal Phinisi Bulukumba.'
  },
  {
    id: 'art-4',
    title: 'Ukiran Tameng Dayak Kenyah',
    creator: 'Clara Sinta',
    level: 'SMP',
    school: 'SMPN 1 Samarinda',
    region: 'Kalimantan Timur',
    category: 'Rak Display',
    price: 920000,
    yaw: -25,
    pitch: -12,
    room: 'interior',
    whatsapp: '6281271001004',
    description: 'Replika perisai Talawang kayu ulin berukir motif Kamang dan burung Enggang khas Kalimantan Timur.'
  },
  {
    id: 'art-5',
    title: 'Tenun Ikat Gringsing Kontemporer',
    creator: 'Ni Putu Ayu',
    level: 'SMA',
    school: 'SMAN 1 Karangasem',
    region: 'Bali',
    category: 'Dinding',
    price: 1450000,
    yaw: 20,
    pitch: 6,
    room: 'interior',
    whatsapp: '6281271001005',
    description: 'Karya tekstil eksperimental yang mengadaptasi filosofi Tri Hita Karana dari tenun dobel ikat Tenganan.'
  },
  {
    id: 'art-6',
    title: 'Noken & Cenderawasih',
    creator: 'Yohanes Kogoya',
    level: 'SMA',
    school: 'SMAN 1 Wamena',
    region: 'Papua Pegunungan',
    category: 'Rak Display',
    price: 1250000,
    yaw: 65,
    pitch: -12,
    room: 'interior',
    whatsapp: '6281271001006',
    description: 'Instalasi kriya serat kulit kayu anggrek hutan Lembah Baliem dipadukan patung kayu Cenderawasih.'
  },
  {
    id: 'art-7',
    title: 'Awan Megamendung Pesisir Cirebon',
    creator: 'Damar Wijaya',
    level: 'SD',
    school: 'SDN Kebon Baru IV',
    region: 'Cirebon, Jawa Barat',
    category: 'Dinding',
    price: 410000,
    yaw: 110,
    pitch: 6,
    room: 'interior',
    whatsapp: '6281271001007',
    description: 'Lukisan batik tulis di atas kanvas dengan tujuh gradasi biru langit menuju biru samudra.'
  },
  {
    id: 'art-8',
    title: 'Miniatur Rumah Gadang Gonjong Limo',
    creator: 'Siti Rahmah',
    level: 'SMP',
    school: 'SMPN 1 Bukittinggi',
    region: 'Sumatera Barat',
    category: 'Rak Display',
    price: 780000,
    yaw: 150,
    pitch: -12,
    room: 'interior',
    whatsapp: '6281271001008',
    description: 'Model arsitektur vernakular Minangkabau dari kayu surian dan ijuk aren dengan ukiran Aka Barayun.'
  },
  {
    id: 'art-9',
    title: 'Simfoni Kawung & Filosofi Semesta',
    creator: 'Bagas Adi Nugroho',
    level: 'SMA',
    school: 'SMAN 3 Yogyakarta',
    region: 'DI Yogyakarta',
    category: 'Dinding',
    price: 1150000,
    yaw: -130,
    pitch: 15,
    room: 'interior',
    whatsapp: '6281271001009',
    description: 'Komposisi mixed-media malam batik, prada emas, dan pigmen soga alam di atas panel kayu.'
  },
  {
    id: 'art-10',
    title: 'Siluet Wayang Kulit Arjuna Sasrabahu',
    creator: 'Sekar Arum',
    level: 'SMP',
    school: 'SMPN 4 Surakarta',
    region: 'Jawa Tengah',
    category: 'Dinding',
    price: 890000,
    yaw: -88,
    pitch: 15,
    room: 'interior',
    whatsapp: '6281271001010',
    description: 'Karya tatah sungging kulit kerbau asli dengan gradasi warna tradisional dan gapit tanduk.'
  },
  {
    id: 'art-11',
    title: 'Kuda Pasola & Tenun Pahikung Sumba',
    creator: 'Lukas Umbu',
    level: 'SMA',
    school: 'SMAN 1 Waingapu',
    region: 'Nusa Tenggara Timur',
    category: 'Dinding',
    price: 1380000,
    yaw: -45,
    pitch: 15,
    room: 'interior',
    whatsapp: '6281271001011',
    description: 'Panel tenun ikat pewarna akar mengkudu dan nila biru mengisahkan ketangkasan kuda sandelwood.'
  },
  {
    id: 'art-12',
    title: 'Hulu Keris Ukiran Paksi Naga Liman',
    creator: 'I Made Wirawan',
    level: 'SMA',
    school: 'SMKN 1 Sukawati',
    region: 'Gianyar, Bali',
    category: 'Rak Display',
    price: 1100000,
    yaw: 0,
    pitch: -12,
    room: 'interior',
    whatsapp: '6281271001012',
    description: 'Seni pahat kayu cendana presisi tinggi memadukan simbol garuda, naga samudra, dan gajah.'
  },
  {
    id: 'art-13',
    title: 'Patung Garuda & Harmoni Jagat',
    creator: 'Komang Surya',
    level: 'SMA',
    school: 'SMAN 1 Denpasar',
    region: 'Bali',
    category: 'Rak Display',
    price: 1650000,
    yaw: 42,
    pitch: 15,
    room: 'interior',
    whatsapp: '6281271001013',
    description: 'Patung kayu suar tiga dimensi dengan bentang sayap berukir detail bulu berlapis prada emas.'
  },
  {
    id: 'art-14',
    title: 'Ulos Sadum & Gorga Danau Toba',
    creator: 'Togar Sinaga',
    level: 'SMP',
    school: 'SMPN 1 Balige',
    region: 'Sumatera Utara',
    category: 'Dinding',
    price: 760000,
    yaw: 88,
    pitch: 15,
    room: 'interior',
    whatsapp: '6281271001014',
    description: 'Kolase tekstil benang emas Ulos Sadum dikombinasikan dengan relief ukiran Gorga Batak Toba.'
  },
  {
    id: 'art-15',
    title: 'Kemilau Songket Lepus Sriwijaya',
    creator: 'Nabila Azzahra',
    level: 'SMA',
    school: 'SMAN 1 Palembang',
    region: 'Sumatera Selatan',
    category: 'Dinding',
    price: 1520000,
    yaw: 132,
    pitch: 15,
    room: 'interior',
    whatsapp: '6281271001015',
    description: 'Karya tenun benang cukit emas di atas sutra merah kesumba dengan motif Bungo Cina Palembang.'
  },
  {
    id: 'art-16',
    title: 'Miniatur Sasando Daun Lontar',
    creator: 'Maria Bria',
    level: 'SMP',
    school: 'SMPN 1 Kupang',
    region: 'Nusa Tenggara Timur',
    category: 'Rak Display',
    price: 810000,
    yaw: -145,
    pitch: -8,
    room: 'foyer',
    whatsapp: '6281271001016',
    description: 'Instrumen petik tradisional Pulau Rote dengan resonator anyaman daun lontar utuh.'
  },
  {
    id: 'art-17',
    title: 'Sepasang Ondel-Ondel & Kembang Kelapa',
    creator: 'Rizky Ramadhan',
    level: 'SD',
    school: 'SDN Menteng 01',
    region: 'DKI Jakarta',
    category: 'Dinding',
    price: 420000,
    yaw: 145,
    pitch: -8,
    room: 'foyer',
    whatsapp: '6281271001017',
    description: 'Lukisan gouache penuh warna menampilkan keceriaan budaya Betawi dan ornamen gigi balang.'
  },
  {
    id: 'art-18',
    title: 'Guci Terakota Loro Blonyo Kasongan',
    creator: 'Larissa Maharani',
    level: 'SD',
    school: 'SDN 1 Kasihan',
    region: 'Bantul, DI Yogyakarta',
    category: 'Rak Display',
    price: 490000,
    yaw: 175,
    pitch: -12,
    room: 'interior',
    whatsapp: '6281271001018',
    description: 'Kriya gerabah tanah liat bakar dengan teknik tempel pilin khas sentra keramik Kasongan.'
  }
];

export const formatIDR = (val) =>
  'Rp ' + Math.max(0, Math.round(val || 0)).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');

export const useGalleryStore = create(
  persist(
    (set) => ({
      currentRoom: 'foyer',
      lightingTheme: 'warm_museum',
      artworks: INITIAL_ARTWORKS,
      selectedArtwork: null,
      cart: [],
      isAdminOpen: false,

      setRoom: (currentRoom) => set({ currentRoom, selectedArtwork: null }),
      setLightingTheme: (lightingTheme) => set({ lightingTheme }),
      setSelectedArtwork: (selectedArtwork) => set({ selectedArtwork }),
      setAdminOpen: (isAdminOpen) => set({ isAdminOpen }),

      addArtwork: (art) => set((s) => ({ artworks: [art, ...s.artworks] })),
      updateArtwork: (id, patch) =>
        set((s) => ({
          artworks: s.artworks.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteArtwork: (id) =>
        set((s) => ({
          artworks: s.artworks.filter((a) => a.id !== id),
          selectedArtwork: s.selectedArtwork?.id === id ? null : s.selectedArtwork,
        })),
      addToCart: (artwork) =>
        set((s) => {
          const found = s.cart.find((c) => c.artwork.id === artwork.id);
          return {
            cart: found
              ? s.cart.map((c) =>
                  c.artwork.id === artwork.id ? { ...c, qty: c.qty + 1 } : c
                )
              : [...s.cart, { artwork, qty: 1 }],
          };
        }),
    }),
    { name: 'nusantara-360-storage' }
  )
);`,

  'App.jsx': `import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShoppingBag, Settings, MessageCircle, X } from 'lucide-react';
import { useGalleryStore, formatIDR } from './Store';
import AdminPanel from './AdminPanel';

function periodicFbm(theta, yNorm, seed = 0) {
  return (
    Math.sin(theta + seed) * Math.cos(yNorm * 3.1 + 0.4) +
    Math.sin(theta * 2 - 1.2 + seed) * 0.5 +
    Math.cos(theta * 4 + yNorm * 6 + seed) * 0.25 +
    Math.sin(theta * 8 - yNorm * 9 + seed) * 0.125 +
    Math.cos(theta * 16 + yNorm * 14 + seed) * 0.0625
  );
}

function createPhotorealEquirectangularCanvas(room, theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const w = 2048, h = 1024, horizonY = Math.floor(h * 0.52);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (room === 'foyer') {
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.32, theme === 'bright_daylight' ? '#0284c7' : '#1e293b');
    grad.addColorStop(0.5, theme === 'bright_daylight' ? '#fef9c3' : '#f97316');
    grad.addColorStop(0.53, '#231710');
    grad.addColorStop(1, '#090706');
  } else {
    grad.addColorStop(0, '#070504');
    grad.addColorStop(0.24, '#2b231d');
    grad.addColorStop(0.55, theme === 'bright_daylight' ? '#f8fafc' : '#362c25');
    grad.addColorStop(0.75, '#1a110b');
    grad.addColorStop(1, '#070503');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Seamless periodic volumetric clouds & mountain ridges (0 seam at x=0 and x=w)
  for (let layer = 0; layer < 4; layer++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const theta = (x / w) * Math.PI * 2;
      const y = horizonY - Math.abs(periodicFbm(theta, layer * 0.3, layer)) * (52 - layer * 10);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizonY);
    ctx.lineTo(0, horizonY);
    ctx.fillStyle = \`rgba(20, 16, 14, \${0.35 + layer * 0.15})\`;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function BloomPostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const comp = new EffectComposer(gl);
    comp.addPass(new RenderPass(scene, camera));
    comp.addPass(
      new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.62, 0.45, 0.72)
    );
    return comp;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useFrame(() => {
    composer.render();
  }, 1);
  return null;
}

function PanoramaScene({ targetFov, analogRef }) {
  const { currentRoom, lightingTheme, artworks, setSelectedArtwork, setRoom } = useGalleryStore();
  const { camera } = useThree();
  const yawPitch = useRef({ yaw: 0, pitch: 0 });
  const texture = useMemo(() => createPhotorealEquirectangularCanvas(currentRoom, lightingTheme), [currentRoom, lightingTheme]);

  useFrame((_, dt) => {
    if (Math.abs(analogRef.current.x) > 0.01 || Math.abs(analogRef.current.y) > 0.01) {
      yawPitch.current.yaw += analogRef.current.x * 80 * dt;
      yawPitch.current.pitch = THREE.MathUtils.clamp(yawPitch.current.pitch - analogRef.current.y * 50 * dt, -40, 40);
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(yawPitch.current.pitch),
        THREE.MathUtils.degToRad(-yawPitch.current.yaw),
        0,
        'YXZ'
      );
      camera.quaternion.setFromEuler(euler);
    }
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov.current, 1 - Math.exp(-8 * dt));
    camera.updateProjectionMatrix();
  });

  const roomArtworks = artworks.filter((a) => a.room === currentRoom);

  const triggerTransition = (nextRoom) => {
    targetFov.current = 38;
    setTimeout(() => {
      setRoom(nextRoom);
      targetFov.current = 70;
    }, 320);
  };

  return (
    <group>
      <ambientLight intensity={lightingTheme === 'bright_daylight' ? 2.4 : 1.5} />
      <pointLight position={[0, 4, 0]} intensity={2.8} color="#fbbf24" />
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[25, 64, 32]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>

      {/* Directional Floor Hotspot */}
      <group
        position={[0, -1.35, -3.5]}
        onClick={() => triggerTransition(currentRoom === 'foyer' ? 'interior' : 'foyer')}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.5, 32]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.6} side={THREE.DoubleSide} />
        </mesh>
        <Html center>
          <button className="px-4 py-2 rounded-full bg-black/40 text-amber-200 border border-amber-300/60 text-xs font-semibold whitespace-nowrap">
            {currentRoom === 'foyer' ? 'Masuk ke Ruang Pameran →' : '← Kembali ke Foyer'}
          </button>
        </Html>
      </group>

      {/* Glowing Artwork Frames & Pedestals */}
      {roomArtworks.map((art) => {
        const yawRad = (art.yaw * Math.PI) / 180;
        const pitchRad = (art.pitch * Math.PI) / 180;
        const r = 6;
        const x = Math.sin(yawRad) * Math.cos(pitchRad) * r;
        const y = Math.sin(pitchRad) * r;
        const z = -Math.cos(yawRad) * Math.cos(pitchRad) * r;
        return (
          <group key={art.id} position={[x, y, z]}>
            <mesh onClick={() => setSelectedArtwork(art)}>
              <boxGeometry args={[1.2, 0.9, 0.08]} />
              <meshStandardMaterial color={art.palettePrimary} emissive={art.palettePrimary} emissiveIntensity={0.45} />
            </mesh>
            <Html center distanceFactor={8}>
              <button
                onClick={() => setSelectedArtwork(art)}
                className="px-3 py-1.5 rounded-xl bg-black/45 text-white border border-white/25 hover:border-amber-300 text-xs font-medium whitespace-nowrap transition"
              >
                {art.level} · {art.title}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function App() {
  const { currentRoom, setRoom, selectedArtwork, setSelectedArtwork, cart, addToCart, isAdminOpen, setAdminOpen, artworks } = useGalleryStore();
  const targetFov = useRef(70);
  const analogRef = useRef({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 text-stone-100 select-none">
      <Canvas camera={{ position: [0, 0, 0.1], fov: 70 }}>
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.35} />
        <PanoramaScene targetFov={targetFov} analogRef={analogRef} />
        <BloomPostProcessing />
      </Canvas>

      {/* Pojok Kiri Atas (Transparent) */}
      <div className="fixed top-4 left-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setRoom(currentRoom === 'foyer' ? 'interior' : 'foyer')}
          className="px-3.5 py-2 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/25 text-xs font-semibold"
        >
          ✦ NUSANTARA 360° · {currentRoom === 'foyer' ? 'Pelataran Foyer' : 'Ruang Pameran'}
        </button>
      </div>

      {/* Pojok Kanan Atas (Transparent) */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setAdminOpen(!isAdminOpen)}
          className="px-3.5 py-2 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/25 text-xs flex items-center gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" /> Admin
        </button>
        <div className="px-3.5 py-2 rounded-2xl bg-amber-500/30 border border-amber-300/70 text-amber-100 text-xs font-mono">
          Keranjang ({cart.reduce((s, i) => s + i.qty, 0)})
        </div>
      </div>

      {/* Pojok Kiri Bawah: Analog Navigasi Mobile Legends */}
      <div
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const dx = Math.max(-40, Math.min(40, e.clientX - (rect.left + rect.width / 2)));
          const dy = Math.max(-40, Math.min(40, e.clientY - (rect.top + rect.height / 2)));
          setKnobOffset({ x: dx, y: dy });
          analogRef.current = { x: dx / 40, y: dy / 40 };
        }}
        onPointerUp={() => {
          setKnobOffset({ x: 0, y: 0 });
          analogRef.current = { x: 0, y: 0 };
        }}
        className="fixed bottom-4 left-4 z-20 w-32 h-32 rounded-full bg-black/25 border-2 border-white/25 flex items-center justify-center touch-none cursor-grab"
      >
        <div
          style={{ transform: \`translate(\${knobOffset.x}px, \${knobOffset.y}px)\` }}
          className="w-12 h-12 rounded-full bg-amber-400/35 border-2 border-amber-200 shadow-lg"
        />
      </div>

      {/* Pojok Kanan Bawah: Panel Informasi Transparan */}
      <aside className="fixed bottom-4 right-4 z-20 p-3.5 rounded-2xl bg-black/30 border border-white/25 text-xs max-w-xs space-y-1">
        <div className="font-bold text-amber-300">Informasi Galeri 360°</div>
        <div className="text-white/80">{artworks.length} Karya Nusantara · UnrealBloom Aktif</div>
      </aside>

      {/* Artwork Modal */}
      {selectedArtwork && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-stone-900 border border-white/20 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-amber-400">{selectedArtwork.level} · {selectedArtwork.school} · {selectedArtwork.region}</p>
                <h2 className="text-xl font-bold mt-1">{selectedArtwork.title}</h2>
                <p className="text-sm text-stone-300">Karya: {selectedArtwork.creator}</p>
              </div>
              <button onClick={() => setSelectedArtwork(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-stone-300 leading-relaxed">{selectedArtwork.description}</p>
            <div className="text-2xl font-bold text-amber-400">{formatIDR(selectedArtwork.price)}</div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => addToCart(selectedArtwork)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 text-stone-950 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" /> Tambah ke Keranjang
              </button>
              <a
                href={\`https://wa.me/\${selectedArtwork.whatsapp}?text=\${encodeURIComponent('Halo, saya tertarik membeli karya ' + selectedArtwork.title)}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Hubungi Pencipta
              </a>
            </div>
          </div>
        </div>
      )}

      {isAdminOpen && <AdminPanel />}
    </div>
  );
}`,

  'AdminPanel.jsx': `import React, { useState } from 'react';
import { useGalleryStore, formatIDR } from './Store';

export default function AdminPanel() {
  const { artworks, addArtwork, updateArtwork, deleteArtwork, lightingTheme, setLightingTheme, setAdminOpen } = useGalleryStore();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    creator: '',
    level: 'SMA',
    school: '',
    region: '',
    category: 'Dinding',
    price: 500000,
    yaw: 0,
    pitch: 0,
    room: 'interior',
    whatsapp: '6281271001001',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.creator) return;
    if (editingId) {
      updateArtwork(editingId, { ...form, price: Number(form.price), yaw: Number(form.yaw), pitch: Number(form.pitch) });
      setEditingId(null);
    } else {
      addArtwork({ ...form, id: 'art-' + Date.now(), price: Number(form.price), yaw: Number(form.yaw), pitch: Number(form.pitch) });
    }
    setForm({ title: '', creator: '', level: 'SMA', school: '', region: '', category: 'Dinding', price: 500000, yaw: 0, pitch: 0, room: 'interior', whatsapp: '6281271001001', description: '' });
  };

  return (
    <aside className="absolute right-0 top-14 bottom-0 z-30 w-full max-w-md bg-stone-950/95 border-l border-white/15 p-6 overflow-y-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-amber-400">Dashboard Kurator & Admin</h2>
        <button onClick={() => setAdminOpen(false)} className="text-xs text-stone-400 hover:text-white">Tutup</button>
      </div>

      {/* Lighting Theme */}
      <div className="space-y-2">
        <label className="text-xs text-stone-400">Tema Pencahayaan 360°</label>
        <div className="flex gap-2">
          {['warm_museum', 'bright_daylight', 'golden_nusantara'].map((t) => (
            <button
              key={t}
              onClick={() => setLightingTheme(t)}
              className={\`px-3 py-1.5 rounded-lg text-xs font-medium \${lightingTheme === t ? 'bg-amber-500 text-stone-950' : 'bg-stone-900 text-stone-300'}\`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* CRUD Form */}
      <form onSubmit={handleSubmit} className="space-y-3 bg-stone-900/90 p-4 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold">{editingId ? 'Edit Karya' : 'Tambah Karya Baru'}</h3>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul Karya" className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm" required />
        <input value={form.creator} onChange={(e) => setForm({ ...form, creator: e.target.value })} placeholder="Nama Pelajar" className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm" required />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm">
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
            <option value="SMA">SMA</option>
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm">
            <option value="Dinding">Dinding</option>
            <option value="Rak Display">Rak Display</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="Nama Sekolah" className="px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm" required />
          <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Daerah Asal" className="px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm" required />
        </div>
        <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} placeholder="Harga (IDR)" className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm" required />

        {/* Real-time Yaw & Pitch Sliders */}
        <div className="space-y-1">
          <label className="text-xs text-stone-400">Yaw Horizontal ({form.yaw}°)</label>
          <input
            type="range" min="-180" max="180" value={form.yaw}
            onChange={(e) => {
              const yaw = Number(e.target.value);
              setForm({ ...form, yaw });
              if (editingId) updateArtwork(editingId, { yaw });
            }}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-400">Pitch Vertikal ({form.pitch}°)</label>
          <input
            type="range" min="-45" max="45" value={form.pitch}
            onChange={(e) => {
              const pitch = Number(e.target.value);
              setForm({ ...form, pitch });
              if (editingId) updateArtwork(editingId, { pitch });
            }}
            className="w-full"
          />
        </div>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi Karya" className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-white/10 text-sm" rows={3} />
        <button type="submit" className="w-full py-2 rounded-lg bg-amber-500 text-stone-950 font-semibold text-sm">
          {editingId ? 'Simpan Perubahan' : 'Tambahkan ke Galeri'}
        </button>
      </form>

      {/* Artworks List */}
      <div className="space-y-2">
        {artworks.map((a) => (
          <div key={a.id} className="p-3 rounded-xl bg-stone-900 border border-white/10 flex justify-between items-center gap-2">
            <div>
              <div className="text-xs text-amber-400">{a.level} · {a.region}</div>
              <div className="text-sm font-semibold">{a.title}</div>
              <div className="text-xs text-stone-400">{formatIDR(a.price)} · Yaw {a.yaw}°</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingId(a.id); setForm(a); }} className="text-xs text-sky-400">Edit</button>
              <button onClick={() => deleteArtwork(a.id)} className="text-xs text-rose-400">Hapus</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}`,
};
