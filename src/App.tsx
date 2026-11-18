import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { CORE_SUBJECTS, SEMESTERS } from './data/subjects';
import { AppShell } from './components/AppShell';
import { LandingHome } from './components/LandingHome';
import { StudentDashboard } from './components/StudentDashboard';
import { TaskManagerView } from './components/TaskManagerView';
import { CalendarView } from './components/CalendarView';
import { StudyLibraryView } from './components/StudyLibraryView';
import { UploadMaterialView } from './components/UploadMaterialView';
import { ExploreSubjectsView } from './components/ExploreSubjectsView';
import { UserProfileView } from './components/UserProfileView';
import { AdminDashboardView, type DirectoryProfile } from './components/AdminDashboardView';
import { AuthView } from './components/AuthView';
import { TimeTravelBooth } from './components/TimeTravelBooth';
import type {
  ActiveSection,
  AuthUser,
  Course,
  PublicContentItem,
  SubjectItem,
  TaskItem,
} from './types';

const RUNTIME_ADMIN_EMAIL = 'shivac917067@gmail.com';

function formatTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function makeClientId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
}

function inferFileType(originalName: string, mimeType: string, kind: string): string {
  if (kind === 'note') return 'NOTE';
  if (kind === 'portrait' || mimeType.startsWith('image/')) return 'IMAGE';
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'PDF';
  if (lower.endsWith('.doc') || lower.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
    return 'DOCX';
  }
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx') || mimeType.includes('presentationml')) {
    return 'PPTX';
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return 'NOTE';
  return 'OTHER';
}

async function safeParseJson<T>(res: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
}> {
  const rawText = await res.text();
  if (!rawText) {
    return { ok: res.ok, status: res.status, data: null, rawText: '' };
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { ok: false, status: res.status, data: null, rawText };
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

const TEXT_FALLBACK_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.ts',
  '.tsx',
  '.html',
  '.css',
]);

function isTextFallbackFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  return TEXT_FALLBACK_EXTENSIONS.has(ext) || file.type.startsWith('text/');
}

interface UploadedFileResult {
  storedName: string;
  originalName: string;
  mimeType: string;
  fileType?: string;
  sizeBytes: number;
  filePath?: string;
  contentText?: string;
  kind?: 'file' | 'note';
}

