import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

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
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
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
};

export const googleSignIn = async (): Promise<GoogleSignInResult> => {
  if (isSigningIn) {
    return {
      user: auth.currentUser,
      accessToken: cachedAccessToken,
      idToken: cachedIdToken,
      cancelled: true,
      errorCode: 'auth/Operation-in-progress',
    };
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    cachedIdToken = await result.user.getIdToken();
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      idToken: cachedIdToken,
      cancelled: false,
    };
  } catch (error: any) {
    const errorCode = String(error?.code || error?.message || 'auth/unknown');
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
  if (auth.currentUser) {
    try {
      cachedIdToken = await auth.currentUser.getIdToken();
    } catch {
      // ignore token refresh failure
    }
  }
  return cachedIdToken;
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch {
    // ignore signOut errors
  }
  cachedAccessToken = null;
  cachedIdToken = null;
};
