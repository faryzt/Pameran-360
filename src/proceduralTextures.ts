import * as THREE from 'three';
import type { Artwork, RoomId, LightingThemeId } from './types.ts';

const previewCache = new Map<string, string>();
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Periodic multi-octave trigonometric FBM noise guaranteed to be 100% seamless
 * at theta = 0 (x = 0) and theta = 2 * PI (x = width).
 */
function periodicFbm(theta: number, yNorm: number, seedOffset = 0): number {
  const s1 = Math.sin(theta * 1 + seedOffset) * Math.cos(yNorm * 3.1 + 0.4);
  const s2 = Math.sin(theta * 2 - 1.2 + seedOffset) * 0.5;
  const s3 = Math.cos(theta * 4 + yNorm * 6.0 + seedOffset) * 0.25;
  const s4 = Math.sin(theta * 8 - yNorm * 9.0 + seedOffset) * 0.125;
  const s5 = Math.cos(theta * 16 + yNorm * 14.0 + seedOffset) * 0.0625;
  const s6 = Math.sin(theta * 32 + seedOffset * 2.3) * 0.03125;
  return s1 + s2 + s3 + s4 + s5 + s6;
}

/**
 * Generates a 100% seamless 2048x1024 photorealistic natural equirectangular panorama texture.
 * All horizontal variations use periodic trigonometric functions of theta = (x / width) * 2 * Math.PI
 * so x = 0 and x = width merge with zero seam.
 */
