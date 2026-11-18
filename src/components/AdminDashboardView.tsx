import React, { useMemo, useState } from 'react';
import { Download, Search, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import type { AuthUser, PublicContentItem, SubjectItem } from '../types';

export interface DirectoryProfile {
  uid: string;
  displayName: string;
  branch: string;
  semester: string;
  role: 'student' | 'admin';
  createdAt: string;
}

interface AdminDashboardViewProps {
  user: AuthUser | null;
  publicContents: PublicContentItem[];
  subjects: SubjectItem[];
  directoryProfiles: DirectoryProfile[];
  onDeleteContent: (item: PublicContentItem) => Promise<void>;
  onDeleteCustomSubject: (id: string) => Promise<void>;
}

function formatStorageMb(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  publicContents,
  subjects,
  directoryProfiles,
  onDeleteContent,
  onDeleteCustomSubject,
}) => {
  const [contentQuery, setContentQuery] = useState('');

  const totalStorageBytes = useMemo(
    () => publicContents.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    [publicContents],
  );

  const customSubjects = useMemo(
    () => subjects.filter((s) => !s.isCore),
    [subjects],
  );

  const subjectBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of publicContents) {
      const sub = item.subject || 'Other Subjects';
      counts.set(sub, (counts.get(sub) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map((e) => e[1]));
    return entries.map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / max) * 100),
    }));
  }, [publicContents]);

  const filteredContents = useMemo(() => {
    const q = contentQuery.trim().toLowerCase();
    if (!q) return publicContents;
    return publicContents.filter((c) =>
      `${c.title} ${c.authorName} ${c.subject} ${c.fileType}`.toLowerCase().includes(q),
    );
  }, [publicContents, contentQuery]);

  if (!user || user.role !== 'admin') {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-400" />
          <h1 className="font-display mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            Administrator Access Required
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            This moderation console is restricted to verified platform administrators.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Platform Governance &amp; Moderation</span>
        </div>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Monitor shared public study materials, storage footprint, registered student profiles, and custom subject categories.
        </p>
      </div>

      {/* Platform KPI Strip */}
      <div className="mt-6 grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Public Materials</p>
          <p className="font-mono mt-1 text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {publicContents.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Registered Profiles</p>
          <p className="font-mono mt-1 text-3xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
            {directoryProfiles.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Subjects</p>
          <p className="font-mono mt-1 text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {subjects.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Uploaded Storage</p>
          <p className="font-mono mt-1 text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatStorageMb(totalStorageBytes)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Subject Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Resources by Subject
          </h2>
          {subjectBreakdown.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No public materials uploaded yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {subjectBreakdown.map((entry) => (
                <div key={entry.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {entry.name}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {entry.count}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${entry.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {customSubjects.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Custom Subject Categories ({customSubjects.length})
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {customSubjects.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between py-2 text-xs">
                    <span className="text-slate-800 dark:text-slate-200">
                      {sub.name} · <span className="text-slate-500">{sub.category}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void onDeleteCustomSubject(sub.id)}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Remove custom subject ${sub.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Registered Users Directory */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            User Directory ({directoryProfiles.length})
          </h2>
          {directoryProfiles.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No registered user profiles indexed yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium">Role</th>
                    <th className="py-2 px-3 font-medium">Branch</th>
                    <th className="py-2 px-3 font-medium">Semester</th>
                    <th className="py-2 pl-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {directoryProfiles.map((prof) => (
                    <tr key={prof.uid}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white">
                        {prof.displayName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-700 dark:text-blue-400">
                        {prof.role}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {prof.branch || 'General'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {prof.semester || 'General'}
                      </td>
                      <td className="py-2.5 pl-3 font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {prof.createdAt.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Content Moderation Table */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Public Study Material Moderation ({filteredContents.length})
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={contentQuery}
              onChange={(e) => setContentQuery(e.target.value)}
              placeholder="Filter uploads..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 px-3 font-medium">Subject</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium">Uploader</th>
                <th className="py-2 px-3 font-medium">Size</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredContents.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white">
                    {item.title}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {item.subject || 'Other Subjects'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-blue-700 dark:text-blue-400">
                    {(item.fileType || item.kind).toUpperCase()}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {item.authorName}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatStorageMb(item.sizeBytes)}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {item.filePath && (
                        <a
                          href={`${item.filePath}?download=1&name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`}
                          download={item.originalName}
                          className="rounded p-1 text-blue-700 hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800"
                          aria-label={`Download ${item.title}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => void onDeleteContent(item)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
