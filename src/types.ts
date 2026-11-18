export type ActiveSection =
  | 'home'
  | 'dashboard'
  | 'tasks'
  | 'calendar'
  | 'library'
  | 'upload'
  | 'subjects'
  | 'my-uploads'
  | 'profile'
  | 'admin'
  | 'auth'
  | 'booth';

export interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  photoURL: string;
  branch: string;
  semester: string;
  bio: string;
  role: 'student' | 'admin';
  providerIds: string[];
}

export interface SubjectItem {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description: string;
  isCore?: boolean;
}

export interface Course {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  instructor: string;
  term: string;
  color: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  ownerId: string;
  title: string;
  courseId: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed';
  notes: string;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicContentItem {
  id: string;
  ownerId: string;
  authorName: string;
  kind: 'file' | 'note' | 'link' | 'portrait';
  title: string;
  description: string;
  courseCode: string;
  subject: string;
  courseBranch: string;
  semester: string;
  topic: string;
  fileType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  filePath?: string;
  contentText?: string;
  url?: string;
  eraLabel?: string;
  createdAt: string;
}

export type EraFilterMode = 'era' | 'sepia' | 'oil' | 'mono' | 'natural';

export interface HistoricalScene {
  id: string;
  label: string;
  eraYear: string;
  location: string;
  roleTitle: string;
  description: string;
  imagePath: string;
  targetX: number;
  targetY: number;
  targetRadiusX: number;
  targetRadiusY: number;
  defaultScale: number;
  defaultFilter: EraFilterMode;
  tintColor: string;
  backdropPatchColor: string;
}