export function createSeamlessPanoramaTexture(
  room: RoomId | string,
  theme: LightingThemeId,
): THREE.CanvasTexture {
  const cacheKey = `pano_v2_photoreal_${room}_${theme}`;
  const existing = textureCache.get(cacheKey);
  if (existing) return existing;

  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (room === 'foyer' || room === 'ruang_1') {
    drawPhotorealFoyerPanorama(ctx, width, height, theme);
  } else {
    drawPhotorealInteriorPanorama(ctx, width, height, theme);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  textureCache.set(cacheKey, texture);
  return texture;
}

function drawPhotorealFoyerPanorama(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: LightingThemeId,
) {
  const horizonY = Math.floor(h * 0.52);

  // 1. Natural Rayleigh / Mie Atmospheric Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  if (theme === 'bright_daylight') {
    skyGrad.addColorStop(0, '#082f49');
    skyGrad.addColorStop(0.28, '#0284c7');
    skyGrad.addColorStop(0.64, '#38bdf8');
    skyGrad.addColorStop(0.88, '#bae6fd');
    skyGrad.addColorStop(1, '#fef9c3');
  } else if (theme === 'golden_nusantara') {
    skyGrad.addColorStop(0, '#090d16');
    skyGrad.addColorStop(0.25, '#1e1b4b');
    skyGrad.addColorStop(0.52, '#6b21a8');
    skyGrad.addColorStop(0.76, '#c2410c');
    skyGrad.addColorStop(0.92, '#f59e0b');
    skyGrad.addColorStop(1, '#fef08a');
  } else {
    skyGrad.addColorStop(0, '#090d16');
    skyGrad.addColorStop(0.3, '#1e293b');
    skyGrad.addColorStop(0.62, '#475569');
    skyGrad.addColorStop(0.84, '#9a3412');
    skyGrad.addColorStop(0.95, '#f97316');
    skyGrad.addColorStop(1, '#fde68a');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  // 2. Natural Sun Disc & Atmospheric Mie Scattering Halo (placed away from seam at x = w * 0.5)
  const sunX = w * 0.5;
  const sunY = horizonY - h * 0.14;
  const sunHalo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 340);
  if (theme === 'bright_daylight') {
    sunHalo.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    sunHalo.addColorStop(0.08, 'rgba(254, 249, 195, 0.85)');
    sunHalo.addColorStop(0.32, 'rgba(186, 230, 253, 0.35)');
    sunHalo.addColorStop(1, 'rgba(56, 189, 248, 0)');
  } else {
    sunHalo.addColorStop(0, 'rgba(255, 255, 240, 0.98)');
    sunHalo.addColorStop(0.07, 'rgba(253, 224, 71, 0.88)');
    sunHalo.addColorStop(0.28, 'rgba(249, 115, 22, 0.42)');
    sunHalo.addColorStop(0.65, 'rgba(154, 52, 18, 0.14)');
    sunHalo.addColorStop(1, 'rgba(15, 23, 42, 0)');
  }
  ctx.fillStyle = sunHalo;
  ctx.fillRect(0, 0, w, horizonY);

  // 3. Multi-layered Volumetric Cumulus & Cirrus Clouds (100% periodic in theta)
  for (let layer = 0; layer < 6; layer++) {
    const baseY = h * (0.11 + layer * 0.062);
    const layerAlpha =
      theme === 'bright_daylight'
        ? 0.22 - layer * 0.025
        : 0.16 - layer * 0.02;

    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const theta = (x / w) * Math.PI * 2;
      const n = periodicFbm(theta, layer * 0.25, layer * 1.7);
      const y = baseY + n * (26 - layer * 2.5);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizonY);
    ctx.lineTo(0, horizonY);
    ctx.closePath();

    const cloudGrad = ctx.createLinearGradient(0, baseY - 30, 0, horizonY);
    if (theme === 'bright_daylight') {
      cloudGrad.addColorStop(0, `rgba(255, 255, 255, ${layerAlpha})`);
      cloudGrad.addColorStop(0.6, `rgba(224, 242, 254, ${layerAlpha * 0.7})`);
      cloudGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    } else {
      cloudGrad.addColorStop(0, `rgba(254, 215, 170, ${layerAlpha})`);
      cloudGrad.addColorStop(0.5, `rgba(251, 146, 60, ${layerAlpha * 0.8})`);
      cloudGrad.addColorStop(1, 'rgba(124, 45, 18, 0)');
    }
    ctx.fillStyle = cloudGrad;
    ctx.fill();
  }

  // 4. Three Aerial-Perspective Mountain Ranges (Distant -> Mid -> Foreground Tropical Ridges)
  const mountainLayers = [
    {
      scale: 115,
      seed: 0.3,
      topColor: theme === 'bright_daylight' ? '#3b82f6' : '#31102f',
      botColor: theme === 'bright_daylight' ? '#93c5fd' : '#7c2d12',
      mistAlpha: 0.38,
    },
    {
      scale: 78,
      seed: 2.1,
      topColor: theme === 'bright_daylight' ? '#1d4ed8' : '#1f1224',
      botColor: theme === 'bright_daylight' ? '#3b82f6' : '#431407',
      mistAlpha: 0.28,
    },
    {
      scale: 46,
      seed: 4.5,
      topColor: theme === 'bright_daylight' ? '#064e3b' : '#141210',
      botColor: theme === 'bright_daylight' ? '#047857' : '#1c1917',
      mistAlpha: 0.18,
    },
  ];

  for (const mLayer of mountainLayers) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const theta = (x / w) * Math.PI * 2;
      const ridge =
        Math.pow(Math.sin(theta * 2 + mLayer.seed) * 0.5 + 0.5, 1.8) * mLayer.scale +
        Math.cos(theta * 3 - mLayer.seed) * (mLayer.scale * 0.32) +
        Math.sin(theta * 7 + mLayer.seed * 2) * (mLayer.scale * 0.14) +
        Math.cos(theta * 15) * 4.5 +
        Math.sin(theta * 29) * 1.8;
      const y = horizonY - 4 - Math.max(0, ridge);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizonY);
    ctx.lineTo(0, horizonY);
    ctx.closePath();

    const mGrad = ctx.createLinearGradient(0, horizonY - mLayer.scale * 1.4, 0, horizonY);
    mGrad.addColorStop(0, mLayer.topColor);
    mGrad.addColorStop(1, mLayer.botColor);
    ctx.fillStyle = mGrad;
    ctx.fill();

    // Valley Mist Layer
    const mistGrad = ctx.createLinearGradient(0, horizonY - 28, 0, horizonY + 4);
    mistGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    mistGrad.addColorStop(
      1,
      theme === 'bright_daylight'
        ? `rgba(224, 242, 254, ${mLayer.mistAlpha})`
        : `rgba(253, 186, 116, ${mLayer.mistAlpha})`,
    );
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, horizonY - 28, w, 32);
  }

  // 5. Lush Tropical Foliage & Palm Silhouette Line along the Courtyard Perimeter
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const theta = (x / w) * Math.PI * 2;
    const canopy =
      14 +
      Math.sin(theta * 12) * 6 +
      Math.cos(theta * 28) * 4 +
      Math.abs(Math.sin(theta * 64)) * 5;
    const y = horizonY - canopy;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, horizonY + 2);
  ctx.lineTo(0, horizonY + 2);
  ctx.closePath();
  ctx.fillStyle = theme === 'bright_daylight' ? '#022c22' : '#0c0a09';
  ctx.fill();

  // 6. Photorealistic Carved Andesite Candi Bentar Colonnade & Torch Balustrade
  const numPillars = 16;
  for (let i = 0; i < numPillars; i++) {
    const theta = (i / numPillars) * Math.PI * 2;
    const cx = ((i + 0.5) / numPillars) * w;
    const isMainGate = i === 7 || i === 8;
    const archHeight = isMainGate
      ? 112
      : 54 + Math.round(Math.cos(theta * 2) * 16);
    const pillarW = isMainGate ? 34 : 22;

    // Stone shadow & sunlit bevel
    const stoneGrad = ctx.createLinearGradient(cx - pillarW / 2, 0, cx + pillarW / 2, 0);
    stoneGrad.addColorStop(0, '#1c1917');
    stoneGrad.addColorStop(0.5, '#44403c');
    stoneGrad.addColorStop(1, '#171412');
    ctx.fillStyle = stoneGrad;
    ctx.fillRect(cx - pillarW / 2, horizonY - archHeight, pillarW, archHeight + 6);

    // Horizontal Candi cornices
    const tiers = isMainGate ? 6 : 3;
    for (let t = 0; t < tiers; t++) {
      const tw = pillarW + 12 - t * 4;
      const ty = horizonY - archHeight - (t + 1) * 6;
      ctx.fillStyle = t % 2 === 0 ? '#57534e' : '#292524';
      ctx.fillRect(cx - tw / 2, ty, tw, 5);
    }

    // Warm Fire-Bowl / Temple Lantern Glow
    const glowRadius = isMainGate ? 52 : 32;
    const lanternY = horizonY - archHeight * 0.45;
    const lanternGrad = ctx.createRadialGradient(
      cx,
      lanternY,
      2,
      cx,
      lanternY,
      glowRadius,
    );
    lanternGrad.addColorStop(0, 'rgba(255, 251, 235, 0.98)');
    lanternGrad.addColorStop(0.25, 'rgba(251, 191, 36, 0.78)');
    lanternGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.25)');
    lanternGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = lanternGrad;
    ctx.beginPath();
    ctx.arc(cx, lanternY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Photorealistic Wet Andesite & Terracotta Courtyard Pavement (horizonY to h)
  const floorH = h - horizonY;
  const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  if (theme === 'bright_daylight') {
    floorGrad.addColorStop(0, '#334155');
    floorGrad.addColorStop(0.25, '#1e293b');
    floorGrad.addColorStop(0.7, '#0f172a');
    floorGrad.addColorStop(1, '#090d16');
  } else {
    floorGrad.addColorStop(0, '#3b2314');
    floorGrad.addColorStop(0.2, '#231710');
    floorGrad.addColorStop(0.65, '#140f0c');
    floorGrad.addColorStop(1, '#090706');
  }
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, horizonY, w, floorH);

  // Specular Sun/Sky Reflection Path on Wet Courtyard Stone
  const reflGrad = ctx.createRadialGradient(
    sunX,
    horizonY + floorH * 0.18,
    10,
    sunX,
    horizonY + floorH * 0.25,
    420,
  );
  reflGrad.addColorStop(
    0,
    theme === 'bright_daylight'
      ? 'rgba(186, 230, 253, 0.28)'
      : 'rgba(251, 191, 36, 0.26)',
  );
  reflGrad.addColorStop(
    0.5,
    theme === 'bright_daylight'
      ? 'rgba(56, 189, 248, 0.08)'
      : 'rgba(217, 119, 6, 0.08)',
  );
  reflGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = reflGrad;
  ctx.fillRect(0, horizonY, w, floorH);

  // Perspective-correct concentric stone rings & radial joints
  for (let ring = 1; ring <= 14; ring++) {
    const t = ring / 14;
    const ry = horizonY + Math.pow(t, 1.85) * floorH;
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.06 + t * 0.12})`;
    ctx.lineWidth = 1 + t * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(w, ry);
    ctx.stroke();
  }

  const radialSegments = 32;
  for (let s = 0; s < radialSegments; s++) {
    const rx = (s / radialSegments) * w;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rx, horizonY);
    ctx.lineTo(rx, h);
    ctx.stroke();
  }
}

function drawPhotorealInteriorPanorama(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: LightingThemeId,
) {
  const ceilingY = Math.floor(h * 0.23);
  const floorY = Math.floor(h * 0.75);
  const wallH = floorY - ceilingY;

  // 1. Acoustic Walnut Slatted & Coffered Museum Ceiling
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, ceilingY);
  if (theme === 'bright_daylight') {
    ceilGrad.addColorStop(0, '#0f172a');
    ceilGrad.addColorStop(0.65, '#1e293b');
    ceilGrad.addColorStop(1, '#334155');
  } else {
    ceilGrad.addColorStop(0, '#070504');
    ceilGrad.addColorStop(0.65, '#140e0a');
    ceilGrad.addColorStop(1, '#261a12');
  }
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, w, ceilingY);

  // Coffered ceiling perspective beams & glowing LED cove perimeter
  for (let r = 1; r <= 6; r++) {
    const cy = Math.pow(r / 6, 1.4) * ceilingY;
    ctx.strokeStyle =
      r === 6
        ? 'rgba(251, 191, 36, 0.65)'
        : 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = r === 6 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
  }

  // 2. Venetian Plaster & Natural Travertine Stone Gallery Wall (ceilingY to floorY)
  const wallGrad = ctx.createLinearGradient(0, ceilingY, 0, floorY);
  if (theme === 'bright_daylight') {
    wallGrad.addColorStop(0, '#94a3b8');
    wallGrad.addColorStop(0.18, '#e2e8f0');
    wallGrad.addColorStop(0.55, '#f8fafc');
    wallGrad.addColorStop(0.88, '#cbd5e1');
    wallGrad.addColorStop(1, '#64748b');
  } else if (theme === 'golden_nusantara') {
    wallGrad.addColorStop(0, '#1c110a');
    wallGrad.addColorStop(0.2, '#3b1d0e');
    wallGrad.addColorStop(0.55, '#4c230f');
    wallGrad.addColorStop(0.88, '#2b1409');
    wallGrad.addColorStop(1, '#140a05');
  } else {
    wallGrad.addColorStop(0, '#171310');
    wallGrad.addColorStop(0.22, '#2b231d');
    wallGrad.addColorStop(0.52, '#362c25');
    wallGrad.addColorStop(0.86, '#211b17');
    wallGrad.addColorStop(1, '#120f0d');
  }
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, ceilingY, w, wallH);

  // Subtle seamless travertine stone veining across the gallery wall
  for (let v = 0; v < 8; v++) {
    ctx.beginPath();
    const baseVy = ceilingY + ((v + 0.5) / 8) * wallH;
    for (let x = 0; x <= w; x += 4) {
      const theta = (x / w) * Math.PI * 2;
      const vy = baseVy + periodicFbm(theta, v * 0.3, v * 2.1) * 14;
      if (x === 0) ctx.moveTo(x, vy);
      else ctx.lineTo(x, vy);
    }
    ctx.strokeStyle =
      theme === 'bright_daylight'
        ? 'rgba(100, 116, 139, 0.08)'
        : 'rgba(254, 243, 199, 0.035)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 3. Realistic Parabolic Track-Spotlight Cones Washing Down the Gallery Wall
  const numSpotlights = 12;
  for (let i = 0; i < numSpotlights; i++) {
    const cx = ((i + 0.5) / numSpotlights) * w;
    const coneTopY = ceilingY;
    const coneFocusY = ceilingY + wallH * 0.42;

    // Parabolic light wash
    const spotGrad = ctx.createRadialGradient(
      cx,
      coneFocusY,
      12,
      cx,
      coneFocusY,
      165,
    );
    if (theme === 'bright_daylight') {
      spotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      spotGrad.addColorStop(0.45, 'rgba(254, 249, 195, 0.32)');
      spotGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
      spotGrad.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
      spotGrad.addColorStop(0.38, 'rgba(245, 158, 11, 0.18)');
      spotGrad.addColorStop(0.75, 'rgba(180, 83, 9, 0.06)');
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.arc(cx, coneFocusY, 165, 0, Math.PI * 2);
    ctx.fill();

    // Ceiling Spotlight Fixture Point Glow
    const fixtureGlow = ctx.createRadialGradient(cx, coneTopY + 4, 1, cx, coneTopY + 4, 18);
    fixtureGlow.addColorStop(0, '#ffffff');
    fixtureGlow.addColorStop(0.4, 'rgba(253, 224, 71, 0.85)');
    fixtureGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = fixtureGlow;
    ctx.beginPath();
    ctx.arc(cx, coneTopY + 4, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Carved Teakwood & Brass Architectural Pilasters (12 bays around 360°)
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * w;
    const drawPilasterAt = (px: number) => {
      const pGrad = ctx.createLinearGradient(px - 12, 0, px + 12, 0);
      pGrad.addColorStop(0, '#140c06');
      pGrad.addColorStop(0.5, '#3f2311');
      pGrad.addColorStop(1, '#140c06');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px - 12, ceilingY, 24, wallH);

      // Vertical Brass Inlay Strip
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px - 1.5, ceilingY, 3, wallH);
    };
    drawPilasterAt(x);
    if (i === 0) {
      // Also draw at x = w so the seam at 0/w is 100% identical
      drawPilasterAt(w);
    }
  }

  // 5. Crown Molding & Wainscoting Dado Rail with Nusantara Geometric Frieze
  ctx.fillStyle = '#29180d';
  ctx.fillRect(0, ceilingY, w, 12);
  ctx.fillRect(0, floorY - 22, w, 22);

  const friezeCount = 64;
  const tileW = w / friezeCount;
  for (let i = 0; i < friezeCount; i++) {
    const x = i * tileW;
    ctx.strokeStyle =
      theme === 'bright_daylight'
        ? 'rgba(180, 83, 9, 0.45)'
        : 'rgba(251, 191, 36, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 3, ceilingY + 14, tileW - 6, 14);
    ctx.strokeRect(x + 3, floorY - 38, tileW - 6, 14);
  }

  // 6. Mirror-Polished Dark Emperador Marble & Teak Parquet Floor (floorY to h)
  const floorH = h - floorY;
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
  if (theme === 'bright_daylight') {
    floorGrad.addColorStop(0, '#475569');
    floorGrad.addColorStop(0.35, '#1e293b');
    floorGrad.addColorStop(1, '#0f172a');
  } else {
    floorGrad.addColorStop(0, '#2c1d13');
    floorGrad.addColorStop(0.35, '#1a110b');
    floorGrad.addColorStop(0.8, '#0e0906');
    floorGrad.addColorStop(1, '#070503');
  }
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, w, floorH);

  // Specular Floor Reflections aligned with the 12 Gallery Spotlights
  for (let i = 0; i < numSpotlights; i++) {
    const cx = ((i + 0.5) / numSpotlights) * w;
    const cy = floorY + floorH * 0.25;
    const refl = ctx.createRadialGradient(cx, cy, 4, cx, cy, 110);
    refl.addColorStop(
      0,
      theme === 'bright_daylight'
        ? 'rgba(255, 255, 255, 0.22)'
        : 'rgba(251, 191, 36, 0.18)',
    );
    refl.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = refl;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();
  }

  // Perspective Floor Tile Grid
  for (let ring = 1; ring <= 10; ring++) {
    const t = ring / 10;
    const ry = floorY + Math.pow(t, 1.65) * floorH;
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.05 + t * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(w, ry);
    ctx.stroke();
  }

  for (let x = 0; x < w; x += 32) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

/**
 * Generates a rich, bespoke figurative canvas illustration for each Nusantara student artwork
 * (with special hand-painted canvas texture & curatorial framing for SD/MI, SMP & SMA works).
 */
export function renderArtworkCanvas(artwork: Artwork): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 440;
  const ctx = canvas.getContext('2d')!;

  // 1. Rich Gallery Canvas / Wood Frame Background
  const bg = ctx.createLinearGradient(0, 0, 640, 440);
  bg.addColorStop(0, artwork.palettePrimary || '#1d4ed8');
  bg.addColorStop(0.55, artwork.paletteSecondary || '#f59e0b');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 640, 440);

  // Subtle woven canvas texture lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 440; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }

  // 2. Domain-specific figurative artwork illustration
  drawMotifIllustration(ctx, artwork);

  // 3. Museum Matting & Gold Leaf Frame Border
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, 612, 412);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(22, 22, 596, 396);

  return canvas;
}

function drawMotifIllustration(ctx: CanvasRenderingContext2D, artwork: Artwork) {
  ctx.save();
  const cx = 320;
  const cy = 220;

  // Ambient sun/halo behind the central figure
  const halo = ctx.createRadialGradient(cx, cy, 15, cx, cy, 175);
  halo.addColorStop(0, 'rgba(255, 251, 235, 0.55)');
  halo.addColorStop(0.5, 'rgba(253, 224, 71, 0.18)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, 175, 0, Math.PI * 2);
  ctx.fill();

  switch (artwork.motifType) {
    case 'way_kambas': {
      // Lush Way Kambas swamp horizon & tropical foliage
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.ellipse(320, 295, 260, 55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sumatran Elephant silhouette & friendly details (SD/MI Student Painting style)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(275, 210, 74, 54, 0, 0, Math.PI * 2); // Body
      ctx.fill();
      ctx.fillRect(218, 240, 20, 48); // Legs
      ctx.fillRect(250, 244, 20, 46);
      ctx.fillRect(295, 244, 20, 46);
      ctx.fillRect(322, 240, 20, 48);

      // Elephant Head, Ear & Raised Trunk
      ctx.beginPath();
      ctx.arc(352, 185, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(326, 188, 22, 30, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Trunk curving upward
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(378, 192);
      ctx.quadraticCurveTo(422, 205, 415, 148);
      ctx.stroke();

      // White Ivory Tusk & Joyful Eye
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(368, 204);
      ctx.quadraticCurveTo(395, 212, 404, 195);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(364, 176, 5, 0, Math.PI * 2);
      ctx.fill();

      // Blooming Red Rafflesia Arnoldii Flower on the left
      ctx.save();
      ctx.translate(145, 245);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i / 5) * Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(0, -28, 18, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-5, -32, 2.5, 0, Math.PI * 2);
        ctx.arc(6, -26, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'topeng_madura': {
      // Decorative Golden Jamang Crown Rays
      ctx.save();
      ctx.translate(cx, cy + 10);
      for (let i = -6; i <= 6; i++) {
        ctx.save();
        ctx.rotate(i * 0.18);
        ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -135);
        ctx.lineTo(0, -155);
        ctx.lineTo(10, -135);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Expressive Red Topeng Ghettak Mask Face
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(0, 0, 68, 82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Bold Mask Eyes & Mustache
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(-26, -14, 16, 11, -0.1, 0, Math.PI * 2);
      ctx.ellipse(26, -14, 16, 11, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-26, -14, 6, 0, Math.PI * 2);
      ctx.arc(26, -14, 6, 0, Math.PI * 2);
      ctx.fill();

      // Crown Jewel on Forehead
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -48, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'megamendung': {
      // 7-Layer Cirebon Megamendung Cloud Gradations
      const cloudCenters = [
        { x: 185, y: 145, s: 1.0 },
        { x: 445, y: 135, s: 0.95 },
        { x: 320, y: 215, s: 1.25 },
      ];
      const blues = ['#0c4a6e', '#0369a1', '#0284c7', '#38bdf8', '#bae6fd', '#f0f9ff'];
      for (const c of cloudCenters) {
        for (let b = 0; b < blues.length; b++) {
          const r = (68 - b * 9) * c.s;
          ctx.fillStyle = blues[b];
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, r * 1.35, r * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Golden Singa Barong / Royal Carriage Emblem
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(245, 275, 24, 0, Math.PI * 2);
      ctx.arc(395, 275, 24, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'batik_kawung': {
      // Authentic 4-Petal Geometric Batik Kawung Grid + Golden Peacock Feather
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
      ctx.lineWidth = 2.2;
      for (let gx = 120; gx <= 520; gx += 80) {
        for (let gy = 95; gy <= 275; gy += 80) {
          for (let a = 0; a < 4; a++) {
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate((a * Math.PI) / 2 + Math.PI / 4);
            ctx.fillStyle = 'rgba(120, 53, 15, 0.65)';
            ctx.beginPath();
            ctx.ellipse(0, -20, 13, 22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      // Graceful Golden Merak (Peacock) at center
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 42, 26, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx - 28, cy - 28, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'ondel_betawi': {
      // Twin Betawi Ondel-Ondel Figures with Colorful Kembang Kelapa
      const drawOndel = (ox: number, faceColor: string, dressColor: string) => {
        ctx.save();
        ctx.translate(ox, 210);
        // Kembang Kelapa radiates from head
        const colors = ['#facc15', '#ec4899', '#38bdf8', '#4ade80', '#ffffff'];
        for (let i = -5; i <= 5; i++) {
          ctx.strokeStyle = colors[Math.abs(i) % colors.length];
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -45);
          ctx.lineTo(i * 12, -105 - (i % 2) * 12);
          ctx.stroke();
          ctx.fillStyle = colors[Math.abs(i) % colors.length];
          ctx.beginPath();
          ctx.arc(i * 12, -105 - (i % 2) * 12, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Body
        ctx.fillStyle = dressColor;
        ctx.beginPath();
        ctx.moveTo(-42, 75);
        ctx.lineTo(-28, -20);
        ctx.lineTo(28, -20);
        ctx.lineTo(42, 75);
        ctx.closePath();
        ctx.fill();
        // Diagonal Selendang Batik
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-26, -16);
        ctx.lineTo(34, 68);
        ctx.stroke();
        // Head
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.arc(0, -45, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      };
      drawOndel(235, '#dc2626', '#1e3a8a'); // Male Ondel-Ondel (Red face)
      drawOndel(405, '#f8fafc', '#be123c'); // Female Ondel-Ondel (White face)
      break;
    }

    case 'sasando_rote': {
      // Fan-shaped Lontar Palm Resonator (Haik) + Bamboo String Cylinder
      ctx.save();
      ctx.translate(cx, cy + 15);
      for (let i = -7; i <= 7; i++) {
        ctx.save();
        ctx.rotate(i * 0.14);
        ctx.fillStyle = i % 2 === 0 ? '#fef3c7' : '#fde68a';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.quadraticCurveTo(-18, -70, 0, -135);
        ctx.quadraticCurveTo(18, -70, 0, 40);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // Central Bamboo Tube & Strings
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-14, -105, 28, 155);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (let s = -9; s <= 9; s += 3) {
        ctx.beginPath();
        ctx.moveTo(s, -100);
        ctx.lineTo(s, 45);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }

    case 'phinisi': {
      // Sulawesi Phinisi Ship with 7 Sails
      ctx.save();
      ctx.translate(cx, cy + 35);
      // Wooden Hull
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(-130, 0);
      ctx.lineTo(145, -18);
      ctx.lineTo(105, 38);
      ctx.lineTo(-95, 38);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Twin Masts & Sails
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-45, -5);
      ctx.lineTo(-45, -135);
      ctx.lineTo(15, -20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(28, -8);
      ctx.lineTo(28, -125);
      ctx.lineTo(92, -22);
      ctx.closePath();
      ctx.fill();
      ctx. beginPath();
      ctx.moveTo(95, -12);
      ctx.lineTo(145, -55);
      ctx.lineTo(115, -5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }

    default: {
      // Sacred Nusantara Mandala / Surya Majapahit / Ornamental Geometry
      ctx.save();
      ctx.translate(cx, cy);
      const seed = artwork.id
        .split('')
        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

      for (let ring = 3; ring >= 1; ring--) {
        const r = ring * 38;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle =
          ring % 2 === 0
            ? 'rgba(255, 255, 255, 0.16)'
            : 'rgba(251, 191, 36, 0.24)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.78)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      const petals = 8 + (seed % 5) * 2;
      for (let i = 0; i < petals; i++) {
        const angle = (i / petals) * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(26, -54, 0, -110);
        ctx.quadraticCurveTo(-26, -54, 0, 0);
        ctx.fillStyle =
          i % 2 === 0 ? 'rgba(254, 240, 138, 0.85)' : 'rgba(255, 255, 255, 0.42)';
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fillStyle = artwork.paletteSecondary;
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }
  }

  ctx.restore();
}

export function getArtworkPreviewDataUrl(artwork: Artwork): string {
  if (artwork.imageUrl && artwork.imageUrl.trim().length > 0) {
    return artwork.imageUrl;
  }
  const key = `v4_${artwork.id}_${artwork.motifType}_${artwork.palettePrimary}_${artwork.paletteSecondary}`;
  const cached = previewCache.get(key);
  if (cached) return cached;
  const canvas = renderArtworkCanvas(artwork);
  const url = canvas.toDataURL('image/jpeg', 0.82);
  previewCache.set(key, url);
  return url;
}

export function getArtworkCanvasTexture(artwork: Artwork): THREE.Texture {
  const imgSig = artwork.imageUrl ? `${artwork.imageUrl.length}_${artwork.imageUrl.slice(-24)}` : 'procedural';
  const key = `tex_v4_${artwork.id}_${artwork.palettePrimary}_${imgSig}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const canvas = renderArtworkCanvas(artwork);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  if (artwork.imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        tex.needsUpdate = true;
      }
    };
    img.src = artwork.imageUrl;
  }

  textureCache.set(key, tex);
  return tex;
}

/**
 * Compresses and resizes an uploaded image File or DataURL into an optimized,
 * high-clarity JPEG DataURL (max 960x660, quality 0.84) so it renders with zero lag
 * and fits comfortably inside localStorage across all 18+ artworks.
 */
export function compressUploadedArtworkImage(
  file: File,
  maxWidth = 960,
  maxHeight = 660,
  quality = 0.84,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (!rawDataUrl) {
        reject(new Error('Berkas gambar kosong.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        try {
          let targetW = img.naturalWidth || img.width || 640;
          let targetH = img.naturalHeight || img.height || 440;
          const ratio = Math.min(maxWidth / targetW, maxHeight / targetH, 1);
          targetW = Math.max(1, Math.round(targetW * ratio));
          targetH = Math.max(1, Math.round(targetH * ratio));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.fillStyle = '#0c0a09';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressedUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

