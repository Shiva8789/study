import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import {
  buildServerFileUrl,
  isFirestoreFilePath,
  resolveFirestoreFileUrl,
  triggerResourceDownload,
} from '../utils/firestoreFiles';
import type { PublicContentItem } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentReaderModalProps {
  item: PublicContentItem | null;
  onClose: () => void;
}

const SAFE_HTML_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'br',
  'hr',
  'a',
  'span',
  'div',
  'sup',
  'sub',
  'img',
]);

function renderSafeHtmlNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (!SAFE_HTML_TAGS.has(tag)) {
    return Array.from(el.childNodes).map((child, idx) =>
      renderSafeHtmlNode(child, `${key}-${idx}`),
    );
  }

  if (tag === 'br') return <br key={key} />;
  if (tag === 'hr') return <hr key={key} className="my-4 border-slate-200" />;

  if (tag === 'img') {
    const src = el.getAttribute('src') || '';
    if (!src.startsWith('data:image/')) return null;
    return (
      <img
        key={key}
        src={src}
        alt={el.getAttribute('alt') || 'Document figure'}
        className="my-3 max-w-full rounded-lg border border-slate-200"
      />
    );
  }

  const children = Array.from(el.childNodes).map((child, idx) =>
    renderSafeHtmlNode(child, `${key}-${idx}`),
  );

  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    const safeHref =
      href.startsWith('https://') || href.startsWith('http://') ? href : undefined;
    if (!safeHref) return <span key={key}>{children}</span>;
    return (
      <a
        key={key}
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#4F46E5] underline hover:text-[#4338CA]"
      >
        {children}
      </a>
    );
  }

  const classMap: Record<string, string> = {
    h1: 'font-display mt-5 mb-2.5 text-2xl font-bold text-[#1E293B]',
    h2: 'font-display mt-4 mb-2 text-xl font-bold text-[#1E293B]',
    h3: 'font-display mt-3.5 mb-1.5 text-lg font-semibold text-[#1E293B]',
    h4: 'mt-3 mb-1 text-base font-semibold text-[#1E293B]',
    p: 'my-2 leading-relaxed text-[#1E293B]',
    ul: 'my-2 list-disc space-y-1 pl-6 text-[#1E293B]',
    ol: 'my-2 list-decimal space-y-1 pl-6 text-[#1E293B]',
    li: 'leading-relaxed',
    blockquote: 'my-3 border-l-4 border-[#4F46E5] bg-slate-50 py-2 pr-3 pl-4 italic text-slate-700',
    pre: 'my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100',
    code: 'rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-[#4F46E5]',
    table: 'my-4 w-full border-collapse border border-slate-300 text-sm',
    th: 'border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-[#1E293B]',
    td: 'border border-slate-300 px-3 py-2 text-[#1E293B]',
  };

  return React.createElement(
    tag,
    { key, className: classMap[tag] },
    children,
  );
}

function parseDocxHtmlToReact(html: string): React.ReactNode[] {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  return Array.from(parsed.body.childNodes).map((node, idx) =>
    renderSafeHtmlNode(node, `docx-${idx}`),
  );
}

