'use client';

import { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } from '@/lib/auth';

// Maps Firebase auth error codes to friendly messages.
function prettyError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account with that email.';
    case 'auth/email-already-in-use':
      return 'That email already has an account — try signing in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/operation-not-allowed':
      return "This sign-in method isn't enabled yet.";
    default:
      return (e as { message?: string })?.message ?? 'Something went wrong. Please try again.';
  }
}

// Modal with Google + Email/Password (sign-in, sign-up, password reset). `onSuccess` resumes a
// pending action (e.g. the create-party the user was attempting) after sign-in; it's called only
// on a successful auth.
export default function SignInSheet({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // success messages (e.g. reset sent)
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  function reset() {
    setEmail('');
    setPassword('');
    setError(null);
    setNotice(null);
    setMode('signin');
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      // Auth succeeded — AuthProvider's listener updates the store; resume any pending action.
      onSuccess?.();
      handleClose();
    } catch (e) {
      setError(prettyError(e));
      setBusy(false);
    }
  }

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    void run(() => (mode === 'signin' ? signInWithEmail(email, password) : signUpWithEmail(email, password)));
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setNotice(null);
      setError('Enter your email above first, then tap "Forgot password".');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendPasswordReset(email.trim());
      setNotice(`Password reset link sent to ${email.trim()} — check your inbox.`);
    } catch (e) {
      setError(prettyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer">×</button>
          </div>

          <button
            onClick={() => void run(signInWithGoogle)}
            disabled={busy}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={submitEmail}>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 outline-none focus:border-gray-400 text-gray-800"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 outline-none focus:border-gray-400 text-gray-800"
            />
            {mode === 'signin' && (
              <div className="mb-3 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={busy}
                  className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              style={{ backgroundColor: busy ? '#9CA3AF' : '#111827' }}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold cursor-pointer"
            >
              {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          {notice && <p className="mt-3 text-sm text-green-600">{notice}</p>}

          <p className="mt-4 text-center text-sm text-gray-500">
            {mode === 'signin' ? 'No account?' : 'Have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setNotice(null);
              }}
              className="font-medium text-gray-900 underline cursor-pointer"
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
