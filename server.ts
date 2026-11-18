import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const STORAGE_ROOT = path.resolve(__dirname, 'storage');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'gsgvzpatttluwlpihawy';
const SUPABASE_URL =
  process.env.SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_REST_URL = (
  process.env.SUPABASE_REST_URL || `${SUPABASE_URL}/rest/v1/`
).replace(/\/+$/, '');

function getSupabaseApiKey(): string {
  const candidate =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (
    !candidate ||
    candidate === 'MY_SUPABASE_ANON_KEY' ||
    candidate === 'MY_SUPABASE_SERVICE_ROLE_KEY'
  ) {
    return '';
  }
  return candidate;
}

async function supabaseRest(
  tableAndQuery: string,
  init: RequestInit = {},
): Promise<{
  configured: boolean;
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}> {
  const apiKey = getSupabaseApiKey();
  if (!apiKey) {
    return { configured: false, ok: false, status: 200, data: null };
  }

  const target = `${SUPABASE_REST_URL}/${tableAndQuery.replace(/^\/+/, '')}`;
  const res = await fetch(target, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const errMsg =
      typeof parsed === 'object' && parsed && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `Supabase REST request failed (${res.status})`;
    return { configured: true, ok: false, status: res.status, data: parsed, error: errMsg };
  }

  return { configured: true, ok: true, status: res.status, data: parsed };
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.mp3',
  '.wav',
  '.mp4',
  '.zip',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.ts',
  '.tsx',
  '.html',
  '.css',
]);

function ensureStorageDirs(): void {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || `upload-${Date.now()}`;
}

function classifyFileType(originalName: string, mimeType: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf' || mimeType === 'application/pdf') return 'PDF';
  if (ext === '.doc' || ext === '.docx' || mimeType.includes('wordprocessingml')) return 'DOCX';
  if (ext === '.ppt' || ext === '.pptx' || mimeType.includes('presentationml')) return 'PPTX';
  if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
    return 'IMAGE';
  }
  if (['.md', '.txt'].includes(ext)) return 'NOTE';
  return 'OTHER';
}

