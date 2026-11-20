import { createStore } from 'zustand/vanilla';
import type {
  Artwork,
  CartItem,
  EducationLevel,
  DisplayCategory,
  LightingThemeId,
  LightingThemeSpec,
  RepositoryArtworkItem,
  RoomId,
  RoomSpec,
} from './types.ts';

export const STORAGE_KEY = 'nusantara360_sd_gallery_state_v8';
const LEGACY_STORAGE_KEY_V6 = 'nusantara360_sd_gallery_state_v7';

export const ROOMS: Record<RoomId, RoomSpec> = {
  ruang_1: {
    id: 'ruang_1',
    code: 'R1',
    name: 'Ruang 1 · Gerbang Utama',
    shortName: 'Gerbang Utama',
    subtitle: 'Foyer utama pameran dengan 3 gerbang lengkung menuju ruang lukisan, kriya, dan wastra',
    panoramaUrl: '/assets/aistudio/ruang1_gerbang_sd_360.jpg',
    yawOffsetDeg: 0,
    defaultYawDeg: 0,
    repositoryYawDeg: 126,
    repositoryPitchDeg: -7,
    mapX: 50,
    mapY: 84,
    portals: [
      {
        targetRoom: 'ruang_2',
        label: 'Galeri Lukisan',
        shortLabel: 'Galeri Lukisan',
        yaw: 0,
        distance: 3.6,
        entryYaw: -15,
      },
      {
        targetRoom: 'ruang_3',
        label: 'Hall Kriya',
        shortLabel: 'Hall Kriya',
        yaw: -92,
        distance: 3.5,
        entryYaw: 0,
      },
      {
        targetRoom: 'ruang_4',
        label: 'Galeri Wastra',
        shortLabel: 'Galeri Wastra',
        yaw: 90,
        distance: 3.5,
        entryYaw: 0,
      },
    ],
  },
  ruang_2: {
    id: 'ruang_2',
    code: 'R2',
    name: 'Ruang 2 · Galeri Lukisan',
    shortName: 'Galeri Lukisan',
    subtitle: 'Ruang pameran lukisan kanvas, lukis kaca, dan imajinasi warna Nusantara',
    panoramaUrl: '/assets/aistudio/ruang2_lukisan_sd_360.jpg',
    yawOffsetDeg: 0,
    defaultYawDeg: -15,
    repositoryYawDeg: 128,
    repositoryPitchDeg: 1,
    mapX: 50,
    mapY: 50,
    portals: [
      {
        targetRoom: 'ruang_5',
        label: 'Paviliun Puncak',
        shortLabel: 'Paviliun Puncak',
        yaw: 45,
        distance: 3.5,
        entryYaw: 0,
      },
      {
        targetRoom: 'ruang_4',
        label: 'Galeri Wastra',
        shortLabel: 'Galeri Wastra',
        yaw: 171,
        distance: 3.4,
        entryYaw: 0,
      },
      {
        targetRoom: 'ruang_1',
        label: 'Gerbang Utama',
        shortLabel: 'Gerbang Utama',
        yaw: -155,
        distance: 3.4,
        entryYaw: 0,
      },
    ],
  },
  ruang_3: {
    id: 'ruang_3',
    code: 'R3',
    name: 'Ruang 3 · Hall Kriya',
    shortName: 'Hall Kriya',
    subtitle: 'Sayap barat dengan koleksi kriya ukir kayu, anyaman noken, angklung bambu, dan patung',
    panoramaUrl: '/assets/aistudio/ruang3_kriya_sd_360.jpg',
    yawOffsetDeg: 0,
    defaultYawDeg: 0,
    repositoryYawDeg: 97,
    repositoryPitchDeg: -3,
    mapX: 16,
    mapY: 50,
    portals: [
      {
        targetRoom: 'ruang_5',
        label: 'Paviliun Puncak',
        shortLabel: 'Paviliun Puncak',
        yaw: 0,
        distance: 3.7,
        entryYaw: 0,
      },
      {
        targetRoom: 'ruang_2',
        label: 'Galeri Lukisan',
        shortLabel: 'Galeri Lukisan',
        yaw: 149,
        distance: 3.5,
        entryYaw: -15,
      },
      {
        targetRoom: 'ruang_1',
        label: 'Gerbang Utama',
        shortLabel: 'Gerbang Utama',
        yaw: -150,
        distance: 3.5,
        entryYaw: -92,
      },
    ],
  },
  ruang_4: {
    id: 'ruang_4',
    code: 'R4',
    name: 'Ruang 4 · Galeri Wastra',
    shortName: 'Galeri Wastra',
    subtitle: 'Sayap timur dengan karya mozaik biji-bijian, kolase alam, batik jumputan, dan tenun',
    panoramaUrl: '/assets/aistudio/ruang4_wastra_360.jpg',
    yawOffsetDeg: 0,
    defaultYawDeg: 0,
    repositoryYawDeg: -94,
    repositoryPitchDeg: -5,
    mapX: 84,
    mapY: 50,
    portals: [
      {
        targetRoom: 'ruang_5',
        label: 'Paviliun Puncak',
        shortLabel: 'Paviliun Puncak',
        yaw: 97,
        distance: 3.5,
        entryYaw: 0,
      },
      {
        targetRoom: 'ruang_2',
        label: 'Galeri Lukisan',
        shortLabel: 'Galeri Lukisan',
        yaw: 0,
        distance: 3.7,
        entryYaw: -15,
      },
      {
        targetRoom: 'ruang_1',
        label: 'Gerbang Utama',
        shortLabel: 'Gerbang Utama',
        yaw: -155,
        distance: 3.5,
        entryYaw: 90,
      },
    ],
  },
  ruang_5: {
    id: 'ruang_5',
    code: 'R5',
    name: 'Ruang 5 · Paviliun Puncak',
    shortName: 'Paviliun Puncak',
    subtitle: 'Paviliun kayu jati dengan diorama rumah adat, miniatur kapal Phinisi, dan Galeri Koleksi',
    panoramaUrl: '/assets/aistudio/ruang5_repositori_360.jpg',
    yawOffsetDeg: 0,
    defaultYawDeg: 0,
    repositoryYawDeg: 130,
    repositoryPitchDeg: -3,
    mapX: 50,
    mapY: 16,
    portals: [
      {
        targetRoom: 'ruang_3',
        label: 'Hall Kriya',
        shortLabel: 'Hall Kriya',
        yaw: -138,
        distance: 3.4,
        entryYaw: 0,
      },
      {
        targetRoom: 'ruang_2',
        label: 'Galeri Lukisan',
        shortLabel: 'Galeri Lukisan',
        yaw: -88,
        distance: 3.5,
        entryYaw: -15,
      },
      {
        targetRoom: 'ruang_4',
        label: 'Galeri Wastra',
        shortLabel: 'Galeri Wastra',
        yaw: -58,
        distance: 4.1,
        entryYaw: 0,
      },
    ],
  },
};

export const ROOM_LIST: RoomSpec[] = [
  ROOMS.ruang_1,
  ROOMS.ruang_2,
  ROOMS.ruang_3,
  ROOMS.ruang_4,
  ROOMS.ruang_5,
];

export function normalizeRoomId(input?: string | null): RoomId {
  if (!input) return 'ruang_1';
  if (input === 'foyer') return 'ruang_1';
  if (input === 'interior') return 'ruang_2';
  if (input in ROOMS) return input as RoomId;
  return 'ruang_1';
}

