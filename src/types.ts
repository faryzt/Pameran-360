export type EducationLevel = 'SD';
export type DisplayCategory = 'Dinding' | 'Rak Display';
export type RoomId = 'ruang_1' | 'ruang_2' | 'ruang_3' | 'ruang_4' | 'ruang_5';
export type LightingThemeId = 'warm_museum' | 'bright_daylight' | 'golden_nusantara';
export type AppreciationBadge =
  | 'Semangat Berkarya'
  | 'Apresiasi Tinggi'
  | 'Masukan Konstruktif';

export type MotifType =
  | 'way_kambas'
  | 'topeng_madura'
  | 'phinisi'
  | 'tameng_dayak'
  | 'gringsing_bali'
  | 'noken_papua'
  | 'megamendung'
  | 'rumah_gadang'
  | 'batik_kawung'
  | 'wayang_kulit'
  | 'tenun_sumba'
  | 'keris_ukir'
  | 'garuda_wisnu'
  | 'ulos_batak'
  | 'songket_palembang'
  | 'sasando_rote'
  | 'ondel_betawi'
  | 'gerabah_kasongan';

export interface ArtworkComment {
  id: string;
  artworkId: string;
  visitorName: string;
  badge: AppreciationBadge;
  message: string;
  createdAt: string;
}

export interface RepositoryArtworkItem {
  id: string;
  title: string;
  kind: string;
  creator: string;
  linkUrl: string;
  linkedArtworkId?: string;
}

export interface RoomPortalSpec {
  targetRoom: RoomId;
  label: string;
  shortLabel: string;
  yaw: number; // Degrees (-180 to 180) in room space
  distance?: number; // Floor distance in meters
  entryYaw: number; // Camera yaw upon entering targetRoom
}

export interface RoomSpec {
  id: RoomId;
  code: string; // R1..R5
  name: string;
  shortName: string;
  subtitle: string;
  panoramaUrl: string;
  yawOffsetDeg: number;
  defaultYawDeg: number;
  repositoryYawDeg: number;
  repositoryPitchDeg: number;
  mapX: number; // 0..100 on Labyrinth SVG floorplan
  mapY: number; // 0..100 on Labyrinth SVG floorplan
  portals: RoomPortalSpec[];
}

export interface Artwork {
  id: string;
  title: string;
  creator: string;
  level: EducationLevel;
  school: string;
  region: string;
  category: DisplayCategory;
  price: number;
  yaw: number; // Degrees (-180 to 180)
  pitch: number; // Degrees (-45 to 45)
  room: RoomId;
  description: string;
  whatsapp: string;
  motifType: MotifType;
  palettePrimary: string;
  paletteSecondary: string;
  imageUrl?: string;
}

export interface CartItem {
  artwork: Artwork;
  quantity: number;
}

export interface LightingThemeSpec {
  id: LightingThemeId;
  name: string;
  subtitle: string;
  ambientColor: number;
  groundColor: number;
  ambientIntensity: number;
  keyLightColor: number;
  keyLightIntensity: number;
  spotLightColor: number;
  spotLightIntensity: number;
  fogColor: number;
  exposure: number;
  sphereTintHex: number;
}
