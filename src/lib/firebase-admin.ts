import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Hanya mengimpor `firebase-admin/app` dan `firebase-admin/auth` untuk verifikasi ID Token Bearer
 * pada endpoint `/api/artworks` dan `/api/orders`. Tidak bergantung pada Firebase Storage atau Firestore.
 */
function resolveProjectId(): string {
  const envProd = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProd) return envProd;
  const envVite = process.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (envVite) return envVite;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (typeof parsed?.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // Fallback aman jika berkas konfigurasi lokal tidak tersedia
  }
  return 'pameran-virtual-id';
}

let adminAuthInstance: Auth | null = null;
try {
  if (!getApps().length) {
    initializeApp({
      projectId: resolveProjectId(),
    });
  }
  adminAuthInstance = getAuth();
} catch (err) {
  console.warn('Firebase Admin Auth initialized in fallback mode:', err);
  adminAuthInstance = null;
}

export const adminAuth = adminAuthInstance;
