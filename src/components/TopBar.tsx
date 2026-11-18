import React from 'react';
import type { ActiveSection, AuthUser } from '../types';

interface TopBarProps {
  activeSection: ActiveSection;
  user: AuthUser | null;
  onNavigate: (section: ActiveSection) => void;
  onPrimaryAction: () => void;
}

const NAV_ITEMS: { id: ActiveSection; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'library', label: 'Public Content' },
  { id: 'booth', label: 'Time-Travel' },
  { id: 'subjects', label: 'Subjects' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  user,
  onNavigate,
  onPrimaryAction,
}) => {
  const primaryLabel = !user
    ? 'Sign In'
    : activeSection === 'library'
      ? 'Upload Content'
      : activeSection === 'booth'
        ? 'Save Portrait'
        : activeSection === 'subjects'
          ? 'Add Subject'
          : 'New Task';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          ChronicleDesk
        </button>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-6 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
