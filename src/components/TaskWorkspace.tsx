import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Download,
  ExternalLink,
  FileText,
  LogIn,
  LogOut,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AuthUser, Course, PublicContentItem, TaskItem } from '../types';

interface TaskWorkspaceProps {
  user: AuthUser | null;
  courses: Course[];
  tasks: TaskItem[];
  publicContents: PublicContentItem[];
  selectedCourseFilter: string;
  onChangeCourseFilter: (courseId: string) => void;
  showCreateModal: boolean;
  onSetShowCreateModal: (open: boolean) => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onLoadSampleSemester: () => Promise<void>;
  onCreateTask: (payload: {
    title: string;
    courseId: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    notes: string;
    attachmentIds: string[];
  }) => Promise<void>;
  onUpdateTask: (id: string, patch: Partial<TaskItem>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUploadFilesForTask: (taskId: string, files: FileList) => Promise<void>;
  onOpenVault: () => void;
  onOpenBooth: () => void;
}

export const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({
  user,
  courses,
  tasks,
  publicContents,
  selectedCourseFilter,
  onChangeCourseFilter,
  showCreateModal,
  onSetShowCreateModal,
  onSignIn,
  onSignOut,
  onLoadSampleSemester,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onUploadFilesForTask,
  onOpenVault,
  onOpenBooth,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(tasks[0]?.id ?? null);

  // Create task form state
  const [newTitle, setNewTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState(courses[0]?.id ?? 'general');
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date(Date.now() + 3 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [seedingSample, setSeedingSample] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [uploadingToTask, setUploadingToTask] = useState(false);

  const courseMap = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of courses) map.set(c.id, c);
    return map;
  }, [courses]);

  const contentMap = useMemo(() => {
    const map = new Map<string, PublicContentItem>();
    for (const item of publicContents) map.set(item.id, item);
    return map;
  }, [publicContents]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const open = tasks.filter((t) => t.status !== 'completed');
    const dueSoon = open.filter((t) => t.dueDate >= today && t.dueDate <= nextWeek);
    const completed = tasks.filter((t) => t.status === 'completed');
    return {
      openCount: open.length,
      dueSoonCount: dueSoon.length,
      completedCount: completed.length,
      publicCount: publicContents.length,
    };
  }, [tasks, publicContents]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (selectedCourseFilter !== 'all' && t.courseId !== selectedCourseFilter) {
        return false;
      }
      if (statusFilter === 'active' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (q) {
        const course = courseMap.get(t.courseId);
        const haystack = `${t.title} ${t.notes} ${course?.code ?? ''} ${course?.title ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, selectedCourseFilter, statusFilter, searchQuery, courseMap]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? filteredTasks[0] ?? null,
    [tasks, activeTaskId, filteredTasks],
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please enter a task title.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateTask({
        title: newTitle.trim(),
        courseId: newCourseId || courses[0]?.id || 'general',
        dueDate: newDueDate,
        priority: newPriority,
        notes: newNotes.trim(),
        attachmentIds: [],
      });
      setNewTitle('');
      setNewNotes('');
      onSetShowCreateModal(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleAttachExisting = async (task: TaskItem, contentId: string) => {
    if (!contentId) return;
    if (task.attachmentIds.includes(contentId)) return;
    await onUpdateTask(task.id, {
      attachmentIds: [...task.attachmentIds, contentId],
    });
  };

  const handleRemoveAttachment = async (task: TaskItem, contentId: string) => {
    await onUpdateTask(task.id, {
      attachmentIds: task.attachmentIds.filter((id) => id !== contentId),
    });
  };

  const handleTaskFileUpload = async (taskId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingToTask(true);
    try {
      await onUploadFilesForTask(taskId, files);
    } finally {
      setUploadingToTask(false);
    }
  };

  const handleSeedClick = async () => {
    setSeedingSample(true);
    try {
      await onLoadSampleSemester();
    } finally {
      setSeedingSample(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const featuredPublic = publicContents.slice(0, 6);

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Front-Page Stylish Hero Header + Account Bar */}
      <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">
            ChronicleDesk · Student Task Manager &amp; Open Study Hub
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
            Plan your semester, publish study content for everyone
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Manage personal coursework, deadlines, and notes with your account, and upload files or portraits to the Public Content Hub where any visitor can browse and download them.
          </p>
        </div>

        {/* Account & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-xs font-semibold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight">
                  {user.displayName}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => void onSignOut()}
                title="Sign out"
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-4 w-4" />
              Sign In with Google
            </button>
          )}

          <button
            type="button"
            onClick={onOpenVault}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4 text-slate-600" />
            Public Content
          </button>
          <button
            type="button"
            onClick={onOpenBooth}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Camera className="h-4 w-4 text-slate-600" />
            Time-Travel Booth
          </button>
        </div>
      </div>

      {/* 4-column Summary Metric Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 border-b border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500">
            {user ? 'Your Open Tasks' : 'Student Task Account'}
          </p>
          <p className="font-mono mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {user ? metrics.openCount : 'Sign In'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Due Within 7 Days</p>
          <p className="font-mono mt-1 text-2xl font-semibold text-amber-700 tabular-nums">
            {user ? metrics.dueSoonCount : '—'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Completed Tasks</p>
          <p className="font-mono mt-1 text-2xl font-semibold text-emerald-700 tabular-nums">
            {user ? metrics.completedCount : '—'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Public Shared Uploads</p>
          <p className="font-mono mt-1 text-2xl font-semibold text-blue-700 tabular-nums">
            {metrics.publicCount}
          </p>
        </div>
      </div>

      {/* Signed-In Student Task Manager vs Visitor Sign-In Banner */}
      {!user ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-blue-700">
                Personal Workspace &amp; Creator Publishing
              </p>
              <h2 className="font-display mt-1 text-2xl font-bold text-slate-900">
                Sign in to create your private Student Task Manager &amp; upload content
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Every visitor can browse, preview, and download shared study content below right away without logging in. Sign in with your Google account to unlock your personal task planner, semester courses, and upload controls.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void onSignIn()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <LogIn className="h-4 w-4" />
                Sign In with Google
              </button>
              <button
                type="button"
                onClick={onOpenVault}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                Browse Public Hub
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* New Task Composer */}
          {showCreateModal && (
            <form
              onSubmit={handleCreateSubmit}
              className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Create Assignment Task
                </h2>
                <button
                  type="button"
                  onClick={() => onSetShowCreateModal(false)}
                  aria-label="Close task form"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {createError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createError}
                </p>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-slate-600">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Submit Midterm Lab Report & Dataset"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Course
                  </label>
                  <select
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                    <option value="general">General Study</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="font-mono mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as 'low' | 'medium' | 'high')
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600">
                    Notes &amp; Deliverable Checklist
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional study notes or submission instructions..."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSetShowCreateModal(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {creating ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Filter Toolbar */}
          <div className="mt-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
                {(['all', 'active', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === status
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status === 'all' ? 'All Tasks' : status === 'active' ? 'Active' : 'Completed'}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter by course"
                value={selectedCourseFilter}
                onChange={(e) => onChangeCourseFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
              >
                <option value="all">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks or courses..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => onSetShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </button>
            </div>
          </div>

          {/* Main Split Workspace */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {filteredTasks.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="font-display text-lg font-semibold text-slate-900">
                      {tasks.length === 0 ? 'Welcome to your task workspace' : 'No matching tasks'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tasks.length === 0
                        ? 'Create your first assignment task or load a sample semester schedule to explore.'
                        : 'Adjust your filters or add a new assignment task.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSetShowCreateModal(true)}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                      >
                        Create Task
                      </button>
                      {tasks.length === 0 && (
                        <button
                          type="button"
                          disabled={seedingSample}
                          onClick={() => void handleSeedClick()}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {seedingSample ? 'Loading...' : 'Load Sample Semester'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {filteredTasks.map((task) => {
                      const course = courseMap.get(task.courseId);
                      const isDone = task.status === 'completed';
                      const isOverdue = !isDone && task.dueDate < todayStr;
                      const isSelected = selectedTask?.id === task.id;

                      return (
                        <li
                          key={task.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 px-5 py-4">
                            <button
                              type="button"
                              aria-label={
                                isDone
                                  ? `Mark "${task.title}" incomplete`
                                  : `Complete "${task.title}"`
                              }
                              onClick={() =>
                                void onUpdateTask(task.id, {
                                  status: isDone ? 'todo' : 'completed',
                                })
                              }
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                isDone
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-300 bg-white hover:border-blue-700'
                              }`}
                            >
                              {isDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveTaskId(task.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p
                                className={`text-sm font-medium leading-snug ${
                                  isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-mono font-medium text-slate-700">
                                  {course?.code ?? 'GENERAL'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-mono tabular-nums ${
                                    isOverdue ? 'font-medium text-red-600' : ''
                                  }`}
                                >
                                  {isOverdue ? `Overdue ${task.dueDate}` : `Due ${task.dueDate}`}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    task.priority === 'high'
                                      ? 'font-medium text-red-700'
                                      : task.priority === 'medium'
                                        ? 'text-amber-700'
                                        : 'text-slate-500'
                                  }
                                >
                                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}{' '}
                                  priority
                                </span>
                                {task.attachmentIds.length > 0 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 tabular-nums text-blue-700">
                                      <Paperclip className="h-3 w-3" />
                                      {task.attachmentIds.length} attached
                                    </span>
                                  </>
                                )}
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => void onDeleteTask(task.id)}
                              aria-label={`Delete "${task.title}"`}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Right Column: Selected Task Details & Attachments */}
            <div className="lg:col-span-5">
              {selectedTask ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <p className="font-mono text-xs font-medium text-slate-500">
                        {courseMap.get(selectedTask.courseId)?.code ?? 'GENERAL'} · Due{' '}
                        <span className="tabular-nums">{selectedTask.dueDate}</span>
                      </p>
                      <h2 className="font-display mt-1 text-xl font-semibold text-slate-900">
                        {selectedTask.title}
                      </h2>
                    </div>
                    <select
                      aria-label="Task status"
                      value={selectedTask.status}
                      onChange={(e) =>
                        void onUpdateTask(selectedTask.id, {
                          status: e.target.value as TaskItem['status'],
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-slate-600">
                      Study Notes
                    </label>
                    <textarea
                      rows={4}
                      disabled={selectedTask.status === 'completed'}
                      value={selectedTask.notes}
                      onChange={(e) =>
                        void onUpdateTask(selectedTask.id, { notes: e.target.value })
                      }
                      placeholder="Write assignment notes, thesis ideas, or grading criteria..."
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Attached Materials ({selectedTask.attachmentIds.length})
                      </h3>

                      {selectedTask.status !== 'completed' && (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingToTask ? 'Uploading...' : 'Upload & Attach'}
                          <input
                            type="file"
                            multiple
                            className="sr-only"
                            disabled={uploadingToTask}
                            onChange={(e) => {
                              void handleTaskFileUpload(selectedTask.id, e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {selectedTask.attachmentIds.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        No files or notes attached yet. Upload directly or link any item from the Public Content Hub below.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                        {selectedTask.attachmentIds.map((aid) => {
                          const item = contentMap.get(aid);
                          if (!item) return null;
                          return (
                            <li
                              key={aid}
                              className="flex items-center justify-between gap-3 py-2.5"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                  {item.kind === 'link' && item.url ? (
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block truncate text-xs font-medium text-blue-700 hover:underline"
                                    >
                                      {item.title}
                                    </a>
                                  ) : item.filePath ? (
                                    <a
                                      href={`${item.filePath}?name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block truncate text-xs font-medium text-blue-700 hover:underline"
                                    >
                                      {item.title}
                                    </a>
                                  ) : (
                                    <span className="block truncate text-xs font-medium text-slate-800">
                                      {item.title}
                                    </span>
                                  )}
                                  <p className="text-[11px] text-slate-500">
                                    {item.kind.toUpperCase()} ·{' '}
                                    {Math.max(1, Math.round(item.sizeBytes / 1024))} KB
                                  </p>
                                </div>
                              </div>
                              {selectedTask.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveAttachment(selectedTask, aid)}
                                  aria-label={`Detach ${item.title}`}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {publicContents.length > 0 && selectedTask.status !== 'completed' && (
                      <div className="mt-4">
                        <label className="block text-xs font-medium text-slate-600">
                          Link from Public Content Hub
                        </label>
                        <select
                          value=""
                          onChange={(e) => {
                            void handleAttachExisting(selectedTask, e.target.value);
                          }}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
                        >
                          <option value="">Select an existing upload to attach...</option>
                          {publicContents
                            .filter((u) => !selectedTask.attachmentIds.includes(u.id))
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.title} ({u.kind})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-slate-500">
                    Select a task to view notes or attach uploaded materials.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Front-Page Public Content Feed (Visible to ANY visitor) */}
      <div className="mt-10 border-t border-slate-200 pt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Open Access · Visible to Every Visitor
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Latest Shared Study Content
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenVault}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
          >
            Open Full Content Hub ({publicContents.length})
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {featuredPublic.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-600">
              No public study content has been published yet. Sign in and upload notes, files, or Time-Travel portraits to share them with everyone!
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featuredPublic.map((item) => {
              const isImage =
                (item.kind === 'portrait' || item.mimeType.startsWith('image/')) &&
                Boolean(item.filePath);
              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div>
                    {isImage && item.filePath && (
                      <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-100">
                        <img
                          src={`${item.filePath}?name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-700">
                          {item.courseCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>By {item.authorName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.kind.toUpperCase()}</span>
                      </div>
                      <h3 className="font-display mt-2 text-lg font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                    {item.kind === 'link' && item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Resource
                      </a>
                    ) : item.filePath ? (
                      <a
                        href={`${item.filePath}?download=1&name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`}
                        download={item.originalName}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenVault}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Read Note
                      </button>
                    )}
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {Math.max(1, Math.round(item.sizeBytes / 1024))} KB
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
