import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  googleSignIn, 
  logoutGoogle, 
  initAuth, 
  isAuthenticatedWithGoogle, 
  getCurrentGoogleUser 
} from '../utils/googleWorkspaceAuth';
import { CheckCircle2, LogOut, Loader2, AlertCircle } from 'lucide-react';

interface GoogleSignInButtonProps {
  onAuthChange?: (authenticated: boolean, user: User | null) => void;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  onAuthChange,
  className = ''
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentGoogleUser());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setCurrentUser(user);
        if (onAuthChange) onAuthChange(true, user);
      },
      () => {
        setCurrentUser(null);
        if (onAuthChange) onAuthChange(false, null);
      }
    );
    return () => unsubscribe();
  }, [onAuthChange]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      setCurrentUser(res.user);
      if (onAuthChange) onAuthChange(true, res.user);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await logoutGoogle();
      setCurrentUser(null);
      if (onAuthChange) onAuthChange(false, null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (currentUser) {
    return (
      <div className={`flex items-center justify-between p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl ${className}`}>
        <div className="flex items-center space-x-2.5">
          {currentUser.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt={currentUser.displayName || 'Google User'} 
              className="w-8 h-8 rounded-full border border-emerald-300"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-950">
                {currentUser.displayName || currentUser.email}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-[10px] text-emerald-700">
              Google Account Connected (Direct Sheets API Active)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isLoading}
          className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
          title="Sign out of Google"
        >
          <LogOut className="w-3 h-3" />
          <span>Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isLoading}
        className="relative inline-flex items-center justify-center w-full px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-2xl border border-slate-300 shadow-xs transition cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          )}
          <span>{isLoading ? 'Connecting to Google...' : 'Sign in with Google (Enables Direct Sheet Sync)'}</span>
        </div>
      </button>

      {errorMsg && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