export const LIGHTING_THEMES: Record<LightingThemeId, LightingThemeSpec> = {
  bright_daylight: {
    id: 'bright_daylight',
    name: 'Natural Street-View',
    subtitle: 'Kejernihan warna foto 360° asli layaknya Google Street View',
    ambientColor: 0xffffff,
    groundColor: 0x64748b,
    ambientIntensity: 2.8,
    keyLightColor: 0xffffff,
    keyLightIntensity: 2.4,
    spotLightColor: 0xffffff,
    spotLightIntensity: 1.8,
    fogColor: 0x0f172a,
    exposure: 1.0,
    sphereTintHex: 0xffffff,
  },
  warm_museum: {
    id: 'warm_museum',
    name: 'Warm Museum',
    subtitle: 'Suasana galeri hangat dengan aksen keemasan lembut',
    ambientColor: 0xffe8c8,
    groundColor: 0x2b1d14,
    ambientIntensity: 2.4,
    keyLightColor: 0xffd296,
    keyLightIntensity: 2.4,
    spotLightColor: 0xffdfad,
    spotLightIntensity: 2.2,
    fogColor: 0x17120e,
    exposure: 1.02,
    sphereTintHex: 0xfff7ed,
  },
  golden_nusantara: {
    id: 'golden_nusantara',
    name: 'Golden Keraton',
    subtitle: 'Nuansa senja keraton dengan kontras hangat dramatis',
    ambientColor: 0xffd79a,
    groundColor: 0x1c120c,
    ambientIntensity: 2.1,
    keyLightColor: 0xffb347,
    keyLightIntensity: 2.6,
    spotLightColor: 0xffc857,
    spotLightIntensity: 2.5,
    fogColor: 0x120b07,
    exposure: 1.04,
    sphereTintHex: 0xffedd5,
  },
};

