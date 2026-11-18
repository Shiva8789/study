import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  LogIn,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AuthUser, Course, PublicContentItem, TaskItem } from '../types';

interface TaskManagerViewProps {
  user: AuthUser | null;
  courses: Course[];
  tasks: TaskItem[];
  publicContents: PublicContentItem[];
  showCreateModal: boolean;
  onSetShowCreateModal: (open: boolean) => void;
  onNavigateAuth: () => void;
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
}

export const TaskManagerView: React.FC<TaskManagerViewProps> = ({
  user,
  courses,
  tasks,
  publicContents,
  showCreateModal,
  onSetShowCreateModal,
  onNavigateAuth,
  onLoadSampleSemester,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onUploadFilesForTask,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>(
    'all',
  );
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id ?? null);

  // Create state
  const [newTitle, setNewTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState(courses[0]?.id ?? 'general');
  const [newDueDate, setNewDueDate] = useState(() =>
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  );
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal state
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editStatus, setEditStatus] = useState<TaskItem['status']>('todo');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [seedingSample, setSeedingSample] = useState(false);
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

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (q) {
        const course = courseMap.get(t.courseId);
        const hay = `${t.title} ${t.notes} ${course?.code ?? ''} ${course?.title ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, searchQuery, courseMap]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? filteredTasks[0] ?? null,
    [tasks, selectedTaskId, filteredTasks],
  );

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDueDate(task.dueDate);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditNotes(task.notes);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await onUpdateTask(editingTask.id, {
        title: editTitle.trim(),
        dueDate: editDueDate,
        priority: editPriority,
        status: editStatus,
        notes: editNotes.trim(),
      });
      setEditingTask(null);
    } finally {
      setSavingEdit(false);
    }
  };

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
      setCreateError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setCreating(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  if (!user) {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            My Academic Tasks
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            Sign in or create a student account to manage tasks, set deadlines, prioritize assignments, and attach study materials.
          </p>
          <button
            type="button"
            onClick={onNavigateAuth}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            <LogIn className="h-4 w-4" />
            Login / Register
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Task Planner · <span className="font-mono tabular-nums">{tasks.length}</span> total
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Tasks
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onSetShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Create Task Form */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateSubmit}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Create New Task
            </h2>
            <button
              type="button"
              onClick={() => onSetShowCreateModal(false)}
              aria-label="Close form"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {createError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {createError}
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Task Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Complete DBMS Normalization Assignment"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Course / Subject
              </label>
              <select
                value={newCourseId}
                onChange={(e) => setNewCourseId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Deadline
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="font-mono mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Description
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes, chapters to revise, or deliverables..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onSetShowCreateModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Save Task'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'todo', label: 'Pending' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Task List & Detail Split */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {tasks.length === 0
                    ? 'Create your first task or load a sample semester schedule.'
                    : 'Try adjusting your status or priority filters.'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
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
                      onClick={() => {
                        setSeedingSample(true);
                        void onLoadSampleSemester().finally(() => setSeedingSample(false));
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {seedingSample ? 'Loading...' : 'Load Sample Semester'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredTasks.map((task) => {
                  const course = courseMap.get(task.courseId);
                  const isDone = task.status === 'completed';
                  const isOverdue = !isDone && task.dueDate < todayStr;
                  const isSelected = activeTask?.id === task.id;

                  return (
                    <li
                      key={task.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 px-5 py-4">
                        <button
                          type="button"
                          aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
                          onClick={() =>
                            void onUpdateTask(task.id, {
                              status: isDone ? 'todo' : 'completed',
                            })
                          }
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isDone
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 bg-white hover:border-blue-700 dark:border-slate-600 dark:bg-slate-900'
                          }`}
                        >
                          {isDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={`text-sm font-medium ${
                              isDone
                                ? 'text-slate-400 line-through dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                              {course?.code ?? 'GENERAL'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-mono tabular-nums ${
                                isOverdue ? 'font-semibold text-red-600 dark:text-red-400' : ''
                              }`}
                            >
                              {isOverdue ? `Overdue ${task.dueDate}` : `Due ${task.dueDate}`}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                task.priority === 'high'
                                  ? 'font-medium text-red-600 dark:text-red-400'
                                  : task.priority === 'medium'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : ''
                              }
                            >
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}{' '}
                              priority
                            </span>
                            {task.attachmentIds.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 tabular-nums">
                                  <Paperclip className="h-3 w-3" />
                                  {task.attachmentIds.length}
                                </span>
                              </>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(task)}
                            aria-label={`Edit ${task.title}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteTask(task.id)}
                            aria-label={`Delete ${task.title}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Detail Pane */}
        <div className="lg:col-span-5">
          {activeTask ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {courseMap.get(activeTask.courseId)?.code ?? 'GENERAL'} · Due{' '}
                    <span className="tabular-nums">{activeTask.dueDate}</span>
                  </p>
                  <h2 className="font-display mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                    {activeTask.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal(activeTask)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 shrink-0"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Description &amp; Notes
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {activeTask.notes || 'No description added yet.'}
                </p>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Attached Study Materials ({activeTask.attachmentIds.length})
                  </h3>
                  {activeTask.status !== 'completed' && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingToTask ? 'Uploading...' : 'Upload & Attach'}
                      <input
                        type="file"
                        multiple
                        className="sr-only"
                        disabled={uploadingToTask}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setUploadingToTask(true);
                            void onUploadFilesForTask(activeTask.id, e.target.files).finally(() =>
                              setUploadingToTask(false),
                            );
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>

                {activeTask.attachmentIds.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {activeTask.attachmentIds.map((aid) => {
                      const item = contentMap.get(aid);
                      if (!item) return null;
                      return (
                        <li key={aid} className="flex items-center justify-between gap-3 py-2.5">
                          <a
                            href={
                              item.filePath
                                ? `${item.filePath}?name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`
                                : item.url || '#'
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {item.title}
                          </a>
                          {activeTask.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() =>
                                void onUpdateTask(activeTask.id, {
                                  attachmentIds: activeTask.attachmentIds.filter((x) => x !== aid),
                                })
                              }
                              aria-label="Detach material"
                              className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a task to inspect details, edit, or attach files.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Task"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Edit Task
              </h2>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  disabled={editingTask.status === 'completed'}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Deadline
                  </label>
                  <input
                    type="date"
                    disabled={editingTask.status === 'completed'}
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="font-mono mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Priority
                  </label>
                  <select
                    disabled={editingTask.status === 'completed'}
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskItem['status'])}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="todo">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Description
                </label>
                <textarea
                  rows={4}
                  disabled={editingTask.status === 'completed'}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
