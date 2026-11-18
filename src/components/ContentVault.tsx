import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  LogIn,
  Music,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AuthUser, Course, PublicContentItem } from '../types';

interface ContentVaultProps {
  user: AuthUser | null;
  courses: Course[];
  publicContents: PublicContentItem[];
  showUploadPanel: boolean;
  onSetShowUploadPanel: (open: boolean) => void;
  onSignIn: () => Promise<void>;
  onUploadFiles: (
    files: FileList,
    meta: { courseCode: string; title: string; description: string },
  ) => Promise<void>;
  onCreateNoteOrLink: (payload: {
    kind: 'note' | 'link';
    title: string;
    description: string;
    courseCode: string;
    contentText?: string;
    url?: string;
  }) => Promise<void>;
  onDeleteContent: (item: PublicContentItem) => Promise<void>;
}

type VaultCategory = 'all' | 'documents' | 'images' | 'media' | 'notes';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function classifyUpload(item: PublicContentItem): Exclude<VaultCategory, 'all'> {
  if (item.kind === 'note' || item.kind === 'link') return 'notes';
  if (item.kind === 'portrait' || item.mimeType.startsWith('image/')) return 'images';
  if (item.mimeType.startsWith('audio/') || item.mimeType.startsWith('video/')) return 'media';
  return 'documents';
}

