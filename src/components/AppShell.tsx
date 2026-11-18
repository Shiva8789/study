import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  CheckSquare,
  FolderUp,
  Home,
  Library,
  LogIn,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  UploadCloud,
  UserCircle,
  X,
} from 'lucide-react';
import type { ActiveSection, AuthUser } from '../types';

interface AppShellProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  user: AuthUser | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSignOut: () => Promise<void>;
  onPrimaryAction: () => void;
  children: React.ReactNode;
}

interface NavEntry {
  id: ActiveSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_GROUPS: { title: string; items: NavEntry[] }[] = [
  {
    title: 'Overview',
    items: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Productivity',
    items: [
      { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Study Hub',
    items: [
      { id: 'library', label: 'Study Library', icon: Library },
      { id: 'upload', label: 'Upload Material', icon: UploadCloud },
      { id: 'subjects', label: 'Explore Subjects', icon: BookOpen },
      { id: 'my-uploads', label: 'My Uploads', icon: FolderUp },
    ],
  },
  {
    title: 'Creative & Account',
    items: [
      { id: 'booth', label: 'Time-Travel Booth', icon: Camera },
      { id: 'profile', label: 'User Profile', icon: UserCircle },
      { id: 'admin', label: 'Admin Dashboard', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

const SECTION_TITLES: Record<ActiveSection, string> = {
  home: 'Home',
  dashboard: 'Student Dashboard',
  tasks: 'My Tasks',
  calendar: 'Task Calendar',
  library: 'Public Study Library',
  upload: 'Upload Study Material',
  subjects: 'Explore Subjects',
  'my-uploads': 'My Uploads',
  profile: 'User Profile',
  admin: 'Admin Dashboard',
  auth: 'Login & Register',
  booth: 'Time-Travel Photo Booth',
};

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onNavigate,
  user,
  darkMode,
  onToggleDarkMode,
  onSignOut,
  onPrimaryAction,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryLabel = !user
    ? 'Sign In'
    : activeSection === 'library' || activeSection === 'subjects'
      ? 'Upload Material'
      : 'New Task';

  const handleNav = (id: ActiveSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white/90 backdrop-blur-md dark:bg-[#0d1324]/95">
      <div>
        <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <span className="font-display block text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              STUDORA
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Learn Smarter. Stay Organized.
            </span>
          </button>
        </div>

        <nav aria-label="Sidebar navigation" className="space-y-5 px-3 py-5">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.adminOnly || user?.role === 'admin',
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="px-3 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
                  {group.title}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleNav(item.id)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span className="flex items-center gap-2">
            {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {darkMode ? 'Dark' : 'Light'}
          </span>
        </button>

        {user ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-semibold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {user.role === 'admin' ? 'Admin Account' : 'Student Account'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleNav('auth')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800"
          >
            <LogIn className="h-3.5 w-3.5" />
            Login / Register
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="studora-canvas min-h-screen text-slate-900 dark:text-slate-100 lg:flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 lg:block lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        {SidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 border-r border-slate-200/80 dark:border-slate-800/80 overflow-y-auto">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Strict 3-Zone Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0d1324]/85">
          <div className="flex items-center justify-between gap-8 px-6 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-sm whitespace-nowrap truncate">
                <span className="font-display font-bold text-slate-900 dark:text-white lg:hidden">
                  STUDORA
                </span>
                <span className="text-slate-300 dark:text-slate-700 lg:hidden">/</span>
                <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                  {SECTION_TITLES[activeSection]}
                </span>
              </div>
            </div>

            <nav
              aria-label="Quick navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              <button
                type="button"
                onClick={() => handleNav('home')}
                className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                  activeSection === 'home' ? 'text-slate-900 dark:text-white' : ''
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => handleNav('dashboard')}
                className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                  activeSection === 'dashboard' ? 'text-slate-900 dark:text-white' : ''
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => handleNav('tasks')}
                className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                  activeSection === 'tasks' ? 'text-slate-900 dark:text-white' : ''
                }`}
              >
                Tasks
              </button>
              <button
                type="button"
                onClick={() => handleNav('library')}
                className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                  activeSection === 'library' ? 'text-slate-900 dark:text-white' : ''
                }`}
              >
                Study Library
              </button>
            </nav>

            <div className="shrink-0">
              <button
                type="button"
                onClick={onPrimaryAction}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0d1324]/85">
          <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-3 px-6 py-5 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center">
            <p>STUDORA — Learn Smarter. Stay Organized. Achieve More.</p>
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => handleNav('library')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Study Library
              </button>
              <button
                type="button"
                onClick={() => handleNav('subjects')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Explore Subjects
              </button>
              <button
                type="button"
                onClick={() => handleNav('tasks')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                My Tasks
              </button>
              <button
                type="button"
                onClick={() => handleNav('calendar')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Calendar
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