export const INITIAL_ARTWORKS: Artwork[] = [
  // ── RUANG 2: GALERI LUKISAN & IMAJINASI SD (ruang2_lukisan_sd_360.jpg) ────────
  {
    id: 'art-1',
    title: 'Harmoni Gajah & Flora Way Kambas',
    creator: 'Bima Pratama (Kelas 5 SD)',
    level: 'SD',
    school: 'SDN 1 Metro',
    region: 'Lampung',
    category: 'Dinding',
    price: 450000,
    yaw: -101,
    pitch: 1,
    room: 'ruang_2',
    description:
      'Lukisan akrilik dan krayon minyak di atas kanvas karya siswa kelas 5 SDN 1 Metro yang mengisahkan persahabatan gajah Sumatera dengan bunga Rafflesia arnoldii di hutan rawa Taman Nasional Way Kambas.',
    whatsapp: '6281271001001',
    motifType: 'way_kambas',
    palettePrimary: '#1d4ed8',
    paletteSecondary: '#f59e0b',
    imageUrl: '/assets/artworks/art-1.jpg',
  },
  {
    id: 'art-2',
    title: 'Tari Topeng & Semarak Pamekasan',
    creator: 'Aisyah Putri (Kelas 6 SD)',
    level: 'SD',
    school: 'SDN Gladak Anyar 2',
    region: 'Pamekasan, Madura',
    category: 'Dinding',
    price: 380000,
    yaw: -56,
    pitch: 1,
    room: 'ruang_2',
    description:
      'Karya ekspresif cat air dan pastel minyak siswi kelas 6 SD yang menangkap energi gerak Tari Topeng Ghettak khas Pamekasan dengan sapuan warna merah cabai, kuning kunyit, dan prada emas.',
    whatsapp: '6281271001002',
    motifType: 'topeng_madura',
    palettePrimary: '#b91c1c',
    paletteSecondary: '#fbbf24',
    imageUrl: '/assets/artworks/art-2.jpg',
  },
  {
    id: 'art-7',
    title: 'Lukisan Kaca Megamendung Cirebon',
    creator: 'Galih Ramadhan (Kelas 6 SD)',
    level: 'SD',
    school: 'SDN Kebon Baru IV',
    region: 'Cirebon, Jawa Barat',
    category: 'Dinding',
    price: 420000,
    yaw: -17,
    pitch: 1,
    room: 'ruang_2',
    description:
      'Lukisan kaca tradisional Cirebon karya siswa kelas 6 SD dengan teknik lukis terbalik menampilkan gradasi awan Megamendung tujuh lapis biru langit dan putih bersih.',
    whatsapp: '6281271001007',
    motifType: 'megamendung',
    palettePrimary: '#1d4ed8',
    paletteSecondary: '#38bdf8',
    imageUrl: '/assets/artworks/art-7.jpg',
  },
  {
    id: 'art-9',
    title: 'Batik Tulis Kawung & Burung Merak',
    creator: 'Siti Nurhaliza (Kelas 5 SD)',
    level: 'SD',
    school: 'SDN Laweyan 1',
    region: 'Surakarta, Jawa Tengah',
    category: 'Dinding',
    price: 390000,
    yaw: 16,
    pitch: 1,
    room: 'ruang_2',
    description:
      'Karya membatik canting tangan siswi kelas 5 SD di atas kain mori primisima dengan perpaduan motif geometris Kawung dan keluwesan ekor burung merak keemasan.',
    whatsapp: '6281271001009',
    motifType: 'batik_kawung',
    palettePrimary: '#78350f',
    paletteSecondary: '#f59e0b',
    imageUrl: '/assets/artworks/art-9.jpg',
  },
  {
    id: 'art-5',
    title: 'Penyu Hijau & Terumbu Karang Bunaken',
    creator: 'Kevin Lasut (Kelas 4 SD)',
    level: 'SD',
    school: 'SDN 11 Manado',
    region: 'Sulawesi Utara',
    category: 'Dinding',
    price: 410000,
    yaw: 79,
    pitch: 1,
    room: 'ruang_2',
    description:
      'Lukisan cat poster dan spidol akrilik karya siswa kelas 4 SD yang menggambarkan keindahan bawah laut Taman Nasional Bunaken bersama penyu hijau dan terumbu karang warna-warni.',
    whatsapp: '6281271001005',
    motifType: 'ulos_batak',
    palettePrimary: '#0284c7',
    paletteSecondary: '#fde047',
    imageUrl: '/assets/artworks/art-5.jpg',
  },

  // ── RUANG 3: HALL KRIYA, KERAMIK & PATUNG SD (ruang3_kriya_sd_360.jpg) ────────
  {
    id: 'art-4',
    title: 'Ukiran Tameng Klabang Dayak Cilik',
    creator: 'Clara Sinta (Kelas 6 SD)',
    level: 'SD',
    school: 'SDN 002 Samarinda',
    region: 'Kalimantan Timur',
    category: 'Rak Display',
    price: 460000,
    yaw: -108,
    pitch: -34,
    room: 'ruang_3',
    description:
      'Kriya kayu ringan berukir motif tameng Dayak Kenyah dengan pewarna alami merah tanah, kuning kunyit, dan hitam arang dilengkapi hiasan bulu burung enggang buatan tangan.',
    whatsapp: '6281271001004',
    motifType: 'tameng_dayak',
    palettePrimary: '#991b1b',
    paletteSecondary: '#fef08a',
    imageUrl: '/assets/artworks/art-4.jpg',
  },
  {
    id: 'art-6',
    title: 'Anyaman Noken & Mahkota Cenderawasih',
    creator: 'Yohanes Kogoya (Kelas 6 SD)',
    level: 'SD',
    school: 'SD YPPK Santo Yakobus Wamena',
    region: 'Papua Pegunungan',
    category: 'Rak Display',
    price: 490000,
    yaw: -34,
    pitch: -15,
    room: 'ruang_3',
    description:
      'Tas rajut tradisional Noken dari serat kulit kayu buatan siswa kelas 6 SD yang dipadukan dengan kriya mahkota burung Cenderawasih kuning keemasan.',
    whatsapp: '6281271001006',
    motifType: 'noken_papua',
    palettePrimary: '#b45309',
    paletteSecondary: '#fde047',
    imageUrl: '/assets/artworks/art-6.jpg',
  },
  {
    id: 'art-12',
    title: 'Rakitan Angklung Bambu Hitam Cilik',
    creator: 'Daffa Nugraha (Kelas 5 SD)',
    level: 'SD',
    school: 'SDN Padasuka 2',
    region: 'Bandung, Jawa Barat',
    category: 'Rak Display',
    price: 430000,
    yaw: 35,
    pitch: -18,
    room: 'ruang_3',
    description:
      'Kriya alat musik tradisional Angklung satu oktaf dari bambu hitam pilihan yang dirakit dan ditala langsung oleh siswa kelas 5 SD di Bandung.',
    whatsapp: '6281271001012',
    motifType: 'keris_ukir',
    palettePrimary: '#713f12',
    paletteSecondary: '#eab308',
    imageUrl: '/assets/artworks/art-12.jpg',
  },
  {
    id: 'art-13',
    title: 'Patung Bubur Kertas Satwa Nusantara',
    creator: 'Meilin Tan (Kelas 3 SD)',
    level: 'SD',
    school: 'SD Sutomo 1',
    region: 'Medan, Sumatera Utara',
    category: 'Rak Display',
    price: 350000,
    yaw: 103,
    pitch: -27,
    room: 'ruang_3',
    description:
      'Koleksi patung papier-mâché (bubur kertas daur ulang) warna-warni karya siswi kelas 3 SD yang menampilkan gajah Sumatera, burung merak, dan ikan mas Danau Toba.',
    whatsapp: '6281271001013',
    motifType: 'garuda_wisnu',
    palettePrimary: '#92400e',
    paletteSecondary: '#f59e0b',
    imageUrl: '/assets/artworks/art-13.jpg',
  },

  // ── RUANG 4: GALERI WASTRA, BATIK & MOZAIK SD (ruang4_wastra_360.jpg) ────────
  {
    id: 'art-14',
    title: 'Mozaik Biji-Bijian Taman Bunga Nusantara',
    creator: 'Fatimah Zahra (Kelas 2 SD)',
    level: 'SD',
    school: 'SDN Kauman 1',
    region: 'Malang, Jawa Timur',
    category: 'Dinding',
    price: 320000,
    yaw: -35,
    pitch: 2,
    room: 'ruang_4',
    description:
      'Karya mozaik ketelitian tinggi dari biji jagung, kacang hijau, beras merah, dan kedelai hitam karya siswi kelas 2 SD yang membentuk taman bunga tropis Indonesia.',
    whatsapp: '6281271001014',
    motifType: 'gringsing_bali',
    palettePrimary: '#0369a1',
    paletteSecondary: '#fde047',
    imageUrl: '/assets/artworks/art-14.jpg',
  },
  {
    id: 'art-15',
    title: 'Kriya Kuda Lumping & Kolase Daun Kering',
    creator: 'Arjuna Wijaya (Kelas 4 SD)',
    level: 'SD',
    school: 'SDN 1 Temanggung',
    region: 'Jawa Tengah',
    category: 'Dinding',
    price: 370000,
    yaw: 35,
    pitch: 2,
    room: 'ruang_4',
    description:
      'Perpaduan lukisan kolase daun kering lereng Gunung Sumbing dan kriya kuda kepang anyaman bambu mini buatan siswa kelas 4 SD.',
    whatsapp: '6281271001015',
    motifType: 'songket_palembang',
    palettePrimary: '#991b1b',
    paletteSecondary: '#facc15',
    imageUrl: '/assets/artworks/art-15.jpg',
  },
  {
    id: 'art-11',
    title: 'Anyaman Lontar & Tenun Ikat Sumba Cilik',
    creator: 'Maria Rambu Kahi (Kelas 6 SD)',
    level: 'SD',
    school: 'SD Inpres Waingapu 2',
    region: 'Sumba Timur, NTT',
    category: 'Rak Display',
    price: 470000,
    yaw: 144,
    pitch: -20,
    room: 'ruang_4',
    description:
      'Kriya keranjang anyaman daun lontar dan selendang tenun ikat bermotif kuda sandalwood karya siswi kelas 6 SD di Waingapu.',
    whatsapp: '6281271001011',
    motifType: 'tenun_sumba',
    palettePrimary: '#0369a1',
    paletteSecondary: '#fdba74',
    imageUrl: '/assets/artworks/art-11.jpg',
  },

  // ── RUANG 5: PAVILIUN PUNCAK & GALERI KOLEKSI SD (ruang5_repositori_360.jpg) ─
  {
    id: 'art-8',
    title: 'Diorama Rumah Gadang Beratap Ijuk',
    creator: 'Farel Tanjung (Kelas 6 SD)',
    level: 'SD',
    school: 'SDN 04 Birugo Bukittinggi',
    region: 'Sumatera Barat',
    category: 'Rak Display',
    price: 480000,
    yaw: -31,
    pitch: -22,
    room: 'ruang_5',
    description:
      'Miniatur arsitektur Rumah Gadang Minangkabau dari bilah bambu, kardus tebal, dan serat ijuk aren asli buatan tangan siswa kelas 6 SD.',
    whatsapp: '6281271001008',
    motifType: 'rumah_gadang',
    palettePrimary: '#991b1b',
    paletteSecondary: '#facc15',
    imageUrl: '/assets/artworks/art-8.jpg',
  },
  {
    id: 'art-10',
    title: 'Maket Pendopo Joglo Stik Kayu',
    creator: 'Bagas Prakoso (Kelas 5 SD)',
    level: 'SD',
    school: 'SDN Unggaran 1',
    region: 'DI Yogyakarta',
    category: 'Rak Display',
    price: 440000,
    yaw: 0,
    pitch: -27,
    room: 'ruang_5',
    description:
      'Maket rumah adat Joglo Jawa dengan empat tiang utama soko guru yang disusun presisi dari ratusan stik kayu es krim dan cat pernis ramah anak.',
    whatsapp: '6281271001010',
    motifType: 'wayang_kulit',
    palettePrimary: '#b45309',
    paletteSecondary: '#fde047',
    imageUrl: '/assets/artworks/art-10.jpg',
  },
  {
    id: 'art-3',
    title: 'Miniatur Perahu Phinisi Tujuh Layar',
    creator: 'Rafi Alamsyah (Kelas 6 SD)',
    level: 'SD',
    school: 'SDN 2 Tanah Beru Bulukumba',
    region: 'Sulawesi Selatan',
    category: 'Rak Display',
    price: 500000,
    yaw: 34,
    pitch: -21,
    room: 'ruang_5',
    description:
      'Kriya kayu balsa dan kain belacu buatan tangan siswa kelas 6 SD dari pesisir Bulukumba yang merekonstruksi kapal layar Phinisi tujuh layar.',
    whatsapp: '6281271001003',
    motifType: 'phinisi',
    palettePrimary: '#92400e',
    paletteSecondary: '#fde68a',
    imageUrl: '/assets/artworks/art-3.jpg',
  },

  // ── RUANG 1: GERBANG UTAMA KARYA SD (ruang1_gerbang_sd_360.jpg) ──────────────
  {
    id: 'art-18',
    title: 'Gerabah Terakota Punakawan Kasongan',
    creator: 'Dimas Setiawan (Kelas 5 SD)',
    level: 'SD',
    school: 'SDN 1 Kasihan Bantul',
    region: 'Bantul, DI Yogyakarta',
    category: 'Rak Display',
    price: 390000,
    yaw: -130,
    pitch: -14,
    room: 'ruang_1',
    description:
      'Kriya gerabah tanah liat bakar Kasongan dengan teknik tempel pilin buatan siswa kelas 5 SD yang menampilkan kendi tradisional dan tokoh jenaka Punakawan.',
    whatsapp: '6281271001018',
    motifType: 'gerabah_kasongan',
    palettePrimary: '#9a3412',
    paletteSecondary: '#fdba74',
    imageUrl: '/assets/artworks/art-18.jpg',
  },
  {
    id: 'art-17',
    title: 'Sepasang Ondel-Ondel & Kembang Kelapa',
    creator: 'Zahra Amelia (Kelas 4 SD)',
    level: 'SD',
    school: 'SDN Menteng 01',
    region: 'DKI Jakarta',
    category: 'Rak Display',
    price: 360000,
    yaw: -41,
    pitch: -5,
    room: 'ruang_1',
    description:
      'Kriya daur ulang ramah lingkungan karya siswi kelas 4 SD berbentuk sepasang boneka Ondel-Ondel Betawi lengkap dengan hiasan mahkota kembang kelapa warna-warni.',
    whatsapp: '6281271001017',
    motifType: 'ondel_betawi',
    palettePrimary: '#dc2626',
    paletteSecondary: '#3b82f6',
    imageUrl: '/assets/artworks/art-17.jpg',
  },
  {
    id: 'art-16',
    title: 'Miniatur Sasando Daun Lontar',
    creator: 'Lukas Ndolu (Kelas 6 SD)',
    level: 'SD',
    school: 'SD Inpres 1 Lobalain',
    region: 'Rote Ndao, NTT',
    category: 'Rak Display',
    price: 480000,
    yaw: 0,
    pitch: -4,
    room: 'ruang_1',
    description:
      'Kriya instrumen petik tradisional Sasando Haik karya siswa kelas 6 SD di Pulau Rote dari tabung bambu pilihan dan tudung resonansi daun lontar kering.',
    whatsapp: '6281271001016',
    motifType: 'sasando_rote',
    palettePrimary: '#d97706',
    paletteSecondary: '#fef3c7',
    imageUrl: '/assets/artworks/art-16.jpg',
  },
];

