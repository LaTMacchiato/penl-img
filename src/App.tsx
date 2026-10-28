import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ImageItem,
  PipelineConfig,
  OutputFormat,
  ResizeMode,
  CompressionMode,
  CropPreset,
  CustomCropBox,
} from './types';
import { extractFilesFromDataTransfer, formatBytes, isImageFile } from './utils/fileExtractor';
import { processSingleImage } from './utils/imageProcessor';
import { InspectorModal } from './components/InspectorModal';
import { VeolCropViewport } from './components/VeolCropViewport';
import JSZip from 'jszip';
import {
  Maximize2,
  RefreshCw,
  Eraser,
  Crop,
  FolderPen,
  ArrowLeft,
  ArrowRight,
  FolderUp,
  ImagePlus,
  Download,
  Trash2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Lock,
  CheckCircle2,
  Loader2,
  Eye,
  Archive,
  FolderCheck,
  Sparkles,
  ShieldCheck,
  Pipette,
  HardDriveDownload,
  Wand2,
  Cpu,
  Check,
  Copy,
  Move,
  ZoomIn,
  ZoomOut,
  LayoutTemplate,
  RectangleHorizontal,
  FileImage,
  Sliders,
} from 'lucide-react';

export type ToolId =
  | 'resize-compress'
  | 'convert'
  | 'remove-bg'
  | 'crop'
  | 'rename'
  | 'veol-thumb'
  | 'veol-banner'
  | 'veol-article';

interface ToolCardDef {
  id: ToolId;
  badge: string;
  title: string;
  subtitle: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  icon: React.ReactNode;
  featured?: boolean;
  compact?: boolean;
}

const MAIN_TOOLS: ToolCardDef[] = [
  {
    id: 'resize-compress',
    badge: '01 / DIMENSIONS & QUALITÉ',
    title: 'Redimensionner & Compresser',
    subtitle:
      'Définissez la largeur cible (ratio verrouillé) et le % de compression qualité directement au même endroit, ou fixez un poids cible en Ko.',
    accentBg: 'bg-orange-500/10',
    accentText: 'text-orange-600',
    accentBorder: 'group-hover:border-orange-500/60',
    icon: <Maximize2 className="w-5 h-5" />,
    featured: true,
  },
  {
    id: 'convert',
    badge: '02 / FORMATS',
    title: 'Convertir Format',
    subtitle: 'Transformez instantanément vos lots entre JPG, PNG, WebP et AVIF.',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-600',
    accentBorder: 'group-hover:border-blue-500/50',
    icon: <RefreshCw className="w-5 h-5" />,
  },
  {
    id: 'remove-bg',
    badge: '03 / DÉTOURAGE',
    title: 'Retirer le Fond (PNG)',
    subtitle: 'Effacez un fond uni à la baguette magique (pipette) ou détourez par IA 100% locale.',
    accentBg: 'bg-purple-500/10',
    accentText: 'text-purple-600',
    accentBorder: 'group-hover:border-purple-500/50',
    icon: <Eraser className="w-5 h-5" />,
  },
  {
    id: 'crop',
    badge: '04 / CADRAGE',
    title: 'Recadrer & Pivoter',
    subtitle: 'Appliquez un ratio carré 1:1, 16:9, 4:3, pivotez à 90° ou recadrez librement à la souris.',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-600',
    accentBorder: 'group-hover:border-amber-500/50',
    icon: <Crop className="w-5 h-5" />,
  },
  {
    id: 'rename',
    badge: '05 / ORGANISATION',
    title: 'Renommer un Dossier',
    subtitle: 'Renommage séquentiel (photo_001...), ajout de préfixe/suffixe pour tout un dossier.',
    accentBg: 'bg-rose-500/10',
    accentText: 'text-rose-600',
    accentBorder: 'group-hover:border-rose-500/50',
    icon: <FolderPen className="w-5 h-5" />,
  },
];

const VEOL_TOOLS: ToolCardDef[] = [
  {
    id: 'veol-thumb',
    badge: 'VEOL • 360×210 PX • 72 PPP',
    title: 'Miniature VEOL',
    subtitle: 'Crop auto 360×210 px, recadrage glisser-déposer direct et passage auto en 72 ppp.',
    accentBg: 'bg-teal-500/10',
    accentText: 'text-teal-700',
    accentBorder: 'group-hover:border-teal-500/60',
    icon: <LayoutTemplate className="w-4 h-4" />,
    compact: true,
  },
  {
    id: 'veol-banner',
    badge: 'VEOL • 964×140 PX • 72 PPP',
    title: 'Bannière VEOL',
    subtitle: 'Crop auto 964×140 px, ajustement horizontal/vertical direct et passage auto en 72 ppp.',
    accentBg: 'bg-indigo-500/10',
    accentText: 'text-indigo-700',
    accentBorder: 'group-hover:border-indigo-500/60',
    icon: <RectangleHorizontal className="w-4 h-4" />,
    compact: true,
  },
  {
    id: 'veol-article',
    badge: 'VEOL • MAX 1280 PX • 72 PPP',
    title: 'Image article VEOL',
    subtitle: 'Largeur max 1280 px (conserve si moins), sans crop, 72 ppp auto et traitement par lot.',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-700',
    accentBorder: 'group-hover:border-emerald-500/60',
    icon: <FileImage className="w-4 h-4" />,
    compact: true,
  },
];

const ALL_TOOLS: ToolCardDef[] = [...MAIN_TOOLS, ...VEOL_TOOLS];

