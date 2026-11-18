import React, { useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, LogIn, Mail, ShieldCheck, UserCircle } from 'lucide-react';
import { SEMESTERS } from '../data/subjects';
import type { ActiveSection, AuthUser, PublicContentItem, TaskItem } from '../types';

interface UserProfileViewProps {
  user: AuthUser | null;
  tasks: TaskItem[];
  publicContents: PublicContentItem[];
  onNavigate: (section: ActiveSection) => void;
  onUpdateProfile: (payload: {
    displayName: string;
    branch: string;
    semester: string;
    bio: string;
  }) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onSendVerificationEmail: () => Promise<void>;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  tasks,
  publicContents,
  onNavigate,
  onUpdateProfile,
  onChangePassword,
  onSendVerificationEmail,
}) => {
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [branch, setBranch] = useState(user?.branch ?? 'Computer Science & Engineering');
  const [semester, setSemester] = useState(user?.semester ?? SEMESTERS[0]);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  const myUploadsCount = useMemo(
    () => (user ? publicContents.filter((item) => item.ownerId === user.uid).length : 0),
    [user, publicContents],
  );
  const completedTasksCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks],
  );

  if (!user) {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <UserCircle className="mx-auto h-10 w-10 text-blue-700 dark:text-blue-400" />
          <h1 className="font-display mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            Student Profile &amp; Security
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Sign in to customize your academic branch, semester, public bio, and password security preferences.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('auth')}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            <LogIn className="h-4 w-4" />
            Login / Register
          </button>
        </div>
      </section>
    );
  }

  const hasPasswordProvider = user.providerIds.includes('password');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await onUpdateProfile({
        displayName: displayName.trim(),
        branch: branch.trim() || 'General Studies',
        semester,
        bio: bio.trim(),
      });
      setProfileMsg('Profile updated across your STUDORA account.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErr(null);
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordErr('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg('Password updated successfully.');
    } catch (err) {
      setPasswordErr(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
          Account &amp; Academic Identity
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          User Profile
        </h1>
      </div>

      {/* Overview Header Card */}
      <div className="mt-6 flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-700 text-2xl font-bold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {user.displayName}
              </h2>
              <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                · {user.role === 'admin' ? 'Admin' : 'Student'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              {user.email} · {user.branch} · {user.semester}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className={user.emailVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                {user.emailVerified ? 'Email verified' : 'Email unverified'}
              </span>
              {!user.emailVerified && (
                <button
                  type="button"
                  onClick={async () => {
                    await onSendVerificationEmail();
                    setVerificationMsg('Verification link sent to your email address.');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Send verification email
                </button>
              )}
              {verificationMsg && (
                <span className="text-emerald-700 dark:text-emerald-400">{verificationMsg}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 text-center dark:divide-slate-800 dark:border-slate-800">
          <div className="px-4 py-2.5">
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {tasks.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Tasks</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {completedTasksCount}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Completed</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-mono text-lg font-bold text-blue-700 dark:text-blue-400 tabular-nums">
              {myUploadsCount}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Uploads</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Academic Profile Editor */}
        <form
          onSubmit={(e) => void handleSaveProfile(e)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7"
        >
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Academic Details
          </h3>

          {profileMsg && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {profileMsg}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Current Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Academic Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your study interests, specialization, or learning goals..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {savingProfile ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </form>

        {/* Password & Security Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Password Security
            </h3>
          </div>

          {hasPasswordProvider ? (
            <form onSubmit={(e) => void handlePasswordSubmit(e)} className="mt-4 space-y-3.5">
              {passwordErr && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {passwordErr}
                </p>
              )}
              {passwordMsg && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {passwordMsg}
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                <p className="text-xs leading-relaxed">
                  You signed in with <strong>Google Authentication</strong>. Your password, two-factor authentication, and session protection are managed securely through your Google Account.
                </p>
              </div>
              <p className="text-xs">
                Role assigned: <strong className="text-slate-900 dark:text-white">{user.role === 'admin' ? 'Administrator' : 'Student'}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
