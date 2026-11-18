import React, { useState } from 'react';
import { Plus, Trash2, BookOpen, ArrowRight, LogIn } from 'lucide-react';
import type { AuthUser, Course, PublicContentItem, TaskItem } from '../types';

interface CoursesViewProps {
  user: AuthUser | null;
  courses: Course[];
  tasks: TaskItem[];
  publicContents: PublicContentItem[];
  showAddForm: boolean;
  onToggleAddForm: (open: boolean) => void;
  onSignIn: () => Promise<void>;
  onCreateCourse: (payload: {
    code: string;
    title: string;
    instructor: string;
    term: string;
    color: string;
  }) => Promise<void>;
  onDeleteCourse: (id: string) => Promise<void>;
  onOpenCourseTasks: (courseId: string) => void;
}

const COURSE_SWATCHES = [
  { label: 'Cobalt', hex: '#1D4ED8' },
  { label: 'Teal', hex: '#0F766E' },
  { label: 'Amber', hex: '#B45309' },
  { label: 'Indigo', hex: '#4338CA' },
  { label: 'Slate', hex: '#334155' },
  { label: 'Crimson', hex: '#BE123C' },
];

export const CoursesView: React.FC<CoursesViewProps> = ({
  user,
  courses,
  tasks,
  publicContents,
  showAddForm,
  onToggleAddForm,
  onSignIn,
  onCreateCourse,
  onDeleteCourse,
  onOpenCourseTasks,
}) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [term, setTerm] = useState('Fall 2026');
  const [color, setColor] = useState(COURSE_SWATCHES[0].hex);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) {
      setError('Enter both a course code and title.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreateCourse({
        code: code.trim(),
        title: title.trim(),
        instructor: instructor.trim() || 'Faculty Instructor',
        term: term.trim() || 'Fall 2026',
        color,
      });
      setCode('');
      setTitle('');
      setInstructor('');
      onToggleAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add course.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Academic Directory</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Enrolled Courses
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Organize coursework, faculty contacts, and study materials across your semester schedule.
          </p>
        </div>
        {user ? (
          <button
            type="button"
            onClick={() => onToggleAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? 'Close Form' : 'Add Course'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <LogIn className="h-4 w-4" />
            Sign In to Manage Courses
          </button>
        )}
      </div>

      {!user ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="font-display mt-3 text-lg font-semibold text-slate-900">
            Sign in to organize your personal courses
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Your enrolled courses and assignment schedules sync privately to your account, while any study content you publish is visible to everyone in Public Content.
          </p>
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <LogIn className="h-4 w-4" />
            Sign In with Google
          </button>
        </div>
      ) : (
        <>
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
            >
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Register New Course
              </h2>
              {error && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. PHYS 202"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Course Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Electromagnetism & Optics"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Term
                  </label>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Fall 2026"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="flex-1 max-w-sm">
                  <label className="block text-xs font-medium text-slate-600">
                    Instructor
                  </label>
                  <input
                    type="text"
                    value={instructor}
                    onChange={(e) => setInstructor(e.target.value)}
                    placeholder="e.g. Dr. Maya Lin"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-600">
                    Course Accent
                  </span>
                  <div className="mt-1.5 flex items-center gap-2">
                    {COURSE_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        aria-label={swatch.label}
                        onClick={() => setColor(swatch.hex)}
                        className={`h-7 w-7 rounded-md border transition-transform ${
                          color === swatch.hex
                            ? 'scale-110 border-slate-900 ring-2 ring-slate-900/20'
                            : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleAddForm(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {submitting ? 'Saving...' : 'Save Course'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {courses.length === 0 ? (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="font-display mt-3 text-lg font-semibold text-slate-900">
                No courses added yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Add your first course to group assignments, deadlines, and uploaded materials.
              </p>
              <button
                type="button"
                onClick={() => onToggleAddForm(true)}
                className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Add First Course
              </button>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const courseTasks = tasks.filter((t) => t.courseId === course.id);
                const openCount = courseTasks.filter((t) => t.status !== 'completed').length;
                const fileCount = publicContents.filter(
                  (u) => u.courseCode.toLowerCase() === course.code.toLowerCase(),
                ).length;

                return (
                  <article
                    key={course.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: course.color }}
                          />
                          <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                            {course.code}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-slate-500">{course.term}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDeleteCourse(course.id)}
                          aria-label={`Remove ${course.code}`}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <h2 className="font-display mt-3 text-xl font-semibold text-slate-900">
                        {course.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">{course.instructor}</p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums">
                        <span>{openCount} open tasks</span>
                        <span aria-hidden="true">·</span>
                        <span>{fileCount} public uploads</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenCourseTasks(course.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                      >
                        View tasks
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