ensureStorageDirs();

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureStorageDirs();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID().slice(0, 8);
    const safe = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${id}-${safe}`);
  },
});

const uploadMiddleware = multer({
  storage: multerStorage,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(
        new Error(
          `Unsupported file extension "${ext || 'unknown'}". Allowed formats: PDF, DOCX, PPTX, images, notes, CSV, ZIP, and source code.`,
        ),
      );
      return;
    }
    cb(null, true);
  },
});

const app = express();
app.use(express.json({ limit: '25mb' }));

// Upload up to 10 validated study material files
app.post(
  '/api/files/upload',
  uploadMiddleware.array('files', 10),
  (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Select at least one file to upload.' });
      return;
    }
    const results = files.map((file) => ({
      storedName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileType: classifyFileType(file.originalname, file.mimetype || ''),
      sizeBytes: file.size,
      filePath: `/api/files/${encodeURIComponent(file.filename)}`,
    }));
    res.status(201).json({ files: results });
  },
);

// Chunked single-file upload for large study materials (bypasses Cloud Run 32 MB single-request limit)
const CHUNKS_DIR = path.join(STORAGE_ROOT, 'chunks');
app.post('/api/files/upload-chunk', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      uploadId?: string;
      chunkIndex?: number;
      totalChunks?: number;
      originalName?: string;
      mimeType?: string;
      totalBytes?: number;
      dataBase64?: string;
    };

    const uploadId = String(body.uploadId ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkIndex = Number(body.chunkIndex);
    const totalChunks = Number(body.totalChunks);
    const originalName = path.basename(String(body.originalName ?? 'upload.bin'));
    const mimeType = String(body.mimeType ?? 'application/octet-stream');
    const totalBytes = Number(body.totalBytes ?? 0);
    const dataBase64 = String(body.dataBase64 ?? '');

    if (
      !uploadId ||
      !Number.isInteger(chunkIndex) ||
      !Number.isInteger(totalChunks) ||
      chunkIndex < 0 ||
      totalChunks < 1 ||
      chunkIndex >= totalChunks ||
      !dataBase64
    ) {
      res.status(400).json({ error: 'Invalid upload chunk payload.' });
      return;
    }

    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      res.status(400).json({
        error: `Unsupported file extension "${ext || 'unknown'}". Allowed formats: PDF, DOCX, PPTX, images, notes, CSV, ZIP, and source code.`,
      });
      return;
    }

    if (totalBytes > MAX_FILE_BYTES) {
      res.status(400).json({ error: 'File exceeds the 50 MB size limit.' });
      return;
    }

    ensureStorageDirs();
    const uploadChunkFolder = path.join(CHUNKS_DIR, uploadId);
    await fsp.mkdir(uploadChunkFolder, { recursive: true });

    const chunkBuf = Buffer.from(dataBase64, 'base64');
    await fsp.writeFile(path.join(uploadChunkFolder, `${chunkIndex}.part`), chunkBuf);

    if (chunkIndex < totalChunks - 1) {
      res.json({ complete: false, receivedChunk: chunkIndex });
      return;
    }

    const id = crypto.randomUUID().slice(0, 8);
    const safe = sanitizeFilename(originalName);
    const storedName = `${Date.now()}-${id}-${safe}`;
    const finalPath = path.join(UPLOADS_DIR, storedName);

    let assembledSize = 0;
    const handle = await fsp.open(finalPath, 'w');
    try {
      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(uploadChunkFolder, `${i}.part`);
        const partBuf = await fsp.readFile(partPath);
        assembledSize += partBuf.length;
        if (assembledSize > MAX_FILE_BYTES) {
          throw new Error('File exceeds the 50 MB size limit.');
        }
        await handle.write(partBuf);
      }
    } finally {
      await handle.close();
      await fsp.rm(uploadChunkFolder, { recursive: true, force: true }).catch(() => undefined);
    }

    res.status(201).json({
      complete: true,
      files: [
        {
          storedName,
          originalName,
          mimeType,
          fileType: classifyFileType(originalName, mimeType),
          sizeBytes: assembledSize,
          filePath: `/api/files/${encodeURIComponent(storedName)}`,
        },
      ],
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Chunked upload failed.',
    });
  }
});

// Save rendered Time-Travel PNG portrait to disk
app.post('/api/files/portrait', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      imageDataUrl?: string;
      eraId?: string;
    };
    const dataUrl = String(body.imageDataUrl ?? '');
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Valid base64 portrait image is required.' });
      return;
    }

    const mimeType = match[1];
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const buffer = Buffer.from(match[2], 'base64');

    ensureStorageDirs();
    const id = crypto.randomUUID().slice(0, 8);
    const eraSlug = sanitizeFilename(String(body.eraId ?? 'portrait'));
    const storedName = `${Date.now()}-${id}-${eraSlug}.${ext}`;
    await fsp.writeFile(path.join(UPLOADS_DIR, storedName), buffer);

    res.status(201).json({
      storedName,
      originalName: `studora-${eraSlug}.${ext}`,
      mimeType,
      fileType: 'IMAGE',
      sizeBytes: buffer.length,
      filePath: `/api/files/${encodeURIComponent(storedName)}`,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to store portrait image',
    });
  }
});

// Secure download / inline preview endpoint (prevents path traversal)
app.get('/api/files/:storedName', (req: Request, res: Response) => {
  try {
    const storedName = path.basename(String(req.params.storedName));
    const resolved = path.resolve(UPLOADS_DIR, storedName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const forceDownload = req.query.download === '1';
    const downloadName = sanitizeFilename(String(req.query.name ?? storedName));
    const mimeType = String(req.query.mime ?? '');
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${downloadName}"`,
    );
    res.sendFile(resolved);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to serve file',
    });
  }
});

