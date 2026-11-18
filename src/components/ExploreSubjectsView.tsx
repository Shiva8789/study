import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Plus, Search, Trash2, X } from 'lucide-react';
import type { ActiveSection, AuthUser, PublicContentItem, SubjectItem } from '../types';

interface ExploreSubjectsViewProps {
  user: AuthUser | null;
  subjects: SubjectItem[];
  publicContents: PublicContentItem[];
  onSelectSubject: (subjectName: string) => void;
  onNavigate: (section: ActiveSection) => void;
  onCreateCustomSubject: (payload: {
    name: string;
    category: string;
    description: string;
  }) => Promise<void>;
  onDeleteCustomSubject: (id: string) => Promise<void>;
}

export const ExploreSubjectsView: React.FC<ExploreSubjectsViewProps> = ({
  user,
  subjects,
  publicContents,
  onSelectSubject,
  onNavigate,
  onCreateCustomSubject,
  onDeleteCustomSubject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom Elective');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of publicContents) {
      const sub = item.subject || 'Other Subjects';
      map.set(sub, (map.get(sub) ?? 0) + 1);
    }
    return map;
  }, [publicContents]);

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [subjects, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      onNavigate('auth');
      return;
    }
    if (name.trim().length < 2) {
      setError('Subject name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      await onCreateCustomSubject({
        name: name.trim(),
        category: category.trim() || 'Custom Elective',
        description:
          description.trim() || `Community study materials and guides for ${name.trim()}.`,
      });
      setName('');
      setDescription('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create custom subject.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Academic Curriculum Directory
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Explore Subjects
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse all {subjects.length} subjects or add your own custom category to organize shared notes, slides, and problem sets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a subject..."
              className="rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                onNavigate('auth');
              } else {
                setShowAddForm((v) => !v);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Custom Subject
          </button>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Create Custom Subject Category
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Computer Networks"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Category Group
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Systems & Data"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of topics covered under this subject..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Subject'}
            </button>
          </div>
        </form>
      )}

      {/* Subjects Grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSubjects.map((sub) => {
          const count = countBySubject.get(sub.name) ?? 0;
          const canDelete = Boolean(
            !sub.isCore && user && (user.uid === sub.ownerId || user.role === 'admin'),
          );

          return (
            <div
              key={sub.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{sub.category || 'Subject'}</span>
                    {!sub.isCore && <span>· Custom</span>}
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void onDeleteCustomSubject(sub.id)}
                      aria-label={`Delete custom subject ${sub.name}`}
                      className="rounded p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <h2 className="font-display mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {sub.name}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {sub.description}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 dark:border-slate-800">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {count} {count === 1 ? 'material' : 'materials'}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectSubject(sub.name)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  Browse Materials
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