function getDefaultConfigForTool(tool: ToolId): PipelineConfig {
  const base: PipelineConfig = {
    resizeMode: 'none',
    targetWidth: 1920,
    targetHeight: 1080,
    lockAspectRatio: true,
    scalePercentage: 50,
    maxSidePx: 1920,
    preventUpscale: true,

    outputFormat: 'image/jpeg',
    compressionMode: 'quality',
    quality: 85,
    targetFileSizeKb: 300,
    stripMetadata: false, // Par défaut, conserve les métadonnées EXIF
    enforceMax72Dpi: false,
    backgroundColorForJpeg: '#ffffff',

    cropPreset: 'none',
    rotateDeg: 0,
    flipH: false,
    flipV: false,

    bgRemoveMode: 'none',
    colorKeyHex: '#ffffff',
    colorTolerance: 18,
    featherEdge: true,
    contiguousFloodFill: true,

    renamePrefix: '',
    renameSuffix: '',
    renamePattern: 'keep',
    customBaseName: 'photo',
    preserveSubfolders: true,
  };

  switch (tool) {
    case 'resize-compress':
      return {
        ...base,
        resizeMode: 'width-only',
        targetWidth: 1920,
        lockAspectRatio: true,
        compressionMode: 'quality',
        quality: 85,
        outputFormat: 'image/jpeg',
        stripMetadata: false,
      };
    case 'veol-thumb':
      return {
        ...base,
        resizeMode: 'exact-crop',
        targetWidth: 360,
        targetHeight: 210,
        lockAspectRatio: true,
        outputFormat: 'image/jpeg',
        quality: 88,
        enforceMax72Dpi: true,
        stripMetadata: false,
        renameSuffix: '_miniature_360x210',
      };
    case 'veol-banner':
      return {
        ...base,
        resizeMode: 'exact-crop',
        targetWidth: 964,
        targetHeight: 140,
        lockAspectRatio: true,
        outputFormat: 'image/jpeg',
        quality: 88,
        enforceMax72Dpi: true,
        stripMetadata: false,
        renameSuffix: '_banniere_964x140',
      };
    case 'veol-article':
      return {
        ...base,
        resizeMode: 'width-only',
        targetWidth: 1280,
        lockAspectRatio: true,
        preventUpscale: true,
        cropPreset: 'none',
        outputFormat: 'image/jpeg',
        quality: 85,
        enforceMax72Dpi: true,
        stripMetadata: false,
        renameSuffix: '_article_1280',
      };
    case 'convert':
      return { ...base, outputFormat: 'image/jpeg', quality: 90 };
    case 'remove-bg':
      return { ...base, outputFormat: 'image/png', bgRemoveMode: 'color-key', colorTolerance: 20 };
    case 'crop':
      return { ...base, cropPreset: '1:1', outputFormat: 'image/jpeg', quality: 90 };
    case 'rename':
      return {
        ...base,
        outputFormat: 'original',
        renamePattern: 'sequential',
        customBaseName: 'image',
        quality: 92,
      };
  }
}