/**
 * Curated Repository Archive of Additional Elementary School (SD) Student Artworks
 * displayed inside the "Lemari Repositori Karya SD" modal.
 * Contains strictly: Nama Karya (title), Jenis Karya (kind), Nama Pencipta (creator), and Tautan (linkUrl).
 */
export const REPOSITORY_OTHER_ARTWORKS: RepositoryArtworkItem[] = [
  {
    id: 'repo-sd-1',
    title: 'Lukisan Jembatan Ampera & Perahu Bidar',
    kind: 'Lukisan Cat Air',
    creator: 'Rizky Pratama · SDN 12 Palembang',
    linkUrl:
      'https://wa.me/6281271001101?text=Halo%20Rizky%20Pratama%20(SDN%2012%20Palembang)%2C%20saya%20mengapresiasi%20karya%20Lukisan%20Jembatan%20Ampera%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-1',
  },
  {
    id: 'repo-sd-2',
    title: 'Anyaman Tikar Pandan Warna Alami',
    kind: 'Kriya Anyaman',
    creator: 'Ni Luh Sari Dewi · SDN 2 Gianyar',
    linkUrl:
      'https://wa.me/6281271001102?text=Halo%20Ni%20Luh%20Sari%20Dewi%20(SDN%202%20Gianyar)%2C%20saya%20mengapresiasi%20karya%20Anyaman%20Tikar%20Pandan%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-2',
  },
  {
    id: 'repo-sd-3',
    title: 'Wayang Kardus Tokoh Gatotkaca',
    kind: 'Kriya Daur Ulang',
    creator: 'Danang Wibowo · SDN Keputran 1 Yogyakarta',
    linkUrl:
      'https://wa.me/6281271001103?text=Halo%20Danang%20Wibowo%20(SDN%20Keputran%201)%2C%20saya%20mengapresiasi%20karya%20Wayang%20Kardus%20Gatotkaca%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-3',
  },
  {
    id: 'repo-sd-4',
    title: 'Batik Jumputan Pelangi Sungai Mahakam',
    kind: 'Wastra Batik',
    creator: 'Nadia Borneo Putri · SDN 005 Tenggarong',
    linkUrl:
      'https://wa.me/6281271001104?text=Halo%20Nadia%20Borneo%20Putri%20(SDN%20005%20Tenggarong)%2C%20saya%20mengapresiasi%20karya%20Batik%20Jumputan%20Pelangi%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-4',
  },
  {
    id: 'repo-sd-5',
    title: 'Kolase Kulit Telur Burung Enggang Kalimantan',
    kind: 'Kolase & Mozaik',
    creator: 'Samuel Dayakarsa · SDN 1 Palangka Raya',
    linkUrl:
      'https://wa.me/6281271001105?text=Halo%20Samuel%20Dayakarsa%20(SDN%201%20Palangka%20Raya)%2C%20saya%20mengapresiasi%20karya%20Kolase%20Kulit%20Telur%20Burung%20Enggang%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-5',
  },
  {
    id: 'repo-sd-6',
    title: 'Miniatur Rumah Honai Lembah Baliem',
    kind: 'Diorama Arsitektur',
    creator: 'Melkior Tabuni · SD Inpres Wamena',
    linkUrl:
      'https://wa.me/6281271001106?text=Halo%20Melkior%20Tabuni%20(SD%20Inpres%20Wamena)%2C%20saya%20mengapresiasi%20karya%20Miniatur%20Rumah%20Honai%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-6',
  },
  {
    id: 'repo-sd-7',
    title: 'Lukisan Taman Laut Raja Ampat',
    kind: 'Lukisan Akrilik',
    creator: 'Gracia Mansoben · SD YPK Sorong',
    linkUrl:
      'https://wa.me/6281271001107?text=Halo%20Gracia%20Mansoben%20(SD%20YPK%20Sorong)%2C%20saya%20mengapresiasi%20karya%20Lukisan%20Raja%20Ampat%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-7',
  },
  {
    id: 'repo-sd-8',
    title: 'Celengan Tanah Liat Ayam Jago',
    kind: 'Keramik Terakota',
    creator: 'Fajar Hidayat · SDN 1 Plered Purwakarta',
    linkUrl:
      'https://wa.me/6281271001108?text=Halo%20Fajar%20Hidayat%20(SDN%201%20Plered)%2C%20saya%20mengapresiasi%20karya%20Celengan%20Tanah%20Liat%20Ayam%20Jago%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-8',
  },
  {
    id: 'repo-sd-9',
    title: 'Lukisan Panen Padi di Lereng Merapi',
    kind: 'Lukisan Krayon',
    creator: 'Kirana Maharani · SDN Pakem 1 Sleman',
    linkUrl:
      'https://wa.me/6281271001109?text=Halo%20Kirana%20Maharani%20(SDN%20Pakem%201)%2C%20saya%20mengapresiasi%20karya%20Lukisan%20Panen%20Padi%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-9',
  },
  {
    id: 'repo-sd-10',
    title: 'Topeng Panji Kertas Daur Ulang',
    kind: 'Kriya Topeng',
    creator: 'Bintang Saputra · SDN Tumpang 1 Malang',
    linkUrl:
      'https://wa.me/6281271001110?text=Halo%20Bintang%20Saputra%20(SDN%20Tumpang%201)%2C%20saya%20mengapresiasi%20karya%20Topeng%20Panji%20Daur%20Ulang%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-10',
  },
  {
    id: 'repo-sd-11',
    title: 'Sulam Benang Motif Pucuk Rebung Melayu',
    kind: 'Kriya Tekstil',
    creator: 'Salsabila Humaira · SDN 004 Pekanbaru',
    linkUrl:
      'https://wa.me/6281271001111?text=Halo%20Salsabila%20Humaira%20(SDN%20004%20Pekanbaru)%2C%20saya%20mengapresiasi%20karya%20Sulam%20Motif%20Pucuk%20Rebung%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-11',
  },
  {
    id: 'repo-sd-12',
    title: 'Miniatur Kapal Cadik Bambu Maluku',
    kind: 'Kriya Bambu',
    creator: 'Stevano Pattinasarany · SDN 1 Ambon',
    linkUrl:
      'https://wa.me/6281271001112?text=Halo%20Stevano%20Pattinasarany%20(SDN%201%20Ambon)%2C%20saya%20mengapresiasi%20karya%20Miniatur%20Kapal%20Cadik%20Bambu%20di%20Pameran%20Virtual.',
    linkedArtworkId: 'art-repo-12',
  },
];

