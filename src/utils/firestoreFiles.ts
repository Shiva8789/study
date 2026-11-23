import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PublicContentItem } from '../types';

const FIRESTORE_PREFIX = 'firestore://';
const CHUNK_RAW_BYTES = 450 * 1024; // 450 KB -> ~600 KB base64 (< 700k rules cap)
export const MAX_FIRESTORE_FALLBACK_BYTES = 15 * 1024 * 1024; // 15 MB max in serverless mode

const resolvedBlobUrlCache = new Map<string, string>();
const inflightResolutions = new Map<string, Promise<string>>();

export function invalidateResolvedFileCache(filePath?: string): void {
  if (!filePath) return;
  const cached = resolvedBlobUrlCache.get(filePath);
  if (cached) {
    URL.revokeObjectURL(cached);
    resolvedBlobUrlCache.delete(filePath);
  }
  inflightResolutions.delete(filePath);
}

export function isFirestoreFilePath(filePath?: string): boolean {
  return Boolean(filePath && filePath.startsWith(FIRESTORE_PREFIX));
}

export function extractContentIdFromPath(filePath: string): string {
  return filePath.slice(FIRESTORE_PREFIX.length).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function buildServerFileUrl(
  filePath: string,
  originalName: string,
  mimeType: string,
  download = false,
): string {
  const sep = filePath.includes('?') ? '&' : '?';
  return `${filePath}${sep}${download ? 'download=1&' : ''}name=${encodeURIComponent(originalName || 'file')}&mime=${encodeURIComponent(mimeType || 'application/octet-stream')}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function uploadBytesToFirestoreChunks(
  contentId: string,
  ownerId: string,
  bytes: Uint8Array,
): Promise<string> {
  if (bytes.byteLength > MAX_FIRESTORE_FALLBACK_BYTES) {
    throw new Error(
      `File (${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB) exceeds the 15 MB browser-direct upload limit when the file server is offline.`,
    );
  }

  const totalChunks = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_RAW_BYTES));
  const CHUNKS_PER_BATCH = 6; // ~3.6 MB per batch, comfortably under Firestore's 10 MiB batch limit

  for (let startIdx = 0; startIdx < totalChunks; startIdx += CHUNKS_PER_BATCH) {
    const batch = writeBatch(db);
    const endIdx = Math.min(totalChunks, startIdx + CHUNKS_PER_BATCH);

    for (let i = startIdx; i < endIdx; i++) {
      const slice = bytes.subarray(i * CHUNK_RAW_BYTES, Math.min(bytes.byteLength, (i + 1) * CHUNK_RAW_BYTES));
      const chunkId = `chunk_${String(i).padStart(4, '0')}`;
      const ref = doc(db, 'publicContents', contentId, 'chunks', chunkId);
      batch.set(ref, {
        contentId,
        ownerId,
        chunkIndex: i,
        totalChunks,
        dataBase64: uint8ToBase64(slice),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  return `${FIRESTORE_PREFIX}${contentId}`;
}

export async function resolveFirestoreFileUrl(
  filePath: string,
  mimeType: string,
): Promise<string> {
  if (!isFirestoreFilePath(filePath)) {
    return filePath;
  }
  const cached = resolvedBlobUrlCache.get(filePath);
  if (cached) return cached;

  const inflight = inflightResolutions.get(filePath);
  if (inflight) return inflight;

  const promise = (async () => {
    const contentId = extractContentIdFromPath(filePath);
    const q = query(
      collection(db, 'publicContents', contentId, 'chunks'),
      orderBy('chunkIndex', 'asc'),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error('File chunks were not found in cloud storage.');
    }

    const parts: BlobPart[] = snap.docs.map((d) => {
      const data = d.data();
      const bytes = base64ToUint8(String(data.dataBase64 ?? ''));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    });
    const blob = new Blob(parts, { type: mimeType || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    resolvedBlobUrlCache.set(filePath, blobUrl);
    return blobUrl;
  })().finally(() => {
    inflightResolutions.delete(filePath);
  });

  inflightResolutions.set(filePath, promise);
  return promise;
}

export function useResolvedFileUrl(
  filePath?: string,
  originalName?: string,
  mimeType?: string,
): string {
  const [resolved, setResolved] = useState<string>(() => {
    if (!filePath) return '';
    if (!isFirestoreFilePath(filePath)) {
      return buildServerFileUrl(filePath, originalName || 'file', mimeType || 'application/octet-stream', false);
    }
    return resolvedBlobUrlCache.get(filePath) || '';
  });

  useEffect(() => {
    if (!filePath) {
      setResolved('');
      return;
    }
    if (!isFirestoreFilePath(filePath)) {
      setResolved(
        buildServerFileUrl(filePath, originalName || 'file', mimeType || 'application/octet-stream', false),
      );
      return;
    }
    const cached = resolvedBlobUrlCache.get(filePath);
    if (cached) {
      setResolved(cached);
      return;
    }
    let cancelled = false;
    void resolveFirestoreFileUrl(filePath, mimeType || 'application/octet-stream')
      .then((url) => {
        if (!cancelled) setResolved(url);
      })
      .catch(() => {
        if (!cancelled) setResolved('');
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, originalName, mimeType]);

  return resolved;
}

export async function triggerResourceDownload(item: PublicContentItem): Promise<void> {
  if (!item.filePath) return;

  let href: string;
  if (isFirestoreFilePath(item.filePath)) {
    href = await resolveFirestoreFileUrl(item.filePath, item.mimeType);
  } else {
    href = buildServerFileUrl(item.filePath, item.originalName, item.mimeType, true);
  }

  const a = document.createElement('a');
  a.href = href;
  a.download = item.originalName || 'studora-resource';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function deleteFirestoreFileChunks(contentId: string): Promise<void> {
  const snap = await getDocs(collection(db, 'publicContents', contentId, 'chunks'));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
