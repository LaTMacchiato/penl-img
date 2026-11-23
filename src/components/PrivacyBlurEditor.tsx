import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ImageItem,
  PipelineConfig,
  BlurRegion,
  BlurEffectMode,
  BlurShape,
  OutputFormat,
  ToolId,
} from '../types';
import { applyBlurRegionsToCanvas, processSingleImage } from '../utils/imageProcessor';
import { INTERNAL_TOOLS } from '../data/tools';
import JSZip from 'jszip';
import {
  EyeOff,
  Grid,
  Square,
  Circle,
  Undo2,
  Trash2,
  Eye,
  Download,
  Copy,
  Check,
  Archive,
  ShieldCheck,
  ArrowRightCircle,
  Loader2,
} from 'lucide-react';

interface PrivacyBlurEditorProps {
  items: ImageItem[];
  config: PipelineConfig;
  onUpdateConfig: (partial: Partial<PipelineConfig>) => void;
  onUpdateItem: (id: string, partial: Partial<ImageItem>) => void;
  onChainFiles: (files: { file: File; relativePath: string }[], targetTool: ToolId) => Promise<void>;
  onNotify: (kind: 'success' | 'info' | 'warning' | 'error', message: string) => void;
}

export const PrivacyBlurEditor: React.FC<PrivacyBlurEditorProps> = ({
  items,
  config,
  onUpdateConfig,
  onUpdateItem,
  onChainFiles,
  onNotify,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [draftRegion, setDraftRegion] = useState<BlurRegion | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showChainMenu, setShowChainMenu] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const draftRegionRef = useRef<BlurRegion | null>(null);
  const interactionRef = useRef<{
    type: 'draw' | 'move';
    startX: number;
    startY: number;
    regionId?: string;
    origRegion?: BlurRegion;
  } | null>(null);

  const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
  const activeItem = items[safeIndex] || null;
  const regions = activeItem?.blurRegions || [];

  useEffect(() => {
    setSelectedRegionId(null);
    setDraftRegion(null);
  }, [activeItem?.id]);

  // Render live canvas preview with all blur regions applied
  const drawCanvas = useCallback(
    (img: HTMLImageElement) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      if (!showOriginal) {
        const allRegions = draftRegion ? [...regions, draftRegion] : regions;
        applyBlurRegionsToCanvas(ctx, canvas.width, canvas.height, allRegions);
      }
    },
    [regions, draftRegion, showOriginal]
  );

  useEffect(() => {
    if (!activeItem) return;
    if (loadedImageRef.current && loadedImageRef.current.url === activeItem.originalUrl) {
      drawCanvas(loadedImageRef.current.img);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = { url: activeItem.originalUrl, img };
      drawCanvas(img);
    };
    img.src = activeItem.originalUrl;
  }, [activeItem, drawCanvas]);

  const setRegionsForActive = useCallback(
    (nextRegions: BlurRegion[]) => {
      if (!activeItem) return;
      onUpdateItem(activeItem.id, { blurRegions: nextRegions });
    },
    [activeItem, onUpdateItem]
  );

  // Keyboard shortcuts: Cmd/Ctrl+Z undo, Backspace/Delete remove selected zone
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (regions.length > 0) {
          e.preventDefault();
          const next = regions.slice(0, -1);
          setRegionsForActive(next);
          setSelectedRegionId(null);
        }
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && selectedRegionId) {
        e.preventDefault();
        setRegionsForActive(regions.filter((r) => r.id !== selectedRegionId));
        setSelectedRegionId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [regions, selectedRegionId, setRegionsForActive]);

  const getNormalizedCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || showOriginal) return;
    const { x, y } = getNormalizedCoords(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    // Check if clicking inside an existing region (topmost first) to select/move it
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        setSelectedRegionId(r.id);
        interactionRef.current = {
          type: 'move',
          startX: x,
          startY: y,
          regionId: r.id,
          origRegion: { ...r },
        };
        return;
      }
    }

    // Otherwise start drawing a new blur region
    const newId = `blur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initial: BlurRegion = {
      id: newId,
      x,
      y,
      width: 0.01,
      height: 0.01,
      mode: config.blurDefaultMode,
      intensity: config.blurDefaultIntensity,
      shape: config.blurDefaultShape,
    };
    setSelectedRegionId(newId);
    draftRegionRef.current = initial;
    setDraftRegion(initial);
    interactionRef.current = { type: 'draw', startX: x, startY: y, regionId: newId };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const inter = interactionRef.current;
    if (!inter) return;
    const { x, y } = getNormalizedCoords(e);

    if (inter.type === 'draw') {
      const rx = Math.min(inter.startX, x);
      const ry = Math.min(inter.startY, y);
      const rw = Math.max(0.015, Math.abs(x - inter.startX));
      const rh = Math.max(0.015, Math.abs(y - inter.startY));
      const nextDraft: BlurRegion = {
        id: inter.regionId!,
        x: rx,
        y: ry,
        width: Math.min(1 - rx, rw),
        height: Math.min(1 - ry, rh),
        mode: config.blurDefaultMode,
        intensity: config.blurDefaultIntensity,
        shape: config.blurDefaultShape,
      };
      draftRegionRef.current = nextDraft;
      setDraftRegion(nextDraft);
    } else if (inter.type === 'move' && inter.origRegion) {
      const dx = x - inter.startX;
      const dy = y - inter.startY;
      const nx = Math.max(0, Math.min(1 - inter.origRegion.width, inter.origRegion.x + dx));
      const ny = Math.max(0, Math.min(1 - inter.origRegion.height, inter.origRegion.y + dy));
      setRegionsForActive(
        regions.map((r) => (r.id === inter.regionId ? { ...r, x: nx, y: ny } : r))
      );
    }
  };

  const handlePointerUp = () => {
    const inter = interactionRef.current;
    if (!inter) return;
    const committed = draftRegionRef.current;
    if (inter.type === 'draw' && committed) {
      if (committed.width >= 0.015 && committed.height >= 0.015) {
        setRegionsForActive([...regions, committed]);
      } else {
        setSelectedRegionId(null);
      }
      draftRegionRef.current = null;
      setDraftRegion(null);
    }
    interactionRef.current = null;
  };

  const updateSelectedOrDefault = (partial: Partial<Pick<BlurRegion, 'mode' | 'intensity' | 'shape'>>) => {
    const cfgPartial: Partial<PipelineConfig> = {};
    if (partial.mode) cfgPartial.blurDefaultMode = partial.mode;
    if (partial.intensity !== undefined) cfgPartial.blurDefaultIntensity = partial.intensity;
    if (partial.shape) cfgPartial.blurDefaultShape = partial.shape;
    onUpdateConfig(cfgPartial);

    if (selectedRegionId) {
      setRegionsForActive(
        regions.map((r) => (r.id === selectedRegionId ? { ...r, ...partial } : r))
      );
    }
  };

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) || null;
  const activeMode = selectedRegion?.mode || config.blurDefaultMode;
  const activeShape = selectedRegion?.shape || config.blurDefaultShape;
  const activeIntensity = selectedRegion?.intensity ?? config.blurDefaultIntensity;

  const handleDownloadActive = async () => {
    if (!activeItem || isExporting) return;
    setIsExporting(true);
    try {
      const res = await processSingleImage(activeItem, safeIndex, config);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.outputFileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onNotify('success', `Image anonymisée téléchargée (${res.outputFileName}).`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Erreur lors de l’export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZipAll = async () => {
    if (items.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < items.length; i++) {
        const res = await processSingleImage(items[i], i, config);
        zip.file(res.outputFileName, res.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `penl_img_anonymise_${items.length}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onNotify('success', `${items.length} images anonymisées exportées en ZIP.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Erreur lors de la création du ZIP');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyActive = async () => {
    if (!canvasRef.current) return;
    try {
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Impossible de générer le PNG'))),
          'image/png'
        );
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      onNotify('error', 'Copie presse-papier indisponible : ' + (err?.message || err));
    }
  };

  const handleChain = async (targetTool: ToolId) => {
    setShowChainMenu(false);
    setIsExporting(true);
    try {
      const outFiles: { file: File; relativePath: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const res = await processSingleImage(items[i], i, config);
        const f = new File([res.blob], res.outputFileName, { type: res.blob.type });
        outFiles.push({ file: f, relativePath: res.outputFileName });
      }
      await onChainFiles(outFiles, targetTool);
    } catch (err: any) {
      onNotify('error', err?.message || 'Erreur lors du transfert vers le nouvel outil');
    } finally {
      setIsExporting(false);
    }
  };

  if (!activeItem) return null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-tactile p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Effect Mode + Shape + Intensity */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200">
              {[
                { id: 'blur' as BlurEffectMode, label: 'Flou', icon: <EyeOff className="w-3.5 h-3.5" /> },
                { id: 'pixelate' as BlurEffectMode, label: 'Mosaïque', icon: <Grid className="w-3.5 h-3.5" /> },
                { id: 'solid' as BlurEffectMode, label: 'Masque noir', icon: <Square className="w-3.5 h-3.5 fill-current" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateSelectedOrDefault({ mode: m.id })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeMode === m.id
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200">
              <button
                type="button"
                onClick={() => updateSelectedOrDefault({ shape: 'rect' })}
                title="Zone rectangulaire (plaques, badges, texte, écrans)"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeShape === 'rect'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                Rectangle
              </button>
              <button
                type="button"
                onClick={() => updateSelectedOrDefault({ shape: 'ellipse' })}
                title="Zone ovale (idéal pour les visages)"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeShape === 'ellipse'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Circle className="w-3.5 h-3.5" />
                Ovale
              </button>
            </div>

            {activeMode !== 'solid' && (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
                <span className="text-xs text-stone-600 font-medium">
                  {activeMode === 'pixelate' ? 'Taille pixels :' : 'Intensité :'}
                </span>
                <input
                  type="range"
                  min={6}
                  max={45}
                  value={activeIntensity}
                  onChange={(e) => updateSelectedOrDefault({ intensity: Number(e.target.value) })}
                  className="w-24 accent-stone-900"
                />
                <span className="font-mono text-xs font-bold text-stone-900 w-7">
                  {activeIntensity}
                </span>
              </div>
            )}
          </div>

          {/* Undo / Clear / Hold Original */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={regions.length === 0}
              onClick={() => {
                setRegionsForActive(regions.slice(0, -1));
                setSelectedRegionId(null);
              }}
              title="Annuler la dernière zone (Cmd+Z)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 disabled:opacity-40 border border-stone-200 text-xs font-semibold text-stone-700 transition cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Annuler
            </button>

            <button
              type="button"
              disabled={regions.length === 0}
              onClick={() => {
                setRegionsForActive([]);
                setSelectedRegionId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-40 border border-stone-200 text-xs font-semibold text-stone-700 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Effacer ({regions.length})
            </button>

            <button
              type="button"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition select-none cursor-pointer ${
                showOriginal
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title="Maintenez appuyé pour comparer avec l'image originale"
            >
              <Eye className="w-3.5 h-3.5" />
              Voir original
            </button>
          </div>
        </div>

        {/* Bottom Export & RGPD Row */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <span className="font-mono font-semibold text-stone-500 mr-1">FORMAT :</span>
              {[
                { id: 'image/jpeg', label: 'JPG' },
                { id: 'image/png', label: 'PNG' },
                { id: 'image/webp', label: 'WebP' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onUpdateConfig({ outputFormat: f.id as OutputFormat })}
                  className={`px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                    config.outputFormat === f.id
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium cursor-pointer select-none pl-3 border-l border-stone-200">
              <input
                type="checkbox"
                checked={config.stripMetadata}
                onChange={(e) => onUpdateConfig({ stripMetadata: e.target.checked })}
                className="rounded accent-emerald-700"
              />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Retirer EXIF / GPS (RGPD)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chain to another tool */}
            <div className="relative">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setShowChainMenu((s) => !s)}
                className="px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowRightCircle className="w-3.5 h-3.5 text-orange-600" />
                Continuer dans…
              </button>
              {showChainMenu && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-30">
                  {INTERNAL_TOOLS.filter((t) => t.id !== 'privacy-blur').map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleChain(t.id)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 flex items-center gap-2 transition cursor-pointer"
                    >
                      <span className={t.accentText}>{t.icon}</span>
                      <span>{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCopyActive}
              className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copié' : 'Copier'}
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadActive}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-tactile transition cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Télécharger
            </button>

            {items.length > 1 && (
              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadZipAll}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                Tout (.ZIP)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div className="relative rounded-3xl border border-stone-200/90 bg-checkerboard-dark p-4 sm:p-6 flex flex-col items-center justify-center shadow-inner overflow-hidden">
        <div className="relative inline-block max-w-full">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="max-h-[64vh] max-w-full w-auto h-auto block rounded-xl shadow-2xl cursor-crosshair select-none touch-none"
          />

          {/* Interactive overlay highlights for existing regions */}
          {!showOriginal &&
            regions.map((reg) => {
              const isSel = reg.id === selectedRegionId;
              return (
                <div
                  key={reg.id}
                  style={{
                    left: `${reg.x * 100}%`,
                    top: `${reg.y * 100}%`,
                    width: `${reg.width * 100}%`,
                    height: `${reg.height * 100}%`,
                    borderRadius: reg.shape === 'ellipse' ? '9999px' : '4px',
                  }}
                  className={`absolute pointer-events-none transition-colors ${
                    isSel
                      ? 'border-2 border-orange-500 ring-2 ring-white/70'
                      : 'border border-dashed border-white/50'
                  }`}
                >
                  {isSel && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setRegionsForActive(regions.filter((r) => r.id !== reg.id));
                        setSelectedRegionId(null);
                      }}
                      title="Supprimer cette zone"
                      className="pointer-events-auto absolute -top-3 -right-3 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center justify-center text-xs font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        <div className="mt-3 text-[11px] font-mono text-stone-300 bg-stone-900/80 px-3.5 py-1.5 rounded-full">
          {regions.length === 0
            ? 'Cliquez-glissez directement sur l’image pour tracer une zone à flouter ou masquer'
            : `${regions.length} zone${regions.length > 1 ? 's' : ''} masquée${regions.length > 1 ? 's' : ''} • Cliquez sur une zone pour la déplacer ou la supprimer (Suppr / Cmd+Z)`}
        </div>
      </div>

      {/* Multi-image selector strip */}
      {items.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="font-mono text-xs text-stone-500 mr-2 shrink-0">
            Images ({items.length}) :
          </span>
          {items.map((it, idx) => {
            const count = it.blurRegions?.length || 0;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                  safeIndex === idx
                    ? 'border-orange-600 scale-105 shadow-sm'
                    : 'border-stone-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={it.originalUrl}
                  alt={it.file.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {count > 0 && (
                  <span className="absolute top-0.5 right-0.5 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