export function getRepositoryList(artworks: Artwork[]): RepositoryArtworkItem[] {
  const fromGallery: RepositoryArtworkItem[] = artworks.map((art) => ({
    id: `repo-${art.id}`,
    title: art.title,
    kind: art.category === 'Dinding' ? 'Lukisan & Karya Dinding' : 'Kriya & Diorama 3D',
    creator: `${art.creator} · ${art.school}`,
    linkUrl: buildWhatsAppUrl(art),
    linkedArtworkId: art.id,
  }));
  return [...fromGallery, ...REPOSITORY_OTHER_ARTWORKS];
}

export function resolveGalleryArtwork(
  itemOrArtworkId: string,
  artworks: Artwork[],
): Artwork | null {
  const direct = artworks.find(
    (a) => a.id === itemOrArtworkId || `repo-${a.id}` === itemOrArtworkId,
  );
  if (direct) return direct;

  const repoItem = REPOSITORY_OTHER_ARTWORKS.find(
    (r) => r.id === itemOrArtworkId || r.linkedArtworkId === itemOrArtworkId,
  );
  if (!repoItem) return null;

  const parts = repoItem.creator.split('·').map((s) => s.trim());
  const creatorName = parts[0] || repoItem.creator;
  const schoolName = parts[1] || 'Sekolah Nusantara';
  const is3D =
    repoItem.kind.toLowerCase().includes('kriya') ||
    repoItem.kind.toLowerCase().includes('diorama') ||
    repoItem.kind.toLowerCase().includes('keramik');

  const repoImageMap: Record<string, string> = {
    'repo-sd-1': '/assets/artworks/art-3.jpg',
    'repo-sd-2': '/assets/artworks/art-repo-gringsing.jpg',
    'repo-sd-3': '/assets/artworks/art-repo-wayang.jpg',
    'repo-sd-4': '/assets/artworks/art-repo-ulos.jpg',
    'repo-sd-5': '/assets/artworks/art-4.jpg',
    'repo-sd-6': '/assets/artworks/art-8.jpg',
    'repo-sd-7': '/assets/artworks/art-5.jpg',
    'repo-sd-8': '/assets/artworks/art-18.jpg',
    'repo-sd-9': '/assets/artworks/art-1.jpg',
    'repo-sd-10': '/assets/artworks/art-2.jpg',
    'repo-sd-11': '/assets/artworks/art-repo-songket.jpg',
    'repo-sd-12': '/assets/artworks/art-3.jpg',
  };

  return {
    id: repoItem.linkedArtworkId || repoItem.id,
    title: repoItem.title,
    creator: creatorName,
    level: 'SD',
    school: schoolName,
    region: 'Nusantara, Indonesia',
    category: is3D ? 'Rak Display' : 'Dinding',
    price: 420000,
    yaw: 0,
    pitch: 2,
    room: 'ruang_5',
    description: `${repoItem.title} merupakan karya ${repoItem.kind.toLowerCase()} ciptaan ${creatorName} (${schoolName}) yang mengangkat kekayaan tradisi dan keindahan budaya Nusantara.`,
    whatsapp: '6281271001101',
    motifType: is3D ? 'phinisi' : 'batik_kawung',
    palettePrimary: '#d97706',
    paletteSecondary: '#1e293b',
    imageUrl: repoImageMap[repoItem.id] || '/assets/artworks/art-repo-garuda.jpg',
  };
}

// Pure helper functions
export function formatLevelLabel(_level?: EducationLevel | 'ALL'): string {
  return 'SD';
}

const PIN_SHORT_NAMES: Record<string, string> = {
  'art-1': 'Way Kambas',
  'art-2': 'Tari Topeng',
  'art-3': 'Kapal Phinisi',
  'art-4': 'Tameng Dayak',
  'art-5': 'Taman Bunaken',
  'art-6': 'Noken Papua',
  'art-7': 'Megamendung',
  'art-8': 'Rumah Gadang',
  'art-9': 'Batik Kawung',
  'art-10': 'Pendopo Joglo',
  'art-11': 'Tenun Sumba',
  'art-12': 'Angklung Bambu',
  'art-13': 'Patung Satwa',
  'art-14': 'Mozaik Bunga',
  'art-15': 'Kuda Lumping',
  'art-16': 'Sasando Rote',
  'art-17': 'Ondel-Ondel',
  'art-18': 'Gerabah Kasongan',
};

/**
 * Returns a concise 1-2 word hotspot label for an artwork pin.
 */
