import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
// Force prompt to ensure user grants offline/drive/sheet access
provider.setCustomParameters({
  prompt: 'select_account'
});

const TOKEN_STORAGE_KEY = 'google_workspace_access_token';
const TOKEN_TIME_KEY = 'google_workspace_token_time';

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedTime = localStorage.getItem(TOKEN_TIME_KEY);
    if (saved && savedTime) {
      // Check if token was saved within last 55 minutes
      if (Date.now() - Number(savedTime) < 55 * 60 * 1000) {
        return saved;
      }
    }
  } catch {}
  return null;
})();
let cachedUser: User | null = null;

/**
 * Initialize auth listener
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      const token = await getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedUser = null;
      cachedAccessToken = null;
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_TIME_KEY);
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Google Sign In popup to obtain OAuth access token
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Sheets access token. Please ensure popup was not blocked.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
      localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
    } catch {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached access token (memory or persistent storage)
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedTime = localStorage.getItem(TOKEN_TIME_KEY);
    if (saved && savedTime) {
      if (Date.now() - Number(savedTime) < 55 * 60 * 1000) {
        cachedAccessToken = saved;
        return saved;
      }
    }
  } catch {}
  return null;
};

/**
 * Ensures a valid token exists, opening sign-in popup if necessary
 */
export const ensureValidGoogleToken = async (): Promise<string> => {
  const existing = await getAccessToken();
  if (existing) return existing;
  const { accessToken } = await googleSignIn();
  return accessToken;
};

/**
 * Check if currently authenticated with active token
 */
export const isAuthenticatedWithGoogle = (): boolean => {
  if (cachedAccessToken) return true;
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedTime = localStorage.getItem(TOKEN_TIME_KEY);
    if (saved && savedTime && Date.now() - Number(savedTime) < 55 * 60 * 1000) {
      return true;
    }
  } catch {}
  return false;
};

export const getCurrentGoogleUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_TIME_KEY);
  } catch {}
};
