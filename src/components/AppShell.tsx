import React from 'react';
import {
  BookOpen,
  CheckSquare,
  LayoutDashboard,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import type { ActiveSection, AuthUser } from '../types';

interface AppShellProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  user: AuthUser | null;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: Exclude<ActiveSection, 'auth'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Task Manager', icon: CheckSquare },
  { id: 'study', label: 'Study Mode', icon: BookOpen },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onNavigate,
  user,
  onSignOut,
  children,
}) => {
  return (
    <div className="studora-canvas flex min-h-screen flex-col text-[#1E293B]">
      {/* Minimal Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Left: Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-bold text-white shadow-xs">
              S
            </span>
            <div className="min-w-0">
              <span className="font-display block text-lg font-bold tracking-tight text-[#1E293B]">
                STUDORA
              </span>
              <span className="hidden text-[11px] font-medium text-slate-500 sm:block">
                Learn Smarter. Stay Organized.
              </span>
            </div>
          </button>

          {/* Center: Minimal 3-Link Desktop Navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1.5 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#4F46E5]/10 text-[#4F46E5]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#1E293B]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Login / Account Action */}
          <div className="flex shrink-0 items-center gap-2.5">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden items-center gap-2 sm:flex">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-xs font-semibold text-white">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="max-w-[140px] text-left">
                    <p className="truncate text-xs font-semibold text-[#1E293B]">
                      {user.displayName}
                    </p>
                    {user.role === 'admin' ? (
                      <p className="flex items-center gap-1 text-[11px] font-medium text-[#7C3AED]">
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                        Admin
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500">Student</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#1E293B] whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile 3-Tab Navigation Strip (Zero horizontal overflow) */}
        <nav
          aria-label="Mobile navigation"
          className="grid grid-cols-3 border-t border-slate-100 bg-white px-2 py-1.5 md:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#4F46E5]/10 text-[#4F46E5]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#1E293B]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <p className="font-medium text-slate-600">
            STUDORA — Learn Smarter. Stay Organized. Achieve More.
          </p>
          <div className="flex items-center gap-5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="transition-colors hover:text-[#4F46E5]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
