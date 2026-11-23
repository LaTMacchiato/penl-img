import React, { useState } from 'react';
import { ImageItem, ToolId } from '../types';
import { INTERNAL_TOOLS } from '../data/tools';
import { formatBytes } from '../utils/fileExtractor';
import {
  Archive,
  FolderCheck,
  Download,
  Copy,
  Check,
  ArrowRightCircle,
} from 'lucide-react';

interface ExportBarProps {
  selectedTool: ToolId;
  doneItems: ImageItem[];
  totalProcessedBytes: number;
  totalSavedPercent: number;
  copiedId: string | null;
  onCopyClipboard: (item: ImageItem) => Promise<void>;
  onDownloadZip: () => Promise<void>;
  onExportToLocalFolder: () => Promise<void>;
  onChainToTool: (targetTool: ToolId) => Promise<void>;
}

export const ExportBar: React.FC<ExportBarProps> = ({
  selectedTool,
  doneItems,
  totalProcessedBytes,
  totalSavedPercent,
  copiedId,
  onCopyClipboard,
  onDownloadZip,
  onExportToLocalFolder,
  onChainToTool,
}) => {
  const [showChainMenu, setShowChainMenu] = useState(false);

  if (doneItems.length === 0) return null;

  const singleItem = doneItems.length === 1 ? doneItems[0] : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-stone-200 rounded-2xl px-5 py-3 shadow-tactile">
      <div className="font-mono text-xs text-stone-600 flex items-center gap-2 flex-wrap">
        <span>
          {doneItems.length === 1 ? 'Poids final :' : `Poids total (${doneItems.length}) :`}{' '}
          <strong className="text-stone-900">{formatBytes(totalProcessedBytes)}</strong>
        </span>
        {totalSavedPercent > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            -{totalSavedPercent}%
          </span>
        )}
        {totalSavedPercent < 0 && (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
            +{Math.abs(totalSavedPercent)}%
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Tool Chaining Dropdown ("Continuer dans…") */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowChainMenu((s) => !s)}
            className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Envoyer le résultat directement vers un autre outil sans ré-importer"
          >
            <ArrowRightCircle className="w-4 h-4 text-orange-600" />
            Continuer dans…
          </button>

          {showChainMenu && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-30">
              <div className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Transférer {doneItems.length > 1 ? `les ${doneItems.length} résultats` : 'le résultat'} vers :
              </div>
              {INTERNAL_TOOLS.filter((t) => t.id !== selectedTool).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setShowChainMenu(false);
                    onChainToTool(t.id);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 flex items-center gap-2 transition cursor-pointer"
                >
                  <span className={t.accentText}>{t.icon}</span>
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Smart Single-Image vs Multi-Image Export */}
        {singleItem && singleItem.processedUrl ? (
          <>
            <button
              type="button"
              onClick={() => onCopyClipboard(singleItem)}
              className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedId === singleItem.id ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4 text-stone-600" />
              )}
              {copiedId === singleItem.id ? 'Copié' : 'Copier'}
            </button>
            <a
              href={singleItem.processedUrl}
              download={singleItem.outputFileName || singleItem.file.name}
              className="px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-orange-600 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              Télécharger l’image
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onExportToLocalFolder}
              className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FolderCheck className="w-4 h-4 text-stone-600" />
              Vers un Dossier
            </button>
            <button
              type="button"
              onClick={onDownloadZip}
              className="px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              Télécharger tout (.ZIP)
            </button>
          </>
        )}
      </div>
    </div>
  );
};
