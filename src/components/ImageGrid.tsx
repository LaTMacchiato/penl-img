import React from 'react';
import { ImageItem, PipelineConfig, CustomCropBox, ToolId } from '../types';
import { formatBytes } from '../utils/fileExtractor';
import { VeolCropViewport } from './VeolCropViewport';
import {
  Loader2,
  AlertTriangle,
  Eye,
  Check,
  Copy,
  Download,
  Trash2,
} from 'lucide-react';

interface ImageGridProps {
  items: ImageItem[];
  selectedTool: ToolId;
  config: PipelineConfig;
  currentConfigSig: string;
  isVeolTool: boolean;
  hasInteractiveCropCard: boolean;
  parsedCropAspectRatio: number | null;
  checkerboardDark: boolean;
  copiedId: string | null;
  onInspect: (id: string) => void;
  onProcessSingle: (item: ImageItem, idx: number) => Promise<void>;
  onCopyClipboard: (item: ImageItem) => Promise<void>;
  onRemoveItem: (id: string) => void;
  onVeolPanZoomChange: (
    item: ImageItem,
    idx: number,
    panX: number,
    panY: number,
    zoom: number,
    commit: boolean
  ) => void;
  onCustomCropChange: (
    item: ImageItem,
    idx: number,
    cropBox: CustomCropBox | undefined,
    commit: boolean
  ) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  items,
  selectedTool,
  config,
  currentConfigSig,
  isVeolTool,
  hasInteractiveCropCard,
  parsedCropAspectRatio,
  checkerboardDark,
  copiedId,
  onInspect,
  onProcessSingle,
  onCopyClipboard,
  onRemoveItem,
  onVeolPanZoomChange,
  onCustomCropChange,
}) => {
  const useDarkCheckerboard =
    checkerboardDark && (selectedTool === 'logo-white' || selectedTool === 'remove-bg');

  return (
    <div
      className={`grid gap-5 ${
        isVeolTool || items.length === 1
          ? 'grid-cols-1'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}
    >
      {items.map((item, idx) => {
        const savedPct =
          item.processedSize && item.originalSize
            ? Math.round(((item.originalSize - item.processedSize) / item.originalSize) * 100)
            : null;
        const isStale =
          item.status === 'done' &&
          Boolean(item.processedConfigSig) &&
          item.processedConfigSig !== currentConfigSig;

        return (
          <div
            key={item.id}
            className="group bg-white rounded-2xl border border-stone-200/90 hover:border-stone-400 shadow-tactile overflow-hidden flex flex-col transition"
          >
            {/* Image Viewport */}
            {hasInteractiveCropCard ? (
              <div className="relative">
                <VeolCropViewport
                  item={item}
                  targetWidth={isVeolTool ? config.targetWidth : undefined}
                  targetHeight={isVeolTool ? config.targetHeight : undefined}
                  aspectRatio={parsedCropAspectRatio}
                  rotateDeg={config.rotateDeg}
                  flipH={config.flipH}
                  flipV={config.flipV}
                  onUpdatePanZoom={(panX, panY, zoom, commit) =>
                    onVeolPanZoomChange(item, idx, panX, panY, zoom, commit)
                  }
                  onUpdateCustomCrop={(cropBox, commit) =>
                    onCustomCropChange(item, idx, cropBox, commit)
                  }
                  onOpenInspector={() => onInspect(item.id)}
                />
                {item.status === 'processing' && (
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900 text-white flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> CALCUL…
                    </span>
                  </div>
                )}
              </div>
            ) : item.status === 'error' || item.originalWidth === 0 ? (
              <div className="relative h-44 bg-stone-900/95 flex flex-col items-center justify-center p-4 text-center border-b border-stone-200">
                <AlertTriangle className="w-7 h-7 text-amber-500 mb-2" />
                <p className="font-semibold text-xs text-white">Fichier non décodable</p>
                <p className="text-[11px] text-stone-400 mt-1 line-clamp-3">
                  {item.errorMsg || 'Format HEIF/HEIC non pris en charge.'}
                </p>
              </div>
            ) : (
              <div
                onClick={() => onInspect(item.id)}
                className={`relative h-44 ${
                  useDarkCheckerboard ? 'bg-checkerboard-dark' : 'bg-checkerboard-light'
                } flex items-center justify-center overflow-hidden border-b border-stone-100 cursor-pointer`}
              >
                <img
                  src={item.processedUrl || item.originalUrl}
                  alt={item.file.name}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="max-h-full max-w-full object-contain transition-transform duration-150 select-none"
                />

                {/* Top-left Status / Savings Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                  {item.status === 'processing' && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900 text-white flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> CALCUL…
                    </span>
                  )}
                  {isStale && item.status !== 'processing' && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400 text-stone-950 shadow-sm">
                      À actualiser
                    </span>
                  )}
                  {savedPct !== null && savedPct !== 0 && item.status === 'done' && !isStale && (
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm ${
                        savedPct > 0
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-stone-950'
                      }`}
                    >
                      {savedPct > 0 ? `-${savedPct}%` : `+${Math.abs(savedPct)}%`}
                    </span>
                  )}
                </div>

                <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-3 py-1.5 rounded-xl bg-white text-stone-900 font-semibold text-xs flex items-center gap-1.5 shadow-lg">
                    <Eye className="w-3.5 h-3.5" />
                    Avant/Après • Pipette • Crop
                  </span>
                </div>
              </div>
            )}

            {/* Card Footer */}
            <div className="p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="font-mono text-xs font-semibold text-stone-800 truncate"
                  title={item.outputFileName || item.relativePath}
                >
                  {item.outputFileName || item.relativePath}
                </div>
                <div className="font-mono text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {item.originalWidth}×{item.originalHeight} ({formatBytes(item.originalSize)})
                  </span>
                  {item.processedSize !== undefined && (
                    <span className="text-emerald-700 font-bold">
                      → {item.processedWidth}×{item.processedHeight} ({formatBytes(item.processedSize)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.processedUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onCopyClipboard(item)}
                      className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                      title="Copier l'image dans le presse-papier"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={item.processedUrl}
                      download={item.outputFileName || item.file.name}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-orange-600 text-white transition"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onProcessSingle(item, idx)}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-[11px] font-semibold cursor-pointer"
                  >
                    Go
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition cursor-pointer"
                  title="Retirer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
