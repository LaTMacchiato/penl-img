import React, { useRef, useState } from 'react';
import { ImageItem, CustomCropBox } from '../types';
import { Move, ZoomIn, ZoomOut, Eye, RotateCcw } from 'lucide-react';

type CornerHandle = 'nw' | 'ne' | 'sw' | 'se';

interface VeolCropViewportProps {
  item: ImageItem;
  targetWidth?: number;
  targetHeight?: number;
  /**
   * Fixed aspect ratio (width / height) when locked, or null for freeform crop ('none' / 'custom' in Crop tool).
   */
  aspectRatio?: number | null;
  rotateDeg?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  onUpdatePanZoom: (panX: number, panY: number, zoom: number, commit: boolean) => void;
  onUpdateCustomCrop?: (crop: CustomCropBox | undefined, commit: boolean) => void;
  onOpenInspector: () => void;
}

export const VeolCropViewport: React.FC<VeolCropViewportProps> = ({
  item,
  targetWidth,
  targetHeight,
  aspectRatio,
  rotateDeg = 0,
  flipH = false,
  flipV = false,
  onUpdatePanZoom,
  onUpdateCustomCrop,
  onOpenInspector,
}) => {
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<'none' | 'pan' | CornerHandle>('none');

  const sw = Math.max(1, item.originalWidth);
  const sh = Math.max(1, item.originalHeight);
  const currentRatio = sw / sh;

  // Determine if we are in freeform custom box mode or aspect-ratio locked pan/zoom mode
  const lockedRatio: number | null =
    aspectRatio !== undefined
      ? aspectRatio
      : targetWidth && targetHeight
      ? targetWidth / targetHeight
      : null;

  const isFreeform = lockedRatio === null;

  // For freeform mode, use item.customCrop or default full box
  const freeBox: CustomCropBox = item.customCrop || { x: 0, y: 0, width: 1, height: 1 };

  // For locked ratio mode, compute box from panX, panY, zoom
  const zoom = Math.max(1, item.zoom || 1);
  const panX = item.panX !== undefined ? item.panX : 0.5;
  const panY = item.panY !== undefined ? item.panY : 0.5;

  let baseCropW = sw;
  let baseCropH = sh;
  if (lockedRatio) {
    if (currentRatio > lockedRatio) {
      baseCropW = sh * lockedRatio;
    } else {
      baseCropH = sw / lockedRatio;
    }
  }

  const maxBoxWidthPct = (baseCropW / sw) * 100;
  const maxBoxHeightPct = (baseCropH / sh) * 100;

  const finalCropW = baseCropW / zoom;
  const finalCropH = baseCropH / zoom;

  const boxWidthPct = isFreeform ? freeBox.width * 100 : (finalCropW / sw) * 100;
  const boxHeightPct = isFreeform ? freeBox.height * 100 : (finalCropH / sh) * 100;
  const maxLeftPct = Math.max(0, 100 - boxWidthPct);
  const maxTopPct = Math.max(0, 100 - boxHeightPct);

  const boxLeftPct = isFreeform
    ? freeBox.x * 100
    : maxLeftPct * Math.max(0, Math.min(1, panX));
  const boxTopPct = isFreeform
    ? freeBox.y * 100
    : maxTopPct * Math.max(0, Math.min(1, panY));

  const dragStartRef = useRef<{
    mode: 'pan' | CornerHandle;
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
    startZoom: number;
    maxDxPercent: number;
    maxDyPercent: number;
    anchorXPct: number;
    anchorYPct: number;
    startFreeBox: CustomCropBox;
  } | null>(null);

  const handlePanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, [data-handle]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragMode('pan');
    dragStartRef.current = {
      mode: 'pan',
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: panX,
      startPanY: panY,
      startZoom: zoom,
      maxDxPercent: maxLeftPct,
      maxDyPercent: maxTopPct,
      anchorXPct: 0,
      anchorYPct: 0,
      startFreeBox: freeBox,
    };
  };

  const handleCornerPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    corner: CornerHandle
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const viewport = e.currentTarget.closest('[data-veol-viewport]') as HTMLDivElement | null;
    viewport?.setPointerCapture(e.pointerId);

    const anchorXPct = corner === 'nw' || corner === 'sw' ? boxLeftPct + boxWidthPct : boxLeftPct;
    const anchorYPct = corner === 'nw' || corner === 'ne' ? boxTopPct + boxHeightPct : boxTopPct;

    setDragMode(corner);
    dragStartRef.current = {
      mode: corner,
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: panX,
      startPanY: panY,
      startZoom: zoom,
      maxDxPercent: maxLeftPct,
      maxDyPercent: maxTopPct,
      anchorXPct,
      anchorYPct,
      startFreeBox: freeBox,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragMode === 'none' || !dragStartRef.current || !imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const st = dragStartRef.current;

    if (isFreeform && onUpdateCustomCrop) {
      const deltaXNorm = (e.clientX - st.clientX) / rect.width;
      const deltaYNorm = (e.clientY - st.clientY) / rect.height;

      if (st.mode === 'pan') {
        const nx = Math.max(0, Math.min(1 - st.startFreeBox.width, st.startFreeBox.x + deltaXNorm));
        const ny = Math.max(0, Math.min(1 - st.startFreeBox.height, st.startFreeBox.y + deltaYNorm));
        onUpdateCustomCrop({ ...st.startFreeBox, x: nx, y: ny }, false);
        return;
      }

      const pointerXNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const pointerYNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const ax = st.anchorXPct / 100;
      const ay = st.anchorYPct / 100;
      const x1 = Math.min(ax, pointerXNorm);
      const y1 = Math.min(ay, pointerYNorm);
      const w = Math.max(0.08, Math.abs(pointerXNorm - ax));
      const h = Math.max(0.08, Math.abs(pointerYNorm - ay));
      onUpdateCustomCrop(
        {
          x: Math.min(1 - w, x1),
          y: Math.min(1 - h, y1),
          width: w,
          height: h,
        },
        false
      );
      return;
    }

    if (st.mode === 'pan') {
      const deltaXPercent = ((e.clientX - st.clientX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - st.clientY) / rect.height) * 100;

      const nextPanX =
        st.maxDxPercent > 0.01
          ? Math.max(0, Math.min(1, st.startPanX + deltaXPercent / st.maxDxPercent))
          : 0.5;

      const nextPanY =
        st.maxDyPercent > 0.01
          ? Math.max(0, Math.min(1, st.startPanY + deltaYPercent / st.maxDyPercent))
          : 0.5;

      onUpdatePanZoom(nextPanX, nextPanY, zoom, false);
      return;
    }

    // Corner Handle Resize (proportional zoom in/out anchored on opposite corner)
    const pointerXPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const pointerYPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const corner = st.mode;
    const rawSpanWPct =
      corner === 'ne' || corner === 'se'
        ? Math.max(5, pointerXPct - st.anchorXPct)
        : Math.max(5, st.anchorXPct - pointerXPct);
    const rawSpanHPct =
      corner === 'sw' || corner === 'se'
        ? Math.max(5, pointerYPct - st.anchorYPct)
        : Math.max(5, st.anchorYPct - pointerYPct);

    const maxAllowedWPct =
      corner === 'ne' || corner === 'se' ? 100 - st.anchorXPct : st.anchorXPct;
    const maxAllowedHPct =
      corner === 'sw' || corner === 'se' ? 100 - st.anchorYPct : st.anchorYPct;

    const desiredScaleFromW = rawSpanWPct / maxBoxWidthPct;
    const desiredScaleFromH = rawSpanHPct / maxBoxHeightPct;
    const desiredScale = (desiredScaleFromW + desiredScaleFromH) / 2;

    const boundScaleW = maxAllowedWPct / maxBoxWidthPct;
    const boundScaleH = maxAllowedHPct / maxBoxHeightPct;
    const maxScaleForAnchor = Math.min(1, boundScaleW, boundScaleH);

    const clampedScale = Math.max(0.25, Math.min(Math.max(0.25, maxScaleForAnchor), desiredScale));
    const nextZoom = Number((1 / clampedScale).toFixed(3));

    const newWPct = maxBoxWidthPct / nextZoom;
    const newHPct = maxBoxHeightPct / nextZoom;

    const newLeftPct =
      corner === 'ne' || corner === 'se' ? st.anchorXPct : st.anchorXPct - newWPct;
    const newTopPct =
      corner === 'sw' || corner === 'se' ? st.anchorYPct : st.anchorYPct - newHPct;

    const newMaxLeftPct = Math.max(0, 100 - newWPct);
    const newMaxTopPct = Math.max(0, 100 - newHPct);

    const nextPanX =
      newMaxLeftPct > 0.01 ? Math.max(0, Math.min(1, newLeftPct / newMaxLeftPct)) : 0.5;
    const nextPanY =
      newMaxTopPct > 0.01 ? Math.max(0, Math.min(1, newTopPct / newMaxTopPct)) : 0.5;

    onUpdatePanZoom(nextPanX, nextPanY, nextZoom, false);
  };

  const handlePointerUp = () => {
    if (dragMode === 'none') return;
    setDragMode('none');
    dragStartRef.current = null;
    if (isFreeform && onUpdateCustomCrop) {
      onUpdateCustomCrop(freeBox, true);
    } else {
      onUpdatePanZoom(panX, panY, zoom, true);
    }
  };

  // Smooth Wheel / Trackpad zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    if (isFreeform && onUpdateCustomCrop) {
      const factor = e.deltaY < 0 ? 0.92 : 1.08;
      const newW = Math.max(0.1, Math.min(1, freeBox.width * factor));
      const newH = Math.max(0.1, Math.min(1, freeBox.height * factor));
      const cx = freeBox.x + freeBox.width / 2;
      const cy = freeBox.y + freeBox.height / 2;
      const nx = Math.max(0, Math.min(1 - newW, cx - newW / 2));
      const ny = Math.max(0, Math.min(1 - newH, cy - newH / 2));
      onUpdateCustomCrop({ x: nx, y: ny, width: newW, height: newH }, true);
      return;
    }
    const nextZoom = Math.max(1, Math.min(4, Number((zoom + delta).toFixed(2))));
    if (nextZoom !== zoom) {
      onUpdatePanZoom(panX, panY, nextZoom, true);
    }
  };

  // Double-click to reset frame to centered 1x
  const handleDoubleClick = () => {
    if (isFreeform && onUpdateCustomCrop) {
      onUpdateCustomCrop(undefined, true);
    } else {
      onUpdatePanZoom(0.5, 0.5, 1, true);
    }
  };

  const handleZoomStep = (delta: number) => {
    if (isFreeform && onUpdateCustomCrop) {
      const factor = delta > 0 ? 0.85 : 1.15;
      const newW = Math.max(0.1, Math.min(1, freeBox.width * factor));
      const newH = Math.max(0.1, Math.min(1, freeBox.height * factor));
      const cx = freeBox.x + freeBox.width / 2;
      const cy = freeBox.y + freeBox.height / 2;
      const nx = Math.max(0, Math.min(1 - newW, cx - newW / 2));
      const ny = Math.max(0, Math.min(1 - newH, cy - newH / 2));
      onUpdateCustomCrop({ x: nx, y: ny, width: newW, height: newH }, true);
      return;
    }
    const nextZoom = Math.max(1, Math.min(4, Number((zoom + delta).toFixed(2))));
    onUpdatePanZoom(panX, panY, nextZoom, true);
  };

  const isDragging = dragMode !== 'none';

  // Compute current pixel size of the crop box
  const displayCropW = targetWidth || Math.round((boxWidthPct / 100) * sw);
  const displayCropH = targetHeight || Math.round((boxHeightPct / 100) * sh);

  return (
    <div
      data-veol-viewport
      onPointerDown={handlePanPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      className={`drag-handle relative min-h-[380px] sm:min-h-[460px] md:min-h-[520px] bg-stone-950 flex items-center justify-center overflow-hidden border-b border-stone-200 p-4 sm:p-6 select-none ${
        dragMode === 'pan' ? 'dragging' : ''
      }`}
    >
      {/* Wrapper matching exact aspect ratio of the source image */}
      <div
        ref={imgContainerRef}
        className="relative inline-flex max-h-full max-w-full overflow-hidden rounded-xl shadow-2xl"
      >
        {/* Full Source Image */}
        <img
          src={item.originalUrl}
          alt={item.file.name}
          draggable={false}
          style={{
            transform: `rotate(${rotateDeg}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
          }}
          className="max-h-[340px] sm:max-h-[420px] md:max-h-[480px] w-auto h-auto object-contain block select-none pointer-events-none transition-transform duration-150"
        />

        {/* Bright Crop Frame with Darkened Surroundings (box-shadow 9999px) */}
        <div
          style={{
            left: `${boxLeftPct}%`,
            top: `${boxTopPct}%`,
            width: `${boxWidthPct}%`,
            height: `${boxHeightPct}%`,
          }}
          className={`absolute pointer-events-none shadow-[0_0_0_9999px_rgba(12,10,9,0.68)] transition-colors ${
            isDragging
              ? 'border-2 border-orange-400 ring-2 ring-orange-500/40'
              : 'border-2 border-white/95 hover:border-orange-400'
          }`}
        >
          {/* Rule-of-thirds subtle grid lines inside the frame while dragging */}
          <div
            className={`absolute inset-0 grid grid-cols-3 grid-rows-3 transition-opacity duration-150 ${
              isDragging ? 'opacity-65' : 'opacity-25'
            }`}
          >
            <div className="border-r border-b border-white/40" />
            <div className="border-r border-b border-white/40" />
            <div className="border-b border-white/40" />
            <div className="border-r border-b border-white/40" />
            <div className="border-r border-b border-white/40" />
            <div className="border-b border-white/40" />
            <div className="border-r border-white/40" />
            <div className="border-r border-white/40" />
            <div />
          </div>

          {/* Interactive Corner Handles for Zoom In / Out */}
          <div
            data-handle="nw"
            onPointerDown={(e) => handleCornerPointerDown(e, 'nw')}
            title="Tirer ce coin pour redimensionner le cadre"
            className="pointer-events-auto absolute -top-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize group/h"
          >
            <span className="w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded shadow-md group-hover/h:scale-125 transition-transform" />
          </div>

          <div
            data-handle="ne"
            onPointerDown={(e) => handleCornerPointerDown(e, 'ne')}
            title="Tirer ce coin pour redimensionner le cadre"
            className="pointer-events-auto absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize group/h"
          >
            <span className="w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded shadow-md group-hover/h:scale-125 transition-transform" />
          </div>

          <div
            data-handle="sw"
            onPointerDown={(e) => handleCornerPointerDown(e, 'sw')}
            title="Tirer ce coin pour redimensionner le cadre"
            className="pointer-events-auto absolute -bottom-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize group/h"
          >
            <span className="w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded shadow-md group-hover/h:scale-125 transition-transform" />
          </div>

          <div
            data-handle="se"
            onPointerDown={(e) => handleCornerPointerDown(e, 'se')}
            title="Tirer ce coin pour redimensionner le cadre"
            className="pointer-events-auto absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize group/h"
          >
            <span className="w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded shadow-md group-hover/h:scale-125 transition-transform" />
          </div>

          {/* Dimension Pill inside frame */}
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-stone-950/85 text-white font-mono text-[10px] font-bold tracking-tight shadow border border-white/10">
            {displayCropW}×{displayCropH} {!isFreeform && zoom > 1.02 ? `(${zoom.toFixed(1)}×)` : ''}
          </span>
        </div>
      </div>

      {/* Bottom Interactive Controls Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg backdrop-blur font-mono text-[11px] font-medium transition ${
            isDragging
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-stone-900/85 text-stone-200 border border-white/10'
          }`}
        >
          <Move className="w-3 h-3" />
          {dragMode === 'pan'
            ? 'Déplacement...'
            : dragMode !== 'none'
            ? `Cadrage (${zoom.toFixed(1)}×)...`
            : 'Glisser • Coins • Molette'}
        </span>

        <div className="flex items-center gap-1 pointer-events-auto">
          {(zoom > 1.01 || panX !== 0.5 || panY !== 0.5 || item.customCrop) && (
            <button
              type="button"
              onClick={handleDoubleClick}
              className="p-1.5 rounded-lg bg-stone-900/85 hover:bg-stone-800 text-white border border-white/15 shadow-sm transition"
              title="Réinitialiser le cadre (ou double-clic)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleZoomStep(-0.2)}
            disabled={!isFreeform && zoom <= 1}
            className="p-1.5 rounded-lg bg-stone-900/85 hover:bg-stone-800 disabled:opacity-40 text-white border border-white/15 shadow-sm transition"
            title="Agrandir la zone cadrée (Dézoomer)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoomStep(0.2)}
            disabled={!isFreeform && zoom >= 4}
            className="p-1.5 rounded-lg bg-stone-900/85 hover:bg-stone-800 disabled:opacity-40 text-white border border-white/15 shadow-sm transition"
            title="Rétrécir la zone cadrée (Zoomer)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenInspector}
            className="p-1.5 rounded-lg bg-stone-900/85 hover:bg-stone-800 text-white border border-white/15 shadow-sm transition"
            title="Voir le rendu final Avant/Après"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
