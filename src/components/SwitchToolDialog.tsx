import React, { useEffect, useRef } from 'react';
import { ToolId } from '../types';
import { ALL_TOOLS } from '../data/tools';
import { ArrowRightCircle, Trash2, X } from 'lucide-react';

interface SwitchToolDialogProps {
  pendingTool: ToolId | null | undefined; // undefined = closed, null = Home Hub, ToolId = another tool
  itemsCount: number;
  hasProcessed: boolean;
  onTransfer: () => void;
  onResetAndSwitch: () => void;
  onCancel: () => void;
}

export const SwitchToolDialog: React.FC<SwitchToolDialogProps> = ({
  pendingTool,
  itemsCount,
  hasProcessed,
  onTransfer,
  onResetAndSwitch,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = pendingTool !== undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onCancel();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onCancel]);

  if (!isOpen) return null;

  const targetMeta = pendingTool ? ALL_TOOLS.find((t) => t.id === pendingTool) : null;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby="switchToolTitle"
      className="m-auto w-[92vw] max-w-md rounded-3xl bg-white text-stone-900 border border-stone-200 shadow-2xl p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="switchToolTitle" className="font-display text-lg font-extrabold text-stone-900">
            {targetMeta ? `Passer vers « ${targetMeta.title} » ?` : 'Retourner à l’accueil ?'}
          </h2>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            Vous avez actuellement <strong>{itemsCount} image{itemsCount > 1 ? 's' : ''}</strong> chargée{itemsCount > 1 ? 's' : ''}. Que souhaitez-vous faire ?
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Annuler"
          className="p-1.5 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        {targetMeta && (
          <button
            type="button"
            onClick={onTransfer}
            className="w-full px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-tactile transition cursor-pointer"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>
              {hasProcessed
                ? `Continuer avec ${itemsCount > 1 ? `les ${itemsCount} résultats` : 'le résultat'}`
                : `Transférer ${itemsCount > 1 ? `les ${itemsCount} images` : 'l’image'}`}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onResetAndSwitch}
          className="w-full px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>{targetMeta ? 'Ouvrir à vide (effacer le lot actuel)' : 'Effacer le lot et quitter'}</span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold transition cursor-pointer"
        >
          Rester dans l’outil actuel
        </button>
      </div>
    </dialog>
  );
};