export function shortPinTitle(artwork: Pick<Artwork, 'id' | 'title'>): string {
  if (PIN_SHORT_NAMES[artwork.id]) {
    return PIN_SHORT_NAMES[artwork.id];
  }
  const words = artwork.title
    .replace(/[&·\-()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 2).join(' ') || artwork.title;
}

export function formatIDR(amount: number): string {
  const safe = Math.max(0, Math.round(Number(amount) || 0));
  return 'Rp ' + safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function buildWhatsAppUrl(artwork: Artwork): string {
  const cleanPhone = (artwork.whatsapp || '6281271001001').replace(/\D/g, '');
  const message = `Halo ${artwork.creator} (${artwork.school} - ${artwork.region}), saya tertarik untuk mengapresiasi dan membeli karya "${artwork.title}" seharga ${formatIDR(artwork.price)} di Pameran Virtual.`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Computes shortest signed angular difference in degrees in range [-180, 180]
 * so 360° camera rotation always takes the shortest arc across the -180°/+180° seam.
 */
export function shortestAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

/**
 * Returns the previous or next artwork inside the same room (sorted by yaw left-to-right),
 * wrapping around circularly so visitors can glide smoothly from artwork to artwork.
 */
export function getAdjacentArtworkInRoom(
  artworks: Artwork[],
  currentArtworkId: string,
  direction: 1 | -1,
): Artwork | null {
  const current = artworks.find((a) => a.id === currentArtworkId);
  if (!current) return null;
  const roomArts = artworks
    .filter((a) => a.room === current.room)
    .slice()
    .sort((a, b) => a.yaw - b.yaw);
  if (roomArts.length <= 1) return current;
  const idx = roomArts.findIndex((a) => a.id === current.id);
  const nextIdx = (idx + direction + roomArts.length) % roomArts.length;
  return roomArts[nextIdx] || null;
}

/**
 * Smart auto-slot locator for Admin Dashboard: finds the largest angular gap
 * in the selected room so newly added artworks never overlap existing pins or portals.
 */
export function findSmartArtworkSlot(
  artworks: Artwork[],
  room: RoomId,
  category: DisplayCategory,
): { yaw: number; pitch: number } {
  const roomSpec = ROOMS[room] || ROOMS.ruang_1;
  const occupiedYaws = [
    ...artworks.filter((a) => a.room === room).map((a) => a.yaw),
    ...roomSpec.portals.map((p) => p.yaw),
    roomSpec.repositoryYawDeg,
  ].map((y) => ((((y + 180) % 360) + 360) % 360) - 180);

  const candidateYaws = [-135, -100, -65, -35, 0, 35, 65, 100, 135, 165];
  let bestYaw = 25;
  let bestMinDist = -1;

  for (const cand of candidateYaws) {
    let minDist = 180;
    for (const occ of occupiedYaws) {
      const dist = Math.abs(shortestAngleDeltaDeg(cand, occ));
      if (dist < minDist) minDist = dist;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestYaw = cand;
    }
  }

  return {
    yaw: bestYaw,
    pitch: category === 'Dinding' ? 1 : -16,
  };
}

export function sphericalToCartesian(
  yawDeg: number,
  pitchDeg: number,
  radius: number,
): { x: number; y: number; z: number } {
  const yawRad = (yawDeg * Math.PI) / 180;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const x = radius * Math.cos(pitchRad) * Math.sin(yawRad);
  const y = radius * Math.sin(pitchRad);
  const z = -radius * Math.cos(pitchRad) * Math.cos(yawRad);
  return { x, y, z };
}

export function validateArtworkInput(input: Partial<Artwork>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length < 3) {
    errors.push('Judul karya minimal 3 karakter.');
  }
  if (!input.creator || input.creator.trim().length < 2) {
    errors.push('Nama pencipta wajib diisi.');
  }
  if (!input.school || input.school.trim().length < 3) {
    errors.push('Nama sekolah wajib diisi.');
  }
  if (!input.region || input.region.trim().length < 2) {
    errors.push('Daerah / Provinsi wajib diisi.');
  }
  const priceNum = Number(input.price);
  if (!Number.isFinite(priceNum) || priceNum < 10000) {
    errors.push('Harga karya minimal Rp 10.000.');
  }
  const yawNum = Number(input.yaw);
  if (!Number.isFinite(yawNum) || yawNum < -180 || yawNum > 180) {
    errors.push('Koordinat Yaw harus berada di antara -180° hingga 180°.');
  }
  const pitchNum = Number(input.pitch);
  if (!Number.isFinite(pitchNum) || pitchNum < -45 || pitchNum > 45) {
    errors.push('Koordinat Pitch harus berada di antara -45° hingga 45°.');
  }
  return { valid: errors.length === 0, errors };
}

export function filterArtworks(
  artworks: Artwork[],
  room: RoomId | 'ALL',
  _levelFilter: EducationLevel | 'ALL' = 'ALL',
  categoryFilter: DisplayCategory | 'ALL' = 'ALL',
  searchQuery = '',
): Artwork[] {
  const q = searchQuery.trim().toLowerCase();
  return artworks.filter((art) => {
    if (room !== 'ALL' && art.room !== room) return false;
    if (categoryFilter !== 'ALL' && art.category !== categoryFilter) return false;
    if (q) {
      const match =
        art.title.toLowerCase().includes(q) ||
        art.creator.toLowerCase().includes(q) ||
        art.school.toLowerCase().includes(q) ||
        art.region.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

export function calculateCartTotals(cart: CartItem[]): {
  totalItems: number;
  totalPrice: number;
} {
  let totalItems = 0;
  let totalPrice = 0;
  for (const item of cart) {
    totalItems += item.quantity;
    totalPrice += item.artwork.price * item.quantity;
  }
  return { totalItems, totalPrice };
}

export const INITIAL_COMMENTS: Record<string, import('./types.ts').ArtworkComment[]> = {
  'art-1': [
    {
      id: 'cmt-seed-1',
      artworkId: 'art-1',
      visitorName: 'Ibu Ratna Dewi',
      badge: 'Apresiasi Tinggi',
      message:
        'Komposisi warna hutan rawa Way Kambas dan ekspresi gajah Sumatera sangat hidup. Teruslah melukis flora dan fauna Indonesia, Bima!',
      createdAt: 'Baru saja',
    },
  ],
  'art-2': [
    {
      id: 'cmt-seed-2',
      artworkId: 'art-2',
      visitorName: 'Pak Hendra Wijaya',
      badge: 'Semangat Berkarya',
      message:
        'Goresan warna merah dan emas pada Tari Topeng Pamekasan sangat berani dan ekspresif.',
      createdAt: '10 menit lalu',
    },
  ],
  'art-17': [
    {
      id: 'cmt-seed-17',
      artworkId: 'art-17',
      visitorName: 'Kak Nadia Putri',
      badge: 'Semangat Berkarya',
      message:
        'Kreatif sekali menampilkan sepasang Ondel-Ondel lengkap dengan kembang kelapa yang rapi!',
      createdAt: '15 menit lalu',
    },
  ],
};

export function getArtworkComments(
  commentsByArtwork: Record<string, import('./types.ts').ArtworkComment[]>,
  artworkId: string,
): import('./types.ts').ArtworkComment[] {
  const list = commentsByArtwork[artworkId];
  if (Array.isArray(list) && list.length > 0) {
    return list;
  }
  return [
    {
      id: `cmt-default-${artworkId}`,
      artworkId,
      visitorName: 'Tim Kurator Pameran Virtual',
      badge: 'Apresiasi Tinggi',
      message:
        'Karya orisinal pelajar yang mengangkat kekayaan budaya daerah dengan imajinasi dan ketelitian yang membanggakan. Mari berikan apresiasi Anda!',
      createdAt: 'Hari ini',
    },
  ];
}

export function validateCommentInput(
  visitorName: string,
  message: string,
): { valid: boolean; error?: string } {
  const cleanName = (visitorName || '').trim();
  const cleanMsg = (message || '').trim();
  if (cleanName.length < 2) {
    return { valid: false, error: 'Nama pengunjung minimal 2 karakter.' };
  }
  if (cleanMsg.length < 3) {
    return { valid: false, error: 'Pesan apresiasi atau masukan minimal 3 karakter.' };
  }
  return { valid: true };
}

export interface GalleryState {
  artworks: Artwork[];
  cart: CartItem[];
  commentsByArtwork: Record<string, import('./types.ts').ArtworkComment[]>;
  currentRoom: RoomId;
  transitioningRoom: boolean;
  selectedArtworkId: string | null;
  editingArtworkId: string | null;
  levelFilter: EducationLevel | 'ALL';
  categoryFilter: DisplayCategory | 'ALL';
  searchQuery: string;
  lightingTheme: LightingThemeId;
  isAdminOpen: boolean; // Opens Public Settings + User Profile drawer
  isAdminDashboardOpen: boolean; // Opens /admin Dashboard
  isAdminAuthenticated: boolean;
  adminPasscode: string;
  isCartOpen: boolean;
  isRepositoryOpen: boolean;
  isCodeModalOpen: boolean;
  isAiStudioOpen: boolean;
  hudCollapsed: boolean;
  audioMuted: boolean;
  audioVolume: number;

  setRoom: (room: RoomId) => void;
  setTransitioningRoom: (transitioning: boolean) => void;
  selectArtwork: (id: string | null) => void;
  setEditingArtwork: (id: string | null) => void;
  setLevelFilter: (level: EducationLevel | 'ALL') => void;
  setCategoryFilter: (cat: DisplayCategory | 'ALL') => void;
  setSearchQuery: (q: string) => void;
  setLightingTheme: (theme: LightingThemeId) => void;
  setAdminOpen: (open: boolean) => void;
  setAdminDashboardOpen: (open: boolean) => void;
  setAdminAuthenticated: (authenticated: boolean) => void;
  setAdminPasscode: (newCode: string) => void;
  setCartOpen: (open: boolean) => void;
  setRepositoryOpen: (open: boolean) => void;
  setCodeModalOpen: (open: boolean) => void;
  setAiStudioOpen: (open: boolean) => void;
  setHudCollapsed: (collapsed: boolean) => void;
  setAudioMuted: (muted: boolean) => void;
  setAudioVolume: (volume: number) => void;

  addArtwork: (artwork: Omit<Artwork, 'id'>) => Artwork;
  updateArtwork: (id: string, patch: Partial<Artwork>) => void;
  deleteArtwork: (id: string) => void;
  resetSeedData: () => void;

  addArtworkComment: (
    artworkId: string,
    input: {
      visitorName: string;
      badge?: import('./types.ts').AppreciationBadge;
      message: string;
    },
  ) => import('./types.ts').ArtworkComment;
  deleteArtworkComment: (artworkId: string, commentId: string) => void;

  addToCart: (artwork: Artwork) => void;
  removeFromCart: (artworkId: string) => void;
  updateCartQuantity: (artworkId: string, delta: number) => void;
  clearCart: () => void;
}

function loadPersistedState(): {
  artworks: Artwork[];
  cart: CartItem[];
  lightingTheme: LightingThemeId;
  commentsByArtwork: Record<string, import('./types.ts').ArtworkComment[]>;
  adminPasscode: string;
} {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.artworks) && parsed.artworks.length > 0) {
          const defaultImageMap = new Map<string, string | undefined>(
            INITIAL_ARTWORKS.map((a) => [a.id, a.imageUrl]),
          );
          return {
            artworks: parsed.artworks.map((a: Artwork) => ({
              ...a,
              level: 'SD' as EducationLevel,
              room: normalizeRoomId(a.room),
              imageUrl:
                typeof a.imageUrl === 'string' && a.imageUrl.trim()
                  ? a.imageUrl
                  : defaultImageMap.get(a.id),
            })),
            cart: Array.isArray(parsed.cart) ? parsed.cart : [],
            lightingTheme: parsed.lightingTheme || 'bright_daylight',
            commentsByArtwork:
              parsed.commentsByArtwork && typeof parsed.commentsByArtwork === 'object'
                ? parsed.commentsByArtwork
                : { ...INITIAL_COMMENTS },
            adminPasscode:
              typeof parsed.adminPasscode === 'string' && parsed.adminPasscode.trim().length > 0
                ? parsed.adminPasscode.trim()
                : '123456',
          };
        }
      }

      // Migrate custom uploaded images or passcode from v8 while applying hyper-realistic v9 artwork photos
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY_V6);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        const legacyImageMap = new Map<string, string>();
        if (Array.isArray(legacyParsed?.artworks)) {
          for (const item of legacyParsed.artworks) {
            if (
              item?.id &&
              typeof item?.imageUrl === 'string' &&
              item.imageUrl.trim() &&
              item.imageUrl.startsWith('data:image/')
            ) {
              legacyImageMap.set(item.id, item.imageUrl);
            }
          }
        }
        return {
          artworks: INITIAL_ARTWORKS.map((art) =>
            legacyImageMap.has(art.id)
              ? { ...art, imageUrl: legacyImageMap.get(art.id) }
              : art,
          ),
          cart: Array.isArray(legacyParsed?.cart) ? legacyParsed.cart : [],
          lightingTheme: legacyParsed?.lightingTheme || 'bright_daylight',
          commentsByArtwork:
            legacyParsed?.commentsByArtwork && typeof legacyParsed.commentsByArtwork === 'object'
              ? legacyParsed.commentsByArtwork
              : { ...INITIAL_COMMENTS },
          adminPasscode:
            typeof legacyParsed?.adminPasscode === 'string' &&
            legacyParsed.adminPasscode.trim().length > 0
              ? legacyParsed.adminPasscode.trim()
              : '123456',
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load persisted gallery state:', e);
  }
  return {
    artworks: INITIAL_ARTWORKS,
    cart: [],
    lightingTheme: 'bright_daylight',
    commentsByArtwork: { ...INITIAL_COMMENTS },
    adminPasscode: '123456',
  };
}

function savePersistedState(state: {
  artworks: Artwork[];
  cart: CartItem[];
  lightingTheme: LightingThemeId;
  commentsByArtwork: Record<string, import('./types.ts').ArtworkComment[]>;
  adminPasscode?: string;
}) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          artworks: state.artworks,
          cart: state.cart,
          lightingTheme: state.lightingTheme,
          commentsByArtwork: state.commentsByArtwork,
          adminPasscode: state.adminPasscode || '123456',
        }),
      );
    }
  } catch (e) {
    console.warn('Failed to save gallery state:', e);
  }
}