function detectFormat(item: PublicContentItem): 'pdf' | 'docx' | 'doc' | 'note' | 'other' {
  const name = (item.originalName || '').toLowerCase();
  const type = (item.fileType || '').toUpperCase();
  const mime = (item.mimeType || '').toLowerCase();

  if (type === 'PDF' || name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (
    type === 'DOCX' ||
    name.endsWith('.docx') ||
    mime.includes('wordprocessingml')
  ) {
    return 'docx';
  }
  if (type === 'DOC' || name.endsWith('.doc') || mime === 'application/msword') {
    return 'doc';
  }
  if (item.contentText || type === 'NOTE') return 'note';
  return 'other';
}

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  item,
  onClose,
}) => {
  const modalRootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);

  const [docxNodes, setDocxNodes] = useState<React.ReactNode[] | null>(null);
  const [plainTextFallback, setPlainTextFallback] = useState<string | null>(null);
  const [legacyBinaryDoc, setLegacyBinaryDoc] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const format = item ? detectFormat(item) : 'other';

  // Track viewport width for crisp responsive PDF page fitting on mobile & desktop
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(Math.max(260, el.clientWidth - 24));
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [item, isFullscreen]);

  // Sync browser fullscreen events
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load document bytes when item changes
  useEffect(() => {
    if (!item) {
      setPdfDoc(null);
      setDocxNodes(null);
      setPlainTextFallback(null);
      setLegacyBinaryDoc(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedPdf: pdfjsLib.PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setPageNumber(1);
      setPageInput('1');
      setNumPages(0);
      setZoom(1);
      setDocxNodes(null);
      setPlainTextFallback(null);
      setLegacyBinaryDoc(false);

      try {
        const currentFormat = detectFormat(item);
        if (currentFormat === 'note' && item.contentText && !item.filePath) {
          setPlainTextFallback(item.contentText);
          return;
        }

        if (!item.filePath) {
          throw new Error('No document file is attached to this study material.');
        }

        const resolvedUrl = isFirestoreFilePath(item.filePath)
          ? await resolveFirestoreFileUrl(item.filePath, item.mimeType)
          : buildServerFileUrl(item.filePath, item.originalName, item.mimeType, false);

        const res = await fetch(resolvedUrl);
        if (!res.ok) {
          throw new Error(`Could not load document file (HTTP ${res.status}).`);
        }
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        if (currentFormat === 'pdf') {
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
          loadedPdf = await loadingTask.promise;
          if (cancelled) {
            await loadingTask.destroy();
            return;
          }
          setPdfDoc(loadedPdf);
          setNumPages(loadedPdf.numPages);
          setPageNumber(1);
          setPageInput('1');
          return;
        }

        if (currentFormat === 'docx') {
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (cancelled) return;
          const nodes = parseDocxHtmlToReact(result.value);
          setDocxNodes(nodes.length > 0 ? nodes : [<p key="empty">Document has no readable text content.</p>]);
          return;
        }

        if (currentFormat === 'doc') {
          const bytes = new Uint8Array(buffer);
          const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // PK header (.docx saved as .doc)
          const isOle2 =
            bytes[0] === 0xd0 &&
            bytes[1] === 0xcf &&
            bytes[2] === 0x11 &&
            bytes[3] === 0xe0;

          if (isZip) {
            const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
            if (cancelled) return;
            setDocxNodes(parseDocxHtmlToReact(result.value));
            return;
          }

          if (!isOle2) {
            const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            if (decoded.trim().length > 0) {
              if (decoded.trim().startsWith('<')) {
                setDocxNodes(parseDocxHtmlToReact(decoded));
              } else {
                setPlainTextFallback(decoded);
              }
              return;
            }
          }

          setLegacyBinaryDoc(true);
          return;
        }

        if (item.contentText) {
          setPlainTextFallback(item.contentText);
        } else {
          setLegacyBinaryDoc(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to open document.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      if (loadingTask) {
        void loadingTask.destroy().catch(() => undefined);
      } else if (loadedPdf) {
        void loadedPdf.cleanup().catch(() => undefined);
      }
    };
  }, [item]);

  // Render active PDF page onto responsive high-DPI canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const maxFitWidth = Math.min(containerWidth, 920);
        const baseScale = maxFitWidth / baseViewport.width;
        const effectiveScale = Math.max(0.35, baseScale * zoom);
        const viewport = page.getViewport({ scale: effectiveScale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({
          canvasContext: ctx,
          canvas,
          viewport,
        });
        await renderTask.promise;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (!cancelled && !msg.toLowerCase().includes('cancel')) {
          setError('Failed to render PDF page.');
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, zoom, containerWidth]);

  const goToPage = useCallback(
    (next: number) => {
      if (numPages < 1) return;
      const clamped = Math.min(Math.max(1, next), numPages);
      setPageNumber(clamped);
      setPageInput(String(clamped));
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
      }
    },
    [numPages],
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' && pdfDoc) {
        goToPage(pageNumber + 1);
      } else if (e.key === 'ArrowLeft' && pdfDoc) {
        goToPage(pageNumber - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, pdfDoc, pageNumber, goToPage, onClose]);

  const handleToggleFullscreen = async () => {
    const el = modalRootRef.current;
    if (!el) {
      setIsFullscreen((prev) => !prev);
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
      return;
    }

    if (typeof el.requestFullscreen === 'function') {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch {
        // Mobile Safari / restricted iframe fallback
      }
    }
    setIsFullscreen((prev) => !prev);
  };

  const handleDownload = async () => {
    if (!item) return;
    setDownloading(true);
    try {
      await triggerResourceDownload(item);
    } finally {
      setDownloading(false);
    }
  };

  if (!item) return null;

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRootRef}
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col overflow-hidden bg-[#F8FAFC] shadow-2xl ${
          isFullscreen
            ? 'fixed inset-0 h-screen w-screen rounded-none'
            : 'h-[100dvh] w-full sm:h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-slate-200'
        }`}
      >
        {/* Top Reader Toolbar */}
        <div className="border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="font-display truncate text-sm font-bold text-[#1E293B] sm:text-base">
                {item.title}
              </h2>
              <p className="truncate text-[11px] text-slate-500">
                {item.subject}
                {item.topic && item.topic !== 'General' ? ` · Unit: ${item.topic}` : ''} ·{' '}
                {item.fileType || format.toUpperCase()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Zoom Controls (PDF & DOCX) */}
              {(format === 'pdf' || docxNodes || plainTextFallback) && (
                <div className="flex items-center rounded-xl border border-slate-200 bg-[#F8FAFC] p-0.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                    disabled={zoom <= 0.5}
                    aria-label="Zoom out"
                    title="Zoom Out"
                    className="rounded-lg p-1.5 text-slate-700 hover:bg-white disabled:opacity-40"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    title="Reset Zoom"
                    className="tabular-nums min-w-[46px] px-1.5 text-center text-xs font-semibold text-[#1E293B]"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                    disabled={zoom >= 2.5}
                    aria-label="Zoom in"
                    title="Zoom In"
                    className="rounded-lg p-1.5 text-slate-700 hover:bg-white disabled:opacity-40"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Page Navigation (PDF) */}
              {pdfDoc && numPages > 0 && (
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-[#F8FAFC] p-0.5">
                  <button
                    type="button"
                    onClick={() => goToPage(pageNumber - 1)}
                    disabled={pageNumber <= 1}
                    aria-label="Previous page"
                    className="rounded-lg p-1.5 text-slate-700 hover:bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = Number(pageInput);
                      if (Number.isFinite(n)) goToPage(Math.round(n));
                    }}
                    className="flex items-center gap-1 px-1 text-xs font-medium text-slate-600"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Current page number"
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onBlur={() => {
                        const n = Number(pageInput);
                        if (Number.isFinite(n) && n >= 1) {
                          goToPage(Math.round(n));
                        } else {
                          setPageInput(String(pageNumber));
                        }
                      }}
                      className="tabular-nums w-9 rounded border border-slate-200 bg-white py-0.5 text-center text-xs font-semibold text-[#1E293B] focus:border-[#4F46E5] focus:outline-none"
                    />
                    <span className="tabular-nums whitespace-nowrap">/ {numPages}</span>
                  </form>
                  <button
                    type="button"
                    onClick={() => goToPage(pageNumber + 1)}
                    disabled={pageNumber >= numPages}
                    aria-label="Next page"
                    className="rounded-lg p-1.5 text-slate-700 hover:bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => void handleToggleFullscreen()}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isFullscreen ? 'Exit Full' : 'Fullscreen'}
                </span>
              </button>

              {/* Download Button */}
              {item.filePath && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownload()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {downloading ? 'Saving...' : 'Download'}
                  </span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  if (document.fullscreenElement) {
                    void document.exitFullscreen().catch(() => undefined);
                  }
                  onClose();
                }}
                aria-label="Close reader"
                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#1E293B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Document Viewport */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-auto bg-slate-200/70 p-3 sm:p-6"
        >
          {loading ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-slate-600">
              <Loader2 className="h-7 w-7 animate-spin text-[#4F46E5]" />
              <p className="text-sm font-medium">Loading document for reading...</p>
            </div>
          ) : error ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xs">
              <p className="text-sm font-semibold text-red-700">{error}</p>
              {item.filePath && (
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Original File</span>
                </button>
              )}
            </div>
          ) : pdfDoc ? (
            <div className="flex min-w-full flex-col items-center">
              <div className="overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-300/60">
                <canvas ref={canvasRef} className="block" />
              </div>
              {numPages > 1 && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-xs">
                  <button
                    type="button"
                    onClick={() => goToPage(pageNumber - 1)}
                    disabled={pageNumber <= 1}
                    className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums font-semibold">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(pageNumber + 1)}
                    disabled={pageNumber >= numPages}
                    className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : docxNodes ? (
            <div
              style={{ fontSize: `${Math.round(16 * zoom)}px` }}
              className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"
            >
              {docxNodes}
            </div>
          ) : plainTextFallback !== null ? (
            <div
              style={{ fontSize: `${Math.round(15 * zoom)}px` }}
              className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"
            >
              <pre className="whitespace-pre-wrap font-sans leading-relaxed text-[#1E293B]">
                {plainTextFallback}
              </pre>
            </div>
          ) : legacyBinaryDoc ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4F46E5]/10 text-[#4F46E5]">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-[#1E293B]">
                Legacy .DOC Format
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                This file uses the legacy Microsoft Word 97–2003 binary format (.doc), which
                web browsers cannot render directly inline. Download it to open on your device.
              </p>
              {item.filePath && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownload()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <Download className="h-4 w-4" />
                  <span>{downloading ? 'Downloading...' : `Download ${item.originalName}`}</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