app.delete('/api/files/:storedName', async (req: Request, res: Response) => {
  try {
    const storedName = path.basename(String(req.params.storedName));
    const resolved = path.resolve(UPLOADS_DIR, storedName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    await fsp.unlink(resolved).catch(() => undefined);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to delete file',
    });
  }
});

// Time-Travel Photo Booth archival note helper (Gemini 4 Hydrogen)
app.post('/api/time-travel/dossier', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. You can write or edit your own archival caption below.',
      });
      return;
    }

    const body = req.body as {
      eraLabel?: string;
      eraYear?: string;
      location?: string;
      roleTitle?: string;
      studentName?: string;
    };

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Write a concise, vivid 2-sentence museum archival placard and primary-source field note for a student portrait placed into ${body.eraLabel ?? 'a historical era'} (${body.eraYear ?? ''}, ${body.location ?? ''}) as a ${body.roleTitle ?? 'scholar'}${body.studentName ? ` featuring ${body.studentName}` : ''}. Keep the tone authentic, scholarly, and grounded in real historical detail.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    const text = response.text?.trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned an empty archival note.' });
      return;
    }

    res.json({ caption: text });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate archival dossier',
    });
  }
});

// Supabase REST API Proxy Routes (Project: gsgvzpatttluwlpihawy)
app.get('/api/supabase/public-contents', async (_req: Request, res: Response) => {
  try {
    const result = await supabaseRest(
      'studora_public_contents?select=*&order=created_at.desc',
    );
    if (!result.configured) {
      res.json({ configured: false, projectId: SUPABASE_PROJECT_ID, items: [] });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error || 'Supabase query failed' });
      return;
    }
    res.json({
      configured: true,
      projectId: SUPABASE_PROJECT_ID,
      items: Array.isArray(result.data) ? result.data : [],
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase REST query failed',
    });
  }
});

app.post('/api/supabase/public-contents', async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const row = {
      id: String(b.id || ''),
      owner_id: String(b.ownerId || ''),
      author_name: String(b.authorName || 'Student'),
      kind: String(b.kind || 'file'),
      title: String(b.title || ''),
      description: String(b.description || ''),
      course_code: String(b.courseCode || 'GENERAL'),
      subject: String(b.subject || 'Other Subjects'),
      course_branch: String(b.courseBranch || 'General'),
      semester: String(b.semester || 'General'),
      topic: String(b.topic || 'General'),
      file_type: String(b.fileType || 'OTHER'),
      original_name: String(b.originalName || 'file'),
      mime_type: String(b.mimeType || 'application/octet-stream'),
      size_bytes: Number(b.sizeBytes || 0),
      file_path: typeof b.filePath === 'string' ? b.filePath : null,
      content_text: typeof b.contentText === 'string' ? b.contentText : null,
      url: typeof b.url === 'string' ? b.url : null,
      era_label: typeof b.eraLabel === 'string' ? b.eraLabel : null,
      updated_at: new Date().toISOString(),
    };
    const result = await supabaseRest('studora_public_contents?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase insert failed',
    });
  }
});

