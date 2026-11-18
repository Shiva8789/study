import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Download,
  ExternalLink,
  FileText,
  UploadCloud,
} from 'lucide-react';
import type { ActiveSection, AuthUser, PublicContentItem, SubjectItem, TaskItem } from '../types';

interface LandingHomeProps {
  user: AuthUser | null;
  tasks: TaskItem[];
  publicContents: PublicContentItem[];
  subjects: SubjectItem[];
  onNavigate: (section: ActiveSection) => void;
  onSelectSubject: (subjectName: string) => void;
  onSelectResource: (item: PublicContentItem) => void;
}

export const LandingHome: React.FC<LandingHomeProps> = ({
  user,
  tasks,
  publicContents,
  subjects,
  onNavigate,
  onSelectSubject,
  onSelectResource,
}) => {
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const featuredMaterials = publicContents.slice(0, 6);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10">
      {/* Hero Section */}
      <div className="grid grid-cols-1 items-stretch gap-8 border-b border-slate-200 pb-10 dark:border-slate-800 lg:grid-cols-12">
        <div className="flex flex-col justify-center lg:col-span-7">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
            STUDORA · Student Productivity &amp; Learning Platform
          </p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl [text-wrap:balance]">
            Learn Smarter. Stay Organized. Achieve More.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Manage daily academic tasks, track semester deadlines on an interactive calendar, and explore or share lecture notes, PDFs, presentations, and study guides across every subject.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate(user ? 'dashboard' : 'auth')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
            >
              {user ? 'Open Student Dashboard' : 'Get Started Free'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Browse Public Study Library
            </button>
          </div>
        </div>

        {/* Right Hero Focal Summary Panel */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-xs dark:border-slate-800 dark:bg-[#0f172a]/95 lg:col-span-5">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Platform Workspace Snapshot
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              One workspace for deadlines and open resources
            </h2>
          </div>

          <div className="my-6 grid grid-cols-2 divide-x divide-y divide-slate-200/90 overflow-hidden rounded-xl border border-slate-200/90 bg-[#f6f9fe] dark:divide-slate-800 dark:border-slate-800 dark:bg-[#0b1120]">
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Public Resources</p>
              <p className="font-mono mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {publicContents.length}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Subjects</p>
              <p className="font-mono mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {subjects.length}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Your Open Tasks</p>
              <p className="font-mono mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {user ? tasks.length - completedCount : 'Sign In'}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasks Completed</p>
              <p className="font-mono mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {user ? completedCount : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>Visitors can browse &amp; download all public resources</span>
            <button
              type="button"
              onClick={() => onNavigate(user ? 'upload' : 'auth')}
              className="font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
            >
              {user ? 'Upload resource' : 'Sign in to upload'}
            </button>
          </div>
        </div>
      </div>

      {/* Capabilities Asymmetric Bento Grid */}
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-12">
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-700/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 md:col-span-6"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                01. Task &amp; Deadline Control
              </span>
              <CheckSquare className="h-5 w-5 text-slate-400" />
            </div>
            <h2 className="font-display mt-3 text-xl font-semibold text-slate-900 dark:text-white">
              Structured assignment tracking with priority levels
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Create, edit, filter, and complete daily coursework with High, Medium, and Low priorities, full descriptions, and deadline tracking.
            </p>
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
            Open My Tasks <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('library')}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-700/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 md:col-span-6"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                02. Public Study Library
              </span>
              <BookOpen className="h-5 w-5 text-slate-400" />
            </div>
            <h2 className="font-display mt-3 text-xl font-semibold text-slate-900 dark:text-white">
              Open educational repository for every semester
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Search and filter shared PDFs, DOCX guides, PPTX decks, and notes by subject, semester, or file type—available to every visitor immediately.
            </p>
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
            Explore Study Library <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('calendar')}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-700/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 md:col-span-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                03. Academic Calendar
              </span>
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="font-display mt-3 text-lg font-semibold text-slate-900 dark:text-white">
              Monthly deadline map
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Inspect due dates across the month and schedule tasks directly on any day.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
            View Calendar <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(user ? 'upload' : 'auth')}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-700/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 md:col-span-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                04. Material Publishing
              </span>
              <UploadCloud className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="font-display mt-3 text-lg font-semibold text-slate-900 dark:text-white">
              Validated file uploads
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Share PDFs, DOCX, PPTX slides, images, and markdown notes tagged by subject &amp; topic.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
            {user ? 'Upload Study Material' : 'Sign In to Upload'} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-700/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 md:col-span-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                05. Productivity Analytics
              </span>
              <FileText className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="font-display mt-3 text-lg font-semibold text-slate-900 dark:text-white">
              Weekly progress tracking
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Monitor completed vs overdue work, upcoming deadlines, and recent activity.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
            Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>

      {/* Browse Subjects Quick Strip */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Explore Core Subjects
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('subjects')}
            className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
          >
            All {subjects.length} Subjects
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {subjects.slice(0, 6).map((sub) => {
            const count = publicContents.filter((c) => c.subject === sub.name).length;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSubject(sub.name)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-700/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/60"
              >
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {sub.name}
                </p>
                <p className="font-mono mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {count} resources
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Latest Public Study Materials */}
      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Open Educational Resource Library
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              Recently Shared Study Materials
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
          >
            View All Resources
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {featuredMaterials.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No public study materials uploaded yet. Sign in to publish the first PDF, presentation, or lecture note.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featuredMaterials.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.subject}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.semester}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.fileType}</span>
                  </div>
                  <h3 className="font-display mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                    {item.description || item.topic}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    By {item.authorName}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectResource(item)}
                      className="text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      Details
                    </button>
                    {item.kind === 'link' && item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    ) : item.filePath ? (
                      <a
                        href={`${item.filePath}?download=1&name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`}
                        download={item.originalName}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
