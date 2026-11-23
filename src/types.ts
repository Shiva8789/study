export type ActiveSection = 'dashboard' | 'tasks' | 'study' | 'auth';

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

export interface TaskItem {
  id: string;
  ownerId: string;
  title: string;
  courseId: string;
  subject: string;
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
