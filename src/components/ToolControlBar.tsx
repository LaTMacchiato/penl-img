import React from 'react';
import {
  ImageItem,
  PipelineConfig,
  OutputFormat,
  ResizeMode,
  CropPreset,
  ToolId,
} from '../types';
import {
  Maximize2,
  Lock,
  Sliders,
  LayoutTemplate,
  RectangleHorizontal,
  Check,
  Download,
  FileImage,
  Crop,
  Pipette,
  Paintbrush,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Laptop,
  EyeOff,
  Loader2,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

interface ToolControlBarProps {
  selectedTool: ToolId;
  config: PipelineConfig;
  items: ImageItem[];
  isBatchProcessing: boolean;
  batchStatus: string;
  hasStaleItems: boolean;
  avifSupported: boolean;
  checkerboardDark: boolean;
  onToggleCheckerboardDark: () => void;
  onUpdateConfig: (partial: Partial<PipelineConfig>) => void;
  onProcessAll: () => void;
  onVeolDownload: () => void;
  onInspectFirst: () => void;
}

export const ToolControlBar: React.FC<ToolControlBarProps> = ({
  selectedTool,
  config,
  items,
  isBatchProcessing,
  batchStatus,
  hasStaleItems,
  avifSupported,
  checkerboardDark,
  onToggleCheckerboardDark,
  onUpdateConfig,
  onProcessAll,
  onVeolDownload,
  onInspectFirst,
}) => {
  const isVeolTool = selectedTool === 'veol-thumb' || selectedTool === 'veol-banner';
  const firstItem = items[0];
  const previewHeightForWidthOnly =
    firstItem && config.targetWidth && firstItem.originalWidth > 0
      ? Math.round((config.targetWidth * firstItem.originalHeight) / firstItem.originalWidth)
      : null;

  return (
    <section className="bg-white rounded-2xl border border-stone-200/90 shadow-tactile p-5">
      {/* 1. UNIFIED RESIZE & COMPRESS */}
      {selectedTool === 'resize-compress' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-[#FAF8F5] border border-stone-200/90 p-5 space-y-5">
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
                    onClick={() => onUpdateConfig({ resizeMode: m.id as ResizeMode })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-stone-200/70 items-center">
              <div className="lg:col-span-7 space-y-2.5">
                {config.resizeMode === 'width-only' && (
                  <>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="text-xs font-semibold text-stone-700">Largeur cible :</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min={16}
                          max={16000}
                          value={config.targetWidth || ''}
                          onChange={(e) =>
                            onUpdateConfig({
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
                          onClick={() => onUpdateConfig({ targetWidth: w, lockAspectRatio: true })}
                          className={`font-mono text-[11px] px-2.5 py-1 rounded-md border transition cursor-pointer ${
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
                      <span className="text-xs font-semibold text-stone-700">Côté le plus long :</span>
                      <input
                        type="number"
                        value={config.maxSidePx}
                        onChange={(e) => onUpdateConfig({ maxSidePx: Number(e.target.value) })}
                        className="w-28 rounded-xl bg-white border border-stone-300 px-3 py-1.5 font-mono text-sm font-bold"
                      />
                      <span className="font-mono text-xs text-stone-500">px</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[800, 1280, 1600, 1920, 2560].map((px) => (
                        <button
                          key={px}
                          type="button"
                          onClick={() => onUpdateConfig({ maxSidePx: px })}
                          className={`font-mono text-[11px] px-2.5 py-1 rounded-md border cursor-pointer ${
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
                      onChange={(e) => onUpdateConfig({ scalePercentage: Number(e.target.value) })}
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

              <div className="lg:col-span-5 lg:border-l lg:border-stone-200/80 lg:pl-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-stone-700" />
                    Compression :
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ compressionMode: 'quality' })}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                        config.compressionMode === 'quality'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-500 hover:bg-stone-200/60'
                      }`}
                    >
                      Qualité %
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ compressionMode: 'target-size' })}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
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
                        onChange={(e) => onUpdateConfig({ quality: Number(e.target.value) })}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-600">Max :</span>
                    <input
                      type="number"
                      min={10}
                      max={20000}
                      step={10}
                      value={config.targetFileSizeKb || ''}
                      onChange={(e) =>
                        onUpdateConfig({
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
                          onClick={() => onUpdateConfig({ targetFileSizeKb: kb })}
                          className={`font-mono text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
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
                )}
              </div>
            </div>
          </div>

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

              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none border-l border-stone-200 pl-4">
                <input
                  type="checkbox"
                  checked={config.stripMetadata}
                  onChange={(e) => onUpdateConfig({ stripMetadata: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Supprimer les métadonnées EXIF / GPS</span>
              </label>
            </div>

            <ActionApplyButton
              count={items.length}
              isProcessing={isBatchProcessing}
              status={batchStatus}
              stale={hasStaleItems}
              label="Redimensionner & Compresser"
              onClick={onProcessAll}
            />
          </div>
        </div>
      )}

      {/* VEOL MINIATURE & BANNIERE */}
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
                  onChange={(e) => onUpdateConfig({ quality: Number(e.target.value) })}
                  className="w-24 accent-stone-900"
                />
                <span className="font-mono text-xs font-bold text-stone-800">{config.quality}%</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(config.renameSuffix)}
                  onChange={(e) =>
                    onUpdateConfig({
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
                    {selectedTool === 'veol-thumb' ? '_miniature_360x210' : '_banniere_964x140'}
                  </code>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none border-l border-stone-200 pl-4">
                <input
                  type="checkbox"
                  checked={config.stripMetadata}
                  onChange={(e) => onUpdateConfig({ stripMetadata: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Supprimer EXIF</span>
              </label>
            </div>
          </div>

          <ActionApplyButton
            count={items.length}
            isProcessing={isBatchProcessing}
            status={batchStatus}
            stale={hasStaleItems}
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
            onClick={onVeolDownload}
          />
        </div>
      )}

      {/* VEOL ARTICLE */}
      {selectedTool === 'veol-article' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-white">
                <FileImage className="w-3.5 h-3.5 text-emerald-400" />
                Largeur max ≤ {config.targetWidth} px
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
                  onChange={(e) => onUpdateConfig({ quality: Number(e.target.value) })}
                  className="w-24 accent-stone-900"
                />
                <span className="font-mono text-xs font-bold text-stone-800">{config.quality}%</span>
              </div>
            </div>

            <ActionApplyButton
              count={items.length}
              isProcessing={isBatchProcessing}
              status={batchStatus}
              stale={hasStaleItems}
              label="Optimiser pour article VEOL"
              onClick={onProcessAll}
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-stone-500 mr-1 flex items-center gap-1">
                <Crop className="w-3.5 h-3.5 text-stone-600" /> CADRAGE / CROP :
              </span>
              {[
                { id: 'none', label: 'Sans crop (Original)' },
                { id: '16:9', label: '16:9 Paysage' },
                { id: '4:3', label: '4:3 Photo' },
                { id: '3:2', label: '3:2 Reflex' },
                { id: '1:1', label: '1:1 Carré' },
                { id: 'custom', label: 'Zone libre' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onUpdateConfig({ cropPreset: c.id as CropPreset })}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    config.cropPreset === c.id
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(config.renameSuffix)}
                  onChange={(e) =>
                    onUpdateConfig({ renameSuffix: e.target.checked ? '_article_1280' : '' })
                  }
                  className="rounded accent-stone-900"
                />
                <span>
                  Suffixe{' '}
                  <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">
                    _article_1280
                  </code>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none border-l border-stone-200 pl-4">
                <input
                  type="checkbox"
                  checked={config.stripMetadata}
                  onChange={(e) => onUpdateConfig({ stripMetadata: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Supprimer EXIF</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT FORMAT (with runtime AVIF support detection!) */}
      {selectedTool === 'convert' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-stone-500 mr-1">
                CONVERTIR VERS :
              </span>
              {[
                { id: 'image/jpeg', label: 'JPG', desc: 'Format photo standard', disabled: false },
                { id: 'image/png', label: 'PNG', desc: 'Sans perte / Transparence', disabled: false },
                { id: 'image/webp', label: 'WEBP', desc: 'Format Web léger', disabled: false },
                {
                  id: 'image/avif',
                  label: 'AVIF',
                  desc: avifSupported ? 'Compression avancée' : 'Non supporté ici',
                  disabled: !avifSupported,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={f.disabled}
                  title={
                    f.disabled
                      ? 'L’encodage AVIF via Canvas n’est pas supporté par ce navigateur (utilisez WebP ou JPG).'
                      : undefined
                  }
                  onClick={() => onUpdateConfig({ outputFormat: f.id as OutputFormat })}
                  className={`px-4 py-2 rounded-xl border text-left transition ${
                    f.disabled
                      ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                      : config.outputFormat === f.id
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm cursor-pointer'
                      : 'bg-[#FAF8F5] text-stone-800 border-stone-200 hover:bg-stone-100 cursor-pointer'
                  }`}
                >
                  <div className="font-mono text-xs font-bold">{f.label}</div>
                  <div
                    className={`text-[10px] ${
                      f.disabled
                        ? 'text-stone-400'
                        : config.outputFormat === f.id
                        ? 'text-stone-300'
                        : 'text-stone-400'
                    }`}
                  >
                    {f.desc}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              {config.outputFormat !== 'image/png' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-600 font-medium">Qualité :</span>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={config.quality}
                    onChange={(e) => onUpdateConfig({ quality: Number(e.target.value) })}
                    className="w-24 accent-stone-900"
                  />
                  <span className="font-mono text-xs font-bold text-stone-800">{config.quality}%</span>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.stripMetadata}
                  onChange={(e) => onUpdateConfig({ stripMetadata: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Supprimer les métadonnées EXIF / GPS</span>
              </label>
            </div>
          </div>

          <ActionApplyButton
            count={items.length}
            isProcessing={isBatchProcessing}
            status={batchStatus}
            stale={hasStaleItems}
            label="Convertir les fichiers"
            onClick={onProcessAll}
          />
        </div>
      )}

      {/* REMOVE BACKGROUND */}
      {selectedTool === 'remove-bg' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-stone-500">COULEUR :</span>
                <input
                  type="color"
                  value={config.colorKeyHex}
                  onChange={(e) => onUpdateConfig({ colorKeyHex: e.target.value })}
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
                  onChange={(e) => onUpdateConfig({ colorTolerance: Number(e.target.value) })}
                  className="w-28 accent-stone-900"
                />
                <span className="font-mono text-xs font-bold text-stone-900">
                  {config.colorTolerance}%
                </span>
              </div>

              <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.contiguousFloodFill}
                  onChange={(e) => onUpdateConfig({ contiguousFloodFill: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Bords contigus uniquement</span>
              </label>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={onInspectFirst}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer"
                >
                  <Pipette className="w-3.5 h-3.5" /> Pipette sur l’image
                </button>
              )}

              <button
                type="button"
                onClick={onToggleCheckerboardDark}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-stone-200 text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                title="Basculer le damier d'aperçu clair/sombre"
              >
                {checkerboardDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Damier clair
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-stone-600" /> Damier sombre
                  </>
                )}
              </button>
            </div>

            <div className="pt-2.5 border-t border-stone-200/80 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-stone-500 mr-1 flex items-center gap-1">
                NOUVEAU FOND :
              </span>
              {[
                { id: 'transparent', label: 'Transparent (PNG)', dot: 'bg-white border-dashed border-stone-400' },
                { id: '#ffffff', label: 'Blanc Pur (#FFF)', dot: 'bg-white border-stone-300 shadow-sm' },
                { id: '#f5f5f5', label: 'Gris Studio (#F5)', dot: 'bg-[#f5f5f5] border-stone-300' },
                { id: '#1c1917', label: 'Noir Élégant', dot: 'bg-stone-900 border-stone-900' },
                { id: '#ea580c', label: 'Orange VEOL', dot: 'bg-orange-600 border-orange-600' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      bgReplaceColor: c.id,
                      outputFormat: c.id === 'transparent' ? 'image/png' : config.outputFormat,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    config.bgReplaceColor === c.id
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full border ${c.dot}`} />
                  {c.label}
                </button>
              ))}

              <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-stone-200">
                <span className="text-xs text-stone-500 font-medium">Couleur perso :</span>
                <input
                  type="color"
                  value={
                    config.bgReplaceColor && config.bgReplaceColor !== 'transparent'
                      ? config.bgReplaceColor
                      : '#ffffff'
                  }
                  onChange={(e) => onUpdateConfig({ bgReplaceColor: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border border-stone-300 bg-white"
                  title="Choisir une couleur de fond personnalisée"
                />
              </div>
            </div>
          </div>

          <ActionApplyButton
            count={items.length}
            isProcessing={isBatchProcessing}
            status={batchStatus}
            stale={hasStaleItems}
            label="Retirer le fond (PNG)"
            onClick={onProcessAll}
          />
        </div>
      )}

      {/* LOGO EN BLANC */}
      {selectedTool === 'logo-white' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-semibold text-stone-500 flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-stone-700" />
                COULEUR DU LOGO :
              </span>
              {[
                { hex: '#ffffff', label: 'Blanc Pur (#FFFFFF)', dot: 'bg-white border-stone-400 shadow-sm' },
                { hex: '#000000', label: 'Noir Pur (#000000)', dot: 'bg-black border-stone-900' },
                { hex: '#001a70', label: 'Bleu EDF (#001A70)', dot: 'bg-[#001a70] border-[#001a70]' },
                { hex: '#fe5815', label: 'Orange EDF (#FE5815)', dot: 'bg-[#fe5815] border-[#fe5815]' },
              ].map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => onUpdateConfig({ monochromeColor: preset.hex })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    config.monochromeColor.toLowerCase() === preset.hex
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full border ${preset.dot}`} />
                  {preset.label}
                </button>
              ))}

              <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
                <span className="text-xs text-stone-500 font-medium">Autre teinte :</span>
                <input
                  type="color"
                  value={config.monochromeColor || '#ffffff'}
                  onChange={(e) => onUpdateConfig({ monochromeColor: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border border-stone-300 bg-white"
                  title="Choisir une teinte monochrome personnalisée"
                />
              </div>
            </div>

            <div className="pt-2.5 border-t border-stone-200/80 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-stone-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoStripLightBg}
                  onChange={(e) => onUpdateConfig({ autoStripLightBg: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Supprimer auto. le fond blanc/clair (fond 100% transparent)</span>
              </label>

              {config.autoStripLightBg && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Seuil :</span>
                  <input
                    type="range"
                    min={2}
                    max={60}
                    value={config.colorTolerance}
                    onChange={(e) => onUpdateConfig({ colorTolerance: Number(e.target.value) })}
                    className="w-24 accent-stone-900"
                  />
                  <span className="font-mono text-xs font-bold text-stone-900">
                    {config.colorTolerance}%
                  </span>
                </div>
              )}

              <label className="flex items-center gap-1.5 text-xs text-stone-700 font-medium cursor-pointer pl-2 border-l border-stone-200">
                <input
                  type="checkbox"
                  checked={config.keepSvgVector}
                  onChange={(e) => onUpdateConfig({ keepSvgVector: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Conserver .SVG vectoriel</span>
              </label>

              <button
                type="button"
                onClick={onToggleCheckerboardDark}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-stone-200 text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                title="Basculer le damier d'aperçu clair/sombre"
              >
                {checkerboardDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Damier clair
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-stone-600" /> Damier sombre
                  </>
                )}
              </button>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={onInspectFirst}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer"
                >
                  <Pipette className="w-3.5 h-3.5" /> Pipette fond
                </button>
              )}
            </div>
          </div>

          <ActionApplyButton
            count={items.length}
            isProcessing={isBatchProcessing}
            status={batchStatus}
            stale={hasStaleItems}
            label="Actualiser le logo"
            onClick={onProcessAll}
          />
        </div>
      )}

      {/* CROP & ORIENTATION */}
      {selectedTool === 'crop' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-stone-500 mr-1">RATIO :</span>
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
                    onClick={() => onUpdateConfig({ cropPreset: c.id as CropPreset })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
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
                    onUpdateConfig({
                      rotateDeg: (((config.rotateDeg + 90) % 360) as 0 | 90 | 180 | 270),
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Pivoter 90° ({config.rotateDeg}°)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ flipH: !config.flipH })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    config.flipH
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-[#FAF8F5] border-stone-200 text-stone-700'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" /> Miroir H
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ flipV: !config.flipV })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
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
                    onClick={onInspectFirst}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:underline ml-2 cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5" /> Tracer une zone libre à la souris
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#FAF8F5] border border-stone-200/90 p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
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
                    onClick={() => onUpdateConfig({ resizeMode: m.id as ResizeMode })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
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
                      onUpdateConfig({
                        targetWidth: Math.max(1, Number(e.target.value)),
                        lockAspectRatio: true,
                      })
                    }
                    className="w-24 rounded-xl bg-white border border-stone-300 px-2.5 py-1 font-mono text-sm font-bold text-stone-900"
                  />
                  <span className="font-mono text-xs text-stone-500">px</span>
                  <div className="flex gap-1 ml-1">
                    {[600, 1080, 1280, 1920].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => onUpdateConfig({ targetWidth: w, lockAspectRatio: true })}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded border cursor-pointer ${
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
                    onChange={(e) => onUpdateConfig({ maxSidePx: Number(e.target.value) })}
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
                    onChange={(e) => onUpdateConfig({ scalePercentage: Number(e.target.value) })}
                    className="flex-1 accent-stone-900"
                  />
                  <span className="font-mono text-xs font-bold text-orange-600">
                    {config.scalePercentage}%
                  </span>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 lg:border-l lg:border-stone-200/80 lg:pl-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-stone-700" />
                  Compression :
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ compressionMode: 'quality' })}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                      config.compressionMode === 'quality'
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-500 hover:bg-stone-200/60'
                    }`}
                  >
                    Qualité %
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ compressionMode: 'target-size' })}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
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
                    onChange={(e) => onUpdateConfig({ quality: Number(e.target.value) })}
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
                      onUpdateConfig({
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

              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none border-l border-stone-200 pl-4">
                <input
                  type="checkbox"
                  checked={config.stripMetadata}
                  onChange={(e) => onUpdateConfig({ stripMetadata: e.target.checked })}
                  className="rounded accent-stone-900"
                />
                <span>Supprimer les métadonnées EXIF / GPS</span>
              </label>
            </div>

            <ActionApplyButton
              count={items.length}
              isProcessing={isBatchProcessing}
              status={batchStatus}
              stale={hasStaleItems}
              label="Appliquer le cadrage"
              onClick={onProcessAll}
            />
          </div>
        </div>
      )}

      {/* RENAME */}
      {selectedTool === 'rename' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateConfig({ renamePattern: 'sequential' })}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  config.renamePattern === 'sequential'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                }`}
              >
                Numérotation (001, 002…)
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ renamePattern: 'keep' })}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
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
                onChange={(e) => onUpdateConfig({ customBaseName: e.target.value })}
                placeholder="Nom de base (ex: vacances)"
                className="w-40 rounded-xl bg-[#FAF8F5] border border-stone-300 px-3 py-1.5 font-mono text-xs"
              />
            )}

            <input
              type="text"
              value={config.renamePrefix}
              onChange={(e) => onUpdateConfig({ renamePrefix: e.target.value })}
              placeholder="Préfixe (ex: web_)"
              className="w-36 rounded-xl bg-[#FAF8F5] border border-stone-300 px-3 py-1.5 font-mono text-xs"
            />
            <input
              type="text"
              value={config.renameSuffix}
              onChange={(e) => onUpdateConfig({ renameSuffix: e.target.value })}
              placeholder="Suffixe (ex: _hd)"
              className="w-36 rounded-xl bg-[#FAF8F5] border border-stone-300 px-3 py-1.5 font-mono text-xs"
            />
          </div>

          <ActionApplyButton
            count={items.length}
            isProcessing={isBatchProcessing}
            status={batchStatus}
            stale={hasStaleItems}
            label="Générer les fichiers"
            onClick={onProcessAll}
          />
        </div>
      )}

      {/* PRIVACY BLUR HEADER INFO */}
      {selectedTool === 'privacy-blur' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Tracez des zones de flou gaussien, mosaïque ou masque noir directement sur l’image. Traitement 100 % local, EXIF/GPS retirés par défaut.
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700 font-semibold shrink-0">
            100 % RGPD • ZÉRO SERVEUR
          </span>
        </div>
      )}

      {/* MOCKUP STUDIO HEADER INFO */}
      {selectedTool === 'mockup' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>
              Glissez une ou plusieurs captures d’écran pour les habiller en PC portable, Fenêtre Navigateur, Tablette ou Smartphone.
            </span>
          </div>
          <span className="font-mono text-[11px] text-stone-400 shrink-0">
            Export HD 2400×1600 / VEOL 1280px • PNG / JPG / WebP • ZIP par lot
          </span>
        </div>
      )}
    </section>
  );
};

const ActionApplyButton: React.FC<{
  count: number;
  isProcessing: boolean;
  status: string;
  stale?: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ count, isProcessing, status, stale, label, icon, onClick }) => (
  <button
    type="button"
    disabled={count === 0 || isProcessing}
    onClick={onClick}
    className="relative shrink-0 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-xs shadow-tactile flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
  >
    {stale && !isProcessing && count > 0 && (
      <span
        className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white"
        title="Paramètres modifiés — cliquez pour actualiser le rendu"
      />
    )}
    {isProcessing ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-mono">{status}</span>
      </>
    ) : (
      <>
        {icon || <Sparkles className="w-4 h-4" />}
        <span>
          {stale && count > 0 ? 'Actualiser' : label} {count > 1 ? `(${count})` : ''}
        </span>
      </>
    )}
  </button>
);