app.patch('/api/supabase/public-contents/:id', async (req: Request, res: Response) => {
  try {
    const id = encodeURIComponent(String(req.params.id));
    const b = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof b.title === 'string') patch.title = b.title;
    if (typeof b.description === 'string') patch.description = b.description;
    if (typeof b.courseCode === 'string') patch.course_code = b.courseCode;
    if (typeof b.subject === 'string') patch.subject = b.subject;
    if (typeof b.courseBranch === 'string') patch.course_branch = b.courseBranch;
    if (typeof b.semester === 'string') patch.semester = b.semester;
    if (typeof b.topic === 'string') patch.topic = b.topic;
    if (typeof b.contentText === 'string') patch.content_text = b.contentText;

    const result = await supabaseRest(`studora_public_contents?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase update failed',
    });
  }
});

app.delete('/api/supabase/public-contents/:id', async (req: Request, res: Response) => {
  try {
    const id = encodeURIComponent(String(req.params.id));
    const result = await supabaseRest(`studora_public_contents?id=eq.${id}`, {
      method: 'DELETE',
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase delete failed',
    });
  }
});

app.get('/api/supabase/subjects', async (_req: Request, res: Response) => {
  try {
    const result = await supabaseRest('studora_subjects?select=*&order=created_at.desc');
    res.json({
      configured: result.configured,
      items: Array.isArray(result.data) ? result.data : [],
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase subjects fetch failed',
    });
  }
});

app.post('/api/supabase/subjects', async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const result = await supabaseRest('studora_subjects?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({
        id: String(b.id || ''),
        owner_id: String(b.ownerId || ''),
        name: String(b.name || ''),
        category: String(b.category || 'Custom Subject'),
        description: String(b.description || ''),
        updated_at: new Date().toISOString(),
      }),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase subject insert failed',
    });
  }
});

app.delete('/api/supabase/subjects/:id', async (req: Request, res: Response) => {
  try {
    const id = encodeURIComponent(String(req.params.id));
    const result = await supabaseRest(`studora_subjects?id=eq.${id}`, {
      method: 'DELETE',
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase subject delete failed',
    });
  }
});

app.post('/api/supabase/tasks', async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const result = await supabaseRest('studora_tasks?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({
        id: String(b.id || ''),
        owner_id: String(b.ownerId || ''),
        title: String(b.title || ''),
        course_id: String(b.courseId || 'general'),
        due_date: String(b.dueDate || ''),
        priority: String(b.priority || 'medium'),
        status: String(b.status || 'todo'),
        notes: String(b.notes || ''),
        attachment_ids: Array.isArray(b.attachmentIds) ? b.attachmentIds : [],
        updated_at: new Date().toISOString(),
      }),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase task upsert failed',
    });
  }
});

app.patch('/api/supabase/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = encodeURIComponent(String(req.params.id));
    const b = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof b.title === 'string') patch.title = b.title;
    if (typeof b.courseId === 'string') patch.course_id = b.courseId;
    if (typeof b.dueDate === 'string') patch.due_date = b.dueDate;
    if (typeof b.priority === 'string') patch.priority = b.priority;
    if (typeof b.status === 'string') patch.status = b.status;
    if (typeof b.notes === 'string') patch.notes = b.notes;
    if (Array.isArray(b.attachmentIds)) patch.attachment_ids = b.attachmentIds;

    const result = await supabaseRest(`studora_tasks?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase task update failed',
    });
  }
});

app.delete('/api/supabase/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = encodeURIComponent(String(req.params.id));
    const result = await supabaseRest(`studora_tasks?id=eq.${id}`, {
      method: 'DELETE',
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase task delete failed',
    });
  }
});

app.post('/api/supabase/courses', async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const result = await supabaseRest('studora_courses?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({
        id: String(b.id || ''),
        owner_id: String(b.ownerId || ''),
        code: String(b.code || ''),
        title: String(b.title || ''),
        instructor: String(b.instructor || ''),
        term: String(b.term || 'Fall 2026'),
        color: String(b.color || '#1D4ED8'),
        updated_at: new Date().toISOString(),
      }),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase course upsert failed',
    });
  }
});

app.post('/api/supabase/profiles', async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const result = await supabaseRest('studora_profiles?on_conflict=uid', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({
        uid: String(b.uid || ''),
        display_name: String(b.displayName || 'STUDORA Learner'),
        photo_url: String(b.photoURL || ''),
        branch: String(b.branch || 'General Studies'),
        semester: String(b.semester || 'Semester 1'),
        bio: String(b.bio || ''),
        role: String(b.role || 'student'),
        updated_at: new Date().toISOString(),
      }),
    });
    res.status(result.configured && !result.ok ? result.status : 200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase profile upsert failed',
    });
  }
});

// Guarantee any unmatched /api/* route returns JSON instead of HTML/text
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Multer & upload error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File exceeds the 50 MB size limit.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(400).json({ error: err.message || 'Upload validation failed.' });
});

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`STUDORA server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
