import { useCallback, useEffect, useRef, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
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
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { SEMESTERS } from './data/subjects';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { TaskManagerView } from './components/TaskManagerView';
import { StudyModeView } from './components/StudyModeView';
import { DocumentReaderModal } from './components/DocumentReaderModal';
import { AuthView } from './components/AuthView';
import {
  deleteFirestoreFileChunks,
  invalidateResolvedFileCache,
  isFirestoreFilePath,
  MAX_FIRESTORE_FALLBACK_BYTES,
  uploadBytesToFirestoreChunks,
} from './utils/firestoreFiles';
import type {
  ActiveSection,
  AuthUser,
  PublicContentItem,
  TaskItem,
} from './types';

const ADMIN_EMAILS = new Set([
  'shivac917067@gmail.com',
  'sc276309@gmail.com',
]);

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
  if (lower.endsWith('.doc') || mimeType === 'application/msword') return 'DOC';
  if (lower.endsWith('.docx') || mimeType.includes('wordprocessingml')) return 'DOCX';
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
    // Non-fatal mirror sync when offline or unconfigured
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [popupIssueReason, setPopupIssueReason] = useState<'closed' | 'blocked' | null>(null);
  const googleSignInLockRef = useRef(false);
  const activeSectionRef = useRef<ActiveSection>(activeSection);
  activeSectionRef.current = activeSection;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [publicContents, setPublicContents] = useState<PublicContentItem[]>([]);
  const [openAddTaskTrigger, setOpenAddTaskTrigger] = useState(0);
  const [openUploadTrigger, setOpenUploadTrigger] = useState(0);
  const [readingMaterial, setReadingMaterial] = useState<PublicContentItem | null>(null);

  // 1. Auth state listener & Split-PII + Directory profile sync (UNCHANGED LOGIN SYSTEM)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setTasks([]);
        setAuthReady(true);
        return;
      }

      const providerIds = fbUser.providerData.map((p) => p.providerId);
      const isEmailAdmin =
        fbUser.emailVerified && ADMIN_EMAILS.has((fbUser.email || '').toLowerCase());

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

          if (resolvedRole === 'admin' && data.role !== 'admin') {
            await updateDoc(publicRef, {
              role: 'admin',
              updatedAt: serverTimestamp(),
            }).catch(() => undefined);
          }

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
          } else if (resolvedRole === 'admin' && dirSnap.data()?.role !== 'admin') {
            await updateDoc(dirRef, {
              role: 'admin',
              updatedAt: serverTimestamp(),
            }).catch(() => undefined);
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
      const savedTarget =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem('studora_post_login_section')
          : null;
      if (savedTarget === 'study') {
        window.sessionStorage.removeItem('studora_post_login_section');
        setActiveSection('study');
        setOpenUploadTrigger((n) => n + 1);
      } else {
        setActiveSection('dashboard');
      }
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
          const savedTarget =
            typeof window !== 'undefined'
              ? window.sessionStorage.getItem('studora_post_login_section')
              : null;
          if (savedTarget === 'study') {
            window.sessionStorage.removeItem('studora_post_login_section');
            setActiveSection('study');
            setOpenUploadTrigger((n) => n + 1);
          } else {
            setActiveSection('dashboard');
          }
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

  // 2. Public Study Library listener (readable by ANY visitor without login)
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
            authorName: String(data.authorName ?? 'Admin'),
            kind,
            title: String(data.title ?? ''),
            description: String(data.description ?? ''),
            courseCode: String(data.courseCode ?? 'STUDY'),
            subject: String(data.subject ?? 'General'),
            courseBranch: String(data.courseBranch ?? data.courseCode ?? 'General'),
            semester: String(data.semester ?? 'General'),
            topic: String(data.topic ?? ''),
            fileType: inferFileType(originalName, mimeType, kind),
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

    return () => unsub();
  }, [authReady]);

  // 3. Private Tasks listener (strictly when signed in)
  useEffect(() => {
    if (!authReady || !user) return;

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
            subject: String(data.subject ?? 'General'),
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
      unsubTasks();
    };
  }, [authReady, user?.uid]);

  // Authentication Handlers
  const handleGoogleSignIn = useCallback(async () => {
    if (googleSignInLockRef.current) return;
    googleSignInLockRef.current = true;
    setAuthError(null);
    setPopupBlocked(false);
    setPopupIssueReason(null);

    let inIframe = false;
    try {
      inIframe = typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      inIframe = true;
    }

    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      setPopupBlocked(false);
      setPopupIssueReason(null);
      if (activeSectionRef.current === 'auth') {
        const savedTarget =
          typeof window !== 'undefined'
            ? window.sessionStorage.getItem('studora_post_login_section')
            : null;
        if (savedTarget === 'study') {
          window.sessionStorage.removeItem('studora_post_login_section');
          setActiveSection('study');
          setOpenUploadTrigger((n) => n + 1);
        } else {
          setActiveSection('dashboard');
        }
      }
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (auth.currentUser) {
          setPopupBlocked(false);
          setPopupIssueReason(null);
          setAuthError(null);
          if (activeSectionRef.current === 'auth') {
            setActiveSection('dashboard');
          }
          return;
        }

        setPopupBlocked(true);
        setPopupIssueReason('closed');
        if (activeSectionRef.current !== 'auth') {
          if (activeSectionRef.current === 'study' && typeof window !== 'undefined') {
            window.sessionStorage.setItem('studora_post_login_section', 'study');
          }
          setActiveSection('auth');
          return;
        }
        return;
      }

      if (code === 'auth/popup-blocked') {
        // When running in a top-level browser tab, bypass popup blockers automatically using same-tab redirect
        if (!inIframe) {
          try {
            if (activeSectionRef.current === 'study' && typeof window !== 'undefined') {
              window.sessionStorage.setItem('studora_post_login_section', 'study');
            }
            await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
            return;
          } catch (redirErr) {
            setPopupBlocked(true);
            setPopupIssueReason('blocked');
            const msg =
              redirErr instanceof Error
                ? redirErr.message
                : 'Popup blocked and redirect sign-in could not start.';
            setAuthError(msg);
            if (activeSectionRef.current !== 'auth') {
              setActiveSection('auth');
            }
            return;
          }
        }

        setPopupBlocked(true);
        setPopupIssueReason('blocked');
        if (activeSectionRef.current !== 'auth') {
          if (activeSectionRef.current === 'study' && typeof window !== 'undefined') {
            window.sessionStorage.setItem('studora_post_login_section', 'study');
          }
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
    setActiveSection('dashboard');
  }, []);

  // Tasks CRUD
  const handleCreateTask = async (payload: {
    title: string;
    subject: string;
    dueDate: string;
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'completed';
  }) => {
    if (!user) return;
    const id = makeClientId('tsk');
    const cleanSubject = payload.subject.trim().slice(0, 80) || 'General';
    try {
      await setDoc(doc(db, 'tasks', id), {
        ownerId: user.uid,
        title: payload.title.slice(0, 180),
        courseId: 'general',
        subject: cleanSubject,
        dueDate: payload.dueDate.slice(0, 20),
        priority: payload.priority,
        status: payload.status,
        notes: '',
        attachmentIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void syncSupabase('/api/supabase/tasks', 'POST', {
        id,
        ownerId: user.uid,
        title: payload.title.slice(0, 180),
        courseId: 'general',
        subject: cleanSubject,
        dueDate: payload.dueDate.slice(0, 20),
        priority: payload.priority,
        status: payload.status,
        notes: '',
        attachmentIds: [],
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tasks/${id}`);
    }
  };

  const handleUpdateTask = async (
    id: string,
    patch: Partial<Pick<TaskItem, 'title' | 'subject' | 'dueDate' | 'priority' | 'status'>>,
  ) => {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    const supaPatch: Record<string, unknown> = {};

    if (typeof patch.title === 'string') {
      payload.title = patch.title.slice(0, 180);
      supaPatch.title = payload.title;
    }
    if (typeof patch.subject === 'string') {
      payload.subject = patch.subject.slice(0, 80) || 'General';
      supaPatch.subject = payload.subject;
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

  // Study Mode File Upload (Admin Only)
  const uploadSingleFileToServer = async (
    file: File,
  ): Promise<UploadedFileResult & { rawBytesForFirestore?: Uint8Array }> => {
    const CHUNK_THRESHOLD = 12 * 1024 * 1024;
    const CHUNK_SIZE = 3 * 1024 * 1024;

    const fallbackToFirestore = async (): Promise<
      UploadedFileResult & { rawBytesForFirestore?: Uint8Array }
    > => {
      if (file.size > MAX_FIRESTORE_FALLBACK_BYTES) {
        throw new Error(
          `"${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 15 MB cloud-direct upload limit.`,
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType =
        file.type ||
        (file.name.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : file.name.toLowerCase().endsWith('.docx')
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/msword');
      return {
        storedName: file.name,
        originalName: file.name,
        mimeType,
        fileType: inferFileType(file.name, mimeType, 'file'),
        sizeBytes: file.size,
        kind: 'file',
        rawBytesForFirestore: bytes,
      };
    };

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

        if (!parsed.data || parsed.status === 404) {
          return fallbackToFirestore();
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
    if (!parsed.data && parsed.status >= 500) {
      await new Promise((r) => setTimeout(r, 600));
      parsed = await attemptFormUpload();
    }

    if (!parsed.data || parsed.status === 404) {
      return fallbackToFirestore();
    }

    if (!parsed.ok || !parsed.data.files || parsed.data.files.length === 0) {
      throw new Error(parsed.data.error || `File upload failed (HTTP ${parsed.status}).`);
    }

    return parsed.data.files[0];
  };

  const handleAdminUploadMaterial = async (
    file: File,
    meta: {
      title: string;
      subject: string;
      unit: string;
      description: string;
    },
  ) => {
    if (!user || user.role !== 'admin') {
      throw new Error('Only administrators can upload study materials.');
    }

    const f = await uploadSingleFileToServer(file);
    const id = makeClientId('cnt');
    const resolvedFilePath = f.rawBytesForFirestore ? `firestore://${id}` : f.filePath;
    const resolvedFileType = inferFileType(f.originalName, f.mimeType, 'file');

    const record: Record<string, unknown> = {
      ownerId: user.uid,
      authorName: user.displayName.slice(0, 80),
      kind: 'file',
      title: meta.title.slice(0, 160),
      description: meta.description.slice(0, 1000),
      courseCode: 'STUDY',
      subject: meta.subject.slice(0, 80),
      courseBranch: 'General',
      semester: 'General',
      topic: meta.unit.slice(0, 120),
      fileType: resolvedFileType.slice(0, 24),
      originalName: f.originalName.slice(0, 200),
      mimeType: f.mimeType.slice(0, 120),
      sizeBytes: f.sizeBytes,
    };
    if (resolvedFilePath) {
      record.filePath = resolvedFilePath.slice(0, 300);
    }

    try {
      await setDoc(doc(db, 'publicContents', id), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (f.rawBytesForFirestore) {
        try {
          await uploadBytesToFirestoreChunks(id, user.uid, f.rawBytesForFirestore);
        } catch (chunkErr) {
          await deleteDoc(doc(db, 'publicContents', id)).catch(() => undefined);
          throw chunkErr;
        }
      }

      void syncSupabase('/api/supabase/public-contents', 'POST', { id, ...record });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `publicContents/${id}`);
    }
  };

  const handleAdminUpdateMaterial = async (
    item: PublicContentItem,
    meta: {
      title: string;
      subject: string;
      unit: string;
      description: string;
    },
    replacementFile?: File | null,
  ) => {
    if (!user || user.role !== 'admin') {
      throw new Error('Only administrators can edit study materials.');
    }

    const patch: Record<string, unknown> = {
      title: meta.title.slice(0, 160),
      subject: meta.subject.slice(0, 80),
      topic: meta.unit.slice(0, 120),
      description: meta.description.slice(0, 1000),
    };

    if (replacementFile) {
      const uploaded = await uploadSingleFileToServer(replacementFile);
      const newFileType = inferFileType(uploaded.originalName, uploaded.mimeType, 'file');

      if (isFirestoreFilePath(item.filePath)) {
        invalidateResolvedFileCache(item.filePath);
        await deleteFirestoreFileChunks(item.id).catch(() => undefined);
      } else if (item.filePath && item.filePath.startsWith('/api/files/')) {
        const oldStoredName = item.filePath.replace('/api/files/', '');
        await fetch(`/api/files/${oldStoredName}`, { method: 'DELETE' }).catch(() => undefined);
      }

      if (uploaded.rawBytesForFirestore) {
        await uploadBytesToFirestoreChunks(item.id, user.uid, uploaded.rawBytesForFirestore);
        patch.filePath = `firestore://${item.id}`;
      } else if (uploaded.filePath) {
        patch.filePath = uploaded.filePath.slice(0, 300);
      }

      patch.fileType = newFileType.slice(0, 24);
      patch.originalName = uploaded.originalName.slice(0, 200);
      patch.mimeType = uploaded.mimeType.slice(0, 120);
      patch.sizeBytes = uploaded.sizeBytes;
    }

    try {
      await updateDoc(doc(db, 'publicContents', item.id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      void syncSupabase(
        `/api/supabase/public-contents/${encodeURIComponent(item.id)}`,
        'PATCH',
        patch,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicContents/${item.id}`);
    }
  };

  const handleAdminDeleteMaterial = async (item: PublicContentItem) => {
    if (!user || user.role !== 'admin') return;
    try {
      if (isFirestoreFilePath(item.filePath)) {
        invalidateResolvedFileCache(item.filePath);
        await deleteFirestoreFileChunks(item.id).catch(() => undefined);
      }
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

  return (
    <AppShell
      activeSection={activeSection}
      onNavigate={setActiveSection}
      user={user}
      onSignOut={handleSignOut}
    >
      {authError && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="shrink-0 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!authReady ? (
        <div className="space-y-5">
          <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        </div>
      ) : activeSection === 'dashboard' ? (
        <DashboardView
          user={user}
          tasks={tasks}
          materials={publicContents}
          onNavigate={setActiveSection}
          onOpenNewTask={() => {
            setActiveSection('tasks');
            setOpenAddTaskTrigger((n) => n + 1);
          }}
          onOpenUploadContent={() => {
            setActiveSection('study');
            setOpenUploadTrigger((n) => n + 1);
          }}
          onToggleTaskStatus={async (task) => {
            await handleUpdateTask(task.id, {
              status: task.status === 'completed' ? 'todo' : 'completed',
            });
          }}
          onReadMaterial={setReadingMaterial}
        />
      ) : activeSection === 'tasks' ? (
        <TaskManagerView
          user={user}
          tasks={tasks}
          openAddTrigger={openAddTaskTrigger}
          onNavigateAuth={() => setActiveSection('auth')}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      ) : activeSection === 'study' ? (
        <StudyModeView
          user={user}
          materials={publicContents}
          openUploadTrigger={openUploadTrigger}
          onNavigateAuth={() => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem('studora_post_login_section', 'study');
            }
            setActiveSection('auth');
          }}
          onGoogleSignIn={handleGoogleSignIn}
          onResendVerification={async () => {
            if (auth.currentUser) {
              await sendEmailVerification(auth.currentUser);
            }
          }}
          onReadMaterial={setReadingMaterial}
          onAdminUploadMaterial={handleAdminUploadMaterial}
          onAdminUpdateMaterial={handleAdminUpdateMaterial}
          onAdminDeleteMaterial={handleAdminDeleteMaterial}
        />
      ) : (
        <AuthView
          popupBlocked={popupBlocked}
          popupIssueReason={popupIssueReason}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleRedirectSignIn={handleGoogleRedirectSignIn}
          onEmailSignIn={handleEmailSignIn}
          onEmailRegister={handleEmailRegister}
          onCancel={() => setActiveSection('dashboard')}
        />
      )}

      <DocumentReaderModal
        item={readingMaterial}
        onClose={() => setReadingMaterial(null)}
      />
    </AppShell>
  );
}
