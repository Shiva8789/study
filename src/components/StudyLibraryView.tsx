import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FolderUp,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { FILE_TYPES, SEMESTERS } from '../data/subjects';
import type { ActiveSection, AuthUser, PublicContentItem, SubjectItem } from '../types';

interface StudyLibraryViewProps {
  mode: 'public' | 'mine';
  user: AuthUser | null;
  publicContents: PublicContentItem[];
  subjects: SubjectItem[];
  initialSubjectFilter?: string;
  initialSelectedResource?: PublicContentItem | null;
  onClearInitialSelected?: () => void;
  onNavigate: (section: ActiveSection) => void;
  onUpdateResource: (
    id: string,
    patch: {
      title: string;
      description: string;
      subject: string;
      courseBranch: string;
      semester: string;
      topic: string;
      contentText?: string;
    },
  ) => Promise<void>;
  onDeleteResource: (item: PublicContentItem) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Text';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const StudyLibraryView: React.FC<StudyLibraryViewProps> = ({
  mode,
  user,
  publicContents,
  subjects,
  initialSubjectFilter = 'all',
  initialSelectedResource = null,
  onClearInitialSelected,
  onNavigate,
  onUpdateResource,
  onDeleteResource,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(initialSubjectFilter || 'all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');

  const [previewItem, setPreviewItem] = useState<PublicContentItem | null>(initialSelectedResource);
  const [editingItem, setEditingItem] = useState<PublicContentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editContentText, setEditContentText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setSubjectFilter(initialSubjectFilter || 'all');
  }, [initialSubjectFilter]);

  useEffect(() => {
    if (initialSelectedResource) {
      setPreviewItem(initialSelectedResource);
      onClearInitialSelected?.();
    }
  }, [initialSelectedResource, onClearInitialSelected]);

  const baseItems = useMemo(() => {
    if (mode === 'mine') {
      if (!user) return [];
      return publicContents.filter((item) => item.ownerId === user.uid);
    }
    return publicContents;
  }, [mode, user, publicContents]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseItems.filter((item) => {
      const itemSubject = item.subject || 'Other Subjects';
      const itemSemester = item.semester || 'General';
      const itemType = (item.fileType || (item.kind === 'note' ? 'NOTE' : 'OTHER')).toUpperCase();

      if (subjectFilter !== 'all' && itemSubject !== subjectFilter) return false;
      if (semesterFilter !== 'all' && itemSemester !== semesterFilter) return false;
      if (fileTypeFilter !== 'all' && itemType !== fileTypeFilter) return false;

      if (q) {
        const hay = `${item.title} ${item.description} ${itemSubject} ${item.courseBranch} ${item.topic} ${item.authorName} ${item.originalName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseItems, searchQuery, subjectFilter, semesterFilter, fileTypeFilter]);

  const totalMineBytes = useMemo(
    () => baseItems.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    [baseItems],
  );

  const openEditModal = (item: PublicContentItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditSubject(item.subject || subjects[0]?.name || 'Other Subjects');
    setEditBranch(item.courseBranch || item.courseCode || 'General');
    setEditSemester(item.semester || 'General');
    setEditTopic(item.topic || 'General');
    setEditContentText(item.contentText || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await onUpdateResource(editingItem.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        subject: editSubject,
        courseBranch: editBranch.trim() || 'General',
        semester: editSemester,
        topic: editTopic.trim() || 'General',
        contentText: editingItem.kind === 'note' ? editContentText : undefined,
      });
      setEditingItem(null);
    } finally {
      setSavingEdit(false);
    }
  };

  if (mode === 'mine' && !user) {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <FolderUp className="mx-auto h-10 w-10 text-blue-700 dark:text-blue-400" />
          <h1 className="font-display mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            My Uploaded Materials
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Sign in to view, edit, or manage the notes, slides, and PDFs you have shared with the STUDORA community.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('auth')}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Login / Register
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            {mode === 'mine' ? 'Personal Contributions' : 'Open Educational Repository'}
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {mode === 'mine' ? 'My Uploads' : 'Public Study Material Library'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {mode === 'mine'
              ? `You have published ${baseItems.length} resources (${formatBytes(totalMineBytes)} stored). Edit metadata or remove files anytime.`
              : 'Browse, search, preview, and download shared lecture notes, PDFs, presentations, and guides—no account required to access.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate(user ? 'upload' : 'auth')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 shrink-0 whitespace-nowrap"
        >
          <UploadCloud className="h-4 w-4" />
          Upload Study Material
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, topic, branch, or author..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <select
          aria-label="Filter by subject"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 md:col-span-3"
        >
          <option value="all">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={sub.name}>
              {sub.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by semester"
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 md:col-span-2"
        >
          <option value="all">All Semesters</option>
          {SEMESTERS.map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by file type"
          value={fileTypeFilter}
          onChange={(e) => setFileTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 md:col-span-2"
        >
          <option value="all">All File Types</option>
          {FILE_TYPES.map((ft) => (
            <option key={ft} value={ft}>
              {ft}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono tabular-nums">
          Showing {filteredItems.length} of {baseItems.length} resources
        </span>
        {(subjectFilter !== 'all' || semesterFilter !== 'all' || fileTypeFilter !== 'all' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSubjectFilter('all');
              setSemesterFilter('all');
              setFileTypeFilter('all');
              setSearchQuery('');
            }}
            className="font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Results Grid */}
      {filteredItems.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <FileText className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="font-display mt-3 text-lg font-semibold text-slate-900 dark:text-white">
            {baseItems.length === 0 ? 'No study materials uploaded yet' : 'No matching materials found'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
            {baseItems.length === 0
              ? 'Upload PDFs, DOCX guides, PPTX decks, images, or written notes to populate the library.'
              : 'Try adjusting your subject, semester, file type, or search keywords.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate(user ? 'upload' : 'auth')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Share First Resource
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isOwnerOrAdmin = Boolean(
              user && (user.uid === item.ownerId || user.role === 'admin'),
            );
            const fileTypeLabel = (item.fileType || (item.kind === 'note' ? 'NOTE' : 'OTHER')).toUpperCase();
            const downloadHref = item.filePath
              ? `${item.filePath}?download=1&name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`
              : undefined;
            const previewHref = item.filePath
              ? `${item.filePath}?name=${encodeURIComponent(item.originalName)}&mime=${encodeURIComponent(item.mimeType)}`
              : undefined;
            const isImage = item.mimeType.startsWith('image/') && Boolean(previewHref);

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div>
                  {isImage && previewHref && (
                    <div className="aspect-[16/9] w-full overflow-hidden rounded-t-xl border-b border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                      <img
                        src={previewHref}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-5">
                    <p className="font-mono text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      {fileTypeLabel} · {item.subject || 'Other Subjects'} · {item.semester || 'General'}
                    </p>
                    <h2 className="font-display mt-1.5 line-clamp-1 text-base font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h2>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {item.description || 'Shared educational material.'}
                    </p>

                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
                      <div>
                        <dt className="text-slate-400 dark:text-slate-500">Topic</dt>
                        <dd className="truncate font-medium text-slate-700 dark:text-slate-300">
                          {item.topic || 'General'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400 dark:text-slate-500">Course / Branch</dt>
                        <dd className="truncate font-medium text-slate-700 dark:text-slate-300">
                          {item.courseBranch || item.courseCode || 'General'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400 dark:text-slate-500">Uploaded By</dt>
                        <dd className="truncate font-medium text-slate-700 dark:text-slate-300">
                          {item.authorName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400 dark:text-slate-500">Date &amp; Size</dt>
                        <dd className="font-mono truncate text-slate-700 dark:text-slate-300 tabular-nums">
                          {formatDate(item.createdAt)} · {formatBytes(item.sizeBytes)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>

                    {downloadHref && (
                      <a
                        href={downloadHref}
                        download={item.originalName}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    )}

                    {item.kind === 'link' && item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Link
                      </a>
                    )}
                  </div>

                  {isOwnerOrAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        aria-label={`Edit ${item.title}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteResource(item)}
                        aria-label={`Delete ${item.title}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resource Details & Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <p className="font-mono text-xs text-blue-700 dark:text-blue-400">
                  {(previewItem.fileType || previewItem.kind).toUpperCase()} · {previewItem.subject || 'Other Subjects'} · {previewItem.semester || 'General'}
                </p>
                <h2 className="font-display mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {previewItem.title}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Uploaded by {previewItem.authorName} · {previewItem.courseBranch || previewItem.courseCode} · Topic: {previewItem.topic || 'General'} · {formatDate(previewItem.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="Close preview"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {previewItem.description && (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {previewItem.description}
                </p>
              )}

              {previewItem.kind === 'note' && previewItem.contentText && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {previewItem.contentText}
                  </pre>
                </div>
              )}

              {previewItem.filePath && previewItem.mimeType.startsWith('image/') && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                  <img
                    src={`${previewItem.filePath}?name=${encodeURIComponent(previewItem.originalName)}&mime=${encodeURIComponent(previewItem.mimeType)}`}
                    alt={previewItem.title}
                    referrerPolicy="no-referrer"
                    className="mx-auto max-h-[460px] object-contain"
                  />
                </div>
              )}

              {previewItem.filePath && previewItem.mimeType === 'application/pdf' && (
                <iframe
                  title={previewItem.title}
                  src={`${previewItem.filePath}?name=${encodeURIComponent(previewItem.originalName)}&mime=${encodeURIComponent(previewItem.mimeType)}`}
                  className="h-[480px] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
                />
              )}

              {previewItem.filePath && previewItem.mimeType.startsWith('video/') && (
                <video
                  controls
                  src={`${previewItem.filePath}?name=${encodeURIComponent(previewItem.originalName)}&mime=${encodeURIComponent(previewItem.mimeType)}`}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
                />
              )}

              {previewItem.filePath && previewItem.mimeType.startsWith('audio/') && (
                <audio
                  controls
                  src={`${previewItem.filePath}?name=${encodeURIComponent(previewItem.originalName)}&mime=${encodeURIComponent(previewItem.mimeType)}`}
                  className="w-full"
                />
              )}

              {previewItem.filePath &&
                !previewItem.mimeType.startsWith('image/') &&
                previewItem.mimeType !== 'application/pdf' &&
                !previewItem.mimeType.startsWith('video/') &&
                !previewItem.mimeType.startsWith('audio/') && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-950">
                    <FileText className="mx-auto h-8 w-8 text-blue-700 dark:text-blue-400" />
                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                      {previewItem.originalName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {previewItem.mimeType} · {formatBytes(previewItem.sizeBytes)}
                    </p>
                  </div>
                )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  File: {previewItem.originalName} ({formatBytes(previewItem.sizeBytes)})
                </span>
                <div className="flex items-center gap-3">
                  {previewItem.filePath && (
                    <a
                      href={`${previewItem.filePath}?download=1&name=${encodeURIComponent(previewItem.originalName)}&mime=${encodeURIComponent(previewItem.mimeType)}`}
                      download={previewItem.originalName}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download File
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewItem(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Resource Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Edit Study Material Details
              </h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveEdit(e)} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Subject
                  </label>
                  <select
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.name}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Semester
                  </label>
                  <select
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Course / Branch
                  </label>
                  <input
                    type="text"
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              {editingItem.kind === 'note' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Note Content
                  </label>
                  <textarea
                    rows={5}
                    value={editContentText}
                    onChange={(e) => setEditContentText(e.target.value)}
                    className="font-mono mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
