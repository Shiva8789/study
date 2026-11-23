import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { triggerResourceDownload } from '../utils/firestoreFiles';
import type { AuthUser, PublicContentItem } from '../types';

interface StudyModeViewProps {
  user: AuthUser | null;
  materials: PublicContentItem[];
  openUploadTrigger: number;
  onNavigateAuth: () => void;
  onGoogleSignIn: () => Promise<void>;
  onResendVerification: () => Promise<void>;
  onReadMaterial: (item: PublicContentItem) => void;
  onAdminUploadMaterial: (
    file: File,
    meta: {
      title: string;
      subject: string;
      unit: string;
      description: string;
    },
  ) => Promise<void>;
  onAdminUpdateMaterial: (
    item: PublicContentItem,
    meta: {
      title: string;
      subject: string;
      unit: string;
      description: string;
    },
    replacementFile?: File | null,
  ) => Promise<void>;
  onAdminDeleteMaterial: (item: PublicContentItem) => Promise<void>;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

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

function isAllowedStudyFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const StudyModeView: React.FC<StudyModeViewProps> = ({
  user,
  materials,
  openUploadTrigger,
  onNavigateAuth,
  onGoogleSignIn,
  onResendVerification,
  onReadMaterial,
  onAdminUploadMaterial,
  onAdminUpdateMaterial,
  onAdminDeleteMaterial,
}) => {
  const isAdmin = user?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Upload / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PublicContentItem | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  const allLibraryItems = useMemo(
    () => materials.filter((m) => m.kind === 'file' || m.kind === 'note'),
    [materials],
  );

  const libraryCounts = useMemo(() => {
    const pdfs = allLibraryItems.filter(
      (m) => (m.fileType || '').toUpperCase() === 'PDF' || m.originalName.toLowerCase().endsWith('.pdf'),
    ).length;
    const docs = allLibraryItems.filter((m) => {
      const ft = (m.fileType || '').toUpperCase();
      const name = m.originalName.toLowerCase();
      return ft === 'DOC' || ft === 'DOCX' || name.endsWith('.doc') || name.endsWith('.docx');
    }).length;
    return {
      total: allLibraryItems.length,
      pdfs,
      docs,
    };
  }, [allLibraryItems]);

  const studyItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allLibraryItems.filter((m) => {
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q)
      );
    });
  }, [allLibraryItems, searchQuery]);

  const handleOpenUploadContent = () => {
    setEditingItem(null);
    setTitle('');
    setSubject('');
    setUnit('');
    setDescription('');
    setSelectedFile(null);
    setFormError(null);
    setModalOpen(true);
  };

  useEffect(() => {
    if (openUploadTrigger > 0) {
      setEditingItem(null);
      setTitle('');
      setSubject('');
      setUnit('');
      setDescription('');
      setSelectedFile(null);
      setFormError(null);
      setModalOpen(true);
    }
  }, [openUploadTrigger]);

  const openEditModal = (item: PublicContentItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setSubject(item.subject || '');
    setUnit(item.topic && item.topic !== 'General' ? item.topic : '');
    setDescription(item.description || '');
    setSelectedFile(null);
    setFormError(null);
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isAllowedStudyFile(file)) {
      setFormError('Only PDF, DOC, and DOCX files are allowed.');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }
    setFormError(null);
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.(pdf|docx?)$/i, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const cleanTitle = title.trim();
    const cleanSubject = subject.trim();
    if (!cleanTitle) {
      setFormError('Material Title is required.');
      return;
    }
    if (!cleanSubject) {
      setFormError('Subject is required.');
      return;
    }
    if (!editingItem && !selectedFile) {
      setFormError('Please select a PDF, DOC, or DOCX file to upload.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const meta = {
        title: cleanTitle,
        subject: cleanSubject,
        unit: unit.trim(),
        description: description.trim(),
      };
      if (editingItem) {
        await onAdminUpdateMaterial(editingItem, meta, selectedFile);
        setUploadNotice(`"${cleanTitle}" updated in Study Mode Library.`);
      } else if (selectedFile) {
        await onAdminUploadMaterial(selectedFile, meta);
        setUploadNotice(`"${cleanTitle}" uploaded to Study Mode Library.`);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save study material.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (item: PublicContentItem) => {
    setDownloadingId(item.id);
    try {
      await triggerResourceDownload(item);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (item: PublicContentItem) => {
    setDeletingId(item.id);
    try {
      await onAdminDeleteMaterial(item);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E293B]">
            Study Mode Library
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse, read online, and download public study materials for your subjects.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenUploadContent}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Content</span>
        </button>
      </div>

      {uploadNotice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-medium text-green-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            {uploadNotice}
          </span>
          <button
            type="button"
            onClick={() => setUploadNotice(null)}
            className="shrink-0 font-semibold text-green-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search study materials by title or subject..."
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2.5 pr-9 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Material Cards Grid */}
      {studyItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
            <BookOpen className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-[#1E293B]">
            {searchQuery
              ? 'No study materials match your search'
              : 'No study materials available yet'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery
              ? 'Try another title or subject keyword.'
              : 'Click Upload Content below to view available documents and upload PDF or Word files.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {studyItems.map((item) => {
            const unitLabel =
              item.topic && item.topic !== 'General' ? item.topic : '';
            const sizeLabel = formatFileSize(item.sizeBytes);
            const fileTypeLabel = (item.fileType || 'PDF').toUpperCase();

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs font-semibold tracking-wide text-[#7C3AED]">
                      {fileTypeLabel}
                      {sizeLabel ? ` · ${sizeLabel}` : ''}
                    </span>
                  </div>

                  <h2 className="font-display mt-4 line-clamp-2 text-base font-bold text-[#1E293B]">
                    {item.title}
                  </h2>

                  <p className="mt-1.5 text-xs font-medium text-slate-600">
                    <span>{item.subject || 'General'}</span>
                    {unitLabel && (
                      <>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-slate-500">Unit {unitLabel}</span>
                      </>
                    )}
                  </p>

                  {item.description && (
                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onReadMaterial(item)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA]"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Open / Read</span>
                    </button>

                    <button
                      type="button"
                      disabled={!item.filePath || downloadingId === item.id}
                      onClick={() => void handleDownload(item)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1E293B] transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{downloadingId === item.id ? 'Saving...' : 'Download'}</span>
                    </button>
                  </div>

                  {/* Admin-Only Management Controls */}
                  {isAdmin && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-[#4F46E5]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit / Replace</span>
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => void handleDelete(item)}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingId === item.id ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Upload Content Section (Directly below Study Mode Library) */}
      <section
        aria-label="Upload Content"
        className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5]/15 to-[#7C3AED]/15 text-[#4F46E5]">
              <Upload className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-[#1E293B]">
                Upload Content
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Upload PDF, DOC, or DOCX study materials for any subject to display them in Study
                Mode Library.{' '}
                <span className="tabular-nums font-medium text-[#4F46E5]">
                  ({libraryCounts.pdfs} PDFs · {libraryCounts.docs} Docs available)
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenUploadContent}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Content</span>
          </button>
        </div>
      </section>

      {/* Upload Content / Edit / Library Status Modal (Always opens when Upload Content is clicked) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#1E293B]">
                  {editingItem ? 'Edit Study Content' : 'Upload Content'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Study Mode Library · PDF, DOC, and DOCX manager
                </p>
              </div>
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

            {/* Available PDFs & Documents Overview */}
            {!editingItem && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/70">
                    <p className="tabular-nums text-lg font-bold text-[#1E293B]">
                      {libraryCounts.total}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">Total Materials</p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/70">
                    <p className="tabular-nums text-lg font-bold text-[#4F46E5]">
                      {libraryCounts.pdfs}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">PDFs Available</p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/70">
                    <p className="tabular-nums text-lg font-bold text-[#7C3AED]">
                      {libraryCounts.docs}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">DOC / DOCX</p>
                  </div>
                </div>

                {allLibraryItems.length > 0 && (
                  <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-slate-200/80 bg-white divide-y divide-slate-100">
                    {allLibraryItems.map((docItem) => (
                      <div
                        key={docItem.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#1E293B]">{docItem.title}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {docItem.subject} · {docItem.fileType}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setModalOpen(false);
                            onReadMaterial(docItem);
                          }}
                          className="shrink-0 font-semibold text-[#4F46E5] hover:underline"
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin Upload / Edit Form OR Clear Auth Prompt */}
            {!user ? (
              <div className="mt-5 rounded-xl border border-[#4F46E5]/25 bg-[#4F46E5]/5 p-5 text-center">
                <ShieldCheck className="mx-auto h-7 w-7 text-[#4F46E5]" />
                <h3 className="mt-2.5 text-sm font-bold text-[#1E293B]">
                  Sign in as Administrator to Upload Content
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Any visitor can read and download the{' '}
                  <span className="tabular-nums font-semibold">{libraryCounts.pdfs}</span> available
                  PDFs above. Sign in with your administrator Google account to upload new PDF or
                  Word documents.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      setAuthBusy(true);
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem('studora_post_login_section', 'study');
                      }
                      void onGoogleSignIn()
                        .catch(() => undefined)
                        .finally(() => setAuthBusy(false));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#4338CA] disabled:opacity-60"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{authBusy ? 'Signing In...' : 'Continue with Google'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      onNavigateAuth();
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-50"
                  >
                    More Sign-In Options
                  </button>
                </div>
              </div>
            ) : !isAdmin ? (
              <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-5 text-center">
                <ShieldCheck className="mx-auto h-7 w-7 text-orange-600" />
                <h3 className="mt-2.5 text-sm font-bold text-[#1E293B]">
                  Administrator Access Required
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {!user.emailVerified
                    ? `Signed in as ${user.email || user.displayName}, but your email is not verified yet. Continue with Google to verify instantly or click the verification link in your inbox.`
                    : `Signed in as ${user.email || user.displayName} (Student). Only the administrator account can upload, edit, or delete Study Mode documents.`}
                </p>
                {verifySent && (
                  <p className="mt-2 text-xs font-semibold text-green-700">
                    Verification email sent! Check your inbox and refresh after clicking the link.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      setAuthBusy(true);
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem('studora_post_login_section', 'study');
                      }
                      void onGoogleSignIn()
                        .catch(() => undefined)
                        .finally(() => setAuthBusy(false));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{authBusy ? 'Signing In...' : 'Sign In with Google'}</span>
                  </button>
                  {!user.emailVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        void onResendVerification().then(() => setVerifySent(true));
                      }}
                      className="rounded-xl border border-orange-300 bg-white px-4 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
                    >
                      Resend Verification Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                    Material Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Operating Systems Scheduling Notes"
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="studora-study-subjects"
                      maxLength={80}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter any subject"
                      className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                    />
                    <datalist id="studora-study-subjects">
                      {SUBJECT_SUGGESTIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                      Unit <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g., Unit 2"
                      className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                    Description <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary of chapters or exam topics covered..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#1E293B] focus:border-[#4F46E5] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1E293B]">
                    {editingItem ? 'Replace File (optional)' : 'Select PDF or Document'}{' '}
                    {!editingItem && <span className="text-red-500">*</span>}
                  </label>
                  {editingItem && !selectedFile && (
                    <p className="mb-2 text-xs text-slate-500">
                      Current file:{' '}
                      <span className="font-medium text-[#1E293B]">{editingItem.originalName}</span>
                    </p>
                  )}
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[#F8FAFC] px-4 py-5 text-center transition-colors hover:border-[#4F46E5] hover:bg-[#4F46E5]/5">
                    <Upload className="h-5 w-5 text-[#4F46E5]" />
                    <span className="mt-2 text-xs font-semibold text-[#1E293B]">
                      {selectedFile
                        ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                        : 'Choose PDF, DOC, or DOCX file'}
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-500">
                      Supported formats: .pdf, .doc, .docx
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
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
                    <span>{editingItem ? 'Save Changes' : 'Upload to Library'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
