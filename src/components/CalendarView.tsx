import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LogIn, Plus } from 'lucide-react';
import type { AuthUser, Course, TaskItem } from '../types';

interface CalendarViewProps {
  user: AuthUser | null;
  tasks: TaskItem[];
  courses: Course[];
  onNavigateAuth: () => void;
  onCreateTaskForDate: (payload: {
    title: string;
    courseId: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    notes: string;
    attachmentIds: string[];
  }) => Promise<void>;
  onToggleTaskDone: (task: TaskItem) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  user,
  tasks,
  courses,
  onNavigateAuth,
  onCreateTaskForDate,
  onToggleTaskDone,
}) => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [adding, setAdding] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().slice(0, 10);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { iso: string | null; day: number | null }[] = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ iso: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ iso: `${year}-${mStr}-${dStr}`, day: d });
    }
    return cells;
  }, [year, month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  const selectedDayTasks = tasksByDate.get(selectedDate) ?? [];

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setAdding(true);
    try {
      await onCreateTaskForDate({
        title: quickTitle.trim(),
        courseId: courses[0]?.id ?? 'general',
        dueDate: selectedDate,
        priority: quickPriority,
        notes: '',
        attachmentIds: [],
      });
      setQuickTitle('');
    } finally {
      setAdding(false);
    }
  };

  if (!user) {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Academic Task Calendar
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            Sign in to view all your assignment deadlines mapped across the monthly calendar and schedule tasks on any date.
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
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Deadline Schedule
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {monthLabel}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(todayStr);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Grid */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
            {calendarCells.map((cell, idx) => {
              if (!cell.iso || cell.day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-24 bg-slate-50/50 dark:bg-slate-950/40"
                  />
                );
              }
              const dayTasks = tasksByDate.get(cell.iso) ?? [];
              const isSelected = selectedDate === cell.iso;
              const isToday = todayStr === cell.iso;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso!)}
                  className={`flex min-h-24 flex-col items-start justify-between p-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-700 dark:bg-blue-950/40 dark:ring-blue-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span
                    className={`font-mono text-xs font-medium tabular-nums ${
                      isToday
                        ? 'rounded bg-blue-700 px-1.5 py-0.5 text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cell.day}
                  </span>

                  <div className="mt-1 w-full space-y-1">
                    {dayTasks.slice(0, 2).map((t) => (
                      <p
                        key={t.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          t.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 line-through dark:bg-emerald-950/60 dark:text-emerald-300'
                            : t.priority === 'high'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {t.title}
                      </p>
                    ))}
                    {dayTasks.length > 2 && (
                      <p className="font-mono text-[10px] text-slate-500 tabular-nums">
                        +{dayTasks.length - 2} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Agenda & Quick Add */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
          <p className="font-mono text-xs font-medium text-blue-700 dark:text-blue-400 tabular-nums">
            {selectedDate}
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            Tasks Due on This Day
          </h2>

          {selectedDayTasks.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No tasks scheduled for {selectedDate}. Add one below.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {selectedDayTasks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => void onToggleTaskDone(t)}
                      className={`text-left text-sm font-medium ${
                        t.status === 'completed'
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {t.title}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {t.priority} priority · {t.status.replace('_', ' ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={handleQuickAdd}
            className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800"
          >
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Schedule Task for {selectedDate}
            </h3>
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Assignment or exam revision..."
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="mt-3 flex items-center gap-2">
              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                type="submit"
                disabled={adding}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {adding ? 'Adding...' : 'Add to Date'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
