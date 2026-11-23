import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ImageItem,
  PipelineConfig,
  CustomCropBox,
  ToolId,
  NoticeBanner,
} from './types';
import {
  ALL_TOOLS,
  getDefaultConfigForTool,
  getDropzoneCopyForTool,
} from './data/tools';
import { extractFilesFromDataTransfer, isImageFile } from './utils/fileExtractor';
import { isFileHeifOrHeic, decodeHeifFileToJpeg } from './utils/heicDecoder';
import { processSingleImage, getConfigSignature } from './utils/imageProcessor';
import { supportsAvifEncoding } from './utils/exifAndDpi';
import { HeaderNav } from './components/HeaderNav';
import { HomeHub } from './components/HomeHub';
import { ToolControlBar } from './components/ToolControlBar';
import { ExportBar } from './components/ExportBar';
import { ImageGrid } from './components/ImageGrid';
import { InspectorModal } from './components/InspectorModal';
import { LegalModal } from './components/LegalModal';
import { MockupStudio } from './components/MockupStudio';
import { PrivacyBlurEditor } from './components/PrivacyBlurEditor';
import { ProgressBanner, ActivityProgress } from './components/ProgressBanner';
import { SwitchToolDialog } from './components/SwitchToolDialog';
import JSZip from 'jszip';
import {
  ArrowLeft,
  FolderUp,
  ImagePlus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

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
    percent?: number;
  }>({
    current: 0,
    total: 0,
    status: '',
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [avifSupported, setAvifSupported] = useState(true);
  const [checkerboardDark, setCheckerboardDark] = useState(false);
  const [pendingSwitchTool, setPendingSwitchTool] = useState<ToolId | null | undefined>(undefined);
  const [notice, setNotice] = useState<NoticeBanner | null>(null);
  const [uploadProgress, setUploadProgress] = useState<ActivityProgress>({
    active: false,
    phase: 'importing',
    title: '',
    detail: '',
    current: 0,
    total: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const progressHideTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const cancelOperationRef = useRef(false);
  const dragDepthRef = useRef(0);

  // Detect browser Canvas AVIF encoding support once on mount
  useEffect(() => {
    supportsAvifEncoding().then((supported) => setAvifSupported(supported));
  }, []);

  const showNotice = useCallback((kind: NoticeBanner['kind'], message: string) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice({ id: String(Date.now()), kind, message });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 5000);
  }, []);

  const clearProgressHideTimer = useCallback(() => {
    if (progressHideTimerRef.current !== null) {
      window.clearTimeout(progressHideTimerRef.current);
      progressHideTimerRef.current = null;
    }
  }, []);

  const hideUploadProgress = useCallback(() => {
    clearProgressHideTimer();
    setUploadProgress((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, [clearProgressHideTimer]);

  const scheduleHideUploadProgress = useCallback(
    (delayMs = 2200) => {
      clearProgressHideTimer();
      progressHideTimerRef.current = window.setTimeout(() => {
        progressHideTimerRef.current = null;
        setUploadProgress((prev) => (prev.phase === 'done' ? { ...prev, active: false } : prev));
      }, delayMs);
    },
    [clearProgressHideTimer]
  );

  useEffect(() => {
    return () => {
      clearProgressHideTimer();
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, [clearProgressHideTimer]);

  const purgeItemsFromMemory = useCallback(() => {
    cancelOperationRef.current = true;
    hideUploadProgress();
    setItems((prev) => {
      prev.forEach((it) => {
        URL.revokeObjectURL(it.originalUrl);
        if (it.processedUrl) URL.revokeObjectURL(it.processedUrl);
      });
      return [];
    });
    setInspectedId(null);
  }, [hideUploadProgress]);

  const applyToolSelectionImmediate = useCallback(
    (toolId: ToolId | null) => {
      purgeItemsFromMemory();
      setSelectedTool(toolId);
      if (toolId) {
        setConfig(getDefaultConfigForTool(toolId));
        setCheckerboardDark(toolId === 'logo-white');
      }
    },
    [purgeItemsFromMemory]
  );

  // Safe tool navigation: prompt if images are currently loaded
  const handleRequestSelectTool = useCallback(
    (toolId: ToolId | null) => {
      if (toolId === selectedTool) return;
      if (items.length > 0) {
        setPendingSwitchTool(toolId);
      } else {
        applyToolSelectionImmediate(toolId);
      }
    },
    [selectedTool, items.length, applyToolSelectionImmediate]
  );

  const updateConfig = useCallback((partial: Partial<PipelineConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateItem = useCallback((id: string, partial: Partial<ImageItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  }, []);

  const currentConfigSig = useMemo(() => getConfigSignature(config), [config]);

  const handleProcessSingle = useCallback(
    async (item: ImageItem, idx?: number, overrideConfig?: PipelineConfig) => {
      const activeCfg = overrideConfig || config;
      const cfgSig = getConfigSignature(activeCfg);
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
          processedConfigSig: cfgSig,
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
    async (
      extracted: { file: File; relativePath: string }[],
      autoOpenTool?: ToolId,
      forceConfig?: PipelineConfig
    ) => {
      if (extracted.length === 0) {
        hideUploadProgress();
        return;
      }

      cancelOperationRef.current = false;
      clearProgressHideTimer();

      const targetTool = forceConfig ? autoOpenTool || selectedTool : selectedTool || autoOpenTool || null;
      const activeCfg = forceConfig
        ? forceConfig
        : selectedTool
        ? config
        : autoOpenTool
        ? getDefaultConfigForTool(autoOpenTool)
        : config;

      if (!selectedTool && autoOpenTool) {
        setSelectedTool(autoOpenTool);
        setConfig(activeCfg);
        setCheckerboardDark(autoOpenTool === 'logo-white');
      }

      const totalFiles = extracted.length;
      const needsAutoProcess =
        targetTool === 'veol-thumb' ||
        targetTool === 'veol-banner' ||
        targetTool === 'logo-white';

      setUploadProgress({
        active: true,
        phase: 'importing',
        title: totalFiles > 1 ? `Importation de ${totalFiles} images…` : 'Importation de l’image…',
        detail: 'Vérification des formats et signatures (HEIC, JPG, PNG, WebP, SVG)…',
        current: 0,
        total: totalFiles,
        percent: 0,
      });
      await yieldToPaint();

      const heifFlags = await Promise.all(extracted.map(({ file }) => isFileHeifOrHeic(file)));
      const stepsPerFile = needsAutoProcess ? 2 : 1;
      const totalSteps = totalFiles * stepsPerFile;

      let errorCount = 0;
      let importedCount = 0;

      try {
        for (let idx = 0; idx < totalFiles; idx++) {
          if (cancelOperationRef.current) break;

          const { file, relativePath } = extracted[idx];
          const baseStep = idx * stepsPerFile;
          let actualFile = file;
          let decodeErr: string | undefined;

          if (heifFlags[idx]) {
            setUploadProgress({
              active: true,
              phase: 'decoding',
              title:
                totalFiles > 1 ? 'Décodage HEIC / HEIF en cours…' : 'Décodage HEIC / HEIF local…',
              currentFile: file.name,
              detail: 'Préparation du décodeur HEIC…',
              current: idx + 1,
              total: totalFiles,
              percent: Math.round(((baseStep + 0.15) / totalSteps) * 100),
            });
            await yieldToPaint();

            const res = await decodeHeifFileToJpeg(file, (stage) => {
              setUploadProgress((prev) => ({ ...prev, detail: stage }));
            });
            if (cancelOperationRef.current) break;
            actualFile = res.file;
            decodeErr = res.error;
          } else {
            setUploadProgress({
              active: true,
              phase: 'importing',
              title: totalFiles > 1 ? 'Importation des images…' : 'Importation de l’image…',
              currentFile: file.name,
              detail: 'Lecture et génération de l’aperçu local…',
              current: idx + 1,
              total: totalFiles,
              percent: Math.round(((baseStep + 0.35) / totalSteps) * 100),
            });
            if (totalFiles <= 24 || idx % 3 === 0) {
              await yieldToPaint();
            }
          }

          const url = URL.createObjectURL(actualFile);
          const dims = await getImageDimensions(url);
          const convertedExt =
            actualFile.type === 'image/png'
              ? '.png'
              : actualFile.type === 'image/webp'
              ? '.webp'
              : actualFile.type === 'image/avif'
              ? '.avif'
              : '.jpg';

          const isErr = dims.width === 0;
          if (isErr) errorCount++;

          const newItem: ImageItem = {
            id: `${actualFile.name}-${actualFile.size}-${Math.random().toString(36).slice(2, 9)}`,
            file: actualFile,
            relativePath:
              heifFlags[idx] && relativePath
                ? relativePath.replace(/\.(heic|heif|hif)$/i, convertedExt)
                : relativePath || actualFile.name,
            originalUrl: url,
            originalWidth: dims.width,
            originalHeight: dims.height,
            originalSize: actualFile.size,
            panX: 0.5,
            panY: 0.5,
            zoom: 1,
            status: isErr ? 'error' : 'idle',
            errorMsg: isErr
              ? decodeErr || 'Format HEIF/HEIC non décodable ou fichier corrompu'
              : undefined,
          };

          importedCount++;
          setItems((prev) => [...prev, newItem]);

          if (needsAutoProcess && !isErr && !cancelOperationRef.current) {
            setUploadProgress({
              active: true,
              phase: 'processing',
              title:
                targetTool === 'logo-white'
                  ? 'Passage en blanc automatique…'
                  : 'Cadrage VEOL automatique…',
              currentFile: newItem.file.name,
              detail:
                targetTool === 'logo-white'
                  ? 'Suppression du fond clair et teinte monochrome…'
                  : 'Recadrage et passage en 72 ppp…',
              current: idx + 1,
              total: totalFiles,
              percent: Math.round(((baseStep + 1.2) / totalSteps) * 100),
            });
            await yieldToPaint();
            await handleProcessSingle(newItem, idx, activeCfg);
          }

          setUploadProgress((prev) => ({
            ...prev,
            percent: Math.round((((idx + 1) * stepsPerFile) / totalSteps) * 100),
          }));
        }

        if (cancelOperationRef.current) {
          setUploadProgress({
            active: true,
            phase: 'done',
            title: 'Importation annulée',
            detail: `${importedCount} image${importedCount > 1 ? 's' : ''} déjà chargée${importedCount > 1 ? 's' : ''}`,
            current: importedCount,
            total: totalFiles,
            percent: 100,
          });
          scheduleHideUploadProgress(2200);
          return;
        }

        const successCount = totalFiles - errorCount;
        setUploadProgress({
          active: true,
          phase: 'done',
          title:
            totalFiles > 1 ? `${totalFiles} images importées` : 'Image importée et prête',
          detail:
            errorCount > 0
              ? `${successCount} prête(s) • ${errorCount} non décodable(s)`
              : needsAutoProcess
              ? 'Importation et traitement automatique terminés (100 % local)'
              : 'Prêt pour le traitement (100 % local)',
          current: totalFiles,
          total: totalFiles,
          percent: 100,
        });
        scheduleHideUploadProgress(2200);
      } catch (err: any) {
        setUploadProgress({
          active: true,
          phase: 'done',
          title: 'Import interrompu',
          detail: err?.message || 'Une erreur est survenue pendant l’importation',
          current: importedCount,
          total: totalFiles,
          percent: 100,
        });
        scheduleHideUploadProgress(3500);
      }
    },
    [
      selectedTool,
      config,
      handleProcessSingle,
      clearProgressHideTimer,
      hideUploadProgress,
      scheduleHideUploadProgress,
    ]
  );

  // Chain processed (or original) files into another Penl.img tool seamlessly
  const handleChainFilesToTool = useCallback(
    async (files: { file: File; relativePath: string }[], targetTool: ToolId) => {
      if (files.length === 0) return;
      const nextCfg = getDefaultConfigForTool(targetTool);
      purgeItemsFromMemory();
      setSelectedTool(targetTool);
      setConfig(nextCfg);
      setCheckerboardDark(targetTool === 'logo-white');
      await yieldToPaint();
      await ingestFiles(files, targetTool, nextCfg);
      const targetMeta = ALL_TOOLS.find((t) => t.id === targetTool);
      showNotice(
        'info',
        `${files.length} image${files.length > 1 ? 's' : ''} transférée${files.length > 1 ? 's' : ''} vers « ${targetMeta?.title || targetTool} ».`
      );
    },
    [purgeItemsFromMemory, ingestFiles, showNotice]
  );

  const handleChainCurrentItems = useCallback(
    async (targetTool: ToolId) => {
      const files: { file: File; relativePath: string }[] = items
        .filter((it) => it.status !== 'error')
        .map((it) => {
          if (it.processedBlob) {
            const name = it.outputFileName || it.file.name;
            return {
              file: new File([it.processedBlob], name, { type: it.processedBlob.type }),
              relativePath: name,
            };
          }
          return { file: it.file, relativePath: it.relativePath || it.file.name };
        });
      await handleChainFilesToTool(files, targetTool);
    },
    [items, handleChainFilesToTool]
  );

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    cancelOperationRef.current = false;
    clearProgressHideTimer();
    setUploadProgress({
      active: true,
      phase: 'scanning',
      title: 'Lecture des fichiers sélectionnés…',
      detail: `Filtrage des images sur ${fileList.length} élément${fileList.length > 1 ? 's' : ''}…`,
      current: 0,
      total: 0,
      percent: undefined,
    });
    await yieldToPaint();

    const list: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (isImageFile(f)) {
        const rel = (f as any).webkitRelativePath || f.name;
        list.push({ file: f, relativePath: rel });
      }
    }
    e.target.value = '';
    if (list.length === 0) {
      hideUploadProgress();
      showNotice('warning', 'Aucune image compatible détectée dans votre sélection.');
      return;
    }
    await ingestFiles(list);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);

    cancelOperationRef.current = false;
    clearProgressHideTimer();
    setUploadProgress({
      active: true,
      phase: 'scanning',
      title: 'Analyse des fichiers déposés…',
      detail: 'Exploration des dossiers et recherche des images…',
      current: 0,
      total: 0,
      percent: undefined,
    });
    await yieldToPaint();

    let extracted: { file: File; relativePath: string }[] = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      let lastUpdate = 0;
      extracted = await extractFilesFromDataTransfer(
        e.dataTransfer.items,
        (foundCount, currentName) => {
          const now = performance.now();
          if (now - lastUpdate > 60 || foundCount <= 5) {
            lastUpdate = now;
            setUploadProgress({
              active: true,
              phase: 'scanning',
              title: 'Exploration du dossier en cours…',
              currentFile: currentName,
              detail: `${foundCount} image${foundCount > 1 ? 's' : ''} détectée${foundCount > 1 ? 's' : ''}`,
              current: foundCount,
              total: 0,
              percent: undefined,
            });
          }
        }
      );
    }
    if (extracted.length === 0 && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        if (isImageFile(f)) {
          extracted.push({ file: f, relativePath: f.name });
        }
      }
    }
    if (extracted.length === 0) {
      hideUploadProgress();
      showNotice('warning', 'Aucun fichier image compatible trouvé dans les éléments déposés.');
      return;
    }
    await ingestFiles(extracted, 'resize-compress');
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

  const handleProcessAll = useCallback(async () => {
    if (items.length === 0 || isBatchProcessing) return;
    cancelOperationRef.current = false;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: items.length, status: 'Préparation…', percent: 0 });
    await yieldToPaint();

    for (let i = 0; i < items.length; i++) {
      if (cancelOperationRef.current) break;
      setBatchProgress({
        current: i + 1,
        total: items.length,
        status: `${i + 1}/${items.length} • ${items[i].file.name}`,
        percent: Math.round(((i + 0.5) / items.length) * 100),
      });
      await yieldToPaint();
      await handleProcessSingle(items[i], i);
    }

    setIsBatchProcessing(false);
    setBatchProgress({
      current: items.length,
      total: items.length,
      status: cancelOperationRef.current ? 'Annulé' : 'Terminé',
      percent: 100,
    });
  }, [items, isBatchProcessing, handleProcessSingle]);

  // Smooth debounced live preview when tweaking visual sliders in Logo en Blanc / Retirer le fond (small batches)
  const autoReprocessTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      (selectedTool !== 'logo-white' && selectedTool !== 'remove-bg') ||
      items.length === 0 ||
      items.length > 6 ||
      isBatchProcessing ||
      uploadProgress.active
    ) {
      return;
    }
    const anyDoneAndStale = items.some(
      (it) =>
        it.status === 'done' &&
        Boolean(it.processedConfigSig) &&
        it.processedConfigSig !== currentConfigSig
    );
    if (!anyDoneAndStale) return;

    if (autoReprocessTimerRef.current !== null) {
      window.clearTimeout(autoReprocessTimerRef.current);
    }
    autoReprocessTimerRef.current = window.setTimeout(() => {
      handleProcessAll();
    }, 260);

    return () => {
      if (autoReprocessTimerRef.current !== null) {
        window.clearTimeout(autoReprocessTimerRef.current);
      }
    };
  }, [selectedTool, currentConfigSig, items, isBatchProcessing, uploadProgress.active, handleProcessAll]);

  const handleCopyClipboard = async (item: ImageItem) => {
    const blob = item.processedBlob;
    if (!blob) return;
    try {
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
          c.toBlob((b) => (b ? res(b) : rej(new Error('Erreur génération PNG'))), 'image/png')
        );
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2000);
    } catch (err: any) {
      showNotice('error', 'Impossible de copier dans le presse-papier : ' + (err?.message || err));
    }
  };

  const handleVeolDownload = async () => {
    if (items.length === 0 || isBatchProcessing) return;
    cancelOperationRef.current = false;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: items.length, status: 'Préparation…', percent: 0 });
    await yieldToPaint();

    const cfgSig = getConfigSignature(config);
    const outBlobs: { name: string; blob: Blob }[] = [];

    for (let i = 0; i < items.length; i++) {
      if (cancelOperationRef.current) break;
      const it = items[i];
      setBatchProgress({
        current: i + 1,
        total: items.length,
        status: `${i + 1}/${items.length} • ${it.file.name}`,
        percent: Math.round(((i + 0.5) / items.length) * 100),
      });
      await yieldToPaint();
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
        processedConfigSig: cfgSig,
      });
      outBlobs.push({ name: res.outputFileName, blob: res.blob });
    }

    if (!cancelOperationRef.current) {
      if (outBlobs.length === 1) {
        const url = URL.createObjectURL(outBlobs[0].blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outBlobs[0].name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showNotice('success', `Visuel VEOL téléchargé (${outBlobs[0].name}).`);
      } else if (outBlobs.length > 1) {
        const zip = new JSZip();
        outBlobs.forEach((f) => zip.file(f.name, f.blob));
        const content = await zip.generateAsync({ type: 'blob' }, (meta) => {
          setBatchProgress({
            current: outBlobs.length,
            total: outBlobs.length,
            status: `Création de l’archive ZIP (${Math.round(meta.percent)}%)…`,
            percent: Math.round(meta.percent),
          });
        });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `penl_img_${selectedTool}_${outBlobs.length}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showNotice('success', `${outBlobs.length} visuels VEOL exportés en ZIP.`);
      }
    }

    setIsBatchProcessing(false);
  };

  const handleDownloadZip = async () => {
    const processedItems = items.filter((it) => it.processedBlob);
    if (processedItems.length === 0 || isBatchProcessing) return;

    setIsBatchProcessing(true);
    setBatchProgress({
      current: processedItems.length,
      total: processedItems.length,
      status: 'Compression de l’archive ZIP…',
      percent: 0,
    });
    await yieldToPaint();

    try {
      const zip = new JSZip();
      processedItems.forEach((it) => {
        const path = it.outputFileName || it.file.name;
        zip.file(path, it.processedBlob!);
      });

      const content = await zip.generateAsync({ type: 'blob' }, (meta) => {
        setBatchProgress({
          current: processedItems.length,
          total: processedItems.length,
          status: `Création de l’archive ZIP (${Math.round(meta.percent)}%)…`,
          percent: Math.round(meta.percent),
        });
      });

      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `penl_img_${selectedTool || 'export'}_${processedItems.length}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showNotice('success', `Archive ZIP téléchargée (${processedItems.length} fichiers).`);
    } catch (err: any) {
      showNotice('error', 'Erreur lors de la génération du ZIP : ' + (err?.message || err));
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleExportToLocalFolder = async () => {
    const processedItems = items.filter((it) => it.processedBlob);
    if (processedItems.length === 0) return;

    if (!('showDirectoryPicker' in window)) {
      showNotice(
        'warning',
        'Votre navigateur ne supporte pas l’écriture directe dans un dossier. Utilisez le bouton ZIP.'
      );
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
      showNotice(
        'success',
        `${processedItems.length} image${processedItems.length > 1 ? 's' : ''} enregistrée${processedItems.length > 1 ? 's' : ''} dans votre dossier local.`
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showNotice('error', 'Erreur lors de l’enregistrement : ' + (err?.message || err));
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

  // Global Paste (Cmd+V / Ctrl+V) support
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
  const hasInteractiveCropCard =
    isVeolTool ||
    selectedTool === 'crop' ||
    (selectedTool === 'veol-article' && config.cropPreset !== 'none');
  const parsedCropAspectRatio: number | null = isVeolTool
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

  const hasStaleItems = items.some(
    (it) =>
      it.status === 'done' &&
      Boolean(it.processedConfigSig) &&
      it.processedConfigSig !== currentConfigSig
  );

  const inspectedIndex = items.findIndex((i) => i.id === inspectedId);
  const inspectedItem = inspectedIndex >= 0 ? items[inspectedIndex] : null;
  const dropzoneCopy = getDropzoneCopyForTool(selectedTool, config);

  const handleNavigateInspector = useCallback(
    (delta: -1 | 1) => {
      if (items.length <= 1 || inspectedIndex < 0) return;
      const nextIdx = (inspectedIndex + delta + items.length) % items.length;
      setInspectedId(items[nextIdx].id);
    },
    [items, inspectedIndex]
  );

  const activeProgress: ActivityProgress = uploadProgress.active
    ? uploadProgress
    : isBatchProcessing
    ? {
        active: true,
        phase: 'processing',
        title:
          batchProgress.total > 1
            ? `Traitement de ${batchProgress.total} images…`
            : 'Traitement de l’image…',
        detail: batchProgress.status || 'Calcul local en cours…',
        current: batchProgress.current,
        total: batchProgress.total,
        percent:
          batchProgress.percent !== undefined
            ? batchProgress.percent
            : batchProgress.total > 0
            ? Math.round((batchProgress.current / batchProgress.total) * 100)
            : undefined,
      }
    : {
        active: false,
        phase: 'importing',
        title: '',
        detail: '',
        current: 0,
        total: 0,
      };

  const handleCancelActiveTask = () => {
    cancelOperationRef.current = true;
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepthRef.current++;
        setIsDraggingOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setIsDraggingOver(false);
        }
      }}
      onDrop={handleDrop}
      className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 relative"
    >
      {/* Hidden File & Folder inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif,.hif,.HEIC,.HEIF,.HIF,image/heic,image/heif,image/heic-sequence,image/heif-sequence"
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

      {/* Global Drag & Drop Full-Screen Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-stone-900/55 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border-2 border-dashed border-orange-500 shadow-2xl px-10 py-8 text-center max-w-md space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-orange-600 text-white flex items-center justify-center mx-auto shadow-lg">
              <Upload className="w-7 h-7" />
            </div>
            <h2 className="font-display text-xl font-extrabold text-stone-900">
              Déposez vos images ici
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              {activeToolMeta
                ? `Ajout immédiat dans « ${activeToolMeta.title} »`
                : 'Ouverture automatique dans « Redimensionner & Compresser »'}
              <br />
              <span className="font-mono text-[11px] text-stone-400">
                HEIC/HEIF iPhone • JPG • PNG • WebP • SVG • Dossiers complets
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <HeaderNav
        selectedTool={selectedTool}
        itemsCount={items.length}
        onRequestSelectTool={handleRequestSelectTool}
        onOpenLegal={() => setIsLegalModalOpen(true)}
      />

      {/* VIEW 1: GOAL-ORIENTED HOME HUB */}
      {!selectedTool ? (
        <HomeHub
          onSelectTool={(id) => applyToolSelectionImmediate(id)}
          onOpenLegal={() => setIsLegalModalOpen(true)}
        />
      ) : (
        /* VIEW 2: FOCUSED SINGLE-RESULT WORKSPACE */
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
          {/* Top Breadcrumb + Tool Title + File Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleRequestSelectTool(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 shadow-tactile transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tous les outils
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-extrabold text-stone-900">
                  {activeToolMeta?.title}
                </h1>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-600">
                  {activeToolMeta?.badge}
                </span>
              </div>
            </div>

            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Ajouter Images
                </button>
                {!isVeolTool && (
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    Ajouter Dossier
                  </button>
                )}
                <button
                  type="button"
                  onClick={purgeItemsFromMemory}
                  className="p-1.5 rounded-xl bg-white border border-stone-200 hover:bg-rose-50 hover:border-rose-200 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                  title="Tout effacer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Inline Feedback Notice (replaces window.alert) */}
          {notice && (
            <div
              role={notice.kind === 'error' ? 'alert' : 'status'}
              aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
              className={`rounded-2xl border px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 shadow-sm ${
                notice.kind === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : notice.kind === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : notice.kind === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {notice.kind === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : notice.kind === 'error' || notice.kind === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span>{notice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Fermer la notification"
                className="p-1 rounded-lg hover:bg-black/5 transition cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* FOCUSED COMMAND BAR */}
          <ToolControlBar
            selectedTool={selectedTool}
            config={config}
            items={items}
            isBatchProcessing={isBatchProcessing}
            batchStatus={batchProgress.status}
            hasStaleItems={hasStaleItems}
            avifSupported={avifSupported}
            checkerboardDark={checkerboardDark}
            onToggleCheckerboardDark={() => setCheckerboardDark((d) => !d)}
            onUpdateConfig={updateConfig}
            onProcessAll={handleProcessAll}
            onVeolDownload={handleVeolDownload}
            onInspectFirst={() => items[0] && setInspectedId(items[0].id)}
          />

          {/* INLINE PROGRESS BAR FOR UPLOAD / DECODING / BATCH PROCESSING */}
          <ProgressBanner
            progress={activeProgress}
            variant="inline"
            onCancel={handleCancelActiveTask}
          />

          {/* UNIFIED SMART EXPORT BAR + TOOL CHAINING */}
          {selectedTool !== 'mockup' && selectedTool !== 'privacy-blur' && (
            <ExportBar
              selectedTool={selectedTool}
              doneItems={doneItems}
              totalProcessedBytes={totalProcessedBytes}
              totalSavedPercent={totalSavedPercent}
              copiedId={copiedId}
              onCopyClipboard={handleCopyClipboard}
              onDownloadZip={handleDownloadZip}
              onExportToLocalFolder={handleExportToLocalFolder}
              onChainToTool={handleChainCurrentItems}
            />
          )}

          {/* WORKSPACE BODY: SPECIALIZED STUDIO, EMPTY DROPZONE, OR IMAGE GRID */}
          {selectedTool === 'mockup' && items.length > 0 ? (
            <MockupStudio
              items={items}
              onChainFiles={handleChainFilesToTool}
              onNotify={showNotice}
            />
          ) : selectedTool === 'privacy-blur' && items.length > 0 ? (
            <PrivacyBlurEditor
              items={items}
              config={config}
              onUpdateConfig={updateConfig}
              onUpdateItem={updateItem}
              onChainFiles={handleChainFilesToTool}
              onNotify={showNotice}
            />
          ) : items.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-3xl border-2 border-dashed border-stone-300 bg-white/70 hover:bg-white hover:border-stone-400 shadow-tactile p-14 text-center transition-all flex flex-col items-center justify-center min-h-[300px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center mb-4 shadow-tactile">
                <ImagePlus className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                {dropzoneCopy.title}
              </h2>
              <p className="text-xs text-stone-500 mt-1.5 max-w-lg leading-relaxed">
                {dropzoneCopy.subtitle}
              </p>

              <div
                className="flex flex-wrap items-center justify-center gap-3 mt-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-2 shadow-tactile transition cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  {dropzoneCopy.primaryBtn}
                </button>
                {!isVeolTool && (
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 text-xs font-semibold flex items-center gap-2 shadow-tactile transition cursor-pointer"
                  >
                    <FolderUp className="w-4 h-4 text-orange-600" />
                    Importer un dossier entier
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ImageGrid
              items={items}
              selectedTool={selectedTool}
              config={config}
              currentConfigSig={currentConfigSig}
              isVeolTool={isVeolTool}
              hasInteractiveCropCard={hasInteractiveCropCard}
              parsedCropAspectRatio={parsedCropAspectRatio}
              checkerboardDark={checkerboardDark}
              copiedId={copiedId}
              onInspect={(id) => setInspectedId(id)}
              onProcessSingle={handleProcessSingle}
              onCopyClipboard={handleCopyClipboard}
              onRemoveItem={removeItem}
              onVeolPanZoomChange={handleVeolPanZoomChange}
              onCustomCropChange={handleCustomCropChange}
            />
          )}
        </main>
      )}

      {/* Interactive Inspector Modal */}
      <InspectorModal
        item={inspectedItem}
        itemIndex={inspectedIndex >= 0 ? inspectedIndex : 0}
        totalItems={items.length}
        onNavigate={handleNavigateInspector}
        config={config}
        activeToolId={selectedTool || undefined}
        onClose={() => setInspectedId(null)}
        onUpdateConfig={updateConfig}
        onUpdateItem={updateItem}
        onProcessSingle={handleProcessSingle}
        onCopyClipboard={handleCopyClipboard}
        copiedId={copiedId}
      />

      {/* Safe Switch Tool / Chain Dialog */}
      <SwitchToolDialog
        pendingTool={pendingSwitchTool}
        itemsCount={items.length}
        hasProcessed={doneItems.length > 0}
        onTransfer={() => {
          const target = pendingSwitchTool;
          setPendingSwitchTool(undefined);
          if (target) handleChainCurrentItems(target);
        }}
        onResetAndSwitch={() => {
          const target = pendingSwitchTool;
          setPendingSwitchTool(undefined);
          applyToolSelectionImmediate(target ?? null);
        }}
        onCancel={() => setPendingSwitchTool(undefined)}
      />

      {/* Legal & Privacy Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* Floating Progress Notification when on Home Hub */}
      {!selectedTool && <ProgressBanner progress={activeProgress} variant="floating" />}
    </div>
  );
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fallback = window.setTimeout(done, 32);
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.clearTimeout(fallback);
        done();
      }, 0);
    });
  });
}

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
