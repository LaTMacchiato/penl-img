import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ImageItem, ToolId } from '../types';
import { INTERNAL_TOOLS } from '../data/tools';
import { enforce72DpiOnPngBlob, finalizeJpegBlob } from '../utils/exifAndDpi';
import JSZip from 'jszip';
import {
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Download,
  Move,
  Maximize2,
  ShieldCheck,
  Palette,
  Copy,
  Check,
  Archive,
  ArrowRightCircle,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';

export type DeviceType = 'laptop' | 'browser' | 'tablet' | 'smartphone';
export type FitMode = 'contain' | 'cover';
export type MockupFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface MockupStudioProps {
  items: ImageItem[];
  onChainFiles?: (files: { file: File; relativePath: string }[], targetTool: ToolId) => Promise<void>;
  onNotify?: (kind: 'success' | 'info' | 'warning' | 'error', message: string) => void;
}

export const MockupStudio: React.FC<MockupStudioProps> = ({ items, onChainFiles, onNotify }) => {
  const [device, setDevice] = useState<DeviceType>('laptop');
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [screenBg, setScreenBg] = useState<string>('#FFFFFF');
  const [showShadow, setShowShadow] = useState(true);
  const [browserTheme, setBrowserTheme] = useState<'light' | 'dark'>('light');
  const [browserUrl, setBrowserUrl] = useState('https://penlimg.thmarchand.fr');
  const [exportFormat, setExportFormat] = useState<MockupFormat>('image/png');
  const [panX, setPanX] = useState(50);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [batchLabel, setBatchLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [showChainMenu, setShowChainMenu] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const safeIndex = Math.min(activeItemIndex, Math.max(0, items.length - 1));
  const activeItem = items[safeIndex] || null;

  const bgPresets = [
    { label: 'Transparent (PNG)', value: 'transparent' },
    { label: 'Beige Penl', value: '#FAF8F5' },
    { label: 'Blanc Pur', value: '#FFFFFF' },
    { label: 'Gris Studio', value: '#E5E5E5' },
    { label: 'Gris Sombre', value: '#1C1917' },
    { label: 'Dégradé Ciel', value: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)' },
    { label: 'Dégradé Crépuscule', value: 'linear-gradient(135deg, #ffedd5 0%, #fee2e2 100%)' },
  ];

  const screenBgPresets = [
    { label: 'Blanc', value: '#FFFFFF' },
    { label: 'Noir Écran', value: '#0c0a09' },
    { label: 'Beige Penl', value: '#FAF8F5' },
    { label: 'Gris Clair', value: '#E5E5E5' },
    { label: 'Flou immersif', value: 'blur' },
  ];

  const getActiveScreenDims = useCallback((): { sw: number; sh: number } => {
    switch (device) {
      case 'laptop':
        return { sw: 1920 - 60, sh: 1200 - 60 };
      case 'browser':
        return { sw: 2040, sh: 1320 - 76 };
      case 'tablet':
        return { sw: 1720 - 68, sh: 1260 - 68 };
      case 'smartphone':
        return { sw: 700 - 44, sh: 1480 - 44 };
    }
  }, [device]);

  const renderCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      img: HTMLImageElement | null,
      forceOpaqueBg = false
    ) => {
      canvas.width = 2400;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;

      // 1. External background
      if (bgColor === 'transparent' && !forceOpaqueBg) {
        ctx.clearRect(0, 0, 2400, 1600);
      } else if (bgColor === 'transparent' && forceOpaqueBg) {
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, 2400, 1600);
      } else if (bgColor.startsWith('linear-gradient')) {
        const grad = ctx.createLinearGradient(0, 0, 2400, 1600);
        if (bgColor.includes('#e0f2fe')) {
          grad.addColorStop(0, '#e0f2fe');
          grad.addColorStop(1, '#f0fdf4');
        } else {
          grad.addColorStop(0, '#ffedd5');
          grad.addColorStop(1, '#fee2e2');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 2400, 1600);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 2400, 1600);
      }

      if (!img) return;
      const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);

      const drawScreenContent = (sx: number, sy: number, sw: number, sh: number) => {
        if (fitMode === 'contain' && screenBg === 'blur') {
          ctx.fillStyle = '#0c0a09';
          ctx.fillRect(sx, sy, sw, sh);
          ctx.save();
          ctx.filter = 'blur(45px) brightness(0.9)';
          ctx.drawImage(img, sx - 60, sy - 60, sw + 120, sh + 120);
          ctx.restore();
        } else {
          ctx.fillStyle = fitMode === 'contain' ? screenBg : '#0c0a09';
          ctx.fillRect(sx, sy, sw, sh);
        }

        const screenAspect = sw / sh;
        let drawW: number;
        let drawH: number;
        let drawX: number;
        let drawY: number;

        if (fitMode === 'contain') {
          if (imgAspect > screenAspect) {
            drawW = sw;
            drawH = sw / imgAspect;
          } else {
            drawH = sh;
            drawW = sh * imgAspect;
          }
          drawX = sx + (sw - drawW) / 2;
          drawY = sy + (sh - drawH) / 2;

          if (screenBg === 'blur') {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
            ctx.shadowBlur = 28;
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();
            return;
          }
        } else {
          if (imgAspect > screenAspect) {
            drawH = sh;
            drawW = sh * imgAspect;
          } else {
            drawW = sw;
            drawH = sw / imgAspect;
          }
          drawX = sx - (drawW - sw) * (panX / 100);
          drawY = sy - (drawH - sh) * (panY / 100);
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      };

      if (device === 'laptop') {
        const lw = 1920;
        const lh = 1200;
        const lx = (2400 - lw) / 2;
        const ly = (1600 - lh) / 2 - 16;

        const baseW = Math.round(lw * 1.12);
        const baseX = (2400 - baseW) / 2;
        const baseY = ly + lh;
        const baseH = 26;

        if (showShadow) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 55;
          ctx.shadowOffsetY = 24;
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.roundRect(lx, ly, lw, lh, [22, 22, 0, 0]);
          ctx.roundRect(baseX, baseY, baseW, baseH, [2, 2, 14, 14]);
          ctx.fill();
          ctx.restore();
        }

        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, [22, 22, 2, 2]);
        ctx.fill();
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#383533';
        ctx.beginPath();
        ctx.arc(lx + lw / 2, ly + 15, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#171717';
        ctx.beginPath();
        ctx.arc(lx + lw / 2, ly + 15, 2, 0, Math.PI * 2);
        ctx.fill();

        const bezel = 30;
        const sx = lx + bezel;
        const sy = ly + bezel;
        const sw = lw - bezel * 2;
        const sh = lh - bezel * 2;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 5);
        ctx.clip();
        drawScreenContent(sx, sy, sw, sh);
        ctx.restore();

        ctx.fillStyle = '#1c1917';
        ctx.fillRect(lx + 140, baseY - 2, lw - 280, 3);

        ctx.beginPath();
        ctx.roundRect(baseX, baseY, baseW, baseH, [2, 2, 14, 14]);
        const baseGrad = ctx.createLinearGradient(baseX, baseY, baseX, baseY + baseH);
        baseGrad.addColorStop(0, '#f4f4f5');
        baseGrad.addColorStop(0.12, '#e4e4e7');
        baseGrad.addColorStop(0.7, '#d4d4d8');
        baseGrad.addColorStop(1, '#a1a1aa');
        ctx.fillStyle = baseGrad;
        ctx.fill();
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 1;
        ctx.stroke();

        const notchW = 170;
        const notchH = 7;
        const notchX = (2400 - notchW) / 2;
        ctx.beginPath();
        ctx.roundRect(notchX, baseY, notchW, notchH, [0, 0, 6, 6]);
        ctx.fillStyle = '#71717a';
        ctx.fill();
        ctx.fillStyle = '#52525b';
        ctx.fillRect(notchX + 6, baseY, notchW - 12, 1.5);
      } else if (device === 'browser') {
        const bw = 2040;
        const bh = 1320;
        const bx = (2400 - bw) / 2;
        const by = (1600 - bh) / 2;
        const headerH = 76;
        const isDark = browserTheme === 'dark';

        if (showShadow) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
          ctx.shadowBlur = 65;
          ctx.shadowOffsetY = 28;
          ctx.fillStyle = isDark ? '#1c1917' : '#ffffff';
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 26);
          ctx.fill();
          ctx.restore();
        }

        // Window body clip
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 26);
        ctx.clip();

        // Top toolbar
        ctx.fillStyle = isDark ? '#262422' : '#f5f4f1';
        ctx.fillRect(bx, by, bw, headerH);

        // Traffic lights (macOS)
        const dotY = by + headerH / 2;
        const dots = [
          { x: bx + 38, color: '#ff5f57' },
          { x: bx + 68, color: '#febc2e' },
          { x: bx + 98, color: '#28c840' },
        ];
        dots.forEach((d) => {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(d.x, dotY, 9.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Address bar pill
        const barW = Math.min(920, bw * 0.46);
        const barH = 42;
        const barX = bx + (bw - barW) / 2;
        const barY = by + (headerH - barH) / 2;
        ctx.fillStyle = isDark ? '#1c1917' : '#ffffff';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 12);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#3f3b37' : '#e5e2dc';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // URL text
        ctx.fillStyle = isDark ? '#a8a29e' : '#57534e';
        ctx.font = '500 21px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cleanUrl = (browserUrl || '').trim() || 'penlimg.thmarchand.fr';
        ctx.fillText(cleanUrl.slice(0, 52), barX + barW / 2, barY + barH / 2 + 1);

        // Separator line
        ctx.fillStyle = isDark ? '#3f3b37' : '#e7e5e4';
        ctx.fillRect(bx, by + headerH - 1.5, bw, 1.5);

        // Webpage content area
        drawScreenContent(bx, by + headerH, bw, bh - headerH);

        ctx.restore();

        // Crisp outer window border
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(28,25,23,0.14)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 26);
        ctx.stroke();
      } else if (device === 'tablet') {
        const tw = 1720;
        const th = 1260;
        const tx = (2400 - tw) / 2;
        const ty = (1600 - th) / 2;

        if (showShadow) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
          ctx.shadowBlur = 58;
          ctx.shadowOffsetY = 24;
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.roundRect(tx, ty, tw, th, 46);
          ctx.fill();
          ctx.restore();
        }

        // Aluminum rim
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.roundRect(tx - 4, ty - 4, tw + 8, th + 8, 50);
        ctx.fill();

        // Glass bezel
        ctx.fillStyle = '#141210';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 46);
        ctx.fill();

        // Front camera centered top landscape bezel
        ctx.fillStyle = '#2f2c2a';
        ctx.beginPath();
        ctx.arc(tx + tw / 2, ty + 17, 5, 0, Math.PI * 2);
        ctx.fill();

        const bezel = 34;
        const sx = tx + bezel;
        const sy = ty + bezel;
        const sw = tw - bezel * 2;
        const sh = th - bezel * 2;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 20);
        ctx.clip();
        drawScreenContent(sx, sy, sw, sh);
        ctx.restore();
      } else {
        // Smartphone
        const pw = 700;
        const ph = 1480;
        const px = (2400 - pw) / 2;
        const py = (1600 - ph) / 2;

        if (showShadow) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 60;
          ctx.shadowOffsetY = 28;
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.roundRect(px, py, pw, ph, 68);
          ctx.fill();
          ctx.restore();
        }

        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 68);
        ctx.fill();
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const sx = px + 22;
        const sy = py + 22;
        const sw = pw - 44;
        const sh = ph - 44;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 50);
        ctx.clip();
        drawScreenContent(sx, sy, sw, sh);

        const islandW = 160;
        const islandH = 36;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(sx + (sw - islandW) / 2, sy + 20, islandW, islandH, 18);
        ctx.fill();

        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(sx + (sw - islandW) / 2 + islandW - 26, sy + 20 + islandH / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    [bgColor, browserTheme, browserUrl, device, fitMode, panX, panY, screenBg, showShadow]
  );

  useEffect(() => {
    if (!activeItem) return;

    const updatePreview = (img: HTMLImageElement) => {
      if (previewCanvasRef.current) {
        renderCanvas(previewCanvasRef.current, img, exportFormat === 'image/jpeg');
      }
    };

    if (loadedImageRef.current && loadedImageRef.current.url === activeItem.originalUrl) {
      updatePreview(loadedImageRef.current.img);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImageRef.current = { url: activeItem.originalUrl, img };
        updatePreview(img);
      };
      img.src = activeItem.originalUrl;
    }
  }, [activeItem, renderCanvas, exportFormat]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fitMode !== 'cover') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current || !previewCanvasRef.current || !loadedImageRef.current) {
      return;
    }

    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = 2400 / rect.width;
    const scaleY = 1600 / rect.height;

    const dxCanvas = (e.clientX - dragStartRef.current.clientX) * scaleX;
    const dyCanvas = (e.clientY - dragStartRef.current.clientY) * scaleY;

    const img = loadedImageRef.current.img;
    const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const { sw, sh } = getActiveScreenDims();
    const screenAspect = sw / sh;

    let drawW: number;
    let drawH: number;
    if (imgAspect > screenAspect) {
      drawH = sh;
      drawW = sh * imgAspect;
    } else {
      drawW = sw;
      drawH = sw / imgAspect;
    }

    const overflowX = Math.max(0, drawW - sw);
    const overflowY = Math.max(0, drawH - sh);

    if (overflowX > 0) {
      const nextPanX = Math.max(
        0,
        Math.min(100, dragStartRef.current.startPanX - (dxCanvas / overflowX) * 100)
      );
      setPanX(nextPanX);
    }

    if (overflowY > 0) {
      const nextPanY = Math.max(
        0,
        Math.min(100, dragStartRef.current.startPanY - (dyCanvas / overflowY) * 100)
      );
      setPanY(nextPanY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  const renderItemToBlob = async (
    item: ImageItem,
    target: 'hd' | 'veol',
    mime: MockupFormat
  ): Promise<{ blob: Blob; filename: string }> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = item.originalUrl;
    });

    const masterCanvas = document.createElement('canvas');
    renderCanvas(masterCanvas, img, mime === 'image/jpeg');

    let outCanvas = masterCanvas;
    if (target === 'veol') {
      const veolW = 1280;
      const veolH = Math.round((1280 * 1600) / 2400);
      const vCanvas = document.createElement('canvas');
      vCanvas.width = veolW;
      vCanvas.height = veolH;
      const vCtx = vCanvas.getContext('2d')!;
      vCtx.imageSmoothingEnabled = true;
      vCtx.imageSmoothingQuality = 'high';
      vCtx.drawImage(masterCanvas, 0, 0, veolW, veolH);
      outCanvas = vCanvas;
    }

    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Échec génération mockup'))),
        mime,
        mime === 'image/png' ? undefined : 0.92
      );
    });

    let finalBlob = rawBlob;
    if (target === 'veol') {
      if (mime === 'image/png') {
        finalBlob = await enforce72DpiOnPngBlob(rawBlob);
      } else if (mime === 'image/jpeg') {
        finalBlob = await finalizeJpegBlob(rawBlob, item.file, true, true);
      }
    }

    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const baseName = item.file.name.replace(/\.[^.]+$/, '');
    const filename =
      target === 'veol'
        ? `mockup_veol_${device}_${baseName}.${ext}`
        : `mockup_hd_${device}_${baseName}.${ext}`;

    return { blob: finalBlob, filename };
  };

  const handleDownload = async (target: 'hd' | 'veol') => {
    if (!activeItem || isDownloading) return;
    setIsDownloading(true);
    try {
      const { blob, filename } = await renderItemToBlob(activeItem, target, exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onNotify?.('success', `Mockup exporté (${filename}).`);
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Erreur lors de l’export du mockup');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadZipAll = async (target: 'hd' | 'veol') => {
    if (items.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < items.length; i++) {
        setBatchLabel(`${i + 1}/${items.length}`);
        const { blob, filename } = await renderItemToBlob(items[i], target, exportFormat);
        zip.file(filename, blob);
      }
      setBatchLabel('ZIP…');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `penl_img_mockups_${device}_${items.length}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onNotify?.('success', `${items.length} mockups exportés dans une archive ZIP.`);
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Erreur lors de la création du ZIP');
    } finally {
      setIsDownloading(false);
      setBatchLabel('');
    }
  };

  const handleCopyClipboard = async () => {
    if (!previewCanvasRef.current) return;
    try {
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        previewCanvasRef.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Impossible de générer le PNG'))),
          'image/png'
        );
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      onNotify?.('error', 'Impossible de copier dans le presse-papier : ' + (err?.message || err));
    }
  };

  const handleChain = async (targetTool: ToolId) => {
    if (!onChainFiles) return;
    setShowChainMenu(false);
    setIsDownloading(true);
    try {
      const outFiles: { file: File; relativePath: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const { blob, filename } = await renderItemToBlob(items[i], 'hd', exportFormat);
        outFiles.push({
          file: new File([blob], filename, { type: blob.type }),
          relativePath: filename,
        });
      }
      await onChainFiles(outFiles, targetTool);
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Erreur lors du transfert vers le nouvel outil');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!activeItem) {
    return (
      <div className="p-8 text-center text-stone-500 font-mono text-xs">
        Veuillez charger au moins une capture d’écran pour générer un mockup.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Main Studio Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-tactile space-y-3.5">
        {/* Row 1: Device Selector + Fit Mode + Browser Options */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 4 Devices */}
            <div className="inline-flex flex-wrap rounded-xl bg-stone-100 p-1 border border-stone-200">
              {[
                { id: 'laptop' as DeviceType, label: 'PC Portable', icon: <Laptop className="w-3.5 h-3.5" /> },
                { id: 'browser' as DeviceType, label: 'Navigateur', icon: <Globe className="w-3.5 h-3.5" /> },
                { id: 'tablet' as DeviceType, label: 'Tablette', icon: <Tablet className="w-3.5 h-3.5" /> },
                { id: 'smartphone' as DeviceType, label: 'Smartphone', icon: <Smartphone className="w-3.5 h-3.5" /> },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDevice(d.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    device === d.id
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {d.icon}
                  {d.label}
                </button>
              ))}
            </div>

            {/* Fit Mode */}
            <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200">
              <button
                type="button"
                onClick={() => setFitMode('cover')}
                title="Remplir l'écran et glisser l'image directement à la souris"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  fitMode === 'cover'
                    ? 'bg-white text-stone-900 shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                Remplir
              </button>
              <button
                type="button"
                onClick={() => setFitMode('contain')}
                title="Afficher la capture entière sans coupure"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  fitMode === 'contain'
                    ? 'bg-white text-stone-900 shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Ajuster entier
              </button>
            </div>

            {/* Browser URL & Theme (only when Browser frame is active) */}
            {device === 'browser' && (
              <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-stone-200">
                <input
                  type="text"
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  placeholder="https://mon-outil.fr"
                  aria-label="URL affichée dans la fenêtre navigateur"
                  className="w-48 rounded-xl bg-[#FAF8F5] border border-stone-300 px-2.5 py-1.5 font-mono text-xs text-stone-800 focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBrowserTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                  title="Basculer le thème de la barre navigateur"
                >
                  {browserTheme === 'light' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500" /> Clair
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-500" /> Sombre
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Toggle Shadow */}
          <button
            type="button"
            onClick={() => setShowShadow(!showShadow)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              showShadow
                ? 'bg-stone-100 text-stone-800 border-stone-300 font-semibold'
                : 'text-stone-400 border-dashed border-stone-300 hover:text-stone-600'
            }`}
          >
            Ombre {showShadow ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Row 2: Backgrounds + Format + Export Actions */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Internal Screen BG (when contain) */}
            {fitMode === 'contain' && (
              <div className="flex items-center gap-1.5 pr-3 border-r border-stone-200">
                <span className="text-xs text-stone-500 font-medium">Fond écran :</span>
                {screenBgPresets.map((preset) => {
                  const isSelected = screenBg === preset.value;
                  const isBlur = preset.value === 'blur';
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setScreenBg(preset.value)}
                      style={isBlur ? undefined : { background: preset.value }}
                      title={`Fond d'écran interne : ${preset.label}`}
                      className={`h-6 rounded-full border shadow-sm transition-all relative cursor-pointer flex items-center justify-center ${
                        isBlur
                          ? 'px-2 bg-gradient-to-r from-indigo-500/20 via-orange-400/20 to-pink-500/20 text-[10px] font-semibold text-stone-700'
                          : 'w-6'
                      } ${
                        isSelected
                          ? 'scale-110 ring-2 ring-orange-500 ring-offset-1 border-white z-10'
                          : 'hover:scale-105 border-stone-300'
                      }`}
                    >
                      {isBlur ? 'Flou' : null}
                    </button>
                  );
                })}
                <label
                  title="Couleur personnalisée pour le fond d'écran"
                  className="w-6 h-6 rounded-full border border-stone-300 bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition shadow-sm overflow-hidden"
                >
                  <Palette className="w-3.5 h-3.5 text-stone-600 pointer-events-none" />
                  <input
                    type="color"
                    value={screenBg.startsWith('#') ? screenBg : '#ffffff'}
                    onChange={(e) => setScreenBg(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            {/* External Background */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-500 font-medium">Fond :</span>
              {bgPresets.map((bg) => {
                const isSelected = bgColor === bg.value;
                const isTransparent = bg.value === 'transparent';
                return (
                  <button
                    key={bg.label}
                    type="button"
                    onClick={() => {
                      setBgColor(bg.value);
                      if (isTransparent && exportFormat === 'image/jpeg') {
                        setExportFormat('image/png');
                      }
                    }}
                    style={isTransparent ? undefined : { background: bg.value }}
                    title={bg.label}
                    className={`w-6 h-6 rounded-full border shadow-sm transition-all relative cursor-pointer ${
                      isTransparent ? 'bg-checkerboard-light' : ''
                    } ${
                      isSelected
                        ? 'scale-125 ring-2 ring-orange-500 ring-offset-1 border-white z-10'
                        : 'hover:scale-110 border-stone-300'
                    }`}
                  />
                );
              })}
            </div>

            {/* Format */}
            <div className="flex items-center gap-1 pl-3 border-l border-stone-200 text-xs">
              <span className="font-mono font-semibold text-stone-500 mr-1">FORMAT :</span>
              {[
                { id: 'image/png' as MockupFormat, label: 'PNG' },
                { id: 'image/jpeg' as MockupFormat, label: 'JPG' },
                { id: 'image/webp' as MockupFormat, label: 'WebP' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setExportFormat(f.id)}
                  className={`px-2 py-1 rounded-lg font-medium border transition cursor-pointer ${
                    exportFormat === f.id
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onChainFiles && (
              <div className="relative">
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={() => setShowChainMenu((s) => !s)}
                  className="px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5 text-orange-600" />
                  Continuer dans…
                </button>
                {showChainMenu && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-30">
                    {INTERNAL_TOOLS.filter((t) => t.id !== 'mockup').map((t) => (
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
            )}

            <button
              type="button"
              onClick={handleCopyClipboard}
              className="px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Copier le mockup actuel dans le presse-papier"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié' : 'Copier'}</span>
            </button>

            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleDownload('veol')}
              title="Export optimisé VEOL : 1280 px max, 72 ppp garanti"
              className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-tactile flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-orange-200" />
              )}
              <span>VEOL (1280px • 72 ppp)</span>
            </button>

            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleDownload('hd')}
              title="Export master haute résolution (2400 × 1600 px)"
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-tactile flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HD (2400px)</span>
            </button>

            {items.length > 1 && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => handleDownloadZipAll('hd')}
                title="Exporter toutes les captures en lot dans une archive ZIP"
                className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-semibold text-xs shadow-tactile flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{batchLabel ? `Export ${batchLabel}` : `Tout (.ZIP • ${items.length})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Retina Preview Canvas */}
      <div
        style={
          bgColor === 'transparent' || exportFormat === 'image/jpeg'
            ? exportFormat === 'image/jpeg' && bgColor === 'transparent'
              ? { background: '#FAF8F5' }
              : undefined
            : { background: bgColor }
        }
        className={`relative w-full rounded-3xl border border-stone-200/90 flex items-center justify-center p-2 sm:p-4 overflow-hidden shadow-inner ${
          bgColor === 'transparent' && exportFormat !== 'image/jpeg' ? 'bg-checkerboard-light' : ''
        }`}
      >
        <canvas
          ref={previewCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full max-w-5xl h-auto select-none touch-none ${
            fitMode === 'cover'
              ? isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-default'
          }`}
        />

        {fitMode === 'cover' && (
          <div className="absolute bottom-3 right-4 pointer-events-none bg-stone-900/75 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
            <Move className="w-3 h-3 text-orange-400" />
            <span>Glisser l’image pour ajuster le cadrage</span>
          </div>
        )}
      </div>

      {/* Multi-screenshot Selector Strip */}
      {items.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="font-mono text-xs text-stone-500 mr-2 shrink-0">
            Captures ({items.length}) :
          </span>
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setActiveItemIndex(idx)}
              className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                safeIndex === idx
                  ? 'border-orange-600 scale-105 shadow-sm'
                  : 'border-stone-200 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={it.originalUrl}
                alt={it.file.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
