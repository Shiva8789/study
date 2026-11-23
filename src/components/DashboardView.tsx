import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  ListTodo,
  LogIn,
  Plus,
  Upload,
} from 'lucide-react';
import { triggerResourceDownload } from '../utils/firestoreFiles';
import type { ActiveSection, AuthUser, PublicContentItem, TaskItem } from '../types';

interface DashboardViewProps {
  user: AuthUser | null;
  tasks: TaskItem[];
  materials: PublicContentItem[];
  onNavigate: (section: ActiveSection) => void;
  onOpenNewTask: () => void;
  onOpenUploadContent: () => void;
  onToggleTaskStatus: (task: TaskItem) => Promise<void>;
  onReadMaterial: (item: PublicContentItem) => void;
}

function priorityTextClass(priority: TaskItem['priority']): string {
  if (priority === 'high') return 'text-red-600';
  if (priority === 'medium') return 'text-orange-600';
  return 'text-slate-500';
}

function formatPriorityLabel(priority: TaskItem['priority']): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  tasks,
  materials,
  onNavigate,
  onOpenNewTask,
  onOpenUploadContent,
  onToggleTaskStatus,
  onReadMaterial,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const pendingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'completed')
        .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')),
    [tasks],
  );

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks],
  );

  const studyMaterials = useMemo(
    () => materials.filter((m) => m.kind === 'file' || m.kind === 'note'),
    [materials],
  );

  const handleDownload = async (item: PublicContentItem) => {
    setDownloadingId(item.id);
    try {
      await triggerResourceDownload(item);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggle = async (task: TaskItem) => {
    setTogglingId(task.id);
    try {
      await onToggleTaskStatus(task);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clean Hero Overview Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-wide text-[#4F46E5]">
              STUDENT WORKSPACE
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E293B] sm:text-3xl">
              {user ? `Welcome back, ${user.displayName}` : 'Learn Smarter. Stay Organized. Achieve More.'}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Manage your daily assignments and due dates in Task Manager, or read and download
              curated study documents directly in Study Mode.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={user ? onOpenNewTask : () => onNavigate('auth')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA]"
            >
              {user ? <Plus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              <span>{user ? 'Add Task' : 'Sign In for Tasks'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('study')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E293B] transition-colors hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5 hover:text-[#7C3AED]"
            >
              <BookOpen className="h-4 w-4" />
              <span>Open Study Mode</span>
            </button>
          </div>
        </div>
      </section>

      {/* Summary Metric Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Tasks</span>
            <ListTodo className="h-4 w-4 text-[#4F46E5]" />
          </div>
          <p className="tabular-nums mt-3 text-2xl font-bold text-[#1E293B] sm:text-3xl">
            {tasks.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Pending Tasks</span>
            <Circle className="h-4 w-4 text-orange-600" />
          </div>
          <p className="tabular-nums mt-3 text-2xl font-bold text-orange-600 sm:text-3xl">
            {pendingTasks.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Completed Tasks</span>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <p className="tabular-nums mt-3 text-2xl font-bold text-green-600 sm:text-3xl">
            {completedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Study Materials</span>
            <BookOpen className="h-4 w-4 text-[#7C3AED]" />
          </div>
          <p className="tabular-nums mt-3 text-2xl font-bold text-[#4F46E5] sm:text-3xl">
            {studyMaterials.length}
          </p>
        </div>
      </section>

      {/* Two Core Feature Panels */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Panel 1: Task Manager Preview */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#1E293B]">
                Pending Tasks
              </h2>
              <p className="text-xs text-slate-500">
                Assignments and deadlines sorted by due date
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA]"
            >
              <span>Task Manager</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 p-5">
            {!user ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-10 text-center">
                <ListTodo className="h-8 w-8 text-[#4F46E5]" />
                <p className="mt-3 text-sm font-semibold text-[#1E293B]">
                  Sign in to track your personal tasks
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Your assignments, subjects, priorities, and completion status stay saved to your
                  account across devices.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('auth')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <p className="mt-3 text-sm font-semibold text-[#1E293B]">
                  No pending tasks right now
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Add a new assignment or open Task Manager to review completed items.
                </p>
                <button
                  type="button"
                  onClick={onOpenNewTask}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingTasks.slice(0, 5).map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        type="button"
                        disabled={togglingId === task.id}
                        onClick={() => void handleToggle(task)}
                        title="Mark task as completed"
                        className="mt-0.5 shrink-0 text-orange-500 transition-colors hover:text-green-600 disabled:opacity-50"
                      >
                        <Circle className="h-5 w-5" />
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1E293B]">
                          {task.title}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span>{task.subject || 'General'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {task.dueDate || 'No date'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-medium ${priorityTextClass(task.priority)}`}>
                            {formatPriorityLabel(task.priority)} Priority
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={togglingId === task.id}
                      onClick={() => void handleToggle(task)}
                      className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-green-600 hover:bg-green-50 hover:text-green-700"
                    >
                      Complete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Panel 2: Study Mode Preview */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#1E293B]">
                Study Mode Library
              </h2>
              <p className="text-xs text-slate-500">
                Public PDF & document study materials — open to all students
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('study')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:text-[#6D28D9]"
            >
              <span>Browse All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 p-5">
            {studyMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-10 text-center">
                <BookOpen className="h-8 w-8 text-[#7C3AED]" />
                <p className="mt-3 text-sm font-semibold text-[#1E293B]">
                  No study materials uploaded yet
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Once the administrator uploads PDF or Word study materials, they will appear here
                  for reading and download.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {studyMaterials.slice(0, 5).map((item) => {
                  const unitLabel =
                    item.topic && item.topic !== 'General' ? `Unit: ${item.topic}` : '';
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1E293B]">
                            {item.title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                            <span>{item.subject || 'General'}</span>
                            {unitLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{unitLabel}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px] font-medium text-[#7C3AED]">
                              {item.fileType || 'PDF'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onReadMaterial(item)}
                          className="rounded-lg bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA]"
                        >
                          Open / Read
                        </button>
                        {item.filePath && (
                          <button
                            type="button"
                            disabled={downloadingId === item.id}
                            onClick={() => void handleDownload(item)}
                            title="Download file"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>{downloadingId === item.id ? 'Saving...' : 'Download'}</span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-[#F8FAFC]/80 px-5 py-3.5 rounded-b-2xl">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#1E293B]">Upload Content</p>
              <p className="text-[11px] text-slate-500">
                Add PDF or Word study material for any subject
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenUploadContent}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Content</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