export function App() {
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [config, setConfig] = useState<PipelineConfig>(() =>
    getDefaultConfigForTool('resize-compress')
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    status: string;
  }>({
    current: 0,
    total: 0,
    status: '',
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // State for direct Pan & Zoom dragging on VEOL cards
  const [panDragState, setPanDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const purgeItemsFromMemory = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => {
        URL.revokeObjectURL(it.originalUrl);
        if (it.processedUrl) URL.revokeObjectURL(it.processedUrl);
      });
      return [];
    });
    setInspectedId(null);
  }, []);

  const selectTool = (toolId: ToolId | null) => {
    purgeItemsFromMemory();
    setSelectedTool(toolId);
    if (toolId) {
      setConfig(getDefaultConfigForTool(toolId));
    }
  };

  const updateConfig = useCallback((partial: Partial<PipelineConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateItem = useCallback((id: string, partial: Partial<ImageItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  }, []);

  const handleProcessSingle = useCallback(
    async (item: ImageItem, idx?: number, overrideConfig?: PipelineConfig) => {
      const activeCfg = overrideConfig || config;
      const index = idx !== undefined ? idx : items.findIndex((i) => i.id === item.id);
      updateItem(item.id, { status: 'processing', errorMsg: undefined });
      try {
        const res = await processSingleImage(item, index >= 0 ? index : 0, activeCfg, (msg) => {
          setBatchProgress((p) => ({ ...p, status: msg }));
        });
        if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
        const processedUrl = URL.createObjectURL(res.blob);
        updateItem(item.id, {
          status: 'done',
          processedBlob: res.blob,
          processedUrl,
          processedWidth: res.width,
          processedHeight: res.height,
          processedSize: res.blob.size,
          outputFileName: res.outputFileName,
        });
      } catch (err: any) {
        updateItem(item.id, {
          status: 'error',
          errorMsg: err?.message || 'Erreur de traitement',
        });
      }
    },
    [config, items, updateItem]
  );

  const ingestFiles = useCallback(
    async (extracted: { file: File; relativePath: string }[], autoOpenTool?: ToolId) => {
      if (extracted.length === 0) return;

      const targetTool = selectedTool || autoOpenTool || null;
      const activeCfg = targetTool ? getDefaultConfigForTool(targetTool) : config;

      const newItems: ImageItem[] = await Promise.all(
        extracted.map(async ({ file, relativePath }) => {
          const url = URL.createObjectURL(file);
          const dims = await getImageDimensions(url);
          return {
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            relativePath: relativePath || file.name,
            originalUrl: url,
            originalWidth: dims.width,
            originalHeight: dims.height,
            originalSize: file.size,
            panX: 0.5,
            panY: 0.5,
            zoom: 1,
            status: 'idle',
          };
        })
      );

      setItems((prev) => [...prev, ...newItems]);
      if (!selectedTool && autoOpenTool) {
        setSelectedTool(autoOpenTool);
        setConfig(activeCfg);
      }

      // If in VEOL mode, automatically process incoming images so user sees the 360x210 or 964x140 result right away
      if (targetTool === 'veol-thumb' || targetTool === 'veol-banner') {
        for (let i = 0; i < newItems.length; i++) {
          await handleProcessSingle(newItems[i], i, activeCfg);
        }
      }
    },
    [selectedTool, config, handleProcessSingle]
  );

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const list: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (isImageFile(f)) {
        const rel = (f as any).webkitRelativePath || f.name;
        list.push({ file: f, relativePath: rel });
      }
    }
    await ingestFiles(list);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.items) {
      const extracted = await extractFilesFromDataTransfer(e.dataTransfer.items);
      await ingestFiles(extracted, 'resize-compress');
    }
  };

  const clearAll = () => {
    purgeItemsFromMemory();
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.processedUrl) URL.revokeObjectURL(target.processedUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleProcessAll = async () => {
    if (items.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: items.length, status: 'Traitement...' });

    for (let i = 0; i < items.length; i++) {
      setBatchProgress({
        current: i + 1,
        total: items.length,
        status: `${i + 1}/${items.length} • ${items[i].file.name}`,
      });
      await handleProcessSingle(items[i], i);
    }

    setIsBatchProcessing(false);
    setBatchProgress({ current: items.length, total: items.length, status: 'Terminé' });
  };

  const handleCopyClipboard = async (item: ImageItem) => {
    const blob = item.processedBlob;
    if (!blob) return;
    try {
      // Clipboard API requires image/png in many browsers; convert on the fly if needed
      let pngBlob = blob;
      if (blob.type !== 'image/png') {
        const url = URL.createObjectURL(blob);
        const img = await loadImageElement(url);
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob>((res, rej) =>
          c.toBlob((b) => (b ? res(b) : rej(new Error('Clipboard PNG error'))), 'image/png')
        );
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2000);
    } catch (err: any) {
      alert('Impossible de copier dans le presse-papier : ' + (err?.message || err));
    }
  };

  const handleVeolDownload = async () => {
    if (items.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: items.length, status: 'Préparation...' });

    const outBlobs: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setBatchProgress({
        current: i + 1,
        total: items.length,
        status: `${i + 1}/${items.length} • ${it.file.name}`,
      });
      const res = await processSingleImage(it, i, config);
      if (it.processedUrl) URL.revokeObjectURL(it.processedUrl);
      const processedUrl = URL.createObjectURL(res.blob);
      updateItem(it.id, {
        status: 'done',
        processedBlob: res.blob,
        processedUrl,
        processedWidth: res.width,
        processedHeight: res.height,
        processedSize: res.blob.size,
        outputFileName: res.outputFileName,
      });
      outBlobs.push({ name: res.outputFileName, blob: res.blob });
    }

    setIsBatchProcessing(false);

    if (outBlobs.length === 1) {
      const url = URL.createObjectURL(outBlobs[0].blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outBlobs[0].name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else if (outBlobs.length > 1) {
      const zip = new JSZip();
      outBlobs.forEach((f) => zip.file(f.name, f.blob));
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `penl_img_${selectedTool}_${outBlobs.length}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  const handleDownloadZip = async () => {
    const processedItems = items.filter((it) => it.processedBlob);
    if (processedItems.length === 0) return;

    const zip = new JSZip();
    processedItems.forEach((it) => {
      const path = it.outputFileName || it.file.name;
      zip.file(path, it.processedBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `penl_img_${selectedTool || 'export'}_${processedItems.length}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleExportToLocalFolder = async () => {
    const processedItems = items.filter((it) => it.processedBlob);
    if (processedItems.length === 0) return;

    if (!('showDirectoryPicker' in window)) {
      alert("Votre navigateur ne supporte pas l'écriture directe. Utilisez le bouton ZIP.");
      return;
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      for (const it of processedItems) {
        const relPath = it.outputFileName || it.file.name;
        const segments = relPath.split('/').filter(Boolean);
        const fileName = segments.pop()!;

        let currentDir = dirHandle;
        for (const seg of segments) {
          currentDir = await currentDir.getDirectoryHandle(seg, { create: true });
        }

        const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(it.processedBlob!);
        await writable.close();
      }
      alert(`${processedItems.length} image(s) enregistrée(s) directement dans votre dossier.`);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert('Erreur : ' + (err?.message || err));
      }
    }
  };

  const handleVeolPanZoomChange = useCallback(
    async (item: ImageItem, idx: number, panX: number, panY: number, zoom: number, commit: boolean) => {
      const updatedItem: ImageItem = { ...item, panX, panY, zoom, customCrop: undefined };
      updateItem(item.id, { panX, panY, zoom, customCrop: undefined });
      if (commit) {
        await handleProcessSingle(updatedItem, idx);
      }
    },
    [updateItem, handleProcessSingle]
  );

  const handleCustomCropChange = useCallback(
    async (item: ImageItem, idx: number, customCrop: CustomCropBox | undefined, commit: boolean) => {
      const updatedItem: ImageItem = { ...item, customCrop };
      updateItem(item.id, { customCrop });
      if (commit) {
        await handleProcessSingle(updatedItem, idx);
      }
    },
    [updateItem, handleProcessSingle]
  );

  // Global Paste (Cmd+V / Ctrl+V) support to load image from clipboard anywhere
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const pastedFiles: { file: File; relativePath: string }[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const ci = clipboardItems[i];
        if (ci.type.startsWith('image/')) {
          const f = ci.getAsFile();
          if (f) {
            const ext = f.type.split('/')[1] || 'png';
            const namedFile = new File([f], `clipboard_${Date.now()}.${ext}`, { type: f.type });
            pastedFiles.push({ file: namedFile, relativePath: namedFile.name });
          }
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        await ingestFiles(pastedFiles, 'resize-compress');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [ingestFiles]);

  const isVeolTool = selectedTool === 'veol-thumb' || selectedTool === 'veol-banner';
  const hasInteractiveCropCard = isVeolTool || selectedTool === 'crop';
  const parsedCropAspectRatio: number | null =
    isVeolTool
      ? config.targetWidth / config.targetHeight
      : config.cropPreset !== 'none' && config.cropPreset !== 'custom'
      ? (() => {
          const [rw, rh] = config.cropPreset.split(':').map(Number);
          return rw / rh;
        })()
      : null;
  const activeToolMeta = ALL_TOOLS.find((t) => t.id === selectedTool) || null;
  const doneItems = items.filter((i) => i.status === 'done' && i.processedSize !== undefined);
  const totalOriginalOfDone = doneItems.reduce((acc, i) => acc + i.originalSize, 0);
  const totalProcessedBytes = doneItems.reduce((acc, i) => acc + (i.processedSize || 0), 0);
  const totalSavedPercent =
    totalOriginalOfDone > 0
      ? Math.round(((totalOriginalOfDone - totalProcessedBytes) / totalOriginalOfDone) * 100)
      : 0;

  const inspectedItem = items.find((i) => i.id === inspectedId) || null;

  const firstItem = items[0];
  const previewHeightForWidthOnly =
    firstItem && config.targetWidth
      ? Math.round((config.targetWidth * firstItem.originalHeight) / firstItem.originalWidth)
      : null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingOver(false);
      }}
      onDrop={handleDrop}
      className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900"
    >
      {/* Hidden File & Folder inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 border-b border-stone-200/90 bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => selectTool(null)}
              className="flex items-center gap-2.5 group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-tactile group-hover:bg-orange-600 transition-colors">
                P.
              </div>
              <div>
                <span className="font-display font-extrabold tracking-tight text-base text-stone-900">
                  Penl.img
                </span>
                <span className="hidden sm:inline-block ml-2 font-mono text-[11px] text-stone-500">
                  local
                </span>
              </div>
            </button>

            {selectedTool && (
              <div className="hidden lg:flex items-center gap-1 pl-3 border-l border-stone-300">
                {ALL_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTool(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      selectedTool === t.id
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                    }`}
                  >
                    {t.id === 'resize-compress'
                      ? 'Resize & Compresser'
                      : t.id === 'veol-thumb'
                      ? 'Miniature VEOL'
                      : t.id === 'veol-banner'
                      ? 'Bannière VEOL'
                      : t.id === 'veol-article'
                      ? 'Article VEOL'
                      : t.title.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {items.length > 0 && !selectedTool && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 font-medium">
                {items.length} fichier{items.length > 1 ? 's' : ''} chargé{items.length > 1 ? 's' : ''}
              </span>
            )}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-600/20 text-emerald-800 font-mono text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              100% LOCAL • ZERO UPLOAD
            </div>
          </div>
        </div>
      </header>

      {/* VIEW 1: GOAL-ORIENTED HOME HUB */}
      {!selectedTool ? (
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 md:py-14 flex flex-col justify-between">
          <div className="space-y-8">
            {/* Hero Header */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-orange-600 font-semibold mb-2.5">
                <span>[ PENL.IMG — SUITE IMAGE LOCALE ]</span>
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 leading-[1.12]">
                Quel résultat voulez-vous obtenir ?
              </h1>
              <p className="text-stone-600 text-base mt-2.5 leading-relaxed">
                Sélectionnez un outil ou glissez directement un dossier d'images. Aucune donnée ne quitte votre navigateur.
              </p>
            </div>

            {/* VEOL Quick Format Tiles (3 compact tiles) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Formats rapides VEOL (72 ppp auto)
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {VEOL_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectTool(tool.id)}
                    className={`group text-left bg-white rounded-2xl p-4 px-5 border border-stone-200/90 ${tool.accentBorder} shadow-tactile hover:shadow-tactile-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-4`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl ${tool.accentBg} ${tool.accentText} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                      >
                        {tool.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-display text-base font-bold text-stone-900 group-hover:text-orange-600 transition-colors">
                            {tool.title}
                          </h2>
                          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                            {tool.badge}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 truncate">{tool.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Main Bento Grid of Goal Cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Outils standards & traitement par lot
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MAIN_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectTool(tool.id)}
                    className={`group text-left bg-white rounded-2xl p-6 border border-stone-200/90 ${
                      tool.accentBorder
                    } shadow-tactile hover:shadow-tactile-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between min-h-[185px] ${
                      tool.featured
                        ? 'sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-white to-orange-50/40'
                        : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="font-mono text-[11px] font-semibold tracking-wider text-stone-400">
                          {tool.badge}
                        </span>
                        <div
                          className={`w-10 h-10 rounded-xl ${tool.accentBg} ${tool.accentText} flex items-center justify-center transition-transform group-hover:scale-110`}
                        >
                          {tool.icon}
                        </div>
                      </div>

                      <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 group-hover:text-orange-600 transition-colors">
                        {tool.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-stone-500 mt-1.5 leading-relaxed max-w-xl">
                        {tool.subtitle}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-stone-800">
                      <span>Ouvrir l'outil</span>
                      <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <footer className="mt-14 pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500 font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Penl.img • Exécution 100% navigateur • EXIF préservés par défaut • Dossiers complets</span>
            </div>
            <div>JPG • PNG • WEBP • AVIF</div>
          </footer>
        </main>
      ) : (
        /* VIEW 2: FOCUSED SINGLE-RESULT WORKSPACE */
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
          {/* Top Breadcrumb + Tool Title */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => selectTool(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 shadow-tactile transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tous les outils
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl font-extrabold text-stone-900">
                    {activeToolMeta?.title}
                  </h1>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-600">
                    {activeToolMeta?.badge}
                  </span>
                </div>
              </div>
            </div>

            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 flex items-center gap-1.5"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Ajouter Images
                </button>
                {!isVeolTool && (
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 flex items-center gap-1.5"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    Ajouter Dossier
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1.5 rounded-xl bg-white border border-stone-200 hover:bg-rose-50 hover:border-rose-200 text-stone-400 hover:text-rose-600 transition"
                  title="Tout effacer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* FOCUSED COMMAND BAR */}
          <section className="bg-white rounded-2xl border border-stone-200/90 shadow-tactile p-5">
            {/* 1. UNIFIED RESIZE & COMPRESS WORKSPACE (Dimensions + Quality % integrated together) */}
            {selectedTool === 'resize-compress' && (
              <div className="space-y-5">
                <div className="rounded-xl bg-[#FAF8F5] border border-stone-200/90 p-5 space-y-5">
                  {/* Top Row: Mode selector + Ratio Lock badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-500 mr-2 flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-orange-600" />
                        Dimensions :
                      </span>
                      {[
                        { id: 'width-only', label: 'Largeur cible (px)' },
                        { id: 'max-side', label: 'Bord max (px)' },
                        { id: 'percentage', label: 'Échelle (%)' },
                        { id: 'none', label: 'Taille originale' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateConfig({ resizeMode: m.id as ResizeMode })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            config.resizeMode === m.id
                              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-800 font-semibold">
                      <Lock className="w-3 h-3" /> Ratio garanti
                    </span>
                  </div>

                  {/* Middle Row: Dimensions input + Integrated Quality % slider side-by-side */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-stone-200/70 items-center">
                    {/* Dimensions Control (7 cols) */}
                    <div className="lg:col-span-7 space-y-2.5">
                      {config.resizeMode === 'width-only' && (
                        <>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <label className="text-xs font-semibold text-stone-700">
                              Largeur cible :
                            </label>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min={16}
                                max={16000}
                                value={config.targetWidth || ''}
                                onChange={(e) =>
                                  updateConfig({
                                    targetWidth: Math.max(1, Number(e.target.value)),
                                    lockAspectRatio: true,
                                  })
                                }
                                className="w-28 rounded-xl bg-white border border-stone-300 px-3 py-1.5 font-mono text-sm font-bold text-stone-900 focus:border-orange-500 focus:outline-none"
                              />
                              <span className="ml-1.5 font-mono text-xs text-stone-500">px</span>
                            </div>

                            <span className="font-mono text-[11px] text-stone-500 bg-stone-200/70 px-2.5 py-1 rounded-lg">
                              Hauteur : Auto{' '}
                              {previewHeightForWidthOnly ? `(${previewHeightForWidthOnly}px)` : ''}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {[600, 800, 1080, 1280, 1920, 2560].map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() =>
                                  updateConfig({ targetWidth: w, lockAspectRatio: true })
                                }
                                className={`font-mono text-[11px] px-2.5 py-1 rounded-md border transition ${
                                  config.targetWidth === w
                                    ? 'bg-orange-500/15 border-orange-500 text-orange-800 font-bold'
                                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                                }`}
                              >
                                {w}px
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {config.resizeMode === 'max-side' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-700">
                              Côté le plus long :
                            </span>
                            <input
                              type="number"
                              value={config.maxSidePx}
                              onChange={(e) => updateConfig({ maxSidePx: Number(e.target.value) })}
                              className="w-28 rounded-xl bg-white border border-stone-300 px-3 py-1.5 font-mono text-sm font-bold"
                            />
                            <span className="font-mono text-xs text-stone-500">px</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[800, 1280, 1600, 1920, 2560].map((px) => (
                              <button
                                key={px}
                                type="button"
                                onClick={() => updateConfig({ maxSidePx: px })}
                                className={`font-mono text-[11px] px-2.5 py-1 rounded-md border ${
                                  config.maxSidePx === px
                                    ? 'bg-orange-500/15 border-orange-500 text-orange-800 font-bold'
                                    : 'bg-white border-stone-200 text-stone-600'
                                }`}
                              >
                                {px}px
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {config.resizeMode === 'percentage' && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-stone-700">Échelle :</span>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={config.scalePercentage}
                            onChange={(e) =>
                              updateConfig({ scalePercentage: Number(e.target.value) })
                            }
                            className="flex-1 accent-stone-900"
                          />
                          <span className="font-mono text-sm font-bold text-orange-600 w-12 text-right">
                            {config.scalePercentage}%
                          </span>
                        </div>
                      )}

                      {config.resizeMode === 'none' && (
                        <p className="text-xs text-stone-500">
                          Dimensions originales conservées. Seule la compression sera appliquée.
                        </p>
                      )}
                    </div>

                    {/* Integrated Compression Control (5 cols) */}
                    <div className="lg:col-span-5 lg:border-l lg:border-stone-200/80 lg:pl-5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-stone-700" />
                          Compression :
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateConfig({ compressionMode: 'quality' })}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                              config.compressionMode === 'quality'
                                ? 'bg-stone-900 text-white'
                                : 'text-stone-500 hover:bg-stone-200/60'
                            }`}
                          >
                            Qualité %
                          </button>
                          <button
                            type="button"
                            onClick={() => updateConfig({ compressionMode: 'target-size' })}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                              config.compressionMode === 'target-size'
                                ? 'bg-stone-900 text-white'
                                : 'text-stone-500 hover:bg-stone-200/60'
                            }`}
                          >
                            Poids cible (Ko)
                          </button>
                        </div>
                      </div>

                      {config.compressionMode === 'quality' ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={15}
                              max={100}
                              value={config.quality}
                              onChange={(e) => updateConfig({ quality: Number(e.target.value) })}
                              className="flex-1 accent-stone-900"
                            />
                            <span className="font-mono text-xs font-bold text-stone-900 bg-white border border-stone-300 px-2.5 py-1 rounded-lg min-w-[48px] text-center">
                              {config.quality}%
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-stone-400">
                            <span>Allégé (60%)</span>
                            <span>Standard (85%)</span>
                            <span>Max (100%)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-600">Max :</span>
                            <input
                              type="number"
                              min={10}
                              max={20000}
                              step={10}
                              value={config.targetFileSizeKb || ''}
                              onChange={(e) =>
                                updateConfig({
                                  targetFileSizeKb: Math.max(5, Number(e.target.value)),
                                })
                              }
                              className="w-24 rounded-xl bg-white border border-stone-300 px-2.5 py-1 font-mono text-sm font-bold text-stone-900"
                            />
                            <span className="font-mono text-xs text-stone-500">Ko</span>
                            <div className="flex gap-1 ml-auto">
                              {[150, 300, 500, 1024].map((kb) => (
                                <button
                                  key={kb}
                                  type="button"
                                  onClick={() => updateConfig({ targetFileSizeKb: kb })}
                                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                                    config.targetFileSizeKb === kb
                                      ? 'bg-stone-900 text-white border-stone-900'
                                      : 'bg-white border-stone-200 text-stone-600'
                                  }`}
                                >
                                  {kb === 1024 ? '1Mo' : `${kb}K`}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Bar: Output Format (JPG default, no "Recommandé" on WebP) + Optional EXIF toggle + Run Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-mono font-semibold text-stone-500 mr-1">FORMAT :</span>
                      {[
                        { id: 'image/jpeg', label: 'JPG' },
                        { id: 'original', label: 'Format d’origine' },
                        { id: 'image/png', label: 'PNG' },
                        { id: 'image/webp', label: 'WebP' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateConfig({ outputFormat: f.id as OutputFormat })}
                          className={`px-2.5 py-1 rounded-lg font-medium border transition ${
                            config.outputFormat === f.id
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none border-l border-stone-200 pl-4">
                      <input
                        type="checkbox"
                        checked={config.stripMetadata}
                        onChange={(e) => updateConfig({ stripMetadata: e.target.checked })}
                        className="rounded accent-stone-900"
                      />
                      <span>Supprimer les métadonnées EXIF / GPS</span>
                    </label>
                  </div>

                  <ActionApplyButton
                    count={items.length}
                    isProcessing={isBatchProcessing}
                    status={batchProgress.status}
                    label="Redimensionner & Compresser"
                    onClick={handleProcessAll}
                  />
                </div>
              </div>
            )}

            {/* VEOL MINIATURE (360x210) & VEOL BANNIERE (964x140) WORKSPACE */}
            {isVeolTool && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-white">
                      {selectedTool === 'veol-thumb' ? (
                        <LayoutTemplate className="w-3.5 h-3.5 text-orange-400" />
                      ) : (
                        <RectangleHorizontal className="w-3.5 h-3.5 text-orange-400" />
                      )}
                      {config.targetWidth} × {config.targetHeight} px
                    </span>

                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                      <Check className="w-3.5 h-3.5" /> 72 ppp (DPI) auto
                    </span>

                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-stone-600 font-medium">Qualité JPG :</span>
                      <input
                        type="range"
                        min={50}
                        max={100}
                        value={config.quality}
                        onChange={(e) => updateConfig({ quality: Number(e.target.value) })}
                        className="w-24 accent-stone-900"
                      />
                      <span className="font-mono text-xs font-bold text-stone-800">
                        {config.quality}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(config.renameSuffix)}
                        onChange={(e) =>
                          updateConfig({
                            renameSuffix: e.target.checked
                              ? selectedTool === 'veol-thumb'
                                ? '_miniature_360x210'
                                : '_banniere_964x140'
                              : '',
                          })
                        }
                        className="rounded accent-stone-900"
                      />
                      <span>
                        Ajouter le suffixe{' '}
                        <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">
                          {selectedTool === 'veol-thumb'
                            ? '_miniature_360x210'
                            : '_banniere_964x140'}
                        </code>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none border-l border-stone-200 pl-4">
                      <input
                        type="checkbox"
                        checked={config.stripMetadata}
                        onChange={(e) => updateConfig({ stripMetadata: e.target.checked })}
                        className="rounded accent-stone-900"
                      />
                      <span>Supprimer EXIF</span>
                    </label>
                  </div>
                </div>

                <ActionApplyButton
                  count={items.length}
                  isProcessing={isBatchProcessing}
                  status={batchProgress.status}
                  icon={<Download className="w-4 h-4" />}
                  label={
                    selectedTool === 'veol-thumb'
                      ? items.length > 1
                        ? 'Télécharger miniatures'
                        : 'Télécharger miniature'
                      : items.length > 1
                      ? 'Télécharger bannières'
                      : 'Télécharger bannière'
                  }
                  onClick={handleVeolDownload}
                />
              </div>
            )}

            {/* VEOL IMAGE ARTICLE (Max 1280px width, no upscale, no crop, 72 ppp auto, batch enabled) */}
            {selectedTool === 'veol-article' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-white">
                      <FileImage className="w-3.5 h-3.5 text-emerald-400" />
                      Largeur max ≤ {config.targetWidth} px
                    </span>

                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-stone-100 text-stone-700 border border-stone-200">
                      <Lock className="w-3.5 h-3.5" /> Ratio conservé • Sans crop • Sans agrandir
                    </span>

                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                      <Check className="w-3.5 h-3.5" /> 72 ppp (DPI) auto
                    </span>

                    <div className="flex items-center gap-2 ml-1">
                      <span className="text-xs text-stone-600 font-medium">Qualité JPG :</span>
                      <input
                        type="range"
                        min={50}
                        max={100}
                        value={config.quality}
                        onChange={(e) => updateConfig({ quality: Number(e.target.value) })}
                        className="w-24 accent-stone-900"
                      />
                      <span className="font-mono text-xs font-bold text-stone-800">
                        {config.quality}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(config.renameSuffix)}
                        onChange={(e) =>
                          updateConfig({
                            renameSuffix: e.target.checked ? '_article_1280' : '',
                          })
                        }
                        className="rounded accent-stone-900"
                      />
                      <span>
                        Ajouter le suffixe{' '}
                        <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">
                          _article_1280
                        </code>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none border-l border-stone-200 pl-4">
                      <input
                        type="checkbox"
                        checked={config.stripMetadata}
                        onChange={(e) => updateConfig({ stripMetadata: e.target.checked })}
                        className="rounded accent-stone-900"
                      />
                      <span>Supprimer EXIF</span>
                    </label>
                  </div>
                </div>

                <ActionApplyButton
                  count={items.length}
                  isProcessing={isBatchProcessing}
                  status={batchProgress.status}
                  label="Optimiser pour article VEOL"
                  onClick={handleProcessAll}
                />
              </div>
            )}

            {/* 2. CONVERT FORMAT CONTROLS */}
            {selectedTool === 'convert' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-stone-500 mr-1">
                      CONVERTIR VERS :
                    </span>
                    {[
                      { id: 'image/jpeg', label: 'JPG', desc: 'Format photo standard' },
                      { id: 'image/png', label: 'PNG', desc: 'Sans perte / Transparence' },
                      { id: 'image/webp', label: 'WEBP', desc: 'Format Web' },
                      { id: 'image/avif', label: 'AVIF', desc: 'Compression avancée' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateConfig({ outputFormat: f.id as OutputFormat })}
                        className={`px-4 py-2 rounded-xl border text-left transition ${
                          config.outputFormat === f.id
                            ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                            : 'bg-[#FAF8F5] text-stone-800 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <div className="font-mono text-xs font-bold">{f.label}</div>
                        <div
                          className={`text-[10px] ${
                            config.outputFormat === f.id ? 'text-stone-300' : 'text-stone-400'
                          }`}
                        >
                          {f.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.stripMetadata}
                        onChange={(e) => updateConfig({ stripMetadata: e.target.checked })}
                        className="rounded accent-stone-900"
                      />
                      <span>Supprimer les métadonnées EXIF / GPS</span>
                    </label>
                  </div>
                </div>

                <ActionApplyButton
                  count={items.length}
                  isProcessing={isBatchProcessing}
                  status={batchProgress.status}
                  label="Convertir les fichiers"
                  onClick={handleProcessAll}
                />
              </div>
            )}

            {/* 3. REMOVE BACKGROUND CONTROLS */}
            {selectedTool === 'remove-bg' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-stone-500 mr-1">
                      MOTEUR :
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({ bgRemoveMode: 'color-key', outputFormat: 'image/png' })
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                        config.bgRemoveMode === 'color-key'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Baguette Magique / Couleur (Instantané)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({ bgRemoveMode: 'ai', outputFormat: 'image/png' })
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                        config.bgRemoveMode === 'ai'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      Détourage IA Sujet 100% Local (RMBG-1.4)
                    </button>
                  </div>

                  {config.bgRemoveMode === 'color-key' ? (
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-600">Couleur à retirer :</span>
                        <input
                          type="color"
                          value={config.colorKeyHex}
                          onChange={(e) => updateConfig({ colorKeyHex: e.target.value })}
                          className="w-8 h-7 rounded cursor-pointer border border-stone-300 bg-white"
                        />
                        <span className="font-mono text-xs text-stone-700 uppercase">
                          {config.colorKeyHex}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-600">Tolérance :</span>
                        <input
                          type="range"
                          min={2}
                          max={70}
                          value={config.colorTolerance}
                          onChange={(e) => updateConfig({ colorTolerance: Number(e.target.value) })}
                          className="w-28 accent-stone-900"
                        />
                        <span className="font-mono text-xs font-bold text-purple-700">
                          {config.colorTolerance}%
                        </span>
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.contiguousFloodFill}
                          onChange={(e) =>
                            updateConfig({ contiguousFloodFill: e.target.checked })
                          }
                          className="rounded accent-stone-900"
                        />
                        <span>Bords contigus uniquement</span>
                      </label>

                      {items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setInspectedId(items[0].id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline"
                        >
                          <Pipette className="w-3.5 h-3.5" /> Pipette sur l'image
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">
                      Le modèle neuronal segmente automatiquement le sujet principal dans votre navigateur et exporte en PNG transparent.
                    </p>
                  )}
                </div>

                <ActionApplyButton
                  count={items.length}
                  isProcessing={isBatchProcessing}
                  status={batchProgress.status}
                  label="Retirer le fond (PNG)"
                  onClick={handleProcessAll}
                />
              </div>
            )}

            {/* 4. CROP & ORIENTATION + OPTIONAL RESIZE & COMPRESS CONTROLS */}
            {selectedTool === 'crop' && (
              <div className="space-y-5">
                {/* Top Block: Crop Ratio & Orientation */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-stone-500 mr-1">
                        RATIO :
                      </span>
                      {[
                        { id: '1:1', label: '1:1 Carré' },
                        { id: '16:9', label: '16:9 Paysage' },
                        { id: '4:3', label: '4:3 Photo' },
                        { id: '3:2', label: '3:2 Reflex' },
                        { id: '9:16', label: '9:16 Vertical' },
                        { id: 'none', label: 'Original' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => updateConfig({ cropPreset: c.id as CropPreset })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                            config.cropPreset === c.id
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            rotateDeg: (((config.rotateDeg + 90) % 360) as 0 | 90 | 180 | 270),
                          })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Pivoter 90° ({config.rotateDeg}°)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateConfig({ flipH: !config.flipH })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                          config.flipH
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-[#FAF8F5] border-stone-200 text-stone-700'
                        }`}
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" /> Miroir H
                      </button>
                      <button
                        type="button"
                        onClick={() => updateConfig({ flipV: !config.flipV })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                          config.flipV
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-[#FAF8F5] border-stone-200 text-stone-700'
                        }`}
                      >
                        <FlipVertical className="w-3.5 h-3.5" /> Miroir V
                      </button>
                      {items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setInspectedId(items[0].id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:underline ml-2"
                        >
                          <Crop className="w-3.5 h-3.5" /> Tracer une zone libre à la souris
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Block: Integrated Resize & Compression options */}
                <div className="rounded-xl bg-[#FAF8F5] border border-stone-200/90 p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Resize option (7 cols) */}
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1.5 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-orange-600" />
                        Redimensionner :
                      </span>
                      {[
                        { id: 'none', label: 'Taille du crop' },
                        { id: 'width-only', label: 'Largeur cible (px)' },
                        { id: 'max-side', label: 'Bord max (px)' },
                        { id: 'percentage', label: 'Échelle (%)' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateConfig({ resizeMode: m.id as ResizeMode })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                            config.resizeMode === m.id
                              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {config.resizeMode === 'width-only' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-stone-600">Largeur finale :</span>
                        <input
                          type="number"
                          min={16}
                          max={16000}
                          value={config.targetWidth || ''}
                          onChange={(e) =>
                            updateConfig({
                              targetWidth: Math.max(1, Number(e.target.value)),
                              lockAspectRatio: true,
                            })
                          }
                          className="w-24 rounded-xl bg-white border border-stone-300 px-2.5 py-1 font-mono text-sm font-bold text-stone-900"
                        />
                        <span className="font-mono text-xs text-stone-500">px (ratio conservé)</span>
                        <div className="flex gap-1 ml-1">
                          {[600, 1080, 1280, 1920].map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => updateConfig({ targetWidth: w, lockAspectRatio: true })}
                              className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                                config.targetWidth === w
                                  ? 'bg-orange-500/15 border-orange-500 text-orange-800 font-bold'
                                  : 'bg-white border-stone-200 text-stone-600'
                              }`}
                            >
                              {w}px
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {config.resizeMode === 'max-side' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-stone-600">Bord max :</span>
                        <input
                          type="number"
                          value={config.maxSidePx}
                          onChange={(e) => updateConfig({ maxSidePx: Number(e.target.value) })}
                          className="w-24 rounded-xl bg-white border border-stone-300 px-2.5 py-1 font-mono text-sm font-bold"
                        />
                        <span className="font-mono text-xs text-stone-500">px</span>
                      </div>
                    )}

                    {config.resizeMode === 'percentage' && (
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={config.scalePercentage}
                          onChange={(e) => updateConfig({ scalePercentage: Number(e.target.value) })}
                          className="flex-1 accent-stone-900"
                        />
                        <span className="font-mono text-xs font-bold text-orange-600">
                          {config.scalePercentage}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Compression option (5 cols) */}
                  <div className="lg:col-span-5 lg:border-l lg:border-stone-200/80 lg:pl-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5 text-stone-700" />
                        Compression :
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateConfig({ compressionMode: 'quality' })}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                            config.compressionMode === 'quality'
                              ? 'bg-stone-900 text-white'
                              : 'text-stone-500 hover:bg-stone-200/60'
                          }`}
                        >
                          Qualité %
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfig({ compressionMode: 'target-size' })}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                            config.compressionMode === 'target-size'
                              ? 'bg-stone-900 text-white'
                              : 'text-stone-500 hover:bg-stone-200/60'
                          }`}
                        >
                          Poids cible (Ko)
                        </button>
                      </div>
                    </div>

                    {config.compressionMode === 'quality' ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={15}
                          max={100}
                          value={config.quality}
                          onChange={(e) => updateConfig({ quality: Number(e.target.value) })}
                          className="flex-1 accent-stone-900"
                        />
                        <span className="font-mono text-xs font-bold text-stone-900 bg-white border border-stone-300 px-2.5 py-1 rounded-lg min-w-[46px] text-center">
                          {config.quality}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-600">Max :</span>
                        <input
                          type="number"
                          min={10}
                          max={20000}
                          step={10}
                          value={config.targetFileSizeKb || ''}
                          onChange={(e) =>
                            updateConfig({
                              targetFileSizeKb: Math.max(5, Number(e.target.value)),
                            })
                          }
                          className="w-24 rounded-xl bg-white border border-stone-300 px-2.5 py-1 font-mono text-sm font-bold text-stone-900"
                        />
                        <span className="font-mono text-xs text-stone-500">Ko</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Format + EXIF + Action Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-mono font-semibold text-stone-500 mr-1">FORMAT :</span>
                      {[
                        { id: 'image/jpeg', label: 'JPG' },
                        { id: 'original', label: 'Format d’origine' },
                        { id: 'image/png', label: 'PNG' },
                        { id: 'image/webp', label: 'WebP' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateConfig({ outputFormat: f.id as OutputFormat })}
                          className={`px-2.5 py-1 rounded-lg font-medium border transition ${
                            config.outputFormat === f.id
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none border-l border-stone-200 pl-4">
                      <input
                        type="checkbox"
                        checked={config.stripMetadata}
                        onChange={(e) => updateConfig({ stripMetadata: e.target.checked })}
                        className="rounded accent-stone-900"
                      />
                      <span>Supprimer les métadonnées EXIF / GPS</span>
                    </label>
                  </div>

                  <ActionApplyButton
                    count={items.length}
                    isProcessing={isBatchProcessing}
                    status={batchProgress.status}
                    label="Appliquer le cadrage"
                    onClick={handleProcessAll}
                  />
                </div>
              </div>
            )}

            {/* 5. RENAME CONTROLS */}
            {selectedTool === 'rename' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateConfig({ renamePattern: 'sequential' })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                        config.renamePattern === 'sequential'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                      }`}
                    >
                      Numérotation (001, 002...)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig({ renamePattern: 'keep' })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                        config.renamePattern === 'keep'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                      }`}
                    >
                      Garder le nom original
                    </button>
                  </div>

                  {config.renamePattern === 'sequential' && (
                    <input
                      type="text"
                      value={config.customBaseName}
                      onChange={(e) => updateConfig({ customBaseName: e.target.value })}
                      placeholder="Nom de base (ex: vacances)"
                      className="w-40 rounded-xl bg-[#FAF8F5] border border-stone-300 px-3 py-1.5 font-mono text-xs"
                    />
                  )}

                  <input
                    type="text"
                    value={config.renamePrefix}
                    onChange={(e) => updateConfig({ renamePrefix: e.target.value })}
                    placeholder="Préfixe (ex: web_)"
                    className="w-36 rounded-xl bg-[#FAF8F5] border border-stone-300 px-3 py-1.5 font-mono text-xs"
                  />
                  <input
                    type="text"
                    value={config.renameSuffix}
                    onChange={(e) => updateConfig({ renameSuffix: e.target.value })}
                    placeholder="Suffixe (ex: _hd)"
                    className="w-36 rounded-xl bg-[#FAF8F5] border border-stone-300 px-3 py-1.5 font-mono text-xs"
                  />
                </div>

                <ActionApplyButton
                  count={items.length}
                  isProcessing={isBatchProcessing}
                  status={batchProgress.status}
                  label="Générer les fichiers"
                  onClick={handleProcessAll}
                />
              </div>
            )}
          </section>

          {/* EXPORT BAR WHEN DONE (For multi-image batch tools) */}
          {doneItems.length > 0 && !isVeolTool && (
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-stone-200 rounded-2xl px-5 py-3 shadow-tactile">
              <div className="font-mono text-xs text-stone-600">
                Poids total : <strong className="text-stone-900">{formatBytes(totalProcessedBytes)}</strong>{' '}
                {totalSavedPercent > 0 && (
                  <span className="text-emerald-700 font-semibold">(-{totalSavedPercent}%)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportToLocalFolder}
                  className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FolderCheck className="w-4 h-4 text-stone-600" />
                  Vers un Dossier
                </button>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Archive className="w-4 h-4" />
                  Télécharger tout (.ZIP)
                </button>
              </div>
            </div>
          )}

          {/* EMPTY STATE DROPZONE OR FILES GRID */}
          {items.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-3xl border-2 border-dashed p-14 text-center transition-all flex flex-col items-center justify-center min-h-[300px] ${
                isDraggingOver
                  ? 'border-orange-500 bg-orange-500/5 scale-[0.99]'
                  : 'border-stone-300 bg-white/70 hover:bg-white hover:border-stone-400 shadow-tactile'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center mb-4 shadow-tactile">
                <ImagePlus className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                {isVeolTool
                  ? 'Glissez votre image ici pour la cadrer'
                  : 'Glissez vos images ou un dossier complet ici'}
              </h2>
              <p className="text-xs text-stone-500 mt-1 max-w-md">
                {isVeolTool
                  ? `Cadrage interactif ${config.targetWidth}×${config.targetHeight} px • Passage auto en 72 ppp • Astuce : Cmd+V pour coller une image`
                  : 'Traitement par lot instantané • JPG, PNG, WebP, AVIF, SVG • Dossiers complets ou Cmd+V pour coller'}
              </p>

              <div
                className="flex flex-wrap items-center justify-center gap-3 mt-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-2 shadow-tactile transition"
                >
                  <ImagePlus className="w-4 h-4" />
                  {isVeolTool ? 'Sélectionner une image' : 'Sélectionner des images'}
                </button>
                {!isVeolTool && (
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 text-xs font-semibold flex items-center gap-2 shadow-tactile transition"
                  >
                    <FolderUp className="w-4 h-4 text-orange-600" />
                    Importer un dossier entier
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                selectedTool === 'veol-banner'
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              }`}
            >
              {items.map((item, idx) => {
                const savedPct =
                  item.processedSize && item.originalSize
                    ? Math.round(((item.originalSize - item.processedSize) / item.originalSize) * 100)
                    : null;

                return (
                  <div
                    key={item.id}
                    className="group bg-white rounded-2xl border border-stone-200/90 hover:border-stone-400 shadow-tactile overflow-hidden flex flex-col transition"
                  >
                    {/* Image Viewport — Shows interactive darkened Crop Frame in VEOL & Crop modes */}
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
                            handleVeolPanZoomChange(item, idx, panX, panY, zoom, commit)
                          }
                          onUpdateCustomCrop={(cropBox, commit) =>
                            handleCustomCropChange(item, idx, cropBox, commit)
                          }
                          onOpenInspector={() => setInspectedId(item.id)}
                        />
                        {item.status === 'processing' && (
                          <div className="absolute top-2.5 left-2.5 pointer-events-none">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900 text-white flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> CALCUL...
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => setInspectedId(item.id)}
                        className="relative h-44 bg-checkerboard-light flex items-center justify-center overflow-hidden border-b border-stone-100 cursor-pointer"
                      >
                        <img
                          src={item.processedUrl || item.originalUrl}
                          alt={item.file.name}
                          draggable={false}
                          className="max-h-full max-w-full object-contain transition-transform duration-150 select-none"
                        />

                        {item.status === 'processing' && (
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900 text-white flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> CALCUL...
                            </span>
                          </div>
                        )}

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
                              onClick={() => handleCopyClipboard(item)}
                              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
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
                            onClick={() => handleProcessSingle(item, idx)}
                            className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-[11px] font-semibold"
                          >
                            Go
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition"
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
          )}
        </main>
      )}

      {/* Interactive Inspector Modal */}
      <InspectorModal
        item={inspectedItem}
        config={config}
        activeToolId={selectedTool || undefined}
        onClose={() => setInspectedId(null)}
        onUpdateConfig={updateConfig}
        onUpdateItem={updateItem}
        onProcessSingle={(it) => handleProcessSingle(it)}
        onCopyClipboard={handleCopyClipboard}
        copiedId={copiedId}
      />
    </div>
  );
}

const ActionApplyButton: React.FC<{
  count: number;
  isProcessing: boolean;
  status: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ count, isProcessing, status, label, icon, onClick }) => (
  <button
    type="button"
    disabled={count === 0 || isProcessing}
    onClick={onClick}
    className="shrink-0 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-xs shadow-tactile flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
  >
    {isProcessing ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-mono">{status}</span>
      </>
    ) : (
      <>
        {icon || <Sparkles className="w-4 h-4" />}
        <span>
          {label} {count > 1 ? `(${count})` : ''}
        </span>
      </>
    )}
  </button>
);

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export default App;
