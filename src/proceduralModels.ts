import * as THREE from 'three';
import type { Artwork, EducationLevel, RoomId } from './types.ts';

// Shared geometries & materials for zero-allocation room switching and 60 FPS performance
const SHARED_ART_HIT_GEO = new THREE.CircleGeometry(0.42, 16);
const SHARED_ART_OUTER_RING_GEO = new THREE.RingGeometry(0.055, 0.072, 24);
const SHARED_ART_INNER_RING_GEO = new THREE.RingGeometry(0.032, 0.052, 24);
const SHARED_ART_DOT_GEO = new THREE.CircleGeometry(0.022, 16);

const SHARED_ART_HIT_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.01,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const SHARED_ART_OUTER_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const SHARED_ART_DOT_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const LEVEL_RING_MATS: Record<EducationLevel, THREE.MeshBasicMaterial> = {
  SD: new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
};

const SHARED_REPO_RING_MAT = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.52,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const SHARED_HOTSPOT_BASE_GEO = new THREE.CircleGeometry(0.28, 24);
const SHARED_HOTSPOT_OUTER_RING_GEO = new THREE.RingGeometry(0.24, 0.29, 24);
const SHARED_HOTSPOT_INNER_RING_GEO = new THREE.RingGeometry(0.16, 0.195, 24);
const SHARED_HOTSPOT_WING_GEO = new THREE.PlaneGeometry(0.05, 0.15);

const SHARED_HOTSPOT_BASE_MAT = new THREE.MeshBasicMaterial({
  color: 0x0f172a,
  transparent: true,
  opacity: 0.28,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const SHARED_HOTSPOT_OUTER_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.65,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const SHARED_HOTSPOT_INNER_MAT = new THREE.MeshBasicMaterial({
  color: 0xfbbf24,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const SHARED_HOTSPOT_CHEVRON_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
  side: THREE.DoubleSide,
});

/**
 * Creates a sleek, world-class Google Arts & Culture / Matterport-style 3D interactive
 * spatial marker positioned over the real SD artwork in the 360° panorama photo without
 * obstructing the photograph itself. Uses shared geometries and materials for zero GC lag.
 */
export function createArtwork3DNode(artwork: Artwork): THREE.Group {
  const root = new THREE.Group();
  root.name = `artwork_${artwork.id}`;
  root.userData = {
    type: 'artwork',
    artworkId: artwork.id,
    artworkTitle: artwork.title,
  };

  // 1. Invisible generous raycast hit target
  const hitDisc = new THREE.Mesh(SHARED_ART_HIT_GEO, SHARED_ART_HIT_MAT);
  hitDisc.userData = { artworkId: artwork.id };
  root.add(hitDisc);

  // 2. Subtle Outer Halo Ring
  const outerRing = new THREE.Mesh(SHARED_ART_OUTER_RING_GEO, SHARED_ART_OUTER_MAT);
  outerRing.userData = { artworkId: artwork.id };
  root.add(outerRing);

  // 3. Inner SD Emerald Ring
  const innerRing = new THREE.Mesh(
    SHARED_ART_INNER_RING_GEO,
    LEVEL_RING_MATS[artwork.level] || LEVEL_RING_MATS.SD,
  );
  innerRing.position.z = 0.002;
  innerRing.userData = { artworkId: artwork.id };
  root.add(innerRing);

  // 4. Center Core Dot
  const centerDot = new THREE.Mesh(SHARED_ART_DOT_GEO, SHARED_ART_DOT_MAT);
  centerDot.position.z = 0.004;
  centerDot.userData = { artworkId: artwork.id };
  root.add(centerDot);

  return root;
}

/**
 * Creates a 3D interactive spatial marker over the physical "Lemari Repositori Karya SD"
 * wooden glass cabinet in the 360° room.
 */
export function createRepositoryCabinet3DNode(roomCode: string): THREE.Group {
  const root = new THREE.Group();
  root.name = `repository_cabinet_${roomCode}`;
  root.userData = {
    type: 'repository',
    label: 'Lemari Repositori Karya SD',
  };

  const hitDisc = new THREE.Mesh(SHARED_ART_HIT_GEO, SHARED_ART_HIT_MAT);
  hitDisc.userData = { type: 'repository' };
  root.add(hitDisc);

  const outerRing = new THREE.Mesh(SHARED_ART_OUTER_RING_GEO, SHARED_ART_OUTER_MAT);
  outerRing.scale.setScalar(1.25);
  outerRing.userData = { type: 'repository' };
  root.add(outerRing);

  const innerRing = new THREE.Mesh(SHARED_ART_INNER_RING_GEO, SHARED_REPO_RING_MAT);
  innerRing.scale.setScalar(1.25);
  innerRing.position.z = 0.002;
  innerRing.userData = { type: 'repository' };
  root.add(innerRing);

  const centerDot = new THREE.Mesh(SHARED_ART_DOT_GEO, SHARED_ART_DOT_MAT);
  centerDot.position.z = 0.004;
  centerDot.userData = { type: 'repository' };
  root.add(centerDot);

  return root;
}

/**
 * Creates an authentic Google Street View 3D Floor Chevron Disc
 * positioned flat on the floor leading toward a connected labyrinth room.
 */
export function createDirectionalHotspot3D(
  targetRoom: RoomId,
  label: string,
  shortLabel?: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `hotspot_to_${targetRoom}`;
  group.userData = {
    type: 'hotspot',
    targetRoom,
    label,
    shortLabel: shortLabel || label,
  };

  const baseDisc = new THREE.Mesh(SHARED_HOTSPOT_BASE_GEO, SHARED_HOTSPOT_BASE_MAT);
  baseDisc.rotation.x = -Math.PI / 2;
  baseDisc.position.y = 0.015;
  baseDisc.userData = { type: 'hotspot', targetRoom, label };
  group.add(baseDisc);

  const outerRing = new THREE.Mesh(
    SHARED_HOTSPOT_OUTER_RING_GEO,
    SHARED_HOTSPOT_OUTER_MAT,
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.02;
  outerRing.userData = { type: 'hotspot', targetRoom, label };
  group.add(outerRing);

  const innerRing = new THREE.Mesh(
    SHARED_HOTSPOT_INNER_RING_GEO,
    SHARED_HOTSPOT_INNER_MAT,
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.022;
  innerRing.userData = { type: 'hotspot', targetRoom, label };
  group.add(innerRing);

  const leftWing = new THREE.Mesh(
    SHARED_HOTSPOT_WING_GEO,
    SHARED_HOTSPOT_CHEVRON_MAT,
  );
  leftWing.rotation.x = -Math.PI / 2;
  leftWing.rotation.z = -Math.PI / 4;
  leftWing.position.set(-0.065, 0.028, -0.02);
  leftWing.userData = { type: 'hotspot', targetRoom, label };
  group.add(leftWing);

  const rightWing = new THREE.Mesh(
    SHARED_HOTSPOT_WING_GEO,
    SHARED_HOTSPOT_CHEVRON_MAT,
  );
  rightWing.rotation.x = -Math.PI / 2;
  rightWing.rotation.z = Math.PI / 4;
  rightWing.position.set(0.065, 0.028, -0.02);
  rightWing.userData = { type: 'hotspot', targetRoom, label };
  group.add(rightWing);

  return group;
}