async function syncSupabase(
  endpoint: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<void> {
  try {
    await fetch(endpoint, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Non-fatal mirror sync when offline or key unconfigured
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('studora_dark_mode') === 'true';
  });

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [popupIssueReason, setPopupIssueReason] = useState<'closed' | 'blocked' | null>(null);
  const googleSignInLockRef = useRef(false);
  const activeSectionRef = useRef<ActiveSection>(activeSection);
  activeSectionRef.current = activeSection;

  const [courses, setCourses] = useState<Course[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [publicContents, setPublicContents] = useState<PublicContentItem[]>([]);
  const [customSubjects, setCustomSubjects] = useState<SubjectItem[]>([]);
  const [directoryProfiles, setDirectoryProfiles] = useState<DirectoryProfile[]>([]);

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [librarySubjectFilter, setLibrarySubjectFilter] = useState<string>('all');
  const [selectedLibraryResource, setSelectedLibraryResource] = useState<PublicContentItem | null>(
    null,
  );

  // Sync Tailwind dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    window.localStorage.setItem('studora_dark_mode', String(darkMode));
  }, [darkMode]);

  const allSubjects = useMemo(() => {
    const existingNames = new Set(CORE_SUBJECTS.map((s) => s.name.toLowerCase()));
    const filteredCustom = customSubjects.filter(
      (s) => !existingNames.has(s.name.toLowerCase()),
    );
    return [...CORE_SUBJECTS, ...filteredCustom];
  }, [customSubjects]);

  // 1. Auth state listener & Split-PII + Directory profile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setCourses([]);
        setTasks([]);
        setDirectoryProfiles([]);
        setAuthReady(true);
        return;
      }

      const providerIds = fbUser.providerData.map((p) => p.providerId);
      const isEmailAdmin =
        fbUser.emailVerified && fbUser.email?.toLowerCase() === RUNTIME_ADMIN_EMAIL;

      let resolvedRole: 'student' | 'admin' = isEmailAdmin ? 'admin' : 'student';
      let branch = 'Computer Science & Engineering';
      let semester: string = SEMESTERS[0];
      let bio = '';
      let displayName = fbUser.displayName || 'STUDORA Learner';

      try {
        if (!isEmailAdmin) {
          const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid));
          if (adminSnap.exists() && fbUser.emailVerified) {
            resolvedRole = 'admin';
          }
        }

        const publicRef = doc(db, 'users', fbUser.uid, 'public', 'profile');
        const publicSnap = await getDoc(publicRef);
        const dirRef = doc(db, 'publicProfiles', fbUser.uid);

        if (publicSnap.exists()) {
          const data = publicSnap.data();
          if (typeof data.displayName === 'string' && data.displayName) {
            displayName = data.displayName;
          }
          if (typeof data.branch === 'string' && data.branch) branch = data.branch;
          if (typeof data.semester === 'string' && data.semester) semester = data.semester;
          if (typeof data.bio === 'string') bio = data.bio;
          if (data.role === 'admin' && fbUser.emailVerified) resolvedRole = 'admin';

          // Keep directory entry present
          const dirSnap = await getDoc(dirRef);
          if (!dirSnap.exists()) {
            await setDoc(dirRef, {
              uid: fbUser.uid,
              displayName: displayName.slice(0, 80),
              photoURL: (fbUser.photoURL || '').slice(0, 500),
              branch: branch.slice(0, 80),
              semester: semester.slice(0, 32),
              bio: bio.slice(0, 300),
              role: resolvedRole,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          const newProfilePayload = {
            uid: fbUser.uid,
            displayName: displayName.slice(0, 80),
            photoURL: (fbUser.photoURL || '').slice(0, 500),
            branch: branch.slice(0, 80),
            semester: semester.slice(0, 32),
            bio: '',
            role: resolvedRole,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(publicRef, newProfilePayload);
          await setDoc(dirRef, newProfilePayload);
        }

        const privateRef = doc(db, 'users', fbUser.uid, 'private', 'info');
        const privateSnap = await getDoc(privateRef);
        if (!privateSnap.exists()) {
          await setDoc(privateRef, {
            uid: fbUser.uid,
            email: (fbUser.email || 'student@studora.edu').slice(0, 200),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Profile sync warning:', err);
      }

      const userObj: AuthUser = {
        uid: fbUser.uid,
        displayName,
        email: fbUser.email || '',
        emailVerified: fbUser.emailVerified,
        photoURL: fbUser.photoURL || '',
        branch,
        semester,
        bio,
        role: resolvedRole,
        providerIds,
      };
      setUser(userObj);
      setAuthReady(true);

      void syncSupabase('/api/supabase/profiles', 'POST', {
        uid: userObj.uid,
        displayName: userObj.displayName,
        photoURL: userObj.photoURL,
        branch: userObj.branch,
        semester: userObj.semester,
        bio: userObj.bio,
        role: userObj.role,
      });
    });

    return () => unsub();
  }, []);

  // Auto-complete navigation if auth state resolves while on Auth page
  useEffect(() => {
    if (user && activeSection === 'auth') {
      setPopupBlocked(false);
      setPopupIssueReason(null);
      setAuthError(null);
      setActiveSection('dashboard');
    }
  }, [user, activeSection]);

  // Complete any redirect-based Google sign-in on return
  useEffect(() => {
    void getRedirectResult(auth, browserPopupRedirectResolver)
      .then((result) => {
        if (result?.user) {
          setPopupBlocked(false);
          setPopupIssueReason(null);
          setAuthError(null);
          setActiveSection('dashboard');
        }
      })
      .catch((err) => {
        if (err instanceof FirebaseError) {
          if (err.code === 'auth/unauthorized-domain') {
            setAuthError(
              'This preview domain is not authorized for redirect login. Please open the app in a new tab or enable this domain in Firebase Console > Authentication > Settings > Authorized domains.',
            );
          } else if (
            err.code !== 'auth/popup-closed-by-user' &&
            err.code !== 'auth/cancelled-popup-request'
          ) {
            setAuthError(err.message);
          }
        }
      });
  }, []);

  // 2. Public Study Library listener (readable by ANY visitor)
  useEffect(() => {
    if (!authReady) return;
    const q = query(collection(db, 'publicContents'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: PublicContentItem[] = snap.docs.map((d) => {
          const data = d.data();
          const kind = (data.kind as PublicContentItem['kind']) ?? 'file';
          const originalName = String(data.originalName ?? 'file');
          const mimeType = String(data.mimeType ?? 'application/octet-stream');
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? ''),
            authorName: String(data.authorName ?? 'Student'),
            kind,
            title: String(data.title ?? ''),
            description: String(data.description ?? ''),
            courseCode: String(data.courseCode ?? 'GENERAL'),
            subject: String(data.subject ?? 'Other Subjects'),
            courseBranch: String(data.courseBranch ?? data.courseCode ?? 'General'),
            semester: String(data.semester ?? 'General'),
            topic: String(data.topic ?? 'General'),
            fileType: String(data.fileType ?? inferFileType(originalName, mimeType, kind)),
            originalName,
            mimeType,
            sizeBytes: Number(data.sizeBytes ?? 0),
            filePath: typeof data.filePath === 'string' ? data.filePath : undefined,
            contentText: typeof data.contentText === 'string' ? data.contentText : undefined,
            url: typeof data.url === 'string' ? data.url : undefined,
            eraLabel: typeof data.eraLabel === 'string' ? data.eraLabel : undefined,
            createdAt: formatTimestamp(data.createdAt),
          };
        });
        setPublicContents(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'publicContents');
      },
    );

    // Also hydrate any records stored directly in Supabase REST API if configured
    void fetch('/api/supabase/public-contents')
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { configured?: boolean; items?: Array<Record<string, unknown>> } | null) => {
        if (!res?.configured || !Array.isArray(res.items) || res.items.length === 0) return;
        setPublicContents((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const extra: PublicContentItem[] = [];
          for (const row of res.items!) {
            const id = String(row.id ?? '');
            if (!id || existingIds.has(id)) continue;
            extra.push({
              id,
              ownerId: String(row.owner_id ?? ''),
              authorName: String(row.author_name ?? 'Student'),
              kind: (row.kind as PublicContentItem['kind']) ?? 'file',
              title: String(row.title ?? ''),
              description: String(row.description ?? ''),
              courseCode: String(row.course_code ?? 'GENERAL'),
              subject: String(row.subject ?? 'Other Subjects'),
              courseBranch: String(row.course_branch ?? 'General'),
              semester: String(row.semester ?? 'General'),
              topic: String(row.topic ?? 'General'),
              fileType: String(row.file_type ?? 'OTHER'),
              originalName: String(row.original_name ?? 'file'),
              mimeType: String(row.mime_type ?? 'application/octet-stream'),
              sizeBytes: Number(row.size_bytes ?? 0),
              filePath: typeof row.file_path === 'string' ? row.file_path : undefined,
              contentText: typeof row.content_text === 'string' ? row.content_text : undefined,
              url: typeof row.url === 'string' ? row.url : undefined,
              eraLabel: typeof row.era_label === 'string' ? row.era_label : undefined,
              createdAt: String(row.created_at ?? new Date().toISOString()),
            });
          }
          return extra.length > 0 ? [...prev, ...extra] : prev;
        });
      })
      .catch(() => undefined);

    return () => unsub();
  }, [authReady]);

  // 3. Public Custom Subjects listener
  useEffect(() => {
    if (!authReady) return;
    const q = query(collection(db, 'subjects'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: SubjectItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? ''),
            name: String(data.name ?? ''),
            category: String(data.category ?? 'Custom Subject'),
            description: String(data.description ?? ''),
            isCore: false,
          };
        });
        setCustomSubjects(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'subjects');
      },
    );
    return () => unsub();
  }, [authReady]);

  // 4. Private Courses & Tasks listeners (strictly when signed in)
  useEffect(() => {
    if (!authReady || !user) return;

    const coursesQuery = query(
      collection(db, 'courses'),
      where('ownerId', '==', user.uid),
    );
    const unsubCourses = onSnapshot(
      coursesQuery,
      (snap) => {
        const items: Course[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? ''),
            code: String(data.code ?? ''),
            title: String(data.title ?? ''),
            instructor: String(data.instructor ?? ''),
            term: String(data.term ?? 'Fall 2026'),
            color: String(data.color ?? '#1D4ED8'),
            createdAt: formatTimestamp(data.createdAt),
          };
        });
        items.sort((a, b) => a.code.localeCompare(b.code));
        setCourses(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'courses');
      },
    );

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', user.uid),
    );
    const unsubTasks = onSnapshot(
      tasksQuery,
      (snap) => {
        const items: TaskItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? ''),
            title: String(data.title ?? ''),
            courseId: String(data.courseId ?? 'general'),
            dueDate: String(data.dueDate ?? ''),
            priority: (data.priority as TaskItem['priority']) ?? 'medium',
            status: (data.status as TaskItem['status']) ?? 'todo',
            notes: String(data.notes ?? ''),
            attachmentIds: Array.isArray(data.attachmentIds)
              ? data.attachmentIds.map((x) => String(x))
              : [],
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
          };
        });
        items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTasks(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      },
    );

    return () => {
      unsubCourses();
      unsubTasks();
    };
  }, [authReady, user?.uid]);

  // 5. Admin Directory listener (strictly admin role)
  useEffect(() => {
    if (!authReady || !user || user.role !== 'admin') return;
    const unsub = onSnapshot(
      collection(db, 'publicProfiles'),
      (snap) => {
        const list: DirectoryProfile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            displayName: String(data.displayName ?? 'Student'),
            branch: String(data.branch ?? 'General'),
            semester: String(data.semester ?? 'General'),
            role: data.role === 'admin' ? 'admin' : 'student',
            createdAt: formatTimestamp(data.createdAt),
          };
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setDirectoryProfiles(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'publicProfiles');
      },
    );
    return () => unsub();
  }, [authReady, user?.uid, user?.role]);

  // Authentication Handlers
  const handleGoogleSignIn = useCallback(async () => {
    if (googleSignInLockRef.current) return;
    googleSignInLockRef.current = true;
    setAuthError(null);
    setPopupBlocked(false);
    setPopupIssueReason(null);

    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      setPopupBlocked(false);
      setPopupIssueReason(null);
      setActiveSection('dashboard');
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // Chrome COOP / iframe boundaries can sever window.opener right as OAuth finishes.
        // Wait briefly to see if Firebase Auth finished signing in via onAuthStateChanged.
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (auth.currentUser) {
          setPopupBlocked(false);
          setPopupIssueReason(null);
          setAuthError(null);
          setActiveSection('dashboard');
          return;
        }

        setPopupBlocked(true);
        setPopupIssueReason('closed');
        if (activeSectionRef.current !== 'auth') {
          setActiveSection('auth');
          return;
        }
        return;
      }

      if (code === 'auth/popup-blocked') {
        setPopupBlocked(true);
        setPopupIssueReason('blocked');
        if (activeSectionRef.current !== 'auth') {
          setActiveSection('auth');
          return;
        }
        return;
      }

      if (code === 'auth/unauthorized-domain') {
        const msg =
          'This URL is not listed in Firebase Console > Authentication > Settings > Authorized domains.';
        setAuthError(msg);
        throw new Error(msg);
      }

      const msg = err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      googleSignInLockRef.current = false;
    }
  }, []);

  const handleGoogleRedirectSignIn = useCallback(async () => {
    setAuthError(null);
    let inIframe = false;
    try {
      inIframe = typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      inIframe = true;
    }

    if (inIframe) {
      throw new Error(
        'Redirect sign-in cannot load inside an embedded preview frame because Google blocks iframe redirects. Click "Open in New Tab" first, then sign in.',
      );
    }

    try {
      await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to start Google redirect sign-in. Try opening the app in a new tab.';
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const handleEmailSignIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setActiveSection('dashboard');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unable to sign in.';
      if (raw.includes('auth/operation-not-allowed')) {
        throw new Error(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). Enable Email/Password or use Continue with Google.',
        );
      }
      if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
        throw new Error('Invalid email or password. Please check your credentials.');
      }
      throw new Error(raw);
    }
  }, []);

  const handleEmailRegister = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      branch: string;
      semester: string;
    }) => {
      setAuthError(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
        await updateProfile(cred.user, { displayName: payload.name });

        const profileDoc = {
          uid: cred.user.uid,
          displayName: payload.name.slice(0, 80),
          photoURL: '',
          branch: payload.branch.slice(0, 80),
          semester: payload.semester.slice(0, 32),
          bio: '',
          role: 'student',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', cred.user.uid, 'public', 'profile'), profileDoc);
        await setDoc(doc(db, 'publicProfiles', cred.user.uid), profileDoc);
        await setDoc(doc(db, 'users', cred.user.uid, 'private', 'info'), {
          uid: cred.user.uid,
          email: payload.email.slice(0, 200),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await sendEmailVerification(cred.user).catch(() => undefined);

        setUser({
          uid: cred.user.uid,
          displayName: payload.name,
          email: payload.email,
          emailVerified: cred.user.emailVerified,
          photoURL: '',
          branch: payload.branch,
          semester: payload.semester,
          bio: '',
          role: 'student',
          providerIds: ['password'],
        });
        setActiveSection('dashboard');
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Unable to register account.';
        if (raw.includes('auth/operation-not-allowed')) {
          throw new Error(
            'Email/Password registration is not enabled in Firebase Console yet. Enable Email/Password in Authentication > Sign-in method or sign in with Google.',
          );
        }
        if (raw.includes('auth/email-already-in-use')) {
          throw new Error('An account with this email already exists. Switch to Login instead.');
        }
        throw new Error(raw);
      }
    },
    [],
  );

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
    setActiveSection('home');
  }, []);

  const handleUpdateProfile = async (payload: {
    displayName: string;
    branch: string;
    semester: string;
    bio: string;
  }) => {
    if (!user || !auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: payload.displayName });

    const patch = {
      displayName: payload.displayName.slice(0, 80),
      photoURL: user.photoURL.slice(0, 500),
      branch: payload.branch.slice(0, 80),
      semester: payload.semester.slice(0, 32),
      bio: payload.bio.slice(0, 300),
      updatedAt: serverTimestamp(),
    };
    try {
      await updateDoc(doc(db, 'users', user.uid, 'public', 'profile'), patch);
      await updateDoc(doc(db, 'publicProfiles', user.uid), patch);
      void syncSupabase('/api/supabase/profiles', 'POST', {
        uid: user.uid,
        displayName: payload.displayName,
        photoURL: user.photoURL,
        branch: payload.branch,
        semester: payload.semester,
        bio: payload.bio,
        role: user.role,
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              displayName: payload.displayName,
              branch: payload.branch,
              semester: payload.semester,
              bio: payload.bio,
            }
          : prev,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/public/profile`);
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      throw new Error('No signed-in email account found.');
    }
    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
    await reauthenticateWithCredential(fbUser, credential);
    await updatePassword(fbUser, newPassword);
  };

  const handleSendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const handlePrimaryAction = () => {
    if (!user) {
      setActiveSection('auth');
      return;
    }
    if (activeSection === 'library' || activeSection === 'subjects') {
      setActiveSection('upload');
    } else {
      setActiveSection('tasks');
      setShowCreateTaskModal(true);
    }
  };

  // Sample Semester Loader
  const handleLoadSampleSemester = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    const today = Date.now();
    const iso = (days: number) => new Date(today + days * 86400000).toISOString().slice(0, 10);

    const c1 = makeClientId('crs');
    const c2 = makeClientId('crs');
    const c3 = makeClientId('crs');

    batch.set(doc(db, 'courses', c1), {
      ownerId: user.uid,
      code: 'CS 301',
      title: 'Data Structures & Algorithms',
      instructor: 'Dr. Julian Park',
      term: user.semester || 'Semester 3',
      color: '#1D4ED8',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'courses', c2), {
      ownerId: user.uid,
      code: 'DBMS 304',
      title: 'Database Management System',
      instructor: 'Prof. Clara Vance',
      term: user.semester || 'Semester 3',
      color: '#0F766E',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'courses', c3), {
      ownerId: user.uid,
      code: 'AI 402',
      title: 'Artificial Intelligence & ML',
      instructor: 'Dr. Elena Rostova',
      term: user.semester || 'Semester 3',
      color: '#B45309',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'tasks', makeClientId('tsk')), {
      ownerId: user.uid,
      title: 'Implement Dijkstra & A* Shortest Path Lab',
      courseId: c1,
      dueDate: iso(2),
      priority: 'high',
      status: 'in_progress',
      notes: 'Benchmark sparse adjacency lists and upload summary notes to Study Library.',
      attachmentIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'tasks', makeClientId('tsk')), {
      ownerId: user.uid,
      title: 'Normalize ER Diagram to BCNF (Assignment 3)',
      courseId: c2,
      dueDate: iso(4),
      priority: 'high',
      status: 'todo',
      notes: 'Include functional dependency closure proofs.',
      attachmentIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'tasks', makeClientId('tsk')), {
      ownerId: user.uid,
      title: 'Train Linear & Logistic Regression Baseline',
      courseId: c3,
      dueDate: iso(6),
      priority: 'medium',
      status: 'todo',
      notes: 'Plot validation loss curves and export notebook slides.',
      attachmentIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses/tasks');
    }
  };

  // Tasks CRUD
  const handleCreateTask = async (payload: {
    title: string;
    courseId: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    notes: string;
    attachmentIds: string[];
  }) => {
    if (!user) return;
    const id = makeClientId('tsk');
    const cleanCourseId = payload.courseId.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
    try {
      await setDoc(doc(db, 'tasks', id), {
        ownerId: user.uid,
        title: payload.title.slice(0, 180),
        courseId: cleanCourseId,
        dueDate: payload.dueDate.slice(0, 20),
        priority: payload.priority,
        status: 'todo',
        notes: payload.notes.slice(0, 4000),
        attachmentIds: payload.attachmentIds.slice(0, 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void syncSupabase('/api/supabase/tasks', 'POST', {
        id,
        ownerId: user.uid,
        title: payload.title.slice(0, 180),
        courseId: cleanCourseId,
        dueDate: payload.dueDate.slice(0, 20),
        priority: payload.priority,
        status: 'todo',
        notes: payload.notes.slice(0, 4000),
        attachmentIds: payload.attachmentIds.slice(0, 20),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tasks/${id}`);
    }
  };

  const handleUpdateTask = async (id: string, patch: Partial<TaskItem>) => {
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return;

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    const supaPatch: Record<string, unknown> = {};

    if (existing.status === 'completed' && user?.role !== 'admin') {
      if (patch.status) {
        payload.status = patch.status;
        supaPatch.status = patch.status;
      }
    } else {
      if (typeof patch.title === 'string') {
        payload.title = patch.title.slice(0, 180);
        supaPatch.title = payload.title;
      }
      if (typeof patch.courseId === 'string') {
        payload.courseId = patch.courseId;
        supaPatch.courseId = patch.courseId;
      }
      if (typeof patch.dueDate === 'string') {
        payload.dueDate = patch.dueDate.slice(0, 20);
        supaPatch.dueDate = payload.dueDate;
      }
      if (patch.priority) {
        payload.priority = patch.priority;
        supaPatch.priority = patch.priority;
      }
      if (patch.status) {
        payload.status = patch.status;
        supaPatch.status = patch.status;
      }
      if (typeof patch.notes === 'string') {
        payload.notes = patch.notes.slice(0, 4000);
        supaPatch.notes = payload.notes;
      }
      if (Array.isArray(patch.attachmentIds)) {
        payload.attachmentIds = patch.attachmentIds.slice(0, 20);
        supaPatch.attachmentIds = payload.attachmentIds;
      }
    }

    try {
      await updateDoc(doc(db, 'tasks', id), payload);
      void syncSupabase(`/api/supabase/tasks/${encodeURIComponent(id)}`, 'PATCH', supaPatch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
      void syncSupabase(`/api/supabase/tasks/${encodeURIComponent(id)}`, 'DELETE');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
    }
  };

  // Custom Subjects CRUD
  const handleCreateCustomSubject = async (payload: {
    name: string;
    category: string;
    description: string;
  }) => {
    if (!user) return;
    const id = makeClientId('sub');
    try {
      await setDoc(doc(db, 'subjects', id), {
        ownerId: user.uid,
        name: payload.name.slice(0, 80),
        category: payload.category.slice(0, 60),
        description: payload.description.slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void syncSupabase('/api/supabase/subjects', 'POST', {
        id,
        ownerId: user.uid,
        name: payload.name.slice(0, 80),
        category: payload.category.slice(0, 60),
        description: payload.description.slice(0, 300),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `subjects/${id}`);
    }
  };

  const handleDeleteCustomSubject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subjects', id));
      void syncSupabase(`/api/supabase/subjects/${encodeURIComponent(id)}`, 'DELETE');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subjects/${id}`);
    }
  };

  // Study Materials Upload & Library CRUD
  const uploadSingleFileToServer = async (file: File): Promise<UploadedFileResult> => {
    const CHUNK_THRESHOLD = 12 * 1024 * 1024; // 12 MB
    const CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB (~4 MB base64, well below Cloud Run 32 MB limit)

    if (file.size > CHUNK_THRESHOLD) {
      const uploadId = makeClientId('chk');
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let finalResult: UploadedFileResult | null = null;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const sliceBuf = await file.slice(start, end).arrayBuffer();
        const dataBase64 = uint8ToBase64(new Uint8Array(sliceBuf));

        const res = await fetch('/api/files/upload-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId,
            chunkIndex,
            totalChunks,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            totalBytes: file.size,
            dataBase64,
          }),
        });
        const parsed = await safeParseJson<{
          files?: UploadedFileResult[];
          error?: string;
        }>(res);

        if (!parsed.data) {
          throw new Error(
            `Upload server returned a non-JSON response (HTTP ${parsed.status}). Please retry in a moment.`,
          );
        }
        if (!res.ok) {
          throw new Error(parsed.data.error || `Chunked upload failed (HTTP ${res.status}).`);
        }
        if (parsed.data.files && parsed.data.files[0]) {
          finalResult = parsed.data.files[0];
        }
      }

      if (!finalResult) {
        throw new Error('Chunked upload did not return file metadata.');
      }
      return finalResult;
    }

    const attemptFormUpload = async () => {
      const formData = new FormData();
      formData.append('files', file);
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      return safeParseJson<{
        files?: UploadedFileResult[];
        error?: string;
      }>(res);
    };

    let parsed = await attemptFormUpload();
    // Retry once on transient proxy/restart non-JSON or 502/503/404 response
    if (!parsed.data && (parsed.status === 404 || parsed.status >= 500)) {
      await new Promise((r) => setTimeout(r, 700));
      parsed = await attemptFormUpload();
    }

    if (!parsed.data) {
      // If backend upload endpoint is unavailable (e.g. static preview), still allow text/code/markdown files into Firestore
      if (isTextFallbackFile(file)) {
        const textContent = (await file.text()).slice(0, 12000);
        return {
          storedName: file.name,
          originalName: file.name,
          mimeType: file.type || 'text/plain',
          fileType: inferFileType(file.name, file.type || 'text/plain', 'note'),
          sizeBytes: file.size,
          contentText: textContent,
          kind: 'note',
        };
      }
      const previewSnippet = parsed.rawText.replace(/<[^>]+>/g, ' ').trim().slice(0, 90);
      throw new Error(
        parsed.status === 404
          ? 'File upload API (/api/files/upload) was not found on this host (HTTP 404). Open the live Node server URL or use "Write Educational Note".'
          : `Upload failed with an unexpected server response (HTTP ${parsed.status}${previewSnippet ? `: ${previewSnippet}` : ''}).`,
      );
    }

    if (!parsed.ok || !parsed.data.files || parsed.data.files.length === 0) {
      throw new Error(parsed.data.error || `File upload failed (HTTP ${parsed.status}).`);
    }

    return parsed.data.files[0];
  };

  const handleUploadStudyFiles = async (
    files: FileList,
    meta: {
      title: string;
      description: string;
      subject: string;
      courseBranch: string;
      semester: string;
      topic: string;
    },
  ): Promise<string[]> => {
    if (!user) {
      setActiveSection('auth');
      return [];
    }

    const uploadedResults: UploadedFileResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const result = await uploadSingleFileToServer(files[i]);
      uploadedResults.push(result);
    }

    const createdIds: string[] = [];
    for (let i = 0; i < uploadedResults.length; i++) {
      const f = uploadedResults[i];
      const id = makeClientId('cnt');
      const docTitle =
        uploadedResults.length === 1 && meta.title
          ? meta.title
          : i === 0 && meta.title
            ? `${meta.title} (${i + 1})`
            : f.originalName;
      const courseTag = (meta.courseBranch || 'GENERAL').slice(0, 32) || 'GENERAL';
      const itemKind = f.kind === 'note' ? 'note' : 'file';

      try {
        const record: Record<string, unknown> = {
          ownerId: user.uid,
          authorName: user.displayName.slice(0, 80),
          kind: itemKind,
          title: docTitle.slice(0, 160),
          description: (meta.description || `Shared file (${f.mimeType})`).slice(0, 1000),
          courseCode: courseTag,
          subject: (meta.subject || 'Other Subjects').slice(0, 80),
          courseBranch: (meta.courseBranch || 'General').slice(0, 80),
          semester: (meta.semester || 'General').slice(0, 32),
          topic: (meta.topic || 'General').slice(0, 120),
          fileType: (f.fileType || inferFileType(f.originalName, f.mimeType, itemKind)).slice(0, 24),
          originalName: f.originalName.slice(0, 200),
          mimeType: f.mimeType.slice(0, 120),
          sizeBytes: f.sizeBytes,
        };
        if (f.filePath) {
          record.filePath = f.filePath.slice(0, 300);
        }
        if (typeof f.contentText === 'string') {
          record.contentText = f.contentText.slice(0, 12000);
        }

        await setDoc(doc(db, 'publicContents', id), {
          ...record,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void syncSupabase('/api/supabase/public-contents', 'POST', { id, ...record });
        createdIds.push(id);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `publicContents/${id}`);
      }
    }
    return createdIds;
  };

  const handleUploadFilesForTask = async (taskId: string, files: FileList) => {
    const task = tasks.find((t) => t.id === taskId);
    const course = courses.find((c) => c.id === task?.courseId);
    const newIds = await handleUploadStudyFiles(files, {
      title: '',
      description: task ? `Attached to task: ${task.title}` : 'Task attachment',
      subject: 'Other Subjects',
      courseBranch: course?.code ?? (user?.branch || 'General'),
      semester: user?.semester || 'General',
      topic: task?.title.slice(0, 80) || 'Assignment',
    });
    if (task && newIds.length > 0) {
      await handleUpdateTask(task.id, {
        attachmentIds: [...task.attachmentIds, ...newIds].slice(0, 20),
      });
    }
  };

  const handlePublishStudyNote = async (payload: {
    title: string;
    description: string;
    subject: string;
    courseBranch: string;
    semester: string;
    topic: string;
    contentText: string;
  }) => {
    if (!user) return;
    const id = makeClientId('cnt');
    const courseTag = (payload.courseBranch || 'GENERAL').slice(0, 32) || 'GENERAL';
    const record = {
      ownerId: user.uid,
      authorName: user.displayName.slice(0, 80),
      kind: 'note',
      title: payload.title.slice(0, 160),
      description: (payload.description || 'Written educational study note').slice(0, 1000),
      courseCode: courseTag,
      subject: (payload.subject || 'Other Subjects').slice(0, 80),
      courseBranch: (payload.courseBranch || 'General').slice(0, 80),
      semester: (payload.semester || 'General').slice(0, 32),
      topic: (payload.topic || 'General').slice(0, 120),
      fileType: 'NOTE',
      originalName: `${payload.title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'note'}.md`,
      mimeType: 'text/markdown',
      sizeBytes: new Blob([payload.contentText]).size,
      contentText: payload.contentText.slice(0, 12000),
    };
    try {
      await setDoc(doc(db, 'publicContents', id), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void syncSupabase('/api/supabase/public-contents', 'POST', { id, ...record });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `publicContents/${id}`);
    }
  };

  const handleUpdatePublicContent = async (
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
  ) => {
    const cleanPatch: Record<string, unknown> = {
      title: patch.title.slice(0, 160),
      description: patch.description.slice(0, 1000),
      courseCode: (patch.courseBranch || 'GENERAL').slice(0, 32) || 'GENERAL',
      subject: patch.subject.slice(0, 80),
      courseBranch: patch.courseBranch.slice(0, 80),
      semester: patch.semester.slice(0, 32),
      topic: patch.topic.slice(0, 120),
    };
    if (typeof patch.contentText === 'string') {
      cleanPatch.contentText = patch.contentText.slice(0, 12000);
    }

    try {
      await updateDoc(doc(db, 'publicContents', id), {
        ...cleanPatch,
        updatedAt: serverTimestamp(),
      });
      void syncSupabase(`/api/supabase/public-contents/${encodeURIComponent(id)}`, 'PATCH', cleanPatch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicContents/${id}`);
    }
  };

  const handleDeletePublicContent = async (item: PublicContentItem) => {
    try {
      await deleteDoc(doc(db, 'publicContents', item.id));
      void syncSupabase(`/api/supabase/public-contents/${encodeURIComponent(item.id)}`, 'DELETE');
      if (item.filePath && item.filePath.startsWith('/api/files/')) {
        const storedName = item.filePath.replace('/api/files/', '');
        await fetch(`/api/files/${storedName}`, { method: 'DELETE' }).catch(() => undefined);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `publicContents/${item.id}`);
    }
  };

  // Time-Travel Booth Save Portrait
  const handleSavePortrait = async (payload: {
    imageDataUrl: string;
    eraId: string;
    eraLabel: string;
    eraYear: string;
    roleTitle: string;
    caption: string;
    courseCode: string;
  }) => {
    if (!user) return;
    const res = await fetch('/api/files/portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: payload.imageDataUrl,
        eraId: payload.eraId,
      }),
    });
    const parsed = await safeParseJson<{
      originalName?: string;
      mimeType?: string;
      sizeBytes?: number;
      filePath?: string;
      error?: string;
    }>(res);
    const portraitFilePath = parsed.data?.filePath;
    if (!parsed.ok || !portraitFilePath) {
      throw new Error(
        parsed.data?.error ||
          `Failed to store portrait (HTTP ${parsed.status}). Make sure the backend server is running.`,
      );
    }
    const fileData = parsed.data!;

    const id = makeClientId('prt');
    const record = {
      ownerId: user.uid,
      authorName: user.displayName.slice(0, 80),
      kind: 'portrait',
      title: `${payload.eraLabel}${payload.eraYear ? ` (${payload.eraYear})` : ''}`.slice(0, 160),
      description: (
        payload.caption || `${payload.roleTitle} in ${payload.eraLabel}`
      ).slice(0, 1000),
      courseCode: (payload.courseCode || 'HIST 214').slice(0, 32),
      subject: 'Other Subjects',
      courseBranch: (payload.courseCode || 'HIST 214').slice(0, 80),
      semester: 'General',
      topic: payload.eraLabel.slice(0, 120),
      fileType: 'IMAGE',
      originalName: (fileData.originalName || 'portrait.png').slice(0, 200),
      mimeType: (fileData.mimeType || 'image/png').slice(0, 120),
      sizeBytes: fileData.sizeBytes ?? 0,
      filePath: portraitFilePath.slice(0, 300),
      eraLabel: payload.eraLabel.slice(0, 80),
    };
    try {
      await setDoc(doc(db, 'publicContents', id), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void syncSupabase('/api/supabase/public-contents', 'POST', { id, ...record });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `publicContents/${id}`);
    }
  };

  return (
    <AppShell
      activeSection={activeSection}
      onNavigate={setActiveSection}
      user={user}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
      onSignOut={handleSignOut}
      onPrimaryAction={handlePrimaryAction}
    >
      {authError && (
        <div className="mx-auto mt-4 max-w-[1440px] px-6">
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="font-medium underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!authReady ? (
        <div className="mx-auto max-w-[1440px] px-6 py-12">
          <div className="space-y-4">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-96 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                />
              ))}
            </div>
          </div>
        </div>
      ) : activeSection === 'home' ? (
        <LandingHome
          user={user}
          tasks={tasks}
          publicContents={publicContents}
          subjects={allSubjects}
          onNavigate={setActiveSection}
          onSelectSubject={(subName) => {
            setLibrarySubjectFilter(subName);
            setActiveSection('library');
          }}
          onSelectResource={(item) => {
            setSelectedLibraryResource(item);
            setActiveSection('library');
          }}
        />
      ) : activeSection === 'dashboard' ? (
        <StudentDashboard
          user={user}
          tasks={tasks}
          courses={courses}
          publicContents={publicContents}
          onNavigate={setActiveSection}
          onCreateTaskClick={() => {
            setActiveSection('tasks');
            setShowCreateTaskModal(true);
          }}
          onToggleTaskDone={async (task) => {
            await handleUpdateTask(task.id, {
              status: task.status === 'completed' ? 'todo' : 'completed',
            });
          }}
        />
      ) : activeSection === 'tasks' ? (
        <TaskManagerView
          user={user}
          courses={courses}
          tasks={tasks}
          publicContents={publicContents}
          showCreateModal={showCreateTaskModal}
          onSetShowCreateModal={setShowCreateTaskModal}
          onNavigateAuth={() => setActiveSection('auth')}
          onLoadSampleSemester={handleLoadSampleSemester}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onUploadFilesForTask={handleUploadFilesForTask}
        />
      ) : activeSection === 'calendar' ? (
        <CalendarView
          user={user}
          tasks={tasks}
          courses={courses}
          onNavigateAuth={() => setActiveSection('auth')}
          onCreateTaskForDate={handleCreateTask}
          onToggleTaskDone={async (task) => {
            await handleUpdateTask(task.id, {
              status: task.status === 'completed' ? 'todo' : 'completed',
            });
          }}
        />
      ) : activeSection === 'library' ? (
        <StudyLibraryView
          mode="public"
          user={user}
          publicContents={publicContents}
          subjects={allSubjects}
          initialSubjectFilter={librarySubjectFilter}
          initialSelectedResource={selectedLibraryResource}
          onClearInitialSelected={() => setSelectedLibraryResource(null)}
          onNavigate={setActiveSection}
          onUpdateResource={handleUpdatePublicContent}
          onDeleteResource={handleDeletePublicContent}
        />
      ) : activeSection === 'upload' ? (
        <UploadMaterialView
          user={user}
          subjects={allSubjects}
          onNavigate={setActiveSection}
          onCreateCustomSubject={handleCreateCustomSubject}
          onUploadStudyFiles={async (files, meta) => {
            await handleUploadStudyFiles(files, meta);
          }}
          onPublishStudyNote={handlePublishStudyNote}
        />
      ) : activeSection === 'subjects' ? (
        <ExploreSubjectsView
          user={user}
          subjects={allSubjects}
          publicContents={publicContents}
          onSelectSubject={(subName) => {
            setLibrarySubjectFilter(subName);
            setActiveSection('library');
          }}
          onNavigate={setActiveSection}
          onCreateCustomSubject={handleCreateCustomSubject}
          onDeleteCustomSubject={handleDeleteCustomSubject}
        />
      ) : activeSection === 'my-uploads' ? (
        <StudyLibraryView
          mode="mine"
          user={user}
          publicContents={publicContents}
          subjects={allSubjects}
          onNavigate={setActiveSection}
          onUpdateResource={handleUpdatePublicContent}
          onDeleteResource={handleDeletePublicContent}
        />
      ) : activeSection === 'profile' ? (
        <UserProfileView
          user={user}
          tasks={tasks}
          publicContents={publicContents}
          onNavigate={setActiveSection}
          onUpdateProfile={handleUpdateProfile}
          onChangePassword={handleChangePassword}
          onSendVerificationEmail={handleSendVerificationEmail}
        />
      ) : activeSection === 'admin' ? (
        <AdminDashboardView
          user={user}
          publicContents={publicContents}
          subjects={allSubjects}
          directoryProfiles={directoryProfiles}
          onDeleteContent={handleDeletePublicContent}
          onDeleteCustomSubject={handleDeleteCustomSubject}
        />
      ) : activeSection === 'auth' ? (
        <AuthView
          popupBlocked={popupBlocked}
          popupIssueReason={popupIssueReason}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleRedirectSignIn={handleGoogleRedirectSignIn}
          onEmailSignIn={handleEmailSignIn}
          onEmailRegister={handleEmailRegister}
          onCancel={() => setActiveSection('home')}
        />
      ) : (
        <TimeTravelBooth
          user={user}
          courses={courses}
          publicContents={publicContents}
          onSignIn={handleGoogleSignIn}
          onSavePortrait={handleSavePortrait}
          onDeletePortrait={handleDeletePublicContent}
        />
      )}
    </AppShell>
  );
}
