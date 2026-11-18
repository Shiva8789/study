import React, { useState } from 'react';
import { CheckCircle2, FileText, LogIn, Plus, UploadCloud } from 'lucide-react';
import { SEMESTERS } from '../data/subjects';
import type { ActiveSection, AuthUser, SubjectItem } from '../types';

interface UploadMaterialViewProps {
  user: AuthUser | null;
  subjects: SubjectItem[];
  onNavigate: (section: ActiveSection) => void;
  onCreateCustomSubject: (payload: {
    name: string;
    category: string;
    description: string;
  }) => Promise<void>;
  onUploadStudyFiles: (
    files: FileList,
    meta: {
      title: string;
      description: string;
      subject: string;
      courseBranch: string;
      semester: string;
      topic: string;
    },
  ) => Promise<void>;
  onPublishStudyNote: (payload: {
    title: string;
    description: string;
    subject: string;
    courseBranch: string;
    semester: string;
    topic: string;
    contentText: string;
  }) => Promise<void>;
}

const MAX_BYTES = 50 * 1024 * 1024;

export const UploadMaterialView: React.FC<UploadMaterialViewProps> = ({
  user,
  subjects,
  onNavigate,
  onCreateCustomSubject,
  onUploadStudyFiles,
  onPublishStudyNote,
}) => {
  const [uploadKind, setUploadKind] = useState<'file' | 'note'>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState(subjects[0]?.name || 'Computer Science');
  const [courseBranch, setCourseBranch] = useState(user?.branch || 'B.Tech CSE');
  const [semester, setSemester] = useState<string>(user?.semester || SEMESTERS[0]);
  const [topic, setTopic] = useState('');
  const [noteText, setNoteText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const [showCustomSubject, setShowCustomSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [customSubjectCategory, setCustomSubjectCategory] = useState('Custom Subject');
  const [addingSubject, setAddingSubject] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <section className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <UploadCloud className="mx-auto h-10 w-10 text-blue-700 dark:text-blue-400" />
          <h1 className="font-display mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            Sign In to Upload Study Materials
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            Visitors can freely browse and download materials in the Public Study Library, while authenticated students and educators can upload PDFs, DOCX guides, slides, and notes.
          </p>
          <div className="mt-6 flex justify-center gap-3">
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
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Browse Study Library
            </button>
          </div>
        </div>
      </section>
    );
  }

  const handleAddCustomSubject = async () => {
    const trimmed = customSubjectName.trim();
    if (trimmed.length < 2) {
      setError('Subject name must be at least 2 characters.');
      return;
    }
    setAddingSubject(true);
    setError(null);
    try {
      await onCreateCustomSubject({
        name: trimmed,
        category: customSubjectCategory.trim() || 'Custom Subject',
        description: `Student-added study category for ${trimmed}.`,
      });
      setSubject(trimmed);
      setCustomSubjectName('');
      setShowCustomSubject(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add custom subject.');
    } finally {
      setAddingSubject(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setError('Please provide a clear title for your study material.');
      return;
    }

    if (uploadKind === 'file') {
      if (!selectedFiles || selectedFiles.length === 0) {
        setError('Please select at least one file (PDF, DOCX, PPT/PPTX, image, or assignment).');
        return;
      }
      for (let i = 0; i < selectedFiles.length; i++) {
        if (selectedFiles[i].size > MAX_BYTES) {
          setError(`"${selectedFiles[i].name}" exceeds the 50 MB file size limit.`);
          return;
        }
      }
    } else if (!noteText.trim()) {
      setError('Please write your educational note content before publishing.');
      return;
    }

    setSubmitting(true);
    try {
      if (uploadKind === 'file' && selectedFiles) {
        await onUploadStudyFiles(selectedFiles, {
          title: title.trim(),
          description: description.trim(),
          subject,
          courseBranch: courseBranch.trim() || 'General',
          semester,
          topic: topic.trim() || 'General',
        });
        setSuccessMsg('Study file uploaded and published to the Public Study Library.');
        setSelectedFiles(null);
      } else {
        await onPublishStudyNote({
          title: title.trim(),
          description: description.trim(),
          subject,
          courseBranch: courseBranch.trim() || 'General',
          semester,
          topic: topic.trim() || 'General',
          contentText: noteText.trim(),
        });
        setSuccessMsg('Educational note published to the Public Study Library.');
        setNoteText('');
      }
      setTitle('');
      setDescription('');
      setTopic('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Check your file format and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-6 py-8">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
          Public Study Sharing
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Upload Study Material
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Share PDFs, DOCX handouts, PPT/PPTX lecture slides, images, assignments, or written educational notes with fellow learners.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {/* Upload Mode Switch */}
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setUploadKind('file')}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-colors ${
              uploadKind === 'file'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Upload File (PDF, DOCX, PPTX, Image)
          </button>
          <button
            type="button"
            onClick={() => setUploadKind('note')}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-colors ${
              uploadKind === 'note'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" />
            Write Educational Note
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {successMsg && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {successMsg}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('library')}
                className="font-semibold underline"
              >
                View in Library
              </button>
              <button
                type="button"
                onClick={() => onNavigate('my-uploads')}
                className="font-semibold underline"
              >
                My Uploads
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Material Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete B-Tree & Indexing Lecture Notes"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Subject *
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomSubject((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Plus className="h-3 w-3" />
                  Add custom subject
                </button>
              </div>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                Semester *
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showCustomSubject && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Create New Subject Category
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  placeholder="Subject name (e.g. Cloud Computing)"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={customSubjectCategory}
                  onChange={(e) => setCustomSubjectCategory(e.target.value)}
                  placeholder="Category (e.g. Electives)"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={addingSubject}
                  onClick={() => void handleAddCustomSubject()}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                  {addingSubject ? 'Adding...' : 'Save Subject'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Course / Branch
              </label>
              <input
                type="text"
                value={courseBranch}
                onChange={(e) => setCourseBranch(e.target.value)}
                placeholder="e.g. B.Tech CSE · CS 302"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Query Optimization & Normalization"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize what this document or note covers for students..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {uploadKind === 'file' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Select Study Files (PDF, DOCX, PPT/PPTX, Images, Assignments · max 50 MB each)
              </label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500">
                <UploadCloud className="h-8 w-8 text-blue-700 dark:text-blue-400" />
                <span className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                  {selectedFiles && selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : 'Click to choose files from your computer'}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selectedFiles && selectedFiles.length > 0
                    ? Array.from(selectedFiles)
                        .map((f) => f.name)
                        .join(', ')
                    : 'Supports .pdf, .doc, .docx, .ppt, .pptx, .png, .jpg, .md, .txt, .zip'}
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.mp4,.zip,.py,.java,.c,.cpp,.ts,.tsx,.html,.css"
                  className="sr-only"
                  onChange={(e) => setSelectedFiles(e.target.files)}
                />
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Educational Note Content *
              </label>
              <textarea
                rows={8}
                required
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write lecture summaries, formulas, code snippets, or revision checklists..."
                className="font-mono mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Uploaded as <strong className="text-slate-800 dark:text-slate-200">{user.displayName}</strong> · Publicly visible in Study Library
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              {submitting ? 'Publishing...' : 'Publish to Study Library'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
