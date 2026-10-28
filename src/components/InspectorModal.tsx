import React, { useEffect, useRef, useState } from 'react';
import { ImageItem, PipelineConfig, CustomCropBox } from '../types';
import { formatBytes } from '../utils/fileExtractor';
import {
  X,
  Pipette,
  Crop,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Sparkles,
  Check,
  GripHorizontal,
  Copy,
} from 'lucide-react';

interface InspectorModalProps {
  item: ImageItem | null;
  config: PipelineConfig;
  activeToolId?: string;
  onClose: () => void;
  onUpdateConfig: (partial: Partial<PipelineConfig>) => void;
  onUpdateItem: (id: string, partial: Partial<ImageItem>) => void;
  onProcessSingle: (item: ImageItem) => Promise<void>;
  onCopyClipboard: (item: ImageItem) => Promise<void>;
  copiedId: string | null;
}

export const InspectorModal: React.FC<InspectorModalProps> = ({
  item,
  config,
  activeToolId,
  onClose,
  onUpdateConfig,
  onUpdateItem,
  onProcessSingle,
  onCopyClipboard,
  copiedId,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'compare' | 'pick-color' | 'crop'>('compare');
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const [isDrawingCrop, setIsDrawingCrop] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [draftCrop, setDraftCrop] = useState<CustomCropBox | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (item) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setDraftCrop(item.customCrop || { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      if (activeToolId === 'crop' && !item.processedUrl) {
        setMode('crop');
      } else if (
        activeToolId === 'remove-bg' &&
        config.bgRemoveMode === 'color-key' &&
        !item.processedUrl
      ) {
        setMode('pick-color');
      } else {
        setMode('compare');
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [item, activeToolId, config.bgRemoveMode]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    // Fallback for browsers without closedBy support (per modern-web-guidance `light-dismiss-a-dialog`)
    const handleLightDismissFallback = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        dialog.close();
      }
    };
    dialog.addEventListener('click', handleLightDismissFallback);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleLightDismissFallback);
    };
  }, [onClose]);

  if (!item) return null;

  const handleImageClickForColor = (e: React.MouseEvent<HTMLImageElement>) => {
    if (mode !== 'pick-color' || !imgRef.current) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const px = Math.min(img.naturalWidth - 1, Math.max(0, Math.floor(clickX * scaleX)));
    const py = Math.min(img.naturalHeight - 1, Math.max(0, Math.floor(clickY * scaleY)));

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

    onUpdateItem(item.id, { pickedColorHex: hex });
    onUpdateConfig({ bgRemoveMode: 'color-key', colorKeyHex: hex });
    setMode('compare');
  };

  // Pointer capture for Before/After comparison slider (per modern-web-guidance `drag`)
  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSplit(true);
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(0, Math.min(100, relX)));
  };

  const handleSplitLostCapture = () => {
    setIsDraggingSplit(false);
  };

  const handleSplitKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitPercent((p) => Math.max(0, p - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitPercent((p) => Math.min(100, p + 5));
    }
  };

  // Custom Crop box pointer handlers
  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'crop' || e.button !== 0 || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setCropStart({ x: nx, y: ny });
    setDraftCrop({ x: nx, y: ny, width: 0.02, height: 0.02 });
    setIsDrawingCrop(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingCrop || !cropStart || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x = Math.min(cropStart.x, nx);
    const y = Math.min(cropStart.y, ny);
    const width = Math.max(0.05, Math.abs(nx - cropStart.x));
    const height = Math.max(0.05, Math.abs(ny - cropStart.y));
    setDraftCrop({ x, y, width, height });
  };

  const handleCropPointerUp = () => {
    setIsDrawingCrop(false);
  };

  const applyCustomCrop = () => {
    if (!draftCrop) return;
    onUpdateItem(item.id, { customCrop: draftCrop });
    onUpdateConfig({ cropPreset: 'custom' });
    setMode('compare');
  };

  const savingsPercent =
    item.processedSize && item.originalSize
      ? Math.round(((item.originalSize - item.processedSize) / item.originalSize) * 100)
      : null;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby="inspectorDialogTitle"
      className="m-auto w-[94vw] max-w-5xl rounded-3xl bg-white text-stone-900 border border-stone-200 shadow-2xl p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[86vh]">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-stone-200 bg-[#FAF8F5]">
          <div>
            <h2
              id="inspectorDialogTitle"
              className="text-sm font-bold text-stone-900 flex items-center gap-2.5 flex-wrap"
            >
              <span className="font-mono text-xs bg-stone-200/80 px-2.5 py-1 rounded-lg text-stone-800">
                {item.relativePath}
              </span>
              <span className="font-mono text-xs text-stone-500">
                {item.originalWidth}×{item.originalHeight}px • {formatBytes(item.originalSize)}
              </span>
              {item.processedSize && (
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                  → {item.processedWidth}×{item.processedHeight}px • {formatBytes(item.processedSize)}{' '}
                  {savingsPercent !== null && savingsPercent > 0 ? `(-${savingsPercent}%)` : ''}
                </span>
              )}
            </h2>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                mode === 'compare'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Avant / Après
            </button>

            <button
              type="button"
              onClick={() => setMode('pick-color')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                mode === 'pick-color'
                  ? 'bg-amber-400 text-stone-950 border-amber-500 shadow-sm'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title="Cliquez sur une couleur de l'image pour supprimer le fond correspondant"
            >
              <Pipette className="w-3.5 h-3.5" />
              Pipette de fond
            </button>

            <button
              type="button"
              onClick={() => setMode('crop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                mode === 'crop'
                  ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              Tracer un Crop
            </button>

            <button
              type="button"
              onClick={() => onProcessSingle(item)}
              disabled={item.status === 'processing'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {item.status === 'processing' ? 'Calcul...' : 'Actualiser'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition"
              aria-label="Fermer l'inspecteur"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Instruction Banner */}
        {mode === 'pick-color' && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Pipette className="w-4 h-4 text-amber-700" />
              <span>
                <strong>Pipette active :</strong> Cliquez sur l'arrière-plan de l'image pour prélever la couleur exacte à rendre transparente.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMode('compare')}
              className="font-semibold underline hover:text-stone-950"
            >
              Terminé
            </button>
          </div>
        )}

        {mode === 'crop' && (
          <div className="bg-orange-50 border-b border-orange-200 px-6 py-2.5 text-xs text-orange-950 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Crop className="w-4 h-4 text-orange-600" />
              <span>
                <strong>Recadrage sur-mesure :</strong> Tracez un rectangle à la souris sur l'image puis cliquez sur Valider.
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateItem(item.id, { customCrop: undefined });
                  onUpdateConfig({ cropPreset: 'none' });
                  setMode('compare');
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3 h-3" /> Réinitialiser
              </button>
              <button
                type="button"
                onClick={applyCustomCrop}
                className="px-3 py-1 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Valider ce recadrage
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <div className="flex-1 relative flex items-center justify-center p-6 bg-checkerboard-light overflow-hidden select-none">
          <div
            ref={splitContainerRef}
            onPointerDown={mode === 'crop' ? handleCropPointerDown : undefined}
            onPointerMove={mode === 'crop' ? handleCropPointerMove : undefined}
            onPointerUp={mode === 'crop' ? handleCropPointerUp : undefined}
            className={`relative max-h-full max-w-full inline-flex items-center justify-center shadow-xl rounded-xl overflow-hidden border border-stone-300 bg-checkerboard-light ${
              mode === 'pick-color' || mode === 'crop' ? 'cursor-crosshair' : ''
            }`}
          >
            <img
              ref={imgRef}
              src={mode === 'compare' && item.processedUrl ? item.processedUrl : item.originalUrl}
              alt={item.file.name}
              onClick={handleImageClickForColor}
              draggable={false}
              className="max-h-[64vh] max-w-[85vw] w-auto h-auto object-contain block"
            />

            {mode === 'compare' && item.processedUrl && (
              <>
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                >
                  <img
                    src={item.originalUrl}
                    alt="Original"
                    draggable={false}
                    className="w-full h-full object-contain block"
                  />
                </div>

                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur text-[11px] font-mono font-semibold text-stone-800 pointer-events-none border border-stone-300 shadow-sm">
                  AVANT
                </span>
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-stone-900/90 backdrop-blur text-[11px] font-mono font-semibold text-white pointer-events-none shadow-sm">
                  APRÈS
                </span>

                {/* Dedicated Draggable Handle for Split Line */}
                <div
                  ref={handleRef}
                  tabIndex={0}
                  aria-label="Curseur de comparaison avant/après (utilisez les flèches gauche et droite)"
                  onPointerDown={handleSplitPointerDown}
                  onPointerMove={handleSplitPointerMove}
                  onLostPointerCapture={handleSplitLostCapture}
                  onKeyDown={handleSplitKeyDown}
                  style={{ left: `${splitPercent}%` }}
                  className={`drag-handle absolute top-0 bottom-0 -ml-4 w-8 flex items-center justify-center group focus:outline-none ${
                    isDraggingSplit ? 'dragging' : ''
                  }`}
                >
                  <div className="w-0.5 h-full bg-stone-900 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                  <div className="absolute w-8 h-8 rounded-full bg-stone-900 text-white border-2 border-white shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <GripHorizontal className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </>
            )}

            {mode === 'crop' && draftCrop && (
              <div
                className="absolute border-2 border-orange-500 bg-orange-500/15 pointer-events-none shadow-[0_0_0_9999px_rgba(28,25,23,0.55)]"
                style={{
                  left: `${draftCrop.x * 100}%`,
                  top: `${draftCrop.y * 100}%`,
                  width: `${draftCrop.width * 100}%`,
                  height: `${draftCrop.height * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span className="font-mono text-[11px]">
            PENL.IMG LOCAL ENGINE • ZÉRO TRANSFERT RÉSEAU
          </span>
          {item.processedUrl && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCopyClipboard(item)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-semibold transition"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copier l'image
                  </>
                )}
              </button>
              <a
                href={item.processedUrl}
                download={item.outputFileName || item.file.name}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold transition shadow-sm"
              >
                <Download className="w-4 h-4" />
                Télécharger ce fichier
              </a>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
