import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

/**
 * Catatan Arsitektur Firebase Pameran Virtual (Nusantara 360):
 * - Hanya mengimpor `firebase/app` dan `firebase/auth` (Sign-In Google & OAuth token Drive).
 * - TIDAK mengimpor `firebase/storage` atau `firebase/firestore` karena unggahan foto karya
 *   dikompresi secara lokal menjadi Data URL (Canvas WebP/JPEG) dan disimpan di penyimpanan lokal / Cloud SQL.
 *   Dengan demikian aplikasi tetap berjalan 100% normal meskipun Firebase Storage belum diaktifkan.
 */

const envMeta =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

function pickNonEmpty(primary?: string, fallback?: string): string {
  const cleanPrimary = typeof primary === 'string' ? primary.trim() : '';
  if (cleanPrimary.length > 0) return cleanPrimary;
  const cleanFallback = typeof fallback === 'string' ? fallback.trim() : '';
  return cleanFallback;
}

const resolvedConfig = {
  apiKey: pickNonEmpty(envMeta.VITE_FIREBASE_API_KEY, firebaseConfigJson?.apiKey),
  authDomain: pickNonEmpty(envMeta.VITE_FIREBASE_AUTH_DOMAIN, firebaseConfigJson?.authDomain),
  projectId: pickNonEmpty(envMeta.VITE_FIREBASE_PROJECT_ID, firebaseConfigJson?.projectId),
  appId: pickNonEmpty(envMeta.VITE_FIREBASE_APP_ID, firebaseConfigJson?.appId),
  ...(pickNonEmpty(envMeta.VITE_FIREBASE_STORAGE_BUCKET, firebaseConfigJson?.storageBucket)
    ? {
        storageBucket: pickNonEmpty(
          envMeta.VITE_FIREBASE_STORAGE_BUCKET,
          firebaseConfigJson?.storageBucket,
        ),
      }
    : {}),
};

export const isFirebaseConfigured = Boolean(
  resolvedConfig.apiKey && resolvedConfig.projectId,
);

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = getApps().length ? getApps()[0] : initializeApp(resolvedConfig);
    authInstance = getAuth(appInstance);
    googleProviderInstance = new GoogleAuthProvider();
    googleProviderInstance.addScope('https://www.googleapis.com/auth/drive.file');
    googleProviderInstance.setCustomParameters({
      prompt: 'select_account',
    });
  } catch (err) {
    console.warn('Firebase Auth fallback mode active (config incomplete or offline):', err);
    appInstance = null;
    authInstance = null;
    googleProviderInstance = null;
  }
}

export const auth = authInstance;
export const googleAuthProvider = googleProviderInstance;

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedIdToken: string | null = null;

export interface GoogleSignInResult {
  user: User | null;
  accessToken: string | null;
  idToken: string | null;
  cancelled?: boolean;
  errorCode?: string;
}

export const initAuth = (
  onAuthSuccess?: (user: User, accessToken: string | null, idToken: string) => void,
  onAuthFailure?: () => void,
): (() => void) => {
  if (!authInstance) {
    onAuthFailure?.();
    return () => {};
  }
  try {
    return onAuthStateChanged(authInstance, async (user: User | null) => {
      if (user) {
        try {
          cachedIdToken = await user.getIdToken();
          if (cachedAccessToken) {
            onAuthSuccess?.(user, cachedAccessToken, cachedIdToken);
          } else if (!isSigningIn) {
            onAuthSuccess?.(user, null, cachedIdToken);
          }
        } catch {
          cachedAccessToken = null;
          cachedIdToken = null;
          onAuthFailure?.();
        }
      } else {
        cachedAccessToken = null;
        cachedIdToken = null;
        onAuthFailure?.();
      }
    });
  } catch {
    onAuthFailure?.();
    return () => {};
  }
};

export const googleSignIn = async (): Promise<GoogleSignInResult> => {
  if (!authInstance || !googleProviderInstance) {
    return {
      user: null,
      accessToken: null,
      idToken: null,
      cancelled: true,
      errorCode: 'auth/not-configured',
    };
  }
  if (isSigningIn) {
    return {
      user: authInstance.currentUser,
      accessToken: cachedAccessToken,
      idToken: cachedIdToken,
      cancelled: true,
      errorCode: 'auth/Operation-in-progress',
    };
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(authInstance, googleProviderInstance);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    cachedIdToken = await result.user.getIdToken();
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      idToken: cachedIdToken,
      cancelled: false,
    };
  } catch (error: unknown) {
    const errObj = error as { code?: string; message?: string } | null;
    const errorCode = String(errObj?.code || errObj?.message || 'auth/unknown');
    return {
      user: null,
      accessToken: null,
      idToken: null,
      cancelled: true,
      errorCode,
    };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getIdToken = async (): Promise<string | null> => {
  if (authInstance?.currentUser) {
    try {
      cachedIdToken = await authInstance.currentUser.getIdToken();
    } catch {
      // ignore token refresh failure
    }
  }
  return cachedIdToken;
};

export const logout = async (): Promise<void> => {
  if (authInstance) {
    try {
      await authInstance.signOut();
    } catch {
      // ignore signOut errors
    }
  }
  cachedAccessToken = null;
  cachedIdToken = null;
};

