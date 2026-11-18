import React, { useMemo } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileUp,
  LogIn,
  Plus,
} from 'lucide-react';
import type { ActiveSection, AuthUser, Course, PublicContentItem, TaskItem } from '../types';

interface StudentDashboardProps {
  user: AuthUser | null;
  tasks: TaskItem[];
  courses: Course[];
  publicContents: PublicContentItem[];
  onNavigate: (section: ActiveSection) => void;
  onCreateTaskClick: () => void;
  onToggleTaskDone: (task: TaskItem) => Promise<void>;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  tasks,
  courses,
  publicContents,
  onNavigate,
  onCreateTaskClick,
  onToggleTaskDone,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = tasks.filter((t) => t.status !== 'completed').length;
    const overdue = tasks.filter(
      (t) => t.status !== 'completed' && t.dueDate < todayStr,
    ).length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, overdue, completionPct };
  }, [tasks, todayStr]);

  const upcomingDeadlines = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'completed')
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
  }, [tasks]);

  // Weekly Productivity Chart (7-day window centered around today: last 3 days .. next 3 days or past 7 days)
  const weeklyBars = useMemo(() => {
    const days: { date: string; label: string; completed: number; scheduled: number }[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      const d = new Date(Date.now() + offset * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const completedOnDay = tasks.filter(
        (t) => t.status === 'completed' && t.updatedAt.slice(0, 10) === iso,
      ).length;
      const scheduledOnDay = tasks.filter((t) => t.dueDate === iso).length;
      days.push({
        date: iso,
        label,
        completed: completedOnDay,
        scheduled: scheduledOnDay,
      });
    }
    return days;
  }, [tasks]);

  const maxBarVal = useMemo(() => {
    const peak = Math.max(
      1,
      ...weeklyBars.map((b) => Math.max(b.completed, b.scheduled)),
    );
    return peak;
  }, [weeklyBars]);

  const recentActivities = useMemo(() => {
    const items: {
      id: string;
      kind: 'task' | 'upload';
      title: string;
      detail: string;
      timestamp: string;
    }[] = [];

    for (const t of tasks.slice(0, 5)) {
      items.push({
        id: `act-t-${t.id}`,
        kind: 'task',
        title: t.title,
        detail:
          t.status === 'completed'
            ? 'Marked task as completed'
            : `Due ${t.dueDate} · ${t.priority} priority`,
        timestamp: t.updatedAt.slice(0, 10),
      });
    }

    const myUploads = user
      ? publicContents.filter((u) => u.ownerId === user.uid).slice(0, 4)
      : publicContents.slice(0, 4);
    for (const u of myUploads) {
      items.push({
        id: `act-u-${u.id}`,
        kind: 'upload',
        title: u.title,
        detail: `Published ${u.fileType} in ${u.subject}`,
        timestamp: u.createdAt.slice(0, 10),
      });
    }

    return items
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 6);
  }, [tasks, publicContents, user]);

  const courseMap = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of courses) map.set(c.id, c);
    return map;
  }, [courses]);

  if (!user) {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Student Productivity Dashboard
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            Sign in to view your task completion metrics, weekly productivity chart, upcoming deadlines, and personalized activity timeline.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <LogIn className="h-4 w-4" />
              Login / Register
            </button>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Browse Study Library
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Welcome back, {user.displayName}
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Student Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FileUp className="h-4 w-4" />
            Upload Material
          </button>
          <button
            type="button"
            onClick={onCreateTaskClick}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* 4 KPI Statistics Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tasks</p>
          <p className="font-mono mt-2 text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.completionPct}% completion rate
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed Tasks</p>
          <p className="font-mono mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {stats.completed}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Finished assignments
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Tasks</p>
          <p className="font-mono mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {stats.pending}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Active &amp; in-progress items
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue Tasks</p>
          <p className="font-mono mt-2 text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {stats.overdue}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Past due date
          </p>
        </div>
      </div>

      {/* Main Analytics Row: Weekly Productivity Chart + Upcoming Deadlines */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Weekly Productivity Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Weekly Productivity
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks completed vs. scheduled deadlines over the last 7 days
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-blue-700 dark:bg-blue-500" />
                Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-300 dark:bg-slate-700" />
                Scheduled
              </span>
            </div>
          </div>

          <div className="mt-6 grid h-52 grid-cols-7 items-end gap-3 pt-4">
            {weeklyBars.map((bar) => {
              const compH = Math.round((bar.completed / maxBarVal) * 140);
              const schedH = Math.round((bar.scheduled / maxBarVal) * 140);
              return (
                <div key={bar.date} className="flex flex-col items-center justify-end gap-2">
                  <div className="flex h-36 items-end gap-1.5">
                    <div
                      title={`${bar.completed} completed`}
                      className="w-4 rounded-t bg-blue-700 transition-all dark:bg-blue-500"
                      style={{ height: `${Math.max(4, compH)}px` }}
                    />
                    <div
                      title={`${bar.scheduled} scheduled`}
                      className="w-4 rounded-t bg-slate-200 transition-all dark:bg-slate-700"
                      style={{ height: `${Math.max(4, schedH)}px` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {bar.label}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {bar.completed}/{bar.scheduled}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Overall Semester Completion
              </span>
              <span className="font-mono font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                {stats.completionPct}% ({stats.completed}/{stats.total})
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-700 transition-all dark:bg-blue-500"
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Upcoming Deadlines
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Next pending tasks ordered by due date
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                All caught up!
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Create a new assignment task to track upcoming due dates.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingDeadlines.map((t) => {
                const isOverdue = t.dueDate < todayStr;
                const course = courseMap.get(t.courseId);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => void onToggleTaskDone(t)}
                        className="text-left text-sm font-medium text-slate-900 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400 truncate block max-w-full"
                      >
                        {t.title}
                      </button>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{course?.code ?? 'GENERAL'}</span> ·{' '}
                        <span
                          className={
                            t.priority === 'high'
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : t.priority === 'medium'
                                ? 'text-amber-700 dark:text-amber-400'
                                : ''
                          }
                        >
                          {t.priority}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs tabular-nums shrink-0 ${
                        isOverdue
                          ? 'font-semibold text-red-600 dark:text-red-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isOverdue ? `Overdue ${t.dueDate}` : t.dueDate}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Recent Activities
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            All Tasks <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No recent activity yet. Add a task or upload study material to begin.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentActivities.map((act) => (
              <li key={act.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  {act.kind === 'task' ? (
                    <Clock className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                  ) : (
                    <FileUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {act.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{act.detail}</p>
                  </div>
                </div>
                <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                  {act.timestamp}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
