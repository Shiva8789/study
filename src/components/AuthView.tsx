import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { SEMESTERS } from '../data/subjects';

interface AuthViewProps {
  popupBlocked?: boolean;
  popupIssueReason?: 'closed' | 'blocked' | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleRedirectSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailRegister: (payload: {
    name: string;
    email: string;
    password: string;
    branch: string;
    semester: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  popupBlocked = false,
  popupIssueReason = null,
  onGoogleSignIn,
  onGoogleRedirectSignIn,
  onEmailSignIn,
  onEmailRegister,
  onCancel,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState<string>(SEMESTERS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const isInIframe = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const triggerGooglePopup = () => {
    setError(null);
    setGoogleLoading(true);
    void onGoogleSignIn()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      })
      .finally(() => setGoogleLoading(false));
  };

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthLabel =
    passwordScore <= 1
      ? 'Weak'
      : passwordScore === 2
        ? 'Fair'
        : passwordScore === 3
          ? 'Strong'
          : 'Very Strong';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onEmailSignIn(email.trim(), password);
      } else {
        await onEmailRegister({
          name: name.trim(),
          email: email.trim(),
          password,
          branch: branch.trim() || 'General Studies',
          semester,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <p className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            STUDORA Account
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Learn Smarter. Stay Organized. Achieve More.
          </p>
        </div>

        {/* Mode Switch */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`rounded-md py-2 text-xs font-semibold transition-colors ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`rounded-md py-2 text-xs font-semibold transition-colors ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Firebase Google Authentication */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={googleLoading}
            onClick={triggerGooglePopup}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            {googleLoading ? 'Completing Google Sign-In...' : 'Continue with Google'}
          </button>

          {isInIframe && !popupBlocked && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <span>
                Running inside an embedded preview. Keep the Google popup open until it redirects back.
              </span>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3" />
                Open in New Tab
              </a>
            </div>
          )}
        </div>

        {popupBlocked && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold">
                  {popupIssueReason === 'closed'
                    ? 'Google popup closed before completing login'
                    : 'Google sign-in popup was blocked by your browser'}
                </p>
                <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {isInIframe
                    ? 'Your browser or embedded preview frame interrupted the popup before Google could send back your session token. Open STUDORA in a full browser tab to sign in reliably, or retry and wait 2–3 seconds until the window closes automatically.'
                    : 'Allow popups for this site and wait for the popup to close automatically after choosing your Google account, or use Redirect Sign-In below.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isInIframe && (
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open STUDORA in New Tab
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={googleLoading}
                    onClick={triggerGooglePopup}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                      isInIframe
                        ? 'border border-amber-300 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800'
                        : 'bg-amber-900 text-white hover:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-600'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Google Popup
                  </button>
                  {!isInIframe && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        void onGoogleRedirectSignIn().catch((err) =>
                          setError(err instanceof Error ? err.message : 'Redirect sign-in failed.'),
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800"
                    >
                      Try Redirect Sign-In
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => emailInputRef.current?.focus()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-transparent px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100/70 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-slate-800"
                  >
                    Use Email &amp; Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs text-slate-400">or with email &amp; password</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Course / Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. B.Tech CSE"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={emailInputRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {mode === 'register' && password.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Password strength</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {strengthLabel}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 rounded-full ${
                        i < passwordScore
                          ? passwordScore >= 3
                            ? 'bg-emerald-600'
                            : 'bg-amber-500'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {mode === 'login' ? (
                <>
                  <LogIn className="h-4 w-4" />
                  {submitting ? 'Signing In...' : 'Sign In'}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {submitting ? 'Creating Account...' : 'Create Student Account'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
