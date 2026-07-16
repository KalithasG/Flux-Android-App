import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { FluxLogo } from './FluxLogo';
import { SloganAnimation } from './SloganAnimation';
import { AlertCircle, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react';

import { handleFirestoreError, OperationType } from '../store';

export const AuthScreen = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      let user;
      if (Capacitor.isNativePlatform()) {
        // signInWithPopup cannot work inside the Android WebView: use the
        // native Google account picker, then sign the JS SDK in with the same
        // credential so onAuthStateChanged/store.ts behave exactly as on web.
        let result;
        try {
          result = await FirebaseAuthentication.signInWithGoogle();
        } catch (nativeErr: any) {
          // Credential Manager reports "No credentials available" on some
          // devices even with Google accounts present; fall back to the
          // classic Google Sign-In account picker.
          const nativeMsg = nativeErr?.message || String(nativeErr);
          if (!/no credentials available|NoCredential/i.test(nativeMsg)) throw nativeErr;
          result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
        }
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('Google sign-in did not return a credential');
        const credential = GoogleAuthProvider.credential(idToken);
        user = (await signInWithCredential(auth, credential)).user;
      } else {
        user = (await signInWithPopup(auth, googleProvider)).user;
      }
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || null,
          photoURL: user.photoURL || null
        }, { merge: true });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${user.uid}`);
      }
    } catch (err: any) {
      const errorCode = err.code || '';
      const errorMessage = err.message || '';

      // Web popup dismissed or native account picker cancelled — not an error.
      if (errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('auth/popup-closed-by-user') || /cancel/i.test(errorMessage)) {
        setLoading(false);
        return;
      }

      console.error("Google login failed", errorCode, err);
      // Android Credential Manager: device has no Google account signed in.
      if (/no credentials available|NoCredential/i.test(errorMessage)) {
        setError('No Google account found on this device. Add one in Android Settings, then try again.');
      } else {
        setError(errorMessage || 'Failed to sign in with Google');
      }
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await updateProfile(user, { displayName: name.trim() });
        
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email || '',
            displayName: name.trim(),
            photoURL: null
          }, { merge: true });
        } catch (firestoreErr) {
          handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Email auth error", err);
      let errorMessage = err.message || 'Authentication failed';
      if (err.code === 'auth/email-already-in-use') errorMessage = 'Email is already in use. Please sign in.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errorMessage = 'Invalid email or password.';
      if (err.code === 'auth/weak-password') errorMessage = 'Password should be at least 6 characters.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset link has been sent to your email.');
    } catch (err: any) {
      console.error("Forgot password error", err);
      let errorMessage = 'Failed to send reset email.';
      if (err.code === 'auth/user-not-found') errorMessage = 'No user found with this email.';
      if (err.code === 'auth/invalid-email') errorMessage = 'Invalid email address.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-tertiary/5 rounded-full blur-3xl" />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="z-10 flex flex-col items-center w-full"
      >
        <FluxLogo className="w-20 h-20 drop-shadow-xl mb-4" />
        <h1 className="text-4xl font-bold text-on-surface mb-2 tracking-tight">Flux</h1>
        <SloganAnimation />
        
        <p className="text-on-surface-variant mt-4 mb-8 text-sm">
          {isSignUp ? 'Create an account to get started.' : 'Sign in to manage your expenses and income.'}
        </p>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-error-container text-on-error-container p-3 rounded-xl mb-6 flex items-center gap-2 text-sm text-left"
            >
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full bg-emerald-100 text-emerald-800 p-3 rounded-xl mb-6 flex items-center gap-2 text-sm text-left"
            >
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleEmailAuth} className="w-full space-y-4 mb-6">
          {isSignUp && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={20} className="text-on-surface-variant" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-11 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant/50 rounded-2xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                required={isSignUp}
              />
            </div>
          )}
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail size={20} className="text-on-surface-variant" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full pl-11 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant/50 rounded-2xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              required
            />
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock size={20} className="text-on-surface-variant" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-11 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant/50 rounded-2xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              required
              minLength={6}
            />
          </div>

          {!isSignUp && (
            <div className="flex justify-end px-1 -mt-2">
              <button 
                type="button" 
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                Forgot Password?
              </button>
            </div>
          )}
          
          <button 
            type="submit"
            disabled={loading || !email.trim() || !password.trim() || (isSignUp && !name.trim())}
            className="w-full py-3.5 rounded-2xl bg-primary text-on-primary font-medium text-base hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'Sign In'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          
          <div className="text-sm text-on-surface-variant mt-4">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              type="button" 
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>

        <div className="w-full flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-outline-variant/30"></div>
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">OR</span>
          <div className="flex-1 h-px bg-outline-variant/30"></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-surface border border-outline-variant text-on-surface font-medium text-base hover:bg-surface-variant/50 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-70 disabled:active:scale-100"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </motion.div>
    </div>
  );
};
