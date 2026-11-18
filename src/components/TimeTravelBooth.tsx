import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Download,
  FileText,
  LogIn,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Upload,
  Video,
  VideoOff,
} from 'lucide-react';
import { HISTORICAL_SCENES } from '../data/historicalScenes';
import type {
  AuthUser,
  Course,
  EraFilterMode,
  HistoricalScene,
  PublicContentItem,
} from '../types';

interface TimeTravelBoothProps {
  user: AuthUser | null;
  courses: Course[];
  publicContents: PublicContentItem[];
  onSignIn: () => Promise<void>;
  onSavePortrait: (payload: {
    imageDataUrl: string;
    eraId: string;
    eraLabel: string;
    eraYear: string;
    roleTitle: string;
    caption: string;
    courseCode: string;
  }) => Promise<void>;
  onDeletePortrait: (item: PublicContentItem) => Promise<void>;
}

const CANVAS_W = 800;
const CANVAS_H = 600;

export const TimeTravelBooth: React.FC<TimeTravelBoothProps> = ({
  user,
  courses,
  publicContents,
  onSignIn,
  onSavePortrait,
  onDeletePortrait,
}) => {
  const [selectedScene, setSelectedScene] = useState<HistoricalScene>(HISTORICAL_SCENES[0]);
  const [customSceneUrl, setCustomSceneUrl] = useState<string | null>(null);
  const [customSceneLabel, setCustomSceneLabel] = useState('Custom Historical Scene');

  const [facePhotoUrl, setFacePhotoUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [feather, setFeather] = useState(0.32);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(105);
  const [filterMode, setFilterMode] = useState<EraFilterMode>(HISTORICAL_SCENES[0].defaultFilter);
  const [filmGrain, setFilmGrain] = useState(true);

  const [courseCode, setCourseCode] = useState(courses[0]?.code ?? 'HIST 214');
  const [caption, setCaption] = useState('');
  const [studentName, setStudentName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
  }>({ dragging: false, startX: 0, startY: 0, origOffsetX: 0, origOffsetY: 0 });

  const [sceneImageEl, setSceneImageEl] = useState<HTMLImageElement | null>(null);
  const [faceImageEl, setFaceImageEl] = useState<HTMLImageElement | null>(null);

  const imageVaultItems = useMemo(
    () =>
      publicContents.filter(
        (u) => u.kind === 'file' && u.mimeType.startsWith('image/') && Boolean(u.filePath),
      ),
    [publicContents],
  );

  const savedPortraits = useMemo(
    () => publicContents.filter((u) => u.kind === 'portrait' && Boolean(u.filePath)),
    [publicContents],
  );

  const activeSceneUrl = customSceneUrl ?? selectedScene.imagePath;

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setSceneImageEl(img);
    };
    img.onerror = () => {
      if (!cancelled) setSceneImageEl(null);
    };
    img.src = activeSceneUrl;
    return () => {
      cancelled = true;
    };
  }, [activeSceneUrl]);

  useEffect(() => {
    if (!facePhotoUrl) {
      setFaceImageEl(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setFaceImageEl(img);
    };
    img.src = facePhotoUrl;
    return () => {
      cancelled = true;
    };
  }, [facePhotoUrl]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is unavailable in this browser. Upload a portrait photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Unable to access camera (${err.message}). Upload a portrait photo below.`
          : 'Unable to access camera. Upload a portrait photo below.',
      );
    }
  };

  const captureFromVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const snap = document.createElement('canvas');
    snap.width = video.videoWidth;
    snap.height = video.videoHeight;
    const ctx = snap.getContext('2d');
    if (!ctx) return;
    ctx.translate(snap.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, snap.width, snap.height);
    setFacePhotoUrl(snap.toDataURL('image/png'));
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      captureFromVideo();
      return;
    }
    const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 800);
    return () => window.clearTimeout(timer);
  }, [countdown, captureFromVideo]);

  const handleSelectScene = (scene: HistoricalScene) => {
    setCustomSceneUrl(null);
    setSelectedScene(scene);
    setFilterMode(scene.defaultFilter);
    setOffsetX(0);
    setOffsetY(0);
    setScale(scene.defaultScale);
    setRotationDeg(0);
    setSaveMessage(null);
  };

  const handleFaceFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFacePhotoUrl(reader.result);
        stopCamera();
        setSaveMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCustomSceneUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomSceneUrl(reader.result);
        setCustomSceneLabel(file.name.replace(/\.[^.]+$/, '') || 'Custom Scene');
        setOffsetX(0);
        setOffsetY(0);
        setScale(1.0);
        setFilterMode('natural');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (sceneImageEl) {
      const imgAspect = sceneImageEl.width / sceneImageEl.height;
      const canvasAspect = CANVAS_W / CANVAS_H;
      let drawW = CANVAS_W;
      let drawH = CANVAS_H;
      let dx = 0;
      let dy = 0;
      if (imgAspect > canvasAspect) {
        drawH = CANVAS_H;
        drawW = CANVAS_H * imgAspect;
        dx = (CANVAS_W - drawW) / 2;
      } else {
        drawW = CANVAS_W;
        drawH = CANVAS_W / imgAspect;
        dy = (CANVAS_H - drawH) / 2;
      }
      ctx.drawImage(sceneImageEl, dx, dy, drawW, drawH);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const cx = (selectedScene.targetX + offsetX) * CANVAS_W;
    const cy = (selectedScene.targetY + offsetY) * CANVAS_H;
    const rx = selectedScene.targetRadiusX * CANVAS_W * scale;
    const ry = selectedScene.targetRadiusY * CANVAS_H * scale;

    if (!faceImageEl) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    const patchGrad = ctx.createRadialGradient(cx, cy, rx * 0.25, cx, cy, Math.max(rx, ry) * 1.15);
    patchGrad.addColorStop(0, selectedScene.backdropPatchColor);
    patchGrad.addColorStop(0.7, selectedScene.backdropPatchColor);
    patchGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = patchGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.05, ry * 1.05, (rotationDeg * Math.PI) / 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const faceLayer = document.createElement('canvas');
    faceLayer.width = CANVAS_W;
    faceLayer.height = CANVAS_H;
    const fCtx = faceLayer.getContext('2d');
    if (fCtx) {
      fCtx.save();
      fCtx.translate(cx, cy);
      fCtx.rotate((rotationDeg * Math.PI) / 180);

      let filterCss = `brightness(${brightness}%) contrast(${contrast}%) `;
      if (filterMode === 'sepia') {
        filterCss += 'sepia(78%) saturate(85%)';
      } else if (filterMode === 'mono') {
        filterCss += 'grayscale(85%) sepia(20%) contrast(112%)';
      } else if (filterMode === 'oil') {
        filterCss += 'saturate(112%) sepia(24%) contrast(114%)';
      } else if (filterMode === 'era') {
        filterCss += 'sepia(18%) saturate(96%)';
      }
      fCtx.filter = filterCss.trim();

      const targetBoxW = rx * 2.55;
      const targetBoxH = ry * 2.55;
      const fAspect = faceImageEl.width / faceImageEl.height;
      let fw = targetBoxW;
      let fh = targetBoxH;
      if (fAspect > targetBoxW / targetBoxH) {
        fh = targetBoxH;
        fw = targetBoxH * fAspect;
      } else {
        fw = targetBoxW;
        fh = targetBoxW / fAspect;
      }
      fCtx.drawImage(faceImageEl, -fw / 2, -fh / 2, fw, fh);

      fCtx.filter = 'none';
      fCtx.globalCompositeOperation = 'destination-in';
      const innerR = Math.max(0.15, 1 - feather);
      const maskGrad = fCtx.createRadialGradient(
        0,
        0,
        rx * innerR * 0.85,
        0,
        0,
        Math.max(rx, ry),
      );
      maskGrad.addColorStop(0, 'rgba(0,0,0,1)');
      maskGrad.addColorStop(0.68, 'rgba(0,0,0,0.92)');
      maskGrad.addColorStop(1, 'rgba(0,0,0,0)');

      fCtx.save();
      fCtx.scale(1, ry / Math.max(rx, 1));
      fCtx.fillStyle = maskGrad;
      fCtx.beginPath();
      fCtx.arc(0, 0, rx * 1.05, 0, Math.PI * 2);
      fCtx.fill();
      fCtx.restore();

      fCtx.restore();
      ctx.drawImage(faceLayer, 0, 0);
    }

    ctx.save();
    if (filterMode !== 'natural') {
      ctx.fillStyle = selectedScene.tintColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const vig = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.28,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.68,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(15, 12, 8, 0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (filmGrain) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 420; i++) {
        const gx = (i * 73) % CANVAS_W;
        const gy = (i * 137) % CANVAS_H;
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }
    ctx.restore();
  }, [
    sceneImageEl,
    faceImageEl,
    selectedScene,
    offsetX,
    offsetY,
    scale,
    rotationDeg,
    feather,
    brightness,
    contrast,
    filterMode,
    filmGrain,
  ]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!faceImageEl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origOffsetX: offsetX,
      origOffsetY: offsetY,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStateRef.current.startX) / rect.width;
    const dy = (e.clientY - dragStateRef.current.startY) / rect.height;
    setOffsetX(Math.max(-0.45, Math.min(0.45, dragStateRef.current.origOffsetX + dx)));
    setOffsetY(Math.max(-0.45, Math.min(0.45, dragStateRef.current.origOffsetY + dy)));
  };

  const handleCanvasPointerUp = () => {
    dragStateRef.current.dragging = false;
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `chronicle-${customSceneUrl ? 'custom' : selectedScene.id}.png`;
    a.click();
  };

  const handleSaveToPublicHub = async () => {
    if (!user) {
      await onSignIn();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !faceImageEl) {
      setSaveMessage('Capture or upload your portrait photo first before publishing.');
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await onSavePortrait({
        imageDataUrl: dataUrl,
        eraId: customSceneUrl ? 'custom' : selectedScene.id,
        eraLabel: customSceneUrl ? customSceneLabel : selectedScene.label,
        eraYear: customSceneUrl ? 'Custom Era' : selectedScene.eraYear,
        roleTitle: customSceneUrl ? 'Time Traveler' : selectedScene.roleTitle,
        caption:
          caption.trim() ||
          `${selectedScene.roleTitle} in ${customSceneUrl ? customSceneLabel : selectedScene.label}`,
        courseCode: courseCode.trim() || 'HIST 214',
      });
      setSaveMessage('Published to Public Content Hub and Time-Travel Gallery.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save portrait.');
    } finally {
      setSaving(false);
    }
  };

  const handleDraftDossier = async () => {
    setDossierLoading(true);
    setDossierError(null);
    try {
      const res = await fetch('/api/time-travel/dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eraLabel: customSceneUrl ? customSceneLabel : selectedScene.label,
          eraYear: customSceneUrl ? 'Archival Era' : selectedScene.eraYear,
          location: customSceneUrl ? 'Historical Archive' : selectedScene.location,
          roleTitle: selectedScene.roleTitle,
          studentName: studentName.trim(),
        }),
      });
      const raw = await res.text();
      let data: { caption?: string; error?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as { caption?: string; error?: string }) : {};
      } catch {
        throw new Error(`Server returned an unexpected response (HTTP ${res.status}).`);
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not draft archival caption.');
      }
      if (data.caption) setCaption(data.caption);
    } catch (err) {
      setDossierError(err instanceof Error ? err.message : 'Could not draft archival caption.');
    } finally {
      setDossierLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Historical Portrait Compositor · Interactive Studio
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Time-Travel Photo Booth
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Take a photo with your webcam or upload a selfie, insert your face into curated historical scenes, drag to align, match period lighting, and publish to the Public Study Library.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!faceImageEl}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => void handleSaveToPublicHub()}
              disabled={saving || !faceImageEl}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Publishing...' : 'Save to Public Hub'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <LogIn className="h-4 w-4" />
              Sign In to Publish
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          {/* Step 1: Capture or Upload Portrait */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                1. Your Portrait Photo
              </h2>
              {facePhotoUrl && (
                <button
                  type="button"
                  onClick={() => setFacePhotoUrl(null)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Clear photo
                </button>
              )}
            </div>

            {cameraError && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {cameraError}
              </p>
            )}

            {cameraActive ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                <div className="relative aspect-[4/3] w-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full -scale-x-100 object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-44 w-32 rounded-full border-2 border-dashed border-white/70" />
                  </div>
                  {countdown !== null && countdown > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
                      <span className="font-display text-6xl font-bold text-white tabular-nums">
                        {countdown}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-3">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    <VideoOff className="h-3.5 w-3.5" />
                    Stop Camera
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCountdown(3)}
                      className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
                    >
                      3s Timer
                    </button>
                    <button
                      type="button"
                      onClick={captureFromVideo}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Snap Photo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Video className="h-3.5 w-3.5" />
                  Open Webcam
                </button>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Face Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      handleFaceFileUpload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>

                {imageVaultItems.length > 0 && (
                  <select
                    aria-label="Choose image from Public Content Hub"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setFacePhotoUrl(e.target.value);
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="">Use image from Hub...</option>
                    {imageVaultItems.map((img) => (
                      <option
                        key={img.id}
                        value={`${img.filePath}?name=${encodeURIComponent(img.originalName)}&mime=${encodeURIComponent(img.mimeType)}`}
                      >
                        {img.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {facePhotoUrl && !cameraActive && (
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                <img
                  src={facePhotoUrl}
                  alt="Source portrait"
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                />
                <div className="text-xs text-slate-600">
                  <p className="font-medium text-slate-900">Source photo loaded</p>
                  <p>Drag directly on the scene canvas to align your face.</p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Historical Scene */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                2. Historical Scene
              </h2>
              <label className="cursor-pointer text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                Upload custom scene
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    handleCustomSceneUpload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {HISTORICAL_SCENES.map((scene) => {
                const active = !customSceneUrl && selectedScene.id === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => handleSelectScene(scene)}
                    className={`group overflow-hidden rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-blue-700 ring-2 ring-blue-700/20'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
                      <img
                        src={scene.imagePath}
                        alt={scene.label}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {scene.eraYear} · {scene.location}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {scene.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Blend & Period Grading */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  3. Face Alignment &amp; Era Tone
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOffsetX(0);
                  setOffsetY(0);
                  setScale(1);
                  setRotationDeg(0);
                  setFeather(0.32);
                  setBrightness(100);
                  setContrast(105);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <label className="text-xs text-slate-600">
                <span className="flex justify-between">
                  <span>Face Size</span>
                  <span className="font-mono tabular-nums">{Math.round(scale * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0.55"
                  max="1.7"
                  step="0.02"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-700"
                />
              </label>

              <label className="text-xs text-slate-600">
                <span className="flex justify-between">
                  <span>Rotation</span>
                  <span className="font-mono tabular-nums">{rotationDeg}°</span>
                </span>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  step="1"
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-700"
                />
              </label>

              <label className="text-xs text-slate-600">
                <span className="flex justify-between">
                  <span>Edge Feather</span>
                  <span className="font-mono tabular-nums">{Math.round(feather * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0.08"
                  max="0.55"
                  step="0.02"
                  value={feather}
                  onChange={(e) => setFeather(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-700"
                />
              </label>

              <label className="text-xs text-slate-600">
                <span className="flex justify-between">
                  <span>Brightness</span>
                  <span className="font-mono tabular-nums">{brightness}%</span>
                </span>
                <input
                  type="range"
                  min="65"
                  max="140"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-700"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { id: 'era', label: 'Era Match' },
                    { id: 'oil', label: 'Oil' },
                    { id: 'sepia', label: 'Sepia' },
                    { id: 'mono', label: 'Monochrome' },
                    { id: 'natural', label: 'Natural' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setFilterMode(preset.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filterMode === preset.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={filmGrain}
                  onChange={(e) => setFilmGrain(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                Film Grain
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Canvas & Archival Placard */}
        <div className="space-y-6 lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
              <div>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {customSceneUrl
                    ? customSceneLabel
                    : `${selectedScene.eraYear} · ${selectedScene.location} · ${selectedScene.roleTitle}`}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {customSceneUrl ? 'Custom Scene Preview' : selectedScene.label}
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {faceImageEl ? 'Drag face on canvas to reposition' : 'Waiting for portrait photo'}
              </span>
            </div>

            <div className="relative bg-slate-950">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                className={`block aspect-[4/3] w-full touch-none ${
                  faceImageEl ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                }`}
              />

              {!faceImageEl && (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                  <p className="rounded-lg bg-slate-900/85 px-4 py-2 text-xs font-medium text-white backdrop-blur-xs">
                    Open your webcam or upload a face photo on the left to step inside this scene
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Course Tag
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. HIST 214"
                    className="font-mono mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Your Name (for archival note)
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Optional student name..."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Museum Placard &amp; Historical Field Note
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleDraftDossier()}
                    disabled={dossierLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-400"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {dossierLoading ? 'Drafting...' : 'Draft Archival Note'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write or generate a historical caption for your portrait..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
                />
                {dossierError && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{dossierError}</p>
                )}
                {saveMessage && (
                  <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400">{saveMessage}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Public Time-Travel Gallery */}
      <div className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Published Time-Travel Portraits
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Saved portraits appear publicly in the Study Library so any visitor can view and download them.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {savedPortraits.length} published
          </span>
        </div>

        {savedPortraits.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No portraits published yet. Snap or upload your photo above and save it to the Public Study Library.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {savedPortraits.map((p) => {
              const imgUrl = `${p.filePath}?name=${encodeURIComponent(p.originalName)}&mime=${encodeURIComponent(p.mimeType)}`;
              const canDelete = Boolean(user && (user.uid === p.ownerId || user.role === 'admin'));
              return (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <img
                      src={imgUrl}
                      alt={p.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {p.eraLabel || p.courseCode} · By {p.authorName}
                    </p>
                    <h3 className="font-display mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {p.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {p.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                      <a
                        href={`${p.filePath}?download=1&name=${encodeURIComponent(p.originalName)}&mime=${encodeURIComponent(p.mimeType)}`}
                        download={p.originalName}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDeletePortrait(p)}
                          aria-label={`Delete ${p.title}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
