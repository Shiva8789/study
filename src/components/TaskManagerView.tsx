import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { AuthUser, TaskItem } from '../types';

interface TaskManagerViewProps {
  user: AuthUser | null;
  tasks: TaskItem[];
  openAddTrigger: number;
  onNavigateAuth: () => void;
  onCreateTask: (payload: {
    title: string;
    subject: string;
    dueDate: string;
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'completed';
  }) => Promise<void>;
  onUpdateTask: (
    id: string,
    patch: Partial<Pick<TaskItem, 'title' | 'subject' | 'dueDate' | 'priority' | 'status'>>,
  ) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const SUBJECT_SUGGESTIONS = [
  'Computer Science',
  'Data Structures',
  'Database Management System',
  'Operating System',
  'Artificial Intelligence',
  'Machine Learning',
  'Mathematics',
  'Physics',
  'Chemistry',
  'English',
];

type FilterTab = 'all' | 'pending' | 'completed';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function priorityClasses(priority: TaskItem['priority']): string {
  if (priority === 'high') return 'text-red-600 font-semibold';
  if (priority === 'medium') return 'text-orange-600 font-semibold';
  return 'text-slate-500 font-medium';
}

export const TaskManagerView: React.FC<TaskManagerViewProps> = ({
  user,
  tasks,
  openAddTrigger,
  onNavigateAuth,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [status, setStatus] = useState<'todo' | 'completed'>('todo');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (openAddTrigger > 0 && user) {
      setEditingTask(null);
      setTitle('');
      setSubject('');
      setDueDate(todayIso());
      setPriority('medium');
      setStatus('todo');
      setFormError(null);
      setModalOpen(true);
    }
  }, [openAddTrigger, user]);

  const counts = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== 'completed').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return { all: tasks.length, pending, completed };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (filterTab === 'pending' && t.status === 'completed') return false;
        if (filterTab === 'completed' && t.status !== 'completed') return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.subject || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if ((a.status === 'completed') !== (b.status === 'completed')) {
          return a.status === 'completed' ? 1 : -1;
        }
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      });
  }, [tasks, filterTab, searchQuery]);

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setSubject('');
    setDueDate(todayIso());
    setPriority('medium');
    setStatus('todo');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setTitle(task.title);
    setSubject(task.subject || '');
    setDueDate(task.dueDate || todayIso());
    setPriority(task.priority);
    setStatus(task.status === 'completed' ? 'completed' : 'todo');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanSubject = subject.trim() || 'General';
    if (!cleanTitle) {
      setFormError('Please enter a task or assignment name.');
      return;
    }
    if (!dueDate) {
      setFormError('Please select a due date.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingTask) {
        await onUpdateTask(editingTask.id, {
          title: cleanTitle,
          subject: cleanSubject,
          dueDate,
          priority,
          status,
        });
      } else {
        await onCreateTask({
          title: cleanTitle,
          subject: cleanSubject,
          dueDate,
          priority,
          status,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCompleted = async (task: TaskItem) => {
    setBusyId(task.id);
    try {
      await onUpdateTask(task.id, {
        status: task.status === 'completed' ? 'todo' : 'completed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDeleteTask(id);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs sm:p-12">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4F46E5]/10 text-[#4F46E5]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold text-[#1E293B]">
          Task Manager
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Sign in to create assignments, track deadlines by subject and priority, and keep your
          tasks synced across refreshes.
        </p>
        <button
          type="button"
          onClick={onNavigateAuth}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA]"
        >
          <LogIn className="h-4 w-4" />
          <span>Sign In to Manage Tasks</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E293B]">
            Task Manager
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Organize your assignments, subjects, due dates, and completion status.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Tasks', count: counts.all },
              { id: 'pending', label: 'Pending', count: counts.pending },
              { id: 'completed', label: 'Completed', count: counts.completed },
            ] as const
          ).map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-[#1E293B]'
                }`}
              >
                {tab.label}{' '}
                <span className="tabular-nums opacity-85">({tab.count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by task or subject..."
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2 pr-8 pl-9 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-xs">
          <p className="text-base font-semibold text-[#1E293B]">
            {tasks.length === 0
              ? 'No tasks added yet'
              : 'No tasks match the selected filter'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {tasks.length === 0
              ? 'Create your first assignment or study task to get started.'
              : 'Try switching tabs or clearing your search query.'}
          </p>
          {tasks.length === 0 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338CA]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Your First Task</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isBusy = busyId === task.id;

            return (
              <div
                key={task.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:p-5"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleToggleCompleted(task)}
                    aria-label={isCompleted ? 'Mark task as pending' : 'Mark task as completed'}
                    className={`mt-0.5 shrink-0 transition-colors disabled:opacity-50 ${
                      isCompleted
                        ? 'text-green-600 hover:text-orange-600'
                        : 'text-orange-500 hover:text-green-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`break-words text-base font-semibold ${
                        isCompleted ? 'text-slate-400 line-through' : 'text-[#1E293B]'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {task.subject || 'General'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Due {task.dueDate || 'Not set'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={priorityClasses(task.priority)}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          isCompleted ? 'text-green-600' : 'text-orange-600'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:pl-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleToggleCompleted(task)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      isCompleted
                        ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {isCompleted ? 'Mark Pending' : 'Mark Completed'}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openEditModal(task)}
                    aria-label="Edit task"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>

                  {confirmDeleteId === task.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDelete(task.id)}
                        className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {isBusy ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteId(task.id)}
                      aria-label="Delete task"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-display text-lg font-bold text-[#1E293B]">
                {editingTask ? 'Edit Task' : 'Add New Task'}
              </h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                  Task / Assignment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={180}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Data Structures Lab 4 Submission"
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="studora-subject-suggestions"
                  maxLength={80}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Data Structures"
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                />
                <datalist id="studora-subject-suggestions">
                  {SUBJECT_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStatus('todo')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      status === 'todo'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Circle className="h-3.5 w-3.5" />
                    <span>Pending</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('completed')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      status === 'completed'
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#4338CA] disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{editingTask ? 'Save Changes' : 'Add Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