const initialPersisted = loadPersistedState();

function isInitialAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/admin' ||
    window.location.pathname.startsWith('/admin/') ||
    window.location.hash === '#/admin'
  );
}

export const galleryStore = createStore<GalleryState>((set, get) => ({
  artworks: initialPersisted.artworks,
  cart: initialPersisted.cart,
  commentsByArtwork: initialPersisted.commentsByArtwork,
  currentRoom: 'ruang_1',
  transitioningRoom: false,
  selectedArtworkId: null,
  editingArtworkId: null,
  levelFilter: 'SD',
  categoryFilter: 'ALL',
  searchQuery: '',
  lightingTheme: initialPersisted.lightingTheme,
  isAdminOpen: false,
  isAdminDashboardOpen: isInitialAdminRoute(),
  isAdminAuthenticated: false,
  adminPasscode: initialPersisted.adminPasscode,
  isCartOpen: false,
  isRepositoryOpen: false,
  isCodeModalOpen: false,
  isAiStudioOpen: false,
  hudCollapsed: true,
  audioMuted: false,
  audioVolume: 70,

  setRoom: (room) =>
    set({
      currentRoom: normalizeRoomId(room),
      selectedArtworkId: null,
      isRepositoryOpen: false,
    }),
  setTransitioningRoom: (transitioningRoom) => set({ transitioningRoom }),
  selectArtwork: (selectedArtworkId) =>
    set({
      selectedArtworkId,
      ...(selectedArtworkId ? { isRepositoryOpen: false, isCartOpen: false } : {}),
    }),
  setEditingArtwork: (editingArtworkId) => set({ editingArtworkId }),
  setLevelFilter: () => set({ levelFilter: 'SD' }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLightingTheme: (lightingTheme) => {
    set({ lightingTheme });
    const s = get();
    savePersistedState({
      artworks: s.artworks,
      cart: s.cart,
      lightingTheme: s.lightingTheme,
      commentsByArtwork: s.commentsByArtwork,
      adminPasscode: s.adminPasscode,
    });
  },
  setAdminOpen: (isAdminOpen) =>
    set({
      isAdminOpen,
      ...(isAdminOpen
        ? {
            isAdminDashboardOpen: false,
            isCartOpen: false,
            isRepositoryOpen: false,
            isCodeModalOpen: false,
            isAiStudioOpen: false,
          }
        : {}),
    }),
  setAdminDashboardOpen: (isAdminDashboardOpen) => {
    if (typeof window !== 'undefined' && window.history?.pushState) {
      const targetPath = isAdminDashboardOpen ? '/admin' : '/';
      if (window.location.pathname !== targetPath) {
        try {
          window.history.pushState({}, '', targetPath);
        } catch {
          // ignore history error in restricted iframe
        }
      }
    }
    set({
      isAdminDashboardOpen,
      ...(isAdminDashboardOpen
        ? {
            isAdminOpen: false,
            isCartOpen: false,
            isRepositoryOpen: false,
            isCodeModalOpen: false,
            isAiStudioOpen: false,
          }
        : { editingArtworkId: null }),
    });
  },
  setAdminAuthenticated: (isAdminAuthenticated) => set({ isAdminAuthenticated }),
  setAdminPasscode: (newCode) => {
    const clean = (newCode || '').trim();
    if (!clean) return;
    set({ adminPasscode: clean });
    const s = get();
    savePersistedState({
      artworks: s.artworks,
      cart: s.cart,
      lightingTheme: s.lightingTheme,
      commentsByArtwork: s.commentsByArtwork,
      adminPasscode: clean,
    });
  },
  setCartOpen: (isCartOpen) =>
    set({
      isCartOpen,
      ...(isCartOpen
        ? {
            selectedArtworkId: null,
            isRepositoryOpen: false,
            isAdminOpen: false,
            isAdminDashboardOpen: false,
            isCodeModalOpen: false,
            isAiStudioOpen: false,
          }
        : {}),
    }),
  setRepositoryOpen: (isRepositoryOpen) =>
    set({
      isRepositoryOpen,
      ...(isRepositoryOpen
        ? {
            selectedArtworkId: null,
            isCartOpen: false,
            isAdminOpen: false,
            isAdminDashboardOpen: false,
            isCodeModalOpen: false,
            isAiStudioOpen: false,
          }
        : {}),
    }),
  setCodeModalOpen: (isCodeModalOpen) =>
    set({
      isCodeModalOpen,
      ...(isCodeModalOpen
        ? {
            isAdminOpen: false,
            isCartOpen: false,
            isRepositoryOpen: false,
            isAiStudioOpen: false,
          }
        : {}),
    }),
  setAiStudioOpen: (isAiStudioOpen) =>
    set({
      isAiStudioOpen,
      ...(isAiStudioOpen
        ? {
            isAdminOpen: false,
            isCartOpen: false,
            isRepositoryOpen: false,
            isCodeModalOpen: false,
          }
        : {}),
    }),
  setHudCollapsed: (hudCollapsed) => set({ hudCollapsed }),
  setAudioMuted: (audioMuted) => set({ audioMuted }),
  setAudioVolume: (volume) =>
    set({
      audioVolume: Math.max(0, Math.min(100, Math.round(volume))),
      ...(volume > 0 ? { audioMuted: false } : { audioMuted: true }),
    }),

  addArtwork: (artworkData) => {
    const newArtwork: Artwork = {
      ...artworkData,
      level: 'SD',
      id: 'art-' + Date.now().toString(36),
    };
    const nextArtworks = [newArtwork, ...get().artworks];
    set({ artworks: nextArtworks, editingArtworkId: newArtwork.id });
    savePersistedState({
      artworks: nextArtworks,
      cart: get().cart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
    return newArtwork;
  },

  updateArtwork: (id, patch) => {
    const nextArtworks = get().artworks.map((a) =>
      a.id === id ? { ...a, ...patch, level: 'SD' as EducationLevel } : a,
    );
    set({ artworks: nextArtworks });
    savePersistedState({
      artworks: nextArtworks,
      cart: get().cart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
  },

  deleteArtwork: (id) => {
    const nextArtworks = get().artworks.filter((a) => a.id !== id);
    const nextCart = get().cart.filter((c) => c.artwork.id !== id);
    set((s) => ({
      artworks: nextArtworks,
      cart: nextCart,
      selectedArtworkId: s.selectedArtworkId === id ? null : s.selectedArtworkId,
      editingArtworkId: s.editingArtworkId === id ? null : s.editingArtworkId,
    }));
    savePersistedState({
      artworks: nextArtworks,
      cart: nextCart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
  },

  resetSeedData: () => {
    set({
      artworks: INITIAL_ARTWORKS,
      cart: [],
      commentsByArtwork: { ...INITIAL_COMMENTS },
      selectedArtworkId: null,
      editingArtworkId: null,
      lightingTheme: 'bright_daylight',
    });
    savePersistedState({
      artworks: INITIAL_ARTWORKS,
      cart: [],
      lightingTheme: 'bright_daylight',
      commentsByArtwork: { ...INITIAL_COMMENTS },
      adminPasscode: get().adminPasscode,
    });
  },

  addArtworkComment: (artworkId, input) => {
    const existing = getArtworkComments(get().commentsByArtwork, artworkId);
    const newComment: import('./types.ts').ArtworkComment = {
      id: 'cmt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      artworkId,
      visitorName: input.visitorName.trim() || 'Pengunjung Galeri',
      badge: input.badge || 'Semangat Berkarya',
      message: input.message.trim(),
      createdAt: 'Baru saja',
    };
    const nextComments = {
      ...get().commentsByArtwork,
      [artworkId]: [newComment, ...existing],
    };
    set({ commentsByArtwork: nextComments });
    savePersistedState({
      artworks: get().artworks,
      cart: get().cart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: nextComments,
      adminPasscode: get().adminPasscode,
    });
    return newComment;
  },

  deleteArtworkComment: (artworkId, commentId) => {
    const existing = getArtworkComments(get().commentsByArtwork, artworkId);
    const filtered = existing.filter((c) => c.id !== commentId);
    const nextComments = {
      ...get().commentsByArtwork,
      [artworkId]: filtered,
    };
    set({ commentsByArtwork: nextComments });
    savePersistedState({
      artworks: get().artworks,
      cart: get().cart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: nextComments,
      adminPasscode: get().adminPasscode,
    });
  },

  addToCart: (artwork) => {
    const current = get().cart;
    const existing = current.find((item) => item.artwork.id === artwork.id);
    let nextCart: CartItem[];
    if (existing) {
      nextCart = current.map((item) =>
        item.artwork.id === artwork.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    } else {
      nextCart = [...current, { artwork, quantity: 1 }];
    }
    set({ cart: nextCart });
    savePersistedState({
      artworks: get().artworks,
      cart: nextCart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
  },

  removeFromCart: (artworkId) => {
    const nextCart = get().cart.filter((item) => item.artwork.id !== artworkId);
    set({ cart: nextCart });
    savePersistedState({
      artworks: get().artworks,
      cart: nextCart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
  },

  updateCartQuantity: (artworkId, delta) => {
    const nextCart = get()
      .cart.map((item) =>
        item.artwork.id === artworkId
          ? { ...item, quantity: item.quantity + delta }
          : item,
      )
      .filter((item) => item.quantity > 0);
    set({ cart: nextCart });
    savePersistedState({
      artworks: get().artworks,
      cart: nextCart,
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
  },

  clearCart: () => {
    set({ cart: [] });
    savePersistedState({
      artworks: get().artworks,
      cart: [],
      lightingTheme: get().lightingTheme,
      commentsByArtwork: get().commentsByArtwork,
      adminPasscode: get().adminPasscode,
    });
  },
}));