export const ContentVault: React.FC<ContentVaultProps> = ({
  user,
  courses,
  publicContents,
  showUploadPanel,
  onSetShowUploadPanel,
  onSignIn,
  onUploadFiles,
  onCreateNoteOrLink,
  onDeleteContent,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState<VaultCategory>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Composer mode
  const [uploadMode, setUploadMode] = useState<'files' | 'note' | 'link'>('files');
  const [courseCode, setCourseCode] = useState(courses[0]?.code ?? 'GENERAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [noteText, setNoteText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview modal
  const [previewItem, setPreviewItem] = useState<PublicContentItem | null>(null);

  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) set.add(c.code);
    for (const item of publicContents) set.add(item.courseCode);
    return Array.from(set).sort();
  }, [courses, publicContents]);

  const filteredContents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publicContents.filter((u) => {
      if (category !== 'all' && classifyUpload(u) !== category) return false;
      if (courseFilter !== 'all' && u.courseCode !== courseFilter) return false;
      if (q) {
        const hay = `${u.title} ${u.description} ${u.originalName} ${u.courseCode} ${u.authorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [publicContents, category, courseFilter, searchQuery]);

  const totalSize = useMemo(
    () => publicContents.reduce((acc, u) => acc + (u.sizeBytes || 0), 0),
    [publicContents],
  );

  const buildFileUrl = (item: PublicContentItem, download = false) => {
    if (!item.filePath) return '';
    const sep = item.filePath.includes('?') ? '&' : '?';
    return `${item.filePath}${sep}${download ? 'download=1&' : ''}name=${encodeURIComponent(
      item.originalName,
    )}&mime=${encodeURIComponent(item.mimeType)}`;
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onUploadFiles(files, {
        courseCode: courseCode.trim() || 'GENERAL',
        title: title.trim(),
        description: description.trim(),
      });
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteOrLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title.');
      return;
    }
    if (uploadMode === 'link' && !linkUrl.trim()) {
      setError('Please enter a valid URL.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreateNoteOrLink({
        kind: uploadMode === 'link' ? 'link' : 'note',
        title: title.trim(),
        description: description.trim(),
        courseCode: courseCode.trim() || 'GENERAL',
        contentText: uploadMode === 'note' ? noteText : undefined,
        url: uploadMode === 'link' ? linkUrl.trim() : undefined,
      });
      setTitle('');
      setDescription('');
      setNoteText('');
      setLinkUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Open Study Hub · <span className="font-mono tabular-nums">{publicContents.length}</span>{' '}
            public items · <span className="font-mono tabular-nums">{formatBytes(totalSize)}</span>
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Public Content Hub
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Any visitor can browse, preview, and download uploaded study files, notes, links, and Time-Travel portraits. Sign in to publish your own materials and manage your uploads.
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={() => onSetShowUploadPanel(!showUploadPanel)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4" />
            {showUploadPanel ? 'Hide Uploader' : 'Publish Content'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <LogIn className="h-4 w-4" />
            Sign In to Upload
          </button>
        )}
      </div>

      {/* Upload Dropzone & Note/Link Composer (Signed-In Creators) */}
      {user && showUploadPanel && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setUploadMode('files')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  uploadMode === 'files'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upload Any Files
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('note')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  uploadMode === 'note'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Publish Study Note
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('link')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  uploadMode === 'link'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Share Web Link
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Course Code:</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                list="course-code-options"
                placeholder="e.g. CS 301"
                className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
              />
              <datalist id="course-code-options">
                {courses.map((c) => (
                  <option key={c.id} value={c.code} />
                ))}
                <option value="GENERAL" />
              </datalist>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                {uploadMode === 'files' ? 'Optional Custom Title' : 'Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  uploadMode === 'files'
                    ? 'Leave blank to use original filename'
                    : 'e.g. Midterm Review Synthesis'
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Description or Context
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Week, lecture topic, or chapter notes..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          {uploadMode === 'files' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFilesSelected(e.dataTransfer.files);
              }}
              className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragging
                  ? 'border-blue-700 bg-blue-50/50'
                  : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
              }`}
            >
              <Upload className="h-7 w-7 text-slate-500" />
              <p className="font-display mt-3 text-base font-semibold text-slate-900">
                {submitting
                  ? 'Publishing files to Public Content Hub...'
                  : 'Drag and drop any files here, or browse from your device'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDFs, slides, DOCX, images, audio, video, CSV, ZIP, or code — up to 50 MB per file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                Select Files
              </button>
            </div>
          ) : uploadMode === 'note' ? (
            <form onSubmit={handleNoteOrLinkSubmit} className="mt-4">
              <label className="block text-xs font-medium text-slate-600">
                Markdown / Plain Text Study Note
              </label>
              <textarea
                rows={5}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write lecture takeaways, formulas, outline, or citations..."
                className="font-mono mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting ? 'Publishing...' : 'Publish Note'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleNoteOrLinkSubmit} className="mt-4">
              <label className="block text-xs font-medium text-slate-600">
                Resource URL
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting ? 'Publishing...' : 'Publish Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="mt-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            {(
              [
                { id: 'all', label: 'All Content' },
                { id: 'documents', label: 'Documents' },
                { id: 'images', label: 'Images & Portraits' },
                { id: 'media', label: 'Audio & Video' },
                { id: 'notes', label: 'Notes & Links' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  category === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter uploads by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Courses</option>
            {uniqueCourses.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files, notes, or authors..."
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
          />
        </div>
      </div>

      {/* Public Content Grid */}
      {filteredContents.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="font-display mt-3 text-lg font-semibold text-slate-900">
            No matching public content
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {user
              ? 'Upload files, publish study notes, or save a Time-Travel portrait above.'
              : 'Sign in with Google to publish the first study resource for visitors.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredContents.map((item) => {
            const isImage =
              (item.kind === 'portrait' || item.mimeType.startsWith('image/')) &&
              Boolean(item.filePath);
            const isAudio = item.mimeType.startsWith('audio/');
            const isVideo = item.mimeType.startsWith('video/');
            const canDelete = Boolean(user && user.uid === item.ownerId);

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div>
                  {isImage && item.filePath ? (
                    <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-100">
                      <img
                        src={buildFileUrl(item)}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                      {item.kind === 'link' ? (
                        <Link2 className="h-5 w-5 text-blue-700" />
                      ) : isAudio ? (
                        <Music className="h-5 w-5 text-slate-700" />
                      ) : isVideo ? (
                        <Film className="h-5 w-5 text-slate-700" />
                      ) : (
                        <FileText className="h-5 w-5 text-slate-700" />
                      )}
                      <span className="font-mono text-xs text-slate-500 truncate">
                        {item.mimeType}
                      </span>
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
                      <span className="font-mono tabular-nums">
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>

                    <h2 className="font-display mt-2 text-lg font-semibold leading-snug text-slate-900">
                      {item.title}
                    </h2>

                    {item.description && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                        {item.description}
                      </p>
                    )}

                    {item.kind === 'note' && item.contentText && (
                      <pre className="font-mono mt-3 max-h-24 overflow-hidden rounded-lg bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
                        {item.contentText}
                      </pre>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                  <div className="flex items-center gap-2">
                    {item.kind === 'link' && item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Link
                      </a>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        {item.filePath && (
                          <a
                            href={buildFileUrl(item, true)}
                            download={item.originalName}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        )}
                      </>
                    )}
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void onDeleteContent(item)}
                      aria-label={`Delete ${item.title}`}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-500">
                  {previewItem.originalName} · {formatBytes(previewItem.sizeBytes)} · Shared by{' '}
                  {previewItem.authorName}
                </p>
                <h2 className="font-display truncate text-lg font-semibold text-slate-900">
                  {previewItem.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewItem.filePath && (
                  <a
                    href={buildFileUrl(previewItem, true)}
                    download={previewItem.originalName}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  aria-label="Close preview"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              {previewItem.kind === 'note' ? (
                <pre className="font-mono rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {previewItem.contentText}
                </pre>
              ) : (previewItem.kind === 'portrait' ||
                  previewItem.mimeType.startsWith('image/')) &&
                previewItem.filePath ? (
                <div className="flex justify-center">
                  <img
                    src={buildFileUrl(previewItem)}
                    alt={previewItem.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[65vh] rounded-lg border border-slate-200 object-contain"
                  />
                </div>
              ) : previewItem.mimeType === 'application/pdf' && previewItem.filePath ? (
                <iframe
                  title={previewItem.title}
                  src={buildFileUrl(previewItem)}
                  className="h-[65vh] w-full rounded-lg border border-slate-200 bg-white"
                />
              ) : previewItem.mimeType.startsWith('audio/') && previewItem.filePath ? (
                <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                  <Music className="mx-auto h-10 w-10 text-slate-400" />
                  <audio
                    controls
                    src={buildFileUrl(previewItem)}
                    className="mt-4 w-full"
                  />
                </div>
              ) : previewItem.mimeType.startsWith('video/') && previewItem.filePath ? (
                <video
                  controls
                  src={buildFileUrl(previewItem)}
                  className="mx-auto max-h-[65vh] w-full rounded-lg border border-slate-200 bg-black"
                />
              ) : previewItem.mimeType.startsWith('text/') && previewItem.filePath ? (
                <iframe
                  title={previewItem.title}
                  src={buildFileUrl(previewItem)}
                  className="h-[60vh] w-full rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    File ready for download
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Click Download above to open this file locally.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
